import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const previewSource = read('src/core/timeline/preview.js')
const playbackSource = read('src/core/timeline/playback-session.js')
const panelSource = read('src/components/TimelinePanel.vue')
const inspectorSource = read('src/components/Inspector.vue')
const appSource = read('src/App.vue')

// Se evalúan directamente los métodos del Preview original con colaboradores mínimos.
// Sin duplicar algoritmos ni requerir un navegador externo para la prueba de prioridad.
function actualMethod(name, dependencies = {}) {
  const start = previewSource.indexOf(`  ${name}(`)
  assert.ok(start > 0, `No existe TimelinePreview.${name}`)
  const brace = previewSource.indexOf(') {', start) + 2
  let depth = 0, end = -1
  for (let i = brace; i < previewSource.length; i++) {
    if (previewSource[i] === '{') depth++
    else if (previewSource[i] === '}' && --depth === 0) { end = i + 1; break }
  }
  assert.ok(end > brace)
  const method = previewSource.slice(start, end).trim().replace(`${name}(`, `function ${name}(`)
  return Function(...Object.keys(dependencies), `${method}; return ${name}`)(...Object.values(dependencies))
}

const valueAt = (track, time) => track.keys?.some(key => key.t <= time) ? track.sample : undefined
const animatedCameraPose = actualMethod('animatedCameraPose', { evalTimelineNode: valueAt })
const apply = actualMethod('apply', {
  evalTimelineNode: valueAt,
  evalTimelineCamera: track => track.explicitPose ?? null,
  sampleBakeTrack: () => null,
  nodeAnimationProperty: () => null,
  DEG: Math.PI / 180,
})

function fixture({ cameras = ['cam-a'], sceneId = 'scene-a', keyTime = 0, main = cameras.length === 1 ? cameras[0] : null } = {}) {
  const objects = cameras.map(id => ({ id, type: 'camera', name: id, props: { fov: 70, main: id === main } }))
  const nodes = new Map(cameras.map(id => [id, {
    userData: {}, position: { set(...args) { this.coords = args } },
    updateMatrixWorld() {},
  }]))
  const tracks = cameras.map((id, index) => ({
    id: `track-${id}`, kind: 'node', prop: 'position', sceneId, node: id, byId: true,
    keys: [{ t: keyTime }], sample: [index + 1, 2, 3],
  }))
  const timeline = { tracks }
  const editorCamera = { id: 'editor' }
  const viewportCamera = {
    position: { set(...values) { this.values = values } }, quaternion: { copy(value) { this.value = value } },
    updateProjectionMatrix() {},
  }
  const viewport = { camera: editorCamera, persp: editorCamera, controls: { enabled: true },
    container: { clientWidth: 800, clientHeight: 450 }, requestRender() { this.renders = (this.renders || 0) + 1 } }
  const editor = { vp: viewport, nodes, _updateGizmoMode() { this.gizmoUpdates = (this.gizmoUpdates || 0) + 1 } }
  const host = {
    getSceneId: () => 'scene-a', getObjects: () => objects, getEditor: () => editor,
    nodeOf(id) { const o = objects.find(object => object.id === id); return o ? { o, n: nodes.get(id) } : null },
    resolve(key) {
      const target = this.nodeOf(key.node)
      return target ? { pos: target.n.position.coords || [0, 0, 0], quat: { id: key.node }, fov: 70 } : null
    },
    restoreNodes() {}, updateMotionPath() {}, savePose() {},
    animatedCameraPose, camera: viewportCamera, cameraOn: false,
    restoreCamera() { this.cameraOn = false; viewport.camera = this.previousCamera || viewport.persp;
      viewport.controls.enabled = this.previousControlsEnabled ?? true },
  }
  return { host, editor, viewport, editorCamera, viewportCamera, timeline, tracks }
}

test('PV-01 · una Camera3D con pista de propiedad se usa automáticamente sin pista camera', () => {
  const h = fixture()
  apply.call(h.host, h.timeline, 0)
  assert.equal(h.viewport.camera, h.viewportCamera)
  assert.deepEqual(h.viewportCamera.position.values, [1, 2, 3])
  assert.equal(h.viewport.controls.enabled, false)
})

test('PV-02 · la cámara ya recibe su transformación animada antes de resolver la vista', () => {
  const h = fixture()
  apply.call(h.host, h.timeline, 0)
  assert.deepEqual(h.viewportCamera.position.values, h.editor.vp.camera.position.values)
})

test('PV-03 · sin principal definida no se inventa cámara antes de la primera clave', () => {
  const h = fixture({ keyTime: 2, main: null })
  apply.call(h.host, h.timeline, 1)
  assert.equal(h.viewport.camera, h.editorCamera)
})

test('PV-04 · pista de propiedad silenciada no activa Camera3D', () => {
  const h = fixture({ main: null })
  h.tracks[0].muted = true
  apply.call(h.host, h.timeline, 0)
  assert.equal(h.viewport.camera, h.editorCamera)
})

test('PV-05 · ID de escena inválido no toma el control', () => {
  const h = fixture({ sceneId: 'otra-escena', main: null })
  apply.call(h.host, h.timeline, 0)
  assert.equal(h.viewport.camera, h.editorCamera)
})

test('PV-06 · dos cámaras sin selección no generan prioridad arbitraria', () => {
  const h = fixture({ cameras: ['cam-a', 'cam-b'] })
  apply.call(h.host, h.timeline, 0)
  assert.equal(h.viewport.camera, h.editorCamera)
})

