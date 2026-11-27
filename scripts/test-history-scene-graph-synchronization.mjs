import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { PolyMesh } from '../src/engine/runtime/mesh/polymesh.js'
import { strictJson } from '../src/engine/runtime/numeric-integrity.js'
import { meshDataOf } from '../src/engine/runtime/mesh/shared-mesh.js'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const source = path => read(path).replace(/^import[^\n]*\n/gm, '').replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|let|class)\b)/g, '')
const load = (path, result, context) => runInNewContext(source(path) + '\n;(' + result + ')', context, { filename: path })
const noop = () => {}
const record = () => new PolyMesh([[0,0,0],[1,0,0],[0,1,0]],[[0,1,2]]).toJSON()

function setup() {
  const events = [], observers = [], terrain = { layers: [], foliage: [] }
  const makeNode = type => ({ id: 'cube', type, kind: 'box', scale: [1,1,1], props: type === 'mesh' ? { mesh: record() } : {} })
  const store = { selectedId: 'cube', selectedIds: ['cube'], edit: {}, view: {}, prefs: {}, play: {}, gameView: {}, roadPaint: {}, disk: {}, locked: false, pendingRevision: 0 }
  let tracking = null
  const notify = property => {
    for (const observer of observers) {
      if (!observer.dependencies.has(property)) continue
      tracking = new Set()
      const value = observer.get(), key = JSON.stringify(value)
      observer.dependencies = tracking; tracking = null
      // El watcher profundo de render también reacciona a la sustitución de referencia.
      if (key === observer.key && (observer.array ? value.every((v,i) => v === observer.value[i]) : value === observer.value)) continue
      const old = observer.value
      observer.key = key; observer.value = value
      observer.callback(value, old)
    }
  }
  const raw = { id: 'qa', objects: [makeNode('primitive')], scenes: [], render: { exposure: 1 }, environment: {}, terrain: { enabled:false, layers:[], foliage:[] } }
  store.project = new Proxy(raw, { get(target, key) { tracking?.add(key); return target[key] }, set(target, key, value) { target[key] = value; notify(key); return true } })
  const watch = (source, callback) => {
    const array = Array.isArray(source), get = array ? () => source.map(f=>f()) : source
    tracking = new Set()
    const value = get(), dependencies = tracking; tracking = null
    observers.push({ get, callback, array: array || Array.isArray(value), value, key: JSON.stringify(value), dependencies })
    return noop
  }
  // Las fuentes que devuelven arrays nuevos son observadas por sus elementos, como watch de Vue.
  const sig = load('src/engine/runtime/nodes/three-helpers.js', 'signature', {})
  class Geometry { dispose() {} getAttribute() { return undefined } setAttribute() {} setIndex() {} computeBoundingSphere() {} userData = {} }
  const mesh = runInNewContext(source('src/engine/runtime/nodes/mesh.js').replace('export default registerNode(', 'registerNode('), {
    registerNode: def => def, MESH_KINDS: {}, applyBase: noop, meshDataOf, PBR_ENV: {}, effectiveMaterialObject: obj => obj,
    meshPaintConfig: () => false, syncPbrMaterial: noop, syncMeshPaintMaterial: noop, applyShadowMats: noop, PolyMesh,
    THREE: { BufferGeometry: Geometry, BufferAttribute: class {} }, polyBuffers: () => ({positions:[], normals:[], uvs:[], indices:[]}),
  }, { filename: 'src/engine/runtime/nodes/mesh.js' })
  const defs = { mesh, primitive: { update: noop } }
  const getObject = id => store.project.objects.find(o => o.id === id)
  const getDef = type => defs[type]
  const env = load('src/engine/runtime/scene/environment.js', 'environmentMethods', { getDef })
  const graph = load('src/engine/runtime/scene/objects.js', 'objectsMethods', { getDef, signature:sig, nodeAncestors:noop, nodeActive:()=>true })
  const keys = load('src/core/editor/keys.js', 'keysMethods', { store, watch, getObject, GIZMO_CATEGORIES:[], syncPlayerSceneVisuals:()=>events.push('player'), getAudio:()=>({configure:noop}) })
  const visual = obj => ({userData:{sig:sig(obj), mat:{isMeshPhysicalMaterial:true,userData:{}}, ...(obj.type==='mesh'?{meshBody:{geometry:new Geometry()},rev:-1}:{}), type:obj.type}})
  const editor = { ...keys, nodes:new Map([['cube',visual(raw.objects[0])]]), host:{project:store.project,getObject,view:store.view}, terrains:[],
    vp:{requestRender:noop,invalidateShadows:noop,setShaderGraphDocs:noop,setRender:cfg=>events.push('render:'+cfg.exposure)},
    baseRender:()=>store.project.render,_syncViewDiagnosticLod:noop,syncPsxModels:noop,_loadLut:noop,_renderApplied:noop,
    applyRender:env.applyRender,refreshMaterials(){events.push('refresh:'+getObject('cube').type+'/'+this.nodes.get('cube').userData.type);env.refreshMaterials.call(this)},
    syncObject:graph.syncObject,_rebuild(obj){events.push('rebuild:'+obj.type);const n=visual(obj);this.nodes.set(obj.id,n);getDef(obj.type).update(n,obj);return n},
    _attach:noop,_applyShadowFlags:noop,_applyViewToNode:noop,_refreshDecals:noop,_refreshAutoFitBoxes:noop,_refreshTriMeshShapes:noop,_nodeSynced:noop,_scheduleWM:noop,_scheduleBrushes:noop,
    snapshotTerrain:()=>terrain, syncAll(){events.push('sync');this.syncObject('cube')},syncEnvironment(){events.push('environment')},setSelection:noop,applyView:noop,
  }
  store.editor=editor;editor._bindWatchers()
  const history=load('src/core/state/history.js','{resetHistory,commit,undo,redo}',{store,strictJson,toRaw:x=>x,authoredSceneTree:p=>({objects:p.objects,signalConnections:[]}),validateNodeTree:noop,debounce:()=>noop,nextNativeRevision:()=>1})
  history.resetHistory()
  function convert(type, exposure=2){ raw.objects=[makeNode(type)]; editor.syncObject('cube'); store.project.render={exposure};history.commit('Convertir');events.length=0 }
  return {store,editor,history,events,convert,raw}
}

