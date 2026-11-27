import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const src = (name) => readFileSync(new URL('../' + name, import.meta.url), 'utf8')
const scene = src('src/components/ScenePanel.vue')
const inspector = src('src/components/InspectorDock.vue')
const ownership = src('scripts/test-scene-inspector-ownership-s02-g001.mjs')
const fixture = src('scripts/fixtures/editor/inspector-scene-ux-cleanup-s13-g004.html')
const runner = src('scripts/test-inspector-scene-ux-cleanup-s13-g004-electron.mjs')
const sectionIds = [...scene.matchAll(/data-scene-fold="([\w-]+)"/g)].map(x => x[1])
const oldProps = ['environment', 'gameManagerId', 'transitions', 'bake', 'skyTop', 'weather', 'clouds', 'fog', 'time']
const unfold = () => {
  const start = scene.indexOf('const sceneFoldKey = ')
  const end = scene.indexOf('const pct =', start)
  assert.ok(start > 0 && end > start)
  const store = { prefs: { inspFold: { 'primitive:Transformación': true } }, project: { sentinel: true } }
  const fn = new Function('store', `${scene.slice(start, end)};return {sceneFoldKey,sceneFoldOpen,rememberSceneFold};`)
  return { store, ...fn(store) }
}

test('SCUX-01 · reutiliza ScenePanel y no crea un Inspector paralelo', () => {
  assert.match(scene, /<div class="sp" data-scene-inspector @toggle\.capture="rememberSceneFold">/)
  assert.match(inspector, /<Inspector v-else v-show=/)
  assert.doesNotMatch(scene, /new (?:SceneManager|FoldManager)|localStorage|sessionStorage|addEventListener/)
})
test('SCUX-02 · tres grupos semánticos de propiedad son plegables', () => {
  for (const id of ['scene', 'world', 'resources']) assert.match(scene, new RegExp(`<details class="ownership-group" data-owner-group="${id}" data-scene-fold="group-${id}"`))
  assert.equal((scene.match(/class="owner-heading"/g) || []).length, 3)
})
test('SCUX-03 · secciones GameManager, Transiciones, Iluminación, Clima y Cielo conservan controles', () => {
  for (const id of ['game-manager','scene-transitions','world-celestial','world-weather','world-sky']) assert.ok(sectionIds.includes(id), id)
  for (const name of ['Fade In al entrar','Fade Out al salir','GameManager','Clima y atmósfera','Cielo','Iluminación celestial']) assert.ok(scene.includes(name), name)
})
test('SCUX-04 · los 18 apartados tienen clave semántica única', () => {
  assert.equal(sectionIds.length, 18)
  assert.equal(new Set(sectionIds).size, sectionIds.length)
  assert.ok(sectionIds.every(id => /^[a-z][a-z0-9-]+$/.test(id)))
})
test('SCUX-05 · los bloques previously details conservan el estado inicial cerrado', () => {
  for (const id of ['world-level','world-clouds','world-fog','world-volumetric','world-water','resources-bake','world-sky-physical']) {
    assert.match(scene, new RegExp(`data-scene-fold="${id}"[^>]*:open="sceneFoldOpen\\('${id}'\\)"`))
  }
})
test('SCUX-06 · los grupos y las secciones que ya eran abiertas siguen abiertas por defecto', () => {
  for (const id of ['group-scene','group-world','group-resources','game-manager','scene-transitions','world-celestial','world-weather','world-sky']) {
    assert.match(scene, new RegExp(`data-scene-fold="${id}" data-fold-default="open"`))
  }
})
test('SCUX-07 · las claves de plegado no contienen título ni ID mutable', () => {
  const {sceneFoldKey,sceneFoldOpen} = unfold()
  assert.equal(sceneFoldKey('world-fog'), 'fold:scene:world-fog')
  assert.equal(sceneFoldOpen('world-fog'), false)
  assert.equal(sceneFoldOpen('world-weather',true), true)
})
test('SCUX-08 · persistir el cierre solo modifica inspFold y conserva claves anteriores', () => {
  const {store,rememberSceneFold,sceneFoldOpen} = unfold()
  const before=JSON.stringify(store.project)
  const el={matches:()=>true,dataset:{sceneFold:'group-world',foldDefault:'open'},open:false}
  rememberSceneFold({target:el})
  assert.equal(sceneFoldOpen('group-world',true),false)
  assert.equal(store.prefs.inspFold['primitive:Transformación'],true)
  assert.equal(JSON.stringify(store.project),before)
})
test('SCUX-09 · desplegar revierte la preferencia sin emitir historial', () => {
  const {store, rememberSceneFold,sceneFoldOpen}=unfold()
  store.prefs.inspFold['fold:scene:world-fog']=true
  rememberSceneFold({target:{matches:()=>true,dataset:{sceneFold:'world-fog'},open:true}})
  assert.equal(sceneFoldOpen('world-fog'),true)
  assert.equal(store.prefs.inspFold['fold:scene:world-fog'],false)
})
test('SCUX-10 · eventos de otros controles no mutan preferencias ni proyecto', () => {
  const {store,rememberSceneFold}=unfold()
  const before=JSON.stringify(store)
  rememberSceneFold({target:{matches:()=>false, dataset:{sceneFold:'world-fog'},open:true}})
  assert.equal(JSON.stringify(store),before)
})
test('SCUX-11 · no genera entradas redundantes al montar o recibir toggle programático', () => {
  const {store,rememberSceneFold}=unfold()
  const before=JSON.stringify(store.prefs.inspFold)
  rememberSceneFold({target:{matches:()=>true,dataset:{sceneFold:'group-scene',foldDefault:'open'},open:true}})
  assert.equal(JSON.stringify(store.prefs.inspFold),before)
})
test('SCUX-12 · párrafos de ayuda activos retirados sin desactivar avisos críticos', () => {
  const active=scene.split('<!-- OBSOLETO y oculto:')[0]
  assert.doesNotMatch(active, /class="hint lf-help"|class="owner-description"|<h4>Tipo de cielo<\/h4>/)
  for (const attr of ['data-authority="weather"','data-authority="sky"','data-authority="clouds"','data-authority="fog"']) assert.ok(active.includes(attr))
  assert.match(active, /Sin panoramas HDRI en Assets/)
  assert.match(active, /El bake está desactualizado/)
})
test('SCUX-13 · el estado importante permanece visible en títulos plegados', () => {
  assert.match(scene, /summary class="owner-heading"[^\n]*Sin luz solar/)
  assert.match(scene, /summary class="owner-heading"[^\n]*Horneado desactualizado/)
  assert.match(scene, /data-scene-fold="world-sky"[\s\S]{0,250}Sin panoramas HDRI/)
})
test('SCUX-14 · no ha sido alterada la autoridad World ni el reset histórico', () => {
  for (const exact of ["resetSection('all')", "resetSection('weather')", "resetSection('sky')", "resetSection('celestial')",'const bake = env().bake','const weatherConfigured = () => !!env().weather?.on']) assert.ok(scene.includes(exact), exact)
  assert.match(scene, /data-authority="weather"/)
  assert.match(scene, /data-authority="fog"/)
  assert.match(ownership, /data-authority=\"clouds\"/)
})
test('SCUX-15 · bake conserva progreso, cancelación, parámetros y estado', () => {
  for (const k of ['runBake','cancelBake','clearBake','updateBake','store.bake.running','store.bake.state.stale','paramsChanged()','store.view.bake']) assert.ok(scene.includes(k),k)
})
test('SCUX-16 · etiquetas activas compactas pero sin pérdida de propiedades', () => {
  assert.match(scene, /<output>\{\{ wind\(\)\[1\] \}\} · Beaufort/)
  assert.match(scene, /Luces de bake/)
  assert.match(scene, /const lightsInfo =/)
})
test('SCUX-17 · no altera el gestor de tooltips ni el Player', () => {
  assert.doesNotMatch(scene, /import .*tooltips|updateSettings\(\{ tooltips/)
  assert.match(scene, /<section v-if="false">/)
  for(const k of oldProps)assert.ok(scene.includes(k),k)
})
test('SCUX-18 · plegado nativo con foco visible y límites de ancho', () => {
  assert.match(scene,/\.sp details > summary:focus-visible/)
  assert.match(scene,/\.ownership-group \{[^}]*min-width: 0/)
  assert.match(scene,/grid-template-columns: minmax\(0, 96px\) minmax\(0, 1fr\)/)
})
test('SCUX-19 · fixture real exige recuento exacto y resultado por check', () => {
  const checks=(fixture.match(/\bcheck\('/g) || []).length
  const match=fixture.match(/checks\.length === (\d+)/)
  assert.ok(match,'Fixture mantiene recuento exacto')
  assert.equal(checks,Number(match[1]),`Fixture implementa ${checks} checks y declara ${match[1]}`)
  assert.match(fixture,/checks\.every\(c => c\.pass\)/)
  assert.match(runner,new RegExp(`minChecks: ${checks}\\b`))
})
test('SCUX-20 · fixture y runner JavaScript válidos', () => {
  const js=fixture.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(js)
  const args=['--check','--input-type=module']
  execFileSync(process.execPath,args,{input:js})
  execFileSync(process.execPath,['--check',new URL('./test-inspector-scene-ux-cleanup-s13-g004-electron.mjs', import.meta.url).pathname])
})
