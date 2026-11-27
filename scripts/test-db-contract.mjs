// Baseline de Database y guardado de LevelForge (LF-DB-S01-G001).
// Caracteriza contratos existentes. Los comportamientos aún no definidos quedan TODO, no PASS.
// Ejecutar: node --test scripts/test-db-contract.mjs
import test from 'node:test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { Party } from '../src/engine/runtime/database/rules.js'
import { MemoryStorage, SaveManager, SAVE_VERSION } from '../src/engine/runtime/events/saves.js'
import { EXEC } from '../src/engine/runtime/events/exec-commands.js'
import { Game } from '../src/engine/runtime/events/interpreter.js'
import { newRecord, normalizeDatabase } from '../src/engine/runtime/database/schema.js'
import { graphicPhysics } from '../src/engine/runtime/database/models.js'
import { modelIdsInScene } from '../src/engine/runtime/database/models.js'
import { buildSceneIds, validateBuildSources } from '../src/core/buildList.js'

// Datos mínimos propios del test: no se escriben archivos de proyecto ni se modifica la Database real.
function database() {
  return {
    system: {
      party: [{ actor: 1 }], startGold: 12, maxItems: 5, equipTypes: ['Arma', 'Escudo'],
      currency: 'G', terms: { useItem: '{a} usa {name}.' },
    },
    actors: [{ id: 1, name: 'Protagonista', classId: 1, level: 1, equips: [], traits: [] }],
    classes: [{ id: 1, name: 'Viajero', mhpBase: 100, mmpBase: 30, atkBase: 12, defBase: 4,
      matBase: 6, mdfBase: 3, agiBase: 5, lukBase: 5, expBase: 30, expInflation: 0,
      learnings: [{ level: 1, skill: 1 }], traits: [] }],
    items: [
      { id: 1, name: 'Poción', scope: 'one', occasion: 'always', consumable: true,
        damage: [], effects: [{ code: 'hp', flat: 25 }] },
      { id: 2, name: 'Llave', scope: 'one', occasion: 'always', consumable: false,
        damage: [], effects: [{ code: 'commonEvent', event: 7 }] },
      { id: 3, name: 'Objeto sellado', scope: 'one', occasion: 'never', consumable: true,
        damage: [], effects: [{ code: 'hp', flat: 10 }] },
    ],
    weapons: [{ id: 1, name: 'Espada', etype: 1, atk: 8, traits: [] }],
    armors: [{ id: 1, name: 'Escudo', etype: 2, def: 5, traits: [] }],
    skills: [{ id: 1, name: 'Golpe', scope: 'one', mpCost: 3, damage: [
      { type: 'hp', formula: 'a.atk * 4 - b.def * 2', variance: 0, element: 0 },
    ], effects: [], message: '{a} usa {name}.' }],
    states: [{ id: 1, name: 'Veneno', duration: 2, restriction: 'none', traits: [] }],
    enemies: [{ id: 1, name: 'Enemigo', mhp: 60, mmp: 10, atk: 8, def: 2, traits: [] }],
    quests: [], lore: [], player: { saveSlots: 3 },
  }
}

function context() {
  const changes = [], events = []
  const ctx = {
    getVar: (id) => id === '1' ? 8 : 0,
    changed: (kind) => changes.push(kind),
    callCommon: async (id) => { events.push(id) },
  }
  return { ctx, changes, events }
}

function sample() {
  const db = database(), { ctx, changes, events } = context()
  return { db, party: new Party(db, ctx), changes, events }
}

function mockGame(party, db) {
  const savedWorld = { sceneName: 'Habitación', position: [1, 2, 3] }
  const restored = [], emitted = [], errors = []
  const game = {
    db, party, sw: { 1: true }, vr: { 2: 14 }, selfSw: { 'door:A': true },
    dyn: { switches: [], variables: [] }, state: { chapter: 2 }, time: 42, rev: 0,
    host: { level: { name: 'Habitación' }, captureWorld: async () => structuredClone(savedWorld),
      restoreWorld: async (world) => { restored.push(world) } },
    emit: async (event, payload) => { emitted.push({ event, payload }) },
    report: (err, label) => { errors.push({ err, label }) },
  }
  return { game, restored, emitted, errors }
}

test('S01-DB-01 · inicializa grupo, estadísticas y oro desde Database', () => {
  const { party } = sample()
  assert.deepEqual(party.members, [1])
  assert.equal(party.gold, 12)
  assert.equal(party.battler(1).hp, 100)
  assert.equal(party.battler(1).mp, 30)
  assert.deepEqual(party.skillIds(party.actor(1)), [1])
})

test('S01-DB-02 · sumar, retirar y limitar cantidades al máximo', () => {
  const { party, changes } = sample()
  assert.equal(party.gain('items', 1, 2), 2)
  assert.equal(party.gain('items', 1, 10), 5)
  assert.equal(party.gain('items', 1, -3), 2)
  assert.equal(party.count('items', 1), 2)
  assert.equal(changes.filter((x) => x === 'inventory').length, 3)
})

test('S01-DB-03 · inventario: cantidad cero, consulta por nombre y listado', () => {
  const { party } = sample()
  party.setCount('items', 'Llave', 1)
  assert.equal(party.has('items', 'Llave'), true)
  assert.deepEqual(party.list('items').map((x) => [x.name, x.count]), [['Llave', 1]])
  party.setCount('items', 2, 0)
  assert.equal(party.has('items', 2), false)
  assert.deepEqual(party.list('items'), [])
})

test('S01-DB-04 · referencia inexistente: error explícito, sin crear registros', () => {
  const { party } = sample()
  assert.throws(() => party.gain('items', 999), /No existe/)
  assert.equal(Object.keys(party.inv.items).length, 0)
})

test('S01-DB-05 · poción consumible: recupera HP y descuenta una unidad', () => {
  const { party } = sample()
  party.gain('items', 1, 2)
  party.battler(1).hp = 45
  const res = party.useItem(1, 1, 1)
  assert.equal(res.ok, true)
  assert.equal(party.battler(1).hp, 70)
  assert.equal(party.count('items', 1), 1)
  assert.deepEqual(res.effects, [{ code: 'hp', amount: 25 }])
})

test('S01-DB-06 · objeto no consumible: conserva cantidad y declara evento común', async () => {
  const { party, events } = sample()
  party.gain('items', 2, 1)
  const res = party.useItem(2, 1, 1)
  assert.equal(res.ok, true)
  assert.equal(party.count('items', 2), 1)
  assert.deepEqual(res.events, [7])
  assert.deepEqual(events, [], 'Los eventos no deben ejecutarse automáticamente por useItem')
  await party.runEvents(res)
  assert.deepEqual(events, [7])
})

test('S01-DB-07 · objeto ausente/no utilizable: no consume ni cambia HP', () => {
  const { party } = sample()
  party.battler(1).hp = 30
  assert.equal(party.useItem(1, 1).ok, false)
  party.gain('items', 3, 1)
  assert.equal(party.useItem(3, 1).ok, false)
  assert.equal(party.count('items', 3), 1)
  assert.equal(party.battler(1).hp, 30)
})

test('S01-DB-08 · equipar arma: inventario decrementa y se aplica atributo', () => {
  const { party } = sample()
  party.gain('weapons', 1, 1)
  party.equip(1, 1, 1)
  assert.equal(party.actor(1).equips[0], 1)
  assert.equal(party.count('weapons', 1), 0)
  assert.equal(party.battler(1).atk, 20)
})

test('S01-DB-09 · desequipar: devuelve arma al inventario y restaura atributo', () => {
  const { party } = sample()
  party.gain('weapons', 1)
  party.equip(1, 1, 1)
  party.equip(1, 1, 0)
  assert.equal(party.count('weapons', 1), 1)
  assert.equal(party.battler(1).atk, 12)
})

test('S01-DB-10 · equipamiento: bloquea ranura incompatible', () => {
  const { party, db } = sample()
  db.armors[0].etype = 3 // no pertenece a la ranura de escudo
  party.gain('armors', 1)
  assert.throws(() => party.equip(1, 'Escudo', 1), /no va en la ranura/)
  assert.equal(party.count('armors', 1), 1)
})

test('S01-DB-11 · fórmula: variables a, b y v disponibles', () => {
  const { party } = sample()
  const b = party.battler(1)
  assert.equal(party.formula('a.atk * 2 - b.def + v[1]', b, b), 28)
})

test('S01-DB-12 · fórmula inválida: comunica error, no lo oculta', () => {
  const { party } = sample()
  const b = party.battler(1)
  assert.throws(() => party.formula('a.atk + )', b, b), /Fórmula/)
})

test('S01-DB-13 · golpe: consume MP y aplica daño determinista', () => {
  const { party } = sample()
  const target = party.enemy(1)
  const res = party.useSkill(1, 1, target)
  assert.equal(res.ok, true)
  assert.equal(party.battler(1).mp, 27)
  assert.equal(res.hits[0].damage.amount, 44)
  assert.equal(target.hp, 16)
})

test('S01-DB-14 · habilidad con MP insuficiente: sin daño ni coste', () => {
  const { party } = sample()
  party.battler(1).mp = 2
  const target = party.enemy(1)
  const res = party.useSkill(1, 1, target)
  assert.equal(res.ok, false)
  assert.equal(party.battler(1).mp, 2)
  assert.equal(target.hp, 60)
})

test('S01-DB-15 · estados: duración decrece y elimina al terminar', () => {
  const { party } = sample()
  assert.equal(party.addState(1, 1), true)
  assert.deepEqual(party.battler(1).states, [1])
  assert.deepEqual(party.tick(1), [])
  assert.deepEqual(party.tick(1), [['Protagonista', 1]])
  assert.deepEqual(party.battler(1).states, [])
})

test('S01-DB-16 · snapshot: es una copia independiente del estado', () => {
  const { party, db } = sample()
  const { game } = mockGame(party, db)
  const save = new SaveManager(game)
  party.gain('items', 1, 2)
  const snapshot = save.snapshot()
  party.gain('items', 1, -1)
  game.state.chapter = 3
  assert.equal(snapshot.party.inv.items[1], 2)
  assert.equal(snapshot.state.chapter, 2)
})

test('S01-DB-17 · restore: conserva referencia game.state y restaura grupo', () => {
  const { party, db } = sample()
  const { game } = mockGame(party, db)
  const save = new SaveManager(game)
  party.gain('items', 1, 2)
  party.battler(1).hp = 25
  const snapshot = save.snapshot(), stateReference = game.state
  game.state.chapter = 9
  party.gain('items', 1, -2)
  party.battler(1).hp = 70
  save.restore(snapshot)
  assert.strictEqual(game.state, stateReference)
  assert.equal(game.state.chapter, 2)
  assert.equal(party.battler(1).hp, 25)
  assert.equal(party.count('items', 1), 2)
})

test('S01-DB-18 · MemoryStorage: ranuras y eliminación', () => {
  const storage = new MemoryStorage()
  storage.set(2, { version: 1 })
  assert.deepEqual(storage.slots(), [2])
  assert.deepEqual(storage.get(2), { version: 1 })
  storage.del(2)
  assert.equal(storage.get(2), null)
})

test('S01-DB-19 · SaveManager: guarda y carga con almacenamiento en memoria', async () => {
  const { party, db } = sample()
  const { game, restored, emitted } = mockGame(party, db)
  const save = new SaveManager(game)
  const storage = new MemoryStorage()
  save.useStorage(storage)
  party.gain('items', 1, 2)
  assert.equal(await save.save(1), true)
  assert.equal(storage.get(1).v, SAVE_VERSION)
  assert.equal(save.exists(1), true)
  party.clearInventory()
  assert.equal(await save.load(1), true)
  assert.equal(party.count('items', 1), 2)
  assert.deepEqual(restored, [{ sceneName: 'Habitación', position: [1, 2, 3] }])
  assert.deepEqual(emitted.map((e) => e.event), ['save', 'load'])
})

test('S01-DB-20 · guardado manual bloqueado, autoguardado permitido', async () => {
  const { party, db } = sample()
  const { game } = mockGame(party, db)
  const save = new SaveManager(game)
  save.useStorage(new MemoryStorage())
  save.access = false
  assert.equal(await save.save(1), false)
  assert.equal(save.exists(1), false)
  assert.equal(await save.autosave(), true)
  assert.equal(save.exists(0), true)
})

test('S01-DB-21 · guardado: rechaza ranuras fuera del contrato', () => {
  const { party, db } = sample()
  const { game } = mockGame(party, db)
  const save = new SaveManager(game)
  assert.throws(() => save.exists(4), /Ranura/)
  assert.throws(() => save.exists(-1), /Ranura/)
})

// Los siguientes NO son pruebas superadas. Dependen de decisiones contractuales y Gates posteriores.
test('CA-DB-002 · cada occasion permite solo sus contextos y no consume cuando rechaza', () => {
  for (const occasion of ['always', 'menu', 'event', 'never']) for (const context of ['menu', 'event']) {
    const { party, db } = sample()
    db.items[0].occasion = occasion
    party.gain('items', 1, 2)
    party.battler(1).hp = 20
    const result = party.useItem(1, 1, null, context)
    const allowed = occasion === 'always' || occasion === context
    assert.equal(result.ok, allowed, `${occasion} desde ${context}`)
    assert.equal(party.count('items', 1), allowed ? 1 : 2)
    assert.equal(party.battler(1).hp, allowed ? 45 : 20)
    assert.deepEqual(result.events, [])
  }
})

test('CA-DB-002 · las llamadas previas de scripts mantienen contexto event', () => {
  const { party, db } = sample()
  party.gain('items', 1, 2)
  db.items[0].occasion = 'event'
  assert.equal(party.useItem(1, 1).ok, true)
  assert.equal(party.count('items', 1), 1)
  db.items[0].occasion = 'menu'
  assert.equal(party.useItem(1, 1).ok, false)
  assert.equal(party.count('items', 1), 1)
  assert.equal(party.useItem(1, 1, null, 'menu').ok, true)
  assert.equal(party.count('items', 1), 0)
})

