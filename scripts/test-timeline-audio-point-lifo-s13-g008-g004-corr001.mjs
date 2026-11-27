import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const fixture = read('scripts/fixtures/editor/timeline-audio-volume-automation-s11-g007-g002.html')
const runner = read('scripts/test-timeline-audio-volume-automation-s11-g007-g002-electron.mjs')
const timeline = read('src/components/TimelinePanel.vue')
const pcm = read('src/components/TimelineAudioSource.vue')

// Datos geométricos comprobados con los estilos existentes; no suplantan Electron.
const projected = (time, zoom, origin, scroll) => origin + time * zoom - scroll
const pcmStart = (clipStart, border, visibleWindowLeft) => clipStart + border + visibleWindowLeft

test('LIFO-CORR001-01 · la regresión histórica distingue borde decorativo y origen temporal', () => {
  assert.match(timeline, /\.lane \.key\.audio\s*\{[^}]*transform:none/)
  assert.match(timeline, /border-left:3px solid #0c1012/)
  assert.match(fixture, /getComputedStyle\(clip\(\)\)\.borderLeftWidth/)
  assert.match(fixture, /pcmRect\.left-clipRect\.left,borderLeft\+pcmWindowLeft/)
})
test('LIFO-CORR001-02 · la geometría de 24px + 70px/s conserva origen de clip y PCM interior', () => {
  const x = projected(1, 70, 24, 0)
  assert.equal(x, 94)
  assert.equal(pcmStart(x, 3, 0), 97)
  assert.equal(pcmStart(x, 3, 0) - x, 3)
})
test('LIFO-CORR001-03 · un desplazamiento PCM adicional es detectable, no se oculta con tolerancia', () => {
  const origin = 94, correct = pcmStart(origin, 3, 0), wrong = correct + 2
  assert.ok(Math.abs(correct - origin - 3) < 0.35)
  assert.ok(!(Math.abs(wrong - origin - 3) < 0.35))
  assert.match(fixture, /borderLeft\+pcmWindowLeft,\.35/)
})
test('LIFO-CORR001-04 · zoom y scroll conservan proyección y borde interior', () => {
  for (const zoom of [35,70,105,140,280]) for (const scroll of [0,36,72,240]) {
    const x = projected(1, zoom, 24, scroll)
    const pcmX = pcmStart(x,3,0)
    assert.equal(pcmX - x, 3)
  }
  assert.match(fixture, /zoomSlider\.value='105'/)
  assert.match(fixture, /timeScroll\.scrollLeft=72/)
  assert.match(fixture, /viewportProjection,newClipPx,1/)
})
test('LIFO-CORR001-05 · la ventana PCM puede empezar lejos del clip al hacer scroll', () => {
  assert.match(pcm, /:style="\{ left: drawWindow\.left \+ 'px', width: drawWindow\.width \+ 'px' \}"/)
  assert.equal(pcmStart(94,3,64),161)
  assert.match(fixture, /newBorder\+newWindow,\.35/)
})
test('LIFO-CORR001-06 · se conservan las 36 comprobaciones históricas y se añade una nueva', () => {
  assert.equal(fixture.split('\n').filter(x=>x.trimStart().startsWith('check(')).length,37)
  assert.match(fixture, /checks\.length===37/)
  assert.match(runner, /minChecks: 37/)
  for (const label of [
    'Punto del Inspector tiene ID estable',
    'Ctrl + doble clic crea segundo punto sin otra pista',
    'Pointercancel restaura todos los puntos',
    'La persistencia sigue conservando el punto restante',
  ]) assert.ok(fixture.includes(label), label)
})
test('LIFO-CORR001-07 · el diagnóstico devuelve coordenadas reales y no oculta un FAIL', () => {
  assert.match(fixture, /originGeometry=\{/)
  assert.match(fixture, /measured=\{/)
  assert.match(fixture, /checks\.every\(item=>item\.pass\)/)
  assert.doesNotMatch(fixture, /approx\(pcmRect\.left,clipRect\.left,1\)/)
})
test('LIFO-CORR001-08 · fixture y test Electron conservan sintaxis válida', () => {
  const scripts=[...fixture.matchAll(/<script(?:\s+type="module")?>([\s\S]*?)<\/script>/g)].map(x=>x[1])
  assert.equal(scripts.length,2)
  for (const src of [...scripts,runner]) {
    const {status,stderr}=spawnSync(process.execPath,['--check','--input-type=module'],{input:src,encoding:'utf8'})
    assert.equal(status,0,stderr)
  }
})
test('LIFO-CORR001-09 · no se modifica el protocolo del runner compartido ni el render de Audio', () => {
  assert.match(runner,/verifyWebGL/)
  assert.match(pcm, /audioWaveformPath/)
  assert.match(timeline,/TIME_ORIGIN_PX \+ time \* scale/)
})
