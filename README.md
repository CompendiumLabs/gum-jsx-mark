# @gum-jsx/mark

Markdown-to-terminal rendering for [gum.jsx](https://github.com/CompendiumLabs/gum-jsx).
It renders ANSI-styled text with fenced `gum` code blocks, local PNG/SVG/JSX
images, and TeX math displayed through the kitty graphics protocol.

See the [Gum project](https://github.com/CompendiumLabs/gum-jsx#readme) for
getting started and the package overview.

## Command line

```sh
gum-mark notes.md -t light -H 100
gum-mark notes.md -p
printf 'Hello $x^2$\n' | gum-mark
```

The `gum-mark` executable belongs to `@gum-jsx/cli`. Omit the file or use `-` to
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

## Library usage

```ts
import { displayMarkdown } from '@gum-jsx/mark'

const markdown = '# Hello\n\nInline math: $x^2$'
process.stdout.write(displayMarkdown(markdown, { theme: 'light', width: 800 }))
```

`displayMarkdown(content, options?)` returns a string containing ANSI text and
kitty image sequences. This is a native host library: figure rendering uses
`@gum-jsx/png` and node-canvas.

| Option | Meaning |
| --- | --- |
| `theme` | Figure and math palette: `light` or `dark`. |
| `width` | Maximum figure/image width in pixels. |
| `imageHeight` | Maximum figure/image height; default 500 pixels. |
| `height` | Display-math render height. |
| `inlineHeight` | Inline-math render height. |
| `scope` | Additional bindings for evaluated Gum source. |
| `cell` | Terminal cell size in pixels, for image placement. |
| `virtual` | Image transmission callback and cell geometry for placeholder output. |

`queryCellSize()` and `readStdin()` are also exported. The CLI handles terminal
queries and pager setup; run `gum-mark --help` for its options and defaults.

## Development

Run `bun run test` and `bun run typecheck` from this package directory.
