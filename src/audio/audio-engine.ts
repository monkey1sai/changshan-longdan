import type { HitSfx } from '../combat/moves.ts'

function distortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 1024
  const curve = new Float32Array(new ArrayBuffer(n * 4))
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x))
  }
  return curve
}

/** 全部音效以 WebAudio 即時合成：揮擊、命中、碎裂、無雙、龍吟與環境音。 */
export class AudioEngine {
  readonly ctx: AudioContext
  readonly musicBus: GainNode
  private readonly master: GainNode
  private readonly sfx: GainNode
  private readonly noise: AudioBuffer
  private readonly drive: Float32Array<ArrayBuffer>
  private ambienceNodes: AudioNode[] = []
  private crackleTimer: number | null = null
  private lastHitTime = 0

  constructor() {
    this.ctx = new AudioContext()
    const ctx = this.ctx
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -16
    compressor.knee.value = 12
    compressor.ratio.value = 4
    compressor.attack.value = 0.003
    compressor.release.value = 0.25
    compressor.connect(ctx.destination)

    this.master = ctx.createGain()
    this.master.gain.value = 0.8
    this.master.connect(compressor)
    this.sfx = ctx.createGain()
    this.sfx.gain.value = 0.9
    this.sfx.connect(this.master)
    this.musicBus = ctx.createGain()
    this.musicBus.gain.value = 0.42
    this.musicBus.connect(this.master)

    const reverb = ctx.createConvolver()
    reverb.buffer = this.impulse(2.6)
    const send = ctx.createGain()
    send.gain.value = 0.3
    this.sfx.connect(send)
    this.musicBus.connect(send)
    send.connect(reverb)
    reverb.connect(this.master)

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    this.drive = distortionCurve(18)
  }

  get now(): number {
    return this.ctx.currentTime
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume()
  }

  setMusicLevel(level: number, seconds = 0.4): void {
    const g = this.musicBus.gain
    g.cancelScheduledValues(this.now)
    g.setValueAtTime(g.value, this.now)
    g.linearRampToValueAtTime(level, this.now + seconds)
  }

  swing(heavy: boolean, pan = 0): void {
    const t = this.now
    const dur = heavy ? 0.32 : 0.2
    const bp = this.filter('bandpass', heavy ? 500 : 800, 1.4)
    bp.frequency.exponentialRampToValueAtTime(heavy ? 2200 : 3400, t + dur * 0.45)
    bp.frequency.exponentialRampToValueAtTime(heavy ? 600 : 1000, t + dur)
    this.chain(this.noiseSource(t, dur), bp, this.env(t, dur * 0.35, heavy ? 0.55 : 0.35, dur * 0.65), this.pan(pan))
  }

  hit(kind: HitSfx, count: number, pan = 0): void {
    const t = this.now
    if (t - this.lastHitTime < 0.025) return
    this.lastHitTime = t
    const power = Math.min(1.6, 0.7 + count * 0.12) * (kind === 'heavy' ? 1.3 : 1)
    const out = this.pan(pan)

    const thump = this.osc('sine', kind === 'heavy' ? 140 : 180, t, 0.3)
    thump.frequency.exponentialRampToValueAtTime(42, t + 0.18)
    this.chain(thump, this.env(t, 0.004, 0.9 * power, 0.22), out)

    const crunch = this.filter('highpass', 1200, 0.7)
    this.chain(this.noiseSource(t, 0.14), crunch, this.env(t, 0.002, 0.5 * power, 0.1), out)

    const sizzle = this.filter('bandpass', kind === 'pierce' ? 4200 : 3000, 2)
    this.chain(this.noiseSource(t, 0.2), sizzle, this.env(t, 0.003, 0.25 * power, 0.16), out)

    if (kind === 'heavy') {
      const boom = this.osc('sine', 72, t, 0.6)
      boom.frequency.exponentialRampToValueAtTime(32, t + 0.45)
      const shaper = this.ctx.createWaveShaper()
      shaper.curve = this.drive
      this.chain(boom, shaper, this.env(t, 0.005, 0.45, 0.5), out)
    } else {
      for (const f of [1850, 2790]) {
        const clink = this.osc('square', f * (0.95 + Math.random() * 0.1), t, 0.1)
        this.chain(clink, this.filter('bandpass', f, 8), this.env(t, 0.001, 0.07, 0.08), out)
      }
    }
  }

