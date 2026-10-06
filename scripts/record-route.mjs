// Video evidence: runs a built Player with -e06Route (E06 animation route) or, with --mode e07, -e07Feedback (E07
// feedback route: hits, kills, strikes, the musou finale), one screenshot per 30 Hz frame plus the sound the Player
// mixed offline on the same clock, and encodes them with a local ffmpeg. Local only; no network, upload or publishing.
// Frames this script wrote are removed after encoding; the video, a contact sheet and a manifest stay under
// release/e02/<out>.
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
const mode = option('--mode', 'e06')
if (mode !== 'e06' && mode !== 'e07') throw new Error('--mode must be e06 or e07')
if (!player || !fs.existsSync(player)) throw new Error('--player must point to a built ChangshanLongdan.exe')
const allowed = path.join(root, 'release', 'e02')
const rel = path.relative(allowed, out)
if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('--out must be a new child directory of release/e02')
if (fs.existsSync(out)) throw new Error('Output directory already exists; preserve previous evidence')
const frames = path.join(out, 'frames')
fs.mkdirSync(frames, { recursive: true })

const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const started = new Date().toISOString()
const run = spawnSync(player, [mode === 'e07' ? '-e07Feedback' : '-e06Route', frames, '-screen-width', '1280', '-screen-height', '720', '-screen-fullscreen', '0',
  '-logFile', path.join(out, 'player.log')], { timeout: 240000, windowsHide: false })
const frameFiles = fs.readdirSync(frames).filter((f) => /^frame_\d{4}\.png$/.test(f)).sort()
const routeLogPath = path.join(frames, 'route.json')
if (run.error || run.status !== 0 || !fs.existsSync(routeLogPath)) {
  throw new Error(`ROUTE_PLAYER_FAILED: status=${run.status} error=${run.error?.message ?? ''} frames=${frameFiles.length}`)
}
// The Player's per-frame log proves the simulation ran the whole route without stalling (a paused frame would keep
// screenshots coming while the pose froze) and that the route reached every state it is meant to show.
const route = JSON.parse(fs.readFileSync(routeLogPath, 'utf8'))
const expected = Math.round(route.duration * route.frameRate)
if (route.pausedFrames !== 0 || route.frames.length !== expected || frameFiles.length !== expected) {
  throw new Error(`ROUTE_INCOMPLETE: paused=${route.pausedFrames} logged=${route.frames.length} frames=${frameFiles.length}/${expected}`)
}
// Game time advances every frame, except that the E07 route's hits hold it for their hit-stop (frames marked not
// stepped, never more than 0.25 s in a row).
let held = 0
for (let i = 1; i < route.frames.length; i++) {
  const f = route.frames[i]
  if (f.simTime > route.frames[i - 1].simTime) { held = 0; continue }
  if (mode === 'e07' && f.stepped === false && f.simTime === route.frames[i - 1].simTime && ++held <= 0.25 * route.frameRate) continue
  throw new Error(`ROUTE_STALLED: game time did not advance at frame ${i}`)
}
const states = [...new Set(route.frames.map((f) => f.state))]
const moves = [...new Set(route.frames.map((f) => f.move).filter(Boolean))]
const required = mode === 'e07' ? ['Move', 'Attack', 'Jump', 'Dodge', 'Guard', 'Musou', 'Hurt', 'Down'] : ['Move', 'Attack', 'Jump', 'Dodge', 'Guard', 'Musou']
for (const s of required) if (!states.includes(s)) throw new Error(`ROUTE_MISSING_STATE: ${s}`)
// E07: the common trace. Every frame that resolved hits issued its sparks and its hit sound on that same frame.
let feedback = null
if (mode === 'e07') {
  const cues = new Set(route.frames.flatMap((f) => f.cues ?? []))
  for (const c of ['audio.swing', 'audio.hit', 'sparks.burst', 'camera.addTrauma', 'audio.shatter', 'fragments.spawnSoldier', 'dust.puff', 'dust.ring',
    'waves.ring', 'waves.pillar', 'audio.land', 'audio.jump', 'audio.dodge', 'audio.enemySwing', 'audio.playerHurt', 'audio.musouReady', 'audio.musouStart',
    'audio.musouBlast']) if (!cues.has(c)) throw new Error(`ROUTE_MISSING_CUE: ${c}`)
  const hitFrames = route.frames.filter((f) => f.hits > 0)
  const unsynced = hitFrames.filter((f) => !(f.cues ?? []).includes('sparks.burst') || !(f.cues ?? []).includes('audio.hit')).map((f) => f.f)
  if (hitFrames.length === 0 || unsynced.length > 0) throw new Error(`ROUTE_FEEDBACK_UNSYNCED: hit frames ${hitFrames.length}, without sparks or sound ${unsynced.join(',')}`)
  const kills = route.frames.reduce((n, f) => n + f.kills, 0)
  if (kills === 0) throw new Error('ROUTE_NO_KILL')
  feedback = {
    hitFrames: hitFrames.length, hits: route.frames.reduce((n, f) => n + f.hits, 0), damage: route.frames.reduce((n, f) => n + f.damage, 0), kills,
    heldFrames: route.frames.filter((f) => f.stepped === false).length, cues: [...cues].sort(),
    hitFramesWithSparksAndSoundOnTheSameFrame: hitFrames.length,
  }
}
const audioPath = path.join(frames, 'audio.wav')
const hasAudio = fs.existsSync(audioPath)
if (hasAudio && route.audioSamples !== Math.round(route.audioRate / route.frameRate) * expected) {
  throw new Error(`ROUTE_AUDIO_LENGTH: ${route.audioSamples} samples for ${expected} frames at ${route.audioRate} Hz`)
}
if (mode === 'e07' && !hasAudio) throw new Error('ROUTE_NO_AUDIO: the Player had no audio output to mix')
if (hasAudio) fs.renameSync(audioPath, path.join(out, 'audio.wav'))
fs.renameSync(routeLogPath, path.join(out, 'route.json'))
const video = path.join(out, 'route.mp4')
const contact = path.join(out, 'contact.png')
const audioArgs = hasAudio ? ['-i', path.join(out, 'audio.wav'), '-c:a', 'aac', '-b:a', '192k'] : []
const encode = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-framerate', '30', '-i', path.join(frames, 'frame_%04d.png'),
  ...audioArgs, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', video], { timeout: 240000 })
