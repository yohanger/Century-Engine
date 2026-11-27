import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const dock = read('src/components/InspectorDock.vue'), panel = read('src/components/MeshPanel.vue')
const code = dock.slice(dock.indexOf('// Reutiliza inspFold con identidad semántica'), dock.indexOf('// Las cabeceras que Vue reutiliza también cambian de contexto'))
function harness() {
  const store = { prefs: { inspFold: { 'resource:Normales': true } }, project: { objects: [{ id:'mesh' }] } }
  const query = {value:''}, searchMiss = {value:false}, tab = {value:'mesh'}
  function make(id, title, fields=[], closed=true) {
    const classes = new Set(['sect']), attrs = {}
    const section = {dataset:{foldId:id,foldDefault:closed?'closed':'open'}, classList:{contains:k=>classes.has(k),toggle(k,v){v?classes.add(k):classes.delete(k)}}, querySelector:()=>header,querySelectorAll:()=>fields.map(v=>({textContent:v,getAttribute:()=>null}))}
    const header = {parentElement:section,textContent:title,childNodes:[{nodeType:3,textContent:title}],closest:()=>null,setAttribute:(k,v)=>attrs[k]=v}
    return {section,header,classes,attrs}
  }
  const mesh = [make('mesh-numeric','Transformación precisa',['Escala uniforme'],false),make('mesh-normals','Normales',['Recalcular']),make('mesh-uv','UV Editing',['Proyección caja']),make('mesh-parameters','Parámetros',['Bisel: perfil'])]
  const hidden = make('materials','Materiales',['Albedo'])
  const scope = {querySelectorAll:s=>s.includes('header')?mesh.map(x=>x.header):mesh.map(x=>x.section)}
  const root = {value:{querySelector:()=>scope,querySelectorAll:s=>s.includes('header')?[hidden.header]:[hidden.section]}}
  const api=runInNewContext(code+'\n;({applyFolds,filterSections,toggleFold,onFoldKey,keyOf})',{root,tab,store,query,searchMiss})
  return {mesh,hidden,api,store,query,searchMiss}
}
test('La identidad de los pliegues es nativa y está aislada del Inspector de objetos',()=>{const h=harness();h.api.applyFolds();assert.equal(h.api.keyOf(h.mesh[0].header),'fold:pane:mesh:mesh-numeric');assert.equal(h.hidden.attrs['aria-expanded'],undefined)})
test('Transformación abierta y secciones secundarias cerradas por defecto',()=>{const h=harness();h.api.applyFolds();assert.equal(h.mesh[0].attrs['aria-expanded'],'true');assert.equal(h.mesh[2].attrs['aria-expanded'],'false')})
test('Preferencias anteriores de otros recursos no se adjudican a la malla',()=>{const h=harness();h.api.applyFolds();assert.deepEqual(h.store.prefs.inspFold,{'resource:Normales':true})})
test('Plegado individual usa preferencias y no altera el proyecto',()=>{const h=harness();const before=JSON.stringify(h.store.project);h.api.applyFolds();h.api.toggleFold(h.mesh[2].header);assert.equal(h.store.prefs.inspFold['fold:pane:mesh:mesh-uv'],false);h.api.applyFolds();assert.equal(h.mesh[2].attrs['aria-expanded'],'true');assert.equal(JSON.stringify(h.store.project),before)})
test('Búsqueda sin acentos ni distinción de mayúsculas abre coincidencias sin escribir prefs',()=>{const h=harness();h.api.applyFolds();h.query.value='PROYECCION';h.api.filterSections();assert.ok(h.mesh[2].classes.has('details-search-open'));assert.ok(h.mesh[0].classes.has('details-filtered'));assert.equal(h.mesh[2].attrs['aria-expanded'],'true');assert.deepEqual(h.store.prefs.inspFold,{'resource:Normales':true});h.query.value='';h.api.filterSections();assert.equal(h.mesh[2].attrs['aria-expanded'],'false')})
test('La búsqueda encuentra herramientas y campos, no el Inspector oculto',()=>{const h=harness();h.api.applyFolds();h.query.value='recalcular';h.api.filterSections();assert.equal(h.searchMiss.value,false);assert.ok(h.mesh[1].classes.has('details-search-open'));h.query.value='albedo';h.api.filterSections();assert.equal(h.searchMiss.value,true)})
test('Los parámetros activos permanecen abiertos durante búsqueda y plegado',()=>{const h=harness();const section=h.mesh[3];section.section.dataset.foldForceOpen='true';h.api.applyFolds();h.api.toggleFold(section.header);h.query.value='inexistente';h.api.filterSections();assert.equal(section.attrs['aria-expanded'],'true');assert.ok(!section.classes.has('details-filtered'));delete section.section.dataset.foldForceOpen;h.api.applyFolds();assert.equal(section.attrs['aria-expanded'],'false')})
test('El teclado pliega el encabezado, no modifica el modelo',()=>{const h=harness();const {header}=h.mesh[0];header.closest=()=>header;h.api.applyFolds();let stopped=false;h.api.onFoldKey({key:'Enter',target:header,preventDefault(){},stopPropagation(){stopped=true}});assert.equal(header.parentElement.classList.contains('closed'),true);assert.ok(stopped)})
test('El panel conserva comandos y controles numéricos con commit nativo',()=>{for(const id of ['extrude','extrudeSolid','extrudeIndividual','inset','bevel','bevelVertex','loopcut','knife','bridge','fill','subdivide','merge.faces','merge.center','split','separate','duplicate','dissolve','delete','flip','recalc','smooth','flat','grab','rotate','scale','shrink','vertexSlide','edgeSlide','spin','shear'])assert.ok(panel.includes(`'mesh.${id}'`),id);for(const kind of ['position','move','rotate','scale'])assert.ok(panel.includes(`numericEdit('${kind}', i, $event)`));assert.match(panel,/@commit="numericCommit"/);assert.match(panel,/class="axis-fields"/);assert.match(panel,/uniformMeshScale/)})
test('Los campos contextuales consumen exclusivamente el estado y ciclo modal existentes',()=>{assert.match(panel,/modal\.value\?\.inspecting/);assert.match(panel,/editSession\(\)\?\.modalUpdate\(\)/);assert.match(panel,/setModalBevelSegments/);assert.match(panel,/editModalValue/);assert.match(panel,/modalConfirm/);assert.match(panel,/modalCancel/);assert.match(panel,/paramGroup === 'bevel'/);assert.match(panel,/paramGroup === 'spin'/);assert.match(panel,/showAllParams/)})
test('El panel conserva UV, Vertex Paint, pivotes, construcción, limpieza y física',()=>{for(const id of ['mesh-uv-panel','mesh-vertex-paint','mesh-pivot','mesh-vertex-draw','mesh-topology-cleanup','mesh-primitive-topology','mesh-reduce-faces'])assert.ok(panel.includes(`data-testid="${id}"`),id);for(const symbol of ['uvRun','layerOp','setPivot','cleanTopology','changeGeneratorCount','reduceFaces','toggleGlobalShortcuts','setVertexPlane','patch({ collision:'])assert.ok(panel.includes(symbol),symbol)})
test('Un único buscador y plegado; los grupos tienen identificadores y reglas responsivas',()=>{assert.match(dock,/<MeshPanel v-if="tab === 'mesh'" :search="query"/);assert.match(panel,/data-fold-id="mesh-numeric"/);assert.match(panel,/@container \(max-width: 245px\)/);assert.match(panel,/grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);assert.match(panel,/aria-pressed="e.mode === m"/);assert.doesNotMatch(panel,/localStorage/);assert.match(panel,/<kbd v-if="key">/)})

