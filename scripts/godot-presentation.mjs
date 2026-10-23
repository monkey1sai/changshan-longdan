// Offline adaptation of the existing renderer. Never imported by the Godot runtime.
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { Vector3 } from 'three'
import { PlayerModel } from '../src/view/player-model.ts'
import { ZhaoYunAdapter, ZhaoYunSkin, ZHAOYUN_ASSET } from '../src/view/zhaoyun-adapter.ts'
import { MOVES } from '../src/combat/moves.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const project = path.join(root, 'godot/ChangshanLongdan')
const rate = 120
const hash = b => createHash('sha256').update(b).digest('hex')
const sources = ['public/models/zhaoyun.glb','public/models/zhaoyun.manifest.json','src/view/player-model.ts',
  'src/view/player-poses.ts','src/view/zhaoyun-adapter.ts','src/view/weapon-grip.ts','src/core/ik.ts',
  'src/core/math.ts','src/combat/moves.ts','src/audio/audio-engine.ts','src/audio/music.ts','src/presentation.ts',
  'src/world/voxel-builder.ts','scripts/godot-presentation.mjs']
const original = fs.readFileSync(path.join(root, 'public/models/zhaoyun.glb'))
if (hash(original) !== JSON.parse(fs.readFileSync(path.join(root, 'public/models/zhaoyun.manifest.json'))).export.sha256)
  throw new Error('ORIGINAL_ASSET_HASH_MISMATCH')

