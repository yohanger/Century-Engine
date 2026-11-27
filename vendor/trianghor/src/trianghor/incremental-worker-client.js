import { assertTriangHorInput } from './validate.js'

/** Mantiene un Worker para reutilizar el árbol entre horneados sin bloquear la UI. */
export function createIncrementalTriangHorWorkerClient({ makeWorker, regionCells=16, maxBytes=64*1024*1024 } = {}) {
  if (typeof makeWorker !== 'function') throw new TypeError('TriangHor necesita una fábrica de Worker')
  let worker = null
  let pending = null
  let serial = 0
  let disposed = false
  let lastStats = null
  const stopWorker = () => {
    if (!worker) return
    const current = worker
    worker = null
    current.onmessage = null
    current.onerror = null
    current.onmessageerror = null
    try {
      const termination = current.terminate()
      termination?.catch?.(() => {})
    } catch { /* Un fallo al terminar el Worker no invalida las promesas resueltas. */ }
  }
  const rejectPending = message => {
    if (!pending) return
    const active = pending
    pending = null
    active.signal?.removeEventListener('abort',active.abort)
    active.reject(new Error(message))
  }
  const ensureWorker = () => {
    if (worker) return
    worker = makeWorker()
    if (!worker || typeof worker.postMessage !== 'function' || typeof worker.terminate !== 'function') {
      worker = null
      throw new TypeError('TriangHor: Worker inválido')
    }
    worker.onmessage = ({ data }) => {
      if (!pending || data?.id !== pending.id) return
      if (data.type !== 'done' && data.type !== 'error') {
        rejectPending('TriangHor Worker: respuesta inválida')
        stopWorker()
        return
      }
      const active = pending
      pending = null
      active.signal?.removeEventListener('abort',active.abort)
      if (data.type === 'error') active.reject(new Error(data.message || 'TriangHor Worker: error'))
      else if (!data.plan || typeof data.plan !== 'object') {
        active.reject(new Error('TriangHor Worker: resultado inválido'))
        stopWorker()
      } else {
        lastStats = data.stats
        active.resolve(data.plan)
      }
    }
    worker.onerror = event => {
      rejectPending(event?.message || 'TriangHor Worker: error')
      stopWorker()
    }
    worker.onmessageerror = () => {
      rejectPending('TriangHor Worker: mensaje inválido')
      stopWorker()
    }
  }
  return Object.freeze({
    bake(input, { signal } = {}) {
      if (disposed) return Promise.reject(new Error('TriangHor Worker: cliente finalizado'))
      if (pending) return Promise.reject(new Error('TriangHor Worker ocupado'))
      if (signal?.aborted) return Promise.reject(new Error('TriangHor cancelado'))
      try {
        assertTriangHorInput(input)
        ensureWorker()
      } catch (error) {
        stopWorker()
        return Promise.reject(error)
      }
      const id = ++serial
      return new Promise((resolve,reject) => {
        const abort = () => {
          rejectPending('TriangHor cancelado')
          stopWorker()
          lastStats = null
        }
        pending = { id, resolve, reject, signal, abort }
        signal?.addEventListener('abort',abort,{once:true})
        if (signal?.aborted) { abort(); return }
        try { worker.postMessage({ type:'bake-incremental', id, input,
          options:{ regionCells, maxBytes } }) }
        catch (error) {
          rejectPending(error?.message || 'TriangHor Worker: envío fallido')
          stopWorker()
        }
      })
    },
    reset() {
      rejectPending('TriangHor Worker reiniciado')
      stopWorker()
      lastStats = null
    },
    dispose() {
      rejectPending('TriangHor Worker finalizado')
      stopWorker()
      lastStats = null
      disposed = true
    },
    get lastStats() { return lastStats },
  })
}