test('El proyecto del fixture usa el constructor nativo y conserva sus registros',()=>{
  const fixture=read('scripts/fixtures/mesh/edit-session-integration-corr-g001.mjs')
  const project=read('src/core/project.js')
  assert.match(fixture,/import \{createProjectData,store,/)
  assert.match(fixture,/const project=createProjectData\('Malla QA','empty-project'\)/)
  assert.match(fixture,/store\.project=project\b/)
  assert.doesNotMatch(fixture,/project\.tagLayers\s*=|store\.project\s*=\s*\{/)
  assert.match(project,/tagLayers:\s*defaultTagLayers\(\)/)
  assert.match(fixture,/project\.settings=\{\.\.\.project\.settings,gridSize:\.5/)
  assert.match(fixture,/project\.terrain=\{\.\.\.project\.terrain,enabled:false/)
})
test('El registro nativo de capas resuelve el acceso del Inspector que fallaba',async()=>{
  const {defaultTagLayers,layerName,layersOf,groupsOf,MAX_LAYERS}=await import('../src/engine/runtime/layers.js')
  const object={id:'mesh',type:'mesh'}
  assert.throws(()=>layerName(undefined,layersOf(object)[0]),TypeError)
  const registry=defaultTagLayers()
  assert.equal(registry.layers.length,MAX_LAYERS)
  assert.equal(layerName(registry,layersOf(object)[0]),'Default')
  assert.deepEqual(registry.groups,[])
  assert.deepEqual(groupsOf(object),[])
  assert.notEqual(registry.layers,defaultTagLayers().layers)
})
