// @gum-jsx/mark: Markdown to ANSI terminal output with Gum and TeX images.

import { Marked } from 'marked'
import { createMathExtensions, createRenderer } from './mark'
import { queryCellSize, readStdin } from './terminal'
import type { Options as MarkdownArgs, VirtualOptions } from './mark'

function displayMarkdown(content: string, args: MarkdownArgs = {}): string {
  const marked = new Marked({
    renderer: createRenderer(args),
    extensions: createMathExtensions(args),
  })
  return marked.parse(content) as string
}

export { displayMarkdown, queryCellSize, readStdin }
export type { MarkdownArgs, VirtualOptions }
