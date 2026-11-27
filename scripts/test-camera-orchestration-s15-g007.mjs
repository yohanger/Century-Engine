// G007 · QA de integración entre autoridad de cámaras, eventos, Timeline y salida efectiva.
// Ejercita los métodos productivos; el host mínimo no sustituye render GPU ni AppImage.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Game } from '../src/engine/runtime/events/interpreter.js'
import { newCommand, visibleParams } from '../src/engine/runtime/events/commandDefs.js'
import { newTimeline, normalizeTimeline } from '../src/core/timeline/model.js'

const source = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
class Q {
  constructor(a = 0) { this.a = a; this.x = 0; this.y = 0; this.z = 0; this.w = 1 }
  clone() { return new Q(this.a) }
  copy(q) { this.a = q.a; return this }
  slerp(q, t) { this.a += (q.a - this.a) * t; return this }
  normalize() { return this }
}
const cameraMethods = Function('THREE', 'setCameraFov', 'resolveCamera3D',
  source('src/engine/runtime/events/play-camera.js').replace(/^import .*$/gm, '').replace(/^export /gm, '') + '\nreturn cameraMethods')(
    { Matrix4: class {} }, (cam, value) => { cam.fov = value },
    (key, scene, objects, nodes) => {
      if (key.sceneId !== scene) return null
      const o = objects.find(x => x.id === key.node && x.type === 'camera' && x.active !== false)
      const node = nodes.get(key.node)
      if (!o || !node) return null
      return { pos: [...node.pos], quat: new Q(node.angle), fov: o.props.fov, profile: o.props.profile }
    },
  )
const timelineMethods = Function('THREE', 'TimelineRunner', 'setCameraFov', 'verticalFov', 'resolveCamera3D', 'sampleBakeTrack', 'resolveAudioGroup', 'DEG',
  source('src/engine/runtime/events/play-timeline.js').replace(/^import .*$/gm, '').replace(/^export /gm, '') + '\nreturn timelineMethods')(
    { Vector3: class {}, Quaternion: class {}, Euler: class {} }, class {}, () => {}, () => 70,
    () => {}, () => {}, () => {}, Math.PI / 180,
  )
