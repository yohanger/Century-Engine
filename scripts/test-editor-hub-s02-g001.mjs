import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const hub=readFileSync(new URL('../src/components/WelcomeScreen.vue',import.meta.url),'utf8')
const markup=hub.slice(hub.indexOf('<template>'), hub.lastIndexOf('</template>'))
test('S02-01 · conserva apertura de proyectos',()=>{for(const x of ['openRecent(p.id)','openFromFolder(loc)','openLfprojDialog(f)','importBundle(f)'])assert.ok(hub.includes(x),x)})
test('S02-02 · conserva duplicación y eliminación confirmada',()=>{for(const x of ['duplicateProject(current.value.id)','askConfirm(','removeProject(p.id)','isProjectOpen(p.id)'])assert.ok(hub.includes(x),x)})
test('S02-03 · conserva creación con plantilla y renderizador',()=>{for(const x of ['createProject(name.value, parent.value, template.value, { renderer: renderer.value })','TEMPLATES','RENDERERS','nameErr'])assert.ok(hub.includes(x),x)})
test('S02-04 · elimina escenas CSS ficticias',()=>{for(const x of ['floor-grid','preview-stage','preview-person','template-visual','preview-fps','preview-empty'])assert.ok(!hub.includes(x),x)})
test('S02-05 · no contiene mensajes promocionales',()=>{for(const x of ['Tu motor, tus reglas','Diseña tus mundos','Tus proyectos, en un solo lugar'])assert.ok(!hub.includes(x),x)})
test('S02-06 · conserva búsqueda, orden y modos de lista',()=>{for(const x of ['v-model="filter"','v-model="sort"','viewMode','shown','listview'])assert.ok(hub.includes(x),x)})
test('S02-07 · presenta miniaturas reales o fallback neutral',()=>{assert.match(markup,/p\.thumb \? \{ backgroundImage/);assert.match(markup,/!p\.thumb" name="folder"/)})
test('S02-08 · configuración responsive y navegación',()=>{for(const x of ['@media (max-width:760px)','@media (max-width:480px)','aria-label="Navegación del Hub"','role="radiogroup"'])assert.ok(hub.includes(x),x)})
test('S02-09 · el HUB conserva su lógica, sin módulos paralelos',()=>{assert.match(hub,/import \* as db/);assert.match(hub,/import \* as disk/);assert.match(hub,/const guard =|async function guard/);assert.match(hub,/const create = \(\) => guard/)})
