// S13-G002 CORR-001 · Contrato de montaje Electron del Inspector real.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const fixture = read('scripts/fixtures/editor/inspector-global-folding-s13-g002.html')
const runner = read('scripts/test-inspector-global-folding-s13-g002-electron.mjs')
const objects = read('src/core/state/objects.js')
const history = read('src/core/state/history.js')
const inspector = read('src/components/Inspector.vue')

const positionOf = fragment => {
  const position = fixture.indexOf(fragment)
  assert.notEqual(position, -1, `Falta en la fixture: ${fragment}`)
  return position
}

test('FOLD-CORR001-01 · la fixture importa el Editor y el historial desde la fachada existente', () => {
  assert.match(fixture, /\{store,setEditor,resetHistory\}/)
  assert.match(fixture, /import\('\/src\/core\/store\.js'\)/)
  assert.doesNotMatch(fixture, /store\.editor\s*=/)
})

test('FOLD-CORR001-02 · inicializa las dependencias después del proyecto y antes de montar InspectorDock', () => {
  const project = positionOf('store.project=project')
  const editor = positionOf('setEditor({syncObject(id)')
  const history = positionOf('resetHistory()')
  const mount = positionOf('app=createApp(InspectorDock)')
  assert.ok(project < editor && editor < history && history < mount)
})

test('FOLD-CORR001-03 · setEditor registra sincronización real y snapshot del terreno activo', () => {
  const snippet = fixture.match(/  const synchronizedIds=\[\][\s\S]*?  resetHistory\(\)/)?.[0]
  assert.ok(snippet, 'El montaje debe agrupar editor, sincronización y estado inicial')
  let editor = null
  let resets = 0
  const terrain = { enabled:false, layers:[], foliage:[] }
  const result = runInNewContext(`(() => { ${snippet}; return synchronizedIds })()`, {
    setEditor(value) { editor = value },
    resetHistory() { resets++ },
    project: { terrain }
  })
  assert.equal(resets, 1)
  assert.equal(typeof editor.syncObject, 'function')
  assert.equal(editor.snapshotTerrain(), terrain)
  editor.syncObject('fold-cube')
  assert.deepEqual(Array.from(result), ['fold-cube'])
})

test('FOLD-CORR001-04 · verifica la acción original y su sincronización e historial, sin simular PASS', () => {
  assert.match(objects, /store\.editor\.syncObject\(id\)/)
  assert.match(objects, /if \(doCommit\) commit\(/)
  assert.match(history, /store\.editor\.snapshotTerrain\(\)/)
  assert.match(inspector, /const resetTransform = \(\) => upd\(/)
  assert.match(fixture, /reset\.click\(\);await flush\(\)/)
  assert.match(fixture, /synchronizedIds\.includes\(cube\.id\)&&store\.canUndo===true/)
  assert.doesNotMatch(fixture, /try\s*\{\s*reset\.click\(\)/)
})

test('FOLD-CORR001-05 · conserva las 23 comprobaciones de plegado, teclado y selección', () => {
  assert.equal((fixture.match(/\bcheck\('/g) || []).length, 23)
  assert.match(fixture, /checks\.length===23&&checks\.every\(c=>c\.pass\)/)
  assert.match(runner, /minChecks:23/)
  for (const text of ['Clic abre la sección', 'Enter contrae', 'Espacio expande',
    'El estado de cámara se almacena por separado', 'No hay errores de GL']) {
    assert.ok(fixture.includes(text), text)
  }
})

test('FOLD-CORR001-06 · no modifica ni introduce componentes de producción para encubrir la fixture', () => {
  assert.match(fixture, /import\('\/src\/components\/InspectorDock\.vue'\)/)
  assert.match(fixture, /const before=JSON\.stringify\(store\.project\.objects\)/)
  assert.match(fixture, /check\('No altera proyecto al expandir'/)
  assert.doesNotMatch(fixture, /\.prototype\.|mockReset|fakeReset|skip|bypass/)
})

test('FOLD-CORR001-07 · el colector real rechaza 22/23 y un fallo individual, nunca PASS falso', () => {
  const script = fixture.match(/<script>([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script)
  const execute = outcomes => {
    const out = { dataset:{}, textContent:'' }
    const window = { addEventListener(){} }
    const document = { getElementById:()=>out, createElement:()=>({getContext:()=>({})}) }
    let clearCalled = false
    runInNewContext(script, { window, document, setTimeout:()=>1, clearTimeout:()=>{clearCalled=true} })
    let error = null
    try {
      for(const outcome of outcomes) window.__lfFoldingQa.check('Revisión', outcome)
    } catch (cause) { error = cause }
    window.__lfFoldingQa.finish(error)
    assert.equal(clearCalled,true)
    return JSON.parse(out.textContent).pass
  }
  assert.equal(execute(Array.from({length:23},()=>true)),true)
  assert.equal(execute(Array.from({length:22},()=>true)),false)
  assert.equal(execute([...Array.from({length:22},()=>true),false]),false)
})
