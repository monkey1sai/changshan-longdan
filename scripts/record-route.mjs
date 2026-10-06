// E06 video evidence: runs a built Player with -e06Route (scripted route, one screenshot per 30 Hz frame) and encodes
// the frames with a local ffmpeg. Local only; no network, upload or publishing. Frames this script wrote are removed
// after encoding; the video, a contact sheet and a manifest stay under release/e02/<out>.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fs.realpathSync(fileURLToPath(new URL('../', import.meta.url)))
const args = process.argv.slice(2)
const option = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback
}
const player = option('--player')
const out = path.resolve(root, option('--out', ''))
const ffmpeg = option('--ffmpeg', 'ffmpeg')
if (!player || !fs.existsSync(player)) throw new Error('--player must point to a built ChangshanLongdan.exe')
const allowed = path.join(root, 'release', 'e02')
const rel = path.relative(allowed, out)
if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('--out must be a new child directory of release/e02')
if (fs.existsSync(out)) throw new Error('Output directory already exists; preserve previous evidence')
const frames = path.join(out, 'frames')
fs.mkdirSync(frames, { recursive: true })

const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const started = new Date().toISOString()
const run = spawnSync(player, ['-e06Route', frames, '-screen-width', '1280', '-screen-height', '720', '-screen-fullscreen', '0',
  '-logFile', path.join(out, 'player.log')], { timeout: 240000, windowsHide: false })
const frameFiles = fs.readdirSync(frames).filter((f) => /^frame_\d{4}\.png$/.test(f)).sort()
const expected = Math.round(23.5 * 30)
if (run.error || run.status !== 0 || frameFiles.length !== expected) {
  throw new Error(`ROUTE_PLAYER_FAILED: status=${run.status} error=${run.error?.message ?? ''} frames=${frameFiles.length}/${expected}`)
}
const video = path.join(out, 'route.mp4')
const contact = path.join(out, 'contact.png')
const encode = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-framerate', '30', '-i', path.join(frames, 'frame_%04d.png'),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', video], { timeout: 240000 })
if (encode.error || encode.status !== 0) throw new Error(`FFMPEG_FAILED: ${encode.error?.message ?? encode.stderr?.toString()}`)
const sheet = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', video, '-vf', 'select=not(mod(n\\,60)),scale=426:-1,tile=4x3',
  '-frames:v', '1', contact], { timeout: 120000 })
if (sheet.error || sheet.status !== 0) throw new Error(`FFMPEG_CONTACT_FAILED: ${sheet.error?.message ?? sheet.stderr?.toString()}`)
const manifest = {
  schema: 'e06-route-video/v1', started, ended: new Date().toISOString(), player, playerSha256: sha256(player),
  frames: frameFiles.length, frameRate: 30, resolution: '1280x720',
  video: { file: 'route.mp4', bytes: fs.statSync(video).size, sha256: sha256(video) },
  contactSheet: { file: 'contact.png', sha256: sha256(contact), everySeconds: 2 },
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' })
for (const f of frameFiles) fs.unlinkSync(path.join(frames, f))
fs.rmdirSync(frames)
console.log(JSON.stringify(manifest))
