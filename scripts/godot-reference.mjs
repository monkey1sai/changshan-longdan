#!/usr/bin/env node
// Offline source oracle only. Nothing here imports or executes the Godot implementation.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { MOVES } from '../src/combat/moves.ts'
import { inHitShape, shapeReach } from '../src/combat/hitshape.ts'
import { DIFFICULTIES } from '../src/core/difficulty.ts'
import { createRng } from '../src/core/math.ts'
import { SpatialHash } from '../src/core/spatial-hash.ts'
import * as L from '../src/world/layout.ts'
import { castleSetup } from '../src/entities/castle-setup.ts'
import { Arena } from '../src/entities/arena.ts'
import { Player } from '../src/entities/player.ts'
import { EnemyStore, Kind } from '../src/entities/enemies.ts'
import { Battle, rank } from '../src/entities/battle.ts'
import { BattleDirector } from '../src/entities/battle-director.ts'
import { DragonStrike, DRAGON_HIT, DRAGON_DURATION, DRAGON_STRIKE_START, DRAGON_STRIKE_END, DRAGON_HIT_INTERVAL } from '../src/entities/dragon-strike.ts'
const root = fileURLToPath(new URL('../', import.meta.url))
const sourcePaths = ['src/combat/moves.ts','src/combat/combo.ts','src/combat/hitshape.ts','src/combat/stamp.ts','src/core/math.ts','src/core/spatial-hash.ts','src/core/difficulty.ts','src/core/input.ts','src/entities/arena.ts','src/entities/player.ts','src/entities/enemies.ts','src/entities/battle.ts','src/entities/battle-director.ts','src/entities/dragon-strike.ts','src/entities/castle-setup.ts','src/world/layout.ts','src/view/camera-rig.ts','src/game.ts','package-lock.json']
const STEP = 1 / 60
const idle = { moveX: 0, moveZ: 0, attack: false, charge: false, jump: false, dodge: false, musou: false, guard: false }
const vec = p => [p.x, p.y, p.z]
const plain = value => JSON.parse(JSON.stringify(value))
function playerSnapshot(p) {
  return { pos:vec(p.pos),vel:vec(p.vel),facing:p.facing,state:p.state,stateTime:p.stateTime,moveId:p.move?.id ?? null,moveTime:p.moveTime,normalCount:p.normalCount,
    hp:p.hp,musou:p.musou,invuln:p.invuln,speed:p.speed,runPhase:p.runPhase,dodgeBack:p.dodgeBack,guardTimer:p.guardTimer,parryTimer:p.parryTimer,counterReady:p.counterReady,
    events:plain(p.events),activeHits:p.activeHits.map(h => ({moveId:Object.values(MOVES).find(m=>m.hits.includes(h.window)).id,index:Object.values(MOVES).find(m=>m.hits.includes(h.window)).hits.indexOf(h.window),origin:[h.x,h.y,h.z],facing:h.facing})) }
}
function playerCases() {
  const definitions = [
    {id:'normal_chain',n:300,input:f=>({attack:f%6===0})},
    {id:'charge_branch',n:90,input:f=>({attack:[0,12,24].includes(f),charge:f===36})},
    {id:'charge_1',n:90,input:f=>({charge:f===0})},
    {id:'charge_2',n:90,input:f=>({attack:f===0,charge:f===12})},
    {id:'charge_3',n:120,input:f=>({attack:[0,12].includes(f),charge:f===24})},
    {id:'charge_5',n:150,input:f=>({attack:[0,12,24,36].includes(f),charge:f===56})},
    {id:'charge_6',n:150,input:f=>({attack:[0,12,24,36,56].includes(f),charge:f===78})},
    {id:'jump_attack',n:90,input:f=>({jump:f===0,attack:f===10})},
    {id:'jump_charge',n:90,input:f=>({jump:f===0,charge:f===10})},
    {id:'dodge_dash',n:60,input:f=>({dodge:f===0,attack:f===8,moveX:f<30?1:0})},
    {id:'parry_counter',n:50,input:f=>({guard:f<8,attack:f===1}),hits:[{frame:0,damage:80,heavy:true,x:0,z:2}]},
    {id:'block_chip',n:40,input:f=>({guard:f<25}),hits:[{frame:15,damage:80,heavy:false,x:0,z:2}]},
    {id:'back_hit',n:40,input:f=>({guard:f===0}),hits:[{frame:0,damage:60,heavy:false,x:0,z:-2}]},
    {id:'lethal_guard',n:30,initial:{hp:40},input:()=>({guard:true}),hits:[{frame:15,damage:100,heavy:true,x:0,z:2}]},
    {id:'musou',n:240,initial:{musou:100},input:f=>({musou:f===0})},
    {id:'move_jump',n:120,input:f=>({moveX:f<80?1:0,jump:f===10})},
    {id:'cleared_queue',n:20,preQueue:{attack:true},preClear:true,input:()=>({})},
    {id:'armor',n:90,input:f=>({attack:[0,12,24].includes(f),charge:f===36}),hits:[{frame:50,damage:100,heavy:false,x:0,z:2}]},
  ]
  return definitions.map(d=>{
    const p=new Player(); p.reset(0,0,0); Object.assign(p,d.initial ?? {})
    if(d.preQueue)p.queue({...idle,...d.preQueue}); if(d.preClear)p.clearQueuedActions()
    const result={id:d.id,frames:d.n,dt:STEP,initial:d.initial??{},preQueue:d.preQueue??null,preClear:d.preClear??false,inputs:[],hits:d.hits??[],samples:[],moves:[]}
    let previous=p.state
    for(let f=0;f<d.n;f++){
      const input=d.input(f)
      if(Object.values(input).some(v=>v!==0&&v!==false))result.inputs.push({frame:f,input})
      p.update(STEP,{...idle,...input},()=>null,new Arena(200,[]))
      for(const h of result.hits.filter(h=>h.frame===f))p.takeHit(h.damage,h.heavy,h.x,h.z)
      for(const e of p.events)if(e.type==='moveStart')result.moves.push(e.moveId)
      if(f%12===0||f===d.n-1||p.events.length||p.activeHits.length||previous!==p.state)result.samples.push({frame:f,expected:playerSnapshot(p)})
      previous=p.state
    }
    return result
  })
}
const enemyFields=['x','y','z','vx','vy','vz','yaw','hp','maxHp','stateTime','flash','phase','moveBlend','spin','spinVel','cooldown','ring','side','scale','state','kind','alive','engaged','token']
function enemySnapshot(e){return {count:e.count,aliveCount:e.aliveCount,attackerCount:e.attackerCount,fields:Object.fromEntries(enemyFields.map(k=>[k,Array.from(e[k]).slice(0,e.count)]))}}
function contracts(){
  const hash=new SpatialHash(2);hash.insert(0,1,0);hash.insert(1,-1,0)
  const e=new EnemyStore(2,7);e.reset([{x:1,z:0,yaw:0,kind:0},{x:-1,z:0,yaw:0,kind:0}])
  const spatialOrder={query:[...hash.query(0,0,3,[])],nearest:e.nearest(0,0,3)}
  const s=new EnemyStore(1,7);s.reset([{x:0,z:1,yaw:0,kind:2}])
  const w={...DRAGON_HIT,shape:{kind:'circle',range:4},damage:1,reaction:'flinch',push:0,lift:0,yMin:-1,yMax:5}
  const stampSequence={input:[1,1,2,1],window:w,hitCounts:[],hp:[]}
  for(const stamp of stampSequence.input){const out=[];s.applyHit(stamp,w,0,0,0,0,out);stampSequence.hitCounts.push(out.length);stampSequence.hp.push(s.hp[0])}
  const p=new Player();p.reset(0,0,0);p.musou=100;const d=new DragonStrike(),arena=new Arena(55,[])
  for(let f=0;f<28;f++){p.update(STEP,{...idle,musou:f===0},()=>null,arena);for(const ev of p.events)if(ev.type==='musouStart')d.start(p.pos,p.facing);d.update(STEP,p.pos,p.facing)}
  const targetSpawn={x:d.headPos.x*.65,z:d.headPos.z*.65,yaw:0,kind:Kind.Captain},t=new EnemyStore(1,7);t.reset([targetSpawn])
  const playerDragon={targetSpawn,hitCounts:[],hp:[]}
  const apply=(stamp,window,x,y,z,facing)=>{const out=[];t.applyHit(stamp,window,x,y,z,facing,out);playerDragon.hitCounts.push(out.length);playerDragon.hp.push(t.hp[0])}
  let a=p.activeHits[0];apply(a.stamp,a.window,a.x,a.y,a.z,a.facing);apply(d.stamp,DRAGON_HIT,d.headPos.x,d.headPos.y,d.headPos.z,0)
  p.update(STEP,idle,()=>null,arena);t.update(STEP,p.pos.x,p.pos.y,p.pos.z,arena);d.update(STEP,p.pos,p.facing);a=p.activeHits[0];apply(a.stamp,a.window,a.x,a.y,a.z,a.facing)
  const b=new Battle(castleSetup()),snapshot=stage=>({stage,difficulty:b.difficulty,alive:b.enemies.aliveCount,hp:[0,1,9,17].map(i=>b.enemies.hp[i]),phase:[0,1,9,17].map(i=>b.enemies.phase[i])})
  const lifecycle=[snapshot('constructor')];b.reset('hard');lifecycle.push(snapshot('first_start'));b.reset('hard');lifecycle.push(snapshot('retry'))
  return {spatialOrder,stampSequence,playerDragon,lifecycle}
}
function enemyCases(){
  return Object.keys(DIFFICULTIES).map(profile=>{
    const spawns=[{x:0,z:3,yaw:Math.PI,kind:0},{x:2,z:3,yaw:Math.PI,kind:1},{x:-2,z:3,yaw:Math.PI,kind:2}]
    const e=new EnemyStore(8,7);e.setPressure(DIFFICULTIES[profile]);e.reset(spawns)
    const result={profile,spawns,frames:180,dt:STEP,initial:enemySnapshot(e),samples:[]}
    for(let f=0;f<result.frames;f++){e.update(STEP,0,0,0,new Arena(20,[]));if(f%12===0||f===result.frames-1||e.strikes.length)result.samples.push({frame:f,expected:enemySnapshot(e),strikes:plain(e.strikes)})}
    return result
  })
}
function battleCases(){
  return Object.keys(DIFFICULTIES).map(profile=>{
    const spawns=[{x:0,z:2,yaw:Math.PI,kind:0},{x:1,z:3,yaw:Math.PI,kind:1}]
    const setup={limit:20,obstacles:[],spawns,playerStart:{x:0,z:0,facing:0},capacity:8,enemySeed:7}
    const b=new Battle({arena:new Arena(20,[]),spawns:()=>plain(spawns),playerStart:setup.playerStart,capacity:8,enemySeed:7});b.reset(profile)
    const result={profile,setup,frames:180,dt:STEP,inputs:[],samples:[]}
    for(let f=0;f<result.frames;f++){
      const input={attack:f%6===0,charge:f===36};if(Object.values(input).some(Boolean))result.inputs.push({frame:f,input})
      const advanced=b.step(STEP,{...idle,...input})
      if(f%12===0||f===result.frames-1||b.events.length)result.samples.push({frame:f,expected:{advanced,outcome:b.outcome,ko:b.ko,combo:b.combo,maxCombo:b.maxCombo,damageTaken:b.damageTaken,battleTime:b.battleTime,hitstop:b.hitstop,phase:b.phase,player:playerSnapshot(b.player),enemy:enemySnapshot(b.enemies),events:plain(b.events),hits:plain(b.hits),kills:plain(b.kills),result:b.result()}})
    }
    return result
  })
}
function mathCases(){
  const rng=createRng(7)
  const geometry=[
    {shape:{kind:'circle',range:2},x:2.4,z:0,radius:.5},
    {shape:{kind:'arc',range:3,halfAngle:Math.PI/4},x:1,z:2,radius:.42},
    {shape:{kind:'arc',range:3,halfAngle:.2},x:3,z:0,radius:.2},
    {shape:{kind:'line',range:3,width:1,offset:1},x:.7,z:2,radius:.25},
    {shape:{kind:'line',range:3,width:1},x:0,z:-.6,radius:.5},
  ].map(c=>({...c,expected:inHitShape(c.shape,0,0,0,c.x,c.z,c.radius),reach:shapeReach(c.shape)}))
  const arena=[{pos:{x:12,z:0},radius:.5,obstacles:[]},{pos:{x:0,z:0},radius:.5,obstacles:[{minX:-1,maxX:1,minZ:-1,maxZ:1}]},{pos:{x:1.2,z:1.2},radius:.5,obstacles:[{minX:-1,maxX:1,minZ:-1,maxZ:1}]}].map(c=>{const p={...c.pos};new Arena(10,c.obstacles).constrain(p,c.radius);return {...c,limit:10,expected:p}})
  return {rng:Array.from({length:12},()=>rng()),geometry,arena}
}
export function buildReference(){
  const sourceFiles=sourcePaths.map(p=>({path:p,sha256:createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')}))
  const setup=castleSetup(),director=new BattleDirector(),phases=[]
  for(let ko=0;ko<=300;ko++){const phase=director.update(ko,DIFFICULTIES.normal).phase;if(!phases.some(p=>p.id===phase.id))phases.push({...phase})}
  const runtime={schemaVersion:1,sourceFiles,moves:MOVES,difficulties:DIFFICULTIES,phases,capacity:setup.capacity,playerStart:setup.playerStart,spawns:setup.spawns(),
    layout:{limit:L.PLAY_LIMIT,inner:L.INNER,wallHeight:L.WALL_HEIGHT,wallThickness:L.WALL_THICK,gateHalf:L.GATE_HALF,keep:L.KEEP,stairs:L.STAIRS,barracks:L.BARRACKS,braziers:L.BRAZIERS,obstacles:L.obstacles()},
    dragon:{duration:DRAGON_DURATION,start:DRAGON_STRIKE_START,end:DRAGON_STRIKE_END,interval:DRAGON_HIT_INTERVAL,hit:DRAGON_HIT}}
  const d=new DragonStrike();d.start({x:0,y:0,z:0},0);const dragon=[]
  for(let i=0;i<37;i++){d.update(.1,{x:1,y:0,z:2},.3);dragon.push({dt:.1,active:d.active,striking:d.striking,elapsed:d.elapsed,headPos:vec(d.headPos)})}
  const ranks=[{win:true,ko:300,seconds:299,damage:399},{win:true,ko:300,seconds:300,damage:399},{win:true,ko:300,seconds:299,damage:400},{win:true,ko:300,seconds:480,damage:0},{win:false,ko:200,seconds:1,damage:0},{win:false,ko:100,seconds:1,damage:0},{win:false,ko:99,seconds:1,damage:0}].map(input=>({input,expected:rank(input)}))
  const cases={schemaVersion:1,sourceFiles,fixtureOnly:true,stepNumerator:1,stepDenominator:60,contracts:contracts(),math:mathCases(),player:playerCases(),enemy:enemyCases(),battle:battleCases(),dragon,rank:ranks}
  return {runtime,cases}
}
function main(){
  const args=process.argv.slice(2);let out=path.join(root,'godot/ChangshanLongdan'),mode=null
  for(let i=0;i<args.length;i++){if(args[i]==='--out'&&args[i+1])out=path.resolve(args[++i]);else if(['--write','--check'].includes(args[i])&&mode===null)mode=args[i];else throw new Error('INVALID_ARGUMENTS')}
  if(!mode)throw new Error('USE --write OR --check')
  const {runtime,cases}=buildReference()
  for(const [relative,value] of [['data/reference.json',runtime],['tests/reference_cases.json',cases]]){
    const filename=path.join(out,relative),content=JSON.stringify(value,null,2)+'\n'
    if(mode==='--write'){fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,content)}
    else if(!fs.existsSync(filename)||fs.readFileSync(filename,'utf8')!==content)throw new Error(`REFERENCE_STALE_OR_MISSING:${relative}`)
  }
  console.log(JSON.stringify({status:'PASS',mode,moves:17,spawns:runtime.spawns.length,profiles:Object.keys(runtime.difficulties).length,playerCases:cases.player.length}))
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main()}catch(error){console.error(error.message);process.exitCode=1}}
