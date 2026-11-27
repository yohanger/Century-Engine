// LF-GP-OBJ-G001: comprueba reglas y transiciones reales del nodo con un host de manos simulado.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { Party } from '../src/engine/runtime/database/rules.js'
import { gameplayRecord, gameplayProfile, gameplayState, gameplayNext } from '../src/engine/runtime/gameplay/object-state.js'
import { modelIdsInScene } from '../src/engine/runtime/database/models.js'
import { defaultInputMap, normalizeInputMap } from '../src/engine/runtime/input/inputmap.js'

const file = new URL('../src/engine/runtime/events/play-gameplay-objects.js', import.meta.url)
const code = readFileSync(file, 'utf8').replace(/^import .+\n/gm, '').replace('export const gameplayObjectMethods', 'const gameplayObjectMethods')
const methods = runInNewContext(`${code}\ngameplayObjectMethods`, {
  THREE: { Vector3: class { }, Quaternion: class { } },
  gameplayRecord, gameplayProfile, gameplayState, gameplayNext,
})
const database = () => ({
  system: { party: [{ actor: 1 }], equipTypes: ['Arma'], maxItems: 3, terms: { useItem: '{name}' } },
  player: { actorId: 1, slots: [{ id: 'right', label: 'Derecha' }] },
  actors: [{ id: 1, name: 'Héroe', classId: 1, level: 1, equips: [] }],
  classes: [{ id: 1, name: 'Clase', mhpBase: 100, mmpBase: 20, atkBase: 10, defBase: 5, matBase: 0, mdfBase: 0, agiBase: 0, lukBase: 0, learnings: [], traits: [] }],
  items: [{ id: 1, name: 'Poción', model: 'prim:box', physics: 'dynamic', scope: 'self', occasion: 'always', consumable: true, effects: [{ code: 'hp', flat: 10 }], damage: [] },
    { id: 2, name: 'Llave', model: 'prim:box', physics: 'static', scope: 'none', occasion: 'always', consumable: false, effects: [] }],
  weapons: [{ id: 1, name: 'Espada', model: 'blade1', physics: 'static', etype: 1, atk: 8, traits: [] }],
  armors: [], skills: [], states: [], enemies: [], commonEvents: [], quests: [], lore: [],
})
function fixture({ kind = 'items', id = 1, mode = 'inventory', name = 'Botella' } = {}) {
  const db = database(), signals = [], errors = [], moves = []
  const obj = { id: 'gp1', name, type: 'gameplayObject', visible: true, props: { recordKind: kind, recordId: id, mode, slot: 'right' } }
  const st = { status: 'world', inventory: false, slot: 'right' }
  const node = { visible: true, position: { toArray: () => [0, 0, 0] }, quaternion: { toArray: () => [0, 0, 0, 1] }, updateMatrixWorld() {} }
  const party = new Party(db, { changed() {}, nativeSignal: (n, d) => signals.push([n, d]) })
  const game = { db, party, state: {}, rev: 0, report: (e) => errors.push(e.message), _nativeSignal: (n, d) => signals.push([n, d]) }
  const vm = { held: new Map(), stash: new Map(), slots: new Map([['right', { items: [] }]]) }
  const entry = { obj, node, info: { kind, id, record: db[kind].find((r) => r.id === id) }, state: st, profile: gameplayProfile(obj, db), busy: false }
  const pm = {
    ...methods, game, vm, player: { _vmNative: (n, h) => signals.push([n, { objectId: h.id }]) },
    _gpObjects: new Map([[obj.id, entry]]), _bodies: [], phys: null,
    _gpRemoveBody: () => moves.push('body removed'), _gpCreateBody: () => moves.push('body created'),
    viewModelAttach: async ({ target, slot }) => { vm.held.set(target, { id: target, slot }); vm.slots.get(slot).items.push({ id: target }); moves.push('attach') },
    viewModelStash: ({ target }) => {
      if (!vm.held.has(target)) return null
      vm.held.delete(target); vm.slots.get('right').items = []; vm.stash.set(target, true); moves.push('stash'); return { id: target }
    },
    viewModelUnstash: async ({ target, slot }) => {
      if (!vm.stash.delete(target)) return false
      vm.held.set(target, { id: target, slot }); vm.slots.get(slot).items.push({ id: target }); moves.push('draw'); return true
    },
  }
  return { pm, db, st, obj, node, signals, errors, moves, party, vm }
}

