// Esquema persistente de simulaciones físicas en el montaje. Módulo puro (sin Jolt/Three).
export const BAKE_HZ = 60
export const BAKE_MAX_SECONDS = 30
export const BAKE_MAX_BODIES = 16
const finite = Number.isFinite
const vec = (value, size, label) => {
  if (!Array.isArray(value) || value.length !== size || !value.every(v => typeof v === 'number' && finite(v))) throw new Error(`Physics Bake: ${label} inválido`)
  return [...value]
}

/** Incluye todas las formas, cuerpos y sus ancestros: la autoría invalidará bakes al modificar colisiones o transforms. */
export function physicsSignature(objects) {
  const byId = new Map(objects.map(o => [o.id, o]))
  const ids = new Set()
  for (const obj of objects) if (['rigidbody3d', 'staticbody3d', 'collisionshape3d'].includes(obj.type)) {
    let o = obj, visited = new Set()
    while (o && !visited.has(o.id)) { visited.add(o.id); ids.add(o.id); o = byId.get(o.parentId) }
  }
  return JSON.stringify(objects.filter(o => ids.has(o.id)).map(o => ({ id:o.id, parentId:o.parentId || '', type:o.type, visible:o.visible !== false,
    position:o.position || [0,0,0], rotation:o.rotation || [0,0,0], scale:o.scale || [1,1,1], props:o.props || {} })))
}

export function normalizePhysicsBakes(bakes = []) {
  if (!Array.isArray(bakes) || bakes.length > 1) throw new Error('Physics Bake: una toma física activa por montaje en S02-G001')
  return bakes.map(b => {
    if (!b || b.kind !== 'jolt' || !Array.isArray(b.bodies) || !b.bodies.length || b.bodies.length > BAKE_MAX_BODIES) throw new Error('Physics Bake: toma no válida')
    if (!finite(b.start) || b.start < 0 || !finite(b.duration) || b.duration <= 0 || b.duration > BAKE_MAX_SECONDS || b.hz !== BAKE_HZ) throw new Error('Physics Bake: tiempo o frecuencia inválidos')
    if (typeof b.signature !== 'string' || b.signature.length > 1000000) throw new Error('Physics Bake: firma inválida')
    const count = Math.round(b.duration * b.hz) + 1
    if (Math.abs(count - 1 - b.duration * b.hz) > 1e-4) throw new Error('Physics Bake: muestras no alineadas')
    const ids = new Set()
    return { id: String(b.id || 'physics'), kind:'jolt', start:b.start, duration:b.duration, hz:BAKE_HZ, signature:b.signature,
      bodies:b.bodies.map(body => {
        if (!body || typeof body.nodeId !== 'string' || !body.nodeId.trim() || ids.has(body.nodeId)) throw new Error('Physics Bake: nodeId duplicado o inválido')
        ids.add(body.nodeId)
        if (!Array.isArray(body.samples) || body.samples.length !== count) throw new Error('Physics Bake: número de muestras inválido')
        return { nodeId:body.nodeId, samples:body.samples.map(sample => ({ pos:vec(sample.pos,3,'posición'), quat:vec(sample.quat,4,'quaternion') })) }
      }) }
  })
}