if (encode.error || encode.status !== 0) throw new Error(`FFMPEG_FAILED: ${encode.error?.message ?? encode.stderr?.toString()}`)
const sheet = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', video, '-vf', 'select=not(mod(n\\,60)),scale=426:-1,tile=4x3',
  '-frames:v', '1', contact], { timeout: 120000 })
if (sheet.error || sheet.status !== 0) throw new Error(`FFMPEG_CONTACT_FAILED: ${sheet.error?.message ?? sheet.stderr?.toString()}`)
const manifest = {
  schema: mode === 'e07' ? 'e07-feedback-video/v1' : 'e06-route-video/v1', started, ended: new Date().toISOString(), player, playerSha256: sha256(player),
  frames: frameFiles.length, frameRate: route.frameRate, resolution: '1280x720',
  route: { file: 'route.json', sha256: sha256(path.join(out, 'route.json')), duration: route.duration, finalSimTime: route.frames[route.frames.length - 1].simTime, states, moves },
  video: { file: 'route.mp4', bytes: fs.statSync(video).size, sha256: sha256(video) },
  audio: hasAudio ? { file: 'audio.wav', sha256: sha256(path.join(out, 'audio.wav')), rate: route.audioRate, samples: route.audioSamples, clock: 'each frame\'s sounds start at that frame\'s first sample' } : null,
  feedback,
  contactSheet: { file: 'contact.png', sha256: sha256(contact), everySeconds: 2 },
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' })
for (const f of frameFiles) fs.unlinkSync(path.join(frames, f))
fs.rmdirSync(frames)
console.log(JSON.stringify(manifest))
