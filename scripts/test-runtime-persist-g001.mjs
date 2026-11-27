// LF-RUNTIME-PERSIST-G001: persistencia sin duplicar ni guardar el overlay de juego.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { persistentIds, overlayPersistent, withoutInjected, persistentMethods } from '../src/engine/runtime/events/play-persistent.js'

const source = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
const objs = () => [
  { id: 'menu', parentId: null }, { id: 'music', parentId: 'menu', dontDestroyOnLoad: true },
  { id: 'clip', parentId: 'music' }, { id: 'hint', parentId: 'menu' },
]
const marked = (o) => o.dontDestroyOnLoad === true
const fake = (objects) => {
  const nodes = new Map(objects.map((o) => [o.id, { id: o.id }]))
  const ed = { nodes, restoreRetainedNodes(rs) { this.restored = rs }, discardRetainedNodes() {} }
  const p = { objects }
  return { project: p, ed, _find(name) { return p.objects.find((o) => o.id === name || o.name === name) },
    ...persistentMethods }
}
test('PERSIST-01: el objeto marcado sobrevive', () => assert.deepEqual([...persistentIds(objs(), marked)].sort(), ['clip', 'music']))
test('PERSIST-02: los padres no se incluyen automáticamente', () => assert.ok(!persistentIds(objs(), marked).has('menu')))
test('PERSIST-03: los hermanos no se incluyen', () => assert.ok(!persistentIds(objs(), marked).has('hint')))
test('PERSIST-04: marcar el padre incluye toda la jerarquía', () => {
  const os=objs(); os[0].dontDestroyOnLoad=true; assert.equal(persistentIds(os, marked).size,4)
})
test('PERSIST-05: no se duplica al volver a la escena inicial', () => {
  const s=objs(), p=[s[1],s[2]]; assert.equal(overlayPersistent(s,p).filter(x=>x.id==='music').length,1)
})
test('PERSIST-06: colisiones de ID conservan referencia del objeto vivo', () => {
  const old={id:'a'}, current={id:'a'}; assert.equal(overlayPersistent([current], [old])[0],old)
})
test('PERSIST-07: se preserva el orden de los objetos entrantes ajenos', () => {
  assert.deepEqual(overlayPersistent([{id:'a'}, {id:'b'}], [{id:'persist'}]).map(x=>x.id), ['a','b','persist'])
})
test('PERSIST-08: quitar overlay deja solo objetos propios', () => {
  assert.deepEqual(withoutInjected([{id:'a'}, {id:'b'}],new Set(['b'])).map(x=>x.id), ['a'])
})
test('PERSIST-09: sin overlay mantiene la lista', () => {
  const os=objs();assert.equal(withoutInjected(os,new Set()),os)
})
test('PERSIST-10: marcar desde scripts no cambia el objeto de proyecto', () => {
  const a={id:'a',name:'Audio'};const rt=fake([a]);assert.equal(rt._persistSet('Audio',true),true);assert.ok(rt._persistMarked(a));assert.equal(a.dontDestroyOnLoad,undefined)
})
test('PERSIST-11: se puede desactivar la casilla solo durante el juego', () => {
  const a={id:'a',dontDestroyOnLoad:true};const rt=fake([a]);rt._persistSet('a',false);assert.equal(rt._persistMarked(a),false);assert.equal(a.dontDestroyOnLoad,true)
})
test('PERSIST-12: objetivo inexistente no crea registro', () => { const rt=fake([]); assert.equal(rt._persistSet('missing',true),false) })
test('PERSIST-13: conserva identidad de registros y referencias gráficas', () => {
  const rt=fake(objs());rt._persistBeforeScene();assert.equal(rt._persistObjects.get('music'),rt.project.objects[1]);assert.ok(rt.ed._persistRetainIds.has('clip'))
})
test('PERSIST-14: no conserva descendiente de un objeto no marcado', () => {
  const rt=fake(objs());rt._persistBeforeScene();assert.ok(!rt._persistObjects.has('hint'))
})
test('PERSIST-15: después de cargar se incorporan las instancias originales', () => {
  const rt=fake(objs());rt._persistBeforeScene();rt.project.objects=[{id:'new'}];rt._persistAfterScene();assert.deepEqual(rt.project.objects.map(o=>o.id),['new','music','clip']);assert.equal(rt.ed.restored[0].id,'music')
})
test('PERSIST-16: volver a cambiar de escena no acumula duplicados', () => {
  const rt=fake(objs());rt._persistBeforeScene();rt.project.objects=[{id:'new'}];rt._persistAfterScene();rt._persistBeforeScene();assert.deepEqual(rt.project.objects.map(o=>o.id),['new']);rt.project.objects=[{id:'other'}];rt._persistAfterScene();assert.deepEqual(rt.project.objects.map(o=>o.id),['other','music','clip'])
})
test('PERSIST-17: el objeto que colisiona conserva el original de la escena', () => {
  const rt=fake(objs());rt._persistBeforeScene();const scene={id:'music',name:'Original destino'};rt.project.objects=[scene];rt._persistAfterScene();assert.equal(rt.project.objects.length,2);rt._persistRemoveInjected();assert.equal(rt.project.objects[0],scene)
})
test('PERSIST-18: detener restaura escena y limpia persistencia', () => {
  const rt=fake(objs());rt._persistBeforeScene();rt.project.objects=[{id:'new'}];rt._persistAfterScene();rt._persistEnd();assert.deepEqual(rt.project.objects.map(o=>o.id),['new']);assert.equal(rt._persistObjects.size,0)
})
test('PERSIST-19: un override que apaga la persistencia excluye la jerarquía', () => {
  const rt=fake(objs());rt._persistSet('music',false);rt._persistBeforeScene();assert.equal(rt._persistObjects.size,0)
})
test('PERSIST-20: escena Empty no necesita objetos', () => { const rt=fake([]);rt._persistBeforeScene();rt._persistAfterScene();assert.equal(rt.project.objects.length,0) })
test('PERSIST-21: casilla común en Inspector con historial', () => { const s=source('src/components/Inspector.vue');assert.match(s,/dontDestroyOnLoad/);assert.match(s,/@change="upd\(\{ dontDestroyOnLoad/) })
test('PERSIST-22: la retención del SceneGraph evita liberar los recursos de los vivos', () => { const s=source('src/engine/runtime/scene-graph.js');assert.match(s,/retained\.has\(id\)\) continue/);assert.match(s,/restoreRetainedNodes\(objects\)/) })
test('PERSIST-23: el cambio de escena conserva y restaura antes de reconfigurar física', () => { const s=source('src/engine/runtime/events/play-nodes.js');assert.match(s,/_persistBeforeScene\(\)/);assert.match(s,/_persistAfterScene\(\)/);assert.match(s,/_setupScene\(tag\)/) })
test('PERSIST-24: el sistema de eventos expone acción declarativa', () => { assert.match(source('src/engine/runtime/events/cmd-world.js'),/nodePersist:/); assert.match(source('src/engine/runtime/events/exec-commands.js'),/nodePersist\(p, cmd, ctx\)/) })
test('PERSIST-25: game.node y game.dontDestroyOnLoad utilizan el mismo host', () => { assert.match(source('src/engine/runtime/events/interpreter.js'),/dontDestroyOnLoad: \(name, enabled = true\)/);assert.match(source('src/engine/runtime/events/play-host.js'),/nodePersist: \(id, v\)/) })
test('PERSIST-26: el audio de un nodo persistente conserva la misma voz', () => { const s=source('src/engine/runtime/audio/scene.js'); assert.match(s,/const saved = new Map/);assert.match(s,/src = saved\.get\(obj\.id\)/) })
test('PERSIST-27: los overlays no entran en serialización', () => { const s=source('src/core/state/project.js');assert.match(s,/const injected = store\.editor\?\.player\?\.on/);assert.match(s,/_persistBackup/) })
test('PERSIST-28: el Player y el Editor comparten el mismo runtime', () => { const s=source('src/engine/runtime/events/play.js');assert.match(s,/mixin\(PlayMode, persistentMethods\)/);assert.match(s,/_persistEnd\(\)/) })
test('PERSIST-29: la física se reconstruye desde el Jolt existente', () => {const s=source('src/engine/runtime/events/play-persistent.js');assert.match(s,/_bodyAdd\(id/);assert.match(s,/_persistPhysicsResume\(\)/)})