function fixture({ player = true, base = '' } = {}) {
  const objects = ['a', 'b', 'c'].map((id, i) => ({ id, type: 'camera', active: true,
    visible: id !== 'a', props: { fov: 50 + i * 20, profile: ['night', 'day', 'blue'][i] } }))
  const nodes = new Map([['a', { pos: [2, 0, 0], angle: 0 }], ['b', { pos: [10, 0, 0], angle: 90 }], ['c', { pos: [20, 0, 0], angle: 180 }]])
  const cam = { position: { x: 0, y: 0, z: 0, set(x, y, z) { Object.assign(this, { x, y, z }) } }, quaternion: new Q(), fov: 90 }
  const profiles = [], consumers = [], logs = []
  const pm = {
    ...cameraMethods, ...timelineMethods, on: true, hasPlayer: player,
    project: { activeSceneId: 'scene-1', objects, timelines: [] }, ed: { nodes, vp: {} },
    _gm: { camera: base }, g: { fov: 90 }, film: null, tls: [],
    state: { noCamera: false }, dom: { style: {} },
    rt: { log(message) { logs.push(message) } },
    _nodeEnabled(o) { return o?.active !== false },
    _profCamera(name) { profiles.push(name) },
    _waterFx(c) { consumers.push(['water', c.position.x]) },
    _dofFocus(c) { consumers.push(['dof', c.position.x]) },
    player: { viewPose(c) { c.position.set(0, 1, 0); c.quaternion.copy(new Q()); c.fov = 90 } },
    _tlCamera(c) { const r = this.tls.find(x => !x.finished && x.cam); if (r) this._cameraApply(c, r.cam) },
    _viewCamera(c) {
      const id = this._gm.camera
      const o = this.project.objects.find(x => x.id === id && this._nodeEnabled(x))
      const node = o && this.ed.nodes.get(id)
      if (node) { c.position.set(...node.pos); c.quaternion.copy(new Q(node.angle)); c.fov = o.props.fov }
      else this.player.viewPose(c)
    },
    _tlBakeRelease() {},
  }
  pm._cameraReset()
  const game = new Game({ host: { cameraEvent: args => pm._cameraEventControl(args) }, database: {} })
  const frame = (dt = 0) => { pm._cameraDelta = dt; pm._cameraFrame(cam); return cam.position.x }
  const event = (id, action, node = '', to = 'keep', extra = {}) => game.exec(newCommand('cameraControl', { action, node, to, ...extra }), { eventId: id, name: 'Integración', cancelled: false })
  return { pm, game, cam, objects, nodes, profiles, consumers, logs, frame, event }
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} distinto de ${b}`)
const timeline = (exit = 'keep', mode = 'camera3d') => ({
  tl: { id: 't1', name: 'Cinemática', tracks: [{ kind: 'camera', muted: false, keys: [{ t: 0, mode, node: 'a', sceneId: 'scene-1' }] }] },
  time: 2, finished: true, skipped: false, lock: false, lastCamera: { pos: [2, 0, 0], quat: new Q(), fov: 50, profile: 'night' },
  cameraExit: { natural: { to: exit }, stop: { to: 'base' }, skip: { to: 'pose' }, interrupted: { to: 'keep' } },
  _cameraBefore: { kind: 'base' },
})

test('G007-01 · Camera3D activa e invisible sirve al evento y conserva FOV/perfil', async () => {
  const f = fixture({ player: false })
  await f.event('ev-a', 'activate', 'a')
  assert.equal(f.frame(), 2)
  assert.equal(f.cam.fov, 50)
  assert.equal(f.profiles.at(-1), 'night')
  assert.deepEqual(f.pm._cameraActive, { kind: 'camera3d', id: 'a', requested: true })
  assert.equal(f.pm.state.noCamera, false)
})
test('G007-02 · evento propietario puede cambiar con blend y observa salida única en consumidores', async () => {
  const f = fixture()
  await f.event('ev-a', 'activate', 'a'); f.frame()
  await f.event('ev-a', 'change', 'b', 'keep', { seconds: 1, ease: 'linear' })
  near(f.frame(0.25), 4); near(f.cam.fov, 55)
  assert.deepEqual(f.consumers.slice(-2), [['water', 4], ['dof', 4]])
  assert.equal(f.profiles.at(-1), 'night')
  assert.equal(f.frame(0.75), 10)
  assert.equal(f.profiles.at(-1), 'day')
})
test('G007-03 · el evento ajeno no desplaza un blend en curso', async () => {
  const f = fixture()
  await f.event('ev-a', 'activate', 'a'); f.frame()
  await f.event('ev-a', 'change', 'b', 'keep', { seconds: 2 })
  f.frame(0.5)
  const blend = f.pm._cameraBlend
  await assert.rejects(f.event('ev-b', 'activate', 'c'), /No se pudo controlar/)
  assert.equal(f.pm._cameraBlend, blend)
  assert.equal(f.pm._cameraSource.owner, 'event:ev-a')
  assert.equal(f.pm._cameraBlend.elapsed, 0.5)
})
test('G007-04 · lease de script rechaza eventos; liberación keep permite siguiente propietario', async () => {
  const f = fixture()
  const lease = f.pm._cameraApi().acquire('a')
  assert.ok(lease)
  await assert.rejects(f.event('ev', 'activate', 'b'), /No se pudo controlar/)
  f.frame()
  assert.equal(lease.release(), true)
  f.nodes.get('a').pos[0] = 6
  assert.equal(f.frame(), 6)
  await f.event('ev', 'activate', 'b')
  assert.equal(f.frame(), 10)
})
test('G007-05 · Camera3D desactivada no adquiere; se conserva la autoridad válida', async () => {
  const f = fixture({ player: false })
  await f.event('ev', 'activate', 'a'); f.frame()
  f.objects.find(x => x.id === 'b').active = false
  await assert.rejects(f.event('ev', 'change', 'b'), /No se pudo controlar/)
  assert.equal(f.frame(), 2)
  assert.equal(f.pm._cameraActive.id, 'a')
})
test('G007-06 · Camera3D desaparecida invalida el lease y diagnostica ausencia de fuente', () => {
  const f = fixture({ player: false })
  const lease = f.pm._cameraApi().acquire('a'); f.frame()
  f.objects.splice(f.objects.findIndex(x => x.id === 'a'), 1)
  f.frame()
  assert.equal(lease.use('b'), false)
  assert.equal(f.pm.state.noCamera, true)
  assert.ok(f.logs.some(s => s.includes('se perdió Camera3D')))
})
test('G007-07 · Timeline en ejecución impide una nueva adquisición incompatible', async () => {
  const f = fixture()
  f.pm.tls = [{ tl: { id: 't' }, cam: { pos: [99, 0, 0], quat: new Q(), fov: 45 }, finished: false }]
  assert.equal(f.frame(), 99)
  await assert.rejects(f.event('ev', 'activate', 'a'), /No se pudo controlar/)
  assert.equal(f.frame(), 99)
  assert.equal(f.pm._cameraActive.kind, 'timeline')
})
test('G007-08 · FilmMaker conserva la autoridad ante un Timeline activo y evento concurrente', async () => {
  const f = fixture()
  f.pm.tls = [{ tl: { id: 't' }, cam: { pos: [99, 0, 0], quat: new Q(), fov: 45 }, finished: false }]
  f.pm.film = { camera(c) { c.position.set(33, 0, 0); c.fov = 30 } }
  assert.equal(f.frame(), 33)
  assert.equal(f.pm._cameraActive.kind, 'film')
  await assert.rejects(f.event('ev', 'activate', 'a'), /No se pudo controlar/)
  assert.equal(f.frame(), 33)
})
test('G007-09 · fin natural de Timeline nuevo retiene fuente Camera3D viva', async () => {
  const f = fixture({ player: false })
  const run = timeline('keep')
  f.pm.tls = [run]
  f.pm._tlEnded(run)
  assert.equal(f.pm._cameraSource.kind, 'held')
  f.nodes.get('a').pos[0] = 11
  assert.equal(f.frame(), 11)
  await f.event('ev', 'activate', 'b')
  assert.equal(f.frame(), 10)
})
test('G007-10 · Stop y Skip aplican razones diferentes, sin retorno FPS implícito', () => {
  const stop = fixture({ player: false })
  const runStop = timeline(); stop.pm.tls = [runStop]
  stop.pm._tlEnded(runStop, true)
  assert.equal(stop.pm._cameraSource, null)
  const skip = fixture({ player: false })
  const runSkip = timeline(); runSkip.skipped = true; skip.pm.tls = [runSkip]
  skip.pm._tlEnded(runSkip)
  assert.equal(skip.pm._cameraSource.kind, 'pose')
  assert.equal(skip.frame(), 2)
})
test('G007-11 · Timeline libre con keep produce SIN_CAMARA sin snapshot ni FPS', () => {
  const f = fixture({ player: false }); const run = timeline('keep', 'free')
  f.pm.tls = [run]; f.pm._tlEnded(run)
  assert.equal(f.pm._cameraSource.kind, 'empty')
  f.frame(); assert.equal(f.pm.state.noCamera, true)
})
test('G007-12 · sin Camera3D, sin jugador y sin Timeline, no hay cámara efectiva', () => {
  const f = fixture({ player: false })
  f.frame()
  assert.equal(f.pm.state.noCamera, true)
  assert.equal(f.pm._cameraActive, null)
})
test('G007-13 · cambiar de escena invalida snapshot, transición, token y propietario', () => {
  const f = fixture()
  const lease = f.pm._cameraApi().acquire('a'); f.frame()
  lease.use('b', { seconds: 2 }); f.frame(0.5)
  assert.ok(f.pm._cameraBlend)
  f.pm.project.activeSceneId = 'scene-2'; f.pm.project.objects = []; f.pm.ed.nodes.clear(); f.pm._cameraReset()
  assert.equal(f.pm._cameraBlend, null)
  assert.equal(f.pm._cameraLastRaw, null)
  assert.equal(lease.release(), false)
  assert.equal(f.pm._cameraApi().acquire('a'), null)
})
test('G007-14 · adquirir no muta el proyecto ni persiste una cámara de forma implícita', () => {
  const f = fixture()
  const before = JSON.stringify(f.pm.project)
  const lease = f.pm._cameraApi().acquire('a', { seconds: 2 })
  f.frame(0.5)
  lease.use('b', { seconds: 1 }); f.frame(0.2)
  lease.release({ to: 'pose' }); f.frame()
  assert.equal(JSON.stringify(f.pm.project), before)
})
test('G007-15 · datos nuevos y anteriores respetan la frontera pre-LTS', () => {
  const fresh = newTimeline('Nuevo')
  assert.deepEqual(Object.keys(fresh.cameraExit), ['natural', 'stop', 'skip', 'interrupted'])
  const legacy = normalizeTimeline({ id: 'old', name: 'Existente', tracks: [] })
  assert.equal(Object.hasOwn(legacy, 'cameraExit'), false)
  assert.deepEqual(normalizeTimeline(JSON.parse(JSON.stringify(fresh))).cameraExit, fresh.cameraExit)
})
test('G007-16 · opciones del evento se muestran solo para la salida Camera3D', () => {
  assert.ok(visibleParams('cameraControl', { action: 'release', to: 'camera3d' }).some(x => x.key === 'cameraId'))
  assert.equal(visibleParams('cameraControl', { action: 'release', to: 'keep' }).some(x => x.key === 'cameraId'), false)
  assert.ok(visibleParams('cameraControl', { action: 'activate' }).some(x => x.key === 'seconds'))
})
test('G007-17 · Player exportado utiliza PlayMode y el mismo host de eventos', () => {
  assert.match(source('src/engine/runtime/package/game.js'), /graph\.player = new PlayMode\(graph\)/)
  assert.match(source('src/engine/runtime/events/play-host.js'), /get camera\(\) \{ return self\._cameraApi\(\) \}/)
  assert.match(source('src/engine/runtime/events/play-host.js'), /cameraEvent: \(request\) => self\._cameraEventControl\(request\)/)
})
test('G007-18 · CA-005 impide cesión automática por selección y mantiene TransformControls', () => {
  assert.doesNotMatch(source('src/core/editor/selection.js'), /onSpatialEditRequest/)
  assert.doesNotMatch(source('src/App.vue'), /onSpatialEditRequest = \(\) => timelinePlayback\.yieldToEditing\(\)/)
  assert.match(source('src/components/TimelinePanel.vue'), /togglePreviewEditing/)
  assert.match(source('src/core/timeline/playback-session.js'), /yieldToEditing/)
  assert.match(source('src/core/editor/selection.js'), /this\._tcs\(\)/)
  assert.match(source('src/core/editor/selection.js'), /t\.attach\(dest\)/)
})
test('G007-19 · Camera Shake externo no sustituye la fuente FilmMaker o Timeline', () => {
  const s = source('src/engine/runtime/events/play-camera-shake.js')
  assert.match(s, /timeline/)
  assert.match(s, /film/)
  assert.match(s, /_cameraActive/)
})
