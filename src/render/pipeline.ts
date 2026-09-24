import {
  DepthTexture,
  HalfFloatType,
  LinearFilter,
  NoToneMapping,
  PCFShadowMap,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
  type PerspectiveCamera,
  type Scene,
  type Texture,
} from 'three'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'
import { BLUR_FRAGMENT, BRIGHT_FRAGMENT, DOWNSAMPLE_FRAGMENT, FINAL_FRAGMENT, FULLSCREEN_VERTEX } from './post-shaders.ts'

export interface PostSettings {
  focus: number // 對焦距離（公尺）
  musou: number // 無雙調色 0..1
  flash: number // 白閃 0..1
  aberration: number // 色差 0..1
  radial: number // 放射模糊 0..1
  danger: number // 低血量紅暈 0..1
  bars: number // 電影黑邊 0..1
  exposure: number
}

interface Chain {
  a: WebGLRenderTarget
  b: WebGLRenderTarget
}

function colorTarget(): WebGLRenderTarget {
  return new WebGLRenderTarget(1, 1, {
    type: HalfFloatType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: false,
  })
}

function chain(): Chain {
  return { a: colorTarget(), b: colorTarget() }
}

function pass(fragmentShader: string, uniforms: Record<string, { value: unknown }>): ShaderMaterial {
  return new ShaderMaterial({ vertexShader: FULLSCREEN_VERTEX, fragmentShader, uniforms, depthTest: false, depthWrite: false })
}

/**
 * 自訂後製管線：場景先畫進 HDR（半精度、4× MSAA、附深度貼圖）的 render target，
 * 再做景深用的模糊鏈、bloom 鏈，最後在全螢幕 pass 合成、色調映射並輸出 sRGB。
 */
