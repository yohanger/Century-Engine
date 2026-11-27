import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { FILM_FRAME_PRESETS, normalizeFilmFrame } from '../src/filmmaker/frame.js'
import { normalizeEdit, sequence, cameraForPass, cameraAt, montageTimeline } from '../src/filmmaker/montage.js'
import { cinematicFromPass } from '../src/filmmaker/cinematic.js'
import { qFromEulerYXZ, eulerFromQYXZ } from '../src/core/capture/math.js'

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
// El modelo real se evalúa sin instalar JSZip: el round-trip binario se prueba por separado cuando está disponible.
const filmSource = source('src/filmmaker/film.js')
  .replace(/^import .+\n/gm, '')
  .replaceAll('export const ', 'const ').replaceAll('export function ', 'function ').replaceAll('export async function ', 'async function ')
const context = { FILM_FRAME_PRESETS, normalizeFilmFrame, normalizeEdit, Math, Number, String, Array, Object, Map, Set, JSON, Date, Error, Uint8Array }
vm.runInNewContext(filmSource + '\nthis.filmApi={newFilm,normalizeFilm,normalizeOperator,normalizeFilmCamera,activeFilmCamera,packNfm,unpackNfm}', context)
const api = context.filmApi
const plain = (o) => JSON.parse(JSON.stringify(o))
const key = (t, pos = [0, 1.6, 0], rot = [0, 0, 0]) => ({ t, pos, rot, fov: 60 })
const pass = (cameraId = '') => ({ id: 'pass-1', name: 'Plano 1', cameraId, take: -1, duration: 2, input: 'mouse', keys: [key(0), key(1), key(2)] })
test('S02-01 · formato único: creación válida, datos incompletos rechazados y ninguna migración implícita', () => {
  const f = plain(api.newFilm({ name: 'Producción' }))
  assert.equal(f.cameras.length, 1)
  assert.equal(f.activeCameraId, f.cameras[0].id)
  assert.equal(Object.hasOwn(f, 'version'), false)
  assert.equal(Object.hasOwn(f, 'operator'), false)
  assert.throws(() => api.normalizeFilm({ format: 'nfm', scene: { id: 's' }, passes: [pass()] }), /sin cámaras cinematográficas/)
  assert.throws(() => api.normalizeFilm({ ...f, cameras: [] }), /sin cámaras cinematográficas/)
  assert.throws(() => api.normalizeFilm({ ...f, activeCameraId: '' }), /cámara activa inválida/)
  assert.doesNotMatch(filmSource, /NFM_VERSION|f\.version|cam_legacy|const legacy =/)
})

test('S02-02 · conserva dos cámaras con configuraciones independientes y pasadas por ID', () => {
  const base = plain(api.newFilm({ name: 'Dos cámaras' }))
  const second = plain(api.normalizeFilmCamera({ id: 'cam-2', name: 'Grúa', operator: { kind: 'machine', rig: 'crane', crane: { pivot: [2, 0, 1], arm: 5, yaw: 40, elevation: 22 } }, pose: { pos: [1, 2, 3], rot: [0, 45, 0], fov: 50 } }))
  const f = api.normalizeFilm({ ...base, cameras: [base.cameras[0], second], activeCameraId: second.id, passes: [pass(second.id)] })
  assert.equal(f.cameras.length, 2)
  assert.equal(f.activeCameraId, 'cam-2')
  assert.equal(f.passes[0].cameraId, 'cam-2')
  assert.equal(f.cameras[1].operator.crane.arm, 5)
  assert.equal(f.cameras[0].operator.kind, 'person')
  assert.equal(f.cameras[1].pose.fov, 50)
  assert.deepEqual(plain(api.normalizeFilm(f)).cameras, plain(f.cameras))
})

test('S02-03 · IDs duplicados y referencia activa inválida se rechazan sin reasignación tácita', () => {
  const f = plain(api.newFilm())
  assert.throws(() => api.normalizeFilm({ ...f, cameras: [f.cameras[0], f.cameras[0]] }), /duplicado/)
  assert.throws(() => api.normalizeFilm({ ...f, activeCameraId: 'ausente' }), /cámara activa inválida/)
  assert.throws(() => api.normalizeFilm({ ...f, cameras: null }), /sin cámaras cinematográficas/)
  const orphan = api.normalizeFilm({ ...f, passes: [pass('cam-que-no-existe')] })
  assert.equal(orphan.passes[0].cameraId, 'cam-que-no-existe', 'sin reparar por nombre ni cambiar tomas')
})

