// G001: único ciclo de vida del Worker de horneado. El renderer del editor no se transfiere.
export function runBakeWorkerJob({ createWorker, input, transfer, cfg, onProgress = () => {}, signal, viewportCanvas }) {
  const worker = createWorker()
  return new Promise((resolve, reject) => {
    let finished = false
    const release = () => {
      signal?.removeEventListener('abort', onAbort)
      viewportCanvas?.removeEventListener?.('webglcontextlost', onViewportLost)
      worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null
      worker.terminate()
    }
    const settle = (error, value) => {
      if (finished) return
      finished = true
      release()
      if (error) reject(error)
      else resolve(value)
    }
    const onAbort = () => settle(new Error('Cancelado'))
    const onViewportLost = () => settle(Object.assign(new Error('El contexto WebGL del editor se perdió durante el horneado. Se canceló y se conservaron los resultados anteriores.'), { contextLost: true }))
    if (signal?.aborted) { onAbort(); return }
    signal?.addEventListener('abort', onAbort, { once: true })
    viewportCanvas?.addEventListener?.('webglcontextlost', onViewportLost)
    worker.onmessage = ({ data: m }) => {
      if (finished || !m || typeof m !== 'object') return
      if (m.type === 'progress') onProgress({ label: String(m.label || 'Horneando…'), fraction: Math.max(0, Math.min(1, Number(m.fraction) || 0)) })
      else if (m.type === 'done') settle(null, m.res)
      else if (m.type === 'error') settle(Object.assign(new Error(String(m.message || 'El horneado falló.')), { unsupported: !!m.unsupported, contextLost: !!m.contextLost, gpuTimeout: !!m.gpuTimeout }))
    }
    worker.onerror = (e) => settle(new Error(e?.message || 'Falló el Worker de horneado.'))
    worker.onmessageerror = () => settle(new Error('No se pudieron recibir datos del Worker de horneado.'))
    try { worker.postMessage({ type: 'start', input, cfg }, transfer) }
    catch (error) { settle(error instanceof Error ? error : new Error(String(error))) }
  })
}
