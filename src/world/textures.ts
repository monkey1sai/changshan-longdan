import { CanvasTexture, SRGBColorSpace } from 'three'
import { createRng, TAU } from '../core/math.ts'
import { BIG_FIRES, BRAZIERS, INNER, STAIRS } from './layout.ts'

function canvas2d(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('瀏覽器不支援 Canvas 2D，無法產生貼圖')
  return [canvas, ctx]
}

function rgb(r: number, g: number, b: number, k = 1): string {
  return `rgb(${Math.round(r * k)}, ${Math.round(g * k)}, ${Math.round(b * k)})`
}

/** 城內地面：夯土、碎石、南門到主殿的石板路與焦痕。貼圖涵蓋 x、z ∈ [-INNER, INNER]。 */
export function createGroundTexture(size = 2048): CanvasTexture {
  const [canvas, ctx] = canvas2d(size, size)
  const rng = createRng(11)
  const scale = size / (INNER * 2)
  const px = (v: number) => (v + INNER) * scale

  ctx.fillStyle = '#6b5640'
  ctx.fillRect(0, 0, size, size)
  const tones = ['#5a4834', '#77624a', '#4d3d2d', '#806a50', '#5f5242']
  for (let i = 0; i < 2600; i++) {
    ctx.globalAlpha = 0.08 + rng() * 0.12
    ctx.fillStyle = tones[Math.floor(rng() * tones.length)]
    ctx.beginPath()
    ctx.arc(rng() * size, rng() * size, 8 + rng() * 60, 0, TAU)
    ctx.fill()
  }
  ctx.globalAlpha = 0.25
  for (let i = 0; i < 60000; i++) {
    ctx.fillStyle = rng() < 0.5 ? '#3f3226' : '#8a7458'
    ctx.fillRect(rng() * size, rng() * size, 2, 2)
  }

  // 石板路
  ctx.globalAlpha = 1
  const tile = 1.2
  const cell = tile * scale
  for (let z = STAIRS.maxZ; z < INNER; z += tile) {
    for (let x = -5.4; x < 5.4; x += tile) {
      const k = 0.82 + rng() * 0.3
      ctx.fillStyle = rgb(140, 131, 120, k)
      ctx.fillRect(px(x) + 1.5, px(z) + 1.5, cell - 3, cell - 3)
    }
  }
  ctx.fillStyle = '#4a4038'
  ctx.fillRect(px(-5.9), px(STAIRS.maxZ), 0.5 * scale, (INNER - STAIRS.maxZ) * scale)
  ctx.fillRect(px(5.4), px(STAIRS.maxZ), 0.5 * scale, (INNER - STAIRS.maxZ) * scale)

  // 火堆周圍的焦痕
  const scorch = (x: number, z: number, radius: number, alpha: number) => {
    const g = ctx.createRadialGradient(px(x), px(z), 0, px(x), px(z), radius * scale)
    g.addColorStop(0, `rgba(20, 14, 10, ${alpha})`)
    g.addColorStop(1, 'rgba(20, 14, 10, 0)')
    ctx.fillStyle = g
    ctx.fillRect(px(x - radius), px(z - radius), radius * 2 * scale, radius * 2 * scale)
  }
  for (const f of BIG_FIRES) scorch(f.x, f.z, 7, 0.75)
  for (const b of BRAZIERS) scorch(b.x, b.z, 1.8, 0.35)
  for (let i = 0; i < 30; i++) scorch((rng() - 0.5) * 100, (rng() - 0.5) * 100, 1 + rng() * 3, 0.25)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

/** 魏軍軍旗：深藍底、金邊、白圓中的「魏」字，自由端撕出缺口（搭配 alphaTest）。 */
export function createFlagTexture(): CanvasTexture {
  const w = 128
  const h = 256
  const [canvas, ctx] = canvas2d(w, h)
  const rng = createRng(5)
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, '#24458c')
  g.addColorStop(1, '#172f66')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#d4ad55'
  ctx.lineWidth = 8
  ctx.strokeRect(4, 4, w - 8, h - 8)
  ctx.lineWidth = 2
  ctx.strokeRect(14, 14, w - 28, h - 28)
  ctx.fillStyle = '#efe9dc'
  ctx.beginPath()
  ctx.arc(w / 2, h * 0.42, 44, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#141414'
  ctx.font = 'bold 72px "DFKai-SB", "BiauKai", "KaiTi", "Noto Serif TC", "PMingLiU", serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('魏', w / 2, h * 0.42 + 3)
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(10, 8, 6, ${0.05 + rng() * 0.1})`
    ctx.beginPath()
    ctx.arc(rng() * w, rng() * h, 3 + rng() * 14, 0, TAU)
    ctx.fill()
  }
  // 自由端（右側）的破損缺口
  ctx.globalCompositeOperation = 'destination-out'
  for (let y = 0; y < h; y += 14 + rng() * 18) {
    const depth = 6 + rng() * 22
    ctx.beginPath()
    ctx.moveTo(w, y)
    ctx.lineTo(w - depth, y + 5 + rng() * 6)
    ctx.lineTo(w, y + 12 + rng() * 10)
    ctx.fill()
  }
  ctx.globalCompositeOperation = 'source-over'
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}
