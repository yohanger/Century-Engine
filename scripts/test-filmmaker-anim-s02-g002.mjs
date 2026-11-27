// QA S02-G002 · conversión de movimiento FilmMaker a Timeline, seek y validaciones antes de mutar proyecto.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeTimeline, timelineEnd } from '../src/core/timeline/model.js'
import { sampleBakeTrack, slerpQuat } from '../src/core/timeline/physics.js'
import { convertFilmMotion, validateFilmMotion } from '../src/filmmaker/montage-motion.js'
import { physicsSignature } from '../src/filmmaker/physics-data.js'

const obj = (id, type = 'primitive') => ({ id, name: 'Nodo', type, position: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1], props: {} })
const objects = [obj('vaso'), obj('rb', 'rigidbody3d'), obj('shape', 'collisionshape3d'), obj('suelo', 'staticbody3d')]
objects[2].parentId = 'rb'; objects[2].props = { shape: { type: 'BoxShape3D', size: [1,1,1] } }
const makeBake = (o = objects) => ({
  id: 'bake', kind: 'jolt', start: 0.5, duration: 2 / 60, hz: 60,
  signature: physicsSignature(o), bodies: [{ nodeId: 'rb', samples: [
    { pos: [0, 1, 0], quat: [0,0,0,1] },
    { pos: [0, 0.7, 0], quat: [0,0,Math.SQRT1_2,Math.SQRT1_2] },
    { pos: [0, 0.4, 0], quat: [0,0,1,0] },
  ] }],
})
const manual = () => ({ id: 'fn1', nodeId: 'vaso', name: 'Vaso', muted: false,
  properties: [{ id: 'p1', prop: 'position', keys: [
    { id: 'k1', t: 0, v: [0,1,0], ease: 'bezier', bz: [0.42, 0, 0.58, 1] },
    { id: 'k2', t: 1, v: [0,0,0], ease: 'inOut' },
  ] }],
})
const film = (nodeTracks = [manual()], physicsBakes = [makeBake()]) => ({actor:{objectId:''},edit:{nodeTracks,physicsBakes}})

test('INT-01 · pistas convertidas por ID, sin referencias por nombre', () => {
  const tracks = convertFilmMotion(film(), objects)
  assert.deepEqual(tracks.map(t => [t.kind,t.node]), [['node','vaso'], ['bake','rb']])
})
test('INT-02 · curva Bézier preservada en normalización nativa', () => {
  const tr = normalizeTimeline({name:'Cine',tracks:convertFilmMotion(film(),objects)})
  assert.equal(tr.tracks[0].keys[0].ease, 'bezier')
  assert.deepEqual(tr.tracks[0].keys[0].bz, [0.42,0,0.58,1])
})
test('INT-03 · muestras y duración persistentes', () => {
  const tr = normalizeTimeline({duration:0.1,tracks:convertFilmMotion(film(), objects)})
  assert.equal(tr.tracks[1].samples.length, 3)
  assert.equal(tr.tracks[1].hz, 60)
  assert.ok(timelineEnd(tr) >= 1)
})
test('INT-04 · seek inverso sin estado incremental', () => {
  const track = convertFilmMotion(film([], [makeBake()]), objects)[0]
  const x = sampleBakeTrack(track, 0.5 + 1/60)
  sampleBakeTrack(track, 0.5 + 2/60)
  assert.deepEqual(sampleBakeTrack(track, 0.5 + 1/60), x)
})
test('INT-05 · antes del bake no hay pose; después conserva última muestra', () => {
  const tr = convertFilmMotion(film([], [makeBake()]), objects)[0]
  assert.equal(sampleBakeTrack(tr,0.49),undefined)
  assert.deepEqual(sampleBakeTrack(tr,50).pos,[0,0.4,0])
})
test('INT-06 · quaternion opuesto no produce giro en SLERP', () => {
  assert.deepEqual(slerpQuat([0,0,0,1],[0,0,0,-1],0.5), [0,0,0,1])
})
test('INT-07 · quaternion intermedio unitario', () => {
  const q = slerpQuat([0,0,0,1],[0,0,1,0],0.5)
  assert.ok(Math.abs(Math.hypot(...q)-1)<1e-10)
  assert.ok(q[2] > 0.7 && q[3] > 0.7)
})
test('INT-08 · no reasignar un nodo huérfano por nombre', () => {
  assert.throws(() => validateFilmMotion(film(),objects.filter(x=>x.id!=='vaso')),/no existe el nodo/)
})
test('INT-09 · física no admite tipo equivocado', () => {
  const changed = objects.map(o=>o.id==='rb'?{...o,type:'primitive'}:o)
  assert.throws(()=> validateFilmMotion(film([], [makeBake(changed)]), changed),/RigidBody3D/)
})
test('INT-10 · firma física desactualizada bloquea importación', () => {
  const wrong = objects.map(o=>o.id==='suelo'?{...o,position:[2,0,0]}:o)
  assert.throws(()=> validateFilmMotion(film([], [makeBake()]), wrong),/desactualizado/)
})
test('INT-11 · modificación de colliders vía overrides también invalida', () => {
  assert.throws(()=> validateFilmMotion(film([], [makeBake()]),objects,{suelo:{position:[5,0,0]}}),/desactualizado/)
})
test('INT-12 · no doble controlador manual + bake en el mismo nodo', () => {
  const a=manual();a.nodeId='rb'
  const o = objects.map(x=>x.id==='rb'?{...x,type:'primitive'}:x)
  assert.throws(()=> validateFilmMotion(film([a],[makeBake(o)]),o),/RigidBody3D|incompatible/)
})
test('INT-13 · desautoriza tracks manuales en RigidBody3D', () => {
  const tr=manual();tr.nodeId='rb'
  assert.throws(()=>validateFilmMotion(film([tr],[]),objects),/incompatible/)
})
test('INT-14 · rechaza muestras de distinto tamaño y NaN', () => {
  const tr=convertFilmMotion(film([], [makeBake()]),objects)[0]
  assert.throws(()=>normalizeTimeline({tracks:[{...tr,samples:tr.samples.slice(1)}]}),/tamaño/)
  tr.samples[0].quat[0]=NaN
  assert.throws(()=>normalizeTimeline({tracks:[tr]}),/quaternion/)
})
test('INT-15 · no crea pistas de movimientos vacíos', () => {
  assert.deepEqual(convertFilmMotion(film([],[]),objects),[])
})
test('INT-16 · normalización conserva mute de animación manual', () => {
  const tr=manual();tr.muted=true
  assert.equal(convertFilmMotion(film([tr],[]),objects)[0].muted,true)
})
test('INT-17 · integración del Player obliga control cinemático y restauración', () => {
  const src=readFileSync(new URL('../src/engine/runtime/events/play-timeline.js',import.meta.url),'utf8')
  for (const snippet of ['_tlBakeBegin', '_tlBakeRelease', 'EMotionType_Kinematic','EMotionType_Dynamic', 'this._tlBakeOwners']) assert.ok(src.includes(snippet),snippet)
})
test('INT-18 · importación valida antes de aplicar overrides y usa rollback', () => {
  const src=readFileSync(new URL('../src/core/state/film.js',import.meta.url),'utf8')
  assert.ok(src.indexOf('validateFilmMotion(film, p.objects')<src.indexOf('updateObject(id'))
  assert.match(src,/catch \(error\)/)
  assert.match(src,/await db\.deleteAsset/)
})
