import type { Material } from 'three'

/**
 * 讓實例化網格支援逐實例受擊白閃：幾何需提供 instanceFlash 屬性（0..1），
 * 在自發光項加上白光，搭配 bloom 會有明顯的閃光。
 */
export function withInstanceFlash<T extends Material>(material: T): T {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float instanceFlash;\nvarying float vFlash;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlash = instanceFlash;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFlash;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.45, 0.4, 0.32) * vFlash * vFlash;',
      )
  }
  material.customProgramCacheKey = () => 'instance-flash'
  return material
}
