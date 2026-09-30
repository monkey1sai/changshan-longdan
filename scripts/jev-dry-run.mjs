import { routingFixtures } from '../src/testing/routing-fixtures.ts'

// No network or credential lookup. Expected labels remain outside provider input.
const fixtures = routingFixtures().map(f => ({
  ...f, requestBytes: Buffer.byteLength(JSON.stringify(f.request)),
}))
console.log(JSON.stringify({
  status: 'DRY_RUN', modelCalls: 0, accuracy: null, inputTokens: null, outputTokens: null,
  note: 'Fixture preparation only. Bytes are not tokens; no model result or cost comparison.',
  fixtures,
}, null, 2))
