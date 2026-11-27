// Nether Film Maker · horneado de física. Reutiliza JoltWorld/NodeBodyRuntime sobre nodos
// Three.js AISLADOS: no ejecuta Player, scripts, eventos ni escribe en scene.lfproj.
import * as THREE from 'three'
import { loadJolt, JoltWorld } from '../engine/runtime/physics/jolt.js'
import { NodeBodyRuntime } from '../engine/runtime/physics/node-bodies.js'
import { physicsNodePlan } from '../engine/runtime/physics/node-body-plan.js'

import { BAKE_HZ, BAKE_MAX_SECONDS, BAKE_MAX_BODIES, normalizePhysicsBakes, physicsSignature } from './physics-data.js'
const EPS = 1e-7
const finite = Number.isFinite

/** Muestra poses locales sin Jolt: todo seek, incluso inverso, depende solo del tiempo absoluto. */
export function samplePhysicsBake(bake, T) {
  if (!bake || T < bake.start || !finite(T)) return new Map()
  const t = Math.max(0, Math.min(bake.duration, T - bake.start)) * bake.hz
  const i = Math.min(Math.floor(t), bake.bodies[0].samples.length - 1), j = Math.min(i + 1, bake.bodies[0].samples.length - 1)
  const a = t - i, out = new Map()
  for (const body of bake.bodies) {
    const x = body.samples[i], y = body.samples[j]
    const q = new THREE.Quaternion(...x.quat).slerp(new THREE.Quaternion(...y.quat), a).normalize()
    out.set(body.nodeId, { pos: x.pos.map((n,k) => n + (y.pos[k] - n) * a), quat:q.toArray() })
  }
  return out
}

/** Overlay de solo lectura sobre Three.js. Conserva la pose base al salir o hacer seek. */
export class FilmPhysicsPose {
  constructor(editor, objects, bakes) { this.editor=editor; this.objects=objects; this.bakes=bakes||[]; this.saved=new Map(); this.warnings=new Set() }
  restore() {
    for (const {node,pos,quat} of this.saved.values()) { node.position.fromArray(pos); node.quaternion.fromArray(quat); node.updateMatrixWorld(true) }
    this.saved.clear(); this.editor?.vp?.requestRender?.()
  }
  at(T) {
    this.restore()
    const b=this.bakes[0]
    if (!b || b.signature !== physicsSignature(this.objects)) { if(b)this.warnings.add('Physics Bake desactualizado: vuelve a simular'); return [...this.warnings] }
    for (const [id,pose] of samplePhysicsBake(b,T)) {
      const data=this.objects.find(o=>o.id===id), node=this.editor?.nodes?.get(id)
      if (!node || data?.type !== 'rigidbody3d') { this.warnings.add(`Nodo físico inexistente: ${id}`); continue }
      this.saved.set(id,{node,pos:node.position.toArray(),quat:node.quaternion.toArray()})
      node.position.fromArray(pose.pos); node.quaternion.fromArray(pose.quat); node.updateMatrixWorld(true)
    }
    this.editor?.vp?.requestRender?.()
    return [...this.warnings]
  }
}

