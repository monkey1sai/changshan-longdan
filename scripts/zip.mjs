import { deflateRawSync } from 'node:zlib'

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

/** 標準 CRC-32（ZIP 使用的多項式 0xEDB88320）。 */
export function crc32(data) {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// 固定的 DOS 時間戳（2026-01-01 00:00），讓同樣的輸入產生完全相同的壓縮檔
const DOS_TIME = 0
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1
const UTF8_NAMES = 0x0800

/**
 * 以 deflate 建立 ZIP（不支援 ZIP64；單檔與總大小需小於 4 GB、檔案數少於 65,535）。
 * @param {readonly { name: string; data: Uint8Array }[]} entries 路徑以 / 分隔、不以 / 開頭
 * @returns {Buffer}
 */
export function createZip(entries) {
  if (entries.length > 0xffff) throw new Error('檔案數超過 ZIP 上限 65,535')
  const parts = []
  const central = []
  let offset = 0
  for (const { name, data } of entries) {
    if (name.startsWith('/') || name.includes('\\')) throw new Error(`不合法的路徑：${name}`)
    const nameBytes = Buffer.from(name, 'utf8')
    const deflated = deflateRawSync(data, { level: 9 })
    const stored = deflated.length >= data.length
    const body = stored ? Buffer.from(data) : deflated
    const method = stored ? 0 : 8
    const crc = crc32(data)
    if (data.length >= 0xffffffff || offset >= 0xffffffff) throw new Error('檔案太大，需要 ZIP64')

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(UTF8_NAMES, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(DOS_TIME, 10)
    local.writeUInt16LE(DOS_DATE, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    parts.push(local, nameBytes, body)

    const header = Buffer.alloc(46)
    header.writeUInt32LE(0x02014b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(20, 6)
    header.writeUInt16LE(UTF8_NAMES, 8)
    header.writeUInt16LE(method, 10)
    header.writeUInt16LE(DOS_TIME, 12)
    header.writeUInt16LE(DOS_DATE, 14)
    header.writeUInt32LE(crc, 16)
    header.writeUInt32LE(body.length, 20)
    header.writeUInt32LE(data.length, 24)
    header.writeUInt16LE(nameBytes.length, 28)
    header.writeUInt32LE(offset, 42)
    central.push(header, nameBytes)
    offset += local.length + nameBytes.length + body.length
  }
  const centralSize = central.reduce((sum, b) => sum + b.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, ...central, end])
}
