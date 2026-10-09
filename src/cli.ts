#!/usr/bin/env bun

import { spawnSync } from 'node:child_process'
import { closeSync, openSync, readFileSync, writeSync } from 'node:fs'
import { Command, InvalidArgumentError, Option } from 'commander'
import { version } from '../package.json'
import { displayMarkdown, queryCellSize, readStdin } from './index'
import type { MarkdownArgs, VirtualOptions } from './index'

type MarkOptions = MarkdownArgs & { pager?: boolean }

function positiveNumber(value: string, name: string): number {
  const number = value.trim() === '' ? NaN : Number(value)
  if (!Number.isFinite(number) || number <= 0) {
    throw new InvalidArgumentError(`${name} must be positive and finite`)
  }
  return number
}

// Write image setup and screen changes to the same terminal used by less.
function write_terminal(text: string): void {
  let descriptor: number
  try { descriptor = openSync('/dev/tty', 'w') }
  catch { process.stdout.write(text); return }
  try {
    const data = Buffer.from(text)
    let offset = 0
    while (offset < data.length) offset += writeSync(descriptor, data, offset, data.length - offset)
  } finally {
    closeSync(descriptor)
  }
}

function displayPaged(content: string, options: MarkdownArgs): void {
  const cell = queryCellSize() ?? { width: 10, height: 20 }
  const images: string[] = []
  const virtual: VirtualOptions = {
    cell,
    columns: process.stdout.columns,
    transmit: escape => images.push(escape),
  }
  const text = displayMarkdown(content, { ...options, virtual })

  // Own the alternate screen so less cannot reset the uploaded placements.
  const alternateOn = '\x1b[?1049h'
  const alternateOff = '\x1b[?1049l'
  write_terminal(alternateOn + images.join(''))

  const definition = [process.env.LESSUTFCHARDEF, '10eeee:p'].filter(Boolean).join(',')
  // A full-screen erase also deletes relative images; erase text from home instead.
  const environment = { ...process.env, LESSUTFCHARDEF: definition, LESS_TERMCAP_cl: '\x1b[H\x1b[J' }
  let result
  try {
    result = spawnSync('less', ['-R', '-X'], {
      input: text,
      env: environment,
      stdio: ['pipe', 'inherit', 'inherit'],
    })
  } finally {
    write_terminal(alternateOff)
  }
  if (result.error) process.stdout.write(text)
}

const program = new Command()
  .name('gum-mark')
  .version(version)
  .description('Render Markdown with embedded Gum figures and TeX math in a kitty-compatible terminal.')
  .argument('[file]', 'Markdown file (omit or use - for stdin)')
  .addOption(new Option('-t, --theme <theme>', 'Theme for Gum and math')
    .choices(['light', 'dark']).default('dark'))
  .option('-W, --width <pixels>', 'Maximum width for gum blocks and images',
    value => positiveNumber(value, 'width'))
  .option('-I, --image-height <pixels>', 'Maximum height for gum blocks and images',
    value => positiveNumber(value, 'image height'), 500)
  .option('-s, --font-size <pixels>', 'Font size for display math',
    value => positiveNumber(value, 'display math font size'), 36)
  .option('-i, --inline-font-size <pixels>', 'Font size for inline math',
    value => positiveNumber(value, 'inline math font size'), 24)
  .option('-p, --pager', 'Page through less using kitty Unicode placeholders')
  .addHelpText('after', '\nExamples:\n  gum-mark README.md\n  gum-mark notes.md -t light -s 64\n  gum-mark notes.md -p\n  printf \'Hello $x^2$\\n\' | gum-mark\n')
  .action(async (file: string | undefined, values: MarkOptions) => {
    const content = !file || file === '-' ? await readStdin() : readFileSync(file, 'utf8')
    const { pager, ...options } = values
    if (pager) displayPaged(content, options)
    else process.stdout.write(displayMarkdown(content, {
      ...options,
      cell: queryCellSize() ?? undefined,
    }))
  })

try { await program.parseAsync() }
catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
