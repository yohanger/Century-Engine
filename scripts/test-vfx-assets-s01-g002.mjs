// Gate G002: rutas públicas de empaquetado y CRUD del proyecto con I/O del host aislado.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import JSZip from 'jszip'
import { newVfxResource, validateVfxResource, normalizeVfxCollection } from '../src/engine/runtime/vfx/resource.js'

const read = (name) => readFileSync(new URL('../' + name, import.meta.url), 'utf8')
const source = (file, names, deps) => {
  const code = read(file).replace(/^import\s+[^\n]+\n/gm, '')
    .replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|let|class)\b)/g, '')
    .replace(/^export\s+\{[^}]+\}\s*$/gm, '')
    .replace(/await import\('jszip'\)/g, 'await Promise.resolve({default: JSZipImpl})')
  return new Function(...Object.keys(deps), `${code}\nreturn {${names.join(',')}}`)(...Object.values(deps))
}
const norm = (d) => (v) => v ?? d
const project = source('src/core/project.js', ['allEntries', 'uniqueFileName', 'normFolder','sanitizeName','ROOT_FOLDER'], {
  toRaw: (v) => v, defaultDatabase: () => ({}), emptyDatabase: () => ({}), normalizeDatabase: norm({}),
  defaultTheme: () => ({}), normalizeTheme: norm({}), FORMAT_VERSION:1, normalizeTimelines: norm([]),normalizeClips:norm([]),compileGraph:(v)=>({graph:v,code:''}),
  uid:()=> 'p1',makeObject:()=>({}),DEFAULT_LAYERS:[],WFX_DEFAULTS:{},emptySlots:()=>({}),ensureSystemUi:()=>{},getTemplate:()=>({}),DEFAULT_TEMPLATE:'',LEGACY_TEMPLATE:'default',
  GAME_DEFAULTS:{},normalizeWorld:norm({}),defaultTagLayers:()=>({}),normalizeTagLayers:norm({}),defaultInputMap:()=>({}),normalizeInputMap:norm({}),
  normalizeProfiles:norm([]),PROFILE_FOLDER:'Assets/Profiles', normalizeMaterials:norm([]),MATERIAL_FOLDER:'Assets/Materials',normalizeGameManager:(v)=>v,MANAGER_FOLDER:'Assets/GameManagers',MANAGER_EXT:'.gamemanager',
  normalizeRender:norm({}),presetOf:()=>({}),rendererPreset:()=>({}),BAKE_DEFAULTS:{},normalizeBake:norm({}),defaultAudio:()=>({}),normalizeAudio:norm({}),normalizeLoc:norm({}),normalizeCaptureClips:norm([]), normalizeVfxCollection,
})
const isSystemUi = ()=>false, isSystemUiPath = ()=>false
const level = source('src/core/levelpackage.js', ['resolveLevelPackageSelection','buildLevelPackage','LEVELPACKAGE_FORMAT','LEVELPACKAGE_VERSION'], {
  allEntries: project.allEntries, ROOT_FOLDER:'Assets',isSystemUi,isSystemUiPath,validateVfxResource,JSZipImpl:JSZip,
})
const importer = source('src/core/levelpackage-import.js', ['readLevelPackage','planLevelPackageImport','validateLevelPackageManifest','levelPackageSelection'], {
  allEntries:project.allEntries,ROOT_FOLDER:'Assets',sanitizeName:project.sanitizeName,isSystemUiPath,
  LEVELPACKAGE_FORMAT:level.LEVELPACKAGE_FORMAT,LEVELPACKAGE_VERSION:level.LEVELPACKAGE_VERSION,
  normalizeMaterial:(v)=>v,validateVfxResource,JSZipImpl:JSZip,
})
const texture = new Uint8Array(readFileSync(new URL('./fixtures/vfx/white-original.png', import.meta.url)))
const scene = {objects: [], environment:{}, terrain:{layers:[],foliage:[],size:64,segments:4}}
const base = () => ({id:'project1',name:'Origen',version:3,scenes:[{id:'scene1',name:'Escena',folder:'Assets/Scenes'}],activeSceneId:'scene1',
  folders:['Assets','Assets/Scenes','Assets/Efectos','Assets/Textures'],
  prefabs:[],models:[],scripts:[],shaders:[],uis:[],profiles:[],materials:[],gameManagers:[],vfx:[],assets:[]})