  /** 體素碎裂：一串細碎的方塊撞擊聲。 */
  shatter(count: number, pan = 0): void {
    const out = this.pan(pan)
    const n = Math.min(12, 4 + count * 2)
    for (let i = 0; i < n; i++) {
      const t = this.now + Math.random() * 0.14
      const f = 1500 + Math.random() * 3500
      this.chain(this.noiseSource(t, 0.05), this.filter('bandpass', f, 6), this.env(t, 0.001, 0.22, 0.04), out)
    }
    const t = this.now
    const thud = this.osc('sine', 95, t, 0.2)
    thud.frequency.exponentialRampToValueAtTime(40, t + 0.15)
    this.chain(thud, this.env(t, 0.003, 0.35, 0.15), out)
  }

  enemySwing(pan = 0): void {
    const t = this.now
    const bp = this.filter('bandpass', 400, 1.2)
    bp.frequency.exponentialRampToValueAtTime(1400, t + 0.12)
    this.chain(this.noiseSource(t, 0.22), bp, this.env(t, 0.06, 0.18, 0.14), this.pan(pan))
  }

  playerHurt(heavy: boolean): void {
    const t = this.now
    const out = this.pan(0)
    const thump = this.osc('sine', 120, t, 0.3)
    thump.frequency.exponentialRampToValueAtTime(45, t + 0.2)
    this.chain(thump, this.env(t, 0.003, heavy ? 1 : 0.7, 0.25), out)
    // 以兩個共振峰模擬悶哼
    const voice = this.osc('sawtooth', heavy ? 170 : 200, t, 0.25)
    voice.frequency.exponentialRampToValueAtTime(115, t + 0.2)
    const g = this.env(t, 0.01, 0.22, 0.18)
    for (const [f, q] of [[700, 5], [1150, 6]]) this.chain(voice, this.filter('bandpass', f, q), g)
    g.connect(out)
  }

  jump(): void {
    const t = this.now
    const bp = this.filter('bandpass', 600, 1.5)
    bp.frequency.exponentialRampToValueAtTime(1800, t + 0.15)
    this.chain(this.noiseSource(t, 0.18), bp, this.env(t, 0.04, 0.2, 0.12), this.pan(0))
  }

  land(heavy: boolean): void {
    const t = this.now
    const thud = this.osc('sine', heavy ? 90 : 110, t, 0.3)
    thud.frequency.exponentialRampToValueAtTime(38, t + 0.22)
    this.chain(thud, this.env(t, 0.003, heavy ? 0.9 : 0.4, 0.25), this.pan(0))
    this.chain(this.noiseSource(t, 0.25), this.filter('lowpass', 500, 0.7), this.env(t, 0.005, heavy ? 0.6 : 0.25, 0.2), this.pan(0))
  }

  dodge(): void {
    const t = this.now
    const bp = this.filter('bandpass', 900, 1.1)
    bp.frequency.exponentialRampToValueAtTime(3000, t + 0.1)
    bp.frequency.exponentialRampToValueAtTime(700, t + 0.22)
    this.chain(this.noiseSource(t, 0.26), bp, this.env(t, 0.03, 0.32, 0.2), this.pan(0))
  }