// Parse the *unchanged* source skeleton offline without a browser image decoder.
// Only the exporter uses this material-free, in-memory copy. Godot uses original bytes.
function offlineGlb(bytes) {
  const jsonLength = bytes.readUInt32LE(12)
  const data = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength).trim())
  delete data.images; delete data.textures; delete data.materials
  for (const mesh of data.meshes) for (const primitive of mesh.primitives) delete primitive.material
  const text = Buffer.from(JSON.stringify(data))
  const padded = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32); text.copy(padded)
  const bin = bytes.subarray(20 + jsonLength)
  const result = Buffer.alloc(20 + padded.length + bin.length)
  bytes.copy(result, 0, 0, 12); result.writeUInt32LE(result.length, 8)
  result.writeUInt32LE(padded.length, 12); result.writeUInt32LE(0x4e4f534a, 16)
  padded.copy(result, 20); bin.copy(result, 20 + padded.length)
  return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength)
}
const gltf = await new GLTFLoader().parseAsync(offlineGlb(original), '')
const oldLoad = ZhaoYunAdapter.prototype.load
ZhaoYunAdapter.prototype.load = async function () {} // browser loader only; restored in finally
const rounded = n => Number(n.toFixed(6))
function transform(object, height = 0) {
  return matrixValues(object.matrixWorld,height)
}
function matrixValues(matrix,height=0) {
  const e=matrix.elements
  return [e[0],e[1],e[2],e[4],e[5],e[6],e[8],e[9],e[10],e[12],e[13]-height,e[14]].map(rounded)
}
function makeModel() {
  const model = new PlayerModel()
  const scene = clone(gltf.scene)
  const skin = new ZhaoYunSkin(scene, model.character.drivers)
  model.group.add(scene); model.spear.add(skin.weapon); model.character.skin = skin
  skin.weapon.updateMatrix()
  weaponLocal = matrixValues(skin.weapon.matrix)
  return { model, scene, skin }
}
const tracks = {}, probes = []
let weaponLocal
function bake(name, state, duration, { move = null, speed = 0, air = false, back = false, loop = false } = {}) {
  const player = { state, move, speed, runPhase: 0, stateTime: 0, moveTime: 0, pos: new Vector3(0,air ? 0.5 : 0,0), facing: 0, dodgeBack: back }
  let frames = []
  const count = Math.ceil(duration * rate)
  // Dense source evaluation is monotonic (poseKey detects time reversal).
  // Extra body-only samples never advance the cape's fixed 120Hz history.
  const denseRate=rate*16
  let times=[...new Set([...Array.from({length:Math.ceil(duration*denseRate)+1},(_,f)=>Math.min(duration,f/denseRate)),
    ...(name.startsWith('MUSOU')?[.3,2.6,2.95,3.1,3.35].flatMap(t=>[t-.00001,t,t+.00001]):[])])].sort((a,b)=>a-b)
  // Preserve both sides of sharp source decompose branch jumps. Three finite
  // refinement passes localize these to <= 1.1 microseconds; no combat clock changes.
  for(let pass=0;pass<4;pass++) {
    const {model,scene,skin}=makeModel(), bones=ZHAOYUN_ASSET.bones.map(n=>scene.getObjectByName(n))
    player.stateTime=player.moveTime=player.runPhase=0
    model.resetCape();model.update(player,.2,0)
    let previous=0;frames=[]
    for(const t of times){
      player.stateTime=player.moveTime=t;player.runPhase=t*speed*1.25
      const regular=Math.abs(t*rate-Math.round(t*rate))<1e-7 || t===duration
      model.update(player,regular?t-previous:0,t);if(regular)previous=t
      const frame=[...bones.map(b=>transform(b,player.pos.y)),transform(skin.weapon,player.pos.y)]
      frames.push(frame)
      if(pass===0 && Math.abs(t-Math.floor(count*.4)/rate)<1e-8)probes.push({track:name,time:t,frame,
        tips:[model.tip.toArray(),model.tipBase.toArray()].map(v=>[v[0],v[1]-player.pos.y,v[2]]),diagnostics:model.animationStatus})
    }
    model.group.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose()}})
    if(pass===3)break
    const extras=[]
    for(let i=1;i<times.length;i++){
      if(times[i]-times[i-1]<=.0000011)continue
      let jump=0
      for(let bone=0;bone<21;bone++)if(bone!==17&&bone!==18)
        for(let c=0;c<9;c+=3)jump=Math.max(jump,Math.hypot(...[0,1,2].map(k=>frames[i][bone][c+k]-frames[i-1][bone][c+k])))
      if(jump>.2)for(let part=1;part<8;part++)extras.push(times[i-1]+(times[i]-times[i-1])*part/8)
    }
    if(!extras.length)break
    times=[...new Set([...times,...extras])].sort((a,b)=>a-b)
  }
  // Preserve all regular/branch knots, then retain extra samples where affine
  // interpolation cannot represent the original IK/decompose curvature.
  const mandatory=times.map((t,i)=>Math.abs(t*rate-Math.round(t*rate))<1e-7 || i===times.length-1 ||
    name.startsWith('MUSOU') && [.3,2.6,2.95,3.1,3.35].some(x=>Math.abs(t-x)<.000011) ? i : -1).filter(i=>i>=0)
  const keep=new Set(mandatory)
  function refine(a,b){
    let worst=1,index=-1
    for(let i=a+1;i<b;i++){
      const u=(times[i]-times[a])/(times[b]-times[a])
      for(let bone=0;bone<22;bone++){
        if(bone===17||bone===18) continue // cape history is separately bounded/loop-tested
        for(let c=0;c<12;c+=3){
          const error=Math.hypot(...[0,1,2].map(k=>frames[i][bone][c+k]-(frames[a][bone][c+k]*(1-u)+frames[b][bone][c+k]*u)))/(c===9?.002:.015)
          if(error>worst){worst=error;index=i}
        }
      }
    }
    if(index>=0){keep.add(index);refine(a,index);refine(index,b)}
  }
  for(let i=1;i<mandatory.length;i++) refine(mandatory[i-1],mandatory[i])
  const selected=[...keep].sort((a,b)=>a-b)
  tracks[name] = { kind: move ? 'move' : 'state', state, duration, speed, air, back, loop,
    times:selected.map(i=>times[i]),frames:selected.map(i=>frames[i]) }
}
function sourceProbe(name, time) {
  const track=tracks[name], {model,scene,skin}=makeModel()
  const p={state:track.state,move:track.kind==='move'?MOVES[name.replace(/_air$/,'')]:null,speed:track.speed,
    runPhase:0,stateTime:0,moveTime:0,pos:new Vector3(0,track.air?.5:0,0),facing:0,dodgeBack:track.back}
  model.resetCape(); model.update(p,.2,0)
  let previous=0
  for(let i=0;i<=Math.ceil(time*rate);i++){
    const at=Math.min(time,i/rate);p.stateTime=p.moveTime=at;p.runPhase=at*p.speed*1.25
    model.update(p,at===time && Math.abs(at*rate-Math.round(at*rate))>1e-7 ? 0 : at-previous,at);previous=at
  }
  probes.push({track:name,time,offGrid:true,frame:[...ZHAOYUN_ASSET.bones.map(n=>transform(scene.getObjectByName(n),p.pos.y)),transform(skin.weapon,p.pos.y)],
    tips:[model.tip.toArray(),model.tipBase.toArray()].map(v=>[v[0],v[1]-p.pos.y,v[2]]),diagnostics:model.animationStatus})
}
try {
  for (const [id, move] of Object.entries(MOVES)) {
    bake(id, id === 'MUSOU' ? 'musou' : 'attack', move.duration, { move })
    bake(id+'_air', id === 'MUSOU' ? 'musou' : 'attack', move.duration, { move, air: true })
  }
  bake('idle','move',2,{loop:true})
  // Five runPhase turns give thirteen foot-IK turns (source runPhaseScale = 2.6).
  for (const speed of [3.7,7.4]) bake(speed === 3.7 ? 'walk' : 'run','move',10*Math.PI/(speed*1.25),{speed,loop:true})
  for (const state of ['jump','guard','hurt','down','dead']) bake(state,state,state === 'down' ? 1.3 : 1.5,{air:state === 'jump',loop:['guard','dead'].includes(state)})
  bake('dodge','dodge',0.42)
  bake('dodge_back','dodge',0.42,{back:true})
  for(const [name,track] of Object.entries(tracks)) sourceProbe(name,Math.min(.113,track.duration*.4))
  for(const [name,track] of Object.entries(tracks)) if(track.kind==='move')
    for(const fraction of [.31739,.68317]) sourceProbe(name,track.duration*fraction)
  for(const time of [.2999,.3001,2.5999,2.6001,2.9499,2.9501,3.0999,3.1001]) sourceProbe('MUSOU',time)
  for(const name of ['C5','C5_air','DASH','DASH_air'])
    for(const time of [.11349,.11373,.11407,.11457]) sourceProbe(name,time)
} finally { ZhaoYunAdapter.prototype.load = oldLoad }

