// LF-THREE-S02-G001: contrato de luces de área y regresión de iluminación.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const light = read('src/engine/runtime/nodes/light.js')
const lib = read('src/engine/runtime/render/lightlib.js')
const inspector = read('src/components/Inspector.vue')
const viewport = read('src/engine/runtime/render/viewport.js')
const bake = read('src/engine/runtime/bake/baker.js')
const runtime = read('src/engine/runtime/events/play-light.js')

test('S02: área rectangular es variante del nodo Light (no un sistema paralelo)', () => {
  assert.match(light, /area: 'Área rectangular'/)
  assert.match(light, /area: \{ label: 'Luz rectangular'/)
  assert.match(light, /new THREE\.RectAreaLight\(/)
  assert.equal((light.match(/registerNode\(/g) || []).length, 1)
})
test('S02: el render común Editor/Player inicializa LTC oficial', () => {
  assert.match(viewport, /three\/addons\/lights\/RectAreaLightUniformsLib\.js/)
  assert.match(viewport, /RectAreaLightUniformsLib\.init\(\)/)
  assert.ok(viewport.indexOf('RectAreaLightUniformsLib.init()') < viewport.indexOf('new THREE.WebGLRenderer'))
})
test('S02: ancho, alto y energía usan el modelo de luz original', () => {
  assert.match(lib, /areaWidth: num\(l\.areaWidth/)
  assert.match(lib, /areaHeight: num\(l\.areaHeight/)
  assert.match(light, /l\.width = q\.areaWidth; l\.height = q\.areaHeight/)
  assert.match(light, /l\.intensity = p\.energy \* Math\.PI/)
  assert.match(light, /areaFrame\?\.update\(\)/)
})
test('S02: inspector muestra dimensiones y no muestra opciones incompatibles', () => {
  assert.match(inspector, /Ancho \(m\)/)
  assert.match(inspector, /Alto \(m\)/)
  assert.match(inspector, /obj\.light\.type !== 'directional' && obj\.light\.type !== 'area'/)
  assert.match(inspector, /obj\.light\.type !== 'area'.*<label>Sombras<\/label>/)
  assert.match(inspector, /obj\.light\.type !== 'area'.*<label>Volumétrica<\/label>/)
  assert.match(inspector, /obj\.light\.type !== 'area'.*<label>Modo<\/label>/)
})
test('S02: no se crean sombras ni volumetría ficticia', () => {
  assert.match(light, /l\.castShadow = p\.type !== 'area' && !!p\.shadow/)
  assert.match(light, /rtVol = p\.type !== 'area' && q\.volumetric/)
  assert.match(runtime, /if \(obj\.light\.type === 'area'\) return;/)
})
test('S02: el trazador existente no confunde RectAreaLight con direccional', () => {
  assert.match(bake, /obj\.light\?\.type === 'area'/)
  assert.match(lib, /l\.type === 'area' \? 'dynamic'/)
})
test('S02: luces anteriores conservan sus tipos y ruta', () => {
  for (const t of ['omni', 'spot', 'directional']) assert.match(light, new RegExp(t + ':'))
  assert.match(light, /new THREE\.PointLight/)
  assert.match(light, /new THREE\.SpotLight/)
  assert.match(light, /new THREE\.DirectionalLight/)
})
test('S02: la fuente mantiene el contrato de orientación -Z', () => {
  assert.match(light, /light\.rotation\.y = Math\.PI/)
  assert.match(light, /arrowToward\(0\.9/)
})

let three
try { three = await import('three') } catch (e) { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e }
if (!three) {
  test('S02: construcción dinámica requiere npm ci', { skip: true }, () => {})
} else {
  const { makeObject, getDef } = await import('../src/engine/runtime/nodes/index.js')
  const { normalizeLight } = await import('../src/engine/runtime/render/lightlib.js')
  test('S02: se crea y configura una RectAreaLight real', () => {
    const obj = makeObject('light', 'area', { id: 'rect01' })
    const def = getDef('light')
    const root = def.build(obj)
    def.update(root, obj)
    const l = root.userData.light
    assert.equal(l.isRectAreaLight, true)
    assert.equal(l.width, 2)
    assert.equal(l.height, 1)
    assert.equal(l.castShadow, false)
    assert.equal(l.userData.rtVol, null)
    obj.light.areaWidth = 3.5
    obj.light.areaHeight = 0.75
    obj.light.shadow = true
    obj.light.volumetric = true
    def.update(root, obj)
    assert.equal(l.width, 3.5)
    assert.equal(l.height, 0.75)
    assert.equal(l.castShadow, false)
    assert.equal(l.userData.rtVol, null)
    assert.ok(root.userData.areaFrame.isRectAreaLightHelper || root.userData.areaFrame.light === l)
    assert.equal(root.userData.areaFrame.parent, l)
    assert.equal(normalizeLight({ type: 'area', mode: 'baked' }).mode, 'dynamic')
    const old = makeObject('light', 'omni', { id: 'p1' })
    const pt = def.build(old)
    def.update(pt, old)
    assert.equal(pt.userData.light.isPointLight, true)
    root.traverse((o) => { o.geometry?.dispose(); o.material?.dispose() })
    pt.traverse((o) => { o.geometry?.dispose(); o.material?.dispose() })
  })
  test('S02: serialización JSON de ancho/alto sin cambios en objetos antiguos', () => {
    const obj = makeObject('light', 'area')
    assert.deepEqual(JSON.parse(JSON.stringify(obj)).light.areaWidth, 2)
    const older = makeObject('light', 'omni')
    assert.equal(older.light.type, 'omni')
  })
}
