// LF-SCENE-INSTANCING-G001-CORR-002: ejecuta el controlador real de teclado y el contrato del selector global.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const keys = read('src/core/editor/keys.js')
const commands = read('src/core/commands.js')
const app = read('src/App.vue')
const hierarchy = read('src/components/SceneTree.vue')
const shortcuts = read('src/components/ShortcutsModal.vue')
const docs = read('docs/web-src/escenas.md')

function harness() {
  const listeners = new Map(), selection = [], notices = [], actions = []
  const store = {
    project: { id:'p', activeSceneId:'world', objects:[{id:'n1'}, {id:'n2'}], scenes:[{id:'world'}, {id:'house'}] },
    editor:{edit:null}, locked:false, filmMode:false, play:{on:false}, gameView:{on:false},
    edit:{globalShortcuts:true}, roadPaint:{active:false}, modal:null, palette:false, addModal:null, menu:null, sceneInstanceTarget:null,
  }
  const win = { addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn) },
    removeEventListener() {} }
  const doc = {addEventListener(){},removeEventListener(){},hidden:false}
  const cstart=commands.indexOf('/** Una escena vinculada'), cend=commands.indexOf('/** CollisionShape3D', cstart)
  assert.ok(cstart>=0 && cend>cstart)
  const commandContext = {
    store, getObject: id => id === 'n1' ? {id:'n1', name:'Nodo padre', type:'node3d'} : null,
    toast: msg => notices.push(msg),
  }
  const commandScript = commands.slice(cstart,cend).replaceAll('export function','function')
  vm.runInNewContext(commandScript+'\nthis.actions={openSceneInstancePicker,canParentSceneInstance}',commandContext)
  const tool = name => { assert.equal(name,'commands'); return {
    run(id) { actions.push(id); return commandContext.actions.openSceneInstancePicker() },
    openAddMenu() { actions.push('add.menu') },
  }}
  const context={win,doc,store,hasTool: name=>name==='commands',tool,
    selectObject: (...args)=>selection.push(args),
    toast: msg=>notices.push(msg),
    // Only called in unrelated key branches; keep errors visible for accidental routing.
    clamp: (x)=>x,
  }
  const script=keys.replace(/^import [\s\S]*? from ['"][^'"]+['"](?:\s*\/\/[^\n]*)?\n/gm,'')
    .replace('export const keysMethods =','const keysMethods =')
  vm.runInNewContext(script+'\nthis.methods=keysMethods', context)
  const editor={vp:{isFlying:false},pointer:{inside:true}, _setSnapShiftHeld(){}, ...context.methods}
  editor._bindKeys()
  function fire({key='a', code='KeyA', ctrlKey=false, metaKey=false, shiftKey=false, altKey=false,
    repeat=false, isComposing=false, target={tagName:'DIV'}}={}) {
    const ev={key,code,ctrlKey,metaKey,shiftKey,altKey,repeat,isComposing,target,defaultPrevented:false,
      preventDefault(){this.defaultPrevented=true},stopPropagation(){}}
    for(const fn of listeners.get('keydown')||[]) fn(ev)
    return ev
  }
  return {store,editor,selection,actions,notices,fire,command:commandContext.actions}
}

