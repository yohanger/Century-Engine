import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { newKey, newTrack, newTimeline, normalizeTimeline, resizeTimelineAudioFade } from '../src/core/timeline/model.js'

const file = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')
const fixture = file('scripts/fixtures/editor/timeline-audio-fade-handles-s11-g007-g001.html')
const panel = file('src/components/TimelinePanel.vue')
const runner = file('scripts/test-timeline-audio-fade-handles-s11-g007-g001-electron.mjs')
const setup = () => {
  const key = newKey('audio', 2, { id:'fade-key', clip:'prueba-fade.wav', duration:4, fadeIn:.5, fadeOut:.75 })
  const timeline = newTimeline('QA Fade Handles', {
    id:'timeline-fade', duration:14,
    tracks:[newTrack('audio', { id:'track-fade', keys:[key] })],
  })
  const set = seconds => resizeTimelineAudioFade(timeline, 'track-fade', 'fade-key', 'fadeOut', seconds, 4)
  const stored = () => normalizeTimeline(JSON.parse(JSON.stringify(timeline))).tracks[0].keys[0]
  return { key, set, stored }
}
const delta = -70
const zoom = 70
const original = .75

const oldChecks = [
  'Timeline existente monta en Editor',
  'Solo una pista Audio original',
  'Curva de fundidos sobre el clip',
  'Fade In tiene un control de teclado',
  'Fade Out tiene un control de teclado',
  'Fade In indica valor original',
  'Fade Out indica valor original',
  'Fuente completa sin análisis no inventa fundido de salida',
  'Fuente completa sin análisis no inventa tramo de entrada',
  'Curva no intercepta clic sobre audio',
  'Clip conserva ancho temporal',
  'Fade In situado en el tiempo real',
  'Fade Out situado en el tiempo real',
  'Proyecto sin mutaciones en montaje',
  'Arrastre entrada suma un segundo',
  'Arrastre no modifica Fade Out',
  'Arrastre no mueve el clip ni cambia duración',
  'Asa de entrada se sincroniza',
  'No aparecen nuevas pistas',
  'Pointercancel revierte edición',
  'Home restablece Fade In a cero',
  'ArrowRight ajusta Fade In con Snap',
  'Pista bloqueada protege los fundidos',
  'Campos originales serializados',
  'duration=0 sigue siendo fuente completa',
  'No se agregaron recursos a Cinematics',
]

test('G007-G001-CORR001-01 · Snap 0.1 usa el cálculo real del Editor y serializa 1.8 s', () => {
  assert.match(panel, /const rounded = snap\.value \? Math\.round\(desired \/ snap\.value\) \* snap\.value : desired/)
  const {key,set,stored} = setup()
  const desired = original - delta / zoom
  const snapped = Math.round(desired / .1) * .1
  assert.equal(desired, 1.75)
  assert.equal(snapped, 1.8)
  assert.equal(set(+snapped.toFixed(5)), true)
  assert.equal(key.fadeOut, 1.8)
  assert.deepEqual([stored().fadeOut,stored().duration,stored().t,stored().clip],[1.8,4,2,'prueba-fade.wav'])
})

test('G007-G001-CORR001-02 · Libre no aplica Snap y serializa 1.75 s exactos', () => {
  const {key,set,stored} = setup()
  const desired = original - delta / zoom
  const snap = 0
  const value = snap ? Math.round(desired / snap) * snap : desired
  assert.equal(value,1.75)
  assert.equal(set(value),true)
  assert.deepEqual([key.fadeIn,key.fadeOut,key.t,key.duration],[.5,1.75,2,4])
  assert.deepEqual([stored().fadeIn,stored().fadeOut,stored().duration,stored().clip],[.5,1.75,4,'prueba-fade.wav'])
})

test('G007-G001-CORR001-03 · fixture cambia Snap mediante v-model de Vue y no inventa valores', () => {
  assert.match(panel, /<select v-model\.number="snap" aria-label="Intervalo de ajuste"/)
  assert.match(panel, /<option :value="0">Libre<\/option>/)
  assert.match(fixture, /control\.dispatchEvent\(new Event\('change',\{bubbles:true\}\)\)/)
  assert.match(fixture, /await setSnap\(0\)/)
  assert.match(fixture, /await setSnap\(\.1\)/)
  assert.match(fixture, /await drag\(last\(\),73\.5\)/)
  assert.match(fixture, /eq\(current\(\)\.fadeOut,1\.8\)/)
  assert.match(fixture, /eq\(current\(\)\.fadeOut,\.75\)/)
  assert.match(fixture, /eq\(current\(\)\.fadeOut,1\.75\)/)
})

test('G007-G001-CORR001-04 · serialización se comprueba tanto con Snap como en modo Libre', () => {
  assert.match(fixture, /const snapped=serializedFade\(\)/)
  assert.match(fixture, /snapped\.saved\?\.fadeOut===1\.8/)
  assert.match(fixture, /const free=serializedFade\(\)/)
  assert.match(fixture, /eq\(free\.saved\?\.fadeOut,1\.75\)/)
  assert.match(fixture, /const serialized=JSON\.parse\(JSON\.stringify\(store\.project\.timelines\)\)/)
  assert.match(fixture, /serialized\[0\]\.tracks\[0\]\.keys\[1\]\.duration===0/)
})

test('G007-G001-CORR001-05 · conserva los contratos originales sin relajar el mínimo Electron', () => {
  for(const label of oldChecks) {
    if(label==='Campos originales serializados') continue
    assert.ok(fixture.includes(`'${label}'`),`Se perdió la comprobación: ${label}`)
  }
  assert.match(fixture, /check\('Campos originales serializados'/)
  assert.match(fixture, /checks\.length===34&&checks\.every\(check=>check\.pass\)/)
  assert.match(fixture, /check\('Pointercancel revierte edición'/)
  assert.match(fixture, /check\('Pista bloqueada protege los fundidos'/)
  assert.match(fixture, /check\('No se agregaron recursos a Cinematics'/)
  assert.match(runner,/minChecks:34/)
})

test('G007-G001-CORR001-06 · ambos bloques JavaScript de la fixture son sintácticamente válidos', () => {
  const scripts = [...fixture.matchAll(/<script(?: type="module")?>([\s\S]*?)<\/script>/g)]
  assert.equal(scripts.length,2)
  for(const [,source] of scripts){
    const checked=spawnSync(process.execPath,['--check','--input-type=module','-'],{input:source,encoding:'utf8'})
    assert.equal(checked.status,0,checked.stderr)
  }
})
