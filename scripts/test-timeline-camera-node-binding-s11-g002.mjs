import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { reactive } from 'vue'
import * as THREE from 'three'
import { addTimelineCameraBinding, addTimelineClip, editTimelineClip, timelineClipSnapTime, newTimeline, newTrack, newKey, normalizeTimeline } from '../src/core/timeline/model.js'
import { createProjectData, splitProject, ensureFs } from '../src/core/project.js'
import { TimelinePreview } from '../src/core/timeline/preview.js'
import { createTimelinePointerDrag } from '../src/core/timeline/pointer-drag.js'
import { evalTimelineCamera } from '../src/engine/runtime/timeline/eval.js'
import { TimelineRunner } from '../src/engine/runtime/timeline/player.js'
import { timelineMethods } from '../src/engine/runtime/events/play-timeline.js'
import { readPackage, writePackage } from '../src/engine/runtime/package/format.js'

const camera = { id: 'scene-camera', type: 'camera', name: 'Cámara', props: { fov: 52, profile: 'qa' } }
const sceneId = 'scene-original'
const options = { sceneId }
const binding = (t, node = camera.id, ease = 'cut') => newKey('camera', t, { mode: 'camera3d', node, sceneId, ease })
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} ≠ ${b}`)

test('el drop crea/reutiliza por ID, conserva claves fuente y evita colisiones de tiempo', () => {
  const timeline = newTimeline()
  const first = addTimelineCameraBinding(timeline, camera, 0, options)
  assert.equal(first.key.mode, 'camera3d')
  assert.equal(first.key.node, camera.id)
  assert.equal(addTimelineCameraBinding(timeline, { ...camera, name: 'Renombrada' }, 0, options).key, first.key)
  assert.equal(addTimelineCameraBinding(timeline, camera, 2, options).track, first.track)
  assert.equal(timeline.tracks.length, 1)
  const second = { ...camera, id: 'other' }
  assert.throws(() => addTimelineCameraBinding(timeline, second, 0, { sceneId, trackId: first.track.id }), /Ya hay una clave/)
  assert.equal(addTimelineCameraBinding(timeline, second, 4, { sceneId, trackId: first.track.id }).key.node, second.id)
  assert.throws(() => addTimelineCameraBinding(timeline, { ...camera, type: 'node3d' }, 1, options), /inválido/)
  first.track.locked = true
  assert.throws(() => addTimelineCameraBinding(timeline, camera, 1, options), /Desbloquea/)
  first.track.locked = false
  addTimelineClip(timeline, first.track.id, first.key.id)
  assert.throws(() => addTimelineCameraBinding(timeline, camera, 1, { sceneId, trackId: first.track.id }), /usa clips/)
})

test('guardar y reabrir project.json conserva Camera3D y los modos históricos', () => {
  const project = createProjectData('QA cámara', 'empty')
  const timeline = newTimeline()
  const track = addTimelineCameraBinding(timeline, camera, 0, options).track
  track.keys.push(newKey('camera', 2, { mode: 'node', node: 'Cámara por nombre' }),
    newKey('camera', 3), newKey('camera', 4, { mode: 'player' }))
  project.timelines = [timeline]
  const { meta } = splitProject(project)
  const [saved] = ensureFs(JSON.parse(JSON.stringify(meta))).timelines
  assert.deepEqual(saved.tracks[0].keys.map(k => [k.mode, k.node]), [
    ['camera3d', camera.id], ['node', 'Cámara por nombre'], ['free', ''], ['player', ''],
  ])
  assert.equal(saved.tracks[0].keys[0].sceneId, sceneId)
  assert.equal(normalizeTimeline(saved).tracks[0].keys[0].id, track.keys[0].id)
})

test('el formato del Player conserva los IDs de escena y nodo al escribir y leer el paquete', async () => {
  const timeline = newTimeline()
  addTimelineCameraBinding(timeline, camera, 0, options)
  const project = createProjectData('QA paquete', 'empty')
  project.timelines = [timeline]
  project.objects = [camera]
  const { meta, scene } = splitProject(project)
  const bytes = await writePackage({ data: meta, scenes: [{ id: sceneId, name: 'Toma', data: scene }], files: new Map() })
  const packageData = await readPackage(bytes)
  const key = packageData.game.timelines[0].tracks[0].keys[0]
  assert.equal(packageData.game.game.startScene, key.sceneId)
  assert.equal((await packageData.scene(key.sceneId)).objects[0].id, key.node)
  assert.equal(key.mode, 'camera3d')
})

function sceneFixture() {
  const parent = new THREE.Group(), node = new THREE.Group(), other = new THREE.Group()
  parent.position.set(1, 0, 0)
  parent.rotation.y = Math.PI / 2
  node.position.set(0, 1, 2)
  parent.add(node)
  other.position.set(99, 0, 0)
  const objects = [{ ...camera, id: 'other' }, { ...camera, props: { ...camera.props } }, { id: 'parent', type: 'node3d' }]
  const nodes = new Map([[camera.id, node], ['other', other], ['parent', parent]])
  const timeline = newTimeline('Live', { tracks: [
    newTrack('camera', { keys: [binding(0)] }),
    newTrack('node', { node: 'parent', byId: true, keys: [newKey('node', 0, { v: [10, 0, 0] }), newKey('node', 2, { v: [20, 0, 0] })] }),
  ] })
  return { node, parent, objects, nodes, timeline }
}

test('Preview toma la cámara por ID después de mover el padre, usa FOV del nodo y restaura', () => {
  const { parent, node, objects, nodes, timeline } = sceneFixture()
  const persp = new THREE.PerspectiveCamera()
  const vp = { persp, camera: persp, controls: { enabled: true }, container: { clientWidth: 800, clientHeight: 450 }, requestRender() {} }
  const warnings = []
  const preview = new TimelinePreview({ getEditor: () => ({ vp, nodes }), getObjects: () => objects, getSceneId: () => sceneId,
    worldMatrix: () => assert.fail('Una clave Camera3D usa el nodo activo'), onWarning: message => warnings.push(message) })
  preview.apply(timeline, 1)
  near(vp.camera.position.x, 17)
  near(vp.camera.position.y, 1)
  near(vp.camera.quaternion.angleTo(node.getWorldQuaternion(new THREE.Quaternion())), 0)
  assert.equal(vp.camera.fov, 52)
  objects[1].name = 'Toma renombrada'; objects[1].props.fov = 63
  preview.apply(timeline, 2)
  assert.equal(vp.camera.fov, 63)
  near(vp.camera.position.x, 22)
  nodes.delete(camera.id)
  preview.apply(timeline, 1); preview.apply(timeline, 1)
  assert.equal(vp.camera, persp)
  assert.equal(warnings.length, 1)
  nodes.set(camera.id, node)
  preview.apply(timeline, 1)
  assert.equal(vp.camera, preview.camera)
  preview.stop()
  assert.equal(vp.camera, persp)
  assert.equal(vp.controls.enabled, true)
  near(parent.position.x, 1)
})

test('host de PlayMode/Player usa ID y transformación animada sin convertir ausencias en poses libres', () => {
  const { objects, nodes, timeline } = sceneFixture()
  const warnings = [], poses = []
  // PlayMode incluye timelineMethods en su prototipo; el host de prueba debe cumplir ese contrato.
  const self = Object.assign(Object.create(timelineMethods), {
    project: { objects, activeSceneId: sceneId }, ed: { nodes }, state: {}, _tlWarned: new Set(),
    rt: { toast: message => warnings.push(message) },
    _find: () => assert.fail('Camera3D nunca busca por nombre'),
  })
  assert.equal(typeof self._tlAutomationStop, 'function')
  assert.equal(typeof self._tlAutomationSync, 'function')
  const host = self._tlHost()
  host.camera = pose => poses.push(pose)
  const runner = new TimelineRunner(timeline, host)
  runner.seek(1)
  near(poses.at(-1).pos[0], 17)
  assert.equal(poses.at(-1).fov, 52)
  assert.equal(poses.at(-1).profile, 'qa')
  self.project.activeSceneId = 'copia-con-los-mismos-ids'
  runner.seek(1)
  assert.equal(poses.at(-1), null)
  assert.equal(warnings.length, 1)
  self.project.activeSceneId = sceneId
  runner.seek(1)
  objects[1].type = 'node3d'
  runner.seek(1); runner.seek(1)
  assert.equal(poses.at(-1), null)
  assert.equal(warnings.length, 2)
  objects[1].type = 'camera'
  runner.seek(1)
  near(poses.at(-1).pos[0], 17)
  runner.stop()
  assert.equal(poses.at(-1), null)
})

test('cortes, interpolación y mezcla toleran una Camera3D ausente sin usar su pose de reserva', () => {
  const free = t => newKey('camera', t, { pos: [t, 0, 0], ease: 'linear' })
  const legacy = newKey('camera', 4, { mode: 'node', node: 'nombre antiguo', pos: [7, 0, 0] })
  const track = newTrack('camera', { keys: [free(0), binding(2, 'absent', 'linear'), legacy, free(6)] })
  assert.equal(evalTimelineCamera(track, 0, () => null).pos[0], 0)
  assert.equal(evalTimelineCamera(track, 1, () => null), null)
  assert.equal(evalTimelineCamera(track, 3, () => null), null)
  assert.equal(evalTimelineCamera(track, 4, () => null).pos[0], 7)
  const timeline = newTimeline('Montaje', { tracks: [track] })
  const first = addTimelineClip(timeline, track.id, track.keys[0].id)
  const second = addTimelineClip(timeline, track.id, legacy.id)
  editTimelineClip(timeline, track.id, second.id, { start: 1 })
  assert.equal(evalTimelineCamera(track, 1.5, () => null), null)
  assert.equal(evalTimelineCamera(track, first.start, () => null).pos[0], 0)
})

test('clic y cancelación mantienen un clip reactivo intacto; arrastre efectivo pausa y confirma una vez', () => {
  const panel = readFileSync(new URL('../src/components/TimelinePanel.vue', import.meta.url), 'utf8')
  const start = panel.indexOf('function clipDragDown(')
  const source = panel.slice(start, panel.indexOf('\nfunction ', start + 1))
  const timeline = reactive(newTimeline('QA', { tracks: [newTrack('camera', {
    keys: [newKey('camera', 0), newKey('camera', 2)],
  })] }))
  const track = timeline.tracks[0]
  const clip = addTimelineClip(timeline, track.id, track.keys[0].id)
  const initialClips = track.clips
  const handlers = new Map()
  const gestures = createTimelinePointerDrag({
    addEventListener: (name, fn) => handlers.set(name, fn),
    removeEventListener: name => handlers.delete(name),
  })
  let pauses = 0, commits = 0, selected = 0
  const playback = { pause() { pauses++ } }
  const handler = Function('tl', 'guardedTrack', 'root', 'pickClip', 'playback', 'zoom', 'editMode',
    'timelineDrag', 'editTimelineClip', 'timelineClipSnapTime', 'snap', 'ph', 'commit', 'bump', source + ';return clipDragDown')(
    { value: timeline }, () => true, {}, () => selected++, playback, { value: 70 }, { value: 'mix' },
    gestures, editTimelineClip, timelineClipSnapTime, { value: 0 }, { value: 5 }, () => commits++, () => {},
  )
  const press = { pointerId: 1, button: 0, buttons: 1, clientX: 100, clientY: 0, preventDefault() {} }
  handler(press, track, clip)
  handlers.get('pointermove')({ ...press, clientX: 104 })
  handlers.get('pointermove')({ ...press, pointerId: 2, clientX: 190 })
  handlers.get('pointermove')({ ...press, buttons: 0, clientX: 190 })
  handlers.get('pointerup')({ ...press, buttons: 0, clientX: 118 })
  assert.equal(selected, 1)
  assert.equal(pauses + commits, 0)
  assert.equal(track.clips, initialClips)
  assert.equal(handlers.size, 0)

  handler(press, track, clip)
  handlers.get('pointermove')({ ...press, clientX: 170 })
  assert.equal(pauses, 1)
  assert.equal(track.clips[0].start, 1)
  handlers.get('pointercancel')(press)
  assert.equal(track.clips, initialClips)
  assert.equal(commits, 0)

  handler(press, track, clip)
  handlers.get('pointermove')({ ...press, clientX: 170 })
  handlers.get('pointerup')({ ...press, buttons: 0, clientX: 170 })
  assert.equal(track.clips[0].start, 1)
  assert.equal(commits, 1)
  assert.equal(handlers.size, 0)
})

test('un movimiento real de evento actualiza su orden y conserva eventos ya disparados', () => {
  const track = newTrack('commands', { keys: ['primero', 'segundo', 'tercero'].map((name, index) =>
    newKey('commands', index, { name, list: [{ code: 'comment' }] })) })
  const fired = []
  const runner = new TimelineRunner(newTimeline('QA', { tracks: [track] }), { commands: (_list, { name }) => fired.push(name) })
  runner.update(0.5)
  track.keys[0].t = 3
  track.keys[1].t = 2.5
  track.keys[2].t = 1
  runner.refreshEditedEvents()
  runner.update(3)
  assert.deepEqual(fired, ['primero', 'tercero', 'segundo'])
})
