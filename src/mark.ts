import { readFileSync } from 'node:fs'
import type { RendererObject, TokenizerAndRendererExtension, Tokens } from 'marked'
import { available, evaluate, make_request, render_element } from '@gum-jsx/core'
import type { Size, ThemeName } from '@gum-jsx/core'
import { rasterize_svg } from '@gum-jsx/png'
import { createMathFonts, mathToElement } from '@gum-jsx/math'
import * as math from '@gum-jsx/math'
import { ansi, formatImage, formatPlaceholder, pngSize } from './terminal'

const HEADING_COLORS = ['magenta', 'blue', 'green', 'red', 'cyan', 'yellow'] as const
const DEFAULT_IMAGE_HEIGHT = 500

interface VirtualOptions {
  cell: Size
  columns?: number
  transmit: (escape: string) => void
  nextId?: number
}

interface Options {
  width?: number
  imageHeight?: number
  height?: number
  inlineHeight?: number
  theme?: ThemeName
  imageId?: number
  cell?: Size
  scope?: Readonly<Record<string, unknown>>
  virtual?: VirtualOptions
}

interface MathToken extends Tokens.Generic {
  type: 'math'
  raw: string
  text: string
  displayMode: boolean
}

function parseOptions(source: string): Options {
  const options: Options = {}
  for (const part of source.split(/\s+/)) {
    const equals = part.indexOf('=')
    if (equals <= 0) continue
    const key = part.slice(0, equals)
    const value = part.slice(equals + 1)
    if (key === 'width') options.width = Number(value)
    else if (key === 'height') options.imageHeight = Number(value)
    else if (key === 'theme' && (value === 'light' || value === 'dark')) options.theme = value
  }
  return options
}

function isGumLang(language: string): boolean {
  return language === 'gum' || language === 'gum.jsx'
}

function maxSize({ width, imageHeight = DEFAULT_IMAGE_HEIGHT }: Options): Size {
  return Object.freeze({ width: width ?? Infinity, height: imageHeight })
}

function emitImage(png: Buffer, { imageId, cell, virtual }: Options,
  { inline = false, max }: { inline?: boolean; max?: Size } = {}): string {
  const natural = pngSize(png)
  const scale = max === undefined ? 1
    : Math.min(1, max.width / natural.width, max.height / natural.height)
  if (!virtual) {
    if (inline) return formatImage(png, { imageId, rows: 1 })
    if (scale === 1 || cell === undefined) return formatImage(png, { imageId })
    return max!.height / natural.height <= max!.width / natural.width
      ? formatImage(png, { imageId,
        rows: Math.max(1, Math.round(natural.height * scale / cell.height)) })
      : formatImage(png, { imageId,
        columns: Math.max(1, Math.round(natural.width * scale / cell.width)) })
  }

  let rows: number
  let columns: number
  if (inline) {
    rows = 1
    columns = Math.max(1, Math.round(natural.width / natural.height
      * virtual.cell.height / virtual.cell.width))
  } else {
    rows = Math.max(1, Math.ceil(natural.height * scale / virtual.cell.height))
    columns = Math.max(1, Math.ceil(natural.width * scale / virtual.cell.width))
  }
  if (virtual.columns !== undefined && columns > virtual.columns) {
    rows = Math.max(1, Math.round(rows * virtual.columns / columns))
    columns = virtual.columns
  }
  const id = virtual.nextId = (virtual.nextId ?? 0) + 1
  virtual.transmit(formatImage(png, {
    imageId: id, placementId: 1, virtual: true, rows, columns,
  }))
  return formatPlaceholder(id, rows, columns, 1)
}

// Sources that return a plain value print it as text: strings verbatim, the rest as JSON.
function formatValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2) ?? String(value)
}

function displayGum(code: string, options: Options = {}): string {
  const { theme = 'dark', width = 1000, imageHeight = DEFAULT_IMAGE_HEIGHT, scope = {} } = options
  const value = evaluate(code, {
    name: 'markdown.gum.jsx',
    scope: { ...math, ...scope },
  })
  const result = render_element(value, {
    request: make_request({ width: available(width), height: available(imageHeight) }),
    defaults: { theme },
    fonts: createMathFonts(),
  })
  if (result.kind === 'value') return ansi(formatValue(result.value), { fg: 'gray' })
  return emitImage(rasterize_svg(result.svg, { size: result.size }), options)
}

function displaySvg(svg: string, options: Options = {}): string {
  let png = rasterize_svg(svg)
  const natural = pngSize(png)
  const max = maxSize(options)
  const scale = Math.min(1, max.width / natural.width, max.height / natural.height)
  if (scale < 1) {
    png = rasterize_svg(svg, { size: {
      width: natural.width * scale,
      height: natural.height * scale,
    } })
  }
  return emitImage(png, options)
}

function renderMath(tex: string, displayMode: boolean, options: Options): string {
  const { theme = 'dark' } = options
  const fallback = displayMode ? `$$\n${tex}\n$$` : `$${tex}$`
  const height = displayMode ? (options.height ?? 100) : (options.inlineHeight ?? 48)
  try {
    const element = mathToElement(tex, { inline: !displayMode })
    const { svg, size } = render_element(element, { defaults: { theme }, fonts: createMathFonts() })
    const width = size.width * height / size.height
    const png = rasterize_svg(svg, { size: { width, height } })
    return emitImage(png, options, { inline: !displayMode })
  } catch {
    return ansi(fallback, { fg: 'gray' })
  }
}

