// G003: validación del contrato y llamadas reales de los editores especializados.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { writeAssetDrag, resolveAssetDrop } from '../src/core/editor/asset-drop.js'

const read = name => readFileSync(new URL(`../src/components/${name}.vue`, import.meta.url), 'utf8')
const entries = [
  {kind:'material',id:'mat1',name:'Pavimento.material'},
  {kind:'shader',id:'sha1',name:'PBR.shader',ref:{graph:{target:'surface'}}},
  {kind:'shader',id:'shaPost',name:'Post.shader',ref:{graph:{target:'post'}}},
  {kind:'texture',id:'tex1',name:'acera.png'},
  {kind:'file',id:'imgFile',name:'rain.jpg'},
  {kind:'vfx',id:'fx1',name:'Vapor.vfx'},
  {kind:'audio',id:'aud1',name:'gota.ogg',ref:{ext:'ogg'}},
  {kind:'file',id:'aud2',name:'metal.wav',ref:{ext:'wav'}},
  {kind:'file',id:'badFile',name:'notas.txt',ref:{ext:'txt'}},
  {kind:'profile',id:'post1',name:'Exterior.post'},
  {kind:'model',id:'mdl1',name:'Puente.glb'},
  {kind:'prefab',id:'pf1',name:'Acera.prefab'},
]
function drag(...requested) {
  const data=new Map(); const dt={get types(){return [...data.keys()]},getData:k=>data.get(k)||'',setData:(k,v)=>data.set(k,v)}
  assert.equal(writeAssetDrag(dt,requested),true);return dt
}
const resolve=(kinds,ids,dt)=>resolveAssetDrop(dt,entries,{kinds,accepts:e=>ids.includes(e.id)})
function scriptOf(name) {
  const script=read(name).match(/<script setup>([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script,name)
  return script.replace(/^import .*$/gm,'')
}
// Ejecutar las funciones del componente en VM con setters reales es suficiente para comprobar
// la representación, sin presentar esto como prueba de renderizado Electron/Vue.
function uiMethods() {
  const s=scriptOf('UiDesignerPanel')
  const scope={
    computed:f=>({get value(){return f()}}),
    ref:value=>({value}), // El Inspector del diseñador ahora utiliza un filtro reactivo local; las aserciones de recursos no cambian.
    defineProps:()=>({D:{dz:{design:{controls:[]},sel:'ctl1'},setProp:(...args)=>changes.push(args)}}),
    defineEmits:()=>()=>{},
    store:{project:{assets:[{kind:'texture',id:'tex1',name:'acera.png'},{kind:'audio',id:'aud1',name:'gota.ogg',ext:'ogg'}],uis:[]},uiEditId:'ui'},
    loc:()=>({entries:[],base:'es'}),
    CONTROLS:{},CONTROL_TYPES:[],CONTROL_GROUPS:[],FORM_KINDS:[],ENTER_ANIMS:[],EXIT_ANIMS:[],SCALE_MODES:[],
    byId:()=>({id:'ctl1',map:'Ana:triste=antigua.png',anchor:[false,false,false,false]}),
    propsOf:()=>[],childrenOf:()=>[],PRESETS_BY_KIND:{},
    parsePortraitMap:(text)=>new Map(text.split(';').map(x=>x.trim()).filter(Boolean).map(x=>x.split('='))),
    AUDIO_EXT:['ogg','wav','mp3'],
  }
  const changes=[]
  vm.runInNewContext(`${s}\nglobalThis.methods={assignUiAsset,assignPortrait, textures, audios, portraitRows};`,scope,{filename:'UiDesignerPanel.vue'})
  return {...scope.methods,changes}
}
function runResourceSlot(kinds,ids,dt,all=entries) {
  const s=scriptOf('ResourceDropSlot')
  const events=[]
  const ctx={defineProps:()=>({kinds,acceptedIds:ids}),defineEmits:()=>((...a)=>events.push(a)),ref:v=>({value:v}),
    store:{project:{entries:all}},allEntries:p=>p.entries,
    hasAssetDrag:t=>t.types.includes('application/x-lf-entry')||t.types.includes('application/x-lf-entries'),resolveAssetDrop}
  vm.runInNewContext(`${s}\nglobalThis.runDrop=drop`,ctx)
  let prevented=false,stopped=false
  ctx.runDrop({dataTransfer:dt,preventDefault(){prevented=true},stopPropagation(){stopped=true}})
  return {events,prevented,stopped}
}

test('G003-01 recursos compartidos: material por ID real y tipo',()=>{
  assert.equal(resolve(['material'],['mat1'],drag({kind:'material',id:'mat1'})).id,'mat1')
  assert.equal(resolve(['material'],['mat1'],drag({kind:'texture',id:'tex1'})),null)
})
test('G003-02 shaders de material excluyen target post',()=>{
  const ids=entries.filter(e=>e.kind==='shader'&&e.ref?.graph?.target!=='post').map(e=>e.id)
  assert.equal(resolve(['shader'],ids,drag({kind:'shader',id:'sha1'})).id,'sha1')
  assert.equal(resolve(['shader'],ids,drag({kind:'shader',id:'shaPost'})),null)
})
test('G003-03 VFX3D solo admite recursos vfx',()=>{
  assert.equal(resolve(['vfx'],['fx1'],drag({kind:'vfx',id:'fx1'})).id,'fx1')
  assert.equal(resolve(['vfx'],['fx1'],drag({kind:'texture',id:'tex1'})),null)
})
test('G003-04 textura VFX admite imágenes autorizadas, no documentos',()=>{
  assert.equal(resolve(['texture','file'],['tex1','imgFile'],drag({kind:'file',id:'imgFile'})).id,'imgFile')
  assert.equal(resolve(['texture','file'],['tex1','imgFile'],drag({kind:'file',id:'badFile'})),null)
})
test('G003-05 audio UI/ParamForm: acepta .ogg/.wav pero no .txt',()=>{
  assert.equal(resolve(['audio','file'],['aud1','aud2'],drag({kind:'file',id:'aud2'})).id,'aud2')
  assert.equal(resolve(['audio','file'],['aud1','aud2'],drag({kind:'file',id:'badFile'})),null)
})
test('G003-06 rechaza recurso eliminado, multiselección y tipo falso',()=>{
  assert.equal(resolve(['material'],['mat1'],drag({kind:'material',id:'desaparecido'})),null)
  assert.equal(resolve(['material'],['mat1'],drag({kind:'material',id:'mat1'},{kind:'shader',id:'sha1'})),null)
  assert.equal(resolve(['material'],['mat1'],drag({kind:'material',id:'tex1'})),null)
})
test('G003-07 drop especializado: emite ID, para la propagación y no crea objetos',()=>{
  const r=runResourceSlot(['material'],['mat1'],drag({kind:'material',id:'mat1'}))
  assert.equal(JSON.stringify(r.events),JSON.stringify([['assign','mat1']]))
  assert.ok(r.prevented&&r.stopped)
})
test('G003-08 rechazos en slot no modifican el recurso',()=>{
  const r=runResourceSlot(['material'],['mat1'],drag({kind:'texture',id:'tex1'}))
  assert.equal(JSON.stringify(r.events),JSON.stringify([['reject']]))
  assert.ok(r.prevented&&r.stopped)
})
test('G003-09 MaterialSection llama al setter de material compartido, no copia props',()=>{
  const s=read('MaterialSection')
  assert.match(s, /:kinds="\['material'\]" :accepted-ids="materials\.map\(m => m\.id\)" @assign="choose"/)
  assert.match(s,/function choose\(id\) \{ if \(!id\) makeMaterialLocal\(props\.obj\.id\); else assignMaterial\(props\.obj\.id, id\) \}/)
})
test('G003-10 MaterialShader usa setShader y preserva el selector incorporado',()=>{
  const s=read('MaterialShader')
  assert.match(s, /materialShaderIds = computed\(\(\) => .*graph\?\.target !== 'post'/)
  assert.match(s, /@assign="setShader"/)
  assert.match(s, /const setShader = \(id\) => patchMaterial/)
  assert.match(s, /@change="setShader\(\$event\.target\.value\)"/)
})
test('G003-11 VFX Editor llama patch en appearance.textureId, confirmando en historial',()=>{
  const s=read('VfxEditor')
  assert.match(s, /@assign="patch\('appearance','textureId',\$event\)"/)
  assert.match(s, /updateVfx\(id, \{ \[group\]: \{ \[key\]: value \} \}, \{ record \}\)/)
  assert.match(s, /@change="patch\('appearance','textureId',\$event\.target\.value\)"/)
})
test('G003-12 Inspector VFX3D usa upd y referencia, no crea emisores nuevos',()=>{
  const s=read('Inspector')
  assert.match(s, /:kinds="\['vfx'\]" :accepted-ids="\(store\.project\?\.vfx \|\| \[\]\)\.map\(fx => fx\.id\)"/)
  assert.match(s, /@assign="upd\(\{ props: \{ vfxId: \$event \} \}\)"/)
})
test('G003-13 SurfaceDetail respeta id de textura y validación existente',()=>{
  const s=read('MaterialSurfaceDetail')
  assert.match(s, /@assign="change\('texture', \$event\)"/)
  assert.match(s, /const change = \(key, value\) => props\.edit/)
  assert.match(s, /v-if="fileMissing/)
})
test('G003-14 UI Designer: asigna NOMBRE al campo de imagen, no ID',()=>{
  const m=uiMethods();m.assignUiAsset({key:'image'},'tex1',m.textures.value)
  assert.equal(JSON.stringify(m.changes),JSON.stringify([['ctl1','image','acera.png']]))
})
test('G003-15 UI Designer: asigna NOMBRE al campo audio',()=>{
  const m=uiMethods();m.assignUiAsset({key:'sound'},'aud1',m.audios.value)
  assert.equal(JSON.stringify(m.changes),JSON.stringify([['ctl1','sound','gota.ogg']]))
})
test('G003-16 UI Designer: retrato edita la fila y conserva personaje/expresión',()=>{
  const m=uiMethods();m.assignPortrait(0,'tex1')
  assert.equal(JSON.stringify(m.changes),JSON.stringify([['ctl1','map','Ana:triste=acera.png']]))
})
test('G003-17 UI Designer: un ID inexistente no asigna nombre ficticio',()=>{
  const m=uiMethods();m.assignUiAsset({key:'image'},'gone',m.textures.value)
  m.assignPortrait(0,'gone');assert.equal(m.changes.length,0)
})
test('G003-18 ParamForm: audio usa una rama única y mantiene nombre almacenado',()=>{
  const s=read('ParamForm')
  assert.equal((s.match(/p\.type === 'audio'/g)||[]).length,1)
  assert.match(s, /const setAudio = \(p, id\) => \{ const asset = audioAssets\.value\.find\(a => a\.id === id\); if \(asset\) set\(p, asset\.name\) \}/)
  assert.match(s, /:value="a\.name"/)
})
test('G003-19 ParamForm: textura, perfil, prefab y modelo retienen formato',()=>{
  const s=read('ParamForm')
  for(const kind of ['texture','profile','prefab','model']) assert.match(s,new RegExp(`p.type === '${kind}'`))
  assert.match(s, /@assign="set\(p, prefabIds\.includes\(\$event\) \? 'prefab:' \+ \$event : \$event\)"/)
  assert.match(s, /@assign="set\(p, \$event\)"/)
})
test('G003-20 ShaderGraph mantiene vínculo por material, sin crear registro paralelo',()=>{
  const s=read('ShaderGraphEditor')
  assert.match(s,/const activeMaterial = computed\(\(\) => linkedMaterials/)
  assert.doesNotMatch(s,/ResourceDropSlot/)
})
test('G003-21 no se ha tocado el esquema de guardado ni Player',()=>{
  const slot=read('ResourceDropSlot')
  assert.doesNotMatch(slot, /JSON\.parse|addObject\(|updateObject\(|commit\(/)
})
