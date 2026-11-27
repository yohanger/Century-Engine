import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const inspector = read('src/components/Inspector.vue')
const dock = read('src/components/InspectorDock.vue')
const styles = read('src/styles.css')

function element(text, labels, closed = false) {
  const classes = new Set(['sect', ...(closed ? ['closed'] : [])])
  const attrs = {}
  const header = { textContent: text, setAttribute: (key, value) => { attrs[key] = value } }
  const section = {
    classList: {
      contains: (key) => classes.has(key),
      toggle: (key, on) => { if (on) classes.add(key); else classes.delete(key) },
    },
    querySelector: (selector) => selector === ':scope > header' ? header : null,
    querySelectorAll: (selector) => selector === 'label' ? labels.map((textContent) => ({ textContent })) : [],
  }
  return { section, classes, attrs }
}

function searchHarness(items, term = '') {
  const query = { value: term }
  const searchMiss = { value: false }
  const root = { value: { querySelectorAll: (selector) => selector === '.sect' ? items.map(({ section }) => section) : [] } }
  const logic = dock.slice(dock.indexOf('const searchText ='), dock.indexOf('function updateSections()'))
  const run = runInNewContext(`${logic}\nfilterSections`, { root, query, searchMiss })
  return { run, query, searchMiss }
}

test('La sección Escalera está junto a Transformación y antes de las propiedades generales', () => {
  const transform = inspector.indexOf('data-fold-id="transform"')
  const stairs = inspector.indexOf('data-fold-id="stairs"')
  const general = inspector.indexOf('data-fold-id="node-properties"')
  assert.ok(transform >= 0 && transform < stairs && stairs < general)
  assert.equal((inspector.match(/data-fold-id="stairs"/g) || []).length, 1)
})

test('Se conserva el control Escalones y el contrato 2 a 64 sin duplicarlo', () => {
  assert.equal((inspector.match(/<label>Escalones<\/label>/g) || []).length, 1)
  assert.match(inspector, /v-if="obj.kind === 'stairs'"/)
  assert.match(inspector, /:model-value="obj.props.steps" :step="1" :min="2" :max="64" :decimals="0"/)
  assert.match(inspector, /props: \{ steps: Math.max\(2, Math.min\(64, Math.round\(\$event\)\)\) \}/)
})

test('Buscar Escalones descubre el campo aunque la sección estuviera plegada', () => {
  const stairs = element('Escalera', ['Escalones', 'Giro °'], true)
  const other = element('Propiedades del nodo', ['Visible'], false)
  const search = searchHarness([stairs, other], 'escalones')
  search.run()
  assert.equal(stairs.classes.has('details-search-open'), true)
  assert.equal(stairs.classes.has('closed'), true)
  assert.equal(stairs.attrs['aria-expanded'], 'true')
  assert.equal(other.classes.has('details-filtered'), true)
  assert.equal(search.searchMiss.value, false)
})

test('Al limpiar la búsqueda se respeta el plegado guardado', () => {
  const stairs = element('Escalera', ['Escalones'], true)
  const search = searchHarness([stairs], 'escalones')
  search.run()
  search.query.value = ''
  search.run()
  assert.equal(stairs.classes.has('closed'), true)
  assert.equal(stairs.classes.has('details-search-open'), false)
  assert.equal(stairs.attrs['aria-expanded'], 'false')
})

test('El filtro no altera el estado de otras secciones ni sus preferencias', () => {
  const stairs = element('Escalera', ['Escalones'], true)
  const material = element('Materiales', ['Textura'], true)
  const search = searchHarness([stairs, material], 'textura')
  search.run()
  assert.equal(stairs.classes.has('details-filtered'), true)
  assert.equal(material.classes.has('details-search-open'), true)
  assert.equal(material.classes.has('closed'), true)
  assert.equal(material.attrs['aria-expanded'], 'true')
  assert.ok(!dock.slice(dock.indexOf('function filterSections()'), dock.indexOf('function updateSections()')).includes('store.prefs.inspFold ='))
})

test('Los estilos muestran temporalmente el cuerpo plegado durante la búsqueda', () => {
  assert.match(dock, /\.sect\.closed\.details-search-open > :not\(header\)/)
  assert.match(dock, /\.sect\.closed\.details-search-open > header::before/)
  assert.match(styles, /\.sect\.closed > :not\(header\) \{ display: none !important; \}/)
})

test('El cambio de cantidad reconstruye la representación mediante la ruta existente', () => {
  assert.match(read('src/engine/runtime/nodes/three-helpers.js'), /obj\.props\?\.steps/)
  assert.match(read('src/engine/runtime/nodes/primitive.js'), /stairsGeometry\(obj\.props\?\.steps \?\? 8,/)
  assert.match(read('src/core/state/objects.js'), /store\.editor\.syncObject\(id\)/)
})
