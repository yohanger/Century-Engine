// LF-TIMELINE-VISUAL-UX-S13-G008-G001-INTEGRAL_CORR-001 · regresión del tema real.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8')
const fixture=read('scripts/fixtures/editor/timeline-visual-ux-s13-g008-g001.html')
const theme=read('src/styles.css')
const main=read('src/main.js')
const inspector=read('src/components/TemporalResourceInspector.vue')
const runner=read('scripts/test-timeline-visual-ux-s13-g008-g001-electron.mjs')

const assertThemeLoaded = source => {
  assert.match(source,/await import\('\/src\/styles\.css'\)/)
  assert.ok(source.indexOf("await import('/src/styles.css')") < source.indexOf("app.mount('#inspector')"), 'Debe cargar el tema antes de montar Inspector')
}

test('VIS-CORR001-01 · la fixture importa el mismo tema global que el Editor',()=>{
  assertThemeLoaded(fixture)
  assert.match(main,/import '\.\/styles\.css'/)
  assert.match(theme,/:root\s*\{[\s\S]*?--hair:\s*#[0-9a-f]{3,8}\s*;/i)
})
test('VIS-CORR001-02 · divisor reutiliza variable del Editor, sin hardcodear colores',()=>{
  assert.match(inspector,/\.volume-title\s*\{[^}]*border-bottom:1px solid var\(--hair\)/)
  assert.match(fixture,/getComputedStyle\(document\.documentElement\)\.getPropertyValue\('--hair'\)/)
  assert.match(fixture,/hair\.length>0&&getComputedStyle\(header\(\)\)\.borderBottomWidth==='1px'/)
  assert.doesNotMatch(fixture, /header\(\)\.style\.borderBottom|setProperty\('--hair'/)
})
test('VIS-CORR001-03 · regresión detecta omisión del import de CSS',()=>{
  const without=fixture.replace("await import('/src/styles.css')",'// theme intentionally removed')
  assert.notEqual(without,fixture)
  assert.throws(()=>assertThemeLoaded(without),assert.AssertionError)
})
test('VIS-CORR001-04 · se conservan exactamente 54 comprobaciones y el runner oficial',()=>{
  assert.equal((fixture.match(/\bcheck\('/g)||[]).length,54)
  assert.match(fixture,/checks\.length===54&&checks\.every\(c=>c\.pass\)/)
  assert.match(runner,/minChecks:54/)
  assert.match(fixture,/await import\('\/src\/components\/TemporalResourceInspector\.vue'\)/)
})
test('VIS-CORR001-05 · ambos scripts de la fixture son sintácticamente válidos',()=>{
  const scripts=[...fixture.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
  assert.equal(scripts.length,2)
  assert.equal(scripts.filter(x=>/type="module"/.test(x[1])).length,1)
  for(const [,attrs,code] of scripts){
    const mode=/type="module"/.test(attrs)?'module':'commonjs'
    const r=spawnSync(process.execPath,[`--input-type=${mode}`,'--check'],{input:code,encoding:'utf8'})
    assert.equal(r.status,0,`Script ${mode} inválido: ${r.stderr}`)
  }
})
test('VIS-CORR001-06 · se preservan controles y salida verificable del runner',()=>{
  assert.match(fixture,/progress\('Estado inicial'\)/)
  assert.match(fixture,/getComputedStyle\(header\(\)\)\.justifyContent==='space-between'/)
  assert.match(fixture,/selector&&getComputedStyle\(selector\)\.maxWidth==='100%'/)
  assert.match(fixture,/const pass=!error&&checks\.length===54&&checks\.every/)
  assert.match(runner,/verifyWebGL\(/)
})
