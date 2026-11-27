// CA-005 · Ejecución temporal independiente de la selección editorial.
// Se ejercita TimelinePreview.apply real con propietarios simulados; Electron requiere QA local.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
function realMethod(name, dependencies = {}) {
  const source = read('src/core/timeline/preview.js')
  const index = source.indexOf(`  ${name}(`)
  assert.ok(index >= 0, `No se encontró TimelinePreview.${name}`)
  const opening = source.indexOf(') {', index) + 2
  let level = 0, end = -1
  for (let i = opening; i < source.length; i++) {
    if (source[i] === '{') level++
    else if (source[i] === '}' && --level === 0) { end = i + 1; break }
  }
  assert.ok(end > opening)
  const declaration = source.slice(index, end).trim().replace(`${name}(`, `function ${name}(`)
  return Function(...Object.keys(dependencies), `${declaration};return ${name}`)(...Object.values(dependencies))
}
const sample = (track, time) => [...(track.keys || [])].reverse().find(key => key.t <= time)?.v
const animatedCameraPose = realMethod('animatedCameraPose')
const apply = realMethod('apply', {
  evalTimelineNode: sample,
  evalTimelineCamera: track => track.explicitPose ?? null,
  sampleBakeTrack: () => null,
  nodeAnimationProperty: (obj, prop) => prop.startsWith('light.') && obj.type === 'light' ? {} : prop === 'camera.main' && obj.type === 'camera' ? {
    ownerType: 'camera', read: camera => camera.props.main === true,
    capture: root => ({ previous: root.userData.timelineMain }),
    apply: (root, value) => { root.userData.timelineMain = value },
  } : null,
  DEG: Math.PI / 180,
})
function fixture({ cameraMain = null, muted = false } = {}) {
  const objects = [
    { id: 'c1', type: 'camera', props: { main: cameraMain === 'c1', fov: 70 } },
    { id: 'c2', type: 'camera', props: { main: cameraMain === 'c2', fov: 70 } },
    { id: 'node-a', type: 'model', position: [0, 0, 0] },
    { id: 'node-b', type: 'text', position: [0, 0, 0] },
    { id: 'light-a', type: 'light', light: { energy: 0 } },
    { id: 'light-b', type: 'light', light: { energy: 0 } },
  ]
  const nodes = new Map(objects.map(obj => [obj.id, {
    userData: obj.type === 'light' ? { light: { intensity: 0, color: { set(value) { this.value = value } } }, refreshLightEffects() {} } : {},
    position: { set(...xyz) { this.xyz = xyz } }, updateMatrixWorld() {},
  }]))
  const tracks = [
    { kind: 'node', byId: true, sceneId: 'scene', node: 'node-a', prop: 'position', keys: [{ t: 0, v: [1, 2, 3] }] },
    { kind: 'node', byId: true, sceneId: 'scene', node: 'node-b', prop: 'position', keys: [{ t: 0, v: [4, 5, 6] }] },
    { kind: 'node', byId: true, sceneId: 'scene', node: 'light-a', prop: 'light.energy', keys: [{ t: 0, v: 2 }] },
    { kind: 'node', byId: true, sceneId: 'scene', node: 'light-b', prop: 'light.color', keys: [{ t: 0, v: '#336699' }], muted },
    { kind: 'node', byId: true, sceneId: 'scene', node: 'c2', prop: 'camera.main', keys: [{ t: 3.967, v: true }] },
  ]
  const editorCamera = { kind: 'editor' }, camera = {
    position: { set(...xyz) { this.xyz = xyz } }, quaternion: { copy(q) { this.q = q } },
    updateProjectionMatrix() {},
  }
  const vp = { camera: editorCamera, persp: editorCamera, controls: { enabled: true },
    container: { clientWidth: 800, clientHeight: 450 }, requestRender() {} }
  const editor = { vp, nodes, _updateGizmoMode() {} }
  const host = {
    getSceneId: () => 'scene', getObjects: () => objects, getEditor: () => editor,
    nodeOf(id) { const o = objects.find(value => value.id === id); return o ? { o, n: nodes.get(id) } : null },
    resolve(key) { const found = this.nodeOf(key.node); return found ? { pos: [7, 8, 9], quat: {}, fov: 70, id: key.node } : null },
    restoreNodes() {}, updateMotionPath() {}, saved: new Map(),
    savePose(id) { if (!this.saved.has(id)) this.saved.set(id, { custom: new Map() }) },
    animatedCameraPose, camera, cameraOn: false,
    restoreCamera() { this.cameraOn = false; vp.camera = this.previousCamera || vp.persp; vp.controls.enabled = true },
  }
  return { objects, nodes, timeline: { tracks }, host, vp, camera, editorCamera }
}

