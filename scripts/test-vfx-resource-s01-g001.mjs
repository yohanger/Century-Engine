// LF-VFX-S01-G001: prueba módulos reales con dependencias del host aisladas (sin Electron/DOM).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import JSZip from 'jszip'
import { newVfxResource, validateVfxResource, validateVfxIndex, normalizeVfxCollection, vfxIndexOf, VFX_EXT } from '../src/engine/runtime/vfx/resource.js'

// El test utiliza el JSZip instalado por package-lock.json.
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const json = (p) => JSON.parse(read('scripts/fixtures/vfx/' + p))
function source(path, exports, deps) {
  const body = read(path).replace(/^import\s+[^\n]+\n/gm, '').replace(/^export\s+\{[^}]+\}\s*$/gm, '').replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|let|class)\b)/g, '')
    .replace(/await import\('jszip'\)/g, 'await Promise.resolve({ default: JSZipImpl })')
  return new Function(...Object.keys(deps), `${body}\nreturn {${exports.join(',')}}`)(...Object.values(deps))
}
const passthrough = (v) => v
const norm = (defaultValue) => (v) => v ?? defaultValue
const project = source('src/core/project.js', ['ensureFs', 'allEntries', 'uniqueFileName', 'normFolder', 'addFolderChain', 'migrateRecord', 'fileKind'], {
  toRaw: passthrough, defaultDatabase: () => ({}), emptyDatabase: () => ({}), normalizeDatabase: norm({}),
  defaultTheme: () => ({}), normalizeTheme: norm({}), FORMAT_VERSION: 1,
  normalizeTimelines: norm([]), normalizeClips: norm([]), compileGraph: (v) => ({graph:v,code:''}),
  uid: () => 'id_test', makeObject: () => ({}), DEFAULT_LAYERS: [], WFX_DEFAULTS: {}, emptySlots: () => ({}),
  ensureSystemUi: () => {}, getTemplate: () => ({}), DEFAULT_TEMPLATE: '', LEGACY_TEMPLATE: 'default',
  GAME_DEFAULTS: {}, normalizeWorld: norm({}), defaultTagLayers: () => ({}), normalizeTagLayers: norm({}),
  defaultInputMap: () => ({}), normalizeInputMap: norm({}), normalizeProfiles: norm([]), PROFILE_FOLDER: 'Assets/Profiles',
  normalizeMaterials: norm([]), MATERIAL_FOLDER: 'Assets/Materials', normalizeGameManager: passthrough, MANAGER_FOLDER:'Assets/GameManagers', MANAGER_EXT:'.gamemanager',
  normalizeRender: norm({}), presetOf: () => ({}), rendererPreset: () => ({}), BAKE_DEFAULTS: {}, normalizeBake: norm({}),
  defaultAudio: () => ({}), normalizeAudio: norm({}), normalizeLoc: norm({}), normalizeCaptureClips: norm([]),
  normalizeVfxCollection,
})
const zipFormat = source('src/core/lfproj.js', ['buildLfproj', 'parseLfproj'], {
  allEntries: project.allEntries, ensureFs: project.ensureFs, migrateRecord: project.migrateRecord,
  PROJECT_VERSION: 3, upgradeFormat: () => ({rewritten:[]}), isSystemUi: () => false,
  validateVfxResource, vfxIndexOf, JSZipImpl: JSZip,
})
const scene = { objects: [{ id: 'nodo_1', name: 'Preservado', props: { valor: 20 } }], environment: { skyTop:'#ffffff' }, terrain: { enabled: false, size:64, segments:16, layers: [], foliage: [] } }
const base = () => ({ id: 'p1', name: 'Prueba', version: 3, scenes: [{id:'s1',name:'Escena 1',folder:'Assets/Scenes'}], activeSceneId:'s1', folders:['Assets','Assets/Scenes','Assets/Efectos'], models:[], assets:[], scripts:[], shaders:[], uis:[], materials: [], vfx: [json('valid.json')] })
const build = (meta) => zipFormat.buildLfproj({meta, scenes: new Map([['s1',scene]]), files:new Map()})

