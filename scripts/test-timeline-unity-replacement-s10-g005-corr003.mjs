import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const panel = readFileSync(new URL('../src/components/TimelinePanel.vue', import.meta.url), 'utf8')
const sourceModel = readFileSync(new URL('../src/core/timeline/model.js', import.meta.url), 'utf8')
const inspector = readFileSync(new URL('../src/components/TemporalResourceInspector.vue', import.meta.url), 'utf8')
const after = (start, end) => panel.slice(panel.indexOf(start), panel.indexOf(end, panel.indexOf(start)))
const bracket = after('<div class="duration-overlay"', '</div>')
const styling = panel.slice(panel.indexOf('/* CORR-003: UN solo corchete global'))

function actualPosition(duration, zoom, scrollLeft) {
  const found = panel.match(/const durationBoundaryX = computed\(\(\) => ([^\n]+)\)/)
  assert.ok(found, 'Debe derivar el X del recurso, zoom y scroll, no guardar otro tiempo')
  return vm.runInNewContext(found[1], {
    tl: {value:{duration}}, zoom:{value:zoom}, durationScrollX:{value:scrollLeft},
    timeToX: time => 24 + time * zoom,
  })
}

test('CORR003-01 · un solo control global, no botón corto más línea', () => {
  assert.equal((panel.match(/class="duration-grip"/g)||[]).length, 1)
  assert.equal((panel.match(/class="duration-overlay"/g)||[]).length, 1)
  assert.doesNotMatch(panel, /class="duration-boundary"|<span class="endmark"/)
  assert.match(bracket, /<button class="duration-grip"/)
})
test('CORR003-02 · corchete único abarca de principio a fin del viewport útil', () => {
  assert.match(styling, /\.duration-grip \{[^}]*top:0;bottom:0;height:100%;/)
  assert.match(styling, /border-right:3px solid #eac471/)
  assert.match(styling, /\.duration-grip::before \{ top:0; \}/)
  assert.match(styling, /\.duration-grip::after \{ bottom:0; \}/)
  assert.doesNotMatch(styling, /\.duration-boundary/)
})
test('CORR003-03 · overlay es hermano del scroll y no depende del número de pistas', () => {
  const scrollEnd = panel.indexOf('</div>\n        <div class="duration-overlay"')
  assert.ok(scrollEnd > panel.indexOf('ref="scroller" class="scroll"'))
  assert.ok(scrollEnd < panel.indexOf('</div>\n      <TimelineCurveEditor'))
  assert.match(styling, /\.main \{ position:relative; \}/)
  assert.match(styling, /\.duration-overlay \{ position:absolute;top:0;right:0;/)
  assert.doesNotMatch(bracket, /visibleRows|tracks\.length|pinnedRows|scrollTop/)
})
test('CORR003-04 · columna fija nunca se cubre y su anchura sigue siendo dinámica', () => {
  assert.match(bracket, /:style="\{ left: headerWidth \+ 'px', height: durationViewportHeight/)
  assert.match(panel, /class="pinned-column" :style="\{ width: headerWidth \+ 'px' \}"/)
  assert.match(styling, /\.duration-overlay \{[^}]*overflow:hidden/)
})
test('CORR003-05 · el corchete reacciona al scroll horizontal nativo del mismo scroller', () => {
  assert.match(panel, /@scroll\.passive="syncTimelineScroll"/)
  assert.match(panel, /durationScrollX\.value = element\.scrollLeft/)
  assert.equal(actualPosition(6, 70, 0), 444)
  assert.equal(actualPosition(6, 70, 100), 344)
  assert.equal(actualPosition(6, 70, 420), 24)
  assert.equal(actualPosition(6, 70, 470), -26)
})
test('CORR003-06 · el zoom y duración cambian el X sin cambiar el scroll ni crear segunda duración', () => {
  assert.equal(actualPosition(10, 50, 100), 424)
  assert.equal(actualPosition(10, 25, 100), 174)
  assert.equal(actualPosition(14, 25, 100), 274)
  assert.match(panel, /:style="\{ left: durationBoundaryX \+ 'px' \}"/)
})
test('CORR003-07 · el scroll vertical no desplaza un remate fuera del viewport', () => {
  assert.match(panel, /durationViewportHeight\.value = scroller\.value\.clientHeight/)
  assert.match(panel, /resizeObserver\.observe\(element\)/)
  assert.match(panel, /resizeObserver\.observe\(element\.parentElement\)/)
  assert.match(styling, /\.duration-overlay \{ position:absolute;/)
  assert.doesNotMatch(bracket, /scrollTop|transform:translateY/)
})
test('CORR003-08 · controles del cabezal de duración reutilizados sin nuevos estados de modelo', () => {
  assert.match(bracket, /role="slider" tabindex="0"/)
  assert.match(bracket, /:aria-valuenow="tl\.duration"/)
  assert.match(bracket, /:aria-valuemin="timelineMinDuration\(tl\)"/)
  assert.match(bracket, /@pointerdown\.stop\.prevent="beginDurationResize"/)
  assert.match(bracket, /@keydown\.stop="durationKeydown"/)
  assert.match(panel, /commit\('Redimensionar duración del Timeline'\)/)
})
test('CORR003-09 · no cubre toda la gráfica de eventos ni los manejadores de clip', () => {
  assert.match(styling, /\.duration-overlay \{[^}]*pointer-events:none/)
  assert.match(styling, /\.duration-grip \{[^}]*width:15px;/)
  assert.match(styling, /touch-action:none;pointer-events:auto/)
  assert.match(panel, /@pointerdown\.stop="clipDragDown\(\$event,row\.track,clip\)"/)
  assert.match(panel, /@pointerdown\.stop\.prevent="clipDragDown\(\$event,row\.track,clip,true\)"/)
})
test('CORR003-10 · cambio limitado a presentación: fuente/Inspector no necesitan nuevos datos', () => {
  assert.match(sourceModel, /export function timelineMinDuration\(/)
  assert.match(inspector, /timelineMinDuration\(resource\.value\)/)
  assert.doesNotMatch(bracket, /track\.keys|durationOverride|newTrack|runtime/)
})
test('CORR003-11 · regla de scroll vertical y cabeceras fijas no fue reemplazada', () => {
  assert.match(panel, /pinnedRows\.value\.style\.transform = `translateY\(\$\{-element\.scrollTop\}px\)`/)
  assert.match(panel, /function forwardPinnedWheel\(/)
  assert.match(panel, /element\.scrollTop \+= event\.deltaY/)
  assert.match(panel, /element\.scrollLeft \+= event\.deltaX/)
  assert.match(panel, /class="timeline-marquee"/)
})
test('CORR003-12 · compilación Vue del componente real cuando la dependencia exista', async t => {
  let sfc
  try { sfc = await import('@vue/compiler-sfc') }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') { t.skip('Compilador Vue ausente; QA en Electron local'); return }
    throw error
  }
  const parsed = sfc.parse(panel, {filename:'TimelinePanel.vue'})
  assert.deepEqual(parsed.errors, [])
  const compiled = sfc.compileTemplate({source:parsed.descriptor.template.content,filename:'TimelinePanel.vue',id:'corr003'})
  assert.deepEqual(compiled.errors, [])
})