test('GP-01 · identidad y registro de Database son independientes de la instancia', () => {
  const { obj, db } = fixture()
  assert.equal(gameplayRecord(obj, db).record.name, 'Poción')
  assert.equal(gameplayProfile(obj, db).type, 'dynamic')
  assert.equal(gameplayNext('world', 'pickup'), 'hand')
  assert.equal(gameplayNext('hand', 'store'), 'stored')
  assert.equal(gameplayNext('consumed', 'pickup'), null)
})

test('GP-02 · cada ejemplar conserva su estado, y se separan las escenas', () => {
  const state = {}, a = { id: 'a', props: { recordKind: 'items', recordId: 1 } }, b = { ...a, id: 'b' }
  gameplayState(state, 's1', a).status = 'hand'
  assert.equal(gameplayState(state, 's1', b).status, 'world')
  assert.equal(gameplayState(state, 's2', a).status, 'world')
})

test('GP-03 · coger para inventario deja una sola unidad, estado hand y dos señales diferentes', async () => {
  const { pm, st, party, signals } = fixture()
  assert.equal(await pm._gpPickup('gp1'), true)
  assert.equal(st.status, 'hand'); assert.equal(st.inventory, true)
  assert.equal(party.count('items', 1), 1)
  assert.deepEqual(signals.map(([n]) => n), ['inventory.item_added', 'object.grabbed', 'item.picked_up'])
  assert.equal(await pm._gpPickup('gp1'), false)
  assert.equal(party.count('items', 1), 1)
})

test('GP-04 · agarre directo no añade inventario; guardar sí, una sola vez', async () => {
  const { pm, st, party } = fixture({ mode: 'direct' })
  assert.equal(await pm._gpPickup('gp1'), true)
  assert.equal(party.count('items', 1), 0)
  assert.equal(await pm._gpStore('gp1'), true)
  assert.equal(st.status, 'stored')
  assert.equal(party.count('items', 1), 1)
  assert.equal(await pm._gpStore('gp1'), false)
  assert.equal(party.count('items', 1), 1)
  assert.equal(await pm._gpDraw('gp1'), true)
  assert.equal(st.status, 'hand')
  assert.equal(party.count('items', 1), 1)
})

test('GP-05 · soltar descuenta solo si pertenecía al inventario', async () => {
  const inv = fixture(), direct = fixture({ mode: 'direct' })
  await inv.pm._gpPickup('gp1'); inv.pm._gpDrop('gp1')
  assert.equal(inv.st.status, 'world'); assert.equal(inv.party.count('items', 1), 0)
  await direct.pm._gpPickup('gp1'); direct.pm._gpDrop('gp1')
  assert.equal(direct.st.status, 'world'); assert.equal(direct.party.count('items', 1), 0)
})

test('GP-06 · inventario lleno impide coger sin cambios físicos ni señales', async () => {
  const { pm, party, st, signals, moves } = fixture()
  party.gain('items', 1, 3); signals.length = 0
  assert.equal(await pm._gpPickup('gp1'), false)
  assert.equal(st.status, 'world'); assert.equal(moves.length, 0); assert.equal(signals.length, 0)
})

test('GP-07 · una mano ocupada impide recoger otro objeto', async () => {
  const { pm, vm, st } = fixture()
  vm.slots.get('right').items.push({ id: 'otro' })
  assert.equal(await pm._gpPickup('gp1'), false)
  assert.equal(st.status, 'world')
})

test('GP-08 · arma de Database se equipa con Party y se desequipa al soltar', async () => {
  const { pm, party, st } = fixture({ kind: 'weapons' })
  assert.equal(await pm._gpPickup('gp1'), true)
  assert.equal(party.actor(1).equips[0], 1); assert.equal(party.count('weapons', 1), 0)
  pm._gpDrop('gp1')
  assert.equal(st.status, 'world'); assert.equal(party.actor(1).equips[0], 0)
  assert.equal(party.count('weapons', 1), 0)
})

test('GP-09 · consumir un objeto en mano elimina representación y evita reaparecer', async () => {
  const { pm, st, party, node } = fixture()
  await pm._gpPickup('gp1'); party.battler(1).hp = 50
  assert.equal(await pm._gpUse('gp1'), true)
  assert.equal(party.battler(1).hp, 60); assert.equal(party.count('items', 1), 0)
  assert.equal(st.status, 'consumed'); assert.equal(node.visible, false)
})

