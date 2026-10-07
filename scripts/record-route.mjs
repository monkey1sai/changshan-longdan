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
if (mode !== 'e06' && mode !== 'e07' && mode !== 'e09') throw new Error('--mode must be e06, e07 or e09')
// E09 records the camera route at three window sizes; the others keep the single 1280x720 recording.
const sizes = mode === 'e09' ? [[800, 600], [1440, 900], [1920, 1080]] : [[1280, 720]]
const sizeArg = option('--size', null)
const selectedSizes = sizeArg ? [sizeArg.split('x').map(Number)] : sizes
if (!player || !fs.existsSync(player)) throw new Error('--player must point to a built ChangshanLongdan.exe')
const allowed = path.join(root, 'release', 'e02')
const rel = path.relative(allowed, out)
if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('--out must be a new child directory of release/e02')
if (fs.existsSync(out)) throw new Error('Output directory already exists; preserve previous evidence')
const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const started = new Date().toISOString()
const recordings = []
for (const [width, height] of selectedSizes) recordings.push(record(width, height))
const manifest = {
  schema: mode === 'e09' ? 'e09-camera-video/v1' : mode === 'e07' ? 'e07-feedback-video/v1' : 'e06-route-video/v1', started, ended: new Date().toISOString(),
  player, playerSha256: sha256(player), mode, recordings,
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify(manifest))

// One recording at one window size: the Player writes frames, route.json and (with sound) audio.wav into dir/frames.
function record(width, height) {
const tag = selectedSizes.length > 1 || mode === 'e09' ? `${width}x${height}` : ''
const dir = tag ? path.join(out, tag) : out
const frames = path.join(dir, 'frames')
fs.mkdirSync(frames, { recursive: true })
const modeArgs = mode === 'e09' ? ['-e09Camera', frames] : mode === 'e07' ? ['-e07Feedback', frames, '-e09NoFlow'] : ['-e06Route', frames, '-e09NoFlow']
const run = spawnSync(player, [...modeArgs, '-screen-width', String(width), '-screen-height', String(height), '-screen-fullscreen', '0',
  '-logFile', path.join(dir, 'player.log')], { timeout: 300000, windowsHide: false })
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
  if ((mode === 'e07' || mode === 'e09') && f.stepped === false && f.simTime === route.frames[i - 1].simTime && ++held <= 0.25 * route.frameRate) continue
  throw new Error(`ROUTE_STALLED: game time did not advance at frame ${i}`)
}
const states = [...new Set(route.frames.map((f) => f.state))]
const moves = [...new Set(route.frames.map((f) => f.move).filter(Boolean))]
const required = mode === 'e09' ? ['Move', 'Jump', 'Attack', 'Musou', 'Down'] : mode === 'e07' ? ['Move', 'Attack', 'Jump', 'Dodge', 'Guard', 'Musou', 'Hurt', 'Down'] : ['Move', 'Attack', 'Jump', 'Dodge', 'Guard', 'Musou']
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
    hitFramesWithSparksAndHitSoundCueOnTheSameFrame: hitFrames.length,
  }
}
// E09: the camera never leaves the arena, the focus stays framed, the roof opens under the eave and closes after,
// clearance shortened the boom somewhere, the turn moved the camera, and the shake-off strike left no trauma.
let camera = null
if (mode === 'e09') {
  if (route.viewportWidth !== width || route.viewportHeight !== height) throw new Error(`ROUTE_VIEWPORT: ${route.viewportWidth}x${route.viewportHeight} for ${width}x${height}`)
  // E10: the route is only evidence for the asset scene when the delivered castle assets were on screen.
  if (route.castleAssets !== 'Ready') throw new Error(`ROUTE_CASTLE_ASSETS_NOT_READY: ${route.castleAssets}`)
  // The Web camera swoops in from the title orbit after "To Battle" (its title blend decays over about 3 s), so the
  // arena and framing checks start after that transition.
  const settled = 4 * route.frameRate
  const outside = route.frames.filter((f) => f.f >= settled && (Math.abs(f.camX) > 55.5 || Math.abs(f.camZ) > 55.5)).map((f) => f.f)
  if (outside.length) throw new Error(`ROUTE_CAMERA_OUTSIDE_ARENA: frames ${outside.slice(0, 5).join(',')}`)
  const unframed = route.frames.filter((f) => f.f >= settled && (f.focusU < 0.25 || f.focusU > 0.75 || f.focusV < 0.2 || f.focusV > 0.8)).map((f) => f.f)
  if (unframed.length > 2) throw new Error(`ROUTE_FOCUS_UNFRAMED: frames ${unframed.slice(0, 8).join(',')}`)
  const walk = route.frames.filter((f) => f.segment === 'barracks_walk')
  if (!walk.some((f) => f.roofs[1] === 0)) throw new Error('ROUTE_ROOF_NOT_CUT')
  if (walk[walk.length - 1].roofs.some((v) => v === 0)) throw new Error('ROUTE_ROOF_NOT_RESTORED')
  const shortened = route.frames.filter((f) => f.boomShort > 0.05).length
  if (shortened === 0) throw new Error('ROUTE_CLEARANCE_NEVER_ENGAGED')
  const blocked = route.frames.filter((f) => f.f >= settled && f.insideBlocker).map((f) => f.f)
  if (blocked.length) throw new Error(`ROUTE_CAMERA_IN_BLOCKER: frames ${blocked.slice(0, 5).join(',')}`)
  const open = route.frames.filter((f) => f.segment === 'open')
  const yawSpan = Math.max(...open.map((f) => f.yaw)) - Math.min(...open.map((f) => f.yaw))
  if (yawSpan < 1) throw new Error(`ROUTE_CAMERA_DID_NOT_TURN: ${yawSpan}`)
  const off = route.frames.filter((f) => f.segment === 'shake_off' && !f.shakeEnabled)
  const on = route.frames.filter((f) => f.segment === 'shake_off' && f.shakeEnabled)
  if (!on.some((f) => f.trauma > 0.3)) throw new Error('ROUTE_SHAKE_ON_NO_TRAUMA')
  if (off.some((f) => f.trauma > 0) || !off.some((f) => (f.cues ?? []).includes('audio.playerHurt'))) throw new Error('ROUTE_SHAKE_OFF_TRAUMA')
  camera = { viewport: [width, height], renderScale: route.renderScale, blockers: route.blockers, castleAssets: route.castleAssets, shortenedFrames: shortened, yawSpan, unframedFrames: unframed.length, roofCutFrames: walk.filter((f) => f.roofs[1] === 0).length }
}
const audioPath = path.join(frames, 'audio.wav')
const hasAudio = fs.existsSync(audioPath)
if (hasAudio && route.audioSamples !== Math.round(route.audioRate / route.frameRate) * expected) {
  throw new Error(`ROUTE_AUDIO_LENGTH: ${route.audioSamples} samples for ${expected} frames at ${route.audioRate} Hz`)
}
if (mode === 'e07' && !hasAudio) throw new Error('ROUTE_NO_AUDIO: the Player had no audio output to mix')
// The sound itself, not only the cues: every frame that queued a sound must be audible within 100 ms of it.
let audioCheck = null
if (hasAudio) {
  const wav = fs.readFileSync(audioPath)
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE' || wav.readUInt16LE(22) !== 2 || wav.readUInt16LE(34) !== 16)
    throw new Error('ROUTE_AUDIO_FORMAT: expected 16-bit stereo PCM')
  const data = wav.subarray(44)
  const frameSamples = Math.round(route.audioRate / route.frameRate)
  const rms = (from, count) => {
    let sum = 0, n = 0
    for (let i = from; i < Math.min(from + count, data.length / 4); i++, n += 2) {
      const l = data.readInt16LE(i * 4) / 32768, r = data.readInt16LE(i * 4 + 2) / 32768
      sum += l * l + r * r
    }
    return n ? Math.sqrt(sum / n) : 0
  }
  let peak = 0
  for (let i = 0; i < data.length / 2; i++) peak = Math.max(peak, Math.abs(data.readInt16LE(i * 2)) / 32768)
  const sounding = route.frames.filter((f) => (f.cues ?? []).some((c) => c.startsWith('audio.') && c !== 'audio.setMusicLevel'))
  const silent = sounding.filter((f) => rms(f.f * frameSamples, Math.round(route.audioRate * 0.1)) < 1e-3).map((f) => f.f)
  if (peak === 0 || sounding.length === 0 || silent.length > 0)
    throw new Error(`ROUTE_AUDIO_SILENT: peak ${peak}, frames with sound cues ${sounding.length}, silent after cue ${silent.join(',')}`)
  audioCheck = { peak, framesWithSoundCues: sounding.length, framesAudibleWithin100ms: sounding.length }
}
if (hasAudio) fs.renameSync(audioPath, path.join(dir, 'audio.wav'))
fs.renameSync(routeLogPath, path.join(dir, 'route.json'))
const video = path.join(dir, 'route.mp4')
const contact = path.join(dir, 'contact.png')
const audioArgs = hasAudio ? ['-i', path.join(dir, 'audio.wav'), '-c:a', 'aac', '-b:a', '192k'] : []
const encode = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-framerate', '30', '-i', path.join(frames, 'frame_%04d.png'),
  ...audioArgs, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', video], { timeout: 240000 })