test('S02-04 · rig valida rangos, puntos de riel, brazo, velocidad y referencia de shake', () => {
  const r = api.normalizeOperator({ kind: 'machine', rig: 'crane', speed: 999, sprint: -5, smooth: -1,
    acceleration: Infinity, crane: { pivot: [1, 2, 3], arm: 99, yaw: 400 },
    dolly: { points: [[0, 0, 0], [1, 0, 2], ['invalid', 1, 2]] }, shake: { nodeId: 'shake-4', intensity: 9 } })
  assert.equal(r.speed, 15); assert.equal(r.sprint, 0.05); assert.equal(r.smooth, 0)
  assert.equal(r.crane.arm, 25); assert.equal(r.crane.yaw, 180)
  assert.equal(r.acceleration, 12)
  assert.equal(r.dolly.points.length, 2)
  assert.equal(r.shake.nodeId, 'shake-4'); assert.equal(r.shake.intensity, 2)
})

test('S02-05 · rotación YXZ hace ida y vuelta exacta, incluidas orientaciones no triviales', () => {
  for (const angles of [[0, 0, 0], [15, 75, -7], [-45, 123, 12], [70, -140, 10]]) {
    const q1 = qFromEulerYXZ(...angles)
    const q2 = qFromEulerYXZ(...eulerFromQYXZ(q1))
    assert.ok(Math.abs(Math.abs(q1.reduce((s, v, i) => s + v * q2[i], 0)) - 1) < 1e-9)
  }
})

const withShake = (option = '') => {
  const f = plain(api.newFilm())
  const id = f.activeCameraId
  f.cameras[0].operator.shake = { nodeId: option || 'shake-1', intensity: 1 }
  f.passes = [pass(id)]
  f.edit = normalizeEdit({ shots: [{ id: 'shot-1', pass: 'pass-1', in: 0, out: 2 }] })
  return f
}
const node = { id: 'shake-1', name: 'Shake', type: 'cameraShake', props: { enabled: true, autoPlay: false, loop: true, pattern: 'sine', frequency: 1, position: [0.1, 0, 0], rotation: [0, 0, 4] } }

test('S02-06 · Camera Shake Base real se evalúa en tiempo absoluto sin mutar las claves', () => {
  const f = withShake(), before = plain(f.passes[0].keys)
  const context = { objects: [node], animations: [] }
  const rest = cameraForPass(f, f.passes[0], 0, context)
  const active = cameraForPass(f, f.passes[0], 0.25, context)
  assert.ok(active.pos[0] !== rest.pos[0] || active.rot[2] !== rest.rot[2])
  assert.deepEqual(cameraForPass(f, f.passes[0], 0.25, context), active, 'repetir no acumula shake')
  assert.deepEqual(f.passes[0].keys, before, 'las pasadas grabadas permanecen intactas')
})

test('S02-07 · referencia Camera Shake huérfana emite diagnóstico y conserva la pose', () => {
  const f = withShake('shake-huerfano'), errors = []
  const k = cameraForPass(f, f.passes[0], 0.25, { objects: [node], onMissingShake: id => errors.push(id) })
  assert.deepEqual(k.pos, [0, 1.6, 0]); assert.deepEqual(k.rot, [0, 0, 0])
  assert.deepEqual(errors, ['shake-huerfano'])
})

test('S02-08 · capa NLE shake no se duplica al existir shake de cámara', () => {
  const f = withShake(), layer = { id: 'layer-1', kind: 'shake', t0: 0, t1: 2, params: { amount: 1 } }
  f.edit = normalizeEdit({ ...f.edit, layers: [layer] })
  const seq = sequence(f), opts = { objects: [node] }, k = cameraAt(f, seq, 0.25, opts)
  const base = cameraForPass(f, f.passes[0], 0.25, opts)
  assert.deepEqual(k, base)
  f.cameras[0].operator.shake.nodeId = ''
  const nleShake = cameraAt(f, seq, 0.25, opts)
  assert.notDeepEqual(nleShake.rot, [0, 0, 0], 'la capa NLE sigue funcionando por separado')
})

