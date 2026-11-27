// G002: expectativas de presentación actualizadas; evidencia histórica conservada en docs/qa.
// LF-SHADER-GRAPH-UX-S02-G001: layout, controles y continuidad de los grafos reales.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { newGraph, newNode, compileGraph, normalizeGraph } from '../src/core/shadergraph/compile.js'
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const shader = read('src/components/ShaderGraphEditor.vue')
const win = read('src/components/FloatingEditorWindow.vue')
const preview = read('src/components/ShaderPreview.vue')
const template = shader.split('<template>')[1].split('</template>\n\n<style scoped>')[0]
const css = shader.split('<style scoped>')[1]

test('UXS2-01 · Un único editor existente conserva su shell flotante', () => {
  assert.match(template, /<FloatingEditorWindow[^>]+label="Shader Graph"/)
  assert.match(template, /start-maximized="true"/)
  assert.match(win, /startMaximized: \{ type: Boolean, default: false \}/)
  assert.match(win, /const maximized = ref\(props.startMaximized\)/)
})
test('UXS2-02 · Workspace: lienzo central y rail derecho en el mismo nivel', () => {
  assert.match(template, /class="sg-workspace"/)
  assert.ok(template.indexOf('class="sg-graph-pane"') < template.indexOf('class="sg-inspector"'))
  assert.match(css, /\.sg-workspace \{[^}]*display:grid/)
  assert.match(css, /grid-template-columns:minmax\(0,1fr\) clamp\(285px,27%,410px\)/)
})
test('UXS2-03 · El grafo ocupa un área independiente sin panel superpuesto', () => {
  assert.match(template, /ref="surface" class="sg-canvas"/)
  assert.match(css, /\.sg-canvas \{[^}]*position:relative; flex:1;/)
  assert.doesNotMatch(css, /\.sg-prev\s*\{[^}]*position:\s*absolute/)
})
test('UXS2-04 · Propiedades de grafo permanecen editables en el rail derecho', () => {
  assert.match(template, /class="sg-inspector"[\s\S]*class="sg-board"/)
  assert.match(template, /setProp\(p, 'name'/)
  assert.match(template, /setPropDef\(p, /)
  assert.match(template, /delProp\(p\)/)
  assert.match(template, /addProp\(t\[0\]\)/)
})
test('UXS2-05 · Preview reutiliza el componente real y está fuera del canvas', () => {
  assert.match(template, /class="sg-preview-panel"[\s\S]*<ShaderPreview :code="code" :target="g.target" :graph="g"/)
  assert.equal((template.match(/<ShaderPreview /g) || []).length, 1)
  assert.ok(template.indexOf('class="sg-preview-panel"') > template.indexOf('class="sg-canvas"'))
  assert.match(preview, /watch\(\(\) => \[props\.code, props\.target, materialParams\.value, props\.shaderId, props\.materialId\], apply\)/)
})
test('UXS2-06 · Salida y GLSL comparten dock inferior, no capa superpuesta', () => {
  assert.match(template, /class="sg-output"/)
  assert.match(template, /class="sg-output-tabs" role="tablist"/)
  assert.match(template, /<pre v-if="showCode" class="sg-code"/)
  assert.match(css, /\.sg-output \{[^}]*display:flex; flex:none; flex-direction:column;/)
  assert.doesNotMatch(css, /\.sg-code\s*\{[^}]*position:\s*absolute/)
})
test('UXS2-07 · Mensajes de compilación visibles y errores concretos', () => {
  assert.match(template, /class="sg-messages" role="status" aria-live="polite"/)
  assert.match(template, /status\.errors\.length/)
  assert.match(template, /v-for="\(error, i\) in status.errors"/)
  assert.match(template, /\{\{ error\.message \}\}/)
})
test('UXS2-08 · Toolbar conserva acciones reales y añade compilación manual', () => {
  assert.match(template, /role="toolbar" aria-label="Acciones del Shader Graph"/)
  assert.match(template, /class="sg-search-trigger"[\s\S]*@click="openSearch\(null\)"/)
  assert.match(template, /class="sg-node-title"/)
  for (const fn of ['@click="save"', 'apply(true)', 'doUndo', 'doRedo', 'copySelected', 'pasteSelected', 'removeSelected', 'openSearch(null)', 'frameNodes()']) {
    assert.ok(template.includes(fn), 'Falta acción '+fn)
  }
})
test('UXS2-09 · No se perdió la selección múltiple, edges ni las operaciones nodales', () => {
  for (const needle of ['selected = reactive(new Set())','kind: \'box\'','function onPortDown','function connect(', 'function copySelected','function pasteSelected','function frameNodes','function onWheel']) assert.ok(shader.includes(needle),needle)
  assert.match(template, /v-for="p in paths"/)
  assert.match(template, /v-for="n in g.nodes"/)
})
test('UXS2-10 · Teclado conserva undo, redo, guardar, buscar, encuadre y Delete', () => {
  assert.match(shader, /e\.key === 'Delete'/)
  assert.match(shader, /e\.key\.toLowerCase\(\) === 'z'/)
  assert.match(shader, /e\.key\.toLowerCase\(\) === 's'/)
  assert.match(shader, /e\.key === ' '/)
  assert.match(shader, /e\.key === 'Home'/)
})
test('UXS2-11 · Adaptación de ventana con toolbar sin scroll horizontal', () => {
  assert.match(css, /@container \(max-width:1100px\)/)
  assert.match(css, /@container \(max-height:540px\)/)
  assert.match(css, /\.sg-inspector \{[^}]*min-width:0; min-height:0;/)
  assert.match(css, /\.sg-board \{[^}]*overflow:auto/)
  assert.match(css, /\.sg-tools \{[^}]*overflow:visible/)
})
test('UXS2-12 · Ventanas de otros editores conservan geometría previa', () => {
  assert.match(win, /startMaximized: \{ type: Boolean, default: false \}/)
  assert.match(win, /function toggleMaximize\(\)/)
  assert.match(win, /function clampPosition\(\)/)
})
test('UXS2-13 · Edición sigue usando el guardado y el compilador originales', () => {
  assert.match(shader, /setShaderGraph\(sc\.value\.id/)
  assert.match(shader, /checkShader\(vp\.renderer, sc\.value\.code\)/)
  assert.match(shader, /const code = computed\(\(\) => sc\.value\?\.code \|\| ''\)/)
})
test('UXS2-14 · Material existente y post continúan generando GLSL válido', () => {
  for (const target of ['material','post']) {
    const graph = newGraph(target)
    const result = compileGraph(graph)
    assert.equal(result.errors.length,0,target)
    assert.ok(result.code.length>60)
    assert.equal(normalizeGraph(JSON.parse(JSON.stringify(graph))).target,target)
  }
})
test('UXS2-15 · Grafo guardado sigue preservando nodos y coordenadas', () => {
  const graph = newGraph('material')
  const node = newNode('add',321,194)
  graph.nodes.push(node)
  const restored = normalizeGraph(JSON.parse(JSON.stringify(graph)))
  assert.ok(restored.nodes.some(n=>n.id===node.id && n.x===321 && n.y===194))
})
