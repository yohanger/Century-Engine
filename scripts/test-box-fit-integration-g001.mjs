// Contrato integral S01: fuente real de SceneGraph, Inspector, forma y persistencia.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {newPhysicsShape,validatePhysicsShape} from '../src/engine/runtime/physics/shapes.js'
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8')

test('BOX-I-01: cajas legadas son manuales y opt-in booleano es válido',()=>{
  const legacy={type:'BoxShape3D',size:[1,1,1]}
  assert.equal(validatePhysicsShape(legacy),true)
  assert.equal(legacy.autoFit,undefined)
  assert.equal(validatePhysicsShape({...legacy,autoFit:true}),true)
  assert.equal(validatePhysicsShape({...legacy,autoFit:false}),true)
  assert.throws(()=>validatePhysicsShape({...legacy,autoFit:'yes'}),/booleano/)
  assert.deepEqual(newPhysicsShape('box'),legacy)
})
test('BOX-I-02: no altera el recurso Shape3D de otras formas ni TriMesh',()=>{
  for(const kind of ['sphere','capsule','mesh']) assert.equal(validatePhysicsShape(newPhysicsShape(kind)),true)
})
test('BOX-I-03: el alta solo habilita ajuste nuevo con geometría bajo cuerpo',()=>{
  const code=read('src/core/state/objects.js')
  assert.match(code,/obj\.props\.shape\.autoFit === undefined && hasBoxFitGeometry/)
  assert.match(code,/obj\.props\.shape\.autoFit = true/)
  assert.match(code,/fitBoxShapeNow/)
  assert.match(code,/updateObject\(id, \{position:result.position/)
  assert.match(code,/autoFit: false/)
})
test('BOX-I-04: el SceneGraph actualiza autoFit con geometría ya sincronizada',()=>{
  const s=read('src/engine/runtime/scene/objects.js')
  assert.match(s,/_refreshAutoFitBoxes\(\)/)
  assert.match(s,/fitCollisionBoxFromScene\(objects, this\.nodes, o\.id\)/)
  assert.match(s,/getDef\(o\.type\)\.update\(node,o\)/)
  assert.match(s,/if \(!this\._syncingAll\)/)
  assert.match(read('src/engine/runtime/scene-graph.js'),/this\._refreshAutoFitBoxes\(\)/)
})
test('BOX-I-05: Jolt usa el mismo tamaño persistido y posición de la forma',()=>{
  const jolt=read('src/engine/runtime/physics/node-bodies.js')
  assert.match(jolt,/world\._boxShape\(\.\.\.resource\.size\)/)
  assert.match(jolt,/inverse\.clone\(\)\.multiply\(node\.matrixWorld\)/)
  assert.match(jolt,/new J\.RotatedTranslatedShapeSettings\(v, q, one\.shape\)/)
})
test('BOX-I-06: Inspector permite recalcular, activar seguimiento y tamaño manual',()=>{
 const ui=read('src/components/Inspector.vue')
 assert.match(ui,/Autoajuste a geometría/)
 assert.match(ui,/setBoxAutoFit/)
 assert.match(ui,/fitBoxShapeNow\(obj\.id\)/)
 assert.match(ui,/key === 'size' \? \{ autoFit: false \}/)
})
test('BOX-I-07: sin geometría falla explícitamente y nunca fuerza el ajuste',()=>{
 const src=read('src/engine/runtime/physics/box-fit-editor.js')
 const store=read('src/core/state/objects.js')
 assert.match(src,/if \(!bounds\) return null/)
 assert.match(store,/no se encontró geometría válida/)
})
test('BOX-I-08: no fabrica cuerpos ni reescala el nodo',()=>{
 const src=read('src/engine/runtime/scene/objects.js')
 assert.doesNotMatch(src,/_refreshAutoFitBoxes\([\s\S]*?world\._body/)
 assert.doesNotMatch(read('src/engine/runtime/physics/box-fit-editor.js'),/\.scale\s*=|scale\.set\(/)
})