const fixture = () => {
  const meta = base()
  const vfx = newVfxResource('vfx_smoke','Humo.vfx','Assets/Efectos')
  vfx.appearance.textureId = 'tex_white'
  meta.vfx.push(vfx)
  meta.assets.push({id:'tex_white',name:'white-original.png',folder:'Assets/Textures',kind:'texture',ext:'png',bytes:texture.length})
  return meta
}
async function pack(meta, selection=[{kind:'vfx',id:'vfx_smoke'}]) {
  const scenes=new Map([['scene1',scene]])
  return level.buildLevelPackage({meta,scenes,files:new Map([['tex_white',texture]]),selection})
}
const fileLike = (blob) => ({size:blob.size,arrayBuffer:()=>blob.arrayBuffer()})
let idSeq = 0
const gen = (prefix)=>`${prefix}_new${++idSeq}`

test('VFX-P01: selección de VFX añade una textura y no la duplica', async ()=> {
  const meta=fixture();const plan=level.resolveLevelPackageSelection({meta,scenes:new Map([['scene1',scene]]),selection:[{kind:'vfx',id:'vfx_smoke'},{kind:'texture',id:'tex_white'}]})
  assert.equal(plan.entries.length,2)
  assert.deepEqual(plan.dependencyIds.get('vfx_smoke'), ['tex_white'])
  assert.equal(plan.dependenciesAdded,0)
})
test('VFX-P02: ZIP real, metadatos mínimos y cuerpo VFX íntegro', async ()=>{
  const {blob,manifest}=await pack(fixture())
  assert.equal(manifest.entries.length,2)
  const zip=await JSZip.loadAsync(await blob.arrayBuffer())
  assert.deepEqual(JSON.parse(await zip.file('Assets/Efectos/Humo.vfx').async('string')), fixture().vfx[0])
  const header=manifest.entries.find((e)=>e.kind==='vfx')
  assert.deepEqual(Object.keys(header.metadata).sort(),['folder','id','name'].sort())
  const {manifest:parsed,contents}=await importer.readLevelPackage(fileLike(blob),JSZip)
  assert.deepEqual(parsed.entries,manifest.entries)
  assert.equal(contents.get('tex_white').length,texture.length)
  assert.equal(contents.get('vfx_smoke').appearance.textureId,'tex_white')
})
test('VFX-P03: importar VFX remapea ID, mantiene dependencia e incluye binario', async ()=>{
  const {blob}=await pack(fixture())
  const data=await importer.readLevelPackage(fileLike(blob),JSZip)
  const original=JSON.stringify(base())
  const dest=base()
  const plan=importer.planLevelPackageImport({...data,project:dest,selectedIds:['vfx_smoke'],makeId:gen})
  assert.equal(plan.records.length,2)
  assert.equal(plan.assets.length,1)
  assert.equal(plan.records.find((r)=>r.collection==='vfx').ref.appearance.textureId,plan.records.find((r)=>r.collection==='assets').ref.id)
  assert.equal(plan.records.find((r)=>r.collection==='vfx').ref.id!== 'vfx_smoke',true)
  assert.equal(JSON.stringify(dest),original)
})
test('VFX-P04: conflictos sin decisión bloquean, reutilización de textura remapea',async()=>{
  const {blob}=await pack(fixture());const data=await importer.readLevelPackage(fileLike(blob),JSZip)
  const dest=base();dest.assets.push({id:'existing_texture',folder:'Assets/Textures',name:'white-original.png',kind:'texture'})
  assert.throws(()=>importer.planLevelPackageImport({...data,project:dest,selectedIds:['vfx_smoke'],makeId:gen}),/Resuelve el conflicto/)
  const plan=importer.planLevelPackageImport({...data,project:dest,selectedIds:['vfx_smoke'],makeId:gen,decisions:{tex_white:'reuse'}})
  assert.equal(plan.assets.length,0)
  assert.equal(plan.records.find((r)=>r.collection==='vfx').ref.appearance.textureId,'existing_texture')
})
test('VFX-P05: rechazo de recurso corrupto, versión futura y cuerpo desincronizado sin mutación',async()=>{
  const {blob}=await pack(fixture());const data=await importer.readLevelPackage(fileLike(blob),JSZip)
  for (const mutate of [
    (v)=>{v.emission.capacity=0},(v)=>{v.schemaVersion=2},(v)=>{v.name='Falso.vfx'}
  ]) {
    const contents=new Map(data.contents);const v=structuredClone(contents.get('vfx_smoke'));mutate(v);contents.set('vfx_smoke',v)
    const original=JSON.stringify(base())
    assert.throws(()=>importer.planLevelPackageImport({manifest:data.manifest,contents,project:base(),selectedIds:['vfx_smoke'],makeId:gen}),/VFX|Emisión|incoherente|versión/)
    assert.equal(JSON.stringify(base()),original)
  }
})
test('VFX-P06: textura sin dependencia rechazada en el planificador',async()=>{
  const {blob}=await pack(fixture());const data=await importer.readLevelPackage(fileLike(blob),JSZip)
  const manifest=structuredClone(data.manifest);manifest.entries.find((e)=>e.kind==='vfx').dependencies=[]
  assert.throws(()=>importer.planLevelPackageImport({manifest,contents:data.contents,project:base(),selectedIds:['vfx_smoke'],makeId:gen}),/Textura de VFX no incluida/)
})
test('VFX-P07: ruta y tipo del recurso inválidos se rechazan antes de leer',async()=>{
  const {blob}=await pack(fixture());const {manifest}=await importer.readLevelPackage(fileLike(blob),JSZip)
  const clone=structuredClone(manifest);clone.entries.find((e)=>e.kind==='vfx').path='Assets/../Humo.vfx'
  assert.throws(()=>importer.validateLevelPackageManifest(clone,manifest.entries.map((e)=>e.path).concat('levelpackage.json')),/Ruta/)
})

