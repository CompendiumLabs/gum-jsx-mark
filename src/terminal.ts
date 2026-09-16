import { execFileSync } from 'node:child_process'
import { closeSync, openSync, readSync, writeSync } from 'node:fs'
import type { Size } from '@gum-jsx/core'

type Color = keyof typeof ANSI_HI | number
type KittyOptions = Readonly<{
  imageId?: number
  placementId?: number
  chunkSize?: number
  columns?: number
  rows?: number
  cursorMovement?: boolean
  virtual?: boolean
}>

const ANSI_HI = { gray: 8, red: 9, green: 10, yellow: 11,
  blue: 12, magenta: 13, cyan: 14, white: 15 } as const

function ansi(text: string, { fg, bold = false, italic = false }:
  { fg?: Color; bold?: boolean; italic?: boolean } = {}): string {
  const code = typeof fg === 'string' ? ANSI_HI[fg] : fg
  const prefix = `${bold ? '\x1b[1m' : ''}${italic ? '\x1b[3m' : ''}`
    + `${code === undefined ? '' : `\x1b[38;5;${code}m`}`
  return `${prefix}${text}\x1b[0m`
}

function positiveInteger(value: number | undefined, name: string): void {
  if (value !== undefined && (!Number.isInteger(value) || value <= 0 || value > 0xffffffff)) {
    throw new RangeError(`Kitty ${name} must be a positive 32-bit integer`)
  }
}

function formatImage(png: Buffer | string, options: KittyOptions = {}): string {
  const { imageId, placementId, columns, rows, cursorMovement = true,
    virtual = false, chunkSize = 4096 } = options
  if (!Number.isInteger(chunkSize) || chunkSize < 4 || chunkSize > 4096 || chunkSize % 4 !== 0) {
    throw new RangeError('Kitty chunkSize must be a multiple of 4 between 4 and 4096')
  }
  positiveInteger(imageId, 'imageId')
  positiveInteger(placementId, 'placementId')
  positiveInteger(columns, 'columns')
  positiveInteger(rows, 'rows')

  const header = ['f=100', 'a=T', 'q=1']
  const fields = { i: imageId, p: placementId, c: columns, r: rows }
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) header.push(`${key}=${value}`)
  }
  if (!cursorMovement) header.push('C=1')
  if (virtual) header.push('U=1')

  const base64 = typeof png === 'string' ? png : png.toString('base64')
  const packets: string[] = []
  for (let offset = 0; offset < base64.length; offset += chunkSize) {
    const chunk = base64.slice(offset, offset + chunkSize)
    const more = offset + chunkSize < base64.length ? 1 : 0
    const control = offset === 0 ? [...header, `m=${more}`].join(',') : `m=${more}`
    packets.push(`\x1b_G${control};${chunk}\x1b\\`)
  }
  return packets.join('')
}

