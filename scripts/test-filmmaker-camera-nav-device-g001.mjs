import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

const root = fileURLToPath(new URL('..', import.meta.url))
const source = (path) => readFileSync(join(root, path), 'utf8')
const app = source('src/filmmaker/FilmApp.vue')
const rigSource = source('src/filmmaker/operator.js')

function rigForQA({ input = 'mouse', person = true, kind = 'person', rig = 'handheld' } = {}) {
  const start = rigSource.indexOf('  look(dx, dy) {')
  const end = rigSource.indexOf('  startSensors() {', start)
  assert.ok(start > 0 && end > start, 'La lógica del OperatorRig existente debe conservarse')
  const methods = runInNewContext(`(class FakeRig { ${rigSource.slice(start, end)} })`, { DEG: Math.PI / 180 }).prototype
  return Object.assign(Object.create(methods), {
    input, person, op: { kind, rig }, yaw: 0, pitch: 0, zoom: 2, pos: { x: 0, y: 1.5, z: 0 },
  })
}
function wheelForQA({ mode = 'trackpad', rig = rigForQA() } = {}) {
  const start = app.indexOf('function stWheel(e) {')
  const end = app.indexOf('function stTouch(e) {', start)
  assert.ok(start > 0 && end > start, 'El evento de FilmMaker debe conservar un único controlador')
  const ctx = { F: { operatorRig: () => rig }, store: { prefs: { navigation: mode } }, host: { value: { clientHeight: 600 } } }
  runInNewContext(app.slice(start, end) + '\nthis.stWheelQA = stWheel', ctx)
  return {
    ctx,
    event(extra = {}) {
      const e = {
        deltaX: 0, deltaY: -20, deltaMode: 0, ctrlKey: false, shiftKey: false,
        canceled: false, stopped: false,
        preventDefault() { this.canceled = true }, stopPropagation() { this.stopped = true },
        ...extra,
      }
      ctx.stWheelQA(e)
      return e
    },
  }
}

