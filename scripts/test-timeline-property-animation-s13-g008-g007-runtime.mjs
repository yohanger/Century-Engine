// Integración real: requiere node_modules del proyecto (Three.js y dependencias oficiales).
import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { newTimeline, newTrack, newKey, normalizeTimeline } from '../src/core/timeline/model.js'
import { timelineMethods } from '../src/engine/runtime/events/play-timeline.js'
import { lightMethods } from '../src/engine/runtime/events/play-light.js'
import { nodesMethods } from '../src/engine/runtime/events/play-nodes.js'
import { animMethods } from '../src/engine/runtime/events/play-anim.js'
import { TimelinePreview } from '../src/core/timeline/preview.js'

const SCENE = 'scene-luz'
function fixture() {
  const obj = { id: 'light-1', name: 'Lámpara', type: 'light', active: true, visible: true,
    color: '#224466', light: { type: 'omni', energy: 1, style: 'steady' }, position: [0, 0, 0], rotation: [0,0,0], scale: [1,1,1] }
  const node = new THREE.Object3D()
  node._lfNodeOwner = obj
  node.userData.light = new THREE.PointLight(obj.color, Math.PI)
  const world = {
    project: { activeSceneId: SCENE, objects: [obj], timelines: [], scenes: [{ id: SCENE, name: 'Escena' }] },
    ed: { nodes: new Map([[obj.id, node]]) },
    rt: { toast() {} }, vp: { requestRender() {} },
    game: { report(error) { throw error }, run() { return { done: Promise.resolve() } }, log() {} },
    state: {}, control: true, lookControl: true, on: true, hasPlayer: false,
    _referenceSession: {}, _cameraSource: null,
  }
  Object.assign(world, timelineMethods, lightMethods, nodesMethods, animMethods)
  world._tlInit(); world._lightInit(); world._animInit()
  return { world, obj, node }
}
function timeline(id, prop, values, opts = {}) {
  const t = newTrack('node', { node: 'light-1', byId: true, sceneId: SCENE, prop, name: prop,
    keys: values.map(([time, value], i) => newKey('node', time, { id: id + '-key-' + i, v: value, ease: 'linear' })) })
  return normalizeTimeline(newTimeline(id, { id, duration: 2, lockPlayer: false, loop: !!opts.loop,
    tracks: [t] }))
}
function start(world, tl) { world.project.timelines.push(tl); world.timelinePlay(tl.id); return world.tls.at(-1) }

