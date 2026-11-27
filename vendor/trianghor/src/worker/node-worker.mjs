import { parentPort } from 'node:worker_threads'
if (!parentPort) throw new Error('TriangHor Node Worker requiere worker_threads')
globalThis.self = { postMessage: (value, transfer) => parentPort.postMessage(value, transfer), onmessage: null }
await import('../trianghor/bake.worker.js')
parentPort.on('message', data => self.onmessage?.({ data }))