export class Pipeline {
  readonly renderer: WebGLRenderer
  sceneDrawCalls = 0
  sceneTriangles = 0
  private readonly maxPixelRatio: number
  private quality = 1
  private width = 1
  private height = 1
  private readonly sceneRT: WebGLRenderTarget
  private readonly dofHalf = chain()
  private readonly dofQuarter = chain()
  private readonly bloomHalf = chain()
  private readonly bloomQuarter = chain()
  private readonly bloomEighth = chain()
  private readonly quad = new FullScreenQuad()
  private readonly down = pass(DOWNSAMPLE_FRAGMENT, { tInput: { value: null }, uTexel: { value: new Vector2() } })
  private readonly bright = pass(BRIGHT_FRAGMENT, {
    tInput: { value: null },
    uTexel: { value: new Vector2() },
    uThreshold: { value: 1.1 },
    uKnee: { value: 0.6 },
  })
  private readonly blur = pass(BLUR_FRAGMENT, { tInput: { value: null }, uDir: { value: new Vector2() } })
  private readonly final: ShaderMaterial

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: false, stencil: false, powerPreference: 'high-performance' })
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = NoToneMapping
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFShadowMap
    this.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
    this.sceneRT = new WebGLRenderTarget(1, 1, {
      type: HalfFloatType,
      samples: 4,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthTexture: new DepthTexture(1, 1),
    })
    this.final = pass(FINAL_FRAGMENT, {
      tColor: { value: this.sceneRT.texture },
      tDepth: { value: this.sceneRT.depthTexture },
      tBlur1: { value: this.dofHalf.a.texture },
      tBlur2: { value: this.dofQuarter.a.texture },
      tBloom1: { value: this.bloomHalf.a.texture },
      tBloom2: { value: this.bloomQuarter.a.texture },
      tBloom3: { value: this.bloomEighth.a.texture },
      uNear: { value: 0.1 },
      uFar: { value: 1500 },
      uFocus: { value: 9 },
      uFocusRange: { value: 6 },
      uDof: { value: 1 },
      uBloom: { value: 0.55 },
      uExposure: { value: 1 },
      uMusou: { value: 0 },
      uFlash: { value: 0 },
      uAberration: { value: 0 },
      uRadial: { value: 0 },
      uDanger: { value: 0 },
      uBars: { value: 0 },
      uTime: { value: 0 },
      uResolution: { value: new Vector2(1, 1) },
    })
  }

  get pixelRatio(): number {
    return this.renderer.getPixelRatio()
  }

  get qualityScale(): number {
    return this.quality
  }

  setSize(width: number, height: number): void {
    this.width = width
    this.height = height
    this.renderer.setPixelRatio(this.maxPixelRatio * this.quality)
    this.renderer.setSize(width, height, false)
    const size = this.renderer.getDrawingBufferSize(new Vector2())
    const w = Math.max(1, Math.floor(size.x))
    const h = Math.max(1, Math.floor(size.y))
    this.sceneRT.setSize(w, h)
    const resize = (c: Chain, div: number) => {
      c.a.setSize(Math.max(1, Math.floor(w / div)), Math.max(1, Math.floor(h / div)))
      c.b.setSize(Math.max(1, Math.floor(w / div)), Math.max(1, Math.floor(h / div)))
    }
    resize(this.dofHalf, 2)
    resize(this.dofQuarter, 4)
    resize(this.bloomHalf, 2)
    resize(this.bloomQuarter, 4)
    resize(this.bloomEighth, 8)
    ;(this.final.uniforms.uResolution.value as Vector2).set(w, h)
  }

  /** 動態解析度：畫面吃力時降低渲染倍率。 */
  setQuality(scale: number): void {
    const next = Math.min(1, Math.max(0.5, scale))
    if (Math.abs(next - this.quality) < 0.01) return
    this.quality = next
    this.setSize(this.width, this.height)
  }

  render(scene: Scene, camera: PerspectiveCamera, s: PostSettings, time: number): void {
    const r = this.renderer
    r.setRenderTarget(this.sceneRT)
    r.render(scene, camera)
    this.sceneDrawCalls = r.info.render.calls
    this.sceneTriangles = r.info.render.triangles

    // 景深：半解析度與四分之一解析度的模糊
    this.downsample(this.sceneRT.texture, this.sceneRT, this.dofHalf.a, this.down)
    this.blurChain(this.dofHalf, 1)
    this.downsample(this.dofHalf.a.texture, this.dofHalf.a, this.dofQuarter.a, this.down)
    this.blurChain(this.dofQuarter, 1.2)

    // bloom：擷取高亮後逐級模糊
    this.downsample(this.sceneRT.texture, this.sceneRT, this.bloomHalf.a, this.bright)
    this.blurChain(this.bloomHalf, 1)
    this.downsample(this.bloomHalf.a.texture, this.bloomHalf.a, this.bloomQuarter.a, this.down)
    this.blurChain(this.bloomQuarter, 1)
    this.downsample(this.bloomQuarter.a.texture, this.bloomQuarter.a, this.bloomEighth.a, this.down)
    this.blurChain(this.bloomEighth, 1.4)

    const u = this.final.uniforms
    u.uNear.value = camera.near
    u.uFar.value = camera.far
    u.uFocus.value = s.focus
    u.uFocusRange.value = Math.max(7, s.focus * 0.9)
    u.uMusou.value = s.musou
    u.uFlash.value = s.flash
    u.uAberration.value = s.aberration
    u.uRadial.value = s.radial
    u.uDanger.value = s.danger
    u.uBars.value = s.bars
    u.uExposure.value = s.exposure
    u.uTime.value = time
    r.setRenderTarget(null)
    this.quad.material = this.final
    this.quad.render(r)
  }

  private downsample(input: Texture, source: WebGLRenderTarget, target: WebGLRenderTarget, material: ShaderMaterial): void {
    material.uniforms.tInput.value = input
    ;(material.uniforms.uTexel.value as Vector2).set(1 / source.width, 1 / source.height)
    this.draw(material, target)
  }

  private blurChain(c: Chain, spread: number): void {
    const dir = this.blur.uniforms.uDir.value as Vector2
    this.blur.uniforms.tInput.value = c.a.texture
    dir.set(spread / c.a.width, 0)
    this.draw(this.blur, c.b)
    this.blur.uniforms.tInput.value = c.b.texture
    dir.set(0, spread / c.b.height)
    this.draw(this.blur, c.a)
  }

  private draw(material: ShaderMaterial, target: WebGLRenderTarget): void {
    this.quad.material = material
    this.renderer.setRenderTarget(target)
    this.quad.render(this.renderer)
  }
}
