const finite = (n, fallback) => Number.isFinite(n) ? n : fallback

export const CHUNK_DEFAULTS = Object.freeze({
  sceneId: '', distantSceneId: '',
  x: 0, y: 0, z: 0, width: 128, height: 0, depth: 128,
  preload: 80, distantRange: 500, unloadMargin: 30, unloadDelay: 2,
})

export function normalizeChunk(raw) {
  const result = { ...CHUNK_DEFAULTS }
  for (const key of ['sceneId', 'distantSceneId']) {
    if (typeof raw?.[key] === 'string') result[key] = raw[key]
  }
  for (const key of ['x', 'y', 'z']) result[key] = finite(raw?.[key], result[key])
  for (const key of ['width', 'depth']) result[key] = Math.max(1, finite(raw?.[key], result[key]))
  for (const key of ['height', 'preload', 'distantRange', 'unloadMargin', 'unloadDelay']) {
    result[key] = Math.max(0, finite(raw?.[key], result[key]))
  }
  result.distantRange = Math.max(result.preload, result.distantRange)
  return result
}

export function chunkDistance(chunk, point) {
  const { x, y, z, width, height, depth } = chunk
  return Math.hypot(
    Math.max(0, Math.abs(point.x - x) - width / 2),
    height ? Math.max(0, Math.abs(point.y - y) - height / 2) : 0,
    Math.max(0, Math.abs(point.z - z) - depth / 2),
  )
}

export function normalizeStreaming(raw, ownerId) {
  return {
    enabled: raw?.enabled === true,
    parallel: Math.max(1, Math.min(8, Math.trunc(finite(raw?.parallel, 1)))),
    chunks: (Array.isArray(raw?.chunks) ? raw.chunks : []).map(normalizeChunk)
      .filter(chunk => chunk.sceneId && chunk.sceneId !== ownerId)
      .map(chunk => chunk.distantSceneId === ownerId || chunk.distantSceneId === chunk.sceneId
        ? { ...chunk, distantSceneId: '' } : chunk),
  }
}

export function includeStreamingScenes(scenes, chosen) {
  const byId = new Map(scenes.map(scene => [scene.id, scene]))
  const included = new Set(chosen)
  for (const id of included) {
    const config = normalizeStreaming(byId.get(id)?.streaming, id)
    if (!config.enabled) continue
    for (const chunk of config.chunks) for (const source of [chunk.sceneId, chunk.distantSceneId]) {
      if (!source) continue
      if (!byId.has(source)) throw new Error(`Streaming: falta una escena referenciada por «${byId.get(id).name}» (${source}).`)
      included.add(source)
    }
  }
  return [...included]
}