test('GP-10 · llave reutilizable conserva la cantidad al usarla', async () => {
  const { pm, st, party } = fixture({ id: 2 })
  await pm._gpPickup('gp1')
  assert.equal(await pm._gpUse('gp1'), true)
  assert.equal(party.count('items', 2), 1); assert.equal(st.status, 'hand')
})

test('GP-11 · un objeto directo no se consume antes de entrar en inventario', async () => {
  const { pm, st } = fixture({ mode: 'direct' })
  await pm._gpPickup('gp1')
  assert.equal(await pm._gpUse('gp1'), false); assert.equal(st.status, 'hand')
})

test('GP-12 · el Player empaqueta el modelo de Gameplay Object desde Database', () => {
  const db = database(), o = { id: 'n1', type: 'gameplayObject', props: { recordKind: 'weapons', recordId: 1 } }
  assert.deepEqual([...modelIdsInScene([o], db, [])], ['blade1'])
})

test('GP-13 · nuevas acciones se añaden al Input Map y proyectos anteriores las heredan', () => {
  const actions = normalizeInputMap({ actions: [{ name: 'interact', bindings: ['KeyE'] }] }).actions
  assert.ok(actions.some((a) => a.name === 'gp_use' && a.bindings.includes('KeyF')))
  assert.ok(defaultInputMap().actions.some((a) => a.name === 'gp_store'))
  assert.ok(defaultInputMap().actions.some((a) => a.name === 'gp_draw'))
})

test('GP-14 · editor registra tipo independiente sin páginas ni comando de evento', () => {
  const src = readFileSync(new URL('../src/engine/runtime/nodes/gameplay-object.js', import.meta.url), 'utf8')
  assert.match(src, /category: 'Gameplay'/)
  assert.match(src, /type: 'gameplayObject'/)
  assert.doesNotMatch(src, /newEventProps\(/)
  assert.match(readFileSync(new URL('../src/components/Inspector.vue', import.meta.url), 'utf8'), /obj\.type === 'gameplayObject'/)
})

test('GP-15 · guardar y sacar un arma conserva una sola unidad y su equipamiento', async () => {
  const { pm, st, party } = fixture({ kind: 'weapons' })
  assert.equal(await pm._gpPickup('gp1'), true)
  assert.equal(party.actor(1).equips[0], 1)
  assert.equal(await pm._gpStore('gp1'), true)
  assert.equal(st.status, 'stored'); assert.equal(party.actor(1).equips[0], 0)
  assert.equal(party.count('weapons', 1), 1)
  assert.equal(await pm._gpDraw('gp1'), true)
  assert.equal(st.status, 'hand'); assert.equal(party.actor(1).equips[0], 1)
  assert.equal(party.count('weapons', 1), 0)
})

test('GP-16 · restaurar un objeto guardado no vuelve a emitir señales', () => {
  const { pm, st, signals } = fixture()
  st.status = 'stored'
  pm._gpReady()
  assert.deepEqual(signals, [])
})

test('GP-17 · el snapshot conserva posición del mundo sin confundirlo con inventario', () => {
  const { pm, st } = fixture()
  pm._gpCapture()
  assert.deepEqual(st.position, [0, 0, 0]); assert.equal(st.status, 'world')
  assert.deepEqual(Array.from(st.velocity), [0, 0, 0]); assert.equal(st.inventory, false)
})


test('GP-18 · arma ofensiva exige enemigo configurado y no se dirige al jugador', async () => {
  const { pm, party, db, obj } = fixture({ kind: 'weapons' })
  db.skills.push({ id: 1, name: 'Golpe', scope: 'enemy', occasion: 'always', mpCost: 0, damage: [{ type: 'hp', formula: '10' }], effects: [] })
  db.weapons[0].actionSkill = 1
  db.enemies.push({ id: 1, name: 'Enemigo', mhp: 100, mmp: 0, atk: 1, def: 0, mat: 0, mdf: 0, agi: 0, luk: 0, traits: [] })
  await pm._gpPickup('gp1')
  assert.equal(await pm._gpUse('gp1'), false)
  obj.props.targetEnemy = 1
  const target = party.enemy(1), before = target.hp
  assert.equal(await pm._gpUse('gp1'), true)
  assert.ok(target.hp < before)
})