const usageStore = {project: fixture(), locked:false}
const notifications=[]
const commits=[]
const usage = source('src/core/state/filesystem.js', ['findAssetUsage','removeEntry','renameEntry','moveEntry','duplicateEntry','renameFolder','deleteFolder'], {
  db:{ loadScene:async (_pid,sid)=>({objects:[{id:'node_saved',name:'Viejo',props:{vfxId:'vfx_smoke'}}],terrain:{layers:[]}}), deleteAsset:async()=>{} },
  uid:gen, addFolderChain:()=>{},allEntries:project.allEntries,uniqueFileName:project.uniqueFileName,fileKind:()=>{},extOf:(s)=>s.split('.').at(-1),sanitizeName:project.sanitizeName,
  normFolder:project.normFolder,parentFolder:()=>{},folderName:()=>{},ROOT_FOLDER:'Assets', eventPagesUsingModel:()=>[],
  store:usageStore,toast:(...a)=>notifications.push(a),commit:(...a)=>commits.push(a),duplicateScene:()=>{},renameScene:()=>{},deleteScene:()=>{},
  SUFFIX:{},stripSuffix:(_kind,n)=>n,removePrefabData:()=>{},unlinkTexture:()=>{},dropUrl:()=>{},dropUi:()=>{},isSystemUi:()=>false,isSystemUiPath:()=>false,
  dropShader:()=>{},dropProfile:()=>{},dropMaterial:()=>{},materialUsagesInOtherScenes:async()=>[],normalizeMaterial:(v)=>v,normalizeProfile:(v)=>v,
  dropGameManager:()=>{},normalizeGameManager:(v)=>v,closeScriptEditor:()=>{},validateVfxResource,
})
test('VFX-C01: renombrar y mover conservan ID sin cambiar la definición',()=>{
  usageStore.project=fixture()
  assert.equal(usage.renameEntry('vfx','vfx_smoke','Vapor'),true)
  assert.equal(usageStore.project.vfx[0].name,'Vapor.vfx')
  assert.equal(usage.moveEntry('vfx','vfx_smoke','Assets/Textures'),true)
  assert.equal(usageStore.project.vfx[0].id,'vfx_smoke')
  assert.equal(usageStore.project.vfx[0].folder,'Assets/Textures')
})
test('VFX-C02: duplicar genera identidad diferente y conserva textura',async()=>{
  usageStore.project=fixture()
  const result=await usage.duplicateEntry('vfx','vfx_smoke')
  assert.equal(result.kind,'vfx')
  assert.notEqual(result.id,'vfx_smoke')
  assert.equal(usageStore.project.vfx.length,2)
  assert.equal(usageStore.project.vfx[1].appearance.textureId,'tex_white')
  assert.equal(usageStore.project.vfx[1].name,'Humo copia.vfx')
})
test('VFX-C03: proteger VFX referenciado desde prefab, y textura desde VFX',async()=>{
  usageStore.project=fixture()
  usageStore.project.prefabs=[{id:'pf1',name:'Efecto',folder:'Assets',objects:[{id:'a',props:{vfxId:'vfx_smoke'}}]}]
  assert.deepEqual(await usage.findAssetUsage('vfx','vfx_smoke'),['Prefab Efecto / a'])
  assert.equal(await usage.removeEntry('vfx','vfx_smoke'),false)
  assert.equal(usageStore.project.vfx.length,1)
  assert.deepEqual(await usage.findAssetUsage('texture','tex_white'),['VFX Humo.vfx'])
  assert.equal(await usage.removeEntry('texture','tex_white'),false)
  assert.equal(usageStore.project.assets.length,1)
})
test('VFX-C04: proteger VFX desde escena guardada sin abrir',async()=>{
  usageStore.project=fixture()
  usageStore.project.scenes.push({id:'scene2',name:'Guardada',folder:'Assets/Scenes'})
  assert.deepEqual(await usage.findAssetUsage('vfx','vfx_smoke'), ['Guardada / Viejo'])
  assert.equal(await usage.removeEntry('vfx','vfx_smoke'),false)
})
test('VFX-C05: se permite eliminar VFX sin usos y se conserva la textura',async()=>{
  usageStore.project=fixture()
  assert.equal(await usage.removeEntry('vfx','vfx_smoke'),true)
  assert.equal(usageStore.project.vfx.length,0)
  assert.equal(usageStore.project.assets.length,1)
})

