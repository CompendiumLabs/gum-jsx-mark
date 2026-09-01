// @gum-jsx/mark: Markdown → terminal rendering for gum.jsx
//
// Renders Markdown to ANSI-styled text for the terminal, with fenced `gum`
// code blocks, image links, and TeX math ($...$ / $$...$$) displayed inline as
// kitty graphics.

import { Marked } from 'marked'

import { createRenderer, createMathExtensions } from './mark'
import type { Options as MarkdownArgs, VirtualOptions } from './mark'

function displayMarkdown(content: string, args: MarkdownArgs = {}): string {
  const marked = new Marked({
    renderer: createRenderer(args),
    extensions: createMathExtensions(args),
  })
  return marked.parse(content) as string
}

//
// exports
//

export { displayMarkdown }
export type { MarkdownArgs, VirtualOptions }