test('CA-DB-002 · contextos no reconocidos producen un error explícito', () => {
  const { party } = sample()
  party.gain('items', 1, 1)
  assert.throws(() => party.useItem(1, 1, null, 'battle'), /Contexto de uso/)
  assert.equal(party.count('items', 1), 1)
})

test('S01-DB-DEF-01 · objeto scope=none ejecuta evento común sin personaje objetivo', async () => {
  const { party, db, events } = sample()
  db.items[1].scope = 'none'
  db.items[1].occasion = 'event'
  party.gain('items', 2, 1)
  party.leave(1)
  const result = party.useItem(2)
  assert.equal(result.ok, true)
  assert.deepEqual(result.hits, [])
  assert.deepEqual(result.events, [7])
  assert.equal(party.count('items', 2), 1)
  assert.deepEqual(events, [])
  await party.runEvents(result)
  assert.deepEqual(events, [7])
})

test('S01-DB-DEF-01 · scope=none consumible descuenta exactamente una unidad', async () => {
  const { party, db, events } = sample()
  Object.assign(db.items[1], { scope: 'none', consumable: true, occasion: 'event' })
  party.gain('items', 2, 2)
  const result = party.useItem(2)
  assert.equal(result.ok, true)
  assert.equal(party.count('items', 2), 1)
  await party.runEvents(result)
  assert.deepEqual(events, [7])
})

test('S01-DB-DEF-01 · commonEvent no se repite por cada objetivo ni por efecto duplicado', async () => {
  const { party, db, events } = sample()
  db.actors.push({ id: 2, name: 'Acompañante', classId: 1, level: 1, equips: [], traits: [] })
  party.join(2)
  Object.assign(db.items[1], { scope: 'all', effects: [{ code: 'commonEvent', event: 7 }, { code: 'commonEvent', event: 7 }] })
  party.gain('items', 2, 1)
  const result = party.useItem(2)
  assert.equal(result.hits.length, 2)
  assert.deepEqual(result.events, [7])
  await party.runEvents(result)
  assert.deepEqual(events, [7])
})

test('CA-DB-002 · no se pierde el consumo si un efecto no cambia HP', () => {
  const { party } = sample()
  party.gain('items', 1, 1)
  const hp = party.battler(1).hp
  const result = party.useItem(1, 1, null, 'menu')
  assert.equal(result.ok, true)
  assert.equal(party.count('items', 1), 0)
  assert.equal(party.battler(1).hp, hp)
})

test('CA-DB-002 · uso rechazado no despacha eventos comunes', async () => {
  const { party, db, events } = sample()
  db.items[1].scope = 'none'
  db.items[1].occasion = 'event'
  party.gain('items', 2, 1)
  const result = party.useItem(2, null, null, 'menu')
  assert.equal(result.ok, false)
  assert.deepEqual(result.events, [])
  await party.runEvents(result)
  assert.deepEqual(events, [])
  assert.equal(party.count('items', 2), 1)
})

test('S01-EVT · comando Usar objeto ejecuta eventos y aplica contexto event', async () => {
  const { party, db, events } = sample()
  db.items[1].occasion = 'event'
  db.items[1].scope = 'none'
  party.gain('items', 2, 1)
  const messages = []
  await EXEC.useItem.call({ party, fmt: (x) => x, host: { say: async ({ text }) => messages.push(text) } }, { item: 2, msg: true })
  assert.deepEqual(events, [7])
  assert.equal(messages.length, 1)
  assert.equal(party.count('items', 2), 1)
})

test('S01-EVT · comando de evento no usa objetos exclusivos del menú', async () => {
  const { party, db, events } = sample()
  db.items[1].occasion = 'menu'
  db.items[1].scope = 'none'
  party.gain('items', 2, 1)
  await EXEC.useItem.call({ party, fmt: (x) => x, host: {} }, { item: 2 })
  assert.deepEqual(events, [])
  assert.equal(party.count('items', 2), 1)
})
test('S01-EVT · intérprete real despacha evento común del objeto sin objetivo', async () => {
  const db = database()
  db.items[1].scope = 'none'
  db.items[1].occasion = 'event'
  db.commonEvents = [{ id: 7, name: 'Abrir puerta', list: [{ code: 'switch', p: { id: 1, value: 'on' } }] }]
  const game = new Game({ database: db })
  game.party.gain('items', 2, 1)
  assert.equal(game.getSw(1), false)
  await EXEC.useItem.call(game, { item: 2 })
  assert.equal(game.getSw(1), true)
  assert.equal(game.party.count('items', 2), 1)
})

// CA-DB-003: las fórmulas no pueden ejecutar scripts y un fallo no deja efectos parciales.
test('CA-DB-003 · expresiones tradicionales y funciones Math autorizadas', () => {
  const { party } = sample()
  const a = party.battler(1), b = party.enemy(1)
  assert.equal(party.formula('a.atk * 4 - b.def * 2', a, b), 44)
  assert.equal(party.formula('Math.max(0, a.atk * 4 - b.def * 2) + v[1]', a, b), 52)
  assert.equal(party.formula('a.hp < b.hp ? Math.ceil(b.hp / 2) : Math.floor(a.hp / 3)', a, b), 33)
  assert.equal(party.formula('Math.min(10, 5 ** 2 % 12)', a, b), 1)
  assert.equal(party.formula('(a.atk > b.def && v[1] == 8) ? 5 : 0', a, b), 5)
  assert.equal(party.formula('Math.PI > 3 ? 1 : 0', a, b), 1)
})

test('CA-DB-003 · no admite JS arbitrario ni accesos a propiedades peligrosas', () => {
  const { party } = sample(), a = party.battler(1), b = party.enemy(1)
  const blocked = [
    'globalThis', 'process.exit()', 'Math.constructor("return 1")()',
    'a.constructor.constructor("return 7")()', 'a.__proto__', 'b["hp"]',
    'a.hp = 0', 'a.hp++', 'v[1 + 1]', 'v["1"]',
    'Math.imul(1, 2)', 'Math.max.apply(null, [1, 2])',
    '(()=>1)()', '1; process.exit()', '`unsafe`', 'new Date()',
    '0 ? 1 : globalThis',
  ]
  const hp = a.hp, mp = a.mp
  for (const expr of blocked) assert.throws(() => party.formula(expr, a, b), /Fórmula «/, expr)
  assert.equal(a.hp, hp)
  assert.equal(a.mp, mp)
})

test('CA-DB-003 · resultados no finitos y expresiones inválidas causan error', () => {
  const { party } = sample(), a = party.battler(1), b = party.enemy(1)
  for (const expr of ['1 / 0', '0 / 0', 'Math.sqrt(-1)', 'Math.pow(10, 1000)', 'a.atk +', 'Math.max()']) {
    assert.throws(() => party.formula(expr, a, b), /Fórmula «/, expr)
  }
  assert.equal(party.formula('0 ? (1 / 0) : 7', a, b), 7)
})

test('CA-DB-003 · habilidad: fórmula fallida no descuenta MP ni daña HP', () => {
  const { party, db, changes } = sample()
  db.skills[0].damage[0].formula = 'Math.constructor("return 1")()'
  const a = party.battler(1), target = party.enemy(1), hp = target.hp, mp = a.mp, before = changes.length
  assert.throws(() => party.useSkill(1, 1, target), /Fórmula «/)
  assert.equal(target.hp, hp)
  assert.equal(a.mp, mp)
  assert.equal(changes.length, before)
})

test('CA-DB-003 · fórmula de habilidad ve el MP después del coste sin mutar en preparación', () => {
  const { party, db, changes } = sample()
  db.skills[0].damage[0].formula = 'a.mp'
  const a = party.battler(1), target = party.enemy(1), start = changes.length
  const out = party.useSkill(1, 1, target)
  assert.equal(out.hits[0].damage.amount, 27)
  assert.equal(target.hp, 33)
  assert.equal(a.mp, 27)
  assert.equal(changes.length > start, true)
})

test('CA-DB-003 · fórmula inválida en un objetivo posterior no aplica efectos ni MP', () => {
  const { party, db, changes } = sample()
  const second = { id: 2, name: 'Otro', classId: 1, level: 1, equips: [], traits: [] }
  db.actors.push(second)
  party.join(2)
  db.skills[0].scope = 'all'
  db.skills[0].damage[0].formula = 'b.id == 2 ? (1 / 0) : 10'
  db.skills[0].effects = [{ code: 'hp', flat: -5 }]
  const a = party.battler(1), b = party.battler(2), initial = [a.hp, b.hp, a.mp, changes.length]
  assert.throws(() => party.useSkill(1, 1), /Fórmula «/)
  assert.deepEqual([a.hp, b.hp, a.mp, changes.length], initial)
})

test('CA-DB-003 · fallo en segunda fórmula del objeto no consume ni modifica HP', () => {
  const { party, db, changes } = sample()
  db.items[0].damage = [
    { type: 'hp', formula: '10', variance: 0, element: 0 },
    { type: 'hp', formula: '1 / 0', variance: 0, element: 0 },
  ]
  party.gain('items', 1, 1)
  const target = party.battler(1), initial = [target.hp, party.count('items', 1), changes.length]
  assert.throws(() => party.useItem(1, 1, null, 'menu'), /Fórmula «/)
  assert.deepEqual([target.hp, party.count('items', 1), changes.length], initial)
})

test('CA-DB-003 · fórmulas de curación y absorción conservan la lógica existente', () => {
  const { party, db } = sample()
  const a = party.battler(1), target = party.enemy(1)
  a.hp = 40
  db.skills[0].damage[0] = { type: 'hpDrain', formula: '5 + v[1]', variance: 0, element: 0 }
  const out = party.useSkill(1, 1, target)
  assert.equal(out.hits[0].damage.amount, 13)
  assert.equal(target.hp, 47)
  assert.equal(a.hp, 53)
  assert.equal(a.mp, 27)
})

test('CA-DB-003 · varias referencias a objetivos: prevalidación completa sin mutaciones', () => {
  const { party, db } = sample()
  db.actors.push({ id: 2, name: 'Segundo', classId: 1, level: 1, equips: [], traits: [] })
  party.join(2)
  db.items[0].scope = 'all'
  db.items[0].damage = [{ type: 'hp', formula: 'b.id == 2 ? Math.sqrt(-1) : 5', variance: 0, element: 0 }]
  party.gain('items', 1, 1)
  party.battler(1).hp = 65
  party.battler(2).hp = 65
  assert.throws(() => party.useItem(1), /Fórmula «/)
  assert.equal(party.battler(1).hp, 65)
  assert.equal(party.battler(2).hp, 65)
  assert.equal(party.count('items', 1), 1)
})

test('CA-DB-004 · enemigo heredado mantiene HP y misma instancia entre consultas', () => {
  const { party } = sample()
  const a = party.enemy(1)
  a.hp = 24
  a.mp = 5
  assert.equal(party.enemy('Enemigo').hp, 24)
  assert.equal(party.battler({ enemy: 1 }).mp, 5)
  assert.equal(party.enemy(1).instanceId, 'legacy:1')
  assert.strictEqual(party.enemy(1)._e, a._e)
})

test('CA-DB-004 · dos instancias del mismo tipo conservan estados independientes', () => {
  const { party } = sample()
  const a = party.spawnEnemy(1), b = party.spawnEnemy('Enemigo')
  assert.notEqual(a.instanceId, b.instanceId)
  assert.equal(a.id, 1)
  assert.equal(b.id, 1)
  a.hp = 13; b.hp = 45; a.mp = 2
  assert.equal(party.enemyInstance(a.instanceId).hp, 13)
  assert.equal(party.battler({ enemyInstance: b.instanceId }).hp, 45)
  assert.equal(party.enemy(1).hp, 60)
  assert.equal(party.battler({ enemyInstance: b.instanceId }).mp, 10)
  assert.equal(party.enemyInstance(a.instanceId).mp, 2)
  assert.strictEqual(party.enemyInstance(a.instanceId)._e, a._e)
})

test('CA-DB-004 · estados y duración pertenecen a cada instancia', () => {
  const { party } = sample()
  const a = party.spawnEnemy(1), b = party.spawnEnemy(1)
  party.addState({ enemyInstance: a.instanceId }, 1, 100)
  assert.deepEqual(party.enemyInstance(a.instanceId).states, [1])
  assert.deepEqual(party.enemyInstance(b.instanceId).states, [])
  assert.deepEqual(party.tick({ enemyInstance: a.instanceId }), [])
  assert.deepEqual(party.enemyInstance(a.instanceId)._e.states, [{ id: 1, turns: 1 }])
  assert.deepEqual(party.enemyInstance(b.instanceId)._e.states, [])
})

test('CA-DB-004 · habilidades afectan únicamente a la instancia objetivo', () => {
  const { party } = sample()
  const a = party.spawnEnemy(1), b = party.spawnEnemy(1)
  const result = party.useSkill(1, 1, { enemyInstance: b.instanceId })
  assert.equal(result.ok, true)
  assert.equal(party.enemyInstance(a.instanceId).hp, 60)
  assert.equal(party.enemyInstance(b.instanceId).hp, 16)
})

test('CA-DB-004 · eliminar una instancia no afecta a las demás y no reutiliza el ID', () => {
  const { party } = sample()
  const a = party.spawnEnemy(1), b = party.spawnEnemy(1)
  b.hp = 30
  assert.equal(party.removeEnemy(a.instanceId), true)
  assert.equal(party.removeEnemy(a.instanceId), false)
  assert.throws(() => party.enemyInstance(a.instanceId), /No existe la instancia/)
  assert.equal(party.enemyInstance(b.instanceId).hp, 30)
  const c = party.spawnEnemy(1)
  assert.notEqual(c.instanceId, a.instanceId)
  assert.notEqual(c.instanceId, b.instanceId)
  assert.equal(party.enemy(1).hp, 60)
})