test('VFX-I01: API pública de importación confirma IndexedDB antes de aplicar VFX en memoria', async()=>{
  const {blob}=await pack(fixture())
  const packageData=await importer.readLevelPackage(fileLike(blob),JSZip)
  const journal=[]
  const dest=base()
  const store={project:dest,locked:false,saveState:'dirty',editor:{
    serializeTerrain:()=>dest.terrain || {layers:[]}, thumbnail:()=>null,flushEdit:()=>{},
  },disk:{state:'none'},prefs:{diskDelay:3}}
  const db={
    saveScene:async()=>{}, saveProject:async()=>{}, lastProjectId:{set:()=>{}},
    saveLevelPackageImport:async(meta,scenes,assets)=>{journal.push({vfx:structuredClone(meta.vfx),scenes,assets});},
  }
  const live=source('src/core/state/project.js',['importLevelPackage'],{
    reactive:(v)=>v,askConfirm:async()=>true,askChoice:async()=>false,EditorCameraViews:class {},
    store,db,uid:gen,toast:()=>{},markDirty:()=>{},configureHistory:()=>{},syncPieces:()=>{},
    splitProject:(proj)=>({meta:structuredClone(proj),scene:structuredClone(scene)}),
    planLevelPackageImport:importer.planLevelPackageImport,addFolderChain:(meta,folder)=>{if(!meta.folders.includes(folder))meta.folders.push(folder)},
  })
  assert.equal(await live.importLevelPackage(packageData,['vfx_smoke'],{}),true)
  assert.equal(journal.length,1)
  assert.equal(journal[0].vfx.length,1)
  assert.equal(journal[0].assets.length,1)
  assert.equal(store.project.vfx.length,1)
  assert.equal(store.project.vfx[0].appearance.textureId,store.project.assets[0].id)
  // Cuando la transacción falla, la importación no debe montar referencias parciales.
  store.project=base()
  db.saveLevelPackageImport=async()=>{throw new Error('IndexedDB abort')};
  const before=JSON.stringify({vfx:store.project.vfx,assets:store.project.assets})
  const originalError=console.error
  try {console.error=()=>{};assert.equal(await live.importLevelPackage(packageData,['vfx_smoke'],{}),false)}
  finally {console.error=originalError}
  assert.equal(JSON.stringify({vfx:store.project.vfx,assets:store.project.assets}),before)
})