test('S02-09 · exportación del montaje hornea shake y conserva los cortes por pass.id', () => {
  const f = withShake(), tl = montageTimeline(f, { objects: [node], animations: [] })
  const track = tl.tracks.find(t => t.kind === 'camera')
  assert.ok(track && track.keys.length >= 2)
  const k = track.keys.find(k => Math.abs(k.t - 1) < 0.01)
  assert.ok(k)
  assert.equal(f.edit.shots[0].pass, f.passes[0].id)
  assert.equal(track.keys[0].mode, 'free')
})

test('S02-10 · exportación de pasada individual hornea el mismo pose evaluado', () => {
  const f = withShake(), ps = f.passes[0], opts = { film: f, objects: [node], animations: [] }
  const tl = cinematicFromPass(ps, opts), camera = tl.tracks.find(t => t.kind === 'camera')
  assert.equal(camera.keys.length, ps.keys.length)
  const expected = cameraForPass(f, ps, 1, opts)
  assert.deepEqual(camera.keys[1].pos, expected.pos)
})

test('S02-11 · la UI edita la colección de cámaras original y el runtime no recurre a operator global', () => {
  const ui = source('src/filmmaker/panels/CameraPanel.vue')
  const s = source('src/filmmaker/session.js')
  assert.match(ui, /film-camera-select/)
  assert.match(ui, /film-dolly-point/)
  assert.match(ui, /film-crane-pivot/)
  assert.match(ui, /film-shake-node/)
  assert.match(s, /selectedCamera\(\)\.operator/)
  assert.doesNotMatch(s, /session\.film\.operator/)
})

test('S02-12 · prueba binaria .nfm de guardado/reapertura sin versiones', async (t) => {
  let codec
  try { codec = await import('../src/filmmaker/film.js') } catch { return t.skip('JSZip ausente: ejecutar npm ci en el equipo local') }
  const film = codec.newFilm(), bytes = new Uint8Array([1, 5, 2, 8])
  const packed = await codec.packNfm(film, bytes)
  const { default: JSZip } = await import('jszip')
  const raw = JSON.parse(await (await JSZip.loadAsync(packed)).file('film.json').async('string'))
  assert.equal(Object.hasOwn(raw, 'version'), false, 'el ZIP no guarda versión en film.json')
  const round = await codec.unpackNfm(packed)
  assert.equal(Object.hasOwn(round.film, 'version'), false)
  assert.deepEqual(round.film.cameras, film.cameras)
  assert.deepEqual(round.lfproj, bytes)
})

// Tres se usa solo a través de la API existente: estos dobles validan cinemática,
// estados y límites sin presentar el test como QA visual de WebGL.
function rigHarness(cameraOperator) {
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.set(x, y, z) }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this }
    copy(o) { return this.set(o.x, o.y, o.z) }
    clone() { return new Vector3(this.x, this.y, this.z) }
    sub(o) { return this.set(this.x - o.x, this.y - o.y, this.z - o.z) }
    add(o) { return this.set(this.x + o.x, this.y + o.y, this.z + o.z) }
    addScaledVector(o, s) { return this.set(this.x + o.x * s, this.y + o.y * s, this.z + o.z * s) }
    toArray() { return [this.x, this.y, this.z] }
    distanceToSquared(o) { return (this.x - o.x) ** 2 + (this.y - o.y) ** 2 + (this.z - o.z) ** 2 }
    lerp(o, t) { return this.set(this.x + (o.x - this.x) * t, this.y + (o.y - this.y) * t, this.z + (o.z - this.z) * t) }
    applyQuaternion() { return this }
  }
  class Quaternion {
    setFromEuler() { return this }
    setFromAxisAngle() { return this }
    clone() { return new Quaternion() }
    copy() { return this }
    slerp() { return this }
    multiply() { return this }
    normalize() { return this }
  }
  class Euler {
    constructor() { this.set(0, 0, 0) }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this }
    setFromQuaternion() { return this.set(0, 0, 0) }
  }
  class Curve {
    constructor(points) { this.points = points }
    getLength() { return this.points.slice(1).reduce((sum, p, i) => sum + Math.sqrt(p.distanceToSquared(this.points[i])), 0) }
    getPointAt(t) { const i = Math.min(this.points.length - 2, Math.floor(t * (this.points.length - 1)))
      return this.points[i].clone().lerp(this.points[i + 1], Math.min(1, t * (this.points.length - 1) - i)) }
  }
  class Raycaster { set() {} intersectObject() { return [] } }
  const THREE = { Vector3, Quaternion, Euler, CatmullRomCurve3: Curve, Raycaster }
  const code = source('src/filmmaker/operator.js').replace(/^import .+\n/gm, '')
    .replaceAll('export class ', 'class ').replaceAll('export const ', 'const ').replaceAll('export function ', 'function ')
  const sandbox = { THREE, Math, Number, Set, window: { addEventListener() {}, removeEventListener() {} } }
  vm.runInNewContext(code + '\nthis.Rig = OperatorRig', sandbox)
  const cam = { position: new Vector3(0, 1.6, 0), quaternion: new Quaternion(), fov: 60, updateProjectionMatrix() {} }
  const vp = { persp: cam, controls: { enabled: true }, requestRender() {} }
  const editor = { vp, groundAt() { return 0 }, objectsGroup: {}, nodes: new Map() }
  const rig = new sandbox.Rig({ editor, operator: plain(api.normalizeOperator(cameraOperator)), input: 'mouse' }).begin()
  return { rig, editor, cam }
}