test('CA-DB-004 · los identificadores se validan y las instancias inexistentes dan error', () => {
  const { party } = sample()
  assert.throws(() => party.spawnEnemy(999), /No existe/)
  assert.throws(() => party.enemyInstance('enemy:555'), /No existe la instancia/)
  assert.deepEqual(Object.keys(party.enemies), [])
  assert.equal(party.nextEnemyId, 1)
})

test('CA-DB-004 · snapshot guarda enemigos de forma independiente', () => {
  const { party, db } = sample(), { game } = mockGame(party, db), saves = new SaveManager(game)
  const a = party.spawnEnemy(1), b = party.enemy(1)
  a.hp = 12; b.hp = 5
  const snapshot = saves.snapshot()
  a.hp = 30
  assert.equal(snapshot.party.enemies[a.instanceId].hp, 12)
  assert.equal(snapshot.party.enemies['legacy:1'].hp, 5)
  assert.equal(snapshot.party.nextEnemyId, 2)
})

test('CA-DB-004 · snapshot y restore conservan instancias HP MP estados y contador', () => {
  const { party, db } = sample(), { game } = mockGame(party, db), saves = new SaveManager(game)
  const a = party.spawnEnemy(1), b = party.spawnEnemy(1)
  party.addState(a, 1, 100)
  a.hp = 21; a.mp = 4; b.hp = 33
  const snapshot = saves.snapshot()
  const ref = game.state
  party.removeEnemy(a.instanceId)
  party.spawnEnemy(1)
  saves.restore(snapshot)
  assert.strictEqual(game.state, ref)
  assert.equal(party.enemyInstance(a.instanceId).hp, 21)
  assert.equal(party.enemyInstance(a.instanceId).mp, 4)
  assert.deepEqual(party.enemyInstance(a.instanceId).states, [1])
  assert.equal(party.enemyInstance(b.instanceId).hp, 33)
  assert.equal(party.spawnEnemy(1).instanceId, 'enemy:3')
})

test('CA-DB-004 · SaveManager guarda y carga instancias con almacenamiento real', async () => {
  const { party, db } = sample(), { game } = mockGame(party, db), saves = new SaveManager(game)
  saves.useStorage(new MemoryStorage())
  const a = party.spawnEnemy(1)
  a.hp = 17
  party.addState(a, 1, 100)
  assert.equal(await saves.save(1), true)
  party.enemyInstance(a.instanceId).hp = 1
  assert.equal(await saves.load(1), true)
  assert.equal(party.enemyInstance(a.instanceId).hp, 17)
  assert.deepEqual(party.enemyInstance(a.instanceId).states, [1])
})

test('CA-DB-004 · carga partidas antiguas sin enemigos y limpia datos de sesión', () => {
  const { party, db } = sample(), { game } = mockGame(party, db), saves = new SaveManager(game)
  const a = party.spawnEnemy(1)
  party.enemy(1).hp = 1
  const legacy = saves.snapshot()
  delete legacy.party.enemies
  delete legacy.party.nextEnemyId
  saves.restore(legacy)
  assert.deepEqual(Object.keys(party.enemies), [])
  assert.throws(() => party.enemyInstance(a.instanceId), /No existe/)
  assert.equal(party.enemy(1).hp, 60)
  assert.equal(party.spawnEnemy(1).instanceId, 'enemy:1')
})

test('CA-DB-004 · restauración sin contador no reutiliza identificadores', () => {
  const { party, db } = sample(), { game } = mockGame(party, db), saves = new SaveManager(game)
  const a = party.spawnEnemy(1), b = party.spawnEnemy(1)
  const legacy = saves.snapshot()
  delete legacy.party.nextEnemyId
  saves.restore(legacy)
  assert.equal(party.enemyInstance(a.instanceId).id, 1)
  assert.equal(party.enemyInstance(b.instanceId).id, 1)
  assert.equal(party.spawnEnemy(1).instanceId, 'enemy:3')
})

test('CA-DB-004 · reset borra enemigos e inicia nueva partida limpia', () => {
  const { party } = sample()
  const a = party.spawnEnemy(1)
  party.enemy(1).hp = 5
  party.reset()
  assert.deepEqual(Object.keys(party.enemies), [])
  assert.equal(party.nextEnemyId, 1)
  assert.throws(() => party.enemyInstance(a.instanceId), /No existe/)
  assert.equal(party.enemy(1).hp, 60)
})
test('CA-DB-005 · esquema incluye HP y MP fijos/porcentuales, y normaliza estados antiguos', () => {
  const r = newRecord('states', 3)
  for (const key of ['tickHpFlat', 'tickHpPct', 'tickMpFlat', 'tickMpPct']) assert.equal(r[key], 0)
  const db = normalizeDatabase(database())
  assert.equal(db.states[0].duration, 2)
  assert.equal(db.states[0].tickHpFlat, 0)
  assert.equal(db.states[0].tickMpPct, 0)
  assert.equal(db.actors[0].name, 'Protagonista')
})

test('CA-DB-005 · veneno fijo aplica antes de agotar duración, exactamente tres ticks', () => {
  const { party, db } = sample()
  Object.assign(db.states[0], { duration: 3, tickHpFlat: -5 })
  party.addState(1, 1)
  assert.equal(party.battler(1).hp, 100)
  for (let i = 1; i <= 3; i++) {
    const ended = party.tick(1)
    assert.equal(party.battler(1).hp, 100 - i * 5)
    assert.deepEqual(ended, i === 3 ? [['Protagonista', 1]] : [])
  }
  assert.deepEqual(party.battler(1).states, [])
  party.tick(1)
  assert.equal(party.battler(1).hp, 85)
})

test('CA-DB-005 · regeneración fija HP/MP respeta los límites máximos', () => {
  const { party, db } = sample()
  Object.assign(db.states[0], { duration: 2, tickHpFlat: 9, tickMpFlat: 4 })
  const b = party.battler(1)
  b.hp = 95; b.mp = 29
  party.addState(1, 1)
  party.tick(1)
  assert.equal(b.hp, 100)
  assert.equal(b.mp, 30)
  assert.equal(party.battler(1)._a.states[0].turns, 1)
})

test('CA-DB-005 · cantidades porcentuales del máximo se suman a los valores fijos', () => {
  const { party, db } = sample()
  Object.assign(db.states[0], { duration: 1, tickHpFlat: -1, tickHpPct: -12.5, tickMpFlat: 2, tickMpPct: -10 })
  const b = party.battler(1)
  b.hp = 70; b.mp = 20
  party.addState(1, 1)
  party.tick(1)
  assert.equal(b.hp, 57) // Math.round(-1 - 12.5) = -13
  assert.equal(b.mp, 19) // 2 - (30 * 10 / 100) = -1
})

test('CA-DB-005 · pérdida de HP y MP no baja de cero', () => {
  const { party, db } = sample()
  Object.assign(db.states[0], { duration: 1, tickHpFlat: -500, tickMpPct: -250 })
  const b = party.battler(1)
  b.hp = 4; b.mp = 2
  party.addState(1, 1)
  party.tick(1)
  assert.equal(b.hp, 0)
  assert.equal(b.mp, 0)
})

test('CA-DB-005 · tick() sin objetivo aplica efectos a los miembros del grupo', () => {
  const { party, db } = sample()
  db.actors.push({ id: 2, name: 'Acompañante', classId: 1, level: 1, equips: [], traits: [] })
  party.join(2)
  Object.assign(db.states[0], { duration: 2, tickHpFlat: -4 })
  party.addState(1, 1)
  party.addState(2, 1)
  party.tick()
  assert.equal(party.battler(1).hp, 96)
  assert.equal(party.battler(2).hp, 96)
  assert.equal(party.battler(1)._a.states[0].turns, 1)
  assert.equal(party.battler(2)._a.states[0].turns, 1)
})

test('CA-DB-005 · un tick del grupo no avanza enemigos, ni siquiera el enemigo heredado', () => {
  const { party, db } = sample()
  Object.assign(db.states[0], { duration: 2, tickHpFlat: -5 })
  const enemy = party.enemy(1)
  party.addState(enemy, 1)
  party.tick()
  assert.equal(enemy.hp, 60)
  assert.deepEqual(enemy._e.states, [{ id: 1, turns: 2 }])
  party.tick({ enemy: 1 })
  assert.equal(enemy.hp, 55)
  assert.equal(enemy._e.states[0].turns, 1)
})

test('CA-DB-005 · solo avanza la instancia enemiga seleccionada', () => {
  const { party, db } = sample()
  Object.assign(db.states[0], { duration: 2, tickHpFlat: -7, tickMpFlat: -3 })
  const a = party.spawnEnemy(1), b = party.spawnEnemy(1)
  party.addState(a, 1)
  party.addState(b, 1)
  party.tick({ enemyInstance: a.instanceId })
  assert.equal(a.hp, 53)
  assert.equal(a.mp, 7)
  assert.equal(b.hp, 60)
  assert.equal(b.mp, 10)
  assert.deepEqual(b._e.states, [{ id: 1, turns: 2 }])
})

test('CA-DB-005 · duración cero es permanente, incluso con daño periódico', () => {
  const { party, db } = sample()
  Object.assign(db.states[0], { duration: 0, tickHpFlat: -2 })
  party.addState(1, 1)
  for (let i = 0; i < 4; i++) assert.deepEqual(party.tick(1), [])
  assert.equal(party.battler(1).hp, 92)
  assert.deepEqual(party.battler(1)._a.states, [{ id: 1, turns: 0 }])
  party.removeState(1, 1)
  party.tick(1)
  assert.equal(party.battler(1).hp, 92)
})

test('CA-DB-005 · reaplicar refresca duración sin duplicar estados', () => {
  const { party, db } = sample()
  Object.assign(db.states[0], { duration: 3, tickHpFlat: -1 })
  party.addState(1, 1)
  party.tick(1)
  assert.deepEqual(party.battler(1)._a.states, [{ id: 1, turns: 2 }])
  party.addState(1, 1)
  assert.deepEqual(party.battler(1)._a.states, [{ id: 1, turns: 3 }])
  party.tick(1)
  assert.equal(party.battler(1).hp, 98)
  assert.equal(party.battler(1)._a.states.length, 1)
})

test('CA-DB-005 · estados previos sin configuración periódica conservan duración sin daño', () => {
  const { party } = sample()
  party.addState(1, 1)
  party.tick(1)
  assert.equal(party.battler(1).hp, 100)
  assert.equal(party.battler(1).mp, 30)
  assert.deepEqual(party.battler(1)._a.states, [{ id: 1, turns: 1 }])
  assert.deepEqual(party.tick(1), [['Protagonista', 1]])
})

test('CA-DB-005 · guardar y cargar conserva HP, MP y la duración restante de personajes', async () => {
  const { party, db } = sample(), { game } = mockGame(party, db), saves = new SaveManager(game)
  saves.useStorage(new MemoryStorage())
  Object.assign(db.states[0], { duration: 3, tickHpFlat: -3, tickMpFlat: -2 })
  party.addState(1, 1)
  party.tick(1)
  assert.equal(await saves.save(1), true)
  party.tick(1)
  assert.equal(await saves.load(1), true)
  assert.equal(party.battler(1).hp, 97)
  assert.equal(party.battler(1).mp, 28)
  assert.deepEqual(party.battler(1)._a.states, [{ id: 1, turns: 2 }])
  party.tick(1)
  assert.equal(party.battler(1).hp, 94)
})

test('CA-DB-005 · guardar y cargar conserva efectos pendientes en instancia enemiga', async () => {
  const { party, db } = sample(), { game } = mockGame(party, db), saves = new SaveManager(game)
  saves.useStorage(new MemoryStorage())
  Object.assign(db.states[0], { duration: 2, tickHpPct: -10 })
  const a = party.spawnEnemy(1)
  party.addState(a, 1)
  party.tick({ enemyInstance: a.instanceId })
  assert.equal(await saves.save(1), true)
  party.tick({ enemyInstance: a.instanceId })
  assert.equal(await saves.load(1), true)
  assert.equal(party.enemyInstance(a.instanceId).hp, 54)
  assert.deepEqual(party.enemyInstance(a.instanceId)._e.states, [{ id: 1, turns: 1 }])
  assert.deepEqual(party.tick({ enemyInstance: a.instanceId }), [['Enemigo', 1]])
  assert.equal(party.enemyInstance(a.instanceId).hp, 48)
})

test('CA-DB-005 · efecto inválido rechaza el tick sin modificar estadísticas ni duraciones', () => {
  const { party, db } = sample()
  db.states.push({ id: 2, name: 'Corrupto', duration: 2, tickHpPct: 'infinito' })
  Object.assign(db.states[0], { duration: 2, tickHpFlat: -2 })
  party.addState(1, 1)
  party.addState(1, 2)
  const before = structuredClone(party.battler(1)._a.states)
  assert.throws(() => party.tick(1), /no es finito/)
  assert.equal(party.battler(1).hp, 100)
  assert.deepEqual(party.battler(1)._a.states, before)
})
// G006: pruebas con Game/EXEC/SaveManager reales. El host simula exclusivamente
// la escena; las pruebas visuales del editor, Player y AppImage son QA manual.
function integratedGame(db = database()) {
  const errors = [], worlds = [], signals = []
  const world = { sceneName: 'Laboratorio', position: [2, 1, -3] }
  const host = {
    level: { name: 'Laboratorio' },
    captureWorld: async () => structuredClone(world),
    restoreWorld: async (state) => { worlds.push(structuredClone(state)) },
    error: (message) => { errors.push(message) },
  }
  const game = new Game({ database: db, host })
  game.saves.useStorage(new MemoryStorage())
  game.on('save', (data) => { signals.push(['save', data.slot]) })
  game.on('load', (data) => { signals.push(['load', data.slot]) })
  return { game, errors, worlds, signals, world }
}

