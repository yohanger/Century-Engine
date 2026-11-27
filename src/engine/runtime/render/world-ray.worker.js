import { buildBvh } from '../bake/geometry-bvh.js'

self.onmessage = ({ data }) => {
  try {
    const { geometry, uni, albTex, emissionTex, surfaceTex, tris } = buildBvh(data, true)
    const fields = { index: uni.index, position: uni.position, bvhBounds: uni.bvhBounds,
      bvhContents: uni.bvhContents, albedo: albTex, emission: emissionTex, surface: surfaceTex }
    const textures = Object.fromEntries(Object.entries(fields).map(([key, texture]) => [key, {
      ...texture.image, type: texture.type, format: texture.format, internalFormat: texture.internalFormat,
    }]))
    self.postMessage({ textures, tris }, Object.values(textures).map(image => image.data.buffer))
    geometry.dispose()
    uni.dispose()
    albTex.dispose()
    emissionTex.dispose()
    surfaceTex.dispose()
  } catch (error) {
    console.warn('BVH de iluminación', error)
    self.postMessage(null)
  }
}
