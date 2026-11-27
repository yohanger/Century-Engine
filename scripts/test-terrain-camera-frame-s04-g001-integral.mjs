// S04 — remuestrear desde Inspector no debe mover la cámara del Editor.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const panel = read('src/components/TerrainPanel.vue')
const terrainState = read('src/core/state/terrain.js')
const cameraSource = read('src/core/editor/selection.js')
const match = panel.match(/async function applySize\(\) \{[\s\S]*?\n\}/)
assert.ok(match, 'applySize existente debe permanecer en TerrainPanel')

function fixture({changed=true,confirmed=true,original={size:32,segments:16},draft={size:64,segments:32}}={}) {
  const events=[]
  const camera={position:[12,18,22],quaternion:[0,0,0,1],target:[3,2,4],distance:27}
  const initial=structuredClone(camera)
  const terrain={size:original.size,segments:original.segments,resize(size,segments){
    events.push(['resize',size,segments]);this.size=size;this.segments=segments
  }}
  const editor={terrain,stitch(){events.push('stitch')},syncEnvironment(){events.push('syncEnvironment')},syncSettings(){events.push('syncSettings')},applyView(){events.push('applyView')},
    frameAll(){events.push('frameAll');camera.position=[0,50,0]},focus(){events.push('focus');camera.target=[0,0,0]},vp:{frameBox(){events.push('frameBox');camera.distance=5}}}
  const store={editor,project:{terrain:{...original}}}
  const size={...draft}
  const context=vm.createContext({Math,size,store,sizeDirty:{value:changed},
    askConfirm:async(...args)=>{events.push(['confirm',args[0]]);return confirmed},
    t:()=>terrain,syncPieces(){events.push('syncPieces');store.project.terrain.size=terrain.size;store.project.terrain.segments=terrain.segments},
    commitTerrain(label){events.push(['commit',label])}})
  vm.runInContext(`${match[0]};globalThis.invoke=applySize`,context)
  return {invoke:()=>context.invoke(),events,camera,initial,terrain,store,size}
}

test('TER-S04-01: el remuestreo confirmado conserva posición, rotación, objetivo y distancia',async()=>{
  const s=fixture();await s.invoke()
  assert.deepEqual(s.camera,s.initial)
  assert.equal(s.terrain.size,64);assert.equal(s.terrain.segments,32)
  assert.deepEqual(s.events.map(e=>Array.isArray(e)?e[0]:e),['confirm','resize','stitch','syncPieces','syncEnvironment','syncSettings','applyView','commit'])
})
test('TER-S04-02: cambiar únicamente resolución conserva cámara y aplica exactamente un commit',async()=>{
  const s=fixture({original:{size:128,segments:16},draft:{size:128,segments:64}});await s.invoke()
  assert.equal(s.terrain.size,128);assert.equal(s.terrain.segments,64)
  assert.equal(s.events.filter(e=>Array.isArray(e)&&e[0]==='commit').length,1)
  assert.deepEqual(s.camera,s.initial)
})
test('TER-S04-03: cancelar confirmación no remuestrea, sincroniza ni reencuadra',async()=>{
  const s=fixture({confirmed:false});await s.invoke()
  assert.equal(s.events.length,1);assert.equal(s.events[0][0],'confirm')
  assert.equal(s.terrain.size,32);assert.deepEqual(s.camera,s.initial)
})
test('TER-S04-04: sin cambios el botón no provoca confirmación ni efectos',async()=>{
  const s=fixture({changed:false});await s.invoke()
  assert.deepEqual(s.events,[]);assert.deepEqual(s.camera,s.initial)
})
test('TER-S04-05: tamaños y resolución conservan los límites previos',async()=>{
  const s=fixture({draft:{size:100000,segments:2000}});await s.invoke()
  assert.equal(s.terrain.size,8192);assert.equal(s.terrain.segments,1024)
  const l=fixture({draft:{size:1,segments:-5}});await l.invoke()
  assert.equal(l.terrain.size,8);assert.equal(l.terrain.segments,8)
})
test('TER-S04-06: ninguna ruta de reencuadre existe dentro de applySize',()=>{
  assert.doesNotMatch(match[0],/frameAll\s*\(|frameBox\s*\(|focus\s*\(/)
  assert.match(match[0],/await askConfirm\('Cambiar tamaño o resolución remuestrea el terreno/)
})
test('TER-S04-07: frameAll permanece como función de enfoque explícito',()=>{
  assert.match(cameraSource,/frameAll\(\)\s*\{/)
  assert.match(cameraSource,/this\.vp\.frameBox\(new THREE\.Box3/)
})
test('TER-S04-08: añadir una pieza conserva su reencuadre independiente',()=>{
  assert.match(terrainState,/export function addTerrainPiece\([\s\S]*?ed\.frameAll\(\)/)
})
test('TER-S04-09: los cuatro bordes mantienen su propia operación sin cámara',()=>{
  assert.match(panel,/extendTerrainEdge\(a\.id, side, cells\)/)
  assert.doesNotMatch(panel.slice(panel.indexOf('async function changeEdge('),panel.indexOf('const SIDES')),/frameAll\(/)
})
test('TER-S04-10: confirmar precede a resize y el commit llega tras la sincronización',()=>{
  assert.ok(match[0].indexOf('await askConfirm')<match[0].indexOf('t().resize'))
  assert.ok(match[0].indexOf('store.editor.applyView()')<match[0].indexOf("commitTerrain('Redimensionar terreno')"))
})
test('TER-S04-11: no se cambia geometría, persistencia, gizmo ni física para esta corrección',()=>{
  assert.match(panel,/commitTerrain\('Redimensionar terreno'\)/)
  assert.match(terrainState,/export function commitTerrain\(/)
})
test('TER-S04-12: el compilador Vue valida la plantilla existente, si está instalado',async t=>{
  let compiler;try{compiler=await import('@vue/compiler-sfc')}catch{t.skip('Ejecutar npm ci para verificar el SFC real');return}
  const file='src/components/TerrainPanel.vue', source=read(file)
  const parsed=compiler.parse(source,{filename:file});assert.deepEqual(parsed.errors,[])
  const compiled=compiler.compileTemplate({id:'terrain-camera-s04',source:parsed.descriptor.template.content,filename:file})
  assert.deepEqual(compiled.errors,[])
})
