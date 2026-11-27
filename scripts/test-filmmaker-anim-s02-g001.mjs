import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { physicsSignature, normalizePhysicsBakes, BAKE_HZ, BAKE_MAX_SECONDS, BAKE_MAX_BODIES } from '../src/filmmaker/physics-data.js'
import { normalizeEdit, filmEnd } from '../src/filmmaker/montage.js'
import { FilmTrackHistory } from '../src/filmmaker/node-authoring.js'

const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const rigid={id:'cup',type:'rigidbody3d',parentId:'parent',position:[0,2,0],rotation:[0,0,0],scale:[1,1,1],props:{mass:1,gravityScale:1,friction:.6,restitution:.5,linearDamping:.05,angularDamping:.2,canSleep:true}}
const staticBody={id:'floor',type:'staticbody3d',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],props:{friction:.6,restitution:.1}}
const shape=(id,parentId,size=[1,1,1])=>({id,parentId,type:'collisionshape3d',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],props:{shape:{type:'BoxShape3D',size},disabled:false}})
const physics=()=>[{id:'parent',type:'node3d',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]},rigid,shape('cup-shape','cup'),staticBody,shape('floor-shape','floor',[10,1,10])]
const samples=[{pos:[0,2,0],quat:[0,0,0,1]},{pos:[0,1,0],quat:[0,0,.70710678,.70710678]},{pos:[0,0.5,0],quat:[0,0,1,0]}]
const bake=(objects=physics())=>({id:'physics',kind:'jolt',start:0.5,duration:2/BAKE_HZ,hz:BAKE_HZ,signature:physicsSignature(objects),bodies:[{nodeId:'cup',samples:structuredClone(samples)}]})
const film=(edit=normalizeEdit())=>({edit,passes:[]})

