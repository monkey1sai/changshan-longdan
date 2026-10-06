// Writes or checks the Web-to-Unity combat parity fixtures. Local only; no browser, network or publishing actions.
import { readFileSync, writeFileSync } from 'node:fs'
import { buildParityFixture } from './lib/combat-parity.ts'
import { buildHitFixture } from './lib/hit-parity.ts'
import { buildReactionFixture } from './lib/reaction-parity.ts'
import { buildRigFixture } from './lib/rig-parity.ts'

const root = new URL('../', import.meta.url)
const fixtures = [
  ['web-parity.json', buildParityFixture],
  ['web-hits.json', buildHitFixture],
  ['web-rig.json', buildRigFixture],
  ['web-reactions.json', buildReactionFixture],
]
const mode = process.argv[2]
if (mode !== '--write' && mode !== '--check') throw new Error('Usage: combat-parity.mjs --write | --check')

let stale = 0
for (const [name, build] of fixtures) {
  const file = new URL(`unity/ChangshanLongdan/TestData/combat/${name}`, root)
  const text = `${JSON.stringify(await build(root))}\n`
  if (mode === '--write') {
    writeFileSync(file, text)
    console.log(`wrote ${name} (${text.length} bytes)`)
  } else if (readFileSync(file, 'utf8') !== text) {
    console.error(`${name} is stale; run npm run parity:write`)
    stale++
  } else console.log(`${name} matches the Web source`)
}
if (stale) process.exit(1)
