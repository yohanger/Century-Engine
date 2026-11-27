// QA de integración S01. Sin montar Vue/Electron: verificación del contrato real
// desde el catálogo de proyecto hasta el receptor y la asignación del propietario.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { writeAssetDrag, resolveAssetDrop, ASSET_ENTRY_MIME, ASSET_ENTRIES_MIME } from '../src/core/editor/asset-drop.js'

const root = new URL('../', import.meta.url)
const read = file => readFileSync(new URL(file, root), 'utf8')
const projectSource = read('src/core/project.js')
const start = projectSource.indexOf('export function allEntries(project) {')
const end = projectSource.indexOf('/** Nombre libre', start)
assert.ok(start >= 0 && end > start, 'El catálogo allEntries debe seguir disponible')
const context = { PREFAB_SUFFIX: '.prefab', MANAGER_FOLDER: 'Assets/Managers', PROFILE_FOLDER: 'Assets/Profiles', MATERIAL_FOLDER: 'Assets/Materials', ROOT_FOLDER: 'Assets' }
vm.runInNewContext(projectSource.slice(start, end).replace('export ', '') + '\nglobalThis.allEntries = allEntries', context)
const allEntries = p => Array.from(context.allEntries(p))
const resourceComponent = read('src/components/ResourceDropSlot.vue')
const slotScript = resourceComponent.match(/<script setup>([\s\S]*?)<\/script>/)?.[1]
assert.ok(slotScript)
function project() {
  return {
    scenes: [], prefabs: [], models: [], scripts: [{id:'script-1',name:'Evento.js'}], uis: [],
    shaders: [{id:'shader-1',name:'Shader.glsl',graph:{target:'surface'}}], gameManagers: [],
    profiles: [{id:'profile-1',name:'Escena.post'}],
    materials: [{id:'material-1',name:'Acera.material'}],
    vfx: [{id:'vfx-1',name:'Vapor.vfx'}],
    assets: [
      {id:'audio-1',kind:'audio',name:'agua.ogg'},
      {id:'texture-1',kind:'texture',name:'piso.png'},
      {id:'bad-1',kind:'file',name:'texto.txt'},
    ],
    objects: [{id:'object-1',props:{clip:'', image:'', profile:'', vfxId:'', materialId:''}}],
  }
}
function transfer(requests) {
  const values = new Map()
  const dt = {get types(){return [...values.keys()]},setData(k,v){values.set(k,v)},getData:k=>values.get(k)||''}
  assert.equal(writeAssetDrag(dt, requests), true)
  return dt
}
function event(dt) {
  return {dataTransfer:dt, prevented:0, stopped:0,
    preventDefault(){this.prevented++},stopPropagation(){this.stopped++}}
}
function slot(p, kinds, acceptedIds, dt, owner) {
  const calls = [], state = {value:false}
  const scope = {
    defineProps:()=>({kinds,acceptedIds}),defineEmits:()=>((name, id)=>{calls.push([name,id]);if(name==='assign')owner?.(id)}),
    ref:()=>state,store:{project:p},allEntries,hasAssetDrag:t=>t.types.includes(ASSET_ENTRY_MIME)||t.types.includes(ASSET_ENTRIES_MIME),resolveAssetDrop,
  }
  vm.runInNewContext(slotScript.replace(/^import .*$/gm,'')+'\nglobalThis.methods = {drop,dragOver,dragLeave};',scope)
  const e = event(dt)
  scope.methods.dragOver(e)
  const during = state.value
  scope.methods.drop(e)
  return {calls, e, during, after:state.value}
}

