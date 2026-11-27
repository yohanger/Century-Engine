import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = relative => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8')
const source = read('src/core/project.js')
const begin = source.indexOf('export function materializePrefab(')
const end = source.indexOf('/** Normaliza la autoría', begin)
assert.ok(begin > 0 && end > begin, 'El materializador compartido debe existir en el proyecto')
let serial = 0
const uid = (prefix = 'n') => `${prefix}-${++serial}`
const remapSignalConnections = (arr, mapping) => arr.filter(c => mapping.has(c.emitterId) && mapping.has(c.receiverId))
  .map(c => ({ ...c, id: uid('sig'), emitterId: mapping.get(c.emitterId), receiverId: mapping.get(c.receiverId) }))
const migrateNodeScripts = obj => { obj.scriptIds ??= []; delete obj.scriptId; return obj }
const validateNodeTree = arr => {
  const ids = new Set(arr.map(x => x.id))
  if (ids.size !== arr.length) throw new Error('IDs duplicados')
  for (const obj of arr.slice(1)) if (!ids.has(obj.parentId)) throw new Error('Padre inválido')
}
const materializePrefab = new Function('uid', 'migrateNodeScripts', 'remapSignalConnections', 'validateNodeTree',
  `${source.slice(begin, end).replace('export function materializePrefab', 'function materializePrefab')}\nreturn materializePrefab`)(uid, migrateNodeScripts, remapSignalConnections, validateNodeTree)
class Vec {
  constructor(x, y, z) { this.values = [x,y,z] }
  applyMatrix4(m) { this.values = this.values.map((v,i) => v - (m.offset?.[i] || 0)); return this }
  toArray() { return [...this.values] }
}
const nodesText = read('src/engine/runtime/events/play-nodes.js')
const nodesMethods = new Function('THREE', 'materializePrefab', 'guardedDescriptors',
  `return (${nodesText.slice(nodesText.indexOf('export const nodesMethods =') + 'export const nodesMethods ='.length)})`)(
    { Vector3: Vec }, materializePrefab, () => ({}))
const prefab = () => ({id:'p1',name:'Personaje FPS',rev:1,objects:[
  {id:'base', name:'Jugador',type:'node3d',parentId:null,position:[0,0,0]},
  {id:'body',name:'Cuerpo',type:'characterbody3d',parentId:'base',position:[0,1,0],scriptIds:['script-move']},
  {id:'shape',name:'Capsula',type:'collisionshape3d',parentId:'body',props:{shape:{type:'CapsuleShape3D',height:2,radius:.4}}},
  {id:'camera',name:'VistaFPS',type:'camera',parentId:'body',position:[0,.65,0]},
],signalConnections:[{id:'sig-master',emitterId:'body',receiverId:'camera',signal:'ready'}]})
function rig({onAttach, onDetach, noPhysics=false}={}) {
  const project={objects:[{id:'scene-base',name:'Suelo',type:'node3d',parentId:null}],signalConnections:[],prefabs:[prefab()],activeSceneId:'scene-one'}
  const nodes=new Map([['scene-base',{_lfNodeOwner:project.objects[0],updateWorldMatrix(){},matrixWorld:{clone(){return {invert(){return {offset:[3,0,0]}}}}}}]])
  const traces={attached:[],detached:[],syncs:0,added:[],removed:[],world:{key:'unchanged'}}
  const nodeBodyRuntime = {attach:ids=>{traces.attached.push([...ids]);onAttach?.(ids)},detach:ids=>{traces.detached.push([...ids]);onDetach?.(ids)}}
  const lifecycle={beginRemoval(){},endRemoval(){},sync(){traces.syncs++}}
  const ed={nodes,nodeLifecycle:lifecycle,_syncingAll:false,
    syncObject(id){const o=project.objects.find(o=>o.id===id);nodes.set(id,{_lfNodeOwner:o});traces.added.push(id)},
    removeObject(id){nodes.delete(id);traces.removed.push(id)} }
  const play=Object.create(nodesMethods)
  Object.assign(play,{on:true,project,ed,phys:noPhysics?null:{nodeBodyRuntime,world:traces.world},_referenceSession:{},
    _nodeEnabled:()=>true,_tagLayerApi:()=>({}),_animMethodsFor:()=>({})})
  return {play, project, nodes,traces}
}

