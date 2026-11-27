// S13-G008-G001 CORR-003 · La fixture debe comprobar el contrato real de ParamForm/NumberField.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'

const read = file => readFileSync(new URL('../'+file,import.meta.url),'utf8')
const fixture = read('scripts/fixtures/editor/timeline-visual-ux-s13-g008-g001-corr002.html')
const inspector = read('src/components/TemporalResourceInspector.vue')
const form = read('src/components/ParamForm.vue')
const numeric = read('src/components/NumberField.vue')
const runner = read('scripts/test-timeline-visual-ux-s13-g008-g001-corr002-electron.mjs')
const check8 = fixture.match(/check\('Nombre, duración y ajustes siguen disponibles',[\s\S]*?\n\s*\{nombre:nameInput\?\.value,numeros:numberState,booleanos:boolState\}\)/)?.[0] || ''

test('VIS-CORR003-01 · NumberField usa text decimal, no number nativo', () => {
 assert.match(numeric,/<input type="text" inputmode="decimal"/)
 assert.match(form, /<NumberField v-else-if="p\.type === 'number'"/)
 assert.doesNotMatch(check8,/input\[type="number"\]/)
})
test('VIS-CORR003-02 · aserción 8 verifica la identidad de Nombre', () => {
 assert.ok(check8)
 assert.match(fixture, /input\[aria-label="Nombre del Timeline"\]/)
 assert.match(check8, /nameInput\.value==='Timeline QA'/)
 assert.match(inspector, /aria-label="Nombre del Timeline"/)
})
test('VIS-CORR003-03 · campos numéricos se identifican por etiqueta semántica', () => {
 assert.match(inspector, /key: 'duration', label: 'Duración \(s\)', type: 'number'/)
 assert.match(inspector, /key: 'letterbox', label: 'Barras de cine \(%\)', type: 'number'/)
 assert.match(fixture, /const numberFields=\['Duración \(s\)','Barras de cine \(%\)'\]/)
 assert.match(fixture,/\.ctl \.nf input\[type="text"\]\[inputmode="decimal"\]/)
 assert.match(check8,/Number\.isFinite\(Number\(field\.value\)\)/)
})
test('VIS-CORR003-04 · checkboxes se identifican por sus etiquetas y tipo real', () => {
 for (const prop of ["{ key: 'loop', label: 'En bucle', type: 'bool' }","{ key: 'lockPlayer', label: 'Bloquear jugador', type: 'bool' }","{ key: 'skippable', label: 'Se puede omitir', type: 'bool' }"]) assert.ok(inspector.includes(prop),prop)
 assert.match(form,/<input v-else-if="p\.type === 'bool'" type="checkbox"/)
 assert.match(fixture,/const boolFields=\['En bucle','Bloquear jugador','Se puede omitir'\]/)
 assert.match(fixture,/\.ctl input\[type="checkbox"\]/)
})
test('VIS-CORR003-05 · usa componentes reales y reporta datos para diagnóstico', () => {
 assert.match(fixture,/const rowFor=label=>paramRows\.find\(row=>row\.querySelector\(':scope > label'\)\?\.textContent\.trim\(\)===label\)/)
 assert.match(check8,/numberState\.every\(field=>field\.editable/)
 assert.match(check8,/boolState\.every\(field=>field\.editable\)/)
 assert.match(check8,/numeros:numberState,booleanos:boolState/)
})
test('VIS-CORR003-06 · mantiene exactamente 19 comprobaciones y runner previo', () => {
 assert.equal((fixture.match(/\bcheck\('/g)||[]).length,19)
 assert.match(fixture,/checks\.length===19&&checks\.every\(c=>c\.pass\)/)
 assert.match(runner,/minChecks:19/)
 assert.match(fixture,/await import\('\/src\/styles\.css'\)/)
})
test('VIS-CORR003-07 · los dos scripts de la fixture siguen siendo válidos', () => {
 const scripts=[...fixture.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
 assert.equal(scripts.length,2)
 for (const [,attrs,js] of scripts){
  const mode=/type="module"/.test(attrs)?'module':'commonjs'
  const p=spawnSync(process.execPath,[`--input-type=${mode}`,'--check'],{input:js,encoding:'utf8'})
  assert.equal(p.status,0,p.stderr)
 }
 const p=spawnSync(process.execPath,['--check',new URL('../scripts/test-timeline-visual-ux-s13-g008-g001-corr002-electron.mjs',import.meta.url).pathname],{encoding:'utf8'})
 assert.equal(p.status,0,p.stderr)
})
