# @gum-jsx/mark

Markdown-to-terminal rendering for [gum.jsx](https://github.com/CompendiumLabs/gum-jsx).
It renders ANSI-styled text with fenced `gum` code blocks, local PNG/SVG/JSX
images, and TeX math displayed through the kitty graphics protocol.

```sh
bun run gum-mark notes.md -t light -H 100
bun run gum-mark notes.md -p
printf 'Hello $x^2$\n' | bun run gum-mark
```

Code block options `width=`, `height=`, and `theme=` override the command-wide
settings. Image alt text accepts the same options, such as
`![height=300](figure.png)`.

```ts
import { displayMarkdown } from '@gum-jsx/mark'

process.stdout.write(displayMarkdown(markdown, { theme: 'light', width: 800 }))
```

The terminal must support the kitty image protocol, such as kitty or Ghostty.