test('G004-01 catálogo real preserva tipos e identidades de G001–G003',()=>{
  const result = allEntries(project())
  for(const [kind,id] of [['script','script-1'],['shader','shader-1'],['profile','profile-1'],['material','material-1'],['vfx','vfx-1'],['audio','audio-1'],['texture','texture-1']])
    assert.equal(result.filter(e=>e.kind===kind&&e.id===id).length,1)
})
test('G004-02 audio de Assets llega al slot y al propietario por ID',()=>{
  const p=project(); const r=slot(p,['audio'],['audio-1'],transfer([{kind:'audio',id:'audio-1'}]),id=>p.objects[0].props.clip=id)
  assert.deepEqual(r.calls,[['assign','audio-1']]); assert.equal(p.objects[0].props.clip,'audio-1')
  assert.equal(r.e.prevented,2); assert.equal(r.e.stopped,2); assert.equal(r.during,true); assert.equal(r.after,false)
})
test('G004-03 rechazo de textura en audio no modifica datos ni llega al viewport',()=>{
  const p=project(); p.objects[0].props.clip='audio-1'
  const r=slot(p,['audio'],['audio-1'],transfer([{kind:'texture',id:'texture-1'}]),id=>p.objects[0].props.clip=id)
  assert.deepEqual(r.calls,[['reject',undefined]]); assert.equal(p.objects[0].props.clip,'audio-1')
  assert.equal(r.e.stopped,2)
})
test('G004-04 recurso eliminado tras empezar el arrastre se rechaza',()=>{
  const p=project(); const dt=transfer([{kind:'texture',id:'texture-1'}]);p.assets=[]
  const r=slot(p,['texture'],['texture-1'],dt,id=>p.objects[0].props.image=id)
  assert.deepEqual(r.calls,[['reject',undefined]]); assert.equal(p.objects[0].props.image,'')
})
test('G004-05 selección múltiple en slot único no causa asignación',()=>{
  const p=project(); const dt=transfer([{kind:'audio',id:'audio-1'},{kind:'texture',id:'texture-1'}])
  const r=slot(p,['audio'],['audio-1'],dt,id=>p.objects[0].props.clip=id)
  assert.deepEqual(r.calls,[['reject',undefined]]); assert.equal(p.objects[0].props.clip,'')
})
test('G004-06 renombrar material conserva asignación por identidad',()=>{
  const p=project(),dt=transfer([{kind:'material',id:'material-1'}]);p.materials[0].name='Bordillo.material'
  const r=slot(p,['material'],['material-1'],dt,id=>p.objects[0].props.materialId=id)
  assert.deepEqual(r.calls,[['assign','material-1']]); assert.equal(p.objects[0].props.materialId,'material-1')
})
test('G004-07 recurso .vfx usa referencia y no crea objetos ni otro emisor',()=>{
  const p=project(),before=p.objects.length
  slot(p,['vfx'],['vfx-1'],transfer([{kind:'vfx',id:'vfx-1'}]),id=>p.objects[0].props.vfxId=id)
  assert.equal(p.objects.length,before); assert.equal(p.vfx.length,1); assert.equal(p.objects[0].props.vfxId,'vfx-1')
})
test('G004-08 serialización JSON del modelo de prueba conserva referencia',()=>{
  const p=project();slot(p,['profile'],['profile-1'],transfer([{kind:'profile',id:'profile-1'}]),id=>p.objects[0].props.profile=id)
  const reopened=JSON.parse(JSON.stringify(p)); assert.equal(reopened.objects[0].props.profile,'profile-1')
  assert.equal(allEntries(reopened).find(e=>e.id==='profile-1').kind,'profile')
})
test('G004-09 el gesto de asignación puede registrarse como un solo Undo/Redo en el propietario',()=>{
  const p=project(),history=[]
  slot(p,['texture'],['texture-1'],transfer([{kind:'texture',id:'texture-1'}]),id=>{
    history.push({before:p.objects[0].props.image,after:id});p.objects[0].props.image=id
  })
  assert.equal(history.length,1);p.objects[0].props.image=history[0].before;assert.equal(p.objects[0].props.image,'')
  p.objects[0].props.image=history[0].after;assert.equal(p.objects[0].props.image,'texture-1')
})
test('G004-10 los tres grupos de destinos continúan conectados al componente común',()=>{
  const destinations=['Inspector.vue','ProfileSlot.vue','MaterialSection.vue','MaterialShader.vue','MaterialSurfaceDetail.vue','VfxEditor.vue','ParamForm.vue','UiDesignerPanel.vue']
  for(const f of destinations) {
    const source=read('src/components/'+f)
    assert.match(source,/ResourceDropSlot/,f);assert.match(source,/@assign=/,f)
  }
  assert.match(read('src/components/ProjectPanel.vue'),/writeAssetDrag\(e\.dataTransfer/)
  assert.match(resourceComponent,/resolveAssetDrop\(event\.dataTransfer, allEntries\(store\.project\)/)
})
test('G004-11 los tipos externos no se aceptan como recursos internos',()=>{
  const p=project(), external = {types:['Files'],getData:()=>''}
  const r=slot(p,['audio'],['audio-1'],external,id=>p.objects[0].props.clip=id)
  assert.deepEqual(r.calls,[]);assert.equal(r.e.prevented,0);assert.equal(r.e.stopped,0)
})