test('Redo de primitiva a malla actualiza materiales sobre la representación reconstruida',()=>{
  const {editor,history,events,convert,store}=setup()
  convert('mesh');history.undo();events.length=0;history.redo()
  assert.equal(store.project.objects[0].type,'mesh');assert.ok(editor.nodes.get('cube').userData.meshBody.geometry)
  assert.ok(events.indexOf('rebuild:mesh') < events.indexOf('refresh:mesh/mesh'))
  assert.ok(events.indexOf('refresh:mesh/mesh') < events.indexOf('environment'))
  assert.equal(events.filter(s=>s==='refresh:mesh/mesh').length,1)
  assert.ok(events.includes('render:2'));assert.equal(store.canRedo,false)
})
test('Undo de malla a primitiva conserva correspondencia antes del refresco',()=>{
  const {editor,history,events,convert,store}=setup();convert('mesh');history.undo()
  assert.equal(store.project.objects[0].type,'primitive');assert.equal(editor.nodes.get('cube').userData.type,'primitive')
  assert.ok(events.indexOf('rebuild:primitive') < events.indexOf('refresh:primitive/primitive'))
  assert.ok(events.includes('render:1'));assert.equal(store.canRedo,true)
})
test('Deshacer y rehacer cambios del render sin cambiar el tipo no reconstruye el objeto',()=>{
  const {editor,history,events,store}=setup(), before=editor.nodes.get('cube')
  store.project.render={exposure:3};history.commit('Render');events.length=0
  history.undo();history.redo()
  assert.equal(editor.nodes.get('cube'),before);assert.ok(!events.some(s=>s.startsWith('rebuild:')))
  assert.deepEqual(events.filter(s=>s.startsWith('render:')),['render:1','render:3'])
  assert.ok(events.indexOf('sync')<events.indexOf('render:1'))
})
test('Cambio editorial de render fuera del historial continúa siendo inmediato',()=>{
  const {store,events}=setup();store.project.render={exposure:4}
  assert.ok(events.includes('render:4'));assert.ok(!events.includes('sync'))
})
test('Una sincronización fallida descarta observadores intermedios y la restauración anterior los reactiva',()=>{
  const {editor,history,events,convert,store}=setup();convert('mesh');history.undo();events.length=0
  const sync=editor.syncAll;let fail=true
  editor.syncAll=function(){if(fail){fail=false;throw Error('fallo de sincronización inyectado')}return sync.call(this)}
  assert.throws(()=>history.redo(),/fallo de sincronización inyectado/)
  assert.equal(store.project.objects[0].type,'primitive');assert.equal(editor.nodes.get('cube').userData.type,'primitive')
  assert.ok(!events.includes('render:2'));assert.equal(store.canRedo,true)
  assert.ok(events.includes('render:1'));events.length=0;history.redo();assert.ok(events.includes('refresh:mesh/mesh'))
})


test('Los cambios de render intermedios se consolidan antes de publicar el estado final',()=>{
  const {store,editor,events}=setup()
  editor.withHistorySceneSync(()=>{
    store.project.render={exposure:2};store.project.render={exposure:5}
    assert.equal(events.filter(s=>s.startsWith('render:')).length,0)
    editor.syncAll()
  })
  assert.deepEqual(events.filter(s=>s.startsWith('render:')),['render:5'])
  assert.ok(events.indexOf('sync')<events.indexOf('render:5'))
})
test('Si también falla la recuperación del historial se conservan ambas excepciones',()=>{
  const {store,editor,history}=setup();store.project.render={exposure:3};history.commit('Render')
  let attempt=0;editor.syncAll=()=>{throw Error('sincronización '+(++attempt))}
  assert.throws(()=>history.undo(),error=>error.name==='AggregateError'&&error.errors.length===2&&error.errors[0].message==='sincronización 1'&&error.errors[1].message==='sincronización 2')
  assert.equal(store.canUndo,true);assert.equal(store.canRedo,false)
  assert.equal(editor._historySceneObservers,null)
})
