// Jolt WASM verdadero: requiere npm ci y constata contactos en un rectángulo, sin mocks.
import test from 'node:test'
import assert from 'node:assert/strict'
import {Terrain} from '../src/engine/runtime/geometry/terrain.js'
import {loadJolt,JoltWorld} from '../src/engine/runtime/physics/jolt.js'
const J=await loadJolt()
assert.ok(J?.JoltInterface,'Jolt WASM real obligatorio')
test('TE3-J01 · contacto Jolt con ampliación Z asimétrica y elevación Y',()=>{
 const t=new Terrain(16,8)
 const world=new JoltWorld(J)
 try{
  assert.ok(t.extendEdge('pz',4))
  t.setOffset(3,-4,10)
  world.addTerrain(t);world.finalize()
  const hit=world.raycast([3,40,-4],[0,-1,0],80,{backFaces:true})
  assert.ok(hit,'No existe colisión para Terrain rectangular')
  assert.ok(Math.abs(hit.point[1]-10)<0.1,`Altura Jolt inesperada ${hit.point[1]}`)
 }finally{world.dispose();t.dispose()}
})
