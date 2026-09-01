// Custom marked renderer for terminal output with gum.jsx support

import { readFileSync } from 'fs'
import type { Tokens, RendererObject, TokenizerAndRendererExtension } from 'marked'

import { rasterizeSvg, ansi, formatImage, formatPlaceholder, pngSize } from '@gum-jsx/node'
import { resolveEnv, type Env } from '@gum-jsx/core/env'
import { mathToElement } from '@gum-jsx/math'
import type { Size, ThemeName } from '@gum-jsx/core/lib/types'

const HEADING_COLORS = ['magenta', 'blue', 'green', 'red', 'cyan', 'yellow']

// Placeholder (pager) mode: images become kitty virtual placements referenced by Unicode
// placeholder cells in the text, which survive being redrawn by a pager like `less -R`.
// The transmission escapes go through `transmit` so the caller can send them straight to
// the tty instead of through the pager (which would mangle them).
interface VirtualOptions {
  cell: Size                       // the terminal's cell size in pixels
  columns?: number                 // terminal width in cells; wider images are scaled down to fit
  transmit: (esc: string) => void  // receives each image's transmission escape sequence
  nextId?: number                  // internal: the running kitty image id
}

interface Options {
  width?: number      // max width in pixels for gum blocks, images, and math
  height?: number     // max height in pixels for gum blocks, images, and math
  theme?: ThemeName   // theme for gum blocks and math
  imageId?: number    // kitty image id
  env?: Env           // the Env gum blocks and math evaluate against (default: the default Env, which must have the math plugin for <Latex>)
  virtual?: VirtualOptions  // render images as Unicode placeholders for paging
}

interface MathToken extends Tokens.Generic {
  type: 'math'
  raw: string
  text: string
  displayMode: boolean
}

// Parse space-delimited key=value options from string
function parseOptions(str: string): Options {
  const opts: Options = {}
  for (const part of str.split(/\s+/)) {
    const eq = part.indexOf('=')
    if (eq > 0) {
      const key = part.slice(0, eq)
      const value = part.slice(eq + 1)
      if (key == 'height' || key == 'width') {
        opts[key] = Number(value)
      } else if (key == 'theme' && (value == 'light' || value == 'dark')) {
        opts.theme = value
      }
    }
  }
  return opts
}

// Check if language is gum/gum.jsx
function isGumLang(lang: string): boolean {
  return lang === 'gum' || lang === 'gum.jsx'
}

// Max pixel box from width/height options (either may be omitted)
function maxSize({ width, height }: Options): Size | undefined {
  if (width == null && height == null) return undefined
  return [ width ?? Infinity, height ?? Infinity ]
}

// Emit an image for the terminal. Normally a kitty escape placement; inline images go
// over a single terminal row (r=1, width from aspect) so the cursor lands to their right
// and text flows on, instead of dropping to the image's last row — kitty downscales the
// 2x-ish render to the cell height, keeping it crisp. In virtual (pager) mode the image
// is transmitted as a virtual placement and a placeholder cell grid is returned instead,
// sized to the natural pixel dimensions (one row for inline), capped at the terminal width.
function emitImage(png: Buffer, { imageId, virtual }: Options, inline = false): string {
  if (!virtual) {
    return formatImage(png, { imageId, rows: inline ? 1 : undefined })
  }
  const [ pngW, pngH ] = pngSize(png)
  const [ cellW, cellH ] = virtual.cell
  let rows: number, cols: number
  if (inline) {
    rows = 1
    cols = Math.max(1, Math.round((pngW / pngH) * (cellH / cellW)))
  } else {
    rows = Math.max(1, Math.ceil(pngH / cellH))
    cols = Math.max(1, Math.ceil(pngW / cellW))
  }
  if (virtual.columns != null && cols > virtual.columns) {
    rows = Math.max(1, Math.round(rows * virtual.columns / cols))
    cols = virtual.columns
  }
  const id = virtual.nextId = (virtual.nextId ?? 0) + 1
  virtual.transmit(formatImage(png, { imageId: id, virtual: true, rows, columns: cols }))
  return formatPlaceholder(id, rows, cols)
}

function displayGum(code: string, opts: Options = {}): string {
  const { theme = 'dark', width = 1000, height = 500, env } = opts
  const size: Size = [ width, height ]
  const elem = resolveEnv(env).evaluate(code, { theme, size })
  const svg = elem.svg()
  const png = rasterizeSvg(svg, { env: elem.env })
  return emitImage(png, opts) + '\n'
}

function displaySvg(svg: string, opts: Options = {}): string {
  const png = rasterizeSvg(svg, { size: maxSize(opts), env: opts.env })
  return emitImage(png, opts)
}

// Render math scaled to fit the given box (defaults differ for display/inline)
function renderMath(tex: string, displayMode: boolean, opts: Options): string {
  const { theme = 'dark', env } = opts
  const fallback = displayMode ? `$$\n${tex}\n$$` : `$${tex}$`
  const width = opts.width ?? (displayMode ? 750 : 600)
  const height = opts.height ?? (displayMode ? 75 : 40)

  try {
    // size the math box up front (Svg fits it by aspect) so the SVG rasterizes
    // at its final resolution — rasterizing at the natural size and letting the
    // canvas scale the bitmap up blurs the glyphs, badly for short display math
    const elem = mathToElement(tex, { inline: !displayMode, theme, size: [ width, height ], env })
    const png = rasterizeSvg(elem.svg(), { env: elem.env })
    return emitImage(png, opts, !displayMode)
  } catch {
    return ansi(fallback, { fg: 'gray' })
  }
}

