// S13-G005-G001 CORR-002 · El proyecto de fixture debe usar el esquema oficial del motor.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const html = read('scripts/fixtures/editor/inspector-terrain-folding-s13-g005-g001.html')
const project = read('src/core/project.js')
const runner = read('scripts/test-inspector-terrain-folding-s13-g005-g001-electron.mjs')

// Las garantías del esquema se validan contra su fuente real, no con un objeto fabricado en el test.
test('TERR-CORR002-01 · la fixture usa createProjectData, no un proyecto parcial', () => {
 assert.match(html, /import\('\/src\/core\/project\.js'\)/)
 assert.match(html, /\{createProjectData\}/)
 assert.match(html, /const project=createProjectData\('QA Terrain S13 G005'\)/)
 assert.doesNotMatch(html, /const project=\{id:/)
})
test('TERR-CORR002-02 · el inicializador mantiene Bake y entorno completos', () => {
 assert.match(project, /export function createProjectData\(/)
 assert.match(project, /bake:\s*\{\s*\.\.\.BAKE_DEFAULTS\s*\}/)
 assert.match(project, /\.\.\.createSceneContent\(tpl\.id\)/)
 assert.match(project, /environment:\s*defaultEnvironment\(\)/)
 assert.doesNotMatch(html, /environment:\s*\{waterSimulation:/)
})
test('TERR-CORR002-03 · solo se personalizan los datos necesarios para Terrain y el cubo', () => {
 assert.match(html, /project\.objects=\[cube\]/)
 assert.match(html, /project\.scenes\[0\]\.name='Escena QA'/)
 assert.match(html, /project\.terrain=\{\.\.\.project\.terrain,enabled:true,size:32,segments:16/)
 assert.match(html, /layers:DEFAULT_LAYERS\.map\(x=>\(\{\.\.\.x\}\)\),foliage:\[\]\}/)
 assert.doesNotMatch(html, /project\.bake\s*=/)
 assert.doesNotMatch(html, /project\.environment\s*=/)
})
test('TERR-CORR002-04 · se conservan 37 comprobaciones y el flujo Escena → Terreno → Cubo', () => {
 assert.equal((html.match(/\bcheck\('/g) || []).length, 37)
 assert.match(html, /checks\.length===37&&checks\.every\(c=>c\.pass\)/)
 assert.match(runner, /minChecks:37/)
 assert.match(html, /'Escena se monta antes de elegir Terreno'/)
 assert.match(html, /selectPiece\(terrain\.id\);await flush\(\)/)
 assert.match(html, /selectObject\('cube-terrain-fold'\);await flush\(\)/)
})
test('TERR-CORR002-05 · los dos bloques JavaScript de la fixture son válidos', () => {
 const blocks = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
 assert.equal(blocks.length, 2)
 for (const [, attrs, code] of blocks) {
  const mode = /\btype=["']module["']/.test(attrs) ? 'module' : 'commonjs'
  const res = spawnSync(process.execPath, [`--input-type=${mode}`, '--check'], { input: code, encoding: 'utf8' })
  assert.equal(res.status, 0, res.stderr)
 }
})