// Local PCM approximation of the original semantic sound palette and musical score.
// No WebAudio execution, external assets, synthesis service or combat RNG.
const sampleRate = 22050
let seed = 91837
const noise = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/2147483648-1 }
function wav(samples) {
  const bytes = Buffer.alloc(44+samples.length*2)
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length-8,4); bytes.write('WAVEfmt ',8)
  bytes.writeUInt32LE(16,16); bytes.writeUInt16LE(1,20); bytes.writeUInt16LE(1,22)
  bytes.writeUInt32LE(sampleRate,24); bytes.writeUInt32LE(sampleRate*2,28)
  bytes.writeUInt16LE(2,32); bytes.writeUInt16LE(16,34); bytes.write('data',36); bytes.writeUInt32LE(samples.length*2,40)
  for (let i=0;i<samples.length;i++) bytes.writeInt16LE(Math.round(Math.tanh(samples[i])*28000),44+i*2)
  return bytes
}
function tone(seconds,freq,decay=8,noisy=0,glide=0) {
  const out = new Float32Array(Math.ceil(seconds*sampleRate))
  for(let i=0;i<out.length;i++) { const t=i/sampleRate; const env=Math.min(1,t/0.003)*Math.exp(-decay*t)*Math.min(1,(seconds-t)/0.02)
    out[i]=(Math.sin(2*Math.PI*(freq*t+glide*t*t/2))*(1-noisy)+noise()*noisy)*env*0.65 }
  return out
}
const audio = {}
for (const [name,seconds,freq,decay,noisy,glide] of [
  ['swing',.18,440,16,.8,-1800],['hit',.18,190,20,.65,-500],['heavy',.38,95,12,.7,-100],
  ['parry',.35,1450,14,.15,400],['hurt',.35,120,12,.5,-180],['jump',.2,260,12,.25,900],
  ['land',.25,75,18,.7,0],['dodge',.22,330,15,.9,-500],['kill',.28,210,16,.9,-300],
  ['musou',1.4,65,2,.4,180],['ready',.7,880,5,.05,300],['victory',1.8,587.33,2,.04,0],['defeat',1.8,146.83,2,.08,-25]])
  audio[name]=wav(tone(seconds,freq,decay,noisy,glide))