test('S01-INT-01 · Database → comandos → evento común → habilidad → estados → guardado/carga', async () => {
  const db = database()
  db.items[1].scope = 'none'
  db.items[1].occasion = 'event'
  db.skills[0].damage[0].formula = 'Math.max(0, a.atk * 4 - b.def * 2) + v[1]'
  Object.assign(db.states[0], { duration: 2, tickHpFlat: -2, tickMpFlat: 1 })
  db.commonEvents = [{ id: 7, name: 'Abrir laboratorio', list: [
    { code: 'variable', p: { id: 1, op: 'set', value: 8 } },
    { code: 'switch', p: { id: 1, value: 'on' } },
  ] }]
  const { game, errors, worlds, signals, world } = integratedGame(db)
  const P = game.party
  const actor = P.battler(1)
  const enemy = P.spawnEnemy(1)
  const initialState = game.state
  const run = (commands) => game.run(commands, { eventId: 'laboratorio:llave' }).done

  await run([
    { code: 'items', p: { kind: 'items', item: 1, op: 'add', n: 2 } },
    { code: 'items', p: { kind: 'items', item: 2, op: 'add', n: 1 } },
    { code: 'actorStat', p: { actor: 1, stat: 'hp', op: 'sub', n: 40 } },
    { code: 'useItem', p: { item: 1, target: 1 } },
    { code: 'useItem', p: { item: 2 } },
    { code: 'useSkill', p: { skill: 1, user: 1, target: { enemyInstance: enemy.instanceId } } },
    { code: 'state', p: { actor: 1, action: 'add', state: 1 } },
  ])
  assert.deepEqual(errors, [], 'Los comandos deben ejecutar sin errores del intérprete')
  assert.equal(game.getSw(1), true, 'Evento común activó el interruptor')
  assert.equal(game.getVar(1), 8, 'Evento común estableció la variable de fórmula')
  assert.equal(P.count('items', 1), 1, 'La poción consumió una unidad')
  assert.equal(P.count('items', 2), 1, 'La llave no consumible se conserva')
  assert.equal(actor.hp, 85)
  assert.equal(actor.mp, 27)
  assert.equal(enemy.hp, 8, 'La habilidad usa a, b y la variable del evento común')
  assert.deepEqual(actor.states, [1])

  P.tick(1)
  assert.equal(actor.hp, 83)
  assert.equal(actor.mp, 28)
  assert.equal(actor._a.states[0].turns, 1)
  P.addState(enemy, 1)
  P.tick({ enemyInstance: enemy.instanceId })
  assert.equal(enemy.hp, 6)
  game.setSelf('laboratorio:llave', 'A', true)
  game.state.chapter = 2
  await run([{ code: 'saveGame', p: { slot: 1 } }])
  assert.equal(game.saves.exists(1), true)
  const saved = game.saves.storage.get(1)
  assert.equal(saved.world.sceneName, world.sceneName)
  assert.equal(saved.game.party.enemies[enemy.instanceId].hp, 6)
  assert.deepEqual(signals, [['save', 1]])

  // Cambiar todo después del guardado: al cargar debe volver el estado original.
  P.clearInventory()
  actor.hp = 1; actor.mp = 0
  P.enemyInstance(enemy.instanceId).hp = 1
  P.tick(1)
  game.setSw(1, false); game.setVar(1, 500)
  game.setSelf('laboratorio:llave', 'A', false)
  game.state.chapter = 99
  await run([{ code: 'loadGame', p: { slot: 1 } }])
  assert.deepEqual(errors, [])
  assert.strictEqual(game.state, initialState)
  assert.equal(game.state.chapter, 2)
  assert.equal(P.count('items', 1), 1)
  assert.equal(P.count('items', 2), 1)
  assert.equal(P.battler(1).hp, 83)
  assert.equal(P.battler(1).mp, 28)
  assert.equal(P.battler(1)._a.states[0].turns, 1)
  assert.equal(P.enemyInstance(enemy.instanceId).hp, 6)
  assert.equal(P.enemyInstance(enemy.instanceId)._e.states[0].turns, 1)
  assert.equal(game.getSw(1), true)
  assert.equal(game.getVar(1), 8)
  assert.equal(game.getSelf('laboratorio:llave', 'A'), true)
  assert.deepEqual(worlds, [world])
  assert.deepEqual(signals, [['save', 1], ['load', 1]])
  P.tick(1)
  P.tick({ enemyInstance: enemy.instanceId })
  assert.equal(P.battler(1).hp, 81)
  assert.equal(P.enemyInstance(enemy.instanceId).hp, 4)
  assert.deepEqual(P.battler(1).states, [])
  assert.deepEqual(P.enemyInstance(enemy.instanceId).states, [])
})

test('S01-INT-02 · las páginas del evento responden a inventario, interruptor y auto-interruptor', async () => {
  const { game, errors } = integratedGame()
  const event = { pages: [
    { cond: {}, list: [] },
    { cond: { item: 2, sw1: 1, self: 'A' }, list: [] },
  ] }
  const id = 'laboratorio:puerta'
  assert.equal(game.activePage(event, id), 0)
  await game.run([{ code: 'items', p: { kind: 'items', item: 2, op: 'add', n: 1 } }], { eventId: id }).done
  assert.equal(game.activePage(event, id), 0)
  await game.run([{ code: 'switch', p: { id: 1, value: 'on' } }, { code: 'selfSwitch', p: { ch: 'A', value: 'on' } }], { eventId: id }).done
  assert.equal(game.activePage(event, id), 1)
  await game.run([{ code: 'items', p: { kind: 'items', item: 2, op: 'all' } }], { eventId: id }).done
  assert.equal(game.activePage(event, id), 0)
  assert.deepEqual(errors, [])
})

test('S01-INT-03 · fórmula inválida informada por evento sin gastar MP ni dañar enemigos', async () => {
  const db = database()
  db.skills[0].damage[0].formula = 'globalThis.process.exit()'
  const { game, errors } = integratedGame(db)
  const a = game.party.spawnEnemy(1), b = game.party.spawnEnemy(1)
  const hp = a.hp, mp = game.party.battler(1).mp
  await game.run([{ code: 'useSkill', p: { skill: 1, user: 1, target: { enemyInstance: a.instanceId } } }], { eventId: 'evento-combate' }).done
  assert.equal(errors.length, 1)
  assert.match(errors[0], /Fórmula/)
  assert.equal(game.party.battler(1).mp, mp)
  assert.equal(game.party.enemyInstance(a.instanceId).hp, hp)
  assert.equal(game.party.enemyInstance(b.instanceId).hp, hp)
})

test('S01-INT-04 · objeto exclusivo de menú no puede ejecutarse desde un evento', async () => {
  const db = database()
  db.items[0].occasion = 'menu'
  const { game, errors } = integratedGame(db)
  const P = game.party
  P.gain('items', 1, 1)
  P.battler(1).hp = 30
  await game.run([{ code: 'useItem', p: { item: 1, target: 1 } }], { eventId: 'inventario' }).done
  assert.equal(P.count('items', 1), 1)
  assert.equal(P.battler(1).hp, 30)
  assert.deepEqual(errors, [])
  const r = P.useItem(1, 1, null, 'menu')
  assert.equal(r.ok, true)
  assert.equal(P.count('items', 1), 0)
  assert.equal(P.battler(1).hp, 55)
})


// S02: este host simula únicamente el View Model. El runtime de Three.js se prueba en el editor/Player.
function item3DGame() {
  const db = database()
  db.items[0].model = 'prim:box'
  db.items[1].model = 'prim:box'
  const held = new Set(), hidden = new Set(), actions = [], errors = []
  const world = { id: 'escena:objeto', itemId: 1 }
  const host = {
    error: (s) => errors.push(s),
    databaseItemOfEvent: (ref) => ref === world.id ? { ...world } : null,
    viewModelAttach: async ({ target, slot }) => { actions.push(['recoger', target, slot]); held.add(target); hidden.delete(target) },
    viewModelHeld: ({ node }) => held.has(node),
    viewModelStash: ({ target }) => { if (!held.has(target)) return null; held.delete(target); hidden.add(target); actions.push(['guardar', target]); return { id: target } },
    viewModelUnstash: async ({ target, slot }) => { if (!hidden.has(target)) return false; hidden.delete(target); held.add(target); actions.push(['sacar', target, slot]); return true },
    captureWorld: async () => ({ scene: 'escena', held: [...held], hidden: [...hidden] }),
    restoreWorld: async (w) => { held.clear(); hidden.clear(); for (const id of w.held || []) held.add(id); for (const id of w.hidden || []) hidden.add(id) },
  }
  const g = new Game({ database: db, host })
  g.saves.useStorage(new MemoryStorage())
  const action = (name, opts = {}) => EXEC.item3D.call(g, { action: name, ...opts }, {}, { eventId: world.id })
  return { g, db, world, held, hidden, actions, errors, action }
}

test('S02-3D-01 · el editor ofrece un solo comando declarativo con las cuatro acciones', async () => {
  const { COMMANDS, newCommand } = await import('../src/engine/runtime/events/commandDefs.js')
  const { resolveGraphic } = await import('../src/engine/runtime/database/models.js')
  const { g } = item3DGame()
  assert.ok(COMMANDS.item3D)
  assert.deepEqual(COMMANDS.item3D.params[0].options.map((x) => x[0]), ['pickup', 'use', 'store', 'take'])
  assert.equal(newCommand('item3D').p.action, 'pickup')
  assert.equal(resolveGraphic({ kind: 'item', itemId: 1 }, g.db).kind, 'box')
})

test('S02-3D-02 · recoger: modelo en mano, una unidad en inventario y referencia persistente', async () => {
  const { g, world, held, action } = item3DGame()
  assert.equal((await action('pickup')).ok, true)
  assert.equal(g.party.count('items', 1), 1)
  assert.equal(held.has(world.id), true)
  assert.deepEqual(g.state.dbItems3D[world.id], { itemId: 1, status: 'hand' })
  await assert.rejects(action('pickup'), /ya fue recogido/)
  assert.equal(g.party.count('items', 1), 1)
})

test('S02-3D-03 · guardar y sacar reutilizan el mismo modelo sin duplicar inventario', async () => {
  const { g, world, held, hidden, action } = item3DGame()
  await action('pickup')
  await action('store')
  assert.equal(hidden.has(world.id), true)
  assert.equal(held.has(world.id), false)
  assert.equal(g.party.count('items', 1), 1)
  await action('take', { slot: 'left' })
  assert.equal(held.has(world.id), true)
  assert.equal(g.party.count('items', 1), 1)
  assert.equal(g.state.dbItems3D[world.id].status, 'hand')
})

test('S02-3D-04 · objeto consumible: usar aplica efecto, descuenta uno y oculta el modelo', async () => {
  const { g, world, held, hidden, action } = item3DGame()
  g.party.battler(1).hp = 40
  await action('pickup')
  const r = await action('use', { target: 1 })
  assert.equal(r.ok, true)
  assert.equal(g.party.battler(1).hp, 65)
  assert.equal(g.party.count('items', 1), 0)
  assert.equal(held.has(world.id), false)
  assert.equal(hidden.has(world.id), true)
  assert.equal(g.state.dbItems3D[world.id].status, 'consumed')
})

test('S02-3D-05 · objeto no consumible conserva el modelo en mano y la cantidad', async () => {
  const { g, db, world, held, action } = item3DGame()
  world.itemId = 2
  g.db.items[1].scope = 'none'
  g.db.items[1].effects = []
  await action('pickup')
  assert.equal((await action('use')).ok, true)
  assert.equal(g.party.count('items', 2), 1)
  assert.equal(held.has(world.id), true)
  assert.equal(g.state.dbItems3D[world.id].status, 'hand')
})

test('S02-3D-06 · uso rechazado no consume ni retira el modelo 3D', async () => {
  const { g, db, world, held, action } = item3DGame()
  g.db.items[0].occasion = 'menu'
  await action('pickup')
  const r = await action('use', { target: 1 })
  assert.equal(r.ok, false)
  assert.equal(g.party.count('items', 1), 1)
  assert.equal(held.has(world.id), true)
  assert.equal(g.state.dbItems3D[world.id].status, 'hand')
})

test('S02-3D-07 · inventario lleno o referencia inexistente no recoge ni modifica recursos', async () => {
  const { g, world, held, action } = item3DGame()
  g.party.gain('items', 1, 5)
  await assert.rejects(action('pickup'), /No cabe otro/)
  assert.equal(held.has(world.id), false)
  assert.equal(g.state.dbItems3D?.[world.id], undefined)
  assert.equal(g.party.count('items', 1), 5)
  await assert.rejects(action('pickup', { node: 'fantasma' }), /No existe el evento/)
  assert.equal(g.party.count('items', 1), 5)
})

test('S02-3D-08 · guardado y carga conservan ubicación lógica e inventario del objeto', async () => {
  const { g, world, held, hidden, action } = item3DGame()
  await action('pickup')
  await action('store')
  assert.equal(await g.saves.save(1), true)
  await action('take')
  g.party.gain('items', 1, -1)
  assert.equal(await g.saves.load(1), true)
  assert.deepEqual(g.state.dbItems3D[world.id], { itemId: 1, status: 'stored' })
  assert.equal(g.party.count('items', 1), 1)
  assert.equal(hidden.has(world.id), true)
  assert.equal(held.has(world.id), false)
})

test('S02-3D-09 · no permite guardar sin tener el objeto en la mano', async () => {
  const { g, world, action } = item3DGame()
  await action('pickup')
  await action('store')
  await assert.rejects(action('store'), /no está en la mano/)
  assert.equal(g.state.dbItems3D[world.id].status, 'stored')
  assert.equal(g.party.count('items', 1), 1)
})

