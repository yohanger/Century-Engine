import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerNode, getDef } from '../src/engine/runtime/nodes/registry.js'
import { nodeAnimationProperty, validatePropertyValue } from '../src/engine/runtime/anim/model.js'
import { newTimeline, upsertTimelineNodePropertyKey, normalizeTimeline, readTimelineNodeProperty } from '../src/core/timeline/model.js'

const source = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const definition = Function('registerNode', 'makeRoot', source('src/engine/runtime/nodes/terrain.js')
  .replace(/^import .*$/gm, '').replace(/export default registerNode\(/, 'const definition = registerNode(') + '\nreturn definition')(
  registerNode, () => ({root:{userData:{}}}))
const vec = (x,y,z) => ({value:[x,y,z],set(...a){this.value=a}})
function scenePair(id, position=[2,3,4], options={}) {
  const piece={id,ox:position[0],oy:position[1],oz:position[2],heights:new Float32Array([1,3,4]),
    splat:new Uint8Array([1,9,12]), mesh:{position:vec(...position)},foliage:{group:{position:vec(...position)}}}
  const obj={id,type:'terrain',name:'Pieza '+id,visible:true,active:true,props:{terrainId:id}}
  Object.defineProperty(obj,'_lfTerrainPiece',{value:piece,configurable:true})
  const moves=[]
  const physics=options.phys===false ? null : { moveTerrainPiece(pieceId, pos){moves.push([pieceId,[...pos]])} }
  const scene={terrains:[piece],host:{getObject:item=>item===id?obj:null},player:{on:true,phys:physics},
    vp:{invalidateShadows(){},requestRender(){}}}
  const root={userData:{terrainPiece:piece,terrainScene:scene}}
  return {obj,piece,scene,root,moves,physics}
}
const id='terrain.piecePosition'
const descriptor=getDef('terrain').animation[id]
function original(p) { return [p.ox,p.oy,p.oz] }

test('TERR-01 · un solo descriptor sobre el nodo Terrain original, sin segundo editor de terrenos',()=>{
  assert.strictEqual(definition.type,'terrain')
  assert.strictEqual(descriptor.kind,'vec3')
  assert.equal(Object.keys(getDef('terrain').animation).length,1)
})
test('TERR-02 · el propietario no ofrece llave cuando falta la pieza real',()=>{
  assert.equal(nodeAnimationProperty({id:'orphan',type:'terrain',props:{}},id),null)
})
test('TERR-03 · la lectura de clave sale de Terrain.ox/oy/oz, no de duplicados en props',()=>{
  const s=scenePair('pieceA',[11,20,-4]); assert.deepEqual(readTimelineNodeProperty(s.obj,id),[11,20,-4])
  assert.equal(Object.hasOwn(s.obj.props,'piecePosition'),false)
})
test('TERR-04 · persiste una clave vectorial con identidad de nodo y escena',()=>{
  const s=scenePair('pieceA'),tl=newTimeline('Animar terreno',{duration:3})
  upsertTimelineNodePropertyKey(tl,s.obj,id,'sceneA',[s.obj],1,[5,8,-12])
  const parsed=normalizeTimeline(JSON.parse(JSON.stringify(tl)))
  assert.deepEqual(parsed.tracks[0].keys[0].v,[5,8,-12])
  assert.equal(parsed.tracks[0].node,s.obj.id)
  assert.deepEqual(original(s.piece),[2,3,4])
})
test('TERR-05 · la aplicación mueve una pieza y su vegetación y actualiza el mismo BodyID nativo',()=>{
  const s=scenePair('p1'),snapshot=descriptor.capture(s.root,s.obj)
  descriptor.apply(s.root,[7,8,9],s.obj)
  assert.deepEqual(original(s.piece),[7,8,9])
  assert.deepEqual(s.piece.mesh.position.value,[7,8,9])
  assert.deepEqual(s.piece.foliage.group.position.value,[7,8,9])
  assert.deepEqual(s.moves,[['p1',[7,8,9]]])
  assert.deepEqual(s.obj.props,{terrainId:'p1'})
  descriptor.restore(s.root,snapshot,s.obj)
  assert.deepEqual(original(s.piece),[2,3,4])
  assert.deepEqual(s.moves.at(-1),['p1',[2,3,4]])
  assert.equal(s.root.userData.timelineTerrainPosition,undefined)
})
test('TERR-06 · dos piezas no comparten posición ni snapshots',()=>{
  const a=scenePair('a',[0,0,0]),b=scenePair('b',[10,0,10]),ra=descriptor.capture(a.root,a.obj),rb=descriptor.capture(b.root,b.obj)
  descriptor.apply(a.root,[1,2,3],a.obj)
  assert.deepEqual(original(b.piece),[10,0,10])
  descriptor.restore(a.root,ra,a.obj)
  descriptor.restore(b.root,rb,b.obj)
  assert.deepEqual(original(a.piece),[0,0,0]);assert.deepEqual(original(b.piece),[10,0,10])
})
test('TERR-07 · la malla, alturas y pintura no se recrean ni se modifican durante la animación',()=>{
  const s=scenePair('r'),before={heights:Array.from(s.piece.heights),splat:Array.from(s.piece.splat),mesh:s.piece.mesh,foliage:s.piece.foliage}
  const snap=descriptor.capture(s.root,s.obj)
  descriptor.apply(s.root,[-2,5,7],s.obj)
  descriptor.restore(s.root,snap,s.obj)
  assert.equal(s.piece.mesh,before.mesh);assert.equal(s.piece.foliage,before.foliage)
  assert.deepEqual(Array.from(s.piece.heights),before.heights)
  assert.deepEqual(Array.from(s.piece.splat),before.splat)
})
test('TERR-08 · si Jolt rechaza el movimiento, la pieza sigue en su posición anterior',()=>{
  const s=scenePair('q')
  s.physics.moveTerrainPiece=()=>{throw new Error('missing body')}
  assert.throws(()=>descriptor.apply(s.root,[7,8,9],s.obj),/missing body/)
  assert.deepEqual(original(s.piece),[2,3,4]);assert.equal(s.root.userData.timelineTerrainPosition,undefined)
})
test('TERR-09 · no se acepta una pieza sustituida por otra escena ni coordenadas inválidas',()=>{
  const s=scenePair('orphan')
  s.scene.terrains=[]
  assert.throws(()=>descriptor.capture(s.root,s.obj),/referencia de pieza inválida/)
  s.scene.terrains=[s.piece]
  for(const invalid of [[Infinity,0,0],[NaN,0,0],[1000001,0,0]])
    assert.throws(()=>descriptor.apply(s.root,invalid,s.obj))
  assert.throws(()=>validatePropertyValue(id,[Infinity,0,0]))
})
test('TERR-10 · editor sin Jolt mueve previsualización y restaura a las mismas instancias',()=>{
  const s=scenePair('preview',[3,0,9],{phys:false}),snap=descriptor.capture(s.root,s.obj)
  descriptor.apply(s.root,[4,2,1],s.obj)
  assert.deepEqual(original(s.piece),[4,2,1])
  descriptor.restore(s.root,snap,s.obj)
  assert.deepEqual(original(s.piece),[3,0,9])
})
test('TERR-11 · JoltWorld dispone de método de traslado sin crear otra forma ni BodyID',()=>{
  const js=source('src/engine/runtime/physics/jolt.js')
  const start=js.indexOf('  moveTerrainPiece(pieceId, position) {')
  assert.ok(start>0)
  const end=js.indexOf('\n  // ---------- nodos',start)
  assert.ok(end>start)
  const method=Function('return ({'+js.slice(start,end).trim().replace(/\n\s*$/, '')+'})')().moveTerrainPiece
  const calls=[],handle={id:{seq:4},pieceId:'p',active:true}
  const world={terrain:[handle],tmp:{r:{Set(...args){calls.push(['vec',args])}},q:{Set(...args){calls.push(['quat',args])}}},
    bi:{SetPositionAndRotation(id,r,q,activation){calls.push(['move',id,activation])}},J:{EActivation_DontActivate:6}}
  method.call(world,'p',[1,2,3])
  assert.deepEqual(calls.map(x=>x[0]),['vec','quat','move'])
  assert.strictEqual(calls[2][1],handle.id)
  assert.equal(world.terrain.length,1)
  assert.throws(()=>method.call(world,'unknown',[0,0,0]),/no disponible/)
})
test('TERR-12 · la llave pertenece al nodo Terrain seleccionado; no se usa la pieza activa global como destino',()=>{
  const inspector=source('src/components/Inspector.vue')
  const panel=source('src/components/TerrainPanel.vue')
  assert.match(inspector,/:timeline-piece-id="obj\.id"/)
  assert.match(panel,/active\.value\?\.id === properties\.timelinePieceId/)
  assert.match(panel, /timeline-position-key|terrainPositionKey/)
  assert.match(panel, /@insert="emit\('timeline-insert-key', terrainPositionKey\)"/)
  assert.doesNotMatch(panel,/upsertTimelineNodePropertyKey\(/)
})
test('TERR-13 · SceneGraph enlaza la pieza por ID no serializable y la libera al desmontar escena',()=>{
  const objects=source('src/engine/runtime/scene/objects.js')
  const terrain=source('src/engine/runtime/scene/terrain.js')
  assert.match(objects,/Object\.defineProperty\(obj, '_lfTerrainPiece', \{ value: piece, configurable: true \}\)/)
  assert.match(terrain,/delete obj\._lfTerrainPiece/)
  assert.doesNotMatch(source('src/engine/runtime/nodes/terrain.js'),/obj\.props\.piecePosition\s*=/)
})

test('TERR-14 · el autoguardado no serializa coordenadas temporales de la pieza',()=>{
  const code=source('src/engine/runtime/geometry/terrain-io.js')
    .replace(/^import .+$/gm,'').replace(/export const ioMethods/, 'const ioMethods')
  const methods=Function('bytesToB64','STRIDE', 'storedTerrainGeneratorParams','normalizeLayers',
    code+'\nreturn ioMethods')(()=> 'encoded',8,x=>x,x=>x)
  const s=scenePair('p-save',[20,1,-6]);const piece=s.piece
  Object.assign(piece,{version:1,depth:8,size:8,segments:1,segmentsZ:1,layers:[],_cache:null,
    enabled:true,visible:true,generator:null,foliage:{group:piece.foliage.group,serialize:()=>[],snapshot:()=>[]}})
  const before=descriptor.capture(s.root,s.obj)
  descriptor.apply(s.root,[99,30,10],s.obj)
  const saved=methods.serialize.call(piece)
  const history=methods.snapshot.call(piece)
  assert.deepEqual([saved.ox,saved.oy,saved.oz],[20,1,-6])
  assert.deepEqual([history.ox,history.oy,history.oz],[20,1,-6])
  assert.deepEqual(original(piece),[99,30,10])
  descriptor.restore(s.root,before,s.obj)
  assert.equal(Object.hasOwn(piece,'_timelineAuthoredPosition'),false)
})
test('TERR-15 · una misma muestra no envía movimientos redundantes a Jolt',()=>{
  const s=scenePair('p-noop',[0,0,0]);const snap=descriptor.capture(s.root,s.obj)
  descriptor.apply(s.root,[1,2,3],s.obj)
  descriptor.apply(s.root,[1,2,3],s.obj)
  assert.equal(s.moves.length,1)
  descriptor.restore(s.root,snap,s.obj)
  assert.equal(s.moves.length,2)
})
test('TERR-16 · un cierre abrupto de Play restaura mediante el mismo descriptor',()=>{
  const teardown=source('src/engine/runtime/events/play-level.js')
  assert.match(teardown,/getDef\('terrain'\)\.animation\['terrain\.piecePosition'\]\.restore\(node,/)
  assert.match(teardown,/piece\._timelineAuthoredPosition/)
  const context=scenePair('p-abort',[7,8,9]);const snap=descriptor.capture(context.root,context.obj)
  descriptor.apply(context.root,[80,4,6],context.obj)
  descriptor.restore(context.root,{position:context.piece._timelineAuthoredPosition,had:false},context.obj)
  assert.deepEqual(original(context.piece),[7,8,9])
  assert.equal(context.root.userData.timelineTerrainPosition,undefined)
  assert.deepEqual(snap.position,[7,8,9])
})
test('TERR-17 · seleccionando Terrain por Jerarquía el panel sincroniza la pieza activa',()=>{
  const ui=source('src/components/TerrainPanel.vue')
  assert.match(ui,/watch\(\(\) => properties\.timelinePieceId/)
  assert.match(ui,/selectPiece\(id\)/)
  assert.match(source('src/engine/runtime/scene/terrain.js'),/delete t\._timelineAuthoredPosition/)
})
