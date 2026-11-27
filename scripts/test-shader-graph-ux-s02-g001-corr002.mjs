// G002: expectativas de presentación actualizadas; evidencia histórica conservada en docs/qa.
// LF-SHADER-GRAPH-UX-S02-G001_CORR-002: contratos reales de geometría y fixture visual reproducible.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { compileGraph, newGraph, sampleGraph, newProp, newNode } from '../src/core/shadergraph/compile.js'
import { NODE_DEFS } from '../src/core/shadergraph/nodes.js'
const file = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const editor = file('src/components/ShaderGraphEditor.vue')
const preview = file('src/components/ShaderPreview.vue')
const visual = file('scripts/fixtures/shader-graph-visual.js')
const runner = file('scripts/qa-shader-graph-visual.py')
const view = editor.slice(editor.indexOf('<template>'), editor.indexOf('<style scoped>'))
const styles = editor.slice(editor.indexOf('<style scoped>'))
test('UXCORR2-01 · un único componente de grafo con ventana original y con marco reutilizable', () => {
 // CA-001: mismo marco original, con identificador de docking antes del v-if.
 assert.match(view, /<FloatingEditorWindow[^>]*v-if="sc"/)
 assert.match(view, /dock-panel-id="shaderGraph"/)
 assert.doesNotMatch(editor, /dockWindow|attachDock|detachDock/)
})
test('UXCORR2-02 · nodos textura usan miniatura y sockets compartiendo el cuerpo, sin solaparse con parámetros', () => {
 assert.match(editor, /const isTexture = \(n\)/)
 assert.match(editor, /const paramStart = \(n\)/)
 assert.match(editor, /const nodeH = \(n\) => paramStart\(n\)/)
 assert.match(editor, /const portPos = \(n, side, idx\)/)
 assert.match(view, /'texture-row': isTexture\(n\)/)
 assert.match(view, /paramStart\(n\) \+ pi \* PARAM/)
})
test('UXCORR2-03 · miniaturas representan únicamente assets del proyecto', () => {
 assert.match(editor, /const linkedTextureId = \(n\)/)
 assert.match(view, /assetThumbs\[linkedTextureId\(n\)\]/)
 assert.match(editor, /const url = await assetUrl\(id\)/)
 assert.doesNotMatch(visual, /data:image|base64|fakeTexture/)
})
test('UXCORR2-04 · barra muestra las acciones originales', () => {
 for(const name of ['openSearch(null)','@click="save"','apply(true)','doUndo','doRedo','frameNodes()']) assert.ok(view.includes(name),name)
 assert.match(styles, /\.sg-tools \{[^}]*overflow:visible/)
 assert.match(styles, /\.sg-search-trigger \{[^}]*flex:1/)
})
test('UXCORR2-05 · inspector inicial muestra un nodo real del grafo', () => {
 assert.match(editor, /g\.nodes\.find\(\(n\) => !def\(n\)\?\.master\) \|\| g\.nodes\[0\]/)
 assert.match(editor, /sel\.value = initial\.id/)
 assert.match(view, /v-for="p in def\(selectedNode\)\.params"/)
})
test('UXCORR2-06 · inspector del nodo usa los mismos setters con historial', () => {
 assert.match(view, /setParam\(selectedNode, p, /)
 assert.match(view, /setInline\(selectedNode, i, /)
 assert.match(editor, /function setParam\(n, p, val/)
 assert.match(editor, /function setInline\(n, i, comp, val/)
})
test('UXCORR2-07 · preview usa shader real y no texturas inventadas', () => {
 assert.match(preview, /syncPbrMaterial\(mat, obj,/)
 assert.match(preview, /assetImage\(id\)/)
 assert.match(preview, /new THREE\.WebGLRenderer/)
 assert.doesNotMatch(preview, /dummyTexture|fakeMap|mockMaterial/)
})
test('UXCORR2-08 · cámara y luces de estudio utilizan Three.js existente', () => {
 assert.match(preview, /function resetCamera\(\)/)
 assert.match(preview, /new THREE\.DirectionalLight/)
 assert.match(preview, /new THREE\.HemisphereLight/)
})
test('UXCORR2-09 · preview de Material y Post conserva formato y compilación', () => {
 const mat = compileGraph(sampleGraph(), 'Shader Material')
 const post = compileGraph(newGraph('post'), 'Post')
 assert.equal(mat.errors.length, 0)
 assert.equal(post.errors.length, 0)
 assert.match(mat.code, /void surface/)
 assert.match(post.code, /void main/)
})
test('UXCORR2-10 · nodos reales y tipos se preservan sin alterar catálogo', () => {
 assert.ok(NODE_DEFS.texture)
 assert.ok(NODE_DEFS.triplanar)
 assert.ok(NODE_DEFS.surface)
 assert.ok(NODE_DEFS.mul)
 assert.equal(newProp('texture').type,'texture')
 assert.equal(newNode('texture').type,'texture')
})
test('UXCORR2-11 · fixture de QA monta el Vue real y nunca lo sustituye por HTML', () => {
 assert.match(visual, /import ShaderGraphEditor from '\.\.\/\.\.\/src\/components\/ShaderGraphEditor\.vue'/)
 assert.match(visual, /createApp\(ShaderGraphEditor\)/)
 assert.match(visual, /store\.shaderEditId = shader\.id/)
 assert.match(visual, /sampleGraph\(\)/)
 assert.doesNotMatch(visual, /innerHTML|iframe|document\.write/)
})
test('UXCORR2-12 · runner de Chromium exige Vue real y registra capturas a ambas resoluciones', () => {
 assert.match(runner, /page\.locator\('\.sg-workspace \.sg-canvas'\)\.wait_for/)
 assert.match(runner, /\(1366, 768\), \(1536, 960\)/)
 assert.match(runner, /'material', 'post'/)
 assert.match(runner, /page\.screenshot\(/)
 assert.match(runner, /BLOQUEADO/)
})
test('UXCORR2-13 · Salida y GLSL siguen bajo lienzo sin alterar conexiones', () => {
 assert.match(view, /class="sg-output"/)
 assert.match(view, /class="sg-inspector"/)
 assert.match(view, /class="sg-wire"/)
 assert.match(editor, /function connect\(from, to\)/)
})
test('UXCORR2-14 · no aparecen assets demo falsos ni modificadores del compilador', () => {
 assert.doesNotMatch(visual, /window\.ShaderGraphEditor|fakeNode|mockPreview/)
 assert.match(visual, /compileGraph\(graph/)
 assert.match(visual, /newGraph\('post'\)/)
})
