import { expect, test } from 'bun:test'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { version } from '../package.json'

const root = fileURLToPath(new URL('../', import.meta.url))

test('packed CLI embeds Markdown, fonts, math, and rasterization', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'gum-mark-build-'))
  async function command(args: string[], env = process.env) {
    const child = Bun.spawn(args, { cwd: root, env, stdout: 'pipe', stderr: 'pipe' })
    const [code, out, err] = await Promise.all([
      child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
    ])
    expect(code, `${args.join(' ')}\n${out}\n${err}`).toBe(0)
    return out
  }
  try {
    await command(['npm', 'pack', '--pack-destination', scratch, '--cache', join(scratch, 'cache')])
    const archive = new Bun.Archive(await Bun.file(join(scratch, `gum-jsx-mark-${version}.tgz`)).arrayBuffer())
    const files = await archive.files()
    expect(files.has('package/dist/npm/cli.js')).toBe(true)
    expect(files.has('package/src/index.ts')).toBe(true)
    expect([...files.keys()].some(name => name.endsWith('/OFL.txt'))).toBe(true)
    expect([...files.keys()].some(name => name.includes('marked@') && /LICENSE/i.test(name))).toBe(true)
    expect([...files.keys()].every(name => !name.startsWith('package/dist/') || name.startsWith('package/dist/npm/'))).toBe(true)
    const consumer = join(scratch, 'consumer')
    await mkdir(consumer)
    await archive.extract(consumer)
    // Run the packed executable with no installed dependencies or workspace ancestry.
    const entry = join(consumer, 'package/dist/npm/cli.js')
    expect(await Bun.file(entry).text()).toStartWith('#!/usr/bin/env node')
    const node = process.env.GUM_NODE_RUNTIME ?? Bun.which('node')
    expect(node).not.toBeNull()
    for (const runtime of [node!, process.execPath]) {
      await command([process.execPath, 'test', 'test/cli.test.ts'], {
        ...process.env, GUM_MARK_ENTRY: entry, GUM_MARK_RUNTIME: runtime,
      })
    }
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}, 120_000)