test('S02-3D-10 · el comando corre dentro de un evento, sin escribir scripts', async () => {
  const { g, world, held, errors } = item3DGame()
  await g.run([{ code: 'item3D', p: { action: 'pickup', slot: 'right' } }], { eventId: world.id }).done
  assert.deepEqual(errors, [])
  assert.equal(g.party.count('items', 1), 1)
  assert.equal(held.has(world.id), true)
})

test('S02-3D-11 · fórmula fallida no consume ni oculta el objeto de la mano', async () => {
  const { g, world, held, action } = item3DGame()
  g.db.items[0].damage = [{ type: 'hp', formula: 'globalThis.process.exit()', variance: 0 }]
  await action('pickup')
  const hp = g.party.battler(1).hp
  await assert.rejects(action('use', { target: 1 }), /Fórmula/)
  assert.equal(g.party.count('items', 1), 1)
  assert.equal(g.party.battler(1).hp, hp)
  assert.equal(held.has(world.id), true)
  assert.equal(g.state.dbItems3D[world.id].status, 'hand')
})

test('S02-3D-12 · registros anteriores y partidas sin objetos 3D siguen funcionando', async () => {
  const { g, action } = item3DGame()
  assert.equal(g.state.dbItems3D, undefined)
  await g.saves.save(1)
  await action('pickup')
  assert.equal(g.party.count('items', 1), 1)
  await g.saves.load(1)
  assert.equal(g.state.dbItems3D, undefined)
  assert.equal(g.party.count('items', 1), 0)
})

// S03: usa la misma Party y el View Model de S02. El host simulado no dibuja modelos reales.
function weapon3DGame() {
  const db = database()
  db.weapons = [
    { id: 1, name: 'Espada', etype: 1, atk: 8, actionSkill: 2, traits: [], model: 'prim:box' },
    { id: 2, name: 'Maza', etype: 1, atk: 4, actionSkill: 0, traits: [], model: 'prim:box' },
  ]
  db.skills.push({ id: 2, name: 'Golpe de espada', scope: 'enemy', mpCost: 5,
    damage: [{ type: 'hp', formula: 'a.atk * 2 - b.def', variance: 0, element: 0 }],
    effects: [], message: '{a} usa {name}.' })
  const world = { 'escena:espada': 1, 'escena:maza': 2 }
  const held = new Set(), stored = new Set(), actions = [], errors = []
  const host = {
    error: (message) => errors.push(message),
    databaseWeaponOfEvent: (ref) => world[ref] ? { id: ref, weaponId: world[ref] } : null,
    viewModelAttach: async ({ target, slot }) => { held.add(target); stored.delete(target); actions.push(['equipar', target, slot]) },
    viewModelStash: ({ target }) => { if (!held.has(target)) return null; held.delete(target); stored.add(target); actions.push(['guardar', target]); return { id: target } },
    viewModelUnstash: async ({ target, slot }) => { if (!stored.has(target)) return false; stored.delete(target); held.add(target); actions.push(['sacar', target, slot]); return true },
    captureWorld: async () => ({ held: [...held], stored: [...stored] }),
    restoreWorld: async (value) => { held.clear(); stored.clear(); for (const id of value.held || []) held.add(id); for (const id of value.stored || []) stored.add(id) },
  }
  const g = new Game({ database: db, host })
  g.saves.useStorage(new MemoryStorage())
  const action = (name, opts = {}) => EXEC.weapon3D.call(g, { actor: 1, action: name, ...opts }, {}, { eventId: 'escena:espada' })
  return { g, db, world, held, stored, actions, errors, action }
}

test('S03-WPN-01 · Database expone acción y comando declarativo sin scripts', async () => {
  const { COMMANDS, newCommand } = await import('../src/engine/runtime/events/commandDefs.js')
  const { resolveGraphic } = await import('../src/engine/runtime/database/models.js')
  const { g } = weapon3DGame()
  assert.equal(g.db.weapons[0].actionSkill, 2)
  assert.equal(COMMANDS.weapon3D.label, 'Arma equipada 3D')
  assert.deepEqual(COMMANDS.weapon3D.params[0].options.map((x) => x[0]), ['equip', 'use', 'unequip'])
  assert.equal(newCommand('weapon3D').p.action, 'equip')
  assert.equal(resolveGraphic({ kind: 'weapon', weaponId: 1 }, g.db).kind, 'box')
})

test('S03-WPN-02 · equipar mueve inventario a equipo y representa el arma en la mano', async () => {
  const { g, held, action } = weapon3DGame()
  g.party.gain('weapons', 1, 1)
  const result = await action('equip')
  assert.equal(result.ok, true)
  assert.equal(g.party.actor(1).equips[0], 1)
  assert.equal(g.party.count('weapons', 1), 0)
  assert.equal(held.has('escena:espada'), true)
  assert.deepEqual(g.state.dbWeapons3D['escena:espada'], { actorId: 1, weaponId: 1, status: 'hand', slot: 'right' })
  assert.equal(g.party.battler(1).atk, 20)
})

test('S03-WPN-03 · la acción equipada usa la habilidad declarada aunque no se haya aprendido', async () => {
  const { g, action } = weapon3DGame()
  g.party.gain('weapons', 1)
  assert.equal(g.party.skillIds(g.party.actor(1)).includes(2), false)
  await action('equip')
  assert.equal(g.party.skillIds(g.party.actor(1)).includes(2), true)
  const enemy = g.party.spawnEnemy(1)
  const result = await action('use', { target: { enemyInstance: enemy.instanceId } })
  assert.equal(result.ok, true)
  assert.equal(g.party.battler(1).mp, 25)
  assert.equal(enemy.hp, 60 - (20 * 2 - 2))
  assert.equal(result.hits.length, 1)
})

test('S03-WPN-04 · sin arma equipada no consume MP ni modifica el enemigo', () => {
  const { g } = weapon3DGame()
  const enemy = g.party.spawnEnemy(1), mp = g.party.battler(1).mp
  const result = g.party.weaponAction(1, { enemyInstance: enemy.instanceId })
  assert.equal(result.ok, false)
  assert.equal(enemy.hp, 60)
  assert.equal(g.party.battler(1).mp, mp)
})

test('S03-WPN-05 · no equipa un arma ausente ni muestra su modelo', async () => {
  const { g, held, action } = weapon3DGame()
  await assert.rejects(action('equip'), /No tienes/)
  assert.equal(g.party.actor(1).equips[0], 0)
  assert.equal(held.size, 0)
})

test('S03-WPN-06 · desequipar devuelve el arma al inventario y oculta el modelo', async () => {
  const { g, held, stored, action } = weapon3DGame()
  g.party.gain('weapons', 1)
  await action('equip')
  await action('unequip')
  assert.equal(g.party.actor(1).equips[0], 0)
  assert.equal(g.party.count('weapons', 1), 1)
  assert.equal(held.size, 0)
  assert.equal(stored.has('escena:espada'), true)
  assert.equal(g.party.skillIds(g.party.actor(1)).includes(2), false)
  assert.equal(g.state.dbWeapons3D['escena:espada'].status, 'stored')
})

test('S03-WPN-07 · volver a equipar usa el mismo modelo, no duplica inventario', async () => {
  const { g, held, stored, actions, action } = weapon3DGame()
  g.party.gain('weapons', 1)
  await action('equip')
  await action('unequip')
  await action('equip', { slot: 'left' })
  assert.equal(g.party.count('weapons', 1), 0)
  assert.equal(held.has('escena:espada'), true)
  assert.equal(stored.size, 0)
  assert.deepEqual(actions.at(-1), ['sacar', 'escena:espada', 'left'])
  assert.equal(g.state.dbWeapons3D['escena:espada'].slot, 'left')
})

test('S03-WPN-08 · reemplazar arma devuelve la anterior, guarda su modelo y no duplica', async () => {
  const { g, held, stored, action } = weapon3DGame()
  g.party.gain('weapons', 1)
  g.party.gain('weapons', 2)
  await action('equip')
  await action('equip', { node: 'escena:maza' })
  assert.equal(g.party.actor(1).equips[0], 2)
  assert.equal(g.party.count('weapons', 1), 1)
  assert.equal(g.party.count('weapons', 2), 0)
  assert.equal(stored.has('escena:espada'), true)
  assert.equal(held.has('escena:maza'), true)
  assert.equal(g.party.weaponAction(1).ok, false)
})

test('S03-WPN-09 · fórmulas inválidas no gastan MP ni causan daños', async () => {
  const { g, action } = weapon3DGame()
  g.party.gain('weapons', 1)
  await action('equip')
  g.db.skills.find((r) => r.id === 2).damage[0].formula = 'globalThis.process.exit()'
  const enemy = g.party.spawnEnemy(1), mp = g.party.battler(1).mp
  await assert.rejects(action('use', { target: { enemyInstance: enemy.instanceId } }), /Fórmula/)
  assert.equal(enemy.hp, 60)
  assert.equal(g.party.battler(1).mp, mp)
})

test('S03-WPN-10 · partidas antiguas sin acción de arma mantienen estadísticas y equipo', () => {
  const { party, db } = sample()
  assert.equal(party.rec('weapons', 1).actionSkill, undefined)
  party.gain('weapons', 1)
  party.equip(1, 1, 1)
  assert.equal(party.battler(1).atk, 20)
  assert.equal(party.weaponAction(1).ok, false)
  const normalized = normalizeDatabase(db)
  assert.equal(normalized.weapons[0].actionSkill, 0)
})

test('S03-WPN-11 · guardado y carga restauran arma, MP e identidad de evento', async () => {
  const { g, held, stored, action } = weapon3DGame()
  g.party.gain('weapons', 1)
  await action('equip')
  await action('use', { target: { enemy: 1 } })
  const mp = g.party.battler(1).mp
  assert.equal(await g.saves.save(1), true)
  await action('unequip')
  assert.equal(await g.saves.load(1), true)
  assert.equal(g.party.actor(1).equips[0], 1)
  assert.equal(g.party.battler(1).mp, mp)
  assert.deepEqual(g.state.dbWeapons3D['escena:espada'], { actorId: 1, weaponId: 1, status: 'hand', slot: 'right' })
  assert.equal(held.has('escena:espada'), true)
  assert.equal(stored.has('escena:espada'), false)
})

test('S03-WPN-12 · evento real ejecuta equipar, acción y desequipar sin código JS', async () => {
  const { g, errors } = weapon3DGame()
  g.party.gain('weapons', 1)
  const enemy = g.party.spawnEnemy(1)
  const cmd = (action, extra = {}) => ({ code: 'weapon3D', p: { action, actor: 1, node: 'escena:espada', ...extra } })
  await g.run([cmd('equip'), cmd('use', { target: { enemyInstance: enemy.instanceId } }), cmd('unequip')], { eventId: 'escena:espada' }).done
  assert.deepEqual(errors, [])
  assert.equal(enemy.hp, 22)
  assert.equal(g.party.actor(1).equips[0], 0)
  assert.equal(g.party.count('weapons', 1), 1)
})

test('S03-WPN-13 · sin View Model el equipo no cambia', async () => {
  const { g, action } = weapon3DGame()
  g.party.gain('weapons', 1)
  delete g.host.viewModelAttach
  await assert.rejects(action('equip'), /View Model/)
  assert.equal(g.party.count('weapons', 1), 1)
  assert.equal(g.party.actor(1).equips[0], 0)
})

test('S03-WPN-14 · el arma con acción sellada no puede ejecutarla', async () => {
  const { g, action } = weapon3DGame()
  g.party.gain('weapons', 1)
  await action('equip')
  g.party.actor(1).extraTraits.push({ code: 'sealSkill', skill: 2 })
  assert.equal(g.party.skillIds(g.party.actor(1)).includes(2), false)
  assert.throws(() => g.party.weaponAction(1, { enemy: 1 }), /no conoce/)
})

test('S03-WPN-15 · acción para enemigos sin objetivo se rechaza sin daño propio ni consumo', async () => {
  const { g, action } = weapon3DGame()
  g.party.gain('weapons', 1)
  await action('equip')
  const beforeHp = g.party.battler(1).hp, beforeMp = g.party.battler(1).mp
  const result = await action('use')
  assert.equal(result.ok, false)
  assert.match(result.text, /enemigo válido/)
  assert.equal(g.party.battler(1).hp, beforeHp)
  assert.equal(g.party.battler(1).mp, beforeMp)
})

test('S03-WPN-16 · acción para enemigos no permite disparar contra un personaje', async () => {
  const { g, action } = weapon3DGame()
  g.party.gain('weapons', 1)
  await action('equip')
  const result = await action('use', { targetType: 'actor', targetActor: 1 })
  assert.equal(result.ok, false)
  assert.equal(g.party.battler(1).hp, 100)
  assert.equal(g.party.battler(1).mp, 30)
})

test('S03-WPN-17 · el editor permite seleccionar un enemigo de Database como objetivo', async () => {
  const { g, action } = weapon3DGame()
  g.party.gain('weapons', 1)
  await action('equip')
  const result = await action('use', { targetType: 'enemy', targetEnemy: 1 })
  assert.equal(result.ok, true)
  assert.equal(g.party.enemy(1).hp, 22)
  assert.equal(g.party.battler(1).mp, 25)
})

test('S03-WPN-18 · el arma inicial se muestra sin exigir otro ejemplar en inventario', async () => {
  const { g, action } = weapon3DGame()
  g.party.actor(1).equips[0] = 1
  assert.equal(g.party.count('weapons', 1), 0)
  assert.equal((await action('equip')).ok, true)
  assert.equal(g.party.count('weapons', 1), 0)
  assert.equal(g.party.actor(1).equips[0], 1)
})