// Kitty Unicode placeholders encode the placement row and column with this
// protocol-defined diacritic table. Its 297 entries cap each placement axis.
const PLACEHOLDER = '\u{10EEEE}'
const ROWCOL_DIACRITICS = [
  0x0305, 0x030D, 0x030E, 0x0310, 0x0312, 0x033D, 0x033E, 0x033F, 0x0346, 0x034A, 0x034B, 0x034C,
  0x0350, 0x0351, 0x0352, 0x0357, 0x035B, 0x0363, 0x0364, 0x0365, 0x0366, 0x0367, 0x0368, 0x0369,
  0x036A, 0x036B, 0x036C, 0x036D, 0x036E, 0x036F, 0x0483, 0x0484, 0x0485, 0x0486, 0x0487, 0x0592,
  0x0593, 0x0594, 0x0595, 0x0597, 0x0598, 0x0599, 0x059C, 0x059D, 0x059E, 0x059F, 0x05A0, 0x05A1,
  0x05A8, 0x05A9, 0x05AB, 0x05AC, 0x05AF, 0x05C4, 0x0610, 0x0611, 0x0612, 0x0613, 0x0614, 0x0615,
  0x0616, 0x0617, 0x0657, 0x0658, 0x0659, 0x065A, 0x065B, 0x065D, 0x065E, 0x06D6, 0x06D7, 0x06D8,
  0x06D9, 0x06DA, 0x06DB, 0x06DC, 0x06DF, 0x06E0, 0x06E1, 0x06E2, 0x06E4, 0x06E7, 0x06E8, 0x06EB,
  0x06EC, 0x0730, 0x0732, 0x0733, 0x0735, 0x0736, 0x073A, 0x073D, 0x073F, 0x0740, 0x0741, 0x0743,
  0x0745, 0x0747, 0x0749, 0x074A, 0x07EB, 0x07EC, 0x07ED, 0x07EE, 0x07EF, 0x07F0, 0x07F1, 0x07F3,
  0x0816, 0x0817, 0x0818, 0x0819, 0x081B, 0x081C, 0x081D, 0x081E, 0x081F, 0x0820, 0x0821, 0x0822,
  0x0823, 0x0825, 0x0826, 0x0827, 0x0829, 0x082A, 0x082B, 0x082C, 0x082D, 0x0951, 0x0953, 0x0954,
  0x0F82, 0x0F83, 0x0F86, 0x0F87, 0x135D, 0x135E, 0x135F, 0x17DD, 0x193A, 0x1A17, 0x1A75, 0x1A76,
  0x1A77, 0x1A78, 0x1A79, 0x1A7A, 0x1A7B, 0x1A7C, 0x1B6B, 0x1B6D, 0x1B6E, 0x1B6F, 0x1B70, 0x1B71,
  0x1B72, 0x1B73, 0x1CD0, 0x1CD1, 0x1CD2, 0x1CDA, 0x1CDB, 0x1CE0, 0x1DC0, 0x1DC1, 0x1DC3, 0x1DC4,
  0x1DC5, 0x1DC6, 0x1DC7, 0x1DC8, 0x1DC9, 0x1DCB, 0x1DCC, 0x1DD1, 0x1DD2, 0x1DD3, 0x1DD4, 0x1DD5,
  0x1DD6, 0x1DD7, 0x1DD8, 0x1DD9, 0x1DDA, 0x1DDB, 0x1DDC, 0x1DDD, 0x1DDE, 0x1DDF, 0x1DE0, 0x1DE1,
  0x1DE2, 0x1DE3, 0x1DE4, 0x1DE5, 0x1DE6, 0x1DFE, 0x20D0, 0x20D1, 0x20D4, 0x20D5, 0x20D6, 0x20D7,
  0x20DB, 0x20DC, 0x20E1, 0x20E7, 0x20E9, 0x20F0, 0x2CEF, 0x2CF0, 0x2CF1, 0x2DE0, 0x2DE1, 0x2DE2,
  0x2DE3, 0x2DE4, 0x2DE5, 0x2DE6, 0x2DE7, 0x2DE8, 0x2DE9, 0x2DEA, 0x2DEB, 0x2DEC, 0x2DED, 0x2DEE,
  0x2DEF, 0x2DF0, 0x2DF1, 0x2DF2, 0x2DF3, 0x2DF4, 0x2DF5, 0x2DF6, 0x2DF7, 0x2DF8, 0x2DF9, 0x2DFA,
  0x2DFB, 0x2DFC, 0x2DFD, 0x2DFE, 0x2DFF, 0xA66F, 0xA67C, 0xA67D, 0xA6F0, 0xA6F1, 0xA8E0, 0xA8E1,
  0xA8E2, 0xA8E3, 0xA8E4, 0xA8E5, 0xA8E6, 0xA8E7, 0xA8E8, 0xA8E9, 0xA8EA, 0xA8EB, 0xA8EC, 0xA8ED,
  0xA8EE, 0xA8EF, 0xA8F0, 0xA8F1, 0xAAB0, 0xAAB2, 0xAAB3, 0xAAB7, 0xAAB8, 0xAABE, 0xAABF, 0xAAC1,
  0xFE20, 0xFE21, 0xFE22, 0xFE23, 0xFE24, 0xFE25, 0xFE26, 0x10A0F, 0x10A38, 0x1D185, 0x1D186,
  0x1D187, 0x1D188, 0x1D189, 0x1D1AA, 0x1D1AB, 0x1D1AC, 0x1D1AD, 0x1D242, 0x1D243, 0x1D244,
]

function placeholderColor(channel: 38 | 58, id: number): string {
  return `\x1b[${channel}:2:${(id >> 16) & 0xff}:${(id >> 8) & 0xff}:${id & 0xff}m`
}

function formatPlaceholder(imageId: number, rows: number, columns: number,
  placementId?: number): string {
  const color = placeholderColor(38, imageId)
    + (placementId === undefined ? '' : placeholderColor(58, placementId))
  const reset = '\x1b[39m' + (placementId === undefined ? '' : '\x1b[59m')
  const idMark = String.fromCodePoint(ROWCOL_DIACRITICS[(imageId >> 24) & 0xff]!)
  const lines: string[] = []
  for (let row = 0; row < Math.min(rows, ROWCOL_DIACRITICS.length); row++) {
    const rowMark = String.fromCodePoint(ROWCOL_DIACRITICS[row]!)
    let line = color
    for (let column = 0; column < Math.min(columns, ROWCOL_DIACRITICS.length); column++) {
      line += PLACEHOLDER + rowMark + String.fromCodePoint(ROWCOL_DIACRITICS[column]!) + idMark
    }
    lines.push(line + reset)
  }
  return lines.join('\n')
}

function pngSize(png: Buffer): Size {
  if (png.length < 24 || png.toString('ascii', 1, 4) !== 'PNG') {
    throw new TypeError('Invalid PNG data')
  }
  return Object.freeze({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) })
}

// Query the controlling terminal even when stdin or stdout is a pipe.
function queryCellSize(): Size | null {
  let descriptor: number
  try { descriptor = openSync('/dev/tty', 'r+') }
  catch { return null }
  try {
    const saved = execFileSync('stty', ['-g'], { stdio: [descriptor, 'pipe', 'ignore'] }).toString().trim()
    try {
      execFileSync('stty', ['raw', '-echo', 'min', '0', 'time', '5'],
        { stdio: [descriptor, 'ignore', 'ignore'] })
      writeSync(descriptor, '\x1b[16t')
      const buffer = Buffer.alloc(256)
      let response = ''
      let match: RegExpMatchArray | null = null
      while ((match = response.match(/\x1b\[6;(\d+);(\d+)t/)) === null) {
        const count = readSync(descriptor, buffer, 0, buffer.length, null)
        if (count === 0) break
        response += buffer.toString('utf8', 0, count)
      }
      return match ? Object.freeze({ width: Number(match[2]), height: Number(match[1]) }) : null
    } finally {
      execFileSync('stty', [saved], { stdio: [descriptor, 'ignore', 'ignore'] })
    }
  } catch {
    return null
  } finally {
    closeSync(descriptor)
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

export { ansi, formatImage, formatPlaceholder, pngSize, queryCellSize, readStdin }
export type { KittyOptions }