const invalidCases = [
  ['versión futura', (v) => { v.schemaVersion = 2 }],
  ['vida negativa', (v) => { v.birth.lifetime[0] = -2 }],
  ['vida invertida', (v) => { v.birth.lifetime = [3, 1] }],
  ['número no finito', (v) => { v.emission.rate = Infinity }],
  ['no aceptar cadenas numéricas', (v) => { v.emission.rate = '9' }],
  ['capacidad cero', (v) => { v.emission.capacity = 0 }],
  ['capacidad por encima del límite', (v) => { v.emission.capacity = 1025 }],
  ['capacidad fraccionaria', (v) => { v.emission.capacity = 4.5 }],
  ['curva desordenada', (v) => { v.evolution.opacity[1].t = -0.1 }],
  ['curva sin extremo', (v) => { v.evolution.opacity.at(-1).t = 0.9 }],
  ['colores corruptos', (v) => { v.appearance.color = 'blanco' }],
  ['carpeta fuera de Assets', (v) => { v.folder = '../externo' }],
  ['campo desconocido', (v) => { v.emission.fake = 12 }],
  ['nulo no significa ausente', (v) => { v.emission = null }],
]

test('VFX-Q01 · fixture válido, defaults y datos sin pérdida', () => {
  const raw = json('valid.json')
  assert.deepEqual(validateVfxResource(raw), raw)
  assert.equal(newVfxResource('vfx_nuevo').emission.capacity, 64)
  assert.equal(newVfxResource('vfx_nuevo').schemaVersion, 1)
  assert.equal(project.fileKind('humo.vfx'), 'vfx')
  assert.equal(VFX_EXT, '.vfx')
})
for (const [label, corrupt] of invalidCases) test(`VFX-Q01 · rechazar ${label} sin mutar entrada`, () => {
  const raw = json('valid.json'); corrupt(raw)
  const original = structuredClone(raw)
  assert.throws(() => validateVfxResource(raw))
  assert.deepEqual(raw, original)
})

test('VFX-Q01 · índice e identidad únicos', () => {
  const r = json('valid.json'); const index = vfxIndexOf(r)
  assert.deepEqual(validateVfxIndex(index), index)
  assert.throws(() => normalizeVfxCollection([r, r]), /duplicad/)
  assert.throws(() => normalizeVfxCollection([{...index,schemaVersion: 99}]), /versión/)
  assert.throws(() => normalizeVfxCollection({}), /colección/)
})

test('VFX-Q01 · IDs y rutas VFX tampoco colisionan con otros assets', () => {
  const meta = base()
  meta.assets.push({ id:'vfx_cafe', name:'otra.png', folder:'Assets/Efectos' })
  assert.throws(() => project.ensureFs(meta), /ocupado/)
  const meta2 = base()
  meta2.assets.push({ id:'otro', name:'Vapor de cafe.vfx', folder:'Assets/Efectos', kind:'file' })
  assert.throws(() => project.ensureFs(meta2), /ocupado/)
})

test('VFX-Q02 · round-trip JSZip real, índice independiente y escena conservada', async () => {
  const meta = base()
  const {blob, missing} = await build(meta)
  assert.deepEqual(missing, [])
  const zip = await JSZip.loadAsync(new Uint8Array(await blob.arrayBuffer()))
  const index = JSON.parse(await zip.file('project.json').async('string'))
  assert.deepEqual(index.vfx[0], vfxIndexOf(meta.vfx[0]))
  assert.equal('emission' in index.vfx[0], false)
  assert.deepEqual(JSON.parse(await zip.file('Assets/Efectos/Vapor de cafe.vfx').async('string')), meta.vfx[0])
  const result = await zipFormat.parseLfproj(new Uint8Array(await blob.arrayBuffer()))
  assert.deepEqual(result.meta.vfx, meta.vfx)
  assert.deepEqual(result.scenes.get('s1'), scene)
  assert.deepEqual(result.lost, [])
})

test('VFX-Q02 · rechazo de VFX ausente, corrupto y desajuste con índice', async () => {
  const {blob} = await build(base()); const original = new Uint8Array(await blob.arrayBuffer())
  for (const action of ['missing','corrupt','mismatch','future']) {
    const zip = await JSZip.loadAsync(original)
    const path = 'Assets/Efectos/Vapor de cafe.vfx'
    if (action === 'missing') zip.remove(path)
    else {
      const resource = json('valid.json')
      if (action === 'corrupt') resource.emission.capacity = -1
      if (action === 'mismatch') resource.id = 'vfx_otro'
      if (action === 'future') resource.schemaVersion = 20
      zip.file(path, JSON.stringify(resource))
    }
    const bytes = await zip.generateAsync({type:'uint8array'})
    await assert.rejects(zipFormat.parseLfproj(bytes), /VFX|Falta recurso|Emisión|Nacimiento|Movimiento|Apariencia|Evolución/)
  }
  const good = await zipFormat.parseLfproj(original)
  assert.deepEqual(good.meta.vfx[0], json('valid.json'))
})

