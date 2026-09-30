import { afterAll, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { version } from '../package.json'

const scratch = mkdtempSync(join(tmpdir(), 'gum-mark-cli-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))
async function cli(args: string[], input = '') {
  const child = Bun.spawn([process.execPath, '--no-addons',
    fileURLToPath(new URL('../src/cli.ts', import.meta.url)), ...args], {
    stdin: new Blob([input]), stdout: 'pipe', stderr: 'pipe', cwd: scratch,
  })
  const [code, text, error] = await Promise.all([
    child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
  ])
  return { code, text, error }
}

test('gum-mark reports its package version and command options', async () => {
  for (const flag of ['--version', '-V']) {
    expect(await cli([flag])).toEqual({ code: 0, text: `${version}\n`, error: '' })
  }
  const help = await cli(['--help'])
  expect(help.code).toBe(0)
  for (const option of ['--theme', '--width', '--image-height', '--height', '--inline-height', '--pager']) {
    expect(help.text).toContain(option)
  }
})

test('gum-mark reads files and stdin and renders embedded math', async () => {
  const content = '# Notes\n\nA **bold** $x^2$ formula\n'
  await Bun.write(join(scratch, 'notes.md'), content)
  const outputs = []
  for (const input of [[], ['-'], ['notes.md']]) {
    const result = await cli([...input, '--inline-height', '42'], content)
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
  for (const option of ['--width', '--image-height', '--height', '--inline-height']) {
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