test('PV-07 · la cámara principal autoral prevalece sobre selección contraria', () => {
  const h = fixture({ cameras: ['cam-a', 'cam-b'], main: 'cam-b' })
  apply.call(h.host, h.timeline, 0, { selectedNodeId: 'cam-a' })
  assert.deepEqual(h.viewportCamera.position.values, [2, 2, 3])
})

test('PV-08 · seleccionar otra pista no sustituye la cámara principal', () => {
  const h = fixture({ cameras: ['cam-a', 'cam-b'], main: 'cam-a' })
  apply.call(h.host, h.timeline, 0, { selectedNodeId: 'cam-b', selectedTrack: h.tracks[1] })
  assert.deepEqual(h.viewportCamera.position.values, [1, 2, 3])
})

test('PV-09 · una toma explícita activa prevalece sobre pistas de propiedades', () => {
  const h = fixture()
  h.timeline.tracks.unshift({ kind: 'camera', keys: [{ t: 0 }], explicitPose: { pos: [50, 1, 3], quat: {}, fov: 42 } })
  apply.call(h.host, h.timeline, 0)
  assert.deepEqual(h.viewportCamera.position.values, [50, 1, 3])
  assert.equal(h.viewportCamera.fov, 42)
})

test('PV-10 · una toma explícita inválida no se sustituye silenciosamente', () => {
  const h = fixture()
  h.timeline.tracks.unshift({ kind: 'camera', keys: [{ t: 0 }], explicitPose: null })
  apply.call(h.host, h.timeline, 0)
  assert.equal(h.viewport.camera, h.editorCamera)
})

test('PV-11 · toma que empieza más tarde permite la cámara animada antes', () => {
  const h = fixture()
  h.timeline.tracks.unshift({ kind: 'camera', keys: [{ t: 4 }], explicitPose: null })
  apply.call(h.host, h.timeline, 0)
  assert.equal(h.viewport.camera, h.viewportCamera)
})

test('PV-12 · al perder la pista animada restaura cámara y controles anteriores', () => {
  const h = fixture()
  apply.call(h.host, h.timeline, 0)
  h.tracks[0].muted = true
  h.host.getObjects()[0].props.main = false
  apply.call(h.host, h.timeline, 1)
  assert.equal(h.viewport.camera, h.editorCamera)
  assert.equal(h.viewport.controls.enabled, true)
})

test('PV-13 · selección sirve para trayectorias, nunca para elegir cámara', () => {
  assert.match(playbackSource, /visual\.apply\(timeline,time\.value,\{enabled:true,selectedTrack:track\}\)/)
  assert.doesNotMatch(playbackSource, /selectedNodeId:context\.selectedNodeId/)
  assert.match(panelSource, /\(\)=>store\.selectedId,\(\)=>store\.temporalEditRevision/)
  assert.match(panelSource, /playback\.toggle\(tl\.value,selTrack\.value\)/)
  assert.doesNotMatch(previewSource, /candidates\.has\(selectedNodeId\)/)
  assert.doesNotMatch(playbackSource, /(?:cameraPreviewState|cameraOwnerManager|cameraPriorityStore)/)
})

test('PV-14 · la guía queda bajo claves y clips, sin quitar el agarre de la regla', () => {
  assert.match(panelSource, /\.playhead \{ z-index:1;[^}]*pointer-events:none;/)
  assert.match(panelSource, /\.lane \.key \{ z-index:6;/)
  assert.match(panelSource, /\.lane \.timeline-live-clip \{[^}]*z-index:4;/)
  assert.match(panelSource, /\.playhead-grip \{z-index:27;/)
})

test('PV-15 · cada PropertyKey conserva su control original en la misma fila', () => {
  assert.match(inspectorSource, /\.insp \.field:has\(> \.property-key\) \{\s*grid-template-columns:[^;]*22px;/)
  assert.match(inspectorSource, /\.insp \.field > \.property-key \{ justify-self: end; \}/)
  assert.match(inspectorSource, /@container insp \(max-width: 260px\)[\s\S]*?\.insp \.field:has\(> \.property-key\) > label/)
  assert.match(inspectorSource, /\.insp > \.sect > \.body > \.field \+ \.field \{ margin-top: 4px;/)
  assert.match(inspectorSource, /<PropertyKey v-if="inspectorKeyable\('camera\.fov'\)"/)
})

test('PV-16 · no se agregaron cambios al evaluador de Player ni a las pistas Audio, Scripts o Eventos', () => {
  assert.match(previewSource, /Ninguna clave de audio, comando o método se ejecuta desde la vista previa/)
  assert.match(panelSource, /row\.track\.kind === 'audio'/)
  assert.match(panelSource, /trackGlyphs = \{ camera: 'camera', node: 'box', bake: 'static-body', audio: 'audio', commands: 'event', method: 'script' \}/)
})


test('PV-17 · fixture Electron ancla Posición a su llave real y verifica el valor junto a ella', () => {
  const fixture = read('scripts/fixtures/editor/timeline-universal-animation-s13-g008-g001-corr001.html')
  assert.match(fixture, /property-key\[aria-label=\"Insertar clave de Posición en Timeline\"\]/)
  assert.match(fixture, /posKey\?\.closest\('\.field'\)/)
  assert.match(fixture, /querySelector\(':scope > \.v3'\)/)
  assert.match(fixture, /Llave alineada horizontalmente al valor/)
  assert.doesNotMatch(fixture, /field\.querySelector\('label'\)\?\.textContent/)
  assert.match(inspectorSource, /<div class="field"><label>Posición<\/label><Vec3Field[^>]+\/><PropertyKey v-if="inspectorKeyable\('position'\)"/)
})