test('NAV-01 · FilmMaker comparte navegación y comandos con ViewBar; un solo estado persistente', () => {
  const viewbar = source('src/components/ViewBar.vue')
  const state = source('src/core/state/state.js')
  assert.match(viewbar, /p\.navigation === 'trackpad'/)
  assert.match(app, /store\.prefs\.navigation === 'trackpad'/)
  assert.match(app, /run\(store\.prefs\.navigation === 'trackpad' \? 'nav\.mouse' : 'nav\.trackpad'\)/)
  assert.match(state, /navigation: 'mouse'/)
  assert.match(state, /localStorage\.setItem\(PREFS_KEY, JSON\.stringify\(p\)\)/)
  assert.match(source('src/core/commands.js'), /add\('nav\.trackpad'[^\n]+store\.prefs\.navigation = 'trackpad'/)
  assert.match(source('src/core/editor/keys.js'), /watch\(\(\) => store\.prefs\.navigation, \(m\) => this\.vp\.setNavigation\(m\)\)/)
})

test('NAV-02 · un único icono sin texto, tooltip y accesibilidad; no aparece en la app móvil', () => {
  assert.match(app, /data-test="film-nav-device"/)
  assert.match(app, /<Icon :name="store\.prefs\.navigation === 'trackpad' \? 'trackpad' : 'mouse'"/)
  assert.match(app, /:aria-pressed="store\.prefs\.navigation === 'trackpad'"/)
  assert.match(app, /:aria-label="store\.prefs\.navigation === 'trackpad'/)
  assert.match(app, /\.narrow \.bar \.nav-device/)
  assert.doesNotMatch(source('src/filmmaker/MobileCapabilities.vue'), /film-nav-device/)
})

test('NAV-03 · PC preserva arrastrar/rueda y teclado; el wheel no se duplica en el viewport', () => {
  assert.match(app, /@pointerdown="stDown" @pointermove="stMove"/)
  assert.match(app, /@wheel\.capture="stWheel"/)
  assert.match(app, /window\.addEventListener\('keydown', onKey\)/)
  assert.match(app, /o\.keys\.add\(e\.code\)/)
  const rig = rigForQA()
  const wheel = wheelForQA({ mode: 'mouse', rig })
  const e = wheel.event({ deltaY: -9 })
  assert.equal(e.canceled, true)
  assert.equal(e.stopped, true)
  assert.ok(rig.zoom > 2, 'La rueda de ratón conserva el zoom del rig original')
})

test('NAV-04 · laptop: dos dedos miran según padOrbit e inversión compartida', () => {
  const rig = rigForQA()
  rig.trackpad(30, 20, {}, { padOrbit: 2 })
  assert.ok(rig.yaw > 0)
  assert.ok(rig.pitch > 0)
  const other = rigForQA()
  other.trackpad(30, 20, {}, { padOrbit: 2, padInvert: true, padInvertY: true })
  assert.ok(other.yaw < 0)
  assert.ok(other.pitch > 0)
})

test('NAV-05 · laptop: pellizco aproxima y aleja con padZoom, clamp y prioridad sobre pan', () => {
  const rig = rigForQA()
  rig.trackpad(30, -20, { pinch: true, pan: true }, { padZoom: 1.5 })
  assert.ok(rig.zoom > 2)
  assert.equal(rig.yaw, 0)
  assert.equal(rig.pos.x, 0)
  rig.trackpad(0, 100000, { pinch: true }, { padZoom: 3 })
  assert.equal(rig.zoom, 1)
  rig.trackpad(0, -100000, { pinch: true }, { padZoom: 3 })
  assert.equal(rig.zoom, 6)
})

test('NAV-06 · Mayús + dos dedos desplaza el rig de persona; trípode no se traslada', () => {
  const rig = rigForQA()
  rig.trackpad(20, -10, { pan: true }, { padPan: 1 })
  assert.notEqual(rig.pos.x, 0)
  assert.notEqual(rig.pos.z, 0)
  assert.equal(rig.pitch, 0)
  const tripod = rigForQA({ person: false, kind: 'machine', rig: 'tripod' })
  tripod.trackpad(20, -10, { pan: true }, { padPan: 2 })
  assert.equal(tripod.pos.x, 0)
  assert.equal(tripod.pos.z, 0)
})

test('NAV-07 · sensor, remoto y AR no reciben gestos de laptop ni control de ratón duplicado', () => {
  for (const input of ['sensors', 'remote', 'ar']) {
    const rig = rigForQA({ input })
    rig.trackpad(10, -20, { pinch: true }, {})
    assert.equal(rig.zoom, 2, input)
    const wheel = wheelForQA({ mode: 'trackpad', rig })
    const e = wheel.event()
    assert.equal(e.canceled, true, input)
    assert.equal(e.stopped, true, input)
  }
})

test('NAV-08 · el evento normaliza unidades, limita saltos y no trata scroll normal como zoom', () => {
  const rig = rigForQA()
  const wheel = wheelForQA({ mode: 'trackpad', rig })
  const e = wheel.event({ deltaX: 0, deltaY: 300, deltaMode: 1 })
  assert.equal(e.canceled, true)
  assert.equal(e.stopped, true)
  assert.equal(rig.zoom, 2)
  assert.ok(Math.abs(rig.pitch - Math.PI / 60) < 1e-9, 'el giro se limita a 180°/s por frame además de limitar el scroll')
  const zoom = wheel.event({ deltaY: -10, ctrlKey: true })
  assert.equal(zoom.canceled, true)
  assert.ok(rig.zoom > 2)
})

test('NAV-09 · el aviso de Cámara cambia con la preferencia, sin guardar el modo en .nfm', () => {
  const camera = source('src/filmmaker/panels/CameraPanel.vue')
  assert.match(camera, /store\.prefs\.navigation === 'trackpad'/)
  assert.match(camera, /Laptop: dos dedos para mirar/)
  assert.match(camera, /PC: arrastra para mirar/)
  assert.doesNotMatch(source('src/filmmaker/operator.js'), /localStorage|session\.film\.operator\.navigation/)
  assert.doesNotMatch(app, /film\.value\.navigation\s*=/)
})
