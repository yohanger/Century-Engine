// LF-UX-CMD-WINDOW-G001: verificaciones de integración del editor de comandos.
// La geometría visual definitiva se comprueba en Electron; estas pruebas evitan regresar al formulario estrecho.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { COMMANDS, visibleParams } from '../src/engine/runtime/events/commandDefs.js'

const editor = readFileSync(new URL('../src/components/EventEditor.vue', import.meta.url), 'utf8')
const windowCode = readFileSync(new URL('../src/components/AppWindow.vue', import.meta.url), 'utf8')
const form = readFileSync(new URL('../src/components/ParamForm.vue', import.meta.url), 'utf8')

test('CMD-WIN-01 · todos los comandos utilizan la ventana ancha y el script tiene más espacio', () => {
  assert.match(editor, /<AppWindow v-if="edit"[^\n]+:width="edit\.cmd\.code === 'script' \? 960 : 860"/)
  assert.doesNotMatch(editor, /edit\.cmd\.code === 'script' \? 720 : 460/)
})

test('CMD-WIN-02 · el alto continúa siendo automático y se limita a la pantalla', () => {
  assert.match(windowCode, /height: \{ type: Number, default: 0 \}/)
  assert.match(windowCode, /maxHeight: \(compact\.value \|\| maximized\.value \? r\.h : availH\.value\)/)
  assert.match(windowCode, /\.aw-content \{[^}]*overflow: auto/s)
  assert.match(editor, /:min-height="160"/)
  assert.doesNotMatch(editor, /<AppWindow v-if="edit"[^>]*:height=/)
})

test('CMD-WIN-03 · el formulario es horizontal sin cambiar los formularios de otros inspectores', () => {
  assert.match(editor, /class="dlg-body cmd-dlg"><ParamForm/)
  assert.match(editor, /\.cmd-dlg :deep\(\.pf > \.row:not\(\.t-code\):not\(\.t-route\):not\(\.t-list\)\)/)
  assert.match(editor, /grid-template-columns: minmax\(135px, 165px\) minmax\(0, 1fr\)/)
  assert.match(form, /const shown = computed\(\(\) => props\.params\.filter/)
})

test('CMD-WIN-04 · a menor anchura las etiquetas se apilan sin provocar scroll horizontal', () => {
  assert.match(editor, /@container win \(max-width: 590px\)/)
  assert.match(editor, /grid-template-columns: minmax\(0, 1fr\); gap: 4px/)
  assert.match(windowCode, /const compact = computed\(\(\) => !window\.lf\?\.isElectron && \(vp\.w < props\.compactBelow \|\| vp\.h < 440\)\)/)
})

test('CMD-WIN-05 · el selector de comandos conserva su ventana independiente', () => {
  assert.match(editor, /<AppWindow v-if="picker" title="Insertar comando" :width="760"/)
  assert.match(editor, /:min-width="360" :min-height="260" :level="50" persist="evpick"/)
})

test('CMD-WIN-06 · aceptar, cancelar y vista previa mantienen sus rutas anteriores', () => {
  assert.match(editor, /<ParamForm :params="COMMANDS\[edit\.cmd\.code\]\.params" :values="edit\.copy"/)
  assert.match(editor, /@click="previewOpen = true"/)
  assert.match(editor, /@click="edit = null">Cancelar/)
  assert.match(editor, /@click="okEdit">Aceptar/)
})

test('CMD-WIN-07 · los comandos siguen declarando sus parámetros sin duplicar formularios', () => {
  assert.ok(Object.keys(COMMANDS).length > 20)
  for (const [name, def] of Object.entries(COMMANDS)) {
    assert.ok(Array.isArray(def.params), `${name} sin params declarados`)
  }
  assert.ok(visibleParams('text', {}).length > 0)
})
