# @gum-jsx/mark

[Gum](https://github.com/CompendiumLabs/gum-jsx) — installation, quickstart, and user documentation.

Markdown-to-terminal rendering for Gum.
It renders ANSI-styled text with fenced `gum` code blocks, local PNG/JSX
images, and TeX math displayed through the kitty graphics protocol.

## Library usage

The source library API requires Bun or a compatible TypeScript bundler.

```ts
import { displayMarkdown } from '@gum-jsx/mark'

const markdown = '# Hello\n\nInline math: $x^2$'
process.stdout.write(displayMarkdown(markdown, { theme: 'light', width: 800 }))
```

`displayMarkdown(content, options?)` returns a string containing ANSI text and
kitty image sequences. Gum figures and math use `@gum-jsx/png` and tiny-skia
WebAssembly without native addons or install scripts. Live text, emoji without
outlines, and external SVG images are unsupported. Use PNG or JSX images.
Local PNGs are sent directly to the terminal.

| Option | Meaning |
| --- | --- |
| `theme` | Figure and math palette: `light` or `dark`. |
| `width` | Maximum figure/image width in pixels. |
| `imageHeight` | Maximum figure/image height; default 500 pixels. |
| `fontSize` | Display-math font size in pixels; default 64. |
| `inlineFontSize` | Inline-math font size in pixels; default 48. |
| `scope` | Additional bindings for evaluated Gum source. |
| `cell` | Terminal cell size in pixels, for image placement. |
| `virtual` | Image transmission callback and cell geometry for placeholder output. |

`queryCellSize()` and `readStdin()` are also exported. The CLI handles terminal
queries and pager setup; run `bun run gumd --help` for its options and defaults.

Math uses its natural dimensions at the selected font size. Fractions, scripts,
and integrals can extend above or below a simple expression without shrinking
its glyphs. Direct inline output uses `C=1` and advances only horizontally,
keeping the following text on the same row. Tall math can overlap later lines.
Horizontal advance uses the terminal cell width, falling back to 10 pixels
when `cell` is unavailable. Pager output anchors tall inline math to one
invisible placeholder, keeping following text on the same row while the image
extends below it. This requires [relative placements](https://sw.kovidgoyal.net/kitty/graphics-protocol/#relative-placements)
(Kitty 0.31 or newer, or a compatible terminal). Pager math images are padded to
whole cells to preserve their scale, fitting to the terminal width only when
needed. Display math still reserves its full height.

Display equations support explicit `\tag{1.16}` and `\tag*{A}` labels. The math
renderer includes the label in the same image, with a two-em gap to the right;
multiline equations place each tag alongside its row. Automatic numbering is
not generated.

Use `fontSize` and `inlineFontSize` in place of the former `height` and
`inlineHeight` options. The corresponding CLI flags are `-s, --font-size` and
`-i, --inline-font-size`, replacing `--height` and `--inline-height`.

## Command development

From this package directory:

```sh
bun run gumd notes.md -t light -s 64 -i 20
bun run gumd notes.md -p
printf 'Hello $x^2$\n' | bun run gumd
```

The bundled `gumd` executable runs under Node.js 24+ or Bun 1.4.2+.
It includes the Markdown parser, Gum renderer, fonts, and PNG WebAssembly.
The package retains its source library exports and their dependencies. Omit the file or use `-` to
read stdin. The terminal must support the kitty graphics protocol; pager mode
also needs Unicode placeholder support and `less -R`.

Code block options `width=`, `height=`, and `theme=` override the command-wide
settings. Image alt text accepts the same options, such as
`![height=300](figure.png)`.

````markdown
# A short note

Inline math: $e^{i\pi}+1=0$.

```gum width=320 theme=light
<Frame padding={em(1)}>
  <Text>Hello, Gum</Text>
</Frame>
```
````

Local image paths resolve from the process's working directory. Gum fences and
JSX images execute JavaScript through the evaluator; render trusted documents.

## Development

From this package directory:

```sh
bun run build
bun run test
bun run typecheck
```

`build` writes the Node-compatible CLI and bundled assets/licenses to `dist/npm/`.
`npm pack` and `npm publish` invoke it through `prepack`.

Tests exercise the source CLI and the packed executable under Node and Bun.
