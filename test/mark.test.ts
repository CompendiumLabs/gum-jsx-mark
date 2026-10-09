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

test('Markdown gum blocks retain named positions and projected samples', () => {
  const source = `\`\`\`gum width=120 height=80
    const position = {theta: 0, r: 1}
    return <Graph xlim={[-2, 2]} ylim={[-2, 2]} projection={({theta, r}) => ({x: r * cos(theta), y: r * sin(theta)})}>
      <Rect {...{pos: position}} width={px(4)} height={px(6)} />
      <SymLine f={theta => ({theta, r: 1})} tvals={[0, 1]} />
    </Graph>
\`\`\``
  const cartesian = source.replace('const position = {theta: 0, r: 1}', 'const position = [1, 0]')
    .replace(' projection={({theta, r}) => ({x: r * cos(theta), y: r * sin(theta)})}', '')
    .replace('theta => ({theta, r: 1})', 'theta => [cos(theta), sin(theta)]')
  const output = displayMarkdown(source)
  expect(output).not.toContain('Gum error')
  expect(image(output)).toEqual(image(displayMarkdown(cartesian)))
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

test.each([undefined, { width: 7, height: 20 }, { width: 20, height: 40 }])(
  'keeps tall inline math on the text row with cell size %j', cell => {
    const output = displayMarkdown('Before $\\dfrac{1}{2}$ after', { cell, inlineFontSize: 48 })
    const size = pngSize(image(output))
    expect(size.height).toBeGreaterThan(cell?.height ?? 20)
    expect(output).toContain(',C=1,')
    expect(output).not.toMatch(/,[rc]=/)

    // The only movement after the image is horizontal, rounded up to full cells.
    const columns = Math.ceil(size.width / (cell?.width ?? 10))
    const text = output.replace(/\x1b_G[^;]*;[^\x1b]*\x1b\\/g, '')
    expect(text).toBe(`Before \x1b[${columns}C after\n\n`)
  },
)

test.each(['$', '$$'])('keeps %s math at a consistent scale as its extent grows', delimiter => {
  const options = { fontSize: 42, inlineFontSize: 42 }
  const render = (tex: string) => displayMarkdown(`${delimiter}${tex}${delimiter}`, options)
  const simple = pngSize(image(render('x')))
  const tall = pngSize(image(render('x\\vphantom{\\dfrac{1}{2}}')))
  // Invisible vertical space must not shrink the visible x.
  expect(tall.width).toBe(simple.width)
  expect(tall.height).toBeGreaterThan(simple.height)
  for (const tex of ['x^2', '\\frac{1}{2}', '\\int_0^1 x']) {
    expect(pngSize(image(render(tex))).height).toBeGreaterThan(simple.height)
  }

  const large = displayMarkdown(`${delimiter}x${delimiter}`, { fontSize: 84, inlineFontSize: 84 })
  expect(pngSize(image(large)).height).toBe(simple.height * 2)
  expect(Math.abs(pngSize(image(large)).width - simple.width * 2)).toBeLessThanOrEqual(1)
})

test.each(['$$x^2$$', '$$\nx^2\n$$'])(
  'separates display math %j from following text', source => {
    const virtual = { cell: { width: 10, height: 20 }, transmit: () => {} }
    for (const options of [{}, { virtual }]) {
      for (const separator of ['\n', '\n\n']) {
        const output = displayMarkdown(`Before\n\n${source}${separator}After`, options)
        expect(output).toStartWith('Before\n\n')
        expect(output).toEndWith('\n\nAfter\n\n')
      }
    }
  },
)

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

test.each(['$', '$$'])('preserves %s math scale in pager cells', delimiter => {
  const transmissions: string[] = []
  const cell = { width: 10, height: 20 }
  const options = { fontSize: 42, inlineFontSize: 42, virtual: {
    cell, columns: 80, transmit: (escape: string) => transmissions.push(escape),
  } }
  displayMarkdown(`${delimiter}x${delimiter}`, options)
  displayMarkdown(`${delimiter}x\\vphantom{\\dfrac{1}{2}}${delimiter}`, options)
  const images = transmissions.filter(escape => !escape.includes(',c=1,r=1,U=1,'))
  const simple = pngSize(image(images[0]))
  const tall = pngSize(image(images[1]))
  expect(tall.width).toBe(simple.width)
  expect(tall.height).toBeGreaterThan(simple.height)

  // Whole-cell padding makes the placement size equal the raster size.
  for (const transmission of images) {
    const size = pngSize(image(transmission))
    expect(size.width % cell.width).toBe(0)
    expect(size.height % cell.height).toBe(0)
    expect(transmission).toContain(`,c=${size.width / cell.width},r=${size.height / cell.height},`)
  }
})

test.each([80, 2])('pager keeps tall inline math on one text row at width %i', columns => {
  const transmissions: string[] = []
  const cell = { width: 10, height: 20 }
  const virtual = { cell, columns, nextId: 40, transmit: (escape: string) => transmissions.push(escape) }
  const output = displayMarkdown('Before $\\dfrac{1}{2}$ after $x\\vphantom{\\dfrac{1}{2}}$ end', {
    inlineFontSize: 48, virtual,
  })
  expect(transmissions).toHaveLength(4)
  expect(virtual.nextId).toBe(44)

  // Invisible one-cell parents track the paragraph; full images retain their height.
  const widths: number[] = []
  for (const index of [0, 2]) {
    const anchor = transmissions[index], child = transmissions[index + 1]
    expect(pngSize(image(anchor))).toEqual({ width: 1, height: 1 })
    expect(anchor).toContain(`i=${41 + index},p=1,c=1,r=1,U=1,`)
    expect(child).toContain(`,P=${41 + index},Q=1,`)
    expect(child).not.toContain(',U=1,')
    const width = Number(child.match(/,c=(\d+)/)![1])
    const rows = Number(child.match(/,r=(\d+)/)![1])
    expect(rows).toBeGreaterThan(1)
    expect(width).toBeLessThanOrEqual(columns)
    widths.push(width)
  }

  const text = output.replace(/\x1b\[[\d;:]*m/g, '').replace(/\p{M}/gu, '')
  expect(text).toBe(`Before \u{10EEEE}${' '.repeat(widths[0] - 1)} after \u{10EEEE}${' '.repeat(widths[1] - 1)} end\n\n`)
  expect(output).not.toContain('\x1b_G')

  // Display math still consumes rows and gets a distinct image id.
  const display = displayMarkdown('$$\\dfrac{1}{2}$$\nAfter', { fontSize: 48, virtual })
  expect(transmissions).toHaveLength(5)
  expect(transmissions[4]).toContain('i=45,p=1,c=')
  expect(transmissions[4]).toContain(',U=1,')
  expect(transmissions[4]).not.toContain(',P=')
  expect(display.split('\n').length).toBeGreaterThan(4)
  expect(display).toEndWith('\n\nAfter\n\n')
})
