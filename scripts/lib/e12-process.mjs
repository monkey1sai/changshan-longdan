import fs from 'node:fs'
import path from 'node:path'
import { requireSafePath, sha256 } from './unity-execution.mjs'

export function scopedE12Path(root, relative, prefix) {
  const target = requireSafePath(root, path.resolve(root, relative))
  const parent = path.resolve(root, prefix)
  const descendant = path.relative(parent, target)
  if (!descendant || path.isAbsolute(descendant) || descendant === '..' || descendant.startsWith(`..${path.sep}`)) throw new Error('INVALID_E12_PATH_SCOPE')
  return target
}
export function snapshotPayload(directory) {
  const result = {}
  const visit = target => {
    requireSafePath(directory, target)
    const stat = fs.lstatSync(target)
    if (stat.isDirectory()) for (const name of fs.readdirSync(target).sort()) visit(path.join(target, name))
    else if (stat.isFile()) result[path.relative(directory, target).replaceAll('\\', '/')] = { bytes: stat.size, sha256: sha256(target) }
    else throw new Error('UNSUPPORTED_PAYLOAD_ENTRY')
  }
  for (const name of fs.readdirSync(directory).sort()) visit(path.join(directory, name))
  if (!Object.keys(result).length) throw new Error('EMPTY_BUILD_PAYLOAD')
  return result
}
// Install listeners immediately after spawn; error resolves through the controlled evidence/cleanup path.
export function watchExit(child) {
  return new Promise(resolve => {
    child.once('error', error => resolve({ code: null, signal: null, error: error.code ?? error.message }))
    child.once('close', (code, signal) => resolve({ code, signal, error: null }))
  })
}
