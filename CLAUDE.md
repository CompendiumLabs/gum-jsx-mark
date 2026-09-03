# `@gum-jsx/mark`

Markdown → terminal rendering for gum.jsx: `displayMarkdown` turns Markdown into ANSI-styled
text, showing fenced `gum` code blocks, `.png`/`.svg`/`.jsx` image links, and `$...$`/`$$...$$`
math inline as kitty-protocol images. It sits on top of the other packages — a core `Env`
(`env.evaluate`; the default Env unless the `env` option names another, and it must have the math
plugin for `<Latex>` in gum blocks) for the gum blocks, `@gum-jsx/math` (`mathToElement`) for the
math, `@gum-jsx/node` for rasterizing, `formatImage` and `ansi` — all three peer dependencies
(`^1.9.0`, versioned in lockstep; peers so the host has a single core and default Env), duplicated
in `devDependencies` for typechecking; in the `gum-org` bun workspace they resolve to the sibling
checkouts. A pure
library: the `gum-mark` CLI that wraps it lives in the batteries-included `gum-jsx` package
(`../gum-jsx/scripts/mark.ts`).

## Layout

- `src/index.ts` - `displayMarkdown(content, { width, height, theme, env })`: a `Marked` instance with the renderer and math extensions
- `src/mark.ts` - The marked `RendererObject` (ANSI text styling, fenced `gum` blocks rendered through `env.evaluate` → `rasterizeSvg` → `formatImage`, images read from disk) and the `TokenizerAndRendererExtension`s for `$...$` and `$$...$$`. Code block options `width=`, `height=`, `theme=` override the globals

## Commands

### Markdown CLI (`gum-mark`)

`src/index.ts` (`displayMarkdown`) renders Markdown to ANSI terminal text with fenced `gum` blocks, `.png`/`.svg`/`.jsx` images, and `$...$`/`$$...$$` math shown as kitty images. The `gum-mark` CLI in `gum-jsx` wraps it:

```bash
# Display a markdown file in a kitty-compatible terminal
gum-mark README.md -t light -H 100
```

```bash
bun tsc --noEmit   # typecheck (follows the workspace symlinks into the siblings' sources)
```

There is no test suite of its own; check output by hand in a kitty terminal, e.g.
`printf 'Hello $x^2$\n' | gum-mark`.