// S04: la presentación es opcional. Estos dobles comprueban cuándo se llama al motor real;
// la reproducción visual del modelo y el sonido se validan después en el editor/Player.
test('S04-PRES-01 · Database permite configurar animación y sonido opcionales para objetos y armas', () => {
  const db = normalizeDatabase(database())
  const item = newRecord('items', 9), weapon = newRecord('weapons', 9)
  assert.equal(item.actionAnimation, '')
  assert.equal(item.actionSound, '')
  assert.equal(weapon.actionAnimation, '')
  assert.equal(weapon.actionSound, '')
  assert.equal(db.items[0].actionAnimation, '')
  assert.equal(db.weapons[0].actionSound, '')
})

test('S04-PRES-02 · un consumible con animación conserva el modelo hasta que termina el clip', async () => {
  const { g, action, held, world } = item3DGame()
  g.db.items[0].actionAnimation = 'Beber'
  g.db.items[0].actionSound = 'pocion.wav'
  const calls = []
  let finish
  g.host.animationPlay = (target, clip, options) => {
    calls.push(['anim', target, clip, options.loop, held.has(target)])
    return { done: new Promise((resolve) => { finish = resolve }) }
  }
  g.host.audio = { play: (clip, options) => { calls.push(['sound', clip, options.group]); return { done: Promise.resolve() } } }
  await action('pickup')
  g.party.battler(1).hp = 40
  const pending = action('use', { target: 1 })
  await Promise.resolve()
  assert.equal(g.party.battler(1).hp, 65, 'El efecto ya es válido, no depende de la animación')
  assert.equal(g.party.count('items', 1), 0)
  assert.equal(held.has(world.id), true, 'El modelo sigue visible mientras se reproduce Beber')
  assert.deepEqual(calls, [['anim', world.id, 'Beber', false, true], ['sound', 'pocion.wav', 'sfx']])
  finish()
  assert.equal((await pending).ok, true)
  assert.equal(held.has(world.id), false)
  assert.equal(g.state.dbItems3D[world.id].status, 'consumed')
})

test('S04-PRES-03 · sin animación ni sonido el objeto conserva el uso inmediato anterior', async () => {
  const { g, action, world, held } = item3DGame()
  let attempts = 0
  g.host.animationPlay = () => { attempts++; throw new Error('No debe llamarse') }
  g.host.audio = { play: () => { attempts++; throw new Error('No debe llamarse') } }
  await action('pickup')
  assert.equal((await action('use', { target: 1 })).ok, true)
  assert.equal(attempts, 0)
  assert.equal(held.has(world.id), false)
})

test('S04-PRES-04 · si falta el sistema de audio la acción no pierde inventario ni efectos', async () => {
  const { g, action } = item3DGame()
  g.db.items[0].actionSound = 'pocion'
  await action('pickup')
  g.party.battler(1).hp = 50
  assert.equal((await action('use', { target: 1 })).ok, true)
  assert.equal(g.party.battler(1).hp, 75)
  assert.equal(g.party.count('items', 1), 0)
})

test('S04-PRES-05 · una animación inexistente no cancela una acción ya ejecutada', async (t) => {
  const { g, action, world } = item3DGame()
  const log = [], userOutput = []
  t.mock.method(console, 'warn', (message) => log.push(message))
  g.host.log = (message) => userOutput.push(message)
  g.host.animationPlay = () => { throw new Error('Clip inexistente') }
  g.db.items[0].actionAnimation = 'NoExiste'
  await action('pickup')
  assert.equal((await action('use', { target: 1 })).ok, true)
  assert.equal(g.state.dbItems3D[world.id].status, 'consumed')
  assert.match(log[0], /NoExiste|Clip inexistente|Animación/)
  assert.deepEqual(userOutput, [])
})

test('S04-PRES-06 · un error asíncrono de audio no produce un rechazo sin manejar', async (t) => {
  const { g, action } = item3DGame()
  const log = [], userOutput = []
  t.mock.method(console, 'warn', (message) => log.push(message))
  g.host.log = (message) => userOutput.push(message)
  g.db.items[0].actionSound = 'defectuoso'
  g.host.audio = { play: () => ({ done: Promise.reject(new Error('Audio sin decodificar')) }) }
  await action('pickup')
  assert.equal((await action('use', { target: 1 })).ok, true)
  await Promise.resolve()
  assert.match(log[0], /Audio sin decodificar/)
  assert.deepEqual(userOutput, [])
})

test('S04-PRES-07 · un objeto rechazado no reproduce animación ni sonido', async () => {
  const { g, action, world } = item3DGame()
  let played = 0
  g.db.items[0].occasion = 'menu'
  g.db.items[0].actionAnimation = 'Beber'
  g.db.items[0].actionSound = 'pocion'
  g.host.animationPlay = () => { played++ }
  g.host.audio = { play: () => { played++ } }
  await action('pickup')
  assert.equal((await action('use', { target: 1 })).ok, false)
  assert.equal(played, 0)
  assert.equal(g.state.dbItems3D[world.id].status, 'hand')
})

test('S04-PRES-08 · una fórmula errónea no reproduce presentación ni consume el objeto', async () => {
  const { g, action } = item3DGame()
  let played = 0
  g.db.items[0].actionAnimation = 'Beber'
  g.db.items[0].damage = [{ type: 'hp', formula: 'process.exit()', variance: 0 }]
  g.host.animationPlay = () => { played++ }
  await action('pickup')
  await assert.rejects(action('use', { target: 1 }), /Fórmula/)
  assert.equal(played, 0)
  assert.equal(g.party.count('items', 1), 1)
})

test('S04-PRES-09 · el objeto no consumible anima sin esperar ni retirarse de la mano', async () => {
  const { g, action, world, held } = item3DGame()
  g.db.items[1].scope = 'none'; g.db.items[1].effects = []
  g.db.items[1].actionAnimation = 'Abrir'
  world.itemId = 2
  const played = []
  g.host.animationPlay = (target, clip) => { played.push([target, clip]); return { done: new Promise(() => {}) } }
  await action('pickup')
  assert.equal((await action('use')).ok, true)
  assert.deepEqual(played, [[world.id, 'Abrir']])
  assert.equal(held.has(world.id), true)
  assert.equal(g.party.count('items', 2), 1)
})

test('S04-PRES-10 · la acción de arma reproduce animación y sonido si la habilidad se ejecutó', async () => {
  const { g, action } = weapon3DGame()
  g.db.weapons[0].actionAnimation = 'Golpear'
  g.db.weapons[0].actionSound = 'espada.wav'
  const calls = []
  g.host.animationPlay = (node, clip, options) => { calls.push(['anim', node, clip, options.loop]); return { done: Promise.resolve() } }
  g.host.audio = { play: (clip, options) => { calls.push(['sound', clip, options.group]); return { done: Promise.resolve() } } }
  g.party.gain('weapons', 1)
  await action('equip')
  const r = await action('use', { targetType: 'enemy', targetEnemy: 1 })
  assert.equal(r.ok, true)
  assert.deepEqual(calls, [['anim', 'escena:espada', 'Golpear', false], ['sound', 'espada.wav', 'sfx']])
  assert.equal(g.party.battler(1).mp, 25)
})

test('S04-PRES-11 · un ataque de arma rechazado no reproduce presentación', async () => {
  const { g, action } = weapon3DGame()
  g.db.weapons[0].actionAnimation = 'Golpear'
  g.db.weapons[0].actionSound = 'espada'
  let played = 0
  g.host.animationPlay = () => { played++ }
  g.host.audio = { play: () => { played++ } }
  g.party.gain('weapons', 1)
  await action('equip')
  assert.equal((await action('use')).ok, false)
  assert.equal(played, 0)
  assert.equal(g.party.battler(1).mp, 30)
})

test('S04-PRES-12 · arma sin modelo visible puede reproducir sonido sin fallar por animación', async () => {
  const { g, action } = weapon3DGame()
  g.db.weapons[0].actionAnimation = 'Golpear'
  g.db.weapons[0].actionSound = 'espada.wav'
  let anims = 0, sounds = 0
  g.host.animationPlay = () => { anims++ }
  g.host.audio = { play: () => { sounds++; return { done: Promise.resolve() } } }
  g.party.actor(1).equips[0] = 1
  assert.equal((await action('use', { targetType: 'enemy', targetEnemy: 1 })).ok, true)
  assert.equal(anims, 0)
  assert.equal(sounds, 1)
})

test('S04-PRES-13 · una animación de arma inexistente no anula la habilidad válida', async (t) => {
  const { g, action } = weapon3DGame()
  g.db.weapons[0].actionAnimation = 'NoExiste'
  const log = [], userOutput = []
  t.mock.method(console, 'warn', (message) => log.push(message))
  g.host.log = (message) => userOutput.push(message)
  g.host.animationPlay = () => { throw new Error('Clip inexistente') }
  g.party.gain('weapons', 1)
  await action('equip')
  assert.equal((await action('use', { targetType: 'enemy', targetEnemy: 1 })).ok, true)
  assert.equal(g.party.battler(1).mp, 25)
  assert.match(log[0], /Clip inexistente/)
  assert.deepEqual(userOutput, [])
})

test('S04-PRES-14 · el evento real usa la configuración de Database sin scripts propios', async () => {
  const { g, action, errors } = weapon3DGame()
  g.db.weapons[0].actionAnimation = 'Golpear'
  const clips = []
  g.host.animationPlay = (_, clip) => { clips.push(clip); return { done: Promise.resolve() } }
  g.party.gain('weapons', 1)
  await action('equip')
  await g.run([{ code: 'weapon3D', p: { action: 'use', actor: 1, targetType: 'enemy', targetEnemy: 1 } }], { eventId: 'tecla:ataque' }).done
  assert.deepEqual(errors, [])
  assert.deepEqual(clips, ['Golpear'])
})

// S05 verifica la preparación del juego exportado. La ejecución 3D y el AppImage se comprueban en el equipo del usuario.
test('S05-EXP-01 · Build respeta escenas elegidas y orden inicial, sin incluir las excluidas', () => {
  const p = { scenes: [{ id: 'inicio' }, { id: 'fin' }, { id: 'borrador' }],
    build: { scenes: ['fin', 'inicio', 'eliminada'] }, game: { startScene: 'inicio' } }
  assert.deepEqual(buildSceneIds(p), ['fin', 'inicio'])
  assert.deepEqual(buildSceneIds({ ...p, build: null }), ['inicio', 'fin', 'borrador'])
})

test('S05-EXP-02 · carga modelos de eventos de Database incluso en páginas alternativas', () => {
  const db = database()
  db.items[0].model = 'modelo-pocion'
  db.weapons[0].model = 'modelo-espada'
  const objects = [{ type: 'event', props: { pages: [
    { graphic: { kind: 'none' } },
    { graphic: { kind: 'item', itemId: 1 } },
    { graphic: { kind: 'weapon', weaponId: 1 } },
  ] } }]
  assert.deepEqual([...modelIdsInScene(objects, db)].sort(), ['modelo-espada', 'modelo-pocion'])
})

test('S05-EXP-03 · incluye modelos de nodos, slots del jugador y prefabs usados', () => {
  const db = database()
  db.player.slots = [{ id: 'right', model: 'modelo-mano' }]
  const prefabs = [{ id: 'caja', objects: [{ modelId: 'modelo-prefab' }] }]
  const objects = [
    { type: 'model', modelId: 'modelo-escena' },
    { type: 'event', props: { pages: [{ graphic: { kind: 'prefab', prefabId: 'caja' } }] } },
  ]
  assert.deepEqual([...modelIdsInScene(objects, db, prefabs)].sort(), [
    'modelo-escena', 'modelo-mano', 'modelo-prefab',
  ])
})

test('S05-EXP-04 · recursos de dos escenas disponibles permiten preparar el paquete', () => {
  const db = database()
  db.items[0].model = 'pocion.glb'
  db.weapons[0].model = 'espada.glb'
  const meta = { database: db, models: [{ id: 'pocion.glb' }, { id: 'espada.glb' }] }
  const scenes = [
    { id: 'start', name: 'Inicio', data: { objects: [{ type: 'event', props: { pages: [{ graphic: { kind: 'item', itemId: 1 } }] } }] } },
    { id: 'end', name: 'Final', data: { objects: [{ type: 'event', props: { pages: [{ graphic: { kind: 'weapon', weaponId: 1 } }] } }] } },
  ]
  const files = new Map([['pocion.glb', new Uint8Array([1])], ['espada.glb', new Uint8Array([2])]])
  assert.equal(validateBuildSources(meta, scenes, files), undefined)
})

test('S05-EXP-05 · un modelo ausente de la escena secundaria bloquea exportación', () => {
  const db = database()
  db.weapons[0].model = 'espada.glb'
  const meta = { database: db, models: [{ id: 'espada.glb' }] }
  const scenes = [{ id: 'end', name: 'Final', data: { objects: [
    { type: 'event', props: { pages: [{ graphic: { kind: 'weapon', weaponId: 1 } }] } },
  ] } }]
  assert.throws(() => validateBuildSources(meta, scenes, new Map()), /Falta el archivo del modelo.*Final/)
  assert.throws(() => validateBuildSources({ ...meta, models: [] }, scenes, new Map()), /no existe en Assets/)
})

test('S05-EXP-06 · no exporta una escena que no se pudo guardar ni una lista vacía', () => {
  assert.throws(() => validateBuildSources({}, [], new Map()), /No hay ninguna escena/)
  assert.throws(() => validateBuildSources({ models: [] }, [{ id: 'x', name: 'Inicio', data: null }], new Map()), /Falta el contenido/)
})

