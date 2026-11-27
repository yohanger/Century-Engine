import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const file = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const fixture = file('scripts/fixtures/editor/inspector-audio-volume-points-s12-g007-g001.html')
const runner = file('scripts/test-inspector-audio-volume-points-s12-g007-g001-electron.mjs')
const originalNames = [
  'Inspector Audio real montado',
  'El encabezado principal muestra la sección',
  'El apartado inicia expandido',
  'No se crean nombres al montar',
  'El texto documental no se muestra',
  'El Inspector conserva fuente y propiedades del clip',
  'Botón Añadir punto habilitado',
  'La sección se contrae',
  'Los campos quedan ocultos sin eliminar audio',
  'Contraer no modifica proyecto',
  'El apartado se reabre normalmente',
  'Alta crea un punto persistente y nombrado',
  'Solo una pista Audio y fuente original',
  'Encabezado Punto-1 existente',
  'Punto nuevo inicia expandido',
  'Campos Nombre, Tiempo y Factor presentes',
  'Renombrar persiste el valor personalizado',
  'La etiqueta refleja el nombre cambiado',
  'El nombre editado no añade controles paralelos',
  'El nombre nuevo conserva ID y parámetros',
  'La serialización conserva el nombre',
  'Nombre vacío rechazado y control restaurado',
  'Un punto se contrae sin modificar su curva',
  'El punto recupera sus propiedades',
  'Renombrar no altera el volumen base ni los fundidos',
  'Seis puntos visibles como encabezados independientes',
  'Etiquetas generadas sin duplicación',
  'La lista recibe clase de scroll desde cinco',
  'Scroll limitado y vertical',
  'Contenido largo excede altura visible',
  'Puntos pueden abrirse independientemente',
  'Cerrar un punto no cierra otro',
  'Añadir puntos no modifica nombre personalizado anterior',
  'Seis puntos persisten al serializar',
  'El orden serializado conserva tiempos y IDs',
  'Los puntos históricos sin nombre siguen sin migración',
  'Duplicar clave conserva nombres personalizados',
  'Duplicación mantiene independencia de objetos',
  'Editor no añade recursos a Cinematics',
  'Collapsar no cambia interpolación',
]

function simulatedElectronResult(count, failedIndex = -1) {
  const script = [...fixture.matchAll(/<script(?: type="module")?>([\s\S]*?)<\/script>/g)]
  assert.equal(script.length, 2)
  const element = { dataset: {}, textContent: '' }
  const window = { addEventListener() {} }
  const document = {
    getElementById(id) {
      assert.equal(id, 'lf-inspector-volume-points-s12-g007-g001-result')
      return element
    },
    createElement(tag) {
      assert.equal(tag, 'canvas')
      return { getContext: kind => kind === 'webgl' ? {} : null }
    },
  }
  runInNewContext(script[0][1], { document, window, setTimeout: () => 1, clearTimeout() {}, Error })
  const api = window.__lfVolumePointsQa
  assert.ok(api, 'La fixture debe registrar el colector real de comprobaciones')
  for (let i = 0; i < count; i++) api.check(originalNames[i], i !== failedIndex)
  api.finish()
  return { status: element.dataset, report: JSON.parse(element.textContent) }
}

test('INS-CORR001-01 · 40 aserciones únicas originales permanecen en la fixture', () => {
  const names = [...fixture.matchAll(/\bcheck\('([^']+)'/g)].map(match => match[1])
  assert.deepEqual(names, originalNames)
  assert.equal(new Set(names).size, 40)
})

test('INS-CORR001-02 · fixture y runner exigen exactamente 40, no el antiguo valor 36', () => {
  assert.match(fixture, /checks\.length===40&&checks\.every\(c=>c\.pass\)/)
  assert.doesNotMatch(fixture, /checks\.length===36/)
  assert.match(runner, /minChecks:\s*40\b/)
  assert.doesNotMatch(runner, /minChecks:\s*36\b/)
})

test('INS-CORR001-03 · 40 comprobaciones satisfactorias generan PASS real en el colector de Electron', () => {
  const { status, report } = simulatedElectronResult(40)
  assert.equal(status.pass, 'true')
  assert.equal(status.stage, 'final:PASS')
  assert.equal(status.checks, '40')
  assert.equal(report.pass, true)
  assert.equal(report.checks.length, 40)
  assert.ok(report.checks.every(check => check.pass))
})

test('INS-CORR001-04 · 39 comprobaciones no permiten PASS parcial', () => {
  const { status, report } = simulatedElectronResult(39)
  assert.equal(status.pass, 'false')
  assert.equal(report.pass, false)
  assert.equal(report.checks.length, 39)
})

test('INS-CORR001-05 · 40 comprobaciones con un fallo real generan FAIL', () => {
  const { status, report } = simulatedElectronResult(40, 23)
  assert.equal(status.pass, 'false')
  assert.equal(report.pass, false)
  assert.equal(report.checks.filter(check => !check.pass).length, 1)
})

test('INS-CORR001-06 · se preserva diagnóstico por etapa y vigilancia del runner', () => {
  assert.match(fixture, /el\.dataset\.stage=stage/)
  assert.match(fixture, /el\.dataset\.checks=String\(checks\.length\)/)
  assert.match(fixture, /Watchdog en/)
  assert.match(fixture, /checks\.push\(\{name,pass:!!passed/)
  assert.match(runner, /verifyWebGL/)
  assert.match(runner, /fixtureWaitMs:42000/)
})
