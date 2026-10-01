import { chmod, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { licenses } from './licenses'

const root = fileURLToPath(new URL('../', import.meta.url))
const dependencies = ['commander', 'marked', '@gum-jsx/core', '@gum-jsx/math', '@gum-jsx/png']
// Match acorn-jsx's CommonJS entry to avoid bundling a second Acorn parser.
const acorn = createRequire(import.meta.resolve('@gum-jsx/core')).resolve('acorn')

const outdir = join(root, 'dist/npm')
await rm(outdir, { recursive: true, force: true })
const result = await Bun.build({
  entrypoints: [join(root, 'src/bundled.ts')],
  target: 'node', outdir, naming: { entry: 'cli.js' },
  minify: { whitespace: true, syntax: true, identifiers: false },
  plugins: [{
    name: 'deduplicate-acorn',
    setup(build) {
      build.onResolve({ filter: /^acorn$/ }, () => ({ path: acorn }))
    },
  }],
})
if (!result.success) throw new AggregateError(result.logs, 'CLI bundle failed')
await chmod(join(outdir, 'cli.js'), 0o755)
await licenses(root, dependencies, join(outdir, 'licenses'))
