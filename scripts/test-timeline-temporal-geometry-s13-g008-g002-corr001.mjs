// CORR-001 · El instante del marcador corresponde a su centro visual (translateX(-50%)).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import vm from 'node:vm'

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8')
const fixture = read('scripts/fixtures/editor/timeline-temporal-geometry-s13-g008-g002.html')
const timeline = read('src/components/TimelinePanel.vue')
const runner = read('scripts/test-timeline-temporal-geometry-s13-g008-g002-electron.mjs')
const helper = fixture.match(/ const markerClipAlignment=\(\)=>\{[\s\S]*?\n \}/)?.[0]
const predicate = fixture.match(/ const markerAligned=\(value\)=>[^\n]+/)?.[0]

function measure({ zoom = 140, scrollLeft = 220, markerShift = 0, clipShift = 0, rulerShift = 0, source = helper } = {}) {
  const local = 24 + 3 * zoom
  const rulerLeft = 120 - scrollLeft
  const markerCenter = rulerLeft + local + markerShift
  const marker = { style: { left: `${local}px` }, rect: { left: markerCenter - 7, width: 14 } }
  const clip = { rect: { right: rulerLeft + local + clipShift } }
  const ruler = { rect: { left: rulerLeft + rulerShift } }
  const scroller = { scrollLeft }
  const sandbox = {
    $: selector => selector === '.timeline-marker' ? marker : null,
    clip: id => id === '2s' ? clip : null,
    rect: el => el?.rect,
    ruler: () => ruler,
    scroll: () => scroller,
    left: el => parseFloat(el?.style.left || 'NaN'),
    approx: (a, b, tol = 1.1) => Number.isFinite(a) && Math.abs(a - b) <= tol,
  }
  const result = vm.runInNewContext(`${source}\n${predicate}\n;({ measure:markerClipAlignment, aligned:markerAligned })`, sandbox)
  const positions = result.measure()
  return { positions: JSON.parse(JSON.stringify(positions)), aligned: result.aligned(positions) }
}

test('GEO-CORR001-01 · marcador de 14px está centrado mediante translateX(-50%)', () => {
  assert.match(timeline, /\.timeline-marker\s*\{[^}]*transform:translateX\(-50%\);width:14px;/)
  assert.ok(helper && predicate, 'La fixture debe definir medición y predicado de alineación')
})

test('GEO-CORR001-02 · mide el centro y el extremo del clip, nunca el borde izquierdo', () => {
  assert.match(helper, /mr\.left\+mr\.width\/2/)
  assert.match(helper, /clipEnd:cr\?\.right/)
  assert.match(helper, /projected:rr\s*\?\s*rr\.left\+left\(marker\)/)
  assert.match(predicate, /approx\(value\.markerCenter,value\.clipEnd,1\.1\)/)
  assert.match(predicate, /approx\(value\.markerCenter,value\.projected,1\.1\)/)
  assert.doesNotMatch(fixture, /approx\(rect\(\$\('\.timeline-marker'\)\)\.left,rect\(ruler\(\)\)\.left/)
})

test('GEO-CORR001-03 · centro, extremo y proyección coinciden en distintos zoom/scroll', () => {
  for (const zoom of [70, 140, 200]) {
    for (const scrollLeft of [0, 40, 220, 500]) {
      const result = measure({ zoom, scrollLeft })
      assert.equal(result.aligned, true, JSON.stringify({ zoom, scrollLeft, result }))
      assert.equal(result.positions.markerCenter, result.positions.clipEnd)
      assert.equal(result.positions.markerCenter, result.positions.projected)
    }
  }
})

test('GEO-CORR001-04 · desplazamiento real del marcador se detecta como regresión', () => {
  assert.equal(measure({ markerShift: 3 }).aligned, false)
  assert.equal(measure({ clipShift: -3 }).aligned, false)
  assert.equal(measure({ rulerShift: 3 }).aligned, false)
})

test('GEO-CORR001-05 · la antigua comparación contra el borde falla correctamente', () => {
  const defective = helper.replace('mr.left+mr.width/2', 'mr.left')
  assert.notEqual(defective, helper)
  assert.equal(measure({ source: defective }).aligned, false)
})

test('GEO-CORR001-06 · la fixture compara antes y después del desplazamiento', () => {
  assert.match(fixture, /check\('Marcador mantiene alineación a zoom 140',[^\n]*markerAligned\(markerClipAlignment\(\)\)/)
  assert.match(fixture, /sc\.scrollLeft=220;sc\.dispatchEvent\(new Event\('scroll'\)\);await flush\(\)/)
  assert.match(fixture, /check\('Marcador y clip siguen alineados al desplazar',markerAligned\(markerClipAlignment\(\)\),markerClipAlignment\(\)\)/)
})

test('GEO-CORR001-07 · no se reduce cobertura Electron ni se cambia el runner oficial', () => {
  assert.equal((fixture.match(/\bcheck\('/g) || []).length, 43)
  assert.match(fixture, /checks\.length===43/)
  assert.match(runner, /minChecks:43/)
  assert.match(fixture, /check\('La banda Audio mantiene duración exacta de 2 segundos'/)
  assert.match(fixture, /check\('Clic en segundo 2 desplaza cabezal al tiempo 2'/)
})

test('GEO-CORR001-08 · fixture y pruebas preservan sintaxis JavaScript', () => {
  const path = new URL('../scripts/test-timeline-temporal-geometry-s13-g008-g002-corr001.mjs', import.meta.url).pathname
  const check = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' })
  assert.equal(check.status, 0, check.stderr)
  for (const [, attrs, js] of fixture.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const syntax = spawnSync(process.execPath, [`--input-type=${attrs.includes('module') ? 'module' : 'commonjs'}`, '--check'], { input: js, encoding: 'utf8' })
    assert.equal(syntax.status, 0, syntax.stderr)
  }
})
