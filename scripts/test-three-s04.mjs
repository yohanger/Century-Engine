// LF-THREE-S04-G001 · Lensflare integrado en Light, sin efectos duplicados.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeLight } from '../src/engine/runtime/render/lightlib.js'

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const light = read('src/engine/runtime/nodes/light.js')
const inspector = read('src/components/Inspector.vue')
const obj = read('src/engine/runtime/scene/objects.js')
const graph = read('src/engine/runtime/scene-graph.js')
const runtime = read('src/engine/runtime/events/play-light.js')
const lib = read('src/engine/runtime/render/lightlib.js')

test('S04: Lensflare y LensflareElement proceden del addon oficial', () => {
  assert.match(light, /import \{ Lensflare, LensflareElement \} from 'three\/addons\/objects\/Lensflare\.js'/)
  assert.equal((light.match(/registerNode\(/g) || []).length, 1)
})
test('S04: apagado por defecto y sin cambios a proyectos heredados', () => {
  for (const type of ['omni', 'spot', 'directional', 'area']) assert.equal(normalizeLight({ type }).flareOn, false)
  assert.match(light, /flareOn: false/)
})
test('S04: G003_CORR extiende Lensflare a sol y área, conservando Punto y Foco', () => {
  assert.equal(normalizeLight({ type: 'omni', flareOn: true }).flareOn, true)
  assert.equal(normalizeLight({ type: 'spot', flareOn: true }).flareOn, true)
  assert.equal(normalizeLight({ type: 'area', flareOn: true }).flareOn, true)
  assert.equal(normalizeLight({ type: 'directional', flareOn: true }).flareOn, true)
})
test('S04: tamaño e intensidad normalizados sin NaN y con límites', () => {
  assert.equal(normalizeLight({ type: 'omni', flareSize: 500 }).flareSize, 256)
  assert.equal(normalizeLight({ type: 'omni', flareSize: -4 }).flareSize, 16)
  assert.equal(normalizeLight({ type: 'omni', flareIntensity: 100 }).flareIntensity, 2)
  assert.equal(normalizeLight({ type: 'omni', flareIntensity: -10 }).flareIntensity, 0)
  assert.equal(normalizeLight({ type: 'spot', flareSize: null }).flareSize, 72)
  assert.equal(normalizeLight({ type: 'spot', flareIntensity: 'n/a' }).flareIntensity, 1)
})
test('S04: efecto y material de iluminación tienen responsabilidades separadas', () => {
  assert.match(light, /light\.add\(effect\)/)
  assert.match(light, /syncFlare\(root, q, l\)/)
  assert.match(light, /new THREE\.DataTexture\(flarePixels/)
  assert.match(light, /if \(!flarePixels\)/)
  assert.doesNotMatch(lib, /new (?:THREE\.)?Lensflare/)
})
test('S04: textura GPU por luz; imagen radial reutilizada y limpieza segura', () => {
  assert.match(light, /const texture = flareTexture\(\)/)
  assert.match(light, /effect\.addElement\(e\)/)
  assert.match(light, /u\.flare\.dispose\(\)/)
  assert.match(light, /u\.flare\.parent\?\.remove/)
  assert.match(light, /if \(!q\.flareOn\) \{ disposeFlare\(root\); return \}/)
})
test('S04: UI dispone de Lensflare en cuatro luces; mantiene color original', () => {
  assert.match(inspector, /\['omni', 'spot', 'directional', 'area'\]\.includes\(obj\.light\.type\)/)
  for (const x of ['Lensflare', 'Tamaño flare (px)', 'Intensidad flare']) assert.ok(inspector.includes(x), x)
  assert.match(inspector, /light: \{ flareOn: \$event\.target\.checked \}/)
  assert.match(light, /e\.color\.copy\(l\.color\)/)
})
test('S04: limpiar en reconstrucción, borrado, carga de escena y cierre', () => {
  assert.equal((obj.match(/userData\.disposeLightEffects\?\.\(\)/g)||[]).length, 2)
  assert.equal((graph.match(/userData\.disposeLightEffects\?\.\(\)/g)||[]).length, 2)
})
test('S04: el efecto sigue el encendido, la energía, el color y el parpadeo', () => {
  assert.equal((runtime.match(/refreshLightEffects\?\.\(\)/g)||[]).length, 3)
  assert.match(graph, /n\.userData\.refreshLightEffects\?\.\(\)/)
  assert.match(light, /l\.intensity > 0\.001/)
})
test('S04: las ayudas del Editor no bloquean la fuente durante Play', () => {
  assert.match(light, /root\.userData\.editorOnlyVisual = visual/)
  assert.match(read('src/engine/runtime/scene/environment.js'), /node\.userData\.editorOnlyVisual\.visible = !this\.isPlaying/)
})
test('S04: S03 SSR, LUT y DOF no se sustituyen ni se añaden nuevos renderizadores', () => {
  assert.doesNotMatch(light, /SSRPass|LUTPass|BokehPass|OutlinePass/)
  assert.match(read('src/engine/runtime/render/look.js'), /SSRPass/)
})

let THREE
try { THREE = await import('three') } catch (e) { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e }
if (!THREE) {
  test('S04: instancia Three.js del addon requiere npm ci', { skip: 'No instalado three en este entorno' }, () => {})
} else {
  const { getDef, makeObject } = await import('../src/engine/runtime/nodes/index.js')
  const def = getDef('light')
  test('S04: encender/apagar y borrar Lensflare no afecta otras luces', () => {
    const a = makeObject('light', 'omni', { id: 'a' }), b = makeObject('light', 'spot', { id: 'b' })
    a.light.flareOn = b.light.flareOn = true
    const ra = def.build(a), rb = def.build(b)
    def.update(ra, a); def.update(rb, b)
    assert.equal(ra.userData.flare.isLensflare, true)
    assert.equal(rb.userData.flare.isLensflare, true)
    assert.notEqual(ra.userData.flare, rb.userData.flare)
    assert.notEqual(ra.userData.flareElements[0].texture, rb.userData.flareElements[0].texture)
    ra.userData.disposeLightEffects()
    assert.equal(ra.userData.flare, null)
    assert.equal(rb.userData.flare.isLensflare, true)
    b.light.flareOn = false
    def.update(rb, b)
    assert.equal(rb.userData.flare, null)
    for (const root of [ra, rb]) root.traverse((o) => { o.geometry?.dispose(); o.material?.dispose() })
  })
  test('S04: actualización del Inspector no recrea un flare habilitado', () => {
    const o = makeObject('light', 'omni', { id: 'c' }); o.light.flareOn = true
    const root = def.build(o); def.update(root, o)
    const old = root.userData.flare
    o.light.flareSize = 122; o.color = '#ff0000'; def.update(root, o)
    assert.equal(old, root.userData.flare)
    assert.equal(root.userData.flareElements[0].size, 122)
    assert.equal(root.userData.flareElements[0].color.r, 1)
    root.userData.disposeLightEffects()
    root.traverse((n) => { n.geometry?.dispose(); n.material?.dispose() })
  })
}
