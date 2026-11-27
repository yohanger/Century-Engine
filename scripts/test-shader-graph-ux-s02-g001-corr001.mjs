// G002: expectativas de presentación actualizadas; evidencia histórica conservada en docs/qa.
// LF-SHADER-GRAPH-UX-S02-G001_CORR-001: fidelidad estructural, edición contextual y preview real.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { newGraph, newNode, newProp, compileGraph, normalizeGraph } from '../src/core/shadergraph/compile.js'
import { NODE_DEFS } from '../src/core/shadergraph/nodes.js'
const read = (s) => readFileSync(new URL('../'+s,import.meta.url),'utf8')
const editor=read('src/components/ShaderGraphEditor.vue')
const preview=read('src/components/ShaderPreview.vue')
const win=read('src/components/FloatingEditorWindow.vue')
const template=editor.split('<template>')[1].split('</template>\n\n<style scoped>')[0]
const css=editor.slice(editor.indexOf('<style scoped>'))

test('CORR-01 · Un único editor y sin acoplamiento de ventanas',()=>{
 assert.match(template, /<FloatingEditorWindow[^>]+label="Shader Graph"/)
 assert.match(template, /start-maximized="true"/)
 assert.match(win,/startMaximized: \{ type: Boolean, default: false \}/)
 assert.doesNotMatch(editor,/dockWindow|detachWindow|acoplar|dockable/)
})
test('CORR-02 · Barra principal legible sin desplazamiento horizontal',()=>{
 assert.match(css,/\.sg-tools \{[^}]*overflow:visible/)
 assert.doesNotMatch(css,/\.sg-tools \{[^}]*overflow-x:auto/)
 assert.match(template,/class="sg-more-menu"/)
 assert.match(template,/@click="save"/)
 assert.match(template,/@click="apply\(true\)"/)
 assert.match(template,/@click="doUndo"/)
 assert.match(template,/@click="doRedo"/)
 assert.match(template,/openSearch\(null\)/)
})
test('CORR-03 · Todas las acciones de nodos siguen disponibles',()=>{
 for(const k of ['copySelected','pasteSelected','removeSelected','addVertexOut','frameNodes()','frameNodes(true)'])assert.ok(template.includes(k),k)
 assert.match(template,/class="sg-more-wrap"/)
})
test('CORR-04 · Lienzo dominante, rail y consola independiente',()=>{
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) clamp\(285px,27%,410px\)/)
 assert.match(template,/class="sg-graph-pane"[\s\S]*class="sg-canvas"/)
 assert.match(template,/class="sg-output"[\s\S]*class="sg-inspector"/)
 assert.match(css,/\.sg-output \{[^}]*height:clamp\(82px,16%,128px\)/)
})
test('CORR-05 · Tarjetas nodales profesionales con puertos y previews reales',()=>{
 assert.match(template,/class="nh"/)
 assert.match(template,/class="sg-texture-thumb"/)
 assert.match(template,/assetThumbs\[linkedTextureId\(n\)\]/)
 assert.match(template,/class="sg-color-chip"/)
 assert.match(css,/\.node\.sel \{[^}]*border-color:#38b4ed/)
 assert.match(css,/\.port \{[^}]*width:11px/)
 assert.match(editor,/const previewH =/)
})
test('CORR-06 · Aristas Bézier y puertos conservan autoridad de topología',()=>{
 assert.match(editor,/function connect\(from, to\)/)
 assert.match(editor,/const edgePath =/)
 assert.match(editor,/const portPos =/)
 assert.match(template,/v-for="p in paths"/)
 assert.match(template,/class="sg-wire"/)
 assert.match(template,/@pointerdown="onPortDown/)
})
test('CORR-07 · Inspector muestra editor real del nodo seleccionado',()=>{
 assert.match(editor,/const selectedNode = computed\(\(\) => byId\(sel\.value\)\)/)
 assert.match(template,/aria-label="Propiedades del nodo seleccionado"/)
 assert.match(template,/v-for="p in def\(selectedNode\)\.params"/)
 assert.match(template,/setParam\(selectedNode, p,/)
 assert.match(template,/v-for="i in def\(selectedNode\)\.in"/)
 assert.match(template,/setInline\(selectedNode, i,/)
 assert.doesNotMatch(template,/Edita sus parámetros desde el nodo/)
})
test('CORR-08 · Propiedades globales y de nodos tienen contextos distintos',()=>{
 assert.match(template,/detailTab === 'node'/)
 assert.match(template,/detailTab === 'graph'/)
 for(const k of ['setProp(p,','setPropDef(p,','addProp(t[0])','delProp(p)'])assert.ok(template.includes(k),k)
})
test('CORR-09 · Preview no se superpone al lienzo y adapta su tamaño',()=>{
 assert.match(template,/class="sg-preview-panel"/)
 assert.match(template,/:shader-id="sc.id"[^>]+:size="300"/)
 assert.match(preview,/resizeObserver = new ResizeObserver\(resize\)/)
 assert.match(preview,/camera\.aspect = renderWidth \/ renderHeight/)
 assert.match(preview,/canvasSlot\.value\.appendChild\(renderer\.domElement\)/)
 assert.match(css,/\.sg-preview-panel \{[^}]*min-height:205px/)
})
test('CORR-10 · Preview usa materiales y texturas reales, no texturas ficticias',()=>{
 assert.match(preview,/linkedMaterial = computed/)
 assert.match(preview,/m\.mat\?\.shader === props\.shaderId/)
 assert.match(preview,/assetImage\(id\)/)
 assert.match(preview,/new THREE\.Texture\(image\)/)
 assert.match(preview,/syncPbrMaterial\(mat, obj,/)
 assert.match(preview,/getMap \}/)
 assert.doesNotMatch(preview,/StoneAlbedo|dummyTexture|fakeTexture/)
})
test('CORR-11 · Preview conserva el modo Post y limpia recursos WebGL',()=>{
 assert.match(preview,/props\.target === 'post'/)
 assert.match(preview,/new ShaderPass/)
 assert.match(preview,/composer\.addPass\(new RenderPass/)
 assert.match(preview,/resizeObserver\?\.disconnect\(\)/)
 assert.match(preview,/texture\.dispose\(\)/)
 assert.match(preview,/renderer\?\.forceContextLoss/)
})
test('CORR-12 · Preview usa iluminación de estudio y escena real',()=>{
 assert.match(preview,/new THREE\.HemisphereLight/)
 assert.match(preview,/new THREE\.DirectionalLight/)
 assert.match(preview,/THREE\.ACESFilmicToneMapping/)
 assert.match(preview,/new THREE\.SphereGeometry/)
})
test('CORR-13 · Errores y GLSL siguen en el panel inferior',()=>{
 assert.match(template,/class="sg-output-tabs" role="tablist"/)
 assert.match(template,/<pre v-if="showCode" class="sg-code"/)
 assert.match(template,/v-for="\(error, i\) in status\.errors"/)
 assert.match(template,/class="sg-messages" role="status" aria-live="polite"/)
})
test('CORR-14 · No se introducen nodos/propiedades nuevas en schema',()=>{
 for(const kind of ['material','post']){
  const g=newGraph(kind)
  const before=compileGraph(g)
  assert.equal(before.errors.length,0)
  const restored=normalizeGraph(JSON.parse(JSON.stringify(g)))
  assert.equal(compileGraph(restored).errors.length,0)
 }
 for(const k of ['texture','color','mul','surface','postOutput'])assert.ok(NODE_DEFS[k])
})
test('CORR-15 · Responsive diseñado sin scroll en toolbar',()=>{
 assert.match(css,/@container \(max-width:1100px\)/)
 assert.match(css,/@container \(max-height:540px\)/)
 assert.match(css,/\.sg-tools-target/)
 assert.match(css,/\.sg-search-trigger/)
 assert.match(css,/\.sg-tools \{[^}]*min-width:0/)
})
test('CORR-16 · Rutas de edición continúan usando el grafo del proyecto',()=>{
 assert.match(editor,/setShaderGraph\(sc\.value\.id/)
 assert.match(editor,/checkShader\(vp\.renderer, sc\.value\.code\)/)
 assert.match(editor,/const sc = computed\(\(\) => project\.shaders\.find/)
 assert.match(editor,/selected = reactive\(new Set\(\)\)/)
})