test('S05-EXP-07 · proyectos antiguos con primitivas no exigen archivos GLB', () => {
  const db = database()
  db.items[0].model = 'prim:box'
  db.weapons[0].model = null
  const meta = { database: db, models: [] }
  const scenes = [{ id: 's', name: 'Escena', data: { objects: [
    { type: 'event', props: { pages: [{ graphic: { kind: 'item', itemId: 1 } }] } },
  ] } }]
  assert.deepEqual([...modelIdsInScene(scenes[0].data.objects, db)], [])
  assert.equal(validateBuildSources(meta, scenes, new Map()), undefined)
})

test('S05-EXP-08 · referencias prefab circulares no bloquean la preparación', () => {
  const prefabs = [
    { id: 'a', objects: [{ props: { model: 'prefab:b' } }, { modelId: 'modelo-a' }] },
    { id: 'b', objects: [{ props: { model: 'prefab:a' } }, { modelId: 'modelo-b' }] },
  ]
  assert.deepEqual([...modelIdsInScene([
    { type: 'event', props: { pages: [{ graphic: { kind: 'prefab', prefabId: 'a' } }] } },
  ], database(), prefabs)].sort(), ['modelo-a', 'modelo-b'])
})

// Señales nativas: Game y Party reales. La simulación de manos sigue siendo una
// prueba de contrato; colisiones, animaciones y entrada se validan en el Player.
const flushNative = () => new Promise((resolve) => setImmediate(resolve))
function signalGame(db = database()) {
  const observed = [], pages = [], errors = []
  const host = {
    signalEvents: (name, data) => pages.push([name, structuredClone(data)]),
    error: (message) => errors.push(message),
  }
  const game = new Game({ database: db, host })
  for (const name of ['item.picked_up', 'object.grabbed', 'object.dropped', 'object.thrown',
    'inventory.item_added', 'inventory.item_removed', 'equipment.equipped', 'equipment.unequipped']) {
    game.on(name, (data) => observed.push([name, structuredClone(data)]))
  }
  return { game, observed, pages, errors }
}

test('SIG-01 · las ocho señales comparten Game.signal, listeners y páginas', async () => {
  const { game, observed, pages } = signalGame()
  const names = ['item.picked_up', 'object.grabbed', 'object.dropped', 'object.thrown',
    'inventory.item_added', 'inventory.item_removed', 'equipment.equipped', 'equipment.unequipped']
  for (const name of names) {
    const waiting = game.waitSignal(name)
    game._nativeSignal(name, { objectId: 'node-1' })
    assert.deepEqual(await waiting, { objectId: 'node-1' })
  }
  await flushNative()
  assert.deepEqual(observed.map((e) => e[0]), names)
  assert.deepEqual(pages.map((e) => e[0]), names)
})

test('SIG-02 · inventario publica aumentos y disminuciones exactas', async () => {
  const { game, observed } = signalGame()
  const P = game.party
  P.gain('items', 1, 3); P.gain('items', 1, -2)
  await flushNative()
  assert.deepEqual(observed, [
    ['inventory.item_added', { kind: 'items', itemId: 1, before: 0, after: 3, delta: 3 }],
    ['inventory.item_removed', { kind: 'items', itemId: 1, before: 3, after: 1, delta: -2 }],
  ])
})

test('SIG-03 · cantidades limitadas y sin cambios no inventan señales', async () => {
  const { game, observed } = signalGame()
  const P = game.party
  P.gain('items', 1, 99); P.gain('items', 1, 5); P.gain('items', 1, 0)
  P.gain('items', 1, -99); P.setCount('items', 1, 0)
  await flushNative()
  assert.deepEqual(observed, [
    ['inventory.item_added', { kind: 'items', itemId: 1, before: 0, after: 5, delta: 5 }],
    ['inventory.item_removed', { kind: 'items', itemId: 1, before: 5, after: 0, delta: -5 }],
  ])
})

test('SIG-04 · setCount y clearInventory usan deltas reales por tipo', async () => {
  const { game, observed } = signalGame()
  const P = game.party
  P.setCount('items', 1, 2); P.setCount('weapons', 1, 3)
  P.setCount('items', 1, 1); P.clearInventory()
  await flushNative()
  assert.deepEqual(observed.map(([name, data]) => [name, data.kind, data.delta]), [
    ['inventory.item_added', 'items', 2],
    ['inventory.item_added', 'weapons', 3],
    ['inventory.item_removed', 'items', -1],
    ['inventory.item_removed', 'items', -1],
    ['inventory.item_removed', 'weapons', -3],
  ])
})

test('SIG-05 · equipar, cambiar y desequipar notifican cantidades y ranura', async () => {
  const db = database()
  db.weapons.push({ id: 2, name: 'Arco', etype: 1, atk: 3 })
  const { game, observed } = signalGame(db), P = game.party
  P.gain('weapons', 1); P.gain('weapons', 2)
  await flushNative(); observed.length = 0
  P.equip(1, 1, 1)
  P.equip(1, 1, 2)
  P.equip(1, 1, 0)
  await flushNative()
  assert.deepEqual(observed.map(([name, d]) => [name, d.itemId]), [
    ['inventory.item_removed', 1], ['equipment.equipped', 1],
    ['inventory.item_removed', 2], ['inventory.item_added', 1], ['equipment.unequipped', 1], ['equipment.equipped', 2],
    ['inventory.item_added', 2], ['equipment.unequipped', 2],
  ])
  assert.equal(P.count('weapons', 1), 1)
  assert.equal(P.count('weapons', 2), 1)
  assert.equal(P.actor(1).equips[0], 0)
  assert.equal(observed.at(-1)[1].equipSlot, 1)
  assert.equal(observed.at(-1)[1].actorId, 1)
})

test('SIG-06 · reequipar igual o solicitar equipo inválido no emite nada', async () => {
  const { game, observed } = signalGame(), P = game.party
  P.gain('weapons', 1)
  P.equip(1, 1, 1)
  await flushNative(); observed.length = 0
  P.equip(1, 1, 1)
  assert.throws(() => P.equip(1, 2, 1), /No tienes/)
  assert.throws(() => P.equip(1, 1, 999), /No existe/)
  assert.deepEqual(observed, [])
})

test('SIG-07 · restauración de guardado no emite cambios falsos', async () => {
  const { game, observed } = signalGame(), P = game.party
  game.saves.useStorage(new MemoryStorage())
  P.gain('items', 1, 2); P.gain('weapons', 1); P.equip(1, 1, 1)
  await game.saves.save(1)
  P.clearInventory(); P.equip(1, 1, 0)
  await flushNative(); observed.length = 0
  assert.equal(await game.saves.load(1), true)
  await flushNative()
  assert.deepEqual(observed, [])
  assert.equal(P.count('items', 1), 2)
  assert.equal(P.actor(1).equips[0], 1)
})

test('SIG-08 · espera de señal, página y listener fallido sin revertir inventario', async () => {
  const { game, pages, errors } = signalGame()
  game.on('inventory.item_added', () => { throw new Error('listener de prueba') })
  const promise = game.waitSignal('inventory.item_added')
  game.party.gain('items', 1)
  assert.equal((await promise).delta, 1)
  await flushNative()
  assert.equal(game.party.count('items', 1), 1)
  assert.equal(pages[0][0], 'inventory.item_added')
  assert.equal(errors.length, 1)
})

test('SIG-09 · transacción de recogida informa al final con el estado completo', async () => {
  const db = database()
  const world = { id: 'escena:medicina', itemId: 1 }
  const { game, pages } = signalGame(db)
  const stateSeen = []
  game.host.databaseItemOfEvent = () => world
  game.host.viewModelAttach = async () => { game._nativeSignal('object.grabbed', { objectId: world.id, slot: 'right' }) }
  game.host.signalEvents = (name) => {
    pages.push([name]); stateSeen.push([name, game.party.count('items', 1), game.state.dbItems3D?.[world.id]?.status])
  }
  await game.exec({ code: 'item3D', p: { action: 'pickup' } }, { eventId: world.id })
  assert.deepEqual(stateSeen, [
    ['object.grabbed', 1, 'hand'],
    ['inventory.item_added', 1, 'hand'],
    ['item.picked_up', 1, 'hand'],
  ])
})

test('SIG-10 · recogida rechazada y la segunda recogida no publican señales', async () => {
  const { game, observed } = signalGame()
  const world = { id: 'escena:medicina', itemId: 1 }
  game.host.databaseItemOfEvent = () => world
  game.host.viewModelAttach = async () => { game._nativeSignal('object.grabbed', { objectId: world.id }) }
  const ctx = { eventId: world.id }
  await game.exec({ code: 'item3D', p: { action: 'pickup' } }, ctx)
  await flushNative(); observed.length = 0
  await assert.rejects(game.exec({ code: 'item3D', p: { action: 'pickup' } }, ctx), /ya fue recogido/)
  assert.deepEqual(observed, [])
})

test('SIG-11 · si falla una operación declarativa las señales en cola no se publican', async () => {
  const { game, observed } = signalGame()
  await assert.rejects(game._nativeTransaction(async () => {
    game._nativeSignal('object.grabbed', { objectId: 'objeto' })
    throw new Error('no se pudo completar')
  }), /no se pudo completar/)
  await flushNative()
  assert.deepEqual(observed, [])
})

test('SIG-12 · señales personalizadas conservan Game.signal y los nombres internos siguen protegidos', async () => {
  const { game, pages } = signalGame()
  await game.signal('mi.evento', { cantidad: 4 })
  assert.deepEqual(pages.at(-1), ['mi.evento', { cantidad: 4 }])
  await assert.rejects(game.signal('drop', {}), /evento interno/)
})

test('SIG-13 · las señales nativas no actúan durante una reconstrucción de manos', async () => {
  const { game, observed } = signalGame()
  game._nativeSignalsMuted = true
  game._nativeSignal('object.grabbed', { objectId: 'resucitado' })
  game._nativeSignalsMuted = false
  await flushNative()
  assert.deepEqual(observed, [])
})

test('SIG-14 · usar un consumible publica solo el delta de inventario', async () => {
  const { game, observed } = signalGame()
  game.party.gain('items', 1, 1)
  await flushNative(); observed.length = 0
  const result = game.party.useItem(1, 1, null, 'event')
  assert.equal(result.ok, true)
  await flushNative()
  assert.deepEqual(observed, [['inventory.item_removed',
    { kind: 'items', itemId: 1, before: 1, after: 0, delta: -1 }]])
})


// Física Database/Eventos: reglas verificables sin Jolt instalado.
// La simulación real de cuerpos y colisiones se comprueba en el editor y Player (guía PHY-G001).
const phySource = (path) => readFileSync(new URL('../src/engine/runtime/' + path, import.meta.url), 'utf8')
const phyDb = () => normalizeDatabase({ ...database(), items: [{ id: 1, name: 'Botella', model: 'prim:cube', physics: 'dynamic', bodyMass: 0.5 }, { id: 2, name: 'Llave', model: 'prim:cube', physics: 'static' }], weapons: [{ id: 1, name: 'Espada', physics: 'none' }] })

test('PHY-01 · objetos y armas nuevos son Static sin añadir gravedad', () => {
  assert.equal(newRecord('items', 9).physics, 'static')
  assert.equal(newRecord('weapons', 9).physics, 'static')
})

test('PHY-02 · Database legado no se convierte silenciosamente en Static', () => {
  const db = normalizeDatabase(database())
  assert.equal(Object.hasOwn(db.items[0], 'physics'), false)
  assert.equal(Object.hasOwn(db.weapons[0], 'physics'), false)
  assert.equal(graphicPhysics({ kind: 'item', itemId: 1 }, db), null)
})

test('PHY-03 · dos referencias al mismo objeto comparten perfil, no instancia', () => {
  const db = phyDb(), gr = { kind: 'item', itemId: 1 }
  const a = graphicPhysics(gr, db), b = graphicPhysics(gr, db)
  assert.equal(a.type, 'dynamic')
  assert.equal(a.mass, 0.5)
  assert.notStrictEqual(a, b)
})

test('PHY-04 · cambiar página resuelve Physics del gráfico vigente', () => {
  const db = phyDb()
  assert.equal(graphicPhysics({ kind: 'item', itemId: 1 }, db).type, 'dynamic')
  assert.equal(graphicPhysics({ kind: 'item', itemId: 2 }, db).type, 'static')
  assert.equal(graphicPhysics({ kind: 'weapon', weaponId: 1 }, db).type, 'none')
})

test('PHY-05 · gráfico Ninguno y gráficos ajenos a Database no crean perfil', () => {
  const db = phyDb()
  for (const gr of [{kind:'none'}, {kind:'prefab', prefabId:'p'}, {kind:'sphere'}, {kind:'actor', actorId: 1}]) {
    assert.equal(graphicPhysics(gr, db), null)
  }
})

test('PHY-06 · Physics inválido se informa, nunca se convierte a Dynamic', () => {
  const db = phyDb()
  db.items[0].physics = 'rigidbody'
  assert.throws(() => graphicPhysics({kind:'item',itemId:1}, db), /Physics no válido/)
})

test('PHY-07 · las propiedades de una página no afectan el inventario', () => {
  const { party, db } = sample()
  party.gain('items', 1, 1)
  const before = structuredClone(party.inv)
  const gr = { kind: 'item', itemId: 2 }
  graphicPhysics(gr, db)
  assert.deepEqual(party.inv, before)
})

test('PHY-08 · el código retira el cuerpo anterior antes de reemplazar el gráfico', () => {
  const src = phySource('events/play-events.js')
  const method = src.slice(src.indexOf('_applyPage(inst, idx)'), src.indexOf('_buildGfx(inst, gr)'))
  assert.ok(method.indexOf('this._eventPhysicsStop(inst)') < method.indexOf('inst.node.remove(inst.gfx)'))
  assert.match(method, /inst\.held\) this\._vmAdopt/)
  assert.match(method, /else this\._eventPhysicsResume\(inst\)/)
})