test('S02-13 · trípode no traslada su origen y respeta límite de pan', () => {
  const { rig } = rigHarness({ kind: 'machine', rig: 'tripod', panLimit: 10, tiltLimit: 30 })
  rig.keys.add('KeyW'); rig.keys.add('KeyE'); rig.look(-10000, 10000)
  for (let i = 0; i < 50; i++) rig.update(.02)
  assert.deepEqual(rig.pos.toArray(), [0, 1.6, 0])
  assert.ok(Math.abs(rig.yaw) <= 10 * Math.PI / 180 + 1e-10)
  assert.ok(Math.abs(rig.pitch) <= 30 * Math.PI / 180 + 1e-10)
})

test('S02-14 · dolly sigue exclusivamente un riel y limita los extremos', () => {
  const { rig } = rigHarness({ kind: 'machine', rig: 'dolly', dolly: { points: [[0, 1.6, 0], [5, 1.6, 0]] } })
  rig.keys.add('KeyW')
  for (let i = 0; i < 100; i++) rig.update(.05)
  assert.ok(rig.pos.x > 0 && rig.pos.x <= 5)
  assert.equal(rig.pos.z, 0)
  assert.equal(rig.pos.y, 1.6)
  rig.keys.delete('KeyW'); rig.keys.add('KeyS')
  for (let i = 0; i < 100; i++) rig.update(.05)
  assert.ok(rig.railProgress >= 0 && rig.railProgress <= 1)
})

test('S02-15 · grúa deriva la cámara del pivote y brazo sin movimiento libre', () => {
  const { rig } = rigHarness({ kind: 'machine', rig: 'crane', crane: { pivot: [0, 0, 0], arm: 3, yaw: 0, elevation: 0 } })
  rig.keys.add('KeyW'); rig.keys.add('KeyD')
  for (let i = 0; i < 15; i++) rig.update(.05)
  assert.ok(rig.pos.y > 0)
  assert.ok(rig.pos.x > 0)
  assert.ok(Math.abs(rig.pos.x ** 2 + rig.pos.y ** 2 + rig.pos.z ** 2 - 9) < 1e-8, 'radio fijo del brazo')
})

test('S02-16 · movimiento de mano acelera y frena en segundos, sin atravesar velocidad tope', () => {
  const { rig } = rigHarness({ kind: 'person', speed: 1, acceleration: 2, deceleration: 4, handheld: 0, stabilization: 1 })
  rig.keys.add('KeyW')
  rig.update(.1)
  assert.ok(rig.travelSpeed > 0 && rig.travelSpeed <= .2 + 1e-8)
  for (let i = 0; i < 15; i++) rig.update(.1)
  assert.ok(rig.travelSpeed <= 1)
  const before = [...rig.pos.toArray()]
  rig.keys.delete('KeyW'); rig.update(.1)
  assert.ok(rig.travelSpeed < 1)
  assert.notDeepEqual(rig.pos.toArray(), before, 'la inercia frena progresivamente')
})
