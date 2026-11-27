// G001: política de despachos GPU pequeños; sin Three.js ni DOM, comprobable en Node.
// El límite de píxeles evita que una sola fila de un atlas grande monopolice el driver.
export const GPU_TILE_MIN = 16
export const GPU_TILE_START = 64
export const GPU_TILE_MAX = 512
export const GPU_TILE_TARGET_MS = 6
export const GPU_TILE_TIMEOUT_MS = 1200

export function tileShape(width, pixels) {
  const budget = Math.max(GPU_TILE_MIN, Math.min(GPU_TILE_MAX, Math.floor(pixels)))
  const w = Math.max(1, Math.min(width, Math.floor(Math.sqrt(budget))))
  return { width: w, height: Math.max(1, Math.floor(budget / w)) }
}

export function nextGpuBudget(pixels, elapsedMs, targetMs = GPU_TILE_TARGET_MS) {
  if (!(elapsedMs > 0) || !Number.isFinite(elapsedMs)) return GPU_TILE_MIN
  const factor = Math.max(0.5, Math.min(1.5, targetMs / elapsedMs))
  return Math.max(GPU_TILE_MIN, Math.min(GPU_TILE_MAX, Math.round(pixels * factor)))
}

export function estimatedTraceMemoryBytes(size) {
  // Aproximación conservadora: G-buffer x2, ping-pong x2, lectura pos/nor/raw x3,
  // más reserva para textura temporal. No incluye el BVH o el viewport.
  return size * size * 4 * 4 * 8
}

/** Un fence no bloquea JS con gl.finish(). La espera se fracciona entre mensajes del Worker. */
export async function waitForGpu(gl, { cancelled = () => false, lost = () => false, sleep = (ms) => new Promise(r => setTimeout(r, ms)), timeoutMs = GPU_TILE_TIMEOUT_MS, now = () => performance.now() } = {}) {
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
  if (!sync) throw new Error('No se pudo crear la sincronización GPU del horneado.')
  const t0 = now()
  try {
    gl.flush()
    for (;;) {
      if (cancelled()) throw new Error('Cancelado')
      if (lost() || gl.isContextLost()) throw Object.assign(new Error('Se perdió el contexto gráfico durante el horneado.'), { contextLost: true })
      const state = gl.clientWaitSync(sync, 0, 0)
      if (state === gl.ALREADY_SIGNALED || state === gl.CONDITION_SATISFIED) return now() - t0
      if (state === gl.WAIT_FAILED) throw new Error('Falló la sincronización GPU del horneado.')
      if (now() - t0 > timeoutMs) throw Object.assign(new Error('Una carga GPU del horneado excedió el tiempo seguro. Se detuvo antes de publicar resultados.'), { gpuTimeout: true })
      await sleep(4)
    }
  } finally { gl.deleteSync(sync) }
}
