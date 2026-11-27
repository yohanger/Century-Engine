// LF-TERRAIN-TRANSFORM-S02-G001 — Jolt WASM real. Ausencia de npm ci = FAIL, no SKIP.
import test from 'node:test'
import assert from 'node:assert/strict'
import { loadJolt, JoltWorld } from '../src/engine/runtime/physics/jolt.js'
const J=await loadJolt()
assert.ok(J?.JoltInterface,'El runner exige Jolt WASM real')
const terrain={id:'TT2-JOLT-TERRAIN',size:16,segments:8,n1:9,step:2,ox:3,oy:11,oz:-4,enabled:true,heights:new Float32Array(81)}
test('TT2-J01: Jolt ubica una colisión real de terreno en Y=11',()=>{
 const world=new JoltWorld(J)
 try{
   world.addTerrain(terrain)
   world.finalize()
   const h=world.raycast([3,30,-4],[0,-1,0],40,{backFaces:true})
   assert.ok(h,'El cuerpo físico debería intersecar un rayo vertical')
   assert.ok(Math.abs(h.point[1]-11)<0.05,`Jolt reportó Y=${h.point[1]}`)
 }finally{world.dispose()}
})
test('TT2-J02: Jolt no crea cuerpo al desactivar Terrain',()=>{
 const world=new JoltWorld(J)
 try{world.addTerrain({...terrain,enabled:false});assert.equal(world.terrain.length,0)}finally{world.dispose()}
})