test('CORR002-01: Ctrl+Shift+A abre el selector global sin seleccionar todos', () => {
  const h=harness(), e=h.fire({ctrlKey:true,shiftKey:true})
  assert.equal(e.defaultPrevented,true)
  assert.deepEqual(h.actions,['scene.instantiate'])
  assert.equal(h.store.modal,'sceneInstance')
  assert.equal(h.store.sceneInstanceTarget.parentId,null)
  assert.equal(h.selection.length,0)
})
test('CORR002-02: Ctrl+A sigue seleccionando exactamente los nodos', () => {
  const h=harness(),e=h.fire({ctrlKey:true})
  assert.equal(e.defaultPrevented,true)
  assert.deepEqual(Array.from(h.selection[0][1].range), ['n1','n2'])
  assert.equal(h.store.modal,null)
})
test('CORR002-03: Shift+A sigue abriendo Añadir nodo', () => {
  const h=harness(), e=h.fire({shiftKey:true})
  assert.equal(e.defaultPrevented,true)
  assert.deepEqual(h.actions,['add.menu'])
  assert.equal(h.store.sceneInstanceTarget,null)
})
test('CORR002-04: Meta+Shift+A utiliza la misma acción global (macOS)', () => {
  const h=harness(),e=h.fire({metaKey:true,shiftKey:true})
  assert.equal(e.defaultPrevented,true)
  assert.equal(h.store.modal,'sceneInstance')
})
test('CORR002-05: Alt y composición IME no disparan el nuevo comando', () => {
  for(const opts of [{ctrlKey:true,shiftKey:true,altKey:true},{ctrlKey:true,shiftKey:true,isComposing:true}]) {
    const h=harness(), e=h.fire(opts)
    assert.equal(e.defaultPrevented,false)
    assert.equal(h.store.modal,null)
    assert.equal(h.selection.length,0)
  }
})
test('CORR002-06: campos de texto, modales, paleta, Play, modo Juego y bloqueo no interceptan', () => {
  for (const setting of [
    h=>h.store.modal='prefs', h=>h.store.palette=true, h=>h.store.play.on=true,
    h=>h.store.gameView.on=true, h=>h.store.locked=true, h=>h.store.filmMode=true,
    h=>h.store.addModal={items:[]}, h=>h.editor.vp.isFlying=true,
    h=>{h.editor.edit={modal:false,onKey:()=>false}},
    h=>{},
  ]) {
    const h=harness();setting(h)
    const target = setting.toString().includes('h=>{}') ? {tagName:'INPUT'} : {tagName:'DIV'}
    const e=h.fire({ctrlKey:true,shiftKey:true,target})
    assert.equal(e.defaultPrevented,false,setting.toString())
    assert.equal(h.actions.length,0,setting.toString())
    assert.equal(h.selection.length,0,setting.toString())
  }
})
test('CORR002-07: una pulsación sostenida no repite ni crea instancias', () => {
  const h=harness()
  const e=h.fire({ctrlKey:true,shiftKey:true,repeat:true})
  assert.equal(e.defaultPrevented,true)
  assert.equal(h.actions.length,0)
  h.fire({ctrlKey:true,shiftKey:true})
  assert.equal(h.actions.length,1)
})
test('CORR002-08: comando central, ayuda y documentación muestran el mismo atajo', () => {
  assert.match(commands,/add\('scene\.instantiate', 'Instanciar escena existente…'/)
  assert.match(commands,/keys: 'Ctrl Shift A'/)
  assert.match(shortcuts,/\['Instanciar escena existente', 'Ctrl Shift A'\]/)
  assert.match(docs,/Ctrl \+ Shift \+ A/)
  assert.match(hierarchy,/openInstancePicker\(\)/)
  assert.match(hierarchy,/openSceneInstancePicker\(parentId\)/)
  assert.match(app,/SceneInstancePicker v-if="store\.modal === 'sceneInstance'/)
  assert.doesNotMatch(hierarchy,/SceneInstancePicker v-if=/)
})
test('CORR002-09: botón y menú contextual llaman al selector único, con padre editable', () => {
  const h=harness()
  assert.equal(h.command.openSceneInstancePicker('n1'),true)
  assert.equal(h.store.sceneInstanceTarget.parentId,'n1')
  assert.equal(h.store.sceneInstanceTarget.parentName,'Nodo padre')
  assert.equal(h.command.openSceneInstancePicker(),false) // selector ya abierto
})
test('CORR002-10: App mantiene único dueño del selector e instancia en el padre solicitado', async () => {
  const start=app.indexOf('const sceneInstanceBusy = ref(false)')
  const end=app.indexOf('// Electron conserva los paneles de escritorio',start)
  assert.ok(start>=0 && end>start)
  const h=harness()
  h.command.openSceneInstancePicker('n1')
  const calls=[],callbacks=[]
  const context={store:h.store,ref:v=>({value:v}),watch:(getter,fn)=>callbacks.push(fn),
    S:{instantiateScene:async (id,opts)=>{calls.push({id,opts});return {id:'created'}}}}
  vm.runInNewContext(app.slice(start,end)+'\nthis.api={chooseSceneInstance,closeSceneInstancePicker}',context)
  await context.api.chooseSceneInstance('house')
  assert.equal(calls.length,1)
  assert.equal(calls[0].id,'house')
  assert.equal(calls[0].opts.parentId,'n1')
  assert.equal(h.store.modal,null)
  assert.equal(h.store.sceneInstanceTarget,null)
})
test('CORR002-11: un cambio de contexto cancela la solicitud y no modifica otra ventana', () => {
  const start=app.indexOf('const sceneInstanceBusy = ref(false)')
  const end=app.indexOf('// Electron conserva los paneles de escritorio',start)
  const h=harness(),callbacks=[]
  h.command.openSceneInstancePicker()
  const context={store:h.store,ref:v=>({value:v}),watch:(getter,fn)=>callbacks.push(fn),
    S:{instantiateScene:async()=>({id:'not-used'})}}
  vm.runInNewContext(app.slice(start,end)+'\nthis.api={chooseSceneInstance}',context)
  h.store.project.activeSceneId='other'
  callbacks[0]()
  assert.equal(h.store.sceneInstanceTarget,null)
  assert.equal(h.store.modal,null)
  h.command.openSceneInstancePicker()
  h.store.modal='prefs'
  callbacks[0]()
  assert.equal(h.store.modal,'prefs')
  assert.equal(h.store.sceneInstanceTarget,null)
})
