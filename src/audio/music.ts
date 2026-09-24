/** 以 D 小調五聲音階即時合成的配樂：戰鼓、貝斯、失真強力和弦與二胡風主旋律。 */

type Mode = 'title' | 'battle'

const TEMPO = 138
const STEP = 60 / TEMPO / 4 // 十六分音符
const BAR = 16
const ROOTS = [50, 50, 48, 48, 46, 46, 48, 45] // Dm Dm C C B♭ B♭ C A

// 主旋律：[拍數, MIDI 音高或 null 休止]
const MELODY: [number, number | null][][] = [
  [[1.5, 69], [0.5, 67], [1, 69], [1, 72]],
  [[2, 74], [1, 72], [1, 69]],
  [[1.5, 67], [0.5, 69], [1, 67], [1, 65]],
  [[3, 67], [1, null]],
  [[1.5, 65], [0.5, 67], [1, 69], [1, 72]],
  [[1, 74], [1, 77], [1, 74], [1, 72]],
  [[1.5, 69], [0.5, 67], [1, 65], [1, 67]],
  [[3, 69], [1, null]],
]

interface Note {
  step: number
  length: number
  midi: number
}

const LEAD: Note[] = (() => {
  const notes: Note[] = []
  MELODY.forEach((bar, b) => {
    let beat = 0
    for (const [beats, midi] of bar) {
      if (midi !== null) notes.push({ step: b * BAR + beat * 4, length: beats * 4, midi })
      beat += beats
    }
  })
  return notes
})()

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

export class Music {
  private readonly ctx: AudioContext
  private readonly out: GainNode
  private readonly noise: AudioBuffer
  private readonly drive: WaveShaperNode
  private timer: number | null = null
  private nextTime = 0
  private step = 0
  private mode: Mode = 'title'

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx
    this.out = ctx.createGain()
    this.out.gain.value = 1
    this.out.connect(destination)
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    this.drive = ctx.createWaveShaper()
    const curve = new Float32Array(new ArrayBuffer(1024 * 4))
    for (let i = 0; i < 1024; i++) {
      const x = (i * 2) / 1024 - 1
      curve[i] = (26 * x) / (1 + 25 * Math.abs(x))
    }
    this.drive.curve = curve
    const guitarTone = ctx.createBiquadFilter()
    guitarTone.type = 'lowpass'
    guitarTone.frequency.value = 2400
    this.drive.connect(guitarTone).connect(this.out)
  }

  start(mode: Mode): void {
    this.mode = mode
    if (this.timer !== null) return
    this.nextTime = this.ctx.currentTime + 0.1
    this.step = 0
    this.timer = window.setInterval(() => this.schedule(), 25)
  }

  setMode(mode: Mode): void {
    if (mode !== this.mode) {
      this.mode = mode
      // 切到戰鬥時從小節開頭進拍
      this.step = Math.ceil(this.step / BAR) * BAR
    }
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
  }

  private schedule(): void {
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.play(this.step, this.nextTime)
      this.nextTime += STEP
      this.step++
    }
  }

  private play(step: number, t: number): void {
    const loopStep = step % (BAR * 8)
    const bar = Math.floor(loopStep / BAR)
    const s = loopStep % BAR
    const root = ROOTS[bar]
    if (this.mode === 'title') {
      if (s === 0) this.pad(root, t, STEP * BAR)
      if (s % 2 === 0) this.pluck([0, 7, 12, 15, 19, 15, 12, 7][(s / 2) % 8] + root + 12, t)
      if (s === 0 && bar % 2 === 0) this.taiko(t, 0.5)
      return
    }
    // 戰鬥
    if ([0, 6, 8, 11].includes(s)) this.taiko(t, s === 0 ? 1 : 0.75)
    if (s === 4 || s === 12) this.snare(t)
    if (s % 2 === 0) this.hat(t, s % 4 === 2 ? 0.07 : 0.04)
    if (bar === 7 && s >= 12) this.taiko(t, 0.6)
    if (s % 2 === 0) this.bass(root + [0, 0, 12, 0, 0, 7, 12, 0][(s / 2) % 8], t)
    if ([0, 3, 6, 8, 11, 14].includes(s)) this.powerChord(root + 12, t, s === 0 ? STEP * 3 : STEP * 0.9)
    for (const n of LEAD) if (n.step === loopStep) this.lead(n.midi + 12, t, n.length * STEP)
  }

  private env(t: number, attack: number, peak: number, release: number, sustain = 0): GainNode {
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(peak, t + attack)
    if (sustain > 0) g.gain.setValueAtTime(peak, t + attack + sustain)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + sustain + release)
    g.connect(this.out)
    return g
  }

  private osc(type: OscillatorType, f: number, t: number, duration: number): OscillatorNode {
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f, t)
    o.start(t)
    o.stop(t + duration + 0.05)
    return o
  }

  private noiseHit(t: number, duration: number, type: BiquadFilterType, f: number, gain: number): void {
    const src = this.ctx.createBufferSource()
    src.buffer = this.noise
    src.start(t, Math.random() * 0.5)
    src.stop(t + duration + 0.02)
    const filter = this.ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = f
    src.connect(filter).connect(this.env(t, 0.002, gain, duration))
  }

  private taiko(t: number, v: number): void {
    const o = this.osc('sine', 92, t, 0.45)
    o.frequency.exponentialRampToValueAtTime(46, t + 0.3)
    o.connect(this.env(t, 0.003, 0.55 * v, 0.38))
    this.noiseHit(t, 0.06, 'lowpass', 900, 0.2 * v)
  }

  private snare(t: number): void {
    this.noiseHit(t, 0.16, 'bandpass', 1800, 0.22)
    this.osc('triangle', 190, t, 0.1).connect(this.env(t, 0.002, 0.12, 0.08))
  }

  private hat(t: number, gain: number): void {
    this.noiseHit(t, 0.03, 'highpass', 7000, gain)
  }

  private bass(midi: number, t: number): void {
    const o = this.osc('sawtooth', freq(midi), t, STEP * 2)
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 700
    o.connect(lp).connect(this.env(t, 0.005, 0.16, STEP * 1.6))
  }

  private powerChord(midi: number, t: number, length: number): void {
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + length)
    g.connect(this.drive)
    for (const interval of [0, 7, 12]) this.osc('sawtooth', freq(midi + interval), t, length).connect(g)
  }

  /** 二胡風主旋律：鋸齒波加帶通，音頭後漸強的顫音。 */
  private lead(midi: number, t: number, length: number): void {
    const o = this.osc('sawtooth', freq(midi), t, length)
    const vibrato = this.osc('sine', 5.5, t, length)
    const depth = this.ctx.createGain()
    depth.gain.setValueAtTime(0, t)
    depth.gain.linearRampToValueAtTime(freq(midi) * 0.012, t + Math.min(0.4, length))
    vibrato.connect(depth).connect(o.frequency)
    const bp = this.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1800
    bp.Q.value = 0.9
    o.connect(bp).connect(this.env(t, 0.05, 0.09, 0.12, Math.max(0, length - 0.17)))
  }

  private pad(root: number, t: number, length: number): void {
    for (const interval of [12, 19, 24, 27]) {
      const o = this.osc('triangle', freq(root + interval), t, length)
      o.connect(this.env(t, 0.8, 0.025, length * 0.5, length * 0.3))
    }
  }

  /** 古箏風撥弦。 */
  private pluck(midi: number, t: number): void {
    this.osc('triangle', freq(midi), t, 0.6).connect(this.env(t, 0.003, 0.05, 0.5))
  }
}