/** Simulación controlada con el mismo motor del Player. Devuelve una toma sin mutar nodos ni datos originales. */
export async function simulatePhysicsBake({ objects, nodes, duration = 3, start = 0, signal, onProgress, driver = null }) {
  if (!Array.isArray(objects) || !nodes?.get) throw new Error('Physics Bake: escena no disponible')
  if (!finite(duration) || duration <= 0 || duration > BAKE_MAX_SECONDS || !finite(start) || start < 0) throw new Error('Physics Bake: intervalo fuera de límites')
  const steps = Math.round(duration * BAKE_HZ)
  if (steps < 1 || Math.abs(steps / BAKE_HZ - duration) > EPS) throw new Error('Physics Bake: duración debe corresponder a pasos de 1/60 s')
  const plans = physicsNodePlan(objects)
  const dynamics = plans.filter(p => p.dynamic)
  if (!dynamics.length) throw new Error('Physics Bake: se necesita al menos un RigidBody3D con CollisionShape3D activa')
  if (dynamics.length > BAKE_MAX_BODIES) throw new Error(`Physics Bake: máximo ${BAKE_MAX_BODIES} cuerpos dinámicos`)
  const ids = new Set(), byId = new Map(objects.map(o => [o.id, o]))
  for (const p of plans) for (const obj of [p.obj,...p.shapes]) {
    let parent = obj, seen = new Set()
    while (parent) {
      if (seen.has(parent.id)) throw new Error('Physics Bake: ciclo de jerarquía')
      seen.add(parent.id); ids.add(parent.id); parent=byId.get(parent.parentId)
    }
  }
  // Los nodos proxy son matrices Three independientes; ni el gizmo ni el editor son manipulados.
  const ghost = new Map(), root = new THREE.Group()
  for (const obj of objects) if (ids.has(obj.id)) {
    const orig=nodes.get(obj.id)
    if (!orig) throw new Error(`Physics Bake: falta el nodo ${obj.id} en SceneGraph`)
    const n=new THREE.Group();n.name=obj.name||obj.id;n.userData.id=obj.id
    n.position.copy(orig.position);n.quaternion.copy(orig.quaternion);n.scale.copy(orig.scale)
    ghost.set(obj.id,n)
  }
  for (const obj of objects) if (ghost.has(obj.id)) (ghost.get(obj.parentId)||root).add(ghost.get(obj.id))
  root.updateMatrixWorld(true)
  // El plan y sus adaptadores nunca ven los demás objetos (eventos, scripts, áreas o personajes).
  const physical=objects.filter(o=>ids.has(o.id))
  let world=null, adapter=null
  try {
    if(signal?.aborted) throw new Error('Physics Bake cancelado')
    world=driver?.world || new JoltWorld(await loadJolt())
    const play={ phys:world,project:{objects:physical},ed:{nodes:ghost},colliders:[],_bodies:[],_bodyAdd(id,config) {
      const node=ghost.get(id);node.updateWorldMatrix(true,false)
      const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();node.matrixWorld.decompose(p,q,s)
      const item=world.dynamics().add({pos:p,quat:q,center:new THREE.Vector3(),size:new THREE.Vector3(1,1,1)},config)
      this._bodies.push({id,node,item});return item
    } }
    adapter=new NodeBodyRuntime(play,31);adapter.start()
    if (play._bodies.length !== dynamics.length) throw new Error('Physics Bake: faltan cuerpos Jolt')
    const records=dynamics.map(p=>({nodeId:p.obj.id,samples:[]}))
    const ordered=[...play._bodies].sort((a,b)=>{const depth=n=>{let d=0;for(let x=n.parent;x&&x!==root;x=x.parent)d++;return d};return depth(a.node)-depth(b.node)})
    const sample=()=>{
      // Primero actualizar padres físicos para obtener Transform local correcto en jerarquías.
      for (const b of ordered) {
        const pose=world.dynamics().pose(b.item), parent=b.node.parent
        parent.updateWorldMatrix(true,false)
        const pos=parent.worldToLocal(pose.pos.clone()),pq=parent.getWorldQuaternion(new THREE.Quaternion()).invert()
        const q=pq.multiply(pose.quat).normalize()
        b.node.position.copy(pos);b.node.quaternion.copy(q);b.node.updateMatrixWorld(true)
      }
      for (const r of records) {const n=ghost.get(r.nodeId);r.samples.push({pos:n.position.toArray(),quat:n.quaternion.toArray()})}
    }
    sample();onProgress?.(0)
    for(let i=1;i<=steps;i++){
      if(signal?.aborted)throw new Error('Physics Bake cancelado')
      world.step(1/BAKE_HZ);sample()
      if(i%30===0||i===steps){onProgress?.(i/steps);await new Promise(resolve=>setTimeout(resolve,0))}
    }
    return normalizePhysicsBakes([{id:'physics',kind:'jolt',start,duration,hz:BAKE_HZ,signature:physicsSignature(objects),bodies:records}])[0]
  } finally {
    try{adapter?.dispose()}finally{if(!driver?.world)world?.dispose()}
  }
}