  /** 無雙發動：銅鑼、升調的氣勢聲與太鼓。 */
  musouStart(): void {
    const t = this.now
    const out = this.pan(0)
    const partials = [1, 1.49, 2.1, 2.72, 3.3, 4.1]
    const gains = [0.5, 0.3, 0.25, 0.18, 0.12, 0.1]
    partials.forEach((p, i) => {
      const o = this.osc('sine', 98 * p, t, 3.2)
      o.frequency.exponentialRampToValueAtTime(98 * p * 0.97, t + 3)
      this.chain(o, this.env(t, 0.005, gains[i], 3 - i * 0.3), out)
    })
    this.chain(this.noiseSource(t, 0.3), this.filter('bandpass', 2400, 1), this.env(t, 0.002, 0.4, 0.25), out)

    const riser = this.osc('sawtooth', 110, t, 1.2)
    riser.frequency.exponentialRampToValueAtTime(220, t + 1.0)
    const lp = this.filter('lowpass', 300, 8)
    lp.frequency.exponentialRampToValueAtTime(3500, t + 1.0)
    this.chain(riser, lp, this.env(t, 0.9, 0.22, 0.25), out)

    const taiko = this.osc('sine', 80, t, 0.6)
    taiko.frequency.exponentialRampToValueAtTime(45, t + 0.4)
    this.chain(taiko, this.env(t, 0.004, 1, 0.5), out)
  }

  dragonRoar(): void {
    const t = this.now
    const out = this.pan(0)
    const env = this.env(t, 0.25, 0.5, 1.5)
    const lp = this.filter('lowpass', 200, 3)
    lp.frequency.exponentialRampToValueAtTime(1600, t + 0.5)
    lp.frequency.exponentialRampToValueAtTime(500, t + 1.7)
    const shaper = this.ctx.createWaveShaper()
    shaper.curve = this.drive
    const vibrato = this.osc('sine', 6, t, 1.9)
    const depth = this.ctx.createGain()
    depth.gain.value = 9
    vibrato.connect(depth)
    for (const f of [72, 75.5]) {
      const o = this.osc('sawtooth', f, t, 1.9)
      depth.connect(o.frequency)
      o.connect(shaper)
    }
    this.chain(shaper, lp, env, out)
    this.chain(this.noiseSource(t, 1.9), this.filter('bandpass', 900, 1), this.env(t, 0.2, 0.18, 1.4), out)
    this.chain(this.osc('sine', 45, t, 1.9), this.env(t, 0.3, 0.5, 1.4), out)
  }

  musouBlast(): void {
    const t = this.now
    const out = this.pan(0)
    const boom = this.osc('sine', 70, t, 1.6)
    boom.frequency.exponentialRampToValueAtTime(28, t + 1.2)
    const shaper = this.ctx.createWaveShaper()
    shaper.curve = this.drive
    this.chain(boom, shaper, this.env(t, 0.004, 0.9, 1.4), out)
    const lp = this.filter('lowpass', 6000, 0.8)
    lp.frequency.exponentialRampToValueAtTime(150, t + 1.6)
    this.chain(this.noiseSource(t, 1.8), lp, this.env(t, 0.004, 0.9, 1.6), out)
  }

  /** 無雙氣滿的提示音：五聲音階的上行琶音。 */
  musouReady(): void {
    const out = this.pan(0)
    ;[74, 77, 81, 86].forEach((m, i) => {
      const t = this.now + i * 0.07
      const f = 440 * 2 ** ((m - 69) / 12)
      this.chain(this.osc('triangle', f, t, 0.5), this.env(t, 0.003, 0.14, 0.4), out)
      this.chain(this.osc('sine', f * 2, t, 0.3), this.env(t, 0.003, 0.05, 0.25), out)
    })
  }

  milestone(): void {
    const t = this.now
    const out = this.pan(0)
    ;[1, 1.5, 2.2, 3.1].forEach((p, i) => this.chain(this.osc('sine', 196 * p, t, 1.8), this.env(t, 0.004, 0.25 / (i + 1), 1.6), out))
  }

  uiConfirm(): void {
    const t = this.now
    this.chain(this.osc('triangle', 880, t, 0.15), this.env(t, 0.002, 0.15, 0.12), this.pan(0))
    this.chain(this.osc('triangle', 1320, t + 0.06, 0.15), this.env(t + 0.06, 0.002, 0.12, 0.12), this.pan(0))
  }

