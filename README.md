# @gum-jsx/mark

Markdown-to-terminal rendering for [gum.jsx](https://github.com/CompendiumLabs/gum-jsx). Renders Markdown to ANSI-styled text, with fenced `gum` code blocks, image links (`.png`, `.svg`, `.jsx`), and TeX math (`$...$` and `$$...$$`) displayed inline as kitty graphics. It needs a terminal that supports the kitty image protocol, such as `kitty` or `ghostty`.

## Installation

```bash
npm install @gum-jsx/core @gum-jsx/node @gum-jsx/math @gum-jsx/mark
```

## Usage

A document like:

````markdown
# Sine wave

The function $\sin(x)$ looks like this:

```gum width=600 height=300
<Plot xlim={[0, 2*pi]} ylim={[-1.5, 1.5]} aspect={2}>
  <SymLine fy={sin} stroke={blue} />
</Plot>
```
````

Display it with `gum-mark` (shipped by the batteries-included `gum-jsx` package) (code block options `width=`, `height=`, and `theme=` override the global settings):

```bash
gum-mark notes.md -t light -H 100
gum-mark notes.md -p            # page through less
```

| Option | Description | Default |
|--------|-------------|---------|
| `file` | Markdown file to render | stdin |
| `-t, --theme <theme>` | Theme: `light` or `dark` | dark |
| `-H, --height <pixels>` | Max height for gum blocks and images; target height for display math | 500 (math: 75) |
| `-i, --inline-height <pixels>` | Target height for inline math (shown one row tall) | 48 |
| `-p, --pager` | Page through `less`, with images as kitty Unicode placeholders | off |

Math is sized by height alone, its width following from the equation's aspect ratio.

Or from JavaScript:

```javascript
import { displayMarkdown } from '@gum-jsx/mark'
process.stdout.write(displayMarkdown(markdown, { theme: 'light', width: 800 }))
```
