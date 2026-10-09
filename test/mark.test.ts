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

test('external SVG images explain unsupported inputs', () => {
  expect(displayMarkdown('![diagram](figure.svg)')).toContain('SVG images are unsupported; use PNG or JSX')
})

test('emoji figures render successfully with live emoji skipped', () => {
  const output = displayMarkdown('```gum\n<Text>Hello 😀</Text>\n```')
  expect(output).not.toContain('Gum error')
  expect(pngSize(image(output)).width).toBeGreaterThan(0)
})

test('evaluates gum blocks with math and caller bindings in scope', () => {
  const output = displayMarkdown(`\`\`\`gum width=120 height=80
<HStack><Square fill={accent} /><Latex>x^2</Latex></HStack>
\`\`\``, { scope: { accent: 'tomato' } })
  expect(output).not.toContain('Gum error')
  const size = pngSize(image(output))
  expect(size.width).toBeLessThanOrEqual(120)
  expect(size.height).toBeLessThanOrEqual(80)
})

test('renders inline and display math at their requested font sizes', () => {
  const options = { fontSize: 64, inlineFontSize: 42 }
  const inline = displayMarkdown('A $x$ B', options)
  expect(pngSize(image(inline)).height).toBe(42)
  expect(inline).not.toContain(',r=')
  expect(inline).toEndWith('\x1b\\\x1b[3C B\n\n')

  const display = displayMarkdown('$$x$$\n', options)
  expect(pngSize(image(display)).height).toBe(64)
  expect(display).not.toContain(',C=1,')
})

test.each([
  [String.raw`x^2\tag{1.16}`, 'x^2'],
  [String.raw`x^2\tag*{A}`, 'x^2'],
  [String.raw`\begin{align}a&=b\tag{1.16}\\c&=d\tag{1.17}\end{align}`,
    String.raw`\begin{align}a&=b\\c&=d\end{align}`],
])('renders %s and its labels together in direct and pager output', (tex, plain) => {
  for (const pager of [false, true]) {
    const transmissions: string[] = []
    const options = { fontSize: 32, virtual: pager ? {
      cell: { width: 10, height: 20 }, transmit: (escape: string) => transmissions.push(escape),
    } : undefined }
    const output = displayMarkdown(`$$\n${tex}\n$$\nAfter`, options)
    const bare = displayMarkdown(`$$\n${plain}\n$$`, options)
    const tagged = pngSize(image(pager ? transmissions[0] : output))
    const untagged = pngSize(image(pager ? transmissions[1] : bare))
    expect(tagged.width).toBeGreaterThan(untagged.width)
    expect(output).toEndWith('\n\nAfter\n\n')
    if (pager) expect(transmissions).toHaveLength(2)
    else expect(output.match(/\x1b_Gf=100/g)).toHaveLength(1)
  }
})

test('pager mode transmits virtual images and returns Unicode placeholders', () => {
  const transmissions: string[] = []
  const output = displayMarkdown('Inline $x$ image', { inlineFontSize: 20, virtual: {
    cell: { width: 10, height: 20 },
    columns: 80,
    transmit: escape => transmissions.push(escape),
  } })
  expect(transmissions).toHaveLength(1)
  expect(transmissions[0]).toContain('i=1,p=1,c=')
  expect(transmissions[0]).toContain(',r=1,U=1,')
  expect(output).toContain('\u{10EEEE}')
})
