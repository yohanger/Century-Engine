import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { defaultDockLayout, findDockPanel, normalizeDockLayout } from '../src/core/editor/docking.js'
const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const editor = read('src/components/ScriptEditor.vue')
const floating = read('src/components/FloatingEditorWindow.vue')
const nativeSource = read('src/core/editor/native-tool-window.js')
const docking = read('src/core/editor/view-dock-session.js')

test('Code conserva la instancia del editor y el documento en el store', () => {
  assert.match(editor, /new EditorView\(\{ parent: host, root: editorRoot, state: createEditorState\(sc.value\) \}\)/)
  assert.match(editor, /setScriptCode\(sc.value.id, code.value\)/)
  assert.match(editor, /onBeforeUnmount\(\(\) => \{[\s\S]+?editor\?\.destroy\(\)/)
})
test('los seis menús reutilizan comandos reales, sin segunda barra saturada', () => {
  for (const name of ['Archivo','Editar','Buscar','Ir a','Ver','Ayuda']) assert.match(editor, new RegExp(`name: '${name}'`))
  for (const action of ['new','open','save','vscode','undo','redo','comment','format','find','line','method','navigator','outline','minimap','wrap','problems','api'])
    assert.match(editor, new RegExp(`case '${action}':`))
  assert.match(editor, /role="menubar"/)
  assert.match(editor, /role="menuitem"/)
  assert.doesNotMatch(editor, /<button type="button" class="se-command se-nav-toggle"/)
})
test('acciones críticas operan sobre el mismo CodeMirror', () => {
  for (const token of ['undo(editor)','redo(editor)','toggleComment(editor)','gotoLine(editor)','openSearchPanel(editor)','openLintPanel(editor)','saveAll()']) assert.ok(editor.includes(token), token)
  assert.match(editor, /case 'vscode': if \(sc.value\) openInVSCode\(sc.value.id\)/)
  assert.ok(editor.includes('sc.value?.id !== activeId'))
})
test('navegación lateral conserva filtrado, outline y cambio de ancho', () => {
  assert.match(editor, /resize:horizontal/)
  assert.match(editor, /showNavigator\.value = !showNavigator.value/)
  assert.match(editor, /showOutline\.value = !showOutline.value/)
  assert.match(editor, /scriptSearchInput.value\?\.focus\(\)/)
  assert.match(editor, /@click="goTo\(o.pos\)"/)
})
test('el documento activo usa actividad, command center y estado al estilo de un IDE profesional', () => {
  for (const token of ['se-activity', 'se-command-center', 'Buscar scripts del proyecto', 'showOutlineFromActivity', '--se-status', 'script-breadcrumb'])
    assert.ok(editor.includes(token), token)
  assert.match(editor, /showMap = ref\(readPref\('lf\.se\.minimap', true\)\)/)
  assert.match(editor, /Mod-p'[\s\S]*?focusCommandCenter/)
  assert.match(editor, /\.script-status[^}]*background:var\(--se-status\)/)
})
test('el proyecto sin scripts conserva un shell profesional inspirado en un editor de escritorio', () => {
  for (const token of ['se-welcome-shell', 'role="tablist"', 'welcome-tab', 'EXPLORADOR', 'Century Code', 'Primeros pasos', 'script-status'])
    assert.ok(editor.includes(token), token)
  assert.match(editor, /@keydown="onShellKeydown"/)
  assert.match(editor, /if \(key === 'n'\).*createAndOpenScript\(\)/)
  assert.match(editor, /else if \(key === 'p'\).*focusCommandCenter\(\)/)
  assert.doesNotMatch(editor, /class="primary"[^>]*>[^<]*<Icon[^>]*\/>Nuevo script/)
})
test('maximizar Code acoplado no altera el layout persistido', () => {
  assert.match(floating, /focusMode = computed\(\(\) => props.dockPanelId === 'codeView'/)
  assert.match(floating, /focusMode.value \? 'body'/)
  assert.match(floating, /\.floating-editor-layer\.focus-mode \{ position:fixed/)
  assert.match(floating, /if \(isDocked.value && props.dockPanelId !== 'codeView'\) return/)
  const layout=defaultDockLayout()
  assert.deepEqual(findDockPanel(layout, 'codeView').kind, 'dock')
  assert.equal(normalizeDockLayout(layout).floats.length, 0)
})
test('la ventana Code se abre al salir con arrastre, no al montar la vista', () => {
  assert.match(editor, /native-tool="code" :native-on-demand="true"/)
  assert.match(floating, /enabled: \(\) => !!props.nativeTool && \(!props.nativeOnDemand \|\| nativeRequested.value\)/)
  assert.match(floating, /addEventListener\('century:code-detach', openNative\)/)
  assert.match(floating, /addEventListener\('century:code-attach', attachNative\)/)
  assert.doesNotMatch(floating, /@click="openNative"|@click="returnNative"/)
  assert.match(read('electron/main.cjs'), /lf-tool-\(code\|events\|shaderEditor\|shaderGraph\|panel-/)
})
test('la ventana nativa sincroniza estilos y preserva estado de CodeMirror al volver', () => {
  for (const token of ['MutationObserver(syncStyles)','document.head.querySelectorAll','doc.importNode(source, true)','target.value = doc.body']) assert.ok(nativeSource.includes(token), token)
  for (const token of ['const state = old.state','old.destroy()','root: editorRoot, state','const scrollTop = old.scrollDOM.scrollTop','editor.scrollDOM.scrollTop = scrollTop','@native-change="onNativeChange"']) assert.ok(editor.includes(token), token)
})
test('Code no desaparece del docking al abrir ventana externa', () => {
  assert.match(floating, /store.ui.codeNativeOpen = !!target/)
  assert.match(floating, /store.ui.codeNativeOpen = false/)
  assert.match(read('src/components/DockTree.vue'), /Code está abierto en otra ventana/)
  assert.match(docking, /if \(store.ui.codeNativeOpen\) focusNativeTool\('code'\)/)
  assert.equal(findDockPanel(defaultDockLayout(),'codeView').kind,'dock')
})

test('window.open nativo se produce bajo demanda y pagehide retorna al Editor', () => {
  const source = nativeSource.replace(/^(import|export \{).*$/mg,'').replaceAll('export function ','function ')
  const lifecycle = { mount:[], unmount:[], watchers:[] }
  const opened=[]
  const listeners={}
  const popup={ closed:false, document: { title:'',documentElement:{className:'',lang:'',style:{cssText:''}},head:{append(){}},body:{},createElement:()=>({}),importNode:()=>({textContent:''})}, addEventListener(n,fn){listeners[n]=fn}, removeEventListener(n){delete listeners[n]}, close(){this.closed=true}, focus(){} }
  const ctx={
    onBeforeMount: fn => lifecycle.mount.push(fn), onBeforeUnmount:fn=>lifecycle.unmount.push(fn),
    shallowRef: value=>({value}),watch:(source,callback)=>lifecycle.watchers.push({source,callback}),
    window: {lf:{isElectron:true},screen:{availWidth:1920,availHeight:1080},open:(url,name)=>{opened.push([url,name]);return popup}},
    document:{baseURI:'file:///century/',documentElement:{className:'dark',lang:'es',style:{cssText:''}},head:{querySelectorAll:()=>[]}},
    MutationObserver:class {observe(){} disconnect(){}}, Map, Set,
    registerNativeTool:()=>{}, unregisterNativeTool:()=>{},
  }
  runInNewContext(source+'\nthis.useNativeToolWindow = useNativeToolWindow',ctx)
  let request=false, returned=0
  const target=ctx.useNativeToolWindow({kind:'code',enabled:()=>request,title:()=>'Code',width:()=>1100,height:()=>700,close:()=>{returned++}})
  for (const f of lifecycle.mount) f()
  assert.equal(opened.length,0)
  request=true
  for (const w of lifecycle.watchers) w.callback(w.source())
  assert.deepEqual(opened[0],['about:blank','lf-tool-code'])
  assert.ok(target.value)
  listeners.pagehide()
  assert.equal(target.value,null)
  assert.equal(returned,1)
  lifecycle.unmount.forEach(f=>f())
})
