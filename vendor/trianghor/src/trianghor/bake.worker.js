import { computeTriangHor } from './core.js'
import { createIncrementalTriangHor } from './incremental.js'

let incremental = null
self.onmessage = ({ data }) => {
  if (data?.type !== 'bake' && data?.type !== 'bake-incremental') return
  try {
    let plan, stats
    if (data.type === 'bake-incremental') {
      if (!incremental) incremental = createIncrementalTriangHor(data.options)
      plan = incremental.compute(data.input)
      stats = incremental.lastStats
    } else plan = computeTriangHor(data.input)
    const transfer = plan.index ? [plan.index.buffer] : []
    self.postMessage({ type:'done', id:data.id, plan, ...(stats ? {stats} : {}) }, transfer)
  } catch(error) {
    self.postMessage({ type:'error', id:data.id, message:error?.message || String(error) })
  }
}
