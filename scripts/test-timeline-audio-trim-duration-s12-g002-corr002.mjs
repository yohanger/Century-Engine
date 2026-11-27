import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const panel = readFileSync(fileURLToPath(new URL('src/components/TimelinePanel.vue', root)), 'utf8')
const fixture = readFileSync(fileURLToPath(new URL('scripts/fixtures/editor/timeline-audio-trim-duration-s12-g002.html', root)), 'utf8')
const getStyle = (selector) => panel.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`, 'm'))?.[1] || ''

test('S12-G002-CORR002-01 · clips Audio usan coordenadas de tiempo, sin desplazamiento de claves puntuales', () => {
  const audio = getStyle('\\.lane\\s+\\.key\\.audio')
  assert.match(audio, /transform\s*:\s*none\s*;/)
  assert.match(audio, /box-sizing\s*:\s*border-box\s*;/)
  assert.match(audio, /min-width\s*:\s*0\s*;/)
  const key = getStyle('\\.key')
  assert.match(key, /transform\s*:\s*translateX\(-7px\)/)
  assert.ok(panel.indexOf('.lane .key.audio {') > panel.indexOf('.key {'))
})

test('S12-G002-CORR002-02 · los marcadores de Cámara, Nodo y Métodos conservan su anclaje', () => {
  assert.match(panel, /\.key\.camera,\.key\.node,\.key\.method[^{}]*\{[^{}]*transform:\s*translateX\(-7px\)/)
  assert.match(panel, /\.lane \.key\.camera,\.lane \.key\.node\s*\{[^{}]*transform:\s*translateX\(-50%\)/)
})

test('S12-G002-CORR002-03 · el asa termina en la misma posición temporal del clip', () => {
  const tail = getStyle('\\.audio-duration-tail')
  assert.match(tail, /position\s*:\s*absolute/)
  assert.match(tail, /transform\s*:\s*translateX\(-100%\)/)
  // G008-G002: ambos extremos usan el mismo origen temporal compartido.
  assert.match(panel, /class="audio-duration-tail"[^\n]*left:timeToX\(k\.t \+ audioDisplayDuration\(k\)\)/)
  assert.match(panel, /class="key"[^\n]*left: timeToX\(k\.t\) \+ 'px'/)
  assert.match(panel, /audioDisplayDuration\(k\)\*zoom\+'px'/)
})

test('S12-G002-CORR002-04 · Electron comprueba geometría al cambiar zoom y offset/pitch antes del arrastre', () => {
  assert.match(fixture, /getBoundingClientRect\(\)\.right/)
  assert.match(fixture, /getBoundingClientRect\(\)\.left/)
  assert.match(fixture, /zoomControl\.value='105'/)
  assert.match(fixture, /Asa acompaña la duración efectiva tras offset y pitch/)
  assert.match(fixture, /Arrastrar extremo derecho recorta duración persistida/)
  assert.match(fixture, /Pista bloqueada impide recortes/)
  assert.match(fixture, /Selección nueva inicializa la duración según la fuente/)
  assert.doesNotMatch(fixture, /Math\.abs\(tails\(\)\[0\].*\)<10/)
})
