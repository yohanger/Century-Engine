// Contrato para el experimento de versiones, sin ejecutar npm ni alterar el proyecto.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, existsSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
const script = new URL('./qa-three-version-candidates.mjs', import.meta.url).pathname
const root = resolve(import.meta.dirname, '..')
const run = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' })
test('VERSION-STAGE-01 · reconoce r186.1 integrado y no altera el baseline en --check', () => {
  const p = readFileSync(join(root, 'package-lock.json'), 'utf8')
  const runCheck = run('--check')
  assert.equal(runCheck.status, 0, runCheck.stderr)
  assert.match(runCheck.stdout, /VALIDACIÓN DE ADOPCIÓN PASS/)
  assert.match(runCheck.stdout, /Three.js: 0\.186\.1/)
  assert.equal(readFileSync(join(root, 'package-lock.json'), 'utf8'), p)
})
test('VERSION-STAGE-02 · documenta orden obligatorio de etapas', () => {
  const result = run('--help')
  assert.equal(result.status, 0)
  assert.match(result.stdout, /--stage=r180/)
  assert.match(result.stdout, /--stage=r186\.1/)
})
test('VERSION-STAGE-03 · rechaza ruta de salida dentro del motor', () => {
  const r = run('--stage=r180', `--output=${join(root, '__qa_three')}`)
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /fuera del proyecto original/)
  assert.equal(existsSync(join(root, '__qa_three')), false)
})
test('VERSION-STAGE-04 · el runner histórico no permite reinstalar r186.1', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'lf-three-stage-'))
  try {
    const r = run('--stage=r186.1', `--output=${join(tmp, 'report')}`)
    assert.notEqual(r.status, 0)
    assert.match(r.stderr, /Migración ya integrada/)
  } finally { rmSync(tmp, { recursive: true, force: true }) }
})
test('VERSION-STAGE-05 · versión ilegítima no inicia instalación', () => {
  const r = run('--stage=r999')
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /Etapa inválida/)
})
test('VERSION-STAGE-06 · el runner histórico conserva las guardas r170 y prohíbe remigrar r186.1', () => {
  const src = readFileSync(script, 'utf8')
  assert.match(src, /installedVersion\(candidate\) !== '0\.170\.0'/)
  assert.match(src, /prev\.status !== 'PASS'/)
  assert.match(src, /state\.status = 'FAIL'/)
  assert.match(src, /gpuVisual: 'NOT_VERIFIED'/)
  assert.match(src, /if \(isAdoptedBaseline\)/)
})
