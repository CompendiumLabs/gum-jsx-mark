import { expect, test } from 'bun:test'
import { displayMarkdown } from '../src'

function image(output: string): Buffer {
  const encoded = [...output.matchAll(/\x1b_G[^;]*;([^\x1b]*)\x1b\\/g)]
    .map(match => match[1]).join('')
  return Buffer.from(encoded, 'base64')
}

function pngSize(png: Buffer) {
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }
}

test('renders Markdown structure as styled terminal text', () => {
  const output = displayMarkdown('# Heading\n\nA **bold** [link](https://example.com).\n')
  expect(output).toContain('\x1b[1m\x1b[38;5;13m# Heading\x1b[0m')
  expect(output).toContain('\x1b[1m**bold**\x1b[0m')
  expect(output).toContain('https://example.com')
})

test('evaluates gum blocks with math and caller bindings in scope', () => {
  const output = displayMarkdown(`\`\`\`gum width=120 height=80
<HStack><Square fill={accent} /><Latex>x^2</Latex></HStack>
\`\`\``, { scope: { accent: 'tomato' } })
  expect(output).not.toContain('gum.jsx error')
  const size = pngSize(image(output))
  expect(size.width).toBeLessThanOrEqual(120)
  expect(size.height).toBeLessThanOrEqual(80)
})

test('renders inline and display math at their requested raster heights', () => {
  const inline = displayMarkdown('A $x^2$ B', { inlineHeight: 42 })
  expect(pngSize(image(inline)).height).toBe(42)
  expect(inline).toContain(',r=1,')

  const display = displayMarkdown('$$x^2$$\n', { height: 90 })
  expect(pngSize(image(display)).height).toBe(90)
})

test('pager mode transmits virtual images and returns Unicode placeholders', () => {
  const transmissions: string[] = []
  const output = displayMarkdown('Inline $x$ image', { virtual: {
    cell: { width: 10, height: 20 },
    columns: 80,
    transmit: escape => transmissions.push(escape),
  } })
  expect(transmissions).toHaveLength(1)
  expect(transmissions[0]).toContain('i=1,p=1,c=')
  expect(transmissions[0]).toContain(',r=1,U=1,')
  expect(output).toContain('\u{10EEEE}')
})
