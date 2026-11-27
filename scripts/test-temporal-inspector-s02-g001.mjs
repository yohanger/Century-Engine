import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const src = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const timeline = src('src/components/TimelinePanel.vue')
const inspector = src('src/components/TemporalResourceInspector.vue')
const dock = src('src/components/InspectorDock.vue')
const state = src('src/core/state/state.js')
const assets = src('src/components/ProjectPanel.vue')

test('Inspección sintáctica de las vistas Vue vigentes y los módulos de estado modificados', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lf-s02-'))
  try {
    for (const file of ['src/components/TimelinePanel.vue', 'src/components/CinematicsPanel.vue', 'src/components/TemporalResourceInspector.vue', 'src/components/InspectorDock.vue', 'src/components/ProjectPanel.vue']) {
      const script = src(file).match(/<script setup>\s*([\s\S]*?)<\/script>/)?.[1]
      assert.ok(script, `${file}: script setup`)
      const target = join(dir, file.split('/').at(-1) + '.mjs')
      writeFileSync(target, script)
      const result = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8' })
      assert.equal(result.status, 0, `${file}: ${result.stderr}`)
    }
    for (const file of ['src/core/state/state.js', 'src/core/state/timelines.js', 'src/core/state/animation.js', 'src/core/state/project.js']) {
      const target = join(dir, file.split('/').at(-1) + '.mjs')
      writeFileSync(target, src(file))
      const result = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8' })
      assert.equal(result.status, 0, `${file}: ${result.stderr}`)
    }
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('Inspector único enruta recursos de Assets y selección temporal por IDs', () => {
  assert.match(dock, /TemporalResourceInspector v-else-if="tab === 'object' && temporal"/)
  assert.ok(dock.indexOf('<TemporalResourceInspector v-else-if=') < dock.indexOf('<ProfileEditor v-else-if='), 'La selección editorial del recurso temporal prevalece sobre el recurso anterior de Assets')
  assert.match(dock, /store\.temporalSelection/)
  assert.match(dock, /CinematicResourceInspector v-if=/) // El visor FilmMaker tiene prioridad de solo lectura.
  assert.match(assets, /store\.temporalSelection = null/)
  assert.match(state, /temporalSelection: null/)
  assert.match(state, /export function selectTemporal\(/)
  assert.match(state, /export function clearTemporal\(/)
  assert.match(state, /watch\(\(\) => store\.selectedId/)
  assert.match(src('src/core/state/project.js'), /store\.temporalSelection = null/)
})

test('Pistas, claves y eventos comparten la misma selección contextual sin columnas inspectoras laterales', () => {
  for (const [panel, type] of [[timeline, 'timeline']]) {
    assert.doesNotMatch(panel, /<aside class="insp">/)
    assert.match(panel, new RegExp("selectTemporal\\('" + type + "'"))
    assert.match(panel, new RegExp("clearTemporal\\('" + type + "'"))
    assert.match(panel, /pickTrack\(tr\)/)
    assert.match(panel, /store\.temporalEditRevision/)
    assert.match(panel, /store\.temporalSeek/)
    assert.match(panel, /grid-template-columns: minmax\(0, 1fr\);/)
  }
  assert.match(inspector, /selection\.value\?\.element === 'event'/)
  assert.match(inspector, /selection\.value\?\.element === 'key'/)
  assert.match(inspector, /track\.value\?\.keys\?\.find/)
})

test('Edición existente, preview, comandos, Bézier y física horneada conservan su integración', () => {
  assert.match(inspector, /<ParamForm :params="keyFields" :values="item"/)
  assert.match(inspector, /keyParams\(track\.value\)/)
  assert.match(inspector, /openEventEditor\(`tl:/)
  assert.match(inspector, /sortKeys\(track\.value\)/)
  assert.match(inspector, /item\.value\.bz/)
  assert.match(inspector, /Datos de solo lectura|datos de solo lectura/)
  assert.match(inspector, /store\.temporalEditRevision\+\+/)
  assert.match(inspector, /selectTemporal\(props\.kind, resource\.value\.id/)
  assert.match(timeline, /watch\(\[ph, ver, previewOn, tl/)
})

test('Modelo persistente no alterado y alcance S03/VS Code no incluido', () => {
  assert.doesNotMatch(state, /project\.temporalSelection/)
  assert.doesNotMatch(inspector, /vscode-extension|\.vsix|monaco/i)
  assert.match(inspector, /Las pistas y claves siguen perteneciendo al recurso existente/)
})
