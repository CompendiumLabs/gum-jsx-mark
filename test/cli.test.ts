import { afterAll, expect, test } from 'bun:test'
import { chmodSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { version } from '../package.json'

const scratch = mkdtempSync(join(tmpdir(), 'gum-mark-cli-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
let invocation = 0
async function cli(args: string[], input = '', environment: Record<string, string> = {}) {
  const output = join(scratch, `stdout-${++invocation}`)
  const errors = join(scratch, `stderr-${invocation}`)
  const child = Bun.spawn([process.env.GUM_MARK_RUNTIME ?? process.execPath, '--no-addons',
    process.env.GUM_MARK_ENTRY ?? fileURLToPath(new URL('../src/cli.ts', import.meta.url)), ...args], {
    stdin: new Blob([input]), stdout: Bun.file(output), stderr: Bun.file(errors), cwd: scratch,
    detached: true,
    env: { ...process.env, ...(process.env.GUM_MARK_RUNTIME ? { PATH: '' } : {}), ...environment },
  })
  const code = await child.exited
  const [text, error] = await Promise.all([Bun.file(output).text(), Bun.file(errors).text()])
  return { code, text, error }
}

test('gum-mark reports its package version and command options', async () => {
  for (const flag of ['--version', '-V']) {
    expect(await cli([flag])).toEqual({ code: 0, text: `${version}\n`, error: '' })
  }
  const help = await cli(['--help'])
  expect(help.code).toBe(0)
  for (const option of ['--theme', '--width', '--image-height', '--font-size', '--inline-font-size', '--pager']) {
    expect(help.text).toContain(option)
  }
})

test('gum-mark reads files and stdin and renders embedded math', async () => {
  const content = '# Notes\n\nA **bold** $x$ formula\n'
  await Bun.write(join(scratch, 'notes.md'), content)
  const outputs = []
  for (const input of [[], ['-'], ['notes.md']]) {
    const result = await cli([...input, '--inline-font-size', '42'], content)
    expect(result.code).toBe(0)
    expect(result.error).toBe('')
    expect(result.text).toContain('# Notes')
    expect(result.text).toContain('**bold**')
    const encoded = [...result.text.matchAll(/\x1b_G[^;]*;([^\x1b]*)\x1b\\/g)]
      .map(match => match[1]).join('')
    const png = Buffer.from(encoded, 'base64')
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(png.readUInt32BE(20)).toBe(42)
    outputs.push(result.text)
  }
  expect(outputs[1]).toBe(outputs[0])
  expect(outputs[2]).toBe(outputs[0])
})

test('gum-mark rejects invalid dimensions, themes, and missing files', async () => {
  for (const option of ['--width', '--image-height', '--font-size', '--inline-font-size']) {
    const result = await cli([option, '0'])
    expect(result.code).toBe(1)
    expect(result.text).toBe('')
    expect(result.error).toContain('positive and finite')
  }
  const theme = await cli(['--theme', 'sepia'])
  expect(theme.code).toBe(1)
  expect(theme.error).toContain('Allowed choices')
  const missing = await cli(['missing.md'])
  expect(missing.code).toBe(1)
  expect(missing.error).toContain('ENOENT')
})

test('pager preserves image placements during initialization and repaint, then restores the screen', async () => {
  // Capture the pager's configuration and input without requiring an interactive terminal.
  const pager = join(scratch, 'less')
  await Bun.write(pager, `#!${process.env.GUM_MARK_RUNTIME ?? process.execPath}
import { readSync } from 'node:fs'
const buffer = Buffer.alloc(4096)
const input = buffer.toString('utf8', 0, readSync(0, buffer, 0, buffer.length, null))
console.log('PAGER=' + JSON.stringify({
  args: process.argv.slice(2),
  chars: process.env.LESSUTFCHARDEF,
  clear: process.env.LESS_TERMCAP_cl,
  input,
}))
`)
  chmodSync(pager, 0o755)
  const result = await cli(['-p', '-i', '48'], 'Before $\\dfrac{1}{2}$ after', {
    PATH: scratch, LESSUTFCHARDEF: 'e000:p',
  })
  expect(result.code).toBe(0)
  expect(result.error).toBe('')
  expect(result.text).toStartWith('\x1b[?1049h\x1b_G')
  expect(result.text).toEndWith('\x1b[?1049l')
  const captured = JSON.parse(result.text.match(/PAGER=(.*)\n/)![1])
  expect(captured.args).toEqual(['-R', '-X'])
  expect(captured.chars).toBe('e000:p,10eeee:p')
  expect(captured.clear).toBe('\x1b[H\x1b[J')
  expect(captured.input.trim().split('\n')).toHaveLength(1)
  expect(captured.input).toContain(' after')
})


test('gum-mark renders Gum fences and local JSX images with bundled fonts', async () => {
  const source = '<Text font-size={px(20)}>Bundled Gum</Text>'
  await Bun.write(join(scratch, 'figure.jsx'), source)
  const content = '```gum\n' + source + '\n```\n\n![height=60](figure.jsx)\n'
  const result = await cli([], content)
  expect(result.code).toBe(0)
  expect(result.error).toBe('')
  expect(result.text).not.toContain('Gum error')
  expect(result.text.match(/\x1b_Gf=100/g)).toHaveLength(2)
})
