import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerNode, getDef } from '../src/engine/runtime/nodes/registry.js'
import { nodeAnimationProperty } from '../src/engine/runtime/anim/model.js'
import { getSpecies, normalizeCritter } from '../src/engine/runtime/critters/index.js'
import { CritterCluster } from '../src/engine/runtime/critters/cluster.js'
import { newTimeline, upsertTimelineNodePropertyKey, normalizeTimeline } from '../src/core/timeline/model.js'

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8')
const definition = Function('registerNode','THREE','makeRoot','applyBase','lineMat','hitSphere','getSpecies','normalizeCritter',
  read('src/engine/runtime/nodes/critters.js').replace(/^import .+$/gm,'')
    .replace(/export default registerNode\(/, 'const definition = registerNode(')
    .replace(/^export \{[^}]+\}[^\n]*$/gm,'')+'\nreturn definition'
)(registerNode,{},()=>{},()=>{},()=>{},()=>{},getSpecies,normalizeCritter)
const authored = () => ({...definition.create(),id:'firefly-1',type:'critters',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],active:true,visible:true})
const scalar = value => ({value,clone(){return scalar(this.value)},copy(v){this.value=v.value}})
const root = () => ({userData:{visual:{scale:scalar(4)},iconMat:{color:{set(value){this.value=value}}},ring:{material:{color:{set(value){this.value=value}}},scale:{set(x,y,z){this.value=[x,y,z]}}}},position:scalar(5),quaternion:scalar(6),visible:true,updateMatrixWorld(){}})
function realSync() {
  const code=read('src/engine/runtime/critters/system.js')
  const start=code.indexOf('  sync(force = false) {'); assert.ok(start>0)
  const begin=code.indexOf('{', start),end=(()=>{let depth=0;for(let i=begin;i<code.length;i++){if(code[i]==='{')depth++;else if(code[i]==='}'&&! --depth)return i+1}throw Error('sync end')})()
  return Function('CritterCluster',`return ({${code.slice(start,end)}}).sync`)(CritterCluster)
}
const sync=realSync()
function system(objects,roots) { return {opts:{objects:()=>objects,nodes:()=>roots},clusters:new Map()} }
test('CR-01 · 11 parámetros de la especie Firefly están inscritos en el registro único',()=>{
  const params=getSpecies('firefly').params
  assert.equal(params.length,11)
  assert.equal(Object.keys(getDef('critters').animation).length,11)
  for(const p of params) assert.ok(nodeAnimationProperty(authored(),`critters.${p.key}`),p.key)
})
test('CR-02 · las llaves usan ParamForm existente sin añadir botones a comandos de eventos',()=>{
  const inspector=read('src/components/Inspector.vue')
  const form=read('src/components/ParamForm.vue')
  assert.match(inspector, /timeline-prefix="critters"/)
  assert.match(inspector, /@insert-key="inspectorInsertKey"/)
  assert.match(form, /timelinePrefix && timelineKeyable\?\./)
  assert.match(form, /@insert="emit\('insert-key'/)
  assert.match(form, /\.row:has\(> \.property-key\)/)
  assert.match(form, /timelinePrefix: \{ type: String, default: '' \}/)
})
test('CR-03 · claves de número y color persisten por nodo y escena',()=>{
  const node=authored(), tl=newTimeline('Criaturas',{duration:5})
  for(const [prop,value] of [['count',18],['radius',11.5],['color','#22aaff']]) {
    const result=upsertTimelineNodePropertyKey(tl,node,`critters.${prop}`,'scene-1',[node],1,value)
    assert.equal(result.key.v,value)
  }
  const restored=normalizeTimeline(JSON.parse(JSON.stringify(tl)))
  assert.deepEqual(restored.tracks.map(tr=>tr.keys[0].v),[18,11.5,'#22aaff'])
})
test('CR-04 · parámetros aplicados solo a la instancia, preservan modelo y pose de otra pista',()=>{
  const node=authored(), visual=root(),before=structuredClone(node)
  const spec=nodeAnimationProperty(node,'critters.radius'),snap=spec.capture(visual,node)
  spec.apply(visual,19,node)
  assert.equal(visual.userData.timelineVisualFields.props.radius,19)
  assert.deepEqual(visual.userData.ring.scale.value,[19,1,19])
  assert.equal(visual.position.value,5)
  assert.equal(visual.quaternion.value,6)
  assert.equal(visual.userData.visual.scale.value,4)
  assert.deepEqual(node,before)
  spec.restore(visual,snap,node)
  assert.equal(visual.userData.timelineVisualFields,undefined)
  assert.deepEqual(visual.userData.ring.scale.value,[8,1,8])
})
test('CR-05 · simulador consume directamente valores temporales del nodo y conserva author',()=>{
  const node=authored(),visual=root(),roots=new Map([[node.id,visual]]),rt=system([node],roots)
  sync.call(rt)
  assert.equal(rt.clusters.get(node.id).agents.length,40)
  const value=nodeAnimationProperty(node,'critters.count'),before=structuredClone(node)
  const snap=value.capture(visual,node)
  value.apply(visual,14,node)
  sync.call(rt)
  assert.equal(rt.clusters.get(node.id).agents.length,14)
  assert.equal(rt.clusters.get(node.id).p.count,14)
  assert.deepEqual(node,before)
  value.restore(visual,snap,node)
  sync.call(rt)
  assert.equal(rt.clusters.get(node.id).agents.length,40)
})
test('CR-06 · parámetros independientes de instancia no se mezclan con otras criaturas',()=>{
  const a=authored(),b={...authored(),id:'firefly-2'}
  const ra=root(),rb=root(),rt=system([a,b],new Map([[a.id,ra],[b.id,rb]]))
  sync.call(rt)
  nodeAnimationProperty(a,'critters.brightness').apply(ra,2.25,a)
  sync.call(rt)
  assert.equal(rt.clusters.get(a.id).p.brightness,2.25)
  assert.equal(rt.clusters.get(b.id).p.brightness,1)
})
test('CR-07 · campos no permitidos por especie quedan excluidos',()=>{
  const node=authored();node.props.species='hypothetical'
  assert.equal(nodeAnimationProperty(node,'critters.radius'),null)
})
test('CR-08 · cambios de escena retiran el cluster y no escriben en el proyecto',()=>{
  const node=authored(),rt=system([node],new Map([[node.id,root()]]))
  sync.call(rt)
  assert.equal(rt.clusters.size,1)
  rt.opts.objects=()=>[]
  sync.call(rt)
  assert.equal(rt.clusters.size,0)
  assert.equal(node.props.count,40)
})
test('CR-09 · SceneGraph entrega el mapa de nodos actual al propietario existente',()=>{
  assert.match(read('src/engine/runtime/scene-graph.js'), /objects: \(\) => this\.host\.project\?\.objects, nodes: \(\) => this\.nodes/)
  assert.match(read('src/engine/runtime/critters/system.js'), /this\.opts\.nodes\?\.\(\)\?\.get\(o\.id\)/)
})
