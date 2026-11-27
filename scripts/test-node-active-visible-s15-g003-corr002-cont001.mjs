// G003 CORR-002 CONT-001: activación funcional independiente de visibilidad.
// Sin Three/Jolt WASM: los casos de física real corresponden a QA en Electron.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { nodeActive, nodeVisible, nodeEffectiveActive, nodeEffectiveVisible } from '../src/engine/runtime/nodes/hierarchy.js'
import { physicsNodePlan } from '../src/engine/runtime/physics/node-body-plan.js'
import { NodeLifecycle } from '../src/engine/runtime/scene/node-lifecycle.js'

const src = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const parent = { id: 'root', type: 'node3d', parentId: null, active: true, visible: true }
const child = { id: 'child', type: 'node3d', parentId: 'root', active: true, visible: true }
const leaf = { id: 'leaf', type: 'node3d', parentId: 'child', active: true, visible: true }
const chain = () => [{ ...parent }, { ...child }, { ...leaf }]

test('AV-01 · active y visible son independientes en nodos nuevos', () => {
  assert.equal(nodeActive({ active: true, visible: false }), true)
  assert.equal(nodeVisible({ active: true, visible: false }), false)
  assert.equal(nodeActive({ active: false, visible: true }), false)
  assert.equal(nodeVisible({ active: false, visible: true }), true)
})
test('AV-02 · padre inactivo suspende a descendientes sin escribir sobre sus datos', () => {
  const list = chain(); list[0].active = false
  assert.equal(nodeEffectiveActive(list, list[2]), false)
  assert.equal(nodeEffectiveVisible(list, list[2]), false)
  assert.equal(list[2].active, true)
  list[0].active = true
  assert.equal(nodeEffectiveActive(list, list[2]), true)
})
test('AV-03 · padre invisible oculta render de hijos pero conserva funcionamiento', () => {
  const list = chain(); list[0].visible = false
  assert.equal(nodeEffectiveActive(list, list[2]), true)
  assert.equal(nodeEffectiveVisible(list, list[2]), false)
  assert.equal(list[2].visible, true)
})
test('AV-04 · ciclo de padres inválido no activa nodos arbitrarios', () => {
  const list = chain(); list[0].parentId = 'leaf'
  assert.equal(nodeEffectiveActive(list, list[2]), false)
})
test('AV-05 · referencias ausentes no crean nodos activos ficticios', () => {
  assert.equal(nodeActive(null), false)
  assert.equal(nodeEffectiveActive([{...child}], {...child}), false)
})
test('AV-06 · cuerpos invisibles y cuerpos inactivos mantienen planificación física para reactivar', () => {
  const body = { id:'b', type:'staticbody3d', parentId:null, active:false, visible:false, props:{friction:0.5,restitution:0} }
  const collision = { id:'s', type:'collisionshape3d', parentId:'b', active:true, visible:false, props:{shape:{type:'BoxShape3D',size:[1,1,1]}} }
  assert.equal(physicsNodePlan([body, collision]).length, 1)
  assert.equal(physicsNodePlan([body, {...collision,props:{...collision.props, disabled:true}}]).length, 0)
})
test('AV-07 · NodeLifecycle no ejecuta _process / _physics_process bajo padre inactivo', () => {
  const objects = chain()
  const scene = {host:{project:{objects}},nodes:new Map(objects.map(o=>[o.id,{}]))}
  const calls = []
  const lc = new NodeLifecycle(scene)
  lc.scripts = {
    prepare(){}, enter(){}, call(obj, name){ calls.push(`${obj.id}:${name}`) },
    hasCallback(id, name){ return id === 'leaf' && (name === 'onProcess' || name === 'onPhysicsProcess') },
    syncSceneConnections(){}, emitLifecycle(){}, emitLifecycleReady(){}, beginExit(){}, finishExit(){}, clear(){},
  }
  lc.start()
  lc.process(0.02); lc.physicsProcess(0.02)
  assert.deepEqual(calls.filter(s=>s.startsWith('leaf:onProcess')||s.startsWith('leaf:onPhysicsProcess')),['leaf:onProcess','leaf:onPhysicsProcess'])
  objects[0].active = false
  lc.sync(); const before = calls.length
  lc.process(0.02); lc.physicsProcess(0.02)
  assert.equal(calls.length, before)
  assert.equal(lc.processEntries.size, 0)
  objects[0].active = true
  lc.sync(); lc.process(0.02)
  assert.equal(calls.at(-1), 'leaf:onProcess')
  lc.stop()
})
test('AV-08 · visibilidad no desactiva NodeLifecycle', () => {
  const objects = chain(); objects[0].visible = false
  const scene = {host:{project:{objects}},nodes:new Map(objects.map(o=>[o.id,{}]))}
  const calls = []; const lc = new NodeLifecycle(scene)
  lc.scripts={prepare(){},enter(){},call(obj,name){calls.push(name)},hasCallback(id,name){return id==='leaf' && name==='onProcess'},syncSceneConnections(){},emitLifecycle(){},emitLifecycleReady(){},beginExit(){},finishExit(){},clear(){}}
  lc.start(); lc.process(0.016)
  assert.ok(calls.includes('onProcess'))
  lc.stop()
})
test('AV-09 · la casilla del Inspector controla active; visible dispone de campo independiente', () => {
  const s = src('src/components/Inspector.vue')
  assert.match(s, /:checked="obj\.active !== false"/)
  assert.match(s, /data-testid="node-visibility-inspector"/)
  assert.match(s, /upd\(\{ active: \$event\.target\.checked \}\)/)
})
test('AV-10 · activar y ocultar poseen caminos de efectos separados; sólo active modifica física', () => {
  const s = src('src/engine/runtime/events/play-nodes.js')
  const visible = s.split('  _nodeVisible(id, v) {')[1].split('\n  _nodeActive(id, on) {')[0]
  const active = s.split('  _nodeActive(id, on) {')[1].split('\n  _nodeMove(')[0]
  assert.doesNotMatch(visible, /setNodeEnabled|setTerrainActive|nodeLifecycle\.sync/)
  assert.match(active, /setNodeEnabled/)
  assert.match(active, /nodeLifecycle\?\.sync/)
})
test('AV-11 · invisibilidad no excluye cuerpos en Jolt ni TriMesh', () => {
  const s = src('src/engine/runtime/physics/trimesh-source.js')
  assert.doesNotMatch(s, /current\.visible === false/)
  const world = src('src/engine/runtime/physics/jolt.js')
  assert.match(world, /setNodeEnabled\(node, on\)/)
  assert.match(world, /setTerrainActive\(pieceId, on\)/)
  assert.match(world, /RemoveBody/)
})
test('AV-12 · tipos de NodeHandle iguales en Editor y VS Code', () => {
  assert.equal(src('src/core/events/game-api.d.ts'),src('vscode-extension/media/game-api.d.ts'))
  assert.match(src('src/core/events/game-api.d.ts'), /active: boolean/)
  assert.match(src('src/core/events/game-api.d.ts'), /visible: boolean/)
})
test('AV-13 · cámara no depende de visible para solicitar autoridad', () => {
  const cam = src('src/engine/runtime/events/play-camera.js')
  assert.match(cam, /this\._nodeEnabled\(x\)/)
  assert.doesNotMatch(cam, /x\.visible !== false/)
})
test('AV-14 · audio invisible conserva voz; inactividad utiliza suspensión de su fuente', () => {
  const audio = src('src/engine/runtime/audio/scene.js')
  assert.match(audio, /setNodeEnabled\(id, enabled\)/)
  assert.match(audio, /src\.voice\.pause\(\)/)
  assert.match(audio, /src\.voice\.resume\(\)/)
  const nodes = src('src/engine/runtime/events/play-nodes.js')
  assert.match(nodes, /this\.audio\?\.setNodeEnabled\?\./)
})
test('AV-15 · runtime solo cambia vista efectiva, no migraciones históricas', () => {
  assert.doesNotMatch(src('src/core/project.js'), /migrateActiveVisible|legacyNodeActive/i)
  assert.match(src('src/engine/runtime/scene/environment.js'), /_nodeEnabled/)
})