function createMathExtensions(globalOptions: Options = {}): TokenizerAndRendererExtension[] {
  return [
    {
      name: 'math',
      level: 'block',
      start(source: string): number | void {
        return source.match(/^ {0,3}\$\$/m)?.index
      },
      tokenizer(source: string): MathToken | undefined {
        const match = source.match(/^ {0,3}\$\$[ \t]*(?:\n([\s\S]+?)\n {0,3}\$\$[ \t]*|\s*([^\n]+?)\s*\$\$[ \t]*)(?:\n+|$)/)
        if (!match) return
        return { type: 'math', raw: match[0], text: (match[1] ?? match[2]!).trim(), displayMode: true }
      },
      renderer(token: Tokens.Generic): string {
        const mathToken = token as MathToken
        return renderMath(mathToken.text, true, globalOptions) + '\n\n'
      },
    },
    {
      name: 'math',
      level: 'inline',
      start(source: string): number | void {
        return source.indexOf('$')
      },
      tokenizer(source: string): MathToken | undefined {
        const match = source.match(/^\$(?![\s$])((?:\\.|[^\n\\$])+?)(?<!\s)\$(?!\$)/)
        if (!match) return
        return { type: 'math', raw: match[0], text: match[1]!, displayMode: false }
      },
      renderer(token: Tokens.Generic): string {
        const mathToken = token as MathToken
        return renderMath(mathToken.text, mathToken.displayMode, globalOptions)
      },
    },
  ]
}

function createRenderer(globalOptions: Options = {}): RendererObject {
  return {
    heading({ tokens, depth }: Tokens.Heading): string {
      const text = this.parser.parseInline(tokens)
      const color = HEADING_COLORS[depth - 1] ?? 'magenta'
      return ansi(`${'#'.repeat(depth)} ${text}`, { fg: color, bold: true }) + '\n\n'
    },

    paragraph({ tokens }: Tokens.Paragraph): string {
      return `${this.parser.parseInline(tokens)}\n\n`
    },

    code({ text, lang }: Tokens.Code): string {
      const [baseLanguage = '', ...rest] = (lang ?? '').split(/\s+/)
      const options = { ...globalOptions, ...parseOptions(rest.join(' ')) }
      if (isGumLang(baseLanguage)) {
        try { return displayGum(text, options) + '\n\n' }
        catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return `[gum.jsx error: ${message}]\n\n`
        }
      }
      return `\`\`\`${ansi(baseLanguage, { fg: 'blue' })}\n${ansi(text, { fg: 'gray' })}\n\`\`\`\n\n`
    },

    blockquote({ tokens }: Tokens.Blockquote): string {
      const text = this.parser.parse(tokens).trim().replace(/\n/g, '\n > ')
      return ` > ${text}\n\n`
    },

    list({ items, ordered }: Tokens.List): string {
      return items.map((item: Tokens.ListItem, index: number) => {
        const bullet = ordered ? ` ${index + 1}. ` : ' — '
        return bullet + this.parser.parse(item.tokens).trim()
      }).join('\n') + '\n\n'
    },

    hr(): string { return '---\n\n' },

    strong({ tokens }: Tokens.Strong): string {
      return ansi(`**${this.parser.parseInline(tokens)}**`, { bold: true })
    },

    em({ tokens }: Tokens.Em): string {
      return ansi(`_${this.parser.parseInline(tokens)}_`, { fg: 'gray', italic: true, bold: true })
    },

    codespan({ text }: Tokens.Codespan): string {
      return `\`${ansi(text, { fg: 'blue' })}\``
    },

    link({ href, tokens }: Tokens.Link): string {
      return `[${ansi(this.parser.parseInline(tokens), { fg: 'blue' })}](${ansi(href, { fg: 'gray' })})`
    },

    image({ href, text }: Tokens.Image): string {
      if (/^https?:\/\//.test(href)) return ansi(`[External URL: ${href}]`, { fg: 'gray' })
      const extension = href.split('.').pop()?.toLowerCase()
      try {
        const options = { ...globalOptions, ...parseOptions(text ?? '') }
        if (extension === 'png') {
          return emitImage(readFileSync(href), options, { max: maxSize(options) })
        }
        if (extension === 'svg') return displaySvg(readFileSync(href, 'utf8'), options)
        if (extension === 'jsx') return displayGum(readFileSync(href, 'utf8'), options)
        return ansi(`[Unsupported image type: ${extension}]`, { fg: 'gray' })
      } catch {
        return ansi(`[Unable to load image: ${href}]`, { fg: 'gray' })
      }
    },

    text(token: Tokens.Text | Tokens.Escape): string {
      return 'tokens' in token ? this.parser.parseInline(token.tokens ?? []) : token.text
    },

    html(token: Tokens.HTML | Tokens.Tag): string {
      return 'text' in token ? token.text : ''
    },

    br(): string { return '\n' },
  }
}

export { parseOptions, createRenderer, createMathExtensions }
export type { Options, VirtualOptions }
