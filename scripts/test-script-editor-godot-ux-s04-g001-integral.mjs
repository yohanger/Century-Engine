// S04: contrato de autoría, integración del editor de scripts y navegación sin estado paralelo.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { outlineOf } from '../src/core/editor/analysis.js'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const s = read('src/components/ScriptEditor.vue')
const state = read('src/core/state/database.js')
const floating = read('src/components/FloatingEditorWindow.vue')
const projectScripts = [
  { id:'a', name:'Jugador.js', folder:'Assets/Scripts', execution:'global' },
  { id:'b', name:'Enemigo.js', folder:'Assets/Scripts', execution:'node' },
  { id:'c', name:'Cámara.js', folder:'Assets/Scripts/Gameplay', execution:'node' },
]
function extractGrouping(query) {
  const from=s.indexOf('const scriptGroups = computed(() => {')
  const to=s.indexOf('\n/** Función o región',from)
  assert.ok(from>0 && to>from)
  const fragment=s.slice(from,to)
  const ctx={store:{project:{scripts:structuredClone(projectScripts)}},scriptSearch:{value:query},computed:fn=>fn()}
  vm.runInNewContext(fragment+'\nthis.result = scriptGroups',ctx)
  return JSON.parse(JSON.stringify(ctx.result))
}
test('SE-01 · utiliza el editor de CodeMirror y la inteligencia existentes',()=>{
  for(const v of ['basicSetup','javascript()','editorLook()','jsIntelligence(','minimap()','formatCode(','openSearchPanel(','openLintPanel(','EditorView.updateListener','setScriptCode(','saveAll()']) assert.ok(s.includes(v),v)
})
test('SE-02 · no crea otro editor ni altera lenguaje o runtime',()=>{
  assert.equal((s.match(/new EditorView\(/g)||[]).length,2)
  assert.match(s, /old\.destroy\(\)/)
  assert.match(s, /state = old.state/)
  assert.ok(!s.includes('MonacoEditor')&&!s.includes('new Function('))
  assert.ok(s.includes('FloatingEditorWindow')&&s.includes('dock-panel-id="codeView"'))
})
test('SE-03 · lista scripts del proyecto, no crea un registro duplicado',()=>{
  assert.match(s,/for \(const item of store\.project\?\.scripts \?\? \[\]\)/)
  assert.match(s,/@click="selectScript\(item\.id\)"/)
  assert.match(s,/openScriptEditor\(id\)/)
  assert.match(state,/store\.scriptEditId = id/)
})
test('SE-04 · agrupa por carpetas, ordena scripts y admite filtro de acentos',()=>{
  const all=extractGrouping('')
  assert.deepEqual(all.map(x=>x.folder),['Assets/Scripts','Assets/Scripts/Gameplay'])
  assert.deepEqual(all[0].items.map(x=>x.name),['Enemigo.js','Jugador.js'])
  assert.deepEqual(extractGrouping('camara').map(g=>g.items.map(x=>x.name)),[['Cámara.js']])
  assert.deepEqual(extractGrouping('no-existe'),[])
})
test('SE-05 · navegación conserva el modelo de ejecución y documento autoritativo',()=>{
  assert.match(s,/watch\(\(\) => sc\.value\?\.id/)
  assert.match(s,/intelligence\.reconfigure\(jsIntelligence/)
  assert.match(s,/watch\(\(\) => sc\.value\?\.execution/)
  assert.match(s,/next === cur/)
  assert.match(s,/setScriptExecution\(sc\.id/)
})
test('SE-06 · navegación por métodos usa el outline existente',()=>{
  assert.match(s,/outlineForDocument\(code\.value\)/)
  assert.match(s,/refreshOutline\(code\.value, sc\.value\.id, update\.changes\)/)
  assert.match(s,/@click="goTo\(o\.pos\)"/)
  const list=outlineOf("function start() {}\n// #region Fase\nconst tick = (dt) => dt\n")
  assert.equal(list.some(x=>x.label==='start'),true)
  assert.equal(list.some(x=>x.label==='Fase'),true)
  assert.equal(list.some(x=>x.label==='tick'),true)
})
test('SE-07 · las opciones no ofrecen depuración ficticia',()=>{
  assert.ok(!/\bdebugger\b|\bbreakpoint\b/i.test(s))
  assert.ok(s.includes('Problemas') && s.includes('API') && s.includes('Formatear'))
})
test('SE-08 · acciones de búsqueda, guardado y atajos accesibles y reales',()=>{
  for(const key of ['Mod-s','Mod-p','Mod-h','Mod-Shift-m','Mod-i','Shift-Alt-f']) assert.ok(s.includes(key),key)
  for(const label of ['aria-label="Filtrar scripts"','aria-label="Navegación del editor de scripts"','aria-label="Métodos y regiones del script"','role="menubar"']) assert.ok(s.includes(label),label)
  assert.ok(s.includes('scriptSearchInput.value?.focus()'))
})
test('SE-09 · preferencias solo de presentación independientes del proyecto',()=>{
  for(const k of ['lf.se.navigator','lf.se.outline','lf.se.minimap']) assert.ok(s.includes(k),k)
  assert.ok(s.includes('writePref(') && s.includes('readPref('))
})
test('SE-10 · el documento queda en el store, se respeta guardado y VS Code',()=>{
  assert.match(state,/export function setScriptCode\(id, code\)/)
  assert.match(state,/markDirty\(\)/)
  assert.match(s,/openInVSCode\(sc\.value\.id\)/)
  assert.match(s,/const savedLabel = computed/)
  assert.match(s,/if \(next === cur\) return/)
})
test('SE-11 · los componentes no fueron duplicados ni desanclados del docking',()=>{
  assert.ok(floating.includes('workspaceDocked') && floating.includes('dockPanelId'))
  assert.ok(s.includes(':integrated-titlebar="true"'))
  assert.ok(floating.includes('data-window-drag-handle'))
})
test('SE-12 · adaptabilidad y foco visible',()=>{
  assert.match(s,/@media \(max-width:730px\)/)
  assert.match(s,/@media \(max-width:510px\)/)
  assert.match(s,/:focus-visible/)
  assert.match(s,/@media \(prefers-reduced-motion: no-preference\)/)
})
test('SE-13 · formateo asíncrono nunca aplica un resultado al script siguiente',()=>{
  assert.match(s,/const activeId = sc\.value\?\.id/)
  assert.match(s,/sc\.value\?\.id !== activeId/)
  assert.match(s,/editor\.state\.doc\.toString\(\) !== before/)
})

// SE-14: el aislamiento del viewport no debe confundir el canvas propio de CodeMirror con Three.js.
test('SE-14 · el fixture Electron distingue canvas de CodeMirror del viewport 3D',()=>{
  const fixture=read('scripts/fixtures/editor/script-editor-godot-ux-s04-g001-integral.html')
  assert.match(fixture,/foreignCanvases/)
  assert.match(fixture,/canvas\.closest\('\.cm-editor'\)/)
  assert.match(fixture,/workspace\?\.querySelector\('\.viewport/)
  assert.doesNotMatch(fixture,/!document\.querySelector\('\.se-workspace canvas'\)/)
  assert.match(fixture,/canvas fuera de CodeMirror=/)
})
