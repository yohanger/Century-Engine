// LF-TIMELINE-AUDIO-POINT-FIFO-S13-G008-G004-INTEGRAL_CORR-003
// Verifica el plegado independiente mediante IDs estables con orden FIFO y no FIFO.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import vm from 'node:vm'

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8')
const fixture = read('scripts/fixtures/editor/inspector-audio-volume-points-s12-g007-g001.html')
const inspector = read('src/components/TemporalResourceInspector.vue')
const fifoFixture = read('scripts/fixtures/editor/timeline-audio-point-lifo-s13-g008-g004.html')
const electronRunner = read('scripts/test-inspector-audio-volume-points-s12-g007-g001-electron.mjs')

const resolver = fixture.match(/  const pointHeaderById=pointId=>points\(\)[\s\S]*?\?\.querySelector\('\.volume-point-toggle'\)/)?.[0]
const toggles = (ids) => {
  const items = ids.map((id) => {
    const toggle = { expanded: id === 'original', getAttribute(key) { return key === 'aria-expanded' ? String(this.expanded) : null }, click() { this.expanded = !this.expanded } }
    const del = { getAttribute(key) { return key === 'aria-label' ? 'Eliminar punto ' + id : null } }
    return { id, toggle, querySelector(key) { return key === '.volume-point-delete' ? del : key === '.volume-point-toggle' ? toggle : null } }
  })
  const scope = { items }
  vm.runInNewContext(`const points=()=>items;\n${resolver}\nglobalThis.find=pointHeaderById`, scope)
  return { items, find: scope.find }
}

test('FIFOFIX-01 · se preserva la fixture original con 40 aserciones', () => {
  assert.equal((fixture.match(/\bcheck\('/g) || []).length, 40)
  assert.match(fixture,/checks\.length===40/)
  assert.match(electronRunner,/minChecks:\s*40/)
})
test('FIFOFIX-02 · la búsqueda utiliza aria-label con el ID estable de la papelera existente', () => {
  assert.ok(resolver)
  assert.match(resolver,/\.volume-point-delete/)
  assert.match(resolver,/Eliminar punto \$\{pointId\}/)
  assert.match(resolver,/\.volume-point-toggle/)
  assert.match(inspector,/:aria-label="'Eliminar punto '\+point\.id"/)
})
test('FIFOFIX-03 · con FIFO el encabezado original y auto-2 son distintos', () => {
  const {find}=toggles(['original','auto-2','auto-3','auto-4'])
  assert.ok(find('original'))
  assert.ok(find('auto-2'))
  assert.notEqual(find('original'),find('auto-2'))
})
test('FIFOFIX-04 · con orden invertido los ID siguen resolviendo las dos identidades', () => {
  const {find}=toggles(['auto-4','auto-3','auto-2','original'])
  assert.ok(find('original'))
  assert.ok(find('auto-2'))
  assert.notEqual(find('original'),find('auto-2'))
})
test('FIFOFIX-05 · abrir el segundo no cierra el punto original', () => {
  const {find}=toggles(['original','auto-2','auto-3'])
  find('auto-2').click()
  assert.equal(find('original').getAttribute('aria-expanded'),'true')
  assert.equal(find('auto-2').getAttribute('aria-expanded'),'true')
})
test('FIFOFIX-06 · cerrar el original no cierra el segundo', () => {
  const {find}=toggles(['original','auto-2','auto-3'])
  find('auto-2').click()
  find('original').click()
  assert.equal(find('original').getAttribute('aria-expanded'),'false')
  assert.equal(find('auto-2').getAttribute('aria-expanded'),'true')
})
test('FIFOFIX-07 · si la identificación de un punto desaparece no se reutiliza otro encabezado', () => {
  const {find}=toggles(['original','auto-2','auto-3'])
  assert.equal(find('no-existe'),undefined)
  assert.notEqual(find('original'),find('no-existe'))
})
test('FIFOFIX-08 · la fixture vincula el punto original al ID guardado y el segundo al ID añadido', () => {
  assert.match(fixture,/const id=current\(\)\.volumeAutomation\[0\]\.id/)
  assert.match(fixture,/edit\('add',\{id:`auto-\$\{i\}`,t:i,value:i\/10\}\)/)
  assert.match(fixture,/const namedHeader=\(\)=>pointHeaderById\(id\)/)
  assert.match(fixture,/const otherHeader=\(\)=>pointHeaderById\('auto-2'\)/)
})
test('FIFOFIX-09 · se conservan las dos comprobaciones funcionales y exigen referencias diferentes', () => {
  for(const label of ['Puntos pueden abrirse independientemente','Cerrar un punto no cierra otro']){
    const line=fixture.slice(fixture.indexOf(`check('${label}'`),fixture.indexOf(`check('${label}'`)+350)
    assert.match(line,/namedHeader\(\)!==otherHeader\(\)/)
  }
})
test('FIFOFIX-10 · la fixture no vuelve a usar el índice cero para comparar puntos distintos', () => {
  const start=fixture.indexOf('  const pointHeaderById=')
  const end=fixture.indexOf("  check('Añadir puntos no modifica nombre personalizado anterior'",start)
  const section=fixture.slice(start,end)
  assert.ok(start>0 && end>start)
  assert.doesNotMatch(section,/headers\(\)\[0\]/)
  assert.doesNotMatch(section,/find\(el=>el\.textContent\.includes\('Lluvia tenue'\)\)/)
})
test('FIFOFIX-11 · el Inspector mantiene el estado plegado individual mediante ID, sin gestor paralelo', () => {
  assert.match(inspector,/function volumePointExpanded\(id\)/)
  assert.match(inspector,/function toggleVolumePoint\(id\)/)
  assert.match(inspector,/@click="toggleVolumePoint\(point\.id\)"/)
  assert.match(inspector,/:key="point\.id"/)
})
test('FIFOFIX-12 · no se alteran las verificaciones de persistencia, audio y nombres históricos', () => {
  for(const label of ['La serialización conserva el nombre','Scroll limitado y vertical','Duplicar clave conserva nombres personalizados','Collapsar no cambia interpolación']) assert.ok(fixture.includes(label),label)
  assert.match(fifoFixture,/checks\.length===25/)
})
test('FIFOFIX-13 · ambos scripts inline de la fixture Electron conservan sintaxis válida', () => {
  const scripts=[...fixture.matchAll(/<script(?: type="module")?>([\s\S]*?)<\/script>/g)].map(x=>x[1])
  assert.equal(scripts.length,2)
  for (const source of scripts) {
    const run=spawnSync(process.execPath,['--check','--input-type=module'],{input:source,encoding:'utf8'})
    assert.equal(run.status,0,run.stderr)
  }
})