if (encode.error || encode.status !== 0) throw new Error(`FFMPEG_FAILED: ${encode.error?.message ?? encode.stderr?.toString()}`)
const sheet = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', video, '-vf', 'select=not(mod(n\\,60)),scale=426:-1,tile=4x3',
  '-frames:v', '1', contact], { timeout: 120000 })
if (sheet.error || sheet.status !== 0) throw new Error(`FFMPEG_CONTACT_FAILED: ${sheet.error?.message ?? sheet.stderr?.toString()}`)
const recording = {
  size: tag || '1280x720',
  frames: frameFiles.length, frameRate: route.frameRate, resolution: `${width}x${height}`,
  route: { file: path.relative(out, path.join(dir, 'route.json')), sha256: sha256(path.join(dir, 'route.json')), duration: route.duration, finalSimTime: route.frames[route.frames.length - 1].simTime, states, moves },
  video: { file: path.relative(out, video), bytes: fs.statSync(video).size, sha256: sha256(video) },
  camera,
  audio: hasAudio ? { file: path.relative(out, path.join(dir, 'audio.wav')), sha256: sha256(path.join(dir, 'audio.wav')), rate: route.audioRate, samples: route.audioSamples, check: audioCheck, clock: 'each frame\'s sounds start at that frame\'s first sample' } : null,
  feedback,
  contactSheet: { file: path.relative(out, contact), sha256: sha256(contact), everySeconds: 2 },
}
for (const f of frameFiles) fs.unlinkSync(path.join(frames, f))
fs.rmdirSync(frames)
return recording
}
