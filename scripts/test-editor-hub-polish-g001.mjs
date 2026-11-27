import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const src = readFileSync(new URL('../src/components/WelcomeScreen.vue', import.meta.url), 'utf8')
test('HUB-P01: editor.toml gobierna el tema del Hub sin una paleta local paralela', () => {
  assert.match(src, /color-scheme: var\(--editor-color-scheme, dark\)/)
  assert.match(src, /--titlebar: var\(--editor-chrome\)/)
  assert.doesNotMatch(src, /\.hub\.dark|store\.prefs\.hubDark|--g-900:\s*#/)
})
test('HUB-P02: mantiene las acciones de proyectos', () => { for (const op of ['openRecent(', 'duplicateProject(', 'removeProject(', 'createProject(', 'importBundle(', 'openFromFolder(']) assert.ok(src.includes(op),op) })
test('HUB-P03: vistas y búsqueda conservadas', () => { for (const token of ['v-model="filter"','viewMode === \'grid\'','viewMode === \'list\'','v-model="sort"']) assert.ok(src.includes(token),token) })
test('HUB-P04: selección y foco accesible', () => { assert.match(src,/:aria-selected="sel === p.id"/); assert.match(src,/:focus-visible/); assert.match(src,/prefers-reduced-motion/) })
test('HUB-P05: plantillas y renderizadores reales', () => { assert.match(src,/v-for="t in featured"/); assert.match(src,/v-for="r in RENDERERS"/); assert.match(src,/tpl\.description/) })
test('HUB-P06: diálogo nativo con formulario y catálogo sin escenas CSS falsas', () => { assert.doesNotMatch(src,/fake-scene|fake-preview|mock-viewport/); assert.match(src,/<dialog[^>]+aria-labelledby="hub-create-title"/); assert.match(src,/<form class="project-settings"/); assert.match(src,/\.rail/); })
test('HUB-P07: estructura responsive', () => { assert.match(src,/@media \(max-width:1000px\)/); assert.match(src,/@media \(max-width:760px\)/) })
