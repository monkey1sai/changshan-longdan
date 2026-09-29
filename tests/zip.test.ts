import { describe, expect, it } from 'vitest'
import { crc32, createZip } from '../scripts/zip.mjs'

const text = (s: string) => new TextEncoder().encode(s)

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(data)]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

describe('zip', () => {
  it('CRC-32 與標準測試向量一致', () => {
    expect(crc32(text('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339)
    expect(crc32(new Uint8Array())).toBe(0)
  })

  it('目錄結構正確，且內容可以還原', async () => {
    const html = text('<!doctype html>'.repeat(40))
    const zip = createZip([
      { name: 'index.html', data: html },
      { name: 'assets/a.js', data: new Uint8Array([1, 2, 3]) },
    ])
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
    expect(view.getUint32(0, true)).toBe(0x04034b50)
    const end = zip.byteLength - 22
    expect(view.getUint32(end, true)).toBe(0x06054b50)
    expect(view.getUint16(end + 10, true)).toBe(2)
    expect(view.getUint32(view.getUint32(end + 16, true), true)).toBe(0x02014b50)

    // 第一個檔案以 deflate 壓縮，解壓後要和原始內容相同
    expect(view.getUint16(8, true)).toBe(8)
    const compressed = view.getUint32(18, true)
    const nameLength = view.getUint16(26, true)
    const body = zip.subarray(30 + nameLength, 30 + nameLength + compressed)
    expect(await inflateRaw(body)).toEqual(html)
  })

  it('同樣的輸入產生完全相同的壓縮檔', () => {
    const entries = [{ name: 'index.html', data: text('hello') }]
    expect(createZip(entries)).toEqual(createZip(entries))
  })

  it('拒絕絕對路徑', () => {
    expect(() => createZip([{ name: '/index.html', data: text('x') }])).toThrow()
  })
})
