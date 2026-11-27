import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const app = source('src/App.vue')
const fixture = source('scripts/fixtures/editor/timeline-preview-dialog-s12-g001.html')
const playback = source('src/core/timeline/playback-session.js')

test('S12-G001-CORR002-01 · App monta diálogo según estado reactivo, sin getter no reactivo', () => {
  assert.match(app, /<DialogPreview\s+v-if="!store\.play\.on && timelinePlayback\.dialog\.value"/)
  assert.doesNotMatch(app, /<DialogPreview[^>]*timelinePlayback\.active/)
  assert.match(app, /:timeline-dialog="timelinePlayback\.dialog\.value"/)
  assert.match(app, /:timeline-time="timelinePlayback\.time\.value"/)
})

test('S12-G001-CORR002-02 · misma condición condicional en fixture, con ciclo de montaje real', () => {
  assert.match(fixture, /app=createApp\(\{render:\(\)=>dialog\.value\s*\? h\(DialogPreview/)
  assert.match(fixture, /: null\}\)/)
  assert.match(fixture, /Antes de Play no se monta el diálogo/)
  assert.match(fixture, /Modo inline se monta al recibir un diálogo/)
  assert.match(fixture, /registerUiComponents\(app\)/)
})

test('S12-G001-CORR002-03 · Seek y Stop exigen desmontaje del overlay, sin cambiar el Runtime', () => {
  assert.match(fixture, /preview\.seek\(2\);clock\.value=preview\.time;await nextTick\(\)/)
  assert.match(fixture, /Seek desmonta UiRoot/)
  assert.match(fixture, /Seek desmonta el overlay del viewport/)
  assert.match(fixture, /Stop no deja overlay residual/)
  assert.doesNotMatch(app, /timelinePlayback\.caption\.value\s*&&/)
})

test('S12-G001-CORR002-04 · sesión usa el mismo ref y limpia diálogo en Stop', () => {
  assert.match(playback, /const time = ref\(0\).*dialog = ref\(null\)/)
  assert.match(playback, /onDialog: message => \{ dialog\.value = message/)
  assert.match(playback, /caption\.value='';dialog\.value=null;visual\.stop\(\)/)
})

test('S12-G001-CORR002-05 · fixture conserva prueba real de texto y color, no solo existencia de UI', () => {
  assert.match(fixture, /componente real de texto/)
  assert.match(fixture, /getComputedStyle\(colored\)\.color===expectedColor/)
  assert.match(fixture, /check\('WebGL activo'/)
})
