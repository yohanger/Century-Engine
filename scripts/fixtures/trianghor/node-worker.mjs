// Adaptador de QA: ejecuta el MISMO Worker web de TriangHor dentro de worker_threads.
import { parentPort } from 'node:worker_threads'
globalThis.self={postMessage:(value,transfer)=>parentPort.postMessage(value,transfer),onmessage:null}
await import('../../../src/engine/runtime/render/trianghor/bake.worker.js')
parentPort.on('message',data=>self.onmessage?.({data}))
