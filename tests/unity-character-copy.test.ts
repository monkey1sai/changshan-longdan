/// <reference types="node" />
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The Unity runtime import (E03) ships its own copy of the Web GLB; both must stay the exact retained asset.
describe('Unity character copy', () => {
  it('is byte-identical to public/models/zhaoyun.glb and matches the manifest', () => {
    const web = readFileSync(new URL('../public/models/zhaoyun.glb', import.meta.url))
    const unity = readFileSync(new URL('../unity/ChangshanLongdan/Assets/StreamingAssets/Characters/zhaoyun.glb', import.meta.url))
    const manifest = JSON.parse(readFileSync(new URL('../public/models/zhaoyun.manifest.json', import.meta.url), 'utf8'))
    expect(unity.equals(web)).toBe(true)
    expect(createHash('sha256').update(unity).digest('hex')).toBe(manifest.export.sha256)
  })
})