  /** 勝利：以大三和弦收尾的號角。 */
  victory(): void {
    const out = this.pan(0)
    const chords = [[62, 65, 69], [60, 64, 67], [62, 66, 69, 74]]
    chords.forEach((chord, ci) => {
      const t = this.now + ci * 0.45
      const len = ci === 2 ? 2.2 : 0.4
      for (const m of chord) {
        const o = this.osc('sawtooth', 440 * 2 ** ((m - 69) / 12), t, len + 0.2)
        this.chain(o, this.filter('lowpass', 1800, 1), this.env(t, 0.05, 0.08, len), out)
      }
    })
  }

  defeat(): void {
    const out = this.pan(0)
    ;[57, 53, 50].forEach((m, i) => {
      const t = this.now + i * 0.5
      const o = this.osc('sawtooth', 440 * 2 ** ((m - 69) / 12), t, 1)
      this.chain(o, this.filter('lowpass', 900, 1), this.env(t, 0.05, 0.12, 0.8), out)
    })
  }

  startAmbience(): void {
    if (this.ambienceNodes.length > 0) return
    const ctx = this.ctx
    const loop = () => {
      const s = ctx.createBufferSource()
      s.buffer = this.noise
      s.loop = true
      s.start()
      return s
    }
    const wind = loop()
    const windFilter = this.filter('lowpass', 500, 0.6)
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoDepth = ctx.createGain()
    lfoDepth.gain.value = 250
    lfo.connect(lfoDepth).connect(windFilter.frequency)
    lfo.start()
    const windGain = ctx.createGain()
    windGain.gain.value = 0.05
    this.chain(wind, windFilter, windGain, this.sfx)

    const murmur = loop()
    const murmurGain = ctx.createGain()
    murmurGain.gain.value = 0.03
    const am = ctx.createOscillator()
    am.frequency.value = 0.3
    const amDepth = ctx.createGain()
    amDepth.gain.value = 0.015
    am.connect(amDepth).connect(murmurGain.gain)
    am.start()
    this.chain(murmur, this.filter('bandpass', 350, 0.8), murmurGain, this.sfx)
    this.ambienceNodes = [wind, lfo, murmur, am]

    this.crackleTimer = window.setInterval(() => {
      if (ctx.state !== 'running' || Math.random() > 0.45) return
      const t = this.now + Math.random() * 0.05
      this.chain(this.noiseSource(t, 0.02), this.filter('highpass', 2000, 0.7), this.env(t, 0.001, 0.02 + Math.random() * 0.04, 0.015), this.sfx)
    }, 60)
  }

  stopAmbience(): void {
    if (this.crackleTimer !== null) window.clearInterval(this.crackleTimer)
    this.crackleTimer = null
    for (const node of this.ambienceNodes) {
      if (node instanceof AudioScheduledSourceNode) node.stop()
      node.disconnect()
    }
    this.ambienceNodes = []
  }

  private impulse(seconds: number): AudioBuffer {
    const rate = this.ctx.sampleRate
    const length = Math.floor(rate * seconds)
    const buffer = this.ctx.createBuffer(2, length, rate)
    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c)
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3
    }
    return buffer
  }

  private noiseSource(t: number, duration: number): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource()
    s.buffer = this.noise
    s.loop = true
    s.start(t, Math.random() * 1.5)
    s.stop(t + duration + 0.05)
    return s
  }

  private osc(type: OscillatorType, freq: number, t: number, duration: number): OscillatorNode {
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    o.start(t)
    o.stop(t + duration + 0.05)
    return o
  }

  private filter(type: BiquadFilterType, freq: number, q: number): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter()
    f.type = type
    f.frequency.setValueAtTime(freq, this.now)
    f.Q.value = q
    return f
  }

  /** 指數包絡：attack 後到 peak，再在 decay 內衰減。 */
  private env(t: number, attack: number, peak: number, decay: number): GainNode {
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
    return g
  }

  private pan(value: number): AudioNode {
    const p = this.ctx.createStereoPanner()
    p.pan.value = Math.max(-1, Math.min(1, value))
    p.connect(this.sfx)
    return p
  }

  private chain(...nodes: AudioNode[]): void {
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1])
  }
}
