import { assertTriangHorInput } from './validate.js'

export function requestTriangHorBake(input, { makeWorker, signal, onProgress } = {}) {
  if (typeof makeWorker !== 'function') return Promise.reject(new Error('TriangHor necesita un Worker'))
  if (signal?.aborted) return Promise.reject(new Error('TriangHor cancelado'))
  try { assertTriangHorInput(input) } catch (error) { return Promise.reject(error) }
  return new Promise((resolve, reject) => {
    let worker
    let settled = false
    const abort = () => done(new Error('TriangHor cancelado'))
    function done(error, value) {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', abort)
      if (worker) {
        worker.onmessage = null
        worker.onerror = null
        worker.onmessageerror = null
        try {
          const termination = worker.terminate()
          termination?.catch?.(() => {})
        } catch { /* La finalización no debe dejar una solicitud pendiente. */ }
      }
      if (error) reject(error)
      else resolve(value)
    }
    try {
      worker = makeWorker()
      if (!worker || typeof worker.postMessage !== 'function' || typeof worker.terminate !== 'function')
        throw new TypeError('TriangHor: Worker inválido')
      worker.onmessage = ({ data }) => {
        if (settled || data?.id !== 1) return
        if (data.type === 'done') {
          if (!data.plan || typeof data.plan !== 'object') done(new Error('TriangHor Worker: resultado inválido'))
          else done(null, data.plan)
        }
        else if (data.type === 'error') done(new Error(data.message || 'TriangHor falló'))
        else if (data.type === 'progress') {
          try { onProgress?.(data.progress) }
          catch (error) { done(error) }
        } else done(new Error('TriangHor Worker: respuesta inválida'))
      }
      worker.onerror = event => done(new Error(event?.message || 'TriangHor Worker: error'))
      worker.onmessageerror = () => done(new Error('TriangHor Worker: datos inválidos'))
      signal?.addEventListener('abort', abort, { once: true })
      if (signal?.aborted) { abort(); return }
      worker.postMessage({ id: 1, type: 'bake', input })
    } catch (error) { done(error) }
  })
}