test('PRF-01: el materializador no modifica el Prefab fuente',()=>{
  const input=prefab(),before=JSON.stringify(input)
  const out=materializePrefab(input)
  assert.equal(JSON.stringify(input),before)
  assert.equal(out.objects[0].parentId,null)
  assert.equal(out.objects[2].parentId,out.objects[1].id)
  assert.equal(out.objects[1].scriptIds[0],'script-move')
  assert.equal(out.connections[0].emitterId,out.objects[1].id)
  assert.equal(out.connections[0].receiverId,out.objects[3].id)
})
test('PRF-02: dos instancias generan IDs nuevos y conexiones independientes',()=>{
  const {play,project,traces}=rig();const source=JSON.stringify(project.prefabs[0])
  const a=play._prefabInstantiate('p1'),b=play._prefabInstantiate('Personaje FPS')
  assert.notEqual(a.id,b.id)
  assert.equal(project.objects.length,9)
  assert.equal(new Set(project.objects.map(o=>o.id)).size,9)
  assert.equal(project.signalConnections.length,2)
  assert.equal(traces.attached.length,2)
  assert.equal(JSON.stringify(project.prefabs[0]),source)
  assert.equal(a.is_valid(),true)
})
test('PRF-03: la instancia física se registra sin reemplazar el mundo Jolt',()=>{
  const {play,traces}=rig();const existing=play.phys
  const handle=play._prefabInstantiate('p1')
  assert.ok(traces.attached[0].includes(handle.id))
  assert.equal(play.phys,existing)
  assert.equal(play._prefabDestroy(handle),true)
  assert.equal(play.phys,existing)
  assert.equal(traces.detached.length,1)
})
test('PRF-04: destruir solo la instancia indicada invalida sus referencias',()=>{
  const {play,project,nodes}=rig();const a=play._prefabInstantiate('p1'),b=play._prefabInstantiate('p1')
  assert.equal(play._prefabDestroy(a),true)
  assert.equal(a.is_valid(),false)
  assert.equal(b.is_valid(),true)
  assert.equal(nodes.has(a.id),false)
  assert.equal(project.objects.length,5)
  assert.equal(project.signalConnections.length,1)
  assert.equal(play._prefabDestroy(a.id),false)
})
test('PRF-05: STOP elimina todas las instancias transitorias sin tocar la autoría',()=>{
  const {play,project}=rig();const original=JSON.stringify(project.prefabs[0])
  play._prefabInstantiate('p1');play._prefabInstantiate('p1')
  play._prefabClearRuntime()
  assert.equal(project.objects.length,1)
  assert.deepEqual(project.signalConnections,[])
  assert.equal(JSON.stringify(project.prefabs[0]),original)
})
test('PRF-06: el cambio de escena puede limpiar antes del guardado',()=>{
  const {play,project}=rig();play._prefabInstantiate('p1')
  play._prefabClearRuntime()
  const saved=JSON.parse(JSON.stringify(project.objects))
  assert.deepEqual(saved,[{id:'scene-base',name:'Suelo',type:'node3d',parentId:null}])
  assert.match(nodesText,/_prefabClearRuntime\(\) \/\/ antes de que switchScene guarde/)
})
test('PRF-07: la posición mundial se transforma en coordenadas del padre',()=>{
  const {play,project}=rig();const h=play._prefabInstantiate('p1',{parent:'scene-base',position:[8,2,4]})
  const root=project.objects.find(o=>o.id===h.id)
  assert.equal(root.parentId,'scene-base')
  assert.deepEqual(root.position,[5,2,4])
})
test('PRF-08: errores de creación realizan rollback completo',()=>{
  const {play,project,nodes,traces}=rig({onAttach:()=>{throw new Error('Jolt falló')}})
  assert.throws(()=>play._prefabInstantiate('p1'),/Jolt falló/)
  assert.equal(project.objects.length,1)
  assert.equal(project.signalConnections.length,0)
  assert.equal(nodes.size,1)
  assert.equal(traces.detached.length,1)
})
test('PRF-09: un Prefab físico requiere mundo Jolt activo',()=>{
  const {play,project}=rig({noPhysics:true})
  assert.throws(()=>play._prefabInstantiate('p1'),/Jolt activo/)
  assert.equal(project.objects.length,1)
})
test('PRF-10: no se permite anidar dentro de instancias dinámicas',()=>{
  const {play}=rig();const p=play._prefabInstantiate('p1')
  assert.throws(()=>play._prefabInstantiate('p1',{parent:p}),/anidar/)
})
test('PRF-11: Prefab con eventos editoriales aún no soportados se rechaza sin efectos',()=>{
  const {play,project}=rig();project.prefabs[0].objects.push({id:'event-x',type:'event',parentId:'base'})
  assert.throws(()=>play._prefabInstantiate('p1'),/no compatible/)
  assert.equal(project.objects.length,1)
})
test('PRF-12: la API pública y la limpieza de Play reutilizan el mismo propietario',()=>{
  assert.match(read('src/engine/runtime/events/interpreter.js'),/prefabs: \{\s*instantiate:/)
  assert.match(read('src/engine/runtime/events/play-host.js'),/prefabInstantiate: alive/)
  const playText=read('src/engine/runtime/events/play.js')
  assert.match(playText,/this\.ed\.nodeLifecycle\.stop\(\)\s*(?:this\._sceneClearRuntime\(\)\s*)?this\._prefabClearRuntime\(\)/)
  assert.match(read('src/engine/runtime/physics/node-bodies.js'),/attach\(ids\) \{/)
  assert.match(read('src/engine/runtime/physics/node-spatial.js'),/start\(onlyIds = null\)/)
})
