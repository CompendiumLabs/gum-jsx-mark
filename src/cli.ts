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

function displayPaged(content: string, options: MarkdownArgs): void {
  const cell = queryCellSize() ?? { width: 10, height: 20 }
  const images: string[] = []
  const virtual: VirtualOptions = {
    cell,
    columns: process.stdout.columns,
    transmit: escape => images.push(escape),
  }
  const text = displayMarkdown(content, { ...options, virtual })

  // Send virtual images to less's alternate screen through the controlling tty.
  const alternateOn = '\x1b[?1049h'
  const alternateOff = '\x1b[?1049l'
  const data = Buffer.from(alternateOn + images.join(''))
  let descriptor: number | undefined
  try {
    descriptor = openSync('/dev/tty', 'w')
    let offset = 0
    while (offset < data.length) offset += writeSync(descriptor, data, offset, data.length - offset)
  } catch {
    process.stdout.write(data)
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
  }

  const definition = [process.env.LESSUTFCHARDEF, '10eeee:p'].filter(Boolean).join(',')
  const environment = { ...process.env, LESSUTFCHARDEF: definition }
  const result = spawnSync('less', ['-R'], {
    input: text,
    env: environment,
    stdio: ['pipe', 'inherit', 'inherit'],
  })
  if (result.error) process.stdout.write(alternateOff + text)
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
  .option('-H, --height <pixels>', 'Render height for display math',
    value => positiveNumber(value, 'display math height'), 100)
  .option('-i, --inline-height <pixels>', 'Render height for inline math',
    value => positiveNumber(value, 'inline math height'), 48)
  .option('-p, --pager', 'Page through less using kitty Unicode placeholders')
  .addHelpText('after', '\nExamples:\n  gum-mark README.md\n  gum-mark notes.md -t light -H 120\n  gum-mark notes.md -p\n  printf \'Hello $x^2$\\n\' | gum-mark\n')
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