// Create Marked extensions for TeX math delimiters.
function createMathExtensions(globalOpts: Options = {}): TokenizerAndRendererExtension[] {
  return [
    {
      name: 'math',
      level: 'block',
      start(src: string): number | void {
        return src.match(/^ {0,3}\$\$/m)?.index
      },
      tokenizer(src: string): MathToken | undefined {
        const dollarMatch = src.match(/^ {0,3}\$\$[ \t]*(?:\n([\s\S]+?)\n {0,3}\$\$[ \t]*|\s*([^\n]+?)\s*\$\$[ \t]*)(?:\n+|$)/)
        if (dollarMatch) {
          return {
            type: 'math',
            raw: dollarMatch[0],
            text: (dollarMatch[1] ?? dollarMatch[2]).trim(),
            displayMode: true
          }
        }
      },
      renderer(token: Tokens.Generic): string {
        const math = token as MathToken
        return renderMath(math.text, true, globalOpts) + '\n\n'
      }
    },
    {
      name: 'math',
      level: 'inline',
      start(src: string): number | void {
        return src.indexOf('$')
      },
      tokenizer(src: string): MathToken | undefined {
        const dollarMatch = src.match(/^\$(?![\s$])((?:\\.|[^\n\\$])+?)(?<!\s)\$(?!\$)/)
        if (dollarMatch) {
          return {
            type: 'math',
            raw: dollarMatch[0],
            text: dollarMatch[1],
            displayMode: false
          }
        }
      },
      renderer(token: Tokens.Generic): string {
        const math = token as MathToken
        const body = renderMath(math.text, math.displayMode, globalOpts)
        const foot = math.displayMode ? '\n\n' : ''
        return body + foot
      }
    }
  ]
}

// Create renderer with given global options
function createRenderer(globalOpts: Options = {}): RendererObject {
  return {
    // Block elements
    heading({ tokens, depth }: Tokens.Heading): string {
      const text = this.parser.parseInline(tokens)
      const prefix = '#'.repeat(depth)
      const clr = HEADING_COLORS[depth - 1] || 'magenta'
      return ansi(`${prefix} ${text}`, { fg: clr, bold: true }) + '\n\n'
    },

    paragraph({ tokens }: Tokens.Paragraph): string {
      const text = this.parser.parseInline(tokens)
      return `${text}\n\n`
    },

    code({ text, lang }: Tokens.Code): string {
      const [baseLang, ...rest] = (lang || '').split(/\s+/)
      const localOpts = parseOptions(rest.join(' '))
      const opts = { ...globalOpts, ...localOpts }

      if (isGumLang(baseLang)) {
        try {
          return displayGum(text, opts)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          return `[gum.jsx error: ${message}]\n\n`
        }
      }

      return `\`\`\`${ansi(baseLang, { fg: 'blue' })}\n${ansi(text, { fg: 'gray' })}\n\`\`\`\n\n`
    },

    blockquote({ tokens }: Tokens.Blockquote): string {
      const text = this.parser.parse(tokens).trim().replace(/\n/g, '\n > ')
      return ` > ${text}\n\n`
    },

    list({ items, ordered }: Tokens.List): string {
      return items.map((item: Tokens.ListItem, i: number) => {
        const bullet = ordered ? ` ${i + 1}. ` : ' — '
        const text = this.parser.parse(item.tokens).trim()
        return bullet + text
      }).join('\n') + '\n\n'
    },

    hr(): string {
      return '---\n\n'
    },

    // Inline elements
    strong({ tokens }: Tokens.Strong): string {
      const text = this.parser.parseInline(tokens)
      return ansi(`**${text}**`, { bold: true })
    },

    em({ tokens }: Tokens.Em): string {
      const text = this.parser.parseInline(tokens)
      return ansi(`_${text}_`, { fg: 'gray', italic: true, bold: true })
    },

    codespan({ text }: Tokens.Codespan): string {
      return `\`${ansi(text, { fg: 'blue' })}\``
    },

    link({ href, tokens }: Tokens.Link): string {
      const text = this.parser.parseInline(tokens)
      return `[${ansi(text, { fg: 'blue' })}](${ansi(href, { fg: 'gray' })})`
    },

    image({ href, text }: Tokens.Image): string {
      const isUrl = /^https?:\/\//.test(href)
      const ext = href.split('.').pop()?.toLowerCase()

      if (isUrl) return ansi(`[External URL: ${href}]`, { fg: 'gray' })

      try {
        if (ext === 'png') {
          const png = readFileSync(href)
          return emitImage(png, globalOpts)
        } else if (ext == 'svg') {
          const svg = readFileSync(href, 'utf8')
          const opts = { ...globalOpts, ...parseOptions(text ?? '') }
          return displaySvg(svg, opts)
        } else if (ext == 'jsx') {
          const data = readFileSync(href, 'utf8')
          const opts = { ...globalOpts, ...parseOptions(text ?? '') }
          return displayGum(data, opts)
        } else {
          return ansi(`[Unsupported image type: ${ext}]`, { fg: 'gray' })
        }
      } catch {
        return ansi(`[Unable to load image: ${href}]`, { fg: 'gray' })
      }
    },

    text(token: Tokens.Text | Tokens.Escape): string {
      if ('tokens' in token) {
        return this.parser.parseInline(token.tokens ?? [])
      } else {
        return token.text
      }
    },

    html(token: Tokens.HTML | Tokens.Tag): string {
      return 'text' in token ? token.text : ''
    },

    br(): string {
      return '\n'
    }
  }
}

export type { Options, VirtualOptions }
export { parseOptions, createRenderer, createMathExtensions }