test('VFX-Q02 · proyecto anterior sin VFX se abre sin emisores', async () => {
  const old = json('old-project.json')
  const zip = new JSZip()
  zip.file('project.json', JSON.stringify(old))
  zip.file('Assets/Scenes/Escena de prueba.scene.json', JSON.stringify(scene))
  const parsed = await zipFormat.parseLfproj(await zip.generateAsync({type:'uint8array'}))
  assert.deepEqual(parsed.meta.vfx, [])
  assert.deepEqual(parsed.scenes.get('escena_1'), scene)
  const {blob} = await zipFormat.buildLfproj({meta:parsed.meta,scenes:parsed.scenes,files:new Map()})
  const again = await zipFormat.parseLfproj(new Uint8Array(await blob.arrayBuffer()))
  assert.deepEqual(again.meta.vfx, [])
  assert.deepEqual(again.scenes.get('escena_1'), scene)
})

function editorFixture() {
  const p = { ...base(), objects:[{id:'n1',name:'Nodo',vfxId:'vfx_cafe'},{id:'n2',name:'Otro',vfxId:'vfx_cafe'}],
    environment:{},terrain:{enabled:false,layers:[],foliage:[]},profiles:[],gameManagers:[], meshes:[] }
  p.vfx = []
  const editor = {
    snapshotTerrain: () => ({layers:[],foliage:[]}), restoreTerrain(){}, editSnapshot(){return null},
    restoreEdit(){},syncAll(){},syncEnvironment(){},setSelection(){},afterUndo(){},applyView(){},
  }
  const store = {project:p,locked:false,editor, selectedId:null,selectedIds:[],disk:{state:'saved'}, saveState:'saved'}
  const history = source('src/core/state/history.js', ['resetHistory','commit','undo','redo','markDirty'], {
    toRaw:passthrough, store, debounce: () => () => {},
  })
  const vfx = source('src/core/state/vfx.js', ['createVfx','findVfx','updateVfx','finishVfxEdit'], {
    uid: (() => {let n=0;return () => `vfx_created_${++n}`})(), newVfxResource, validateVfxResource, VFX_EXT,
    addFolderChain:project.addFolderChain,normFolder:project.normFolder,uniqueFileName:project.uniqueFileName,
    store,commit:history.commit,markDirty:history.markDirty,isSystemUiPath: () => false,
  })
  history.resetHistory()
  return {p,store,history,vfx}
}

test('VFX-Q03 · crear/Undo/Redo guarda ID y carpeta con historial real', () => {
  const {p,history,vfx} = editorFixture()
  const created = vfx.createVfx('Assets/Nuevos', 'Humo.vfx')
  assert.ok(created.id)
  assert.deepEqual(p.folders.includes('Assets/Nuevos'), true)
  history.undo()
  assert.deepEqual(p.vfx, [])
  assert.equal(p.folders.includes('Assets/Nuevos'), false)
  history.redo()
  assert.equal(p.vfx[0].id, created.id)
  assert.equal(p.folders.includes('Assets/Nuevos'), true)
})

test('VFX-Q03 · editar parcial, inválido no muta, Undo/Redo preserva referencias', () => {
  const {p,history,vfx} = editorFixture()
  const r = vfx.createVfx('Assets','Vapor.vfx')
  assert.throws(() => vfx.updateVfx(r.id,{emission:{capacity:0}}))
  assert.equal(vfx.findVfx(r.id).emission.capacity, 64)
  assert.ok(vfx.updateVfx(r.id,{emission:{rate:24}}))
  history.undo()
  assert.equal(vfx.findVfx(r.id).emission.rate, 12)
  history.redo()
  assert.equal(vfx.findVfx(r.id).emission.rate, 24)
  assert.equal(p.objects[0].vfxId,p.objects[1].vfxId)
})

test('VFX-Q03 · un gesto en múltiples frames produce un único Undo', () => {
  const {history,vfx} = editorFixture()
  const r = vfx.createVfx('Assets','Café.vfx')
  for (const value of [14,18,22]) assert.ok(vfx.updateVfx(r.id,{emission:{rate:value}},{record:false}))
  assert.ok(vfx.finishVfxEdit(r.id))
  assert.equal(vfx.finishVfxEdit(r.id),false)
  history.undo()
  assert.equal(vfx.findVfx(r.id).emission.rate,12)
  history.redo()
  assert.equal(vfx.findVfx(r.id).emission.rate,22)
})
