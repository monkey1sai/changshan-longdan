import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash, randomUUID } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { scopedE12Path, snapshotPayload, comparePayload } from './lib/e12-process.mjs'
import { snapshotSource } from './lib/unity-execution.mjs'
import { clockWindowVerdict, fingerprintContents, validateClockReady, extendClockTimeline } from './lib/e12-clock-contract.mjs'

const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const baselineHash = '221ea4df218d26dddb574d9e40b7a29419463ae2c8ee9f1c47c21ac4e8009213'
export function timeoutWithin(deadline, maximum, reserve = 0, now = process.hrtime.bigint()) {
  const available = Number((deadline - now) / 1000000n) - reserve
  if (!Number.isSafeInteger(maximum) || maximum <= 0 || available <= 0) throw new Error('CLOCK_RUN_DEADLINE_OR_RESERVE')
  return Math.min(maximum, available)
}
export function nextClockWindow(completed, failed = false) {
  if (failed || !Number.isInteger(completed) || completed < 0 || completed >= 3) throw new Error('NO_FOURTH_WINDOW_OR_RETRY')
  return completed + 1
}
export function stopOwned(child, owned) {
  if (!owned.has(child)) throw new Error('NOT_OWNED_PROCESS')
  if (child.exitCode === null && child.signalCode === null) child.kill()
}
export async function confirmOwnedExit(child, owned, completion, maximumMs) {
  stopOwned(child,owned)
  if (!Number.isInteger(maximumMs) || maximumMs < 1 || maximumMs > 5000) throw new Error('CLEANUP_BOUND_REQUIRED')
  let timer
  const ended = await Promise.race([completion,new Promise(resolve=>{timer=setTimeout(()=>resolve(null),maximumMs)})])
  clearTimeout(timer)
  return ended
}
export async function collectClockWindows(capture, expected, pause, accepted = () => {}) {
  let highWater=new Map(), timeline=null
  for(let completed=0;completed<3;completed++) {
    const number=nextClockWindow(completed), record=await capture(number)
    const verdict=clockWindowVerdict(record,expected,highWater)
    if(record.schemaVersion!==2 || record.pdhSequences!==record.instances.length || record.maximumInstances!==16 || verdict.status!=='PASS_CLOCK_WINDOW_ONLY')
      throw new Error('CLOCK_WINDOW_REJECTED_'+(verdict.reason??'COLLECTION'))
    const fields=['queryStartUtc','queryEndUtc','startTick','endTick','frequency']
    if(!record.wmiQuery || record.instances.some(i=>fields.some(key=>i.wmi.query[key]!==record.wmiQuery[key]))) throw new Error('WMI_QUERY_COLLECTION_MISMATCH')
    timeline=extendClockTimeline([record.wmiQuery,...record.instances.map(i=>i.pdh.query)],timeline)
    highWater=verdict.highWater
    accepted(number)
    if(completed<2) await pause()
  }
  return highWater
}
export async function main(argv = process.argv.slice(2)) {
  const root = fs.realpathSync(fileURLToPath(new URL('../', import.meta.url)))
  const options = {}
  if (argv.length !== 6) throw new Error('CLOCK_ARGUMENTS')
  for (let i = 0; i < argv.length; i += 2) {
    if (!['--build', '--out', '--fingerprint'].includes(argv[i]) || options[argv[i]] || !argv[i+1]) throw new Error('CLOCK_ARGUMENTS')
    options[argv[i]] = argv[i+1]
  }
  const build = scopedE12Path(root, options['--build'], 'release/e02')
  const output = scopedE12Path(root, options['--out'], 'release/e12')
  const baselineFile = scopedE12Path(root, options['--fingerprint'], 'release/e12')
  const git = (...args) => {
    const r = spawnSync('git', args, {cwd:root,encoding:'utf8',windowsHide:true,timeout:5000})
    if (r.status !== 0) throw new Error('CLOCK_GIT_CHECK: '+r.stderr)
    return r.stdout.trim()
  }
  const head = git('rev-parse','HEAD')
  if (git('status','--porcelain') !== '') throw new Error('CLOCK_SOURCE_DIRTY')
  const read = file => JSON.parse(fs.readFileSync(file,'utf8'))
  const validation = read(path.join(build,'result.json'))
  if (validation.result !== 'PASS_LOCAL_ENGINE_FOUNDATION' || validation.sourceHead !== head ||
    validation.stages.length !== 5 || validation.stages.some(s => !s.verified || s.code !== 0)) throw new Error('CLOCK_BUILD_NOT_VALIDATED')
  const playerFile = path.join(build,'build/player/ChangshanLongdan.exe')
  const payload = snapshotPayload(path.dirname(playerFile)), source = snapshotSource(root)
  if (!comparePayload(validation.playerPayload, payload).unchanged) throw new Error('CLOCK_PAYLOAD_MISMATCH')
  if (hash(baselineFile) !== baselineHash) throw new Error('CLOCK_BASELINE_FINGERPRINT_CHANGED')
  const baseline = fingerprintContents(read(baselineFile))
  if (fs.existsSync(output)) throw new Error('CLOCK_EVIDENCE_EXISTS_NO_RETRY')
  fs.mkdirSync(output)
  const write = (name,value) => fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'})
  const runId = randomUUID(), owned = new Set(), deadline = process.hrtime.bigint() + 90000000000n
  const result = {kind:'BOUNDED_OWNED_PLAYER_CLOCK_ONLY',runId,sourceHead:head,status:'RUNNING',error:null,
    windowsAttempted:0,windowsAccepted:0,maximumWindows:3,clockMapping:'UNVERIFIED',producerImplementation:'UNKNOWN',
    loadedModule:'UNKNOWN',formalVram:'NOT_VALIDATED',environmentClaim:'BRACKET_SNAPSHOTS_ONLY',playerLaunched:false,
    sourceUnchanged:null,payloadUnchanged:null,childResults:[]}
  write('command.json',{runId,head,build,baselineSha256:baselineHash,controllerSha256:hash(fileURLToPath(import.meta.url)),
    maximumWindows:3,maximumEnvironmentCimCalls:4,maximumClockWmiCalls:3,maximumInstances:16,maximumPdhCallsPerWindow:80,totalDeadlineMs:90000,
    authorization:{destination:'Local Windows and this validation worktree',purpose:'SPEC A2 one owned Player clock comparison',
      allowed:'Two bracket environment snapshots; one owned visible Player; at most three WMI/PDH clock windows; exclusive local evidence',
      dataTransmitted:'None',forbidden:'Retries, fourth window, usage persistence/analysis, gameplay modification, non-owned process termination, remote changes or permissions',
      stop:'Any missing/invalid evidence, changed environment/identity/collection/source/payload, source>2s or global>90s'}})
  let player, playerCompletion
  async function child(executable, args, name, maximum, reserve = 0, visible = false) {
    const timeout = timeoutWithin(deadline, maximum, reserve)
    const env = {...process.env}; if (executable === 'powershell.exe') delete env.PSModulePath
    const processChild = spawn(executable,args,{cwd:root,env,windowsHide:!visible,stdio:['ignore','pipe','pipe']})
    owned.add(processChild)
    let stdout = '', stderr = '', spawnError = null, timedOut = false
    const completion = new Promise(resolve => {
      processChild.stdout.on('data', chunk => {stdout += chunk; if(stdout.length > 1048576) {spawnError='OUTPUT_LIMIT';stopOwned(processChild,owned)} })
      processChild.stderr.on('data', chunk => {stderr += chunk; if(stderr.length > 1048576) {spawnError='OUTPUT_LIMIT';stopOwned(processChild,owned)} })
      processChild.once('error', error => {spawnError=error.message})
      let finished=false, confirmationTimer
      const finish=(code,signal,exitConfirmed)=>{
        if(finished)return;finished=true;clearTimeout(timer);clearTimeout(confirmationTimer)
        fs.writeFileSync(path.join(output,name+'.stdout.txt'),stdout,{flag:'wx'})
        fs.writeFileSync(path.join(output,name+'.stderr.txt'),stderr,{flag:'wx'})
        const report={name,executable,args,code,signal,error:spawnError,timedOut,timeoutMs:timeout,exitConfirmed}
        result.childResults.push(report);resolve(report)
      }
      const timer = setTimeout(()=>{
        timedOut=true;stopOwned(processChild,owned)
        confirmationTimer=setTimeout(()=>{
          spawnError='CHILD_EXIT_UNCONFIRMED';processChild.stdout.destroy();processChild.stderr.destroy();processChild.unref()
          finish(null,null,false)
        },Math.max(1,Math.min(2000,Number((deadline-process.hrtime.bigint())/1000000n))))
      },timeout)
      processChild.once('close',(code,signal)=>finish(code,signal,true))
    })
    return {processChild,completion}
  }
  async function runPowerShell(script,args,name,maximum,reserve) {
    const launched = await child('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(root,script),...args],name,maximum,reserve)
    const report = await launched.completion
    if (report.code !== 0 || report.error || report.timedOut || fs.statSync(path.join(output,name+'.stderr.txt')).size) throw new Error('CLOCK_CHILD_FAILED_'+name)
  }
  async function environment(name) {
    fs.mkdirSync(path.join(output,name))
    const filename = path.join(output,name,'fingerprint.json')
    await runPowerShell('scripts/diagnostics/Capture-E12ClockFingerprint.ps1',
      ['-OutputPath',filename,'-SourceHead',head,'-RunId',runId],name,20000,name==='environment-before'?60000:5000)
    const record = read(filename)
    if (JSON.stringify(fingerprintContents(record)) !== JSON.stringify(baseline)) throw new Error('CLOCK_ENVIRONMENT_CHANGED_'+name)
    return filename
  }
  try {
    const currentFingerprint = await environment('environment-before')
    fs.mkdirSync(path.join(output,'player'))
    const args=['-force-d3d11','-screen-width','1920','-screen-height','1080','-screen-fullscreen','0','-e09NoFlow','-e12ClockReady',path.join(output,'player'),
      '-e12RunId',runId,'-logFile',path.join(output,'Player.log')]
    const launched = await child(playerFile,args,'player',timeoutWithin(deadline,90000,5000),5000,true)
    player=launched.processChild;playerCompletion=launched.completion;result.playerLaunched=true
    const readyFile=path.join(output,'player/ready.json'), readyDeadline=process.hrtime.bigint()+35000000000n
    while(!fs.existsSync(readyFile)) {
      timeoutWithin(deadline,1,25000)
      if(process.hrtime.bigint()>=readyDeadline || player.exitCode!==null || player.signalCode!==null) throw new Error('CLOCK_READY_DEADLINE_OR_EXIT')
      await new Promise(resolve=>setTimeout(resolve,50))
    }
    const ready=read(readyFile), identity={runId,pid:player.pid,processStartUtc:ready.processStartUtc,imagePath:playerFile,imageSha256:hash(playerFile)}
    validateClockReady(ready,identity)
    write('identity.json',identity)
    const expected={...identity,timezoneId:baseline.timezone[0].id,fingerprintSha256:hash(currentFingerprint)}
    await collectClockWindows(async window => {
      const filename=path.join(output,`window-${window}.json`)
      timeoutWithin(deadline,8000,25000)
      result.windowsAttempted++
      await runPowerShell('scripts/diagnostics/Capture-E12PlayerClockWindow.ps1',
        ['-TargetPid',String(identity.pid),'-IdentityPath',path.join(output,'identity.json'),'-FingerprintPath',currentFingerprint,'-OutputPath',filename],
        `window-${window}`,8000,25000)
      const record=read(filename)
      if(record.scriptSha256!==hash(path.join(root,'scripts/diagnostics/Capture-E12PlayerClockWindow.ps1')) || record.maximumPdhCalls!==80)
        throw new Error('CLOCK_WINDOW_SOURCE_CHANGED')
      return record
    },expected,async()=>{timeoutWithin(deadline,1000,33000);await new Promise(resolve=>setTimeout(resolve,1000))},()=>{result.windowsAccepted++})
    await environment('environment-after')
    write('player/stop.json',{runId})
    const ended = await Promise.race([playerCompletion,new Promise(resolve=>setTimeout(()=>resolve(null),timeoutWithin(deadline,5000)))])
    if(!ended || ended.code!==0 || ended.error || ended.timedOut) throw new Error('CLOCK_PLAYER_END_FAILED')
    validateClockReady(read(path.join(output,'player/end.json')),identity,true)
    result.sourceUnchanged=git('rev-parse','HEAD')===head && git('status','--porcelain')==='' && JSON.stringify(snapshotSource(root))===JSON.stringify(source)
    result.payloadUnchanged=comparePayload(payload,snapshotPayload(path.dirname(playerFile))).unchanged
    if(!result.sourceUnchanged || !result.payloadUnchanged) throw new Error('CLOCK_SOURCE_OR_PAYLOAD_CHANGED')
    timeoutWithin(deadline,1)
    result.clockMapping='LOCAL_ENCODED_OBSERVED_THIS_PLAYER_RUN';result.status='PASS_THREE_CLOCK_WINDOWS_ONLY'
  } catch(error) {result.status='BLOCKED_PLAYER_CLOCK';result.error=error.message}
  finally {
    if(playerCompletion) {
      const cleanupMs=Math.max(1,Math.min(5000,Number((deadline-process.hrtime.bigint())/1000000n)))
      const ended=await confirmOwnedExit(player,owned,playerCompletion,cleanupMs)
      result.cleanupConfirmed=ended!==null
      if(!ended) {
        result.status='BLOCKED_PLAYER_CLOCK';result.clockMapping='UNVERIFIED';result.error='OWNED_CHILD_EXIT_UNCONFIRMED'
        result.unconfirmedPlayerPid=player.pid
        player.stdout.destroy();player.stderr.destroy();player.unref()
      }
    }
    result.elapsedMs=90000-Number((deadline-process.hrtime.bigint())/1000000n)
    if(result.elapsedMs>90000 && result.status==='PASS_THREE_CLOCK_WINDOWS_ONLY') {
      result.status='BLOCKED_PLAYER_CLOCK';result.clockMapping='UNVERIFIED';result.error='CLOCK_RUN_DEADLINE'
    }
    result.endUtc=new Date().toISOString()
    write('result.json',result)
  }
  console.log(JSON.stringify(result))
  if(result.status!=='PASS_THREE_CLOCK_WINDOWS_ONLY') process.exitCode=2
  return result
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error=>{console.error(error.message);process.exitCode=2})
}
