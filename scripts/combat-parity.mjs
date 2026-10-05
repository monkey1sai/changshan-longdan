// Writes or checks the Web-to-Unity combat parity fixture. Local only; no browser, network or publishing actions.
import { readFileSync, writeFileSync } from 'node:fs'
import { buildParityFixture } from './lib/combat-parity.ts'

const root = new URL('../', import.meta.url)
const fixture = new URL('unity/ChangshanLongdan/TestData/combat/web-parity.json', root)
const mode = process.argv[2]
if (mode !== '--write' && mode !== '--check') throw new Error('Usage: combat-parity.mjs --write | --check')

const text = `${JSON.stringify(buildParityFixture(root))}\n`
if (mode === '--write') {
  writeFileSync(fixture, text)
  console.log(`wrote ${fixture.pathname} (${text.length} bytes)`)
} else if (readFileSync(fixture, 'utf8') !== text) {
  console.error('web-parity.json is stale; run npm run parity:write')
  process.exit(1)
} else console.log('web-parity.json matches the Web source')
