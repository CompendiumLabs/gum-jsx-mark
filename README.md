# @gum-jsx/mark

Markdown-to-terminal rendering for [gum.jsx](https://github.com/CompendiumLabs/gum.jsx). Renders Markdown to ANSI-styled text, with fenced `gum` code blocks, image links (`.png`, `.svg`, `.jsx`), and TeX math (`$...$` and `$$...$$`) displayed inline as kitty graphics. It needs a terminal that supports the kitty image protocol, such as `kitty` or `ghostty`.

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

Display it with `gum-down` (shipped by the batteries-included `gum-jsx` package) (code block options `width=`, `height=`, and `theme=` override the global settings):

```bash
gum-down notes.md -t light -w 800
```

| Option | Description | Default |
|--------|-------------|---------|
| `file` | Markdown file to render | stdin |
| `-t, --theme <theme>` | Theme: `light` or `dark` | dark |
| `-w, --width <pixels>` | Max width for gum blocks (and math) | 1000 (math: 750/600) |
| `-H, --height <pixels>` | Max height for gum blocks (and math) | 500 (math: 75/40) |

Or from JavaScript:

```javascript
import { displayMarkdown } from '@gum-jsx/mark'
process.stdout.write(displayMarkdown(markdown, { theme: 'light', width: 800 }))
```
