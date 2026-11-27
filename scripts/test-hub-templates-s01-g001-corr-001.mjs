// LF-HUB-TEMPLATES-S01-G001_CORR-001: presentación negra sin alterar los flujos aprobados.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TEMPLATES, DEFAULT_TEMPLATE } from '../src/core/templates/index.js'
import { RENDERERS } from '../src/engine/runtime/render/config.js'

const text = (p) => readFileSync(new URL('../'+p, import.meta.url), 'utf8')
const hub = text('src/components/WelcomeScreen.vue')
const icons = text('src/components/Icon.vue')
const editorCSS = text('src/App.vue')
const script = hub.split('<script setup>')[1]?.split('</script>')[0] ?? ''
const markup = hub.slice(hub.indexOf('<template>'), hub.lastIndexOf('</template>'))
const css = hub.split('<style scoped>')[1]?.split('</style>')[0] ?? ''

test('HUB-UX-01 · no muestra ni importa la versión del producto', () => {
  assert.doesNotMatch(hub, /v\{\{\s*version|class="ver"|import\s*\{\s*version\s*\}/)
  assert.doesNotMatch(markup, /v\d+\.\d+\.\d+/)
  assert.match(markup,/title="LevelForge Hub"/)
})
test('HUB-UX-02 · la paleta clara del Hub se aplica en su propio contenedor', () => {
  assert.match(css, /\.hub \{[\s\S]*?--g-900: #fff;/)
  assert.match(css, /\.hub\.dark \{[\s\S]*?--g-900: #1c1e23;/)
  assert.match(editorCSS, /\.lf-editor \{[\s\S]*?--editor-chrome: #0e1116;/)
})
test('HUB-UX-03 · las miniaturas utilizan proyectos reales sin mock ni imágenes externas', () => {
  assert.match(markup, /v-for="p in shown"/)
  assert.match(markup, /p\.thumb\s*\?/)
  assert.match(markup, /current\.scenes/)
  assert.match(markup, /current\.objects/)
  assert.doesNotMatch(markup, /unsplash\.com|randomuser\.me|placehold\.co/)
})
test('HUB-UX-04 · alternar cuadrícula/lista no modifica el almacenamiento de proyectos', () => {
  assert.match(script,/viewMode\s*=\s*ref\('list'\)/)
  assert.match(markup, /view-switch/)
  assert.match(markup, /:aria-pressed="viewMode === 'grid'"/)
  assert.match(markup, /:aria-pressed="viewMode === 'list'"/)
  assert.match(css,/\.listview \.item/)
})
test('HUB-UX-05 · menú Añadir y pie de tabla conservan abrir, importar, carpeta, duplicar y quitar protegido', () => {
  for (const t of ['openRecent','openFromFolder','openLfprojDialog','duplicateProject','removeProject','askConfirm','isProjectOpen']) assert.ok(script.includes(t),t)
  for (const t of ['@click="edit()"','@click="dup"','@click="del"','@click="chooseAdd(importFile)"','@click="chooseAdd(openFolder)"']) assert.ok(markup.includes(t),t)
  assert.match(markup,/!current \|\| isProjectOpen\(current\.id\)/)
  assert.match(markup,/class="project-summary"/)
})
test('HUB-UX-06 · creación conserva plantilla, Database y renderizador', () => {
  assert.equal(DEFAULT_TEMPLATE,'empty-project')
  assert.deepEqual(TEMPLATES.map(t=>t.id),['empty-project','blank','empty'])
  assert.ok(RENDERERS.length>=3)
  for (const t of ['data-testid="hub-create"','v-for="t in featured"','v-for="t in legacy"','v-for="r in RENDERERS"','nameErr','createProject','{ renderer: renderer.value }']) assert.ok(hub.includes(t),t)
})
test('HUB-UX-07 · se respetan los controles de teclado, foco y etiquetas', () => {
  for (const t of ['role="listbox"','role="option"','aria-selected','@keydown.enter','@keydown.space.prevent','aria-label="Buscar proyectos"','aria-label="Presentación de proyectos"','<summary>Añadir']) assert.ok(markup.includes(t),t)
  assert.match(css,/\.item:focus-visible/)
})
test('HUB-UX-08 · no se crean destinos vacíos ni se suplanta un Marketplace inexistente', () => {
  assert.doesNotMatch(markup,/Marketplace|Ejemplos|Aprender|Documentación/)
  assert.match(markup, /@click="openCreate\(\)"/)
  assert.doesNotMatch(markup, /INICIO RÁPIDO/)
})
test('HUB-UX-09 · responsive evita solapamiento entre tarjetas, rail y detalles', () => {
  for (const s of ['max-width:1000px','max-width:760px','max-width:480px']) assert.ok(css.includes(s),s)
  assert.match(css,/overflow:\s*auto/)
  assert.match(css,/display:\s*flex; flex-direction:\s*column/)
})
test('HUB-UX-10 · el catálogo de iconos contiene los controles visibles', () => {
  for(const name of ['grid','list','clock','folder','box','copy','trash','search','scene','play']) assert.match(icons,new RegExp(`\\b${name}:`))
})