test('CA005-01 · dos nodos y dos luces aplican pistas sin ninguna selección', () => {
  const f = fixture()
  apply.call(f.host, f.timeline, 1)
  assert.deepEqual(f.nodes.get('node-a').position.xyz, [1, 2, 3])
  assert.deepEqual(f.nodes.get('node-b').position.xyz, [4, 5, 6])
  assert.equal(f.nodes.get('light-a').userData.light.intensity, 2 * Math.PI)
  assert.equal(f.nodes.get('light-b').userData.light.color.value, '#336699')
  assert.equal(f.vp.camera, f.editorCamera) // No hay principal: la vista editorial conserva autoridad.
})
test('CA005-02 · seleccionar una pista distinta no altera las propiedades evaluadas', () => {
  const f = fixture()
  apply.call(f.host, f.timeline, 1, { selectedNodeId: 'node-b', selectedTrack: f.timeline.tracks[0] })
  assert.deepEqual(f.nodes.get('node-a').position.xyz, [1, 2, 3])
  assert.deepEqual(f.nodes.get('node-b').position.xyz, [4, 5, 6])
  assert.equal(f.nodes.get('light-a').userData.light.intensity, 2 * Math.PI)
})
test('CA005-03 · las pistas silenciadas no se aplican', () => {
  const f = fixture({ muted: true })
  apply.call(f.host, f.timeline, 1, { selectedNodeId: 'light-b' })
  assert.equal(f.nodes.get('light-b').userData.light.color.value, undefined)
  assert.equal(f.nodes.get('light-a').userData.light.intensity, 2 * Math.PI)
})
test('CA005-04 · camera.main temporal dirige el Preview aunque se seleccione otra cámara', () => {
  const f = fixture()
  apply.call(f.host, f.timeline, 4.5, { selectedNodeId: 'c1', selectedTrack: f.timeline.tracks[0] })
  assert.equal(f.vp.camera, f.camera)
  assert.deepEqual(f.camera.position.xyz, [7, 8, 9])
})
test('CA005-05 · dos cámaras principales simultáneas no se resuelven por orden o selección', () => {
  const f = fixture({ cameraMain: 'c1' })
  apply.call(f.host, f.timeline, 4.5, { selectedNodeId: 'c2' })
  assert.equal(f.vp.camera, f.editorCamera)
})
test('CA005-06 · una toma explícita mantiene prioridad sobre camera.main', () => {
  const f = fixture()
  f.timeline.tracks.push({ kind: 'camera', keys: [{ t: 0 }], explicitPose: { pos: [10, 20, 30], quat: {}, fov: 65 } })
  apply.call(f.host, f.timeline, 4.5)
  assert.deepEqual(f.camera.position.xyz, [10, 20, 30])
  assert.equal(f.camera.fov, 65)
})
test('CA005-07 · selección y foco no invocan una cesión automática desde el Editor', () => {
  assert.doesNotMatch(read('src/core/editor/selection.js'), /onSpatialEditRequest/)
  assert.doesNotMatch(read('src/App.vue'), /watch\(\(\) => \[store\.tool, store\.gizmo\]/)
  assert.match(read('src/components/TimelinePanel.vue'), /function togglePreviewEditing\(\)/)
})

function runtimeCameraMain() {
  const src = read('src/engine/runtime/events/play-camera.js')
  const index = src.indexOf('  _mainCameraNode() {')
  const opening = src.indexOf('{', index)
  let depth = 0, end = -1
  for (let i = opening; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}' && --depth === 0) { end = i + 1; break }
  }
  return Function(`${src.slice(index, end).trim().replace('_mainCameraNode()', 'function resolveMain()')};return resolveMain`)()
}

test('CA005-08 · Player resuelve main temporal sin seleccionar nodos ni pistas', () => {
  const owner = runtimeCameraMain()
  const objs = [{ id: 'a', type: 'camera', props: { main: false } }, { id: 'b', type: 'camera', props: { main: false } }]
  const nodes = new Map(objs.map(obj => [obj.id, { userData: {} }]))
  const player = { project: { objects: objs }, _nodeEnabled: () => true, ed: { nodes }, _gm: {} }
  nodes.get('b').userData.timelineMain = true
  assert.equal(owner.call(player)?.obj.id, 'b')
  nodes.get('a').userData.timelineMain = true
  assert.equal(owner.call(player), null)
})
test('CA005-09 · Player detecta conflicto temporal contra principal autoral', () => {
  const owner = runtimeCameraMain()
  const objs = [{ id: 'a', type: 'camera', props: { main: true } }, { id: 'b', type: 'camera', props: { main: false } }]
  const nodes = new Map(objs.map(obj => [obj.id, { userData: {} }]))
  const player = { project: { objects: objs }, _nodeEnabled: () => true, ed: { nodes }, _gm: {} }
  nodes.get('b').userData.timelineMain = true
  assert.equal(owner.call(player), null)
})