test('PHY-01 · esquema v4 permite 60 Hz, quaternion y tiempos absolutos',()=>{
 const b=normalizePhysicsBakes([bake()])[0]
 assert.deepEqual(b.bodies[0].samples[2],samples[2]);assert.equal(b.hz,BAKE_HZ);assert.equal(b.start,.5)
 assert.equal(normalizeEdit({physicsBakes:[b]}).physicsBakes.length,1)
 assert.equal(filmEnd(film(normalizeEdit({physicsBakes:[b]}))),.533)
})
test('PHY-02 · importación legacy sin física no crea objetos sintéticos',()=>{
 assert.deepEqual(normalizePhysicsBakes(),[])
 assert.deepEqual(normalizeEdit({shots:[]}).physicsBakes,[])
 assert.deepEqual(normalizeEdit({nodeTracks:[]}).nodeTracks,[])
})
test('PHY-03 · evita múltiples tomas superpuestas y duplicados de ID',()=>{
 assert.throws(()=>normalizePhysicsBakes([bake(),bake()]),/una toma física/)
 const duplicate=bake();duplicate.bodies.push({...duplicate.bodies[0]})
 assert.throws(()=>normalizePhysicsBakes([duplicate]),/duplicado/)
})
test('PHY-04 · valida exactitud de muestras, quaternion y posición finita',()=>{
 const short=bake();short.bodies[0].samples.pop();assert.throws(()=>normalizePhysicsBakes([short]),/número de muestras/)
 const bad=bake();bad.bodies[0].samples[1].quat=[0,0,0,NaN];assert.throws(()=>normalizePhysicsBakes([bad]),/quaternion/)
 const wrong=bake();wrong.bodies[0].samples[0].pos=[0,Infinity,0];assert.throws(()=>normalizePhysicsBakes([wrong]),/posición/)
})
test('PHY-05 · no acepta otros Hz, duraciones negativas ni muestras fuera de 30 s',()=>{
 for(const n of [0,-1,BAKE_MAX_SECONDS+.5]){const b=bake();b.duration=n;assert.throws(()=>normalizePhysicsBakes([b]),/tiempo/)}
 const b=bake();b.hz=30;assert.throws(()=>normalizePhysicsBakes([b]),/tiempo/)
})
test('PHY-06 · detecta cambios de posición, jerarquía y masa física',()=>{
 const original=physics(),signature=physicsSignature(original)
 for(const key of ['position','parentId','props']){
  const next=structuredClone(original)
  if(key==='position')next[0].position[1]=1
  if(key==='parentId')next[1].parentId='other'
  if(key==='props')next[1].props.mass=2
  assert.notEqual(physicsSignature(next),signature)
 }
})
test('PHY-07 · detecta modificación de forma y visibilidad física',()=>{
 const original=physics(),signature=physicsSignature(original)
 const changed=structuredClone(original);changed[2].props.shape.size[1]=2
 assert.notEqual(physicsSignature(changed),signature)
 const hidden=structuredClone(original);hidden[3].visible=false
 assert.notEqual(physicsSignature(hidden),signature)
})
test('PHY-08 · materiales decorativos y renombrados no invalidan el bake',()=>{
 const original=physics(),signature=physicsSignature(original)
 const changed=structuredClone(original);changed[1].name='Vaso nuevo';changed[1].material='rojo'
 changed.push({id:'decor',type:'mesh',position:[0,0,0],props:{color:'#123'}})
 assert.equal(physicsSignature(changed),signature)
})
test('PHY-09 · un bake se incluye en Undo/Redo sin cambiar nodeTracks ni los clips',()=>{
 const h=new FilmTrackHistory(),before=normalizeEdit({shots:[{id:'s',pass:'cam',in:0,out:1}]}),after={...before,physicsBakes:[bake()]}
 assert.equal(h.commit(before,after),true)
 assert.equal(h.canUndo,true)
 const prev=h.undo(after);assert.deepEqual(prev.physicsBakes,[]);assert.deepEqual(prev.nodeTracks,before.nodeTracks)
 const next=h.redo(prev);assert.equal(next.physicsBakes.length,1);assert.equal(next.shots[0].id,'s')
 assert.equal(h.commit(after,after),false)
})
test('PHY-10 · estructura del bake y entrada de UI no alteran sistema de nodos ni event flow',()=>{
 const session=source('src/filmmaker/session.js'),bakeSource=source('src/filmmaker/physics-bake.js')
 assert.match(bakeSource,/NodeBodyRuntime/);assert.match(bakeSource,/world\.step\(1\/BAKE_HZ\)/)
 assert.match(bakeSource,/new THREE\.Group\(\)/)
 assert.doesNotMatch(bakeSource,/store\.project|updateObject\(|\.emit\(|\.execute\(/)
 assert.match(session,/new FilmPhysicsPose\(/);assert.match(session,/physicsBakeStatus\(\)/)
})
test('PHY-11 · propiedad exclusiva: durante montaje se retiran cuerpos baked del Player Jolt',()=>{
 const session=source('src/filmmaker/session.js')
 assert.match(session,/pl\.phys\.rigidNodes\.delete\(body\.node\)/)
 assert.match(session,/pl\.phys\.bodies\.remove\(body\.item\)/)
 assert.match(session,/pl\._bodies=pl\._bodies\.filter/)
})
test('PHY-12 · UI solo muestra pista de Física si hay bake real',()=>{
 const timeline=source('src/filmmaker/NleTimeline.vue')
 for(const token of ['data-test="physics-simulate"','data-test="physics-commit"','data-test="physics-remove"',"data-test=\"'physics-bake-'",'v-for="b in displayBakes"'])assert.ok(timeline.includes(token),token)
})
test('PHY-13 · importación de cinemática no elimina silenciosamente un bake',()=>{
 assert.match(source('src/core/state/film.js'),/film\.edit\.physicsBakes\?\.length/)
})
test('PHY-14 · cancelación y errores liberan Jolt y nunca mantienen control dual',()=>{
 const s=source('src/filmmaker/physics-bake.js')
 assert.match(s,/signal\?\.aborted/);assert.match(s,/adapter\?\.dispose\(\)/);assert.match(s,/world\?\.dispose\(\)/)
})
