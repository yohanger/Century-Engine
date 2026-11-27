// LF-UX-HELD-G001: UI contextual sin Electron/Jolt. La presentación gráfica se valida aparte.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { InputState, defaultInputMap, setBindings } from '../src/engine/runtime/input/inputmap.js'
import { heldActionKey, heldObjectActions, heldActionsMethods } from '../src/engine/runtime/events/play-held-actions.js'
import { systemText } from '../src/engine/runtime/i18n/system-texts.js'
import { SYSTEM_ROLE, systemCode, systemDoc, roleVisible } from '../src/engine/runtime/ui/system.js'

const input = () => new InputState(defaultInputMap())
const game = () => ({ lang: 'es', translate: () => null, db: { player: { dropEnabled: true }, system: { maxItems: 99 } },
  party: { members: [1], has: () => true, count: () => 1, actor: () => ({ equips: [0] }) } })
const held = { id: 'obj', slot: 'right' }
const item = (opts = {}) => ({ obj: { id: 'obj' }, busy: false, state: { status: 'hand', inventory: true },
  info: { kind: 'items', record: { id: 5, occasion: 'always', ...opts } } })
const rows = (opts = {}) => heldObjectActions({ held, gameplayObject: item(), input: input(), game: game(), ...opts })

test('HELD-01 · el uso Canvas aparece en las interfaces nativas', () => {
  assert.equal(SYSTEM_ROLE.held_actions.layer, 22)
  assert.equal(systemDoc('held_actions').id, 'sys:held_actions')
})
test('HELD-02 · la plantilla built-in solo presenta tecla y acción', () => {
  const code = systemCode('held_actions')
  assert.match(code, /v-for="row in play\.heldActions"/)
  assert.match(code, /\{\{ row\.key \}\}/)
  assert.match(code, /\{\{ row\.label \}\}/)
  assert.match(code, /left: clamp/)
  assert.match(code, /bottom: clamp/)
  assert.doesNotMatch(code, /nombre|itemName/)
})
test('HELD-03 · con manos vacías no hay acciones', () => {
  assert.deepEqual(heldObjectActions({ held: null, input: input(), game: game() }), [])
})
test('HELD-04 · un objeto con uso e inventario tiene cuatro acciones', () => {
  assert.deepEqual(rows().map((a) => a.id), ['use', 'store', 'drop', 'throw'])
})
test('HELD-05 · la tecla viene de Input Map y no de una constante', () => {
  const i = input(); setBindings(i.map, 'gp_use', ['KeyZ'])
  assert.equal(rows({ input: i })[0].key, 'Z')
})
test('HELD-06 · soltar y lanzar tienen teclas independientes y textos propios', () => {
  const r = rows(); const a = r.find((x) => x.id === 'drop'), b = r.find((x) => x.id === 'throw')
  assert.equal(a.key, 'G'); assert.equal(b.key, 'T'); assert.notEqual(a.label, b.label)
})
test('HELD-07 · una acción deshabilitada no muestra tecla ni texto', () => {
  const i = input(); i.setEnabled('gp_store', false)
  assert.equal(rows({ input: i }).some((a) => a.id === 'store'), false)
})
test('HELD-08 · una acción sin asignaciones no se muestra', () => {
  const i = input(); setBindings(i.map, 'drop', [])
  assert.equal(rows({ input: i }).some((a) => a.id === 'drop'), false)
  assert.equal(rows({ input: i }).find((a) => a.id === 'throw')?.key, 'T')
})
test('HELD-09 · los botones de mando funcionan cuando son los únicos asignados', () => {
  const i = input(); setBindings(i.map, 'gp_use', ['Pad0'])
  assert.match(rows({ input: i }).find((a) => a.id === 'use').key, /Mando/)
})
test('HELD-10 · cambia la ayuda según el dispositivo que se usa', () => {
  const i = input()
  i.set('Pad1', 1)
  assert.equal(i.lastDevice, 'pad')
  assert.match(heldActionKey(i, 'drop'), /Mando/)
  i.set('KeyG', 1)
  assert.equal(i.lastDevice, 'key')
  assert.equal(heldActionKey(i, 'drop'), 'G')
})
test('HELD-11 · el texto nativo permite cambiar de español a inglés', () => {
  assert.equal(systemText('ui.held.drop', 'es'), 'Soltar')
  assert.equal(systemText('ui.held.drop', 'en'), 'Drop')
})
test('HELD-12 · localización del proyecto tiene prioridad sobre el texto built-in', () => {
  const g = game(); g.translate = (k) => k === 'ui.held.store' ? 'Archivar' : null
  assert.equal(rows({ game: g }).find((a) => a.id === 'store').label, 'Archivar')
})
test('HELD-13 · una traducción ausente tiene respaldo integrado', () => {
  const g = game(); g.lang = 'de'
  assert.equal(rows({ game: g }).find((a) => a.id === 'drop').label, 'Soltar')
})
test('HELD-14 · un objeto directo no muestra Usar sin inventario', () => {
  const g = item(); g.state.inventory = false
  assert.equal(rows({ gameplayObject: g }).some((a) => a.id === 'use'), false)
})
test('HELD-15 · un objeto marcado como no utilizable no muestra Usar', () => {
  assert.equal(rows({ gameplayObject: item({ occasion: 'never' }) }).some((a) => a.id === 'use'), false)
})
test('HELD-16 · si el inventario está lleno no se ofrece guardar un objeto directo', () => {
  const g = item(); g.state.inventory = false
  const p = game(); p.party.count = () => 99
  assert.equal(rows({ game: p, gameplayObject: g }).some((a) => a.id === 'store'), false)
})
test('HELD-17 · una arma requiere equipamiento y acción válida para mostrar Usar', () => {
  const g = item(); g.info = { kind: 'weapons', record: { id: 3, actionSkill: 10 } }
  const p = game(); p.party.actor = () => ({ equips: [3] })
  assert.equal(rows({ gameplayObject: g, game: p }).some((a) => a.id === 'use'), true)
  g.info.record.actionSkill = 0
  assert.equal(rows({ gameplayObject: g, game: p }).some((a) => a.id === 'use'), false)
})
test('HELD-18 · la configuración del jugador desactiva Soltar y Lanzar', () => {
  assert.deepEqual(rows({ dropEnabled: false }).map((a) => a.id), ['use', 'store'])
})
test('HELD-19 · estado ocupado o guardado no presenta operaciones obsoletas', () => {
  const g = item(); g.busy = true
  assert.deepEqual(rows({ gameplayObject: g }), [])
  g.busy = false; g.state.status = 'stored'
  assert.deepEqual(rows({ gameplayObject: g }), [])
})
test('HELD-20 · el runtime respeta el estado del View Model y evita escribir sin cambios', () => {
  const state = { focus: true, heldActions: [] }; const i = input(), g = game(), gp = item()
  const pm = { ...heldActionsMethods, state, on: true, paused: false, input: i, game: g, ui: { modalOpen: false },
    vm: { held: new Map([['obj', held]]), slots: new Map([['right', { items: [held] }]]) },
    _gpRecord: (id) => id === 'obj' ? gp : null }
  pm._updateHeldActions()
  assert.equal(state.heldActions.length, 4)
  const original = state.heldActions
  pm._updateHeldActions()
  assert.equal(state.heldActions, original)
  pm.vm.held.clear(); pm.vm.slots.get('right').items = []
  pm._updateHeldActions()
  assert.deepEqual(state.heldActions, [])
})
test('HELD-21 · un overlay o la pérdida del foco ocultan la UI, sin soltar el objeto', () => {
  const pm = { ...heldActionsMethods, on: true, paused: false, state: { focus: true, heldActions: [] }, ui: { modalOpen: false }, input: input(), game: game(),
    vm: { held: new Map([['obj', held]]), slots: new Map() }, _gpRecord: () => item() }
  pm._updateHeldActions(); assert.ok(pm.state.heldActions.length)
  pm.ui.modalOpen = true; pm._updateHeldActions(); assert.equal(pm.state.heldActions.length, 0)
  pm.ui.modalOpen = false; pm.state.focus = false; pm._updateHeldActions(); assert.equal(pm.state.heldActions.length, 0)
  assert.equal(pm.vm.held.has('obj'), true)
})
test('HELD-22 · sin Gameplay Object, los nodos heredados muestran únicamente acciones existentes', () => {
  assert.deepEqual(heldObjectActions({ held, input: input(), game: game() }).map((a) => a.id), ['drop', 'throw'])
})
test('HELD-23 · el nuevo uso se oculta durante cuadros de diálogo y Canvas modales', () => {
  const p = { focus: true, heldActions: [{ id: 'drop', key: 'G', label: 'Soltar' }], paused: false }
  assert.equal(roleVisible('held_actions', p), true)
  assert.equal(roleVisible('held_actions', { ...p, dialog: {} }), false)
  assert.equal(roleVisible('held_actions', p, true), false)
})
test('HELD-24 · Canvas del sistema y actualización de fotogramas están integrados sin nuevo HUD', () => {
  const src = readFileSync(new URL('../src/engine/runtime/events/play-controls.js', import.meta.url), 'utf8')
  const manager = readFileSync(new URL('../src/engine/runtime/ui/manager.js', import.meta.url), 'utf8')
  assert.match(src, /this\._updateHeldActions\(\)/)
  assert.match(manager, /for \(const r of SYSTEM_ROLES\)/)
  assert.match(manager, /const mine = canvases\.filter\(\(c\) => c\.role === r\.key\)/)
})
test('HELD-25 · un arma con acción sobre enemigo exige objetivo configurado', () => {
  const g = item(); g.info = { kind: 'weapons', record: { id: 3, actionSkill: 10 } }
  const p = game(); p.party.actor = () => ({ equips: [3] }); p.party.rec = () => ({ scope: 'enemy' })
  assert.equal(rows({ gameplayObject: g, game: p }).some((a) => a.id === 'use'), false)
  g.obj = { props: { targetEnemy: 4 } }
  assert.equal(rows({ gameplayObject: g, game: p }).some((a) => a.id === 'use'), true)
})
test('HELD-26 · movimiento mínimo del stick no cambia el dispositivo mostrado', () => {
  const i = input(); i.set('PadLX+', 0.08)
  assert.equal(i.lastDevice, 'key')
  i.set('PadLX+', 0.9)
  assert.equal(i.lastDevice, 'pad')
})