test('PHY-09 · no coexisten collider Static de página y cuerpo Dynamic', () => {
  const src = phySource('events/play-events.js')
  assert.match(src, /profile \? \['static', 'kinematic'\]\.includes\(profile\.type\) : page\.solid/)
  assert.match(src, /inst\.physicsProfile = profile/)
})

test('PHY-10 · Dynamic usa Jolt y el lanzamiento legado queda separado', () => {
  const src = phySource('player/viewmodel/hands-throw.js')
  assert.match(src, /profile\?\.type === 'dynamic'/)
  assert.match(src, /body\.push\(dir\.multiplyScalar\(v \* body\.mass\)/)
  assert.match(src, /profile\.type !== 'dynamic' && !pm\._gpRecord\?\.\(obj\.id\)\) return Promise\.resolve\(false\)/)
  assert.match(src, /this\._thrown\.push\(f\)/)
})

test('PHY-11 · posiciones y velocidades físicas se guardan por escena', () => {
  const src = phySource('events/play-bodies.js')
  assert.match(src, /state\.eventPhysicsScenes/)
  assert.match(src, /scenes\[scene\]/)
  assert.match(src, /velocityOf\(b\.item\)/)
  assert.match(phySource('events/play-saves.js'), /this\._rememberEventPhysics\(\)/)
})

test('PHY-12 · la carga en la misma escena también restaura la física', () => {
  const src = phySource('events/play-saves.js')
  assert.match(src, /this\._restoreEventPhysics\(\)/)
  assert.match(src, /this\._restoringPhysical = true/)
  assert.match(src, /this\._restoringPhysical = false/)
})

test('PHY-13 · transiciones de manos suspenden y restauran el cuerpo', () => {
  const hands = phySource('player/viewmodel/hands.js')
  const stash = phySource('player/viewmodel/hands-stash.js')
  assert.match(hands, /pm\._eventPhysicsStop\(inst\)/)
  assert.match(hands, /pm\._eventPhysicsResume\(h\.inst\)/)
  assert.match(stash, /pm\._eventPhysicsStop\(inst\)/)
})

test('PHY-14 · mover un Dynamic actualiza el sensor de su evento', () => {
  const src = phySource('events/play-bodies.js')
  assert.match(src, /ph\.syncSensors\(node\)/)
  assert.match(src, /this\._bodyRemove\(b\)/)
})

// LF-DB-SIG-G001_CORR-001 · La espera nueva usa los mismos bloques que Condición (Si…). 
import { newCommand, blocksOf, syncBlocks } from '../src/engine/runtime/events/commandDefs.js'
import { NATIVE_SIGNALS, SIGNAL_PARAMS } from '../src/engine/runtime/events/model.js'

function signalTestGame() {
  const messages = []
  const game = new Game({ database: database(), host: { say: async ({ text }) => { messages.push(text) } } })
  return { game, messages }
}

test('SIG-CORR-01 · catálogo único con ocho señales y nombres estables', () => {
  assert.deepEqual(NATIVE_SIGNALS.map(([name]) => name), [
    'item.picked_up', 'object.grabbed', 'object.dropped', 'object.thrown',
    'inventory.item_added', 'inventory.item_removed', 'equipment.equipped', 'equipment.unequipped',
  ])
  assert.equal(SIGNAL_PARAMS.find((p) => p.key === 'name').type, 'signal')
  assert.equal(newCommand('signal').p.name, '')
  assert.equal(newCommand('waitSignal').p.flow, true)
})

test('SIG-CORR-02 · el nuevo comando muestra ambas ramas en el editor', () => {
  const cmd = newCommand('waitSignal', { name: 'object.grabbed', timeout: 0 })
  assert.deepEqual(blocksOf(cmd).map((b) => b.key), ['received', 'timeout'])
  assert.deepEqual(Object.keys(cmd.b), ['received', 'timeout'])
})

test('SIG-CORR-03 · señal recibida ejecuta solo su rama y prosigue el evento', async () => {
  const { game, messages } = signalTestGame()
  const cmd = newCommand('waitSignal', { name: 'object.grabbed', timeout: 1 })
  cmd.b.received.push(newCommand('text', { text: 'Recibida' }))
  cmd.b.timeout.push(newCommand('text', { text: 'Sin respuesta' }))
  const r = game.run([cmd, newCommand('text', { text: 'Continuar' })])
  await game.signal('object.grabbed', { objectId: 'caja' })
  await r.done
  assert.deepEqual(messages, ['Recibida', 'Continuar'])
  assert.equal(game.waiters.size, 0)
  assert.equal(game._waitCancel.size, 0)
})

test('SIG-CORR-04 · una señal sin dato sigue siendo recibida, no timeout', async () => {
  const { game, messages } = signalTestGame()
  const cmd = newCommand('waitSignal', { name: 'custom.none', timeout: 0.05 })
  cmd.b.received.push(newCommand('text', { text: 'Llegó' }))
  cmd.b.timeout.push(newCommand('text', { text: 'No llegó' }))
  const r = game.run([cmd])
  await game.signal('custom.none')
  await r.done
  assert.deepEqual(messages, ['Llegó'])
})

test('SIG-CORR-05 · timeout ejecuta solo la rama alternativa y continúa', async () => {
  const { game, messages } = signalTestGame()
  const cmd = newCommand('waitSignal', { name: 'no.event', timeout: 0.01 })
  cmd.b.received.push(newCommand('text', { text: 'Recibida' }))
  cmd.b.timeout.push(newCommand('text', { text: 'Tiempo agotado' }))
  const r = game.run([cmd, newCommand('text', { text: 'Siguiente' })])
  await r.done
  assert.deepEqual(messages, ['Tiempo agotado', 'Siguiente'])
  assert.equal(game.waiters.size, 0)
})

test('SIG-CORR-06 · los datos recibidos están disponibles en los textos sin variables', async () => {
  const { game, messages } = signalTestGame()
  const cmd = newCommand('waitSignal', { name: 'inventory.item_added' })
  cmd.b.received.push(newCommand('text', { text: 'Objeto \\S[itemId], delta \\S[delta], señal \\S[signal]' }))
  const r = game.run([cmd])
  await game.signal('inventory.item_added', { itemId: 7, delta: 2 })
  await r.done
  assert.deepEqual(messages, ['Objeto 7, delta 2, señal inventory.item_added'])
  assert.equal(game.getVar(1), 0)
})

test('SIG-CORR-07 · Variable puede consultar el dato recibido sin script', async () => {
  const { game } = signalTestGame()
  const cmd = newCommand('waitSignal', { name: 'inventory.item_added' })
  cmd.b.received.push(newCommand('variable', { id: 4, src: 'signal', signalField: 'delta' }))
  const r = game.run([cmd])
  await game.signal('inventory.item_added', { itemId: 1, delta: 3 })
  await r.done
  assert.equal(game.getVar(4), 3)
})

test('SIG-CORR-08 · Emitir reenvía los datos del bloque sin variable intermedia', async () => {
  const { game } = signalTestGame()
  const seen = []
  game.on('my.signal', (d) => { seen.push(d) })
  const cmd = newCommand('waitSignal', { name: 'object.grabbed' })
  cmd.b.received.push(newCommand('signal', { name: 'my.signal', dataSrc: 'received', wait: true }))
  const r = game.run([cmd])
  await game.signal('object.grabbed', { objectId: 'a' })
  await r.done
  assert.deepEqual(seen, [{ objectId: 'a' }])
})

test('SIG-CORR-09 · cancelar evento desbloquea la promesa y limpia suscripciones', async () => {
  const { game, messages } = signalTestGame()
  const cmd = newCommand('waitSignal', { name: 'object.thrown', timeout: 20 })
  cmd.b.received.push(newCommand('text', { text: 'No debe mostrarse' }))
  cmd.b.timeout.push(newCommand('text', { text: 'Tampoco' }))
  const r = game.run([cmd])
  r.cancel()
  await r.done
  await game.signal('object.thrown', {})
  assert.deepEqual(messages, [])
  assert.equal(game.waiters.size, 0)
  assert.equal(game._waitCancel.size, 0)
})

test('SIG-CORR-10 · cancelar una ejecución no cancela las otras esperas', async () => {
  const { game, messages } = signalTestGame()
  const first = newCommand('waitSignal', { name: 'item.picked_up' })
  const second = newCommand('waitSignal', { name: 'item.picked_up' })
  first.b.received.push(newCommand('text', { text: 'Uno' }))
  second.b.received.push(newCommand('text', { text: 'Dos' }))
  const a = game.run([first]), b = game.run([second])
  a.cancel()
  await a.done
  await game.signal('item.picked_up', {})
  await b.done
  assert.deepEqual(messages, ['Dos'])
})

test('SIG-CORR-11 · un comando anterior sin flow conserva la espera lineal', async () => {
  const { game, messages } = signalTestGame()
  const old = { id: 'old', code: 'waitSignal', p: { name: 'legacy', timeout: 1, out: 3, okSw: 1 }, b: {} }
  syncBlocks(old)
  assert.deepEqual(blocksOf(old), [])
  const r = game.run([old, newCommand('text', { text: 'Hecho' })])
  await game.signal('legacy', { status: 'ok' })
  await r.done
  assert.deepEqual(game.getVar(3), { status: 'ok' })
  assert.equal(game.getSw(1), true)
  assert.deepEqual(messages, ['Hecho'])
})

test('SIG-CORR-12 · el contexto recibido no se filtra fuera de su bloque', async () => {
  const { game, messages } = signalTestGame()
  const cmd = newCommand('waitSignal', { name: 'object.dropped' })
  cmd.b.received.push(newCommand('text', { text: 'Dentro=\\S[objectId]' }))
  const r = game.run([cmd, newCommand('text', { text: 'Fuera=\\S[objectId]' })])
  await game.signal('object.dropped', { objectId: 'botella' })
  await r.done
  assert.deepEqual(messages, ['Dentro=botella', 'Fuera='])
})

test('SIG-CORR-13 · el dato contextual también funciona en páginas Al recibir señal', () => {
  const { game } = signalTestGame()
  const ctx = { signal: { name: 'object.dropped', data: { objectId: 'botella' } } }
  assert.equal(game.fmt('\\S[objectId]', ctx), 'botella')
  assert.equal(game.fmt('\\S[signal]', ctx), 'object.dropped')
})

test('SIG-CORR-14 · una propiedad de prototipo no se puede leer desde una señal', () => {
  const { game } = signalTestGame()
  const ctx = { signal: { name: 'a', data: { item: { count: 3 } } } }
  assert.equal(game.signalValue(ctx, 'item.count'), 3)
  assert.equal(game.signalValue(ctx, 'item.__proto__'), undefined)
  assert.equal(game.signalValue(ctx, 'constructor'), undefined)
})

test('SIG-CORR-15 · Space edita y respeta campos de texto y modales', () => {
  const src = readFileSync(new URL('../src/components/EventEditor.vue', import.meta.url), 'utf8')
  assert.match(src, /e\.code === 'Space'/)
  assert.match(src, /e\.target !== listEl\.value/)
  assert.match(src, /if \(edit\.value \|\| picker\.value/)
  assert.match(src, /e\.preventDefault\(\); openEdit\(\)/)
})

test('SIG-CORR-16 · desactivar y reactivar las ramas no borra comandos anidados', () => {
  const cmd = newCommand('waitSignal', { name: 'object.grabbed' })
  cmd.b.received.push(newCommand('text', { text: 'Conservar' }))
  cmd.p.flow = false
  syncBlocks(cmd)
  assert.deepEqual(blocksOf(cmd), [])
  assert.equal(cmd.b.received.length, 1)
  cmd.p.flow = true
  syncBlocks(cmd)
  assert.equal(cmd.b.received[0].p.text, 'Conservar')
})

test('SIG-CORR-17 · cancelAll limpia todas las esperas sin ejecutar las ramas', async () => {
  const { game, messages } = signalTestGame()
  const cmd = newCommand('waitSignal', { name: 'object.thrown', timeout: 20 })
  cmd.b.received.push(newCommand('text', { text: 'No' }))
  const r = game.run([cmd])
  game.cancelAll()
  await r.done
  assert.equal(game.waiters.size, 0)
  assert.equal(game._waitCancel.size, 0)
  assert.deepEqual(messages, [])
})

// LF-EV-ORDER-G001: regresión del PlayMode real mediante host de prueba, sin depender de Electron/Jolt.
import './test-event-order.mjs'

// LF-GP-OBJ-G001: estados de instancias y circuito sin páginas de eventos.
import './test-gameplay-object.mjs'

// Gameplay Object: física Dynamic temporal y vuelta al perfil de Database.
import './test-gameplay-physics.mjs'

import './test-ux-interact.mjs'

import './test-ux-interact-corr.mjs'

// LF-UX-HELD-G001: presentación nativa de controles mientras hay un objeto en mano.
import './test-held-actions.mjs'

// LF-UX-HELD-G001_CORR-001: HUD compacto y destino real por mano.
import './test-held-actions-corr.mjs'

// LF-INPUT-MOUSE-G001: entradas independientes y migración de proyectos antiguos.
import './test-input-mouse.mjs'

// LF-UX-CMD-WINDOW-G001: presentación horizontal y flujo de edición.
import './test-cmd-window.mjs'

// LF-UX-ADD-G001: menú contextual compacto, categorías y búsqueda sin duplicar el registro.
import './test-add-menu.mjs'

// LF-UI-SYSTEM-ASSETS-G001: interfaces nativas editables y protegidas, con compatibilidad de Canvas anteriores.
import './test-system-ui-assets.mjs'

// LF-PROJECT-SAFE-G001: protección de proyectos abiertos y regresión de las ventanas de proyectos.
import "./test-project-safe.mjs"

// LF-EVENT-MATCH-G001: Match/Case/Default sobre runner y ramas existentes.
import './test-event-match.mjs'

// LF-EDITOR-F12-G001: Electron editor y Player tienen políticas independientes.
import './test-editor-f12.mjs'
