// Contrato histórico CA-001, sustituido por CA-002: render sigue existiendo, pero solo en menú Ver.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { RENDERERS, methodOf } from '../src/engine/runtime/render/config.js'
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const bar = read('src/components/ViewBar.vue')
const menu = read('src/core/commands.js')
const state = read('src/core/state/state.js')
const environment = read('src/engine/runtime/scene/environment.js')
const watchers = read('src/core/editor/keys.js')
const game = read('src/components/GameSettingsModal.vue')
const scene = bar.split('<template v-if="tab === \'scene\'">')[1]?.split('<template v-else>')[0]

test('VR-01 · CA-002 elimina de Escena selector erróneo de render', () => {
  assert.ok(scene)
  assert.doesNotMatch(scene,/render-choice|Método de render del viewport|RENDERERS/)
})
test('VR-02 · CA-002 conserva catálogo RENDERERS en el motor, no en la barra', () => {
  assert.deepEqual(RENDERERS.map(r=>r.id), ['forward','mobile','compat'])
  assert.doesNotMatch(bar, /import \{ RENDERERS|rendererLabels/)
})
test('VR-03 · no se confunden perfiles de render con dispositivos de navegación', () => {
  assert.doesNotMatch(bar, /Del proyecto|Compatibilidad|rendererLabels|projectRenderer/)
  assert.match(bar, /nav\.mouse/)
  assert.match(bar, /nav\.trackpad/)
})
test('VR-04 · el render de proyecto conserva su normalización', () => {
  assert.equal(methodOf({look:'clasico',profile:'alto'}), 'compat')
  assert.equal(methodOf({look:'realista',profile:'alto'}), 'forward')
  assert.equal(methodOf({look:'realista',profile:'medio'}), 'mobile')
})
test('VR-05 · Render continúa disponible por Ver, sin controles en ViewBar', () => {
  const b=menu.match(/add\('view\.renderOptions',[\s\S]*?\n  \]\s*\}\)/)?.[0]
  assert.ok(b)
  assert.match(b, /checked: !store\.view\.renderMethod/)
  assert.match(b, /\.\.\.RENDERERS\.map/)
  assert.match(b, /store\.view\.renderMethod = r\.id/)
  assert.doesNotMatch(bar, /store\.view\.renderMethod/)
})
test('VR-06 · project.render sigue inmutable desde ViewBar', () => {
  assert.doesNotMatch(bar, /project\.render|setRenderMethod|store\.view\.renderMethod/)
  assert.match(state, /view: \{ renderMethod: ''/)
  assert.match(environment, /const r = normalizeRender\(this\.host\.project\?\.render\), m = this\.host\.view\.renderMethod/)
  assert.match(environment, /if \(!m\) return r/)
})
test('VR-07 · los cambios del proyecto y de la vista comparten la actualización de render', () => {
  assert.match(watchers, /watch\(\[\(\) => store\.project\?\.render, \(\) => store\.view\.renderMethod\], \(\) => this\.applyRender\(\)/)
})
test('VR-08 · menú Ver conserva render y Edit Mesh no lo incorpora', () => {
  assert.match(menu, /add\('view\.renderOptions', 'Render del viewport'/)
  assert.match(menu, /'view\.renderOptions', '-', 'camera\.orbitSelection'/)
  assert.doesNotMatch(menu.split('export const MESH_MENU = ')[1]?.split('\n')[0]||'',/renderOptions/)
})
test('VR-09 · viewport angosto mantiene desplazamiento horizontal', () => {
  assert.match(bar, /\.vb \{[^}]*overflow-x: auto;/)
  assert.match(scene, /aria-label="Dispositivo de navegación"/)
})
test('VR-10 · la pantalla Juego y el render exportable siguen separados', () => {
  for (const name of ['gameAspect','gameScale','gameMaximize','gameMute']) assert.ok(bar.includes(name),name)
  assert.match(game, /setRenderMethod/)
  assert.match(menu, /add\('game\.settings'/)
  assert.doesNotMatch(bar, /new.*WebGLRenderer|new.*Window|editorFov|gizmoSize/)
})
