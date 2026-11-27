// Worker del baking: contexto WebGL2 propio (OffscreenCanvas), de modo que el trazado no compite con el hilo del motor ni con su contexto.
import * as THREE from 'three'
import { runBake } from './core.js'

let aborted = false
let lost = false
let started = false
let lastProgress = 0
const post = (m, t) => self.postMessage(m, t || [])

self.onmessage = async (e) => {
  const m = e.data
  if (m.type === 'abort') { aborted = true; return }
  if (m.type !== 'start') return
  aborted = false
  lost = false; started = false; lastProgress = 0
  let renderer = null
  try {
    let canvas
    try { canvas = new OffscreenCanvas(4, 4); renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'default' }) } catch (err) { const x = new Error('WebGL no disponible en el Worker: ' + (err.message || err)); x.unsupported = true; throw x }
    if (!renderer.capabilities.isWebGL2) { const x = new Error('WebGL2 no disponible en el Worker'); x.unsupported = true; throw x }
    // si el contexto se pierde (GPU ocupada, límite de contextos…) three falla con errores crípticos (p. ej. «reading 'trim'»): se avisa para usar el hilo principal
    canvas.addEventListener?.('webglcontextlost', (ev) => { ev.preventDefault?.(); lost = true })
    post({ type: 'ready' })
    started = true
    const res = await runBake({ renderer, input: m.input, cfg: m.cfg, aborted: () => aborted || lost, onProgress: (o) => {
      const now = performance.now()
      if (now - lastProgress >= 100 || o.fraction >= 1) { lastProgress = now; post({ type: 'progress', label: o.label, fraction: o.fraction }) }
    } })
    if (aborted || lost || renderer.getContext().isContextLost()) throw lost ? Object.assign(new Error('Contexto WebGL perdido en el Worker.'), { contextLost: true }) : new Error('Cancelado')
    const transfer = res.lightmaps.flatMap((l) => [l.half.buffer, l.uv.buffer])
    if (res.probes) transfer.push(res.probes.half.buffer)
    post({ type: 'done', res }, transfer)
  } catch (err) {
    const gl = (() => { try { return renderer?.getContext().isContextLost() } catch { return true } })()
    const contextLost = !!err.contextLost || ((lost || gl) && started) // perdido a mitad de trabajo: no es «WebGL no disponible»
    post({ type: 'error', message: err?.message || String(err), unsupported: !contextLost && !!err?.unsupported, contextLost, gpuTimeout: !!err?.gpuTimeout })
  } finally {
    try { renderer?.dispose() } catch { /* nada */ }
    // No forzamos explícitamente una pérdida de contexto: si el driver está degradado,
    // WEBGL_lose_context también puede afectar al editor que comparte la GPU.
  }
}