test('G007-R01 · energía se aplica en el frame efectivo y se restaura en Stop', () => {
  const {world,obj,node} = fixture()
  const run = start(world, timeline('a','light.energy',[[0,1],[2,3]]))
  run.update(1)
  assert.ok(Math.abs(node.userData.light.intensity / Math.PI - 2) < 1e-8)
  assert.equal(obj.light.energy,1)
  run.stop()
  assert.ok(Math.abs(node.userData.light.intensity / Math.PI - 1) < 1e-8)
  assert.equal(world._tlChannels.size,0)
})
test('G007-R02 · scripts de luz rechazan escritura incompatible, pero siguen disponibles tras Stop', () => {
  const {world,obj} = fixture()
  const run = start(world,timeline('a','light.energy',[[0,1],[2,3]]))
  const light = world._lightHandle(obj)
  assert.throws(()=>{ light.energy=8 },/reservada/)
  assert.throws(()=>light.fadeTo({energy:8},1),/reservada/)
  light.color='#abcdef'
  assert.equal(light.color,'#abcdef')
  run.stop()
  light.energy=8
  assert.equal(light.energy,8)
})
test('G007-R03 · Clip no reemplaza intensidad reservada; aplica otro canal sin conflicto', () => {
  const {world,obj,node} = fixture()
  const run = start(world,timeline('a','light.energy',[[0,1],[2,3]]))
  const host = world._animHost({ obj }, 'Animación')
  host.apply({prop:'light.energy',path:''},8)
  assert.ok(Math.abs(node.userData.light.intensity/Math.PI - 1)<1e-8)
  host.apply({prop:'position',path:''},[1,2,3])
  assert.deepEqual(node.position.toArray(),[1,2,3])
  run.stop()
})
test('G007-R04 · segunda Timeline sobre mismo canal se rechaza antes de escribir', () => {
  const {world,node} = fixture()
  const a = start(world,timeline('a','light.energy',[[0,1],[2,3]]))
  world.project.timelines.push(timeline('b','light.energy',[[0,4],[2,6]]))
  assert.throws(()=>world.timelinePlay('b'),/canal ocupado/)
  assert.ok(Math.abs(node.userData.light.intensity/Math.PI-1)<1e-8)
  assert.equal(world.tls.length,1)
  a.stop()
})
test('G007-R05 · canales distintos de luz pueden ejecutarse simultáneamente', () => {
  const {world,obj} = fixture()
  const a = start(world,timeline('a','light.energy',[[0,1],[2,3]]))
  const b = start(world,timeline('b','light.color',[[0,'#224466'],[2,'#ffffff']]))
  a.update(1);b.update(1)
  assert.equal(world._tlChannels.size,2)
  assert.ok(Math.abs(world._lightHandle(obj).energy-2)<1e-8)
  a.stop();b.stop()
  assert.equal(world._tlChannels.size,0)
  assert.equal(world._lightHandle(obj).color,'#224466')
})
test('G007-R06 · pausa, seek y loop no duplican snapshots', () => {
  const {world,obj} = fixture()
  const r=start(world,timeline('a','light.energy',[[0,1],[2,3]],{loop:true}))
  r.update(1);r.pause();r.update(0.5)
  assert.equal(r.time,1)
  r.seek(.5);assert.ok(Math.abs(world._lightHandle(obj).energy-1.5)<1e-8)
  r.resume();r.update(2)
  assert.equal(world._tlChannels.size,1)
  r.stop();assert.equal(world._lightHandle(obj).energy,1)
})
test('G007-R07 · eliminar nodo invalida canal sin restaurar referencia zombi', () => {
  const {world,obj} = fixture()
  const r=start(world,timeline('a','light.energy',[[0,1],[2,3]]))
  world.ed.nodes.delete(obj.id); world.project.objects=[]
  world._tlChannelSweep()
  assert.equal(world._tlChannels.size,0)
  r.stop()
})
test('G007-R08 · cambiar escena descarta el snapshot anterior', () => {
  const {world} = fixture()
  const r=start(world,timeline('a','light.energy',[[0,1],[2,3]]))
  world.project.activeSceneId='scene-distinta'
  world._tlChannelSweep()
  assert.equal(world._tlChannels.size,0)
  r.stop()
})
test('G007-R09 · color se interpola y se restaura sin cambiar documento del proyecto', () => {
  const {world,obj,node}=fixture()
  const r=start(world,timeline('c','light.color',[[0,'#000000'],[2,'#ffffff']]))
  r.update(1)
  assert.equal('#'+node.userData.light.color.getHexString(),'#808080')
  r.stop()
  assert.equal(world._lightHandle(obj).color,'#224466')
  assert.equal(obj.color,'#224466')
})
test('G007-R10 · Preview muestra luz tipada y restaura la escena editorial', () => {
  const {world,obj,node}=fixture()
  const cam=new THREE.PerspectiveCamera(70,1,0.05,1000)
  const editor={ nodes:world.ed.nodes, vp:{camera:cam,persp:cam,controls:{enabled:true},
    container:{clientWidth:1280,clientHeight:720}, requestRender(){} }, _updateBoxes(){}, _updateGizmoMode(){} }
  const preview=new TimelinePreview({getEditor:()=>editor,getObjects:()=>[obj],worldMatrix:()=>node.matrixWorld,
    getSceneId:()=>SCENE})
  const tl=timeline('a','light.energy',[[0,1],[2,3]])
  preview.apply(tl,1)
  assert.ok(Math.abs(node.userData.light.intensity/Math.PI-2)<1e-8)
  assert.equal(obj.light.energy,1)
  preview.stop()
  assert.ok(Math.abs(node.userData.light.intensity/Math.PI-1)<1e-8)
})