const musicSource=fs.readFileSync(path.join(root,'src/audio/music.ts'),'utf8')
const roots=JSON.parse(musicSource.match(/const ROOTS = (\[[^\]]+\])/)[1])
const melody=JSON.parse(musicSource.match(/const MELODY:[^=]+=(\s*\[[\s\S]*?\n\])/)[1].replace(/,\s*([\]])/g,'$1'))
const tempo=Number(musicSource.match(/const TEMPO = (\d+)/)[1]), step=60/tempo/4
const frequency=midi=>440*2**((midi-69)/12)
function score(mode) {
  const out=new Float32Array(Math.ceil(step*128*sampleRate))
  function add(at,len,freq,gain,kind='tone') {
    const start=Math.round(at*sampleRate),size=Math.ceil(len*sampleRate)
    for(let i=0;i<size && start+i<out.length;i++){ const t=i/sampleRate,u=i/size
      const env=Math.min(1,t/.01)*(1-u)**1.5
      const wave=kind==='drum' ? Math.sin(2*Math.PI*(freq*t+25*(1-Math.exp(-20*t))))+noise()*.18 :
        Math.sin(2*Math.PI*freq*t)+.2*Math.sin(4*Math.PI*freq*t)
      out[start+i]+=wave*env*gain }
  }
  for(let bar=0;bar<8;bar++) {
    const base=bar*16*step, rootNote=roots[bar]
    for(let s=0;s<16;s++){
      if(mode==='title') { if(s%2===0) add(base+s*step,step*1.8,frequency(rootNote+12+[0,7,12,15,19,15,12,7][s/2]),.12) }
      else {
        if([0,6,8,11].includes(s)) add(base+s*step,.25,60,.25,'drum')
        if(s===4||s===12) add(base+s*step,.12,180,.1,'drum')
        if(s%2===0) add(base+s*step,step*1.3,frequency(rootNote+[0,0,12,0,0,7,12,0][s/2]),.11)
      }
    }
    if(mode==='title') { add(base,step*16,frequency(rootNote),.06); if(bar%2===0) add(base,.5,60,.15,'drum') }
    else { let beat=0; for(const [length,note] of melody[bar]) { if(note!==null) add(base+beat*step*4,length*step*4,frequency(note+12),.09); beat+=length } }
  }
  // Click-free loop boundary; no audio clock controls the simulation.
  for(let i=0;i<sampleRate*.02;i++){out[i]*=i/(sampleRate*.02);out[out.length-1-i]*=i/(sampleRate*.02)}
  return wav(out)
}
audio.title=score('title'); audio.battle=score('battle')
const manifest={schemaVersion:1,sampleRate:rate,bodyEvaluationRate:rate*16,adaptiveBasisTolerance:.015,adaptivePositionTolerance:.002,
  rootMotion:false,space:'character-local +Y up +Z forward; global bone poses, full affine 3x3 basis + origin',
  provenance:'Original PlayerModel/ZhaoYunSkin procedural bake, not authored clips; interpolation and state/locomotion blending are presentation approximations.',
  bones:[...ZHAOYUN_ASSET.bones],weaponLocal,
  inverseBinds:Object.fromEntries(gltf.scene.getObjectByName('SM_ZhaoYun').skeleton.bones.map((b,i)=>[b.name,matrixValues(gltf.scene.getObjectByName('SM_ZhaoYun').skeleton.boneInverses[i])])),
  sources:Object.fromEntries(sources.map(p=>[p,hash(fs.readFileSync(path.join(root,p)))])),
  audio:{sampleRate,channels:1,bits:16,tempo,approximation:true,files:Object.fromEntries(Object.entries(audio).map(([name,bytes])=>[name,{bytes:bytes.length,sha256:hash(bytes)}]))},tracks}
const outputs = new Map([['assets/zhaoyun.glb',original],['data/presentation.json',Buffer.from(JSON.stringify(manifest)+'\n')],
  ['tests/presentation_probes.json',Buffer.from(JSON.stringify({schemaVersion:1,probes})+'\n')],
  ...Object.entries(audio).map(([name,bytes])=>[`assets/audio/${name}.wav`,bytes])])
const mode=process.argv[2]
if(!['--write','--check'].includes(mode)||process.argv.length!==3) throw new Error('USE --write OR --check')
for(const [relative,bytes] of outputs){const target=path.join(project,relative)
  if(mode==='--write'){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes)}
  else if(!fs.existsSync(target)||!fs.readFileSync(target).equals(bytes)) throw new Error(`PRESENTATION_STALE: ${relative}`)
}
console.log(JSON.stringify({status:'PASS',mode,tracks:Object.keys(tracks).length,bones:manifest.bones.length,outputs:outputs.size}))
