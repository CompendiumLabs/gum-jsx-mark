# `@gum-jsx/mark`

Markdown → terminal rendering for gum.jsx: `displayMarkdown` turns Markdown into ANSI-styled
text, showing fenced `gum` code blocks, `.png`/`.svg`/`.jsx` image links, and `$...$`/`$$...$$`
math inline as kitty-protocol images. It sits on top of the other packages — `@gum-jsx/core/eval`
for the gum blocks, `@gum-jsx/math` (`mathToElement`) for the math, `@gum-jsx/node` for
rasterizing, `formatImage` and `ansi` — all linked locally while unpublished (`bun link` in each
sibling, `link:` entries in `devDependencies`; the peers are marked optional so `bun install`
does not look on npm). A pure library: the `gum-down` CLI that wraps it lives in the
batteries-included `gum-jsx` package (`../gum-jsx/scripts/mark.ts`).

## Layout

- `src/index.ts` - `displayMarkdown(content, { width, height, theme })`: a `Marked` instance with the renderer and math extensions
- `src/mark.ts` - The marked `RendererObject` (ANSI text styling, fenced `gum` blocks rendered through `evaluateGum` → `rasterizeSvg` → `formatImage`, images read from disk) and the `TokenizerAndRendererExtension`s for `$...$` and `$$...$$`. Code block options `width=`, `height=`, `theme=` override the globals

## Commands

### Markdown CLI (`gum-down`)

`src/index.ts` (`displayMarkdown`) renders Markdown to ANSI terminal text with fenced `gum` blocks, `.png`/`.svg`/`.jsx` images, and `$...$`/`$$...$$` math shown as kitty images. The `gum-down` CLI in `gum-jsx` wraps it:

```bash
# Display a markdown file in a kitty-compatible terminal
gum-down README.md -t light -w 800
```

```bash
bun tsc --noEmit   # typecheck (follows the links into the siblings' sources)
```

There is no test suite of its own; check output by hand in a kitty terminal, e.g.
`printf 'Hello $x^2$\n' | gum-down`.
