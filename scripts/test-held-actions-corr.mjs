// LF-UX-HELD-G001_CORR-001: el HUD solo anuncia las acciones que realmente atienden los controles.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { InputState, defaultInputMap, setBindings } from '../src/engine/runtime/input/inputmap.js'
import { heldActionsMethods, heldObjectActions } from '../src/engine/runtime/events/play-held-actions.js'
import { systemCode, systemDoc, roleVisible } from '../src/engine/runtime/ui/system.js'
import { systemText } from '../src/engine/runtime/i18n/system-texts.js'

const input = () => new InputState(defaultInputMap())
const game = () => ({ lang: 'es', translate: () => null, db: { player: { dropEnabled: true }, system: { maxItems: 99 } },
  party: { members: [1], has: () => true, count: () => 1, actor: () => ({ equips: [0] }) } })
const gp = (id, opts = {}) => ({ obj: { id }, state: { status: 'hand', inventory: true }, busy: false,
  info: { kind: 'items', record: { id: 5, occasion: 'always', ...opts } } })
const instance = (objects = [], records = {}) => {
  const slots = new Map([['right', { items: [] }], ['left', { items: [] }]])
  const held = new Map()
  for (const [id, slot] of objects) {
    const h = { id, slot }
    held.set(id, h)
    slots.get(slot)?.items.push(h)
  }
  return { ...heldActionsMethods, on: true, paused: false, state: { focus: true, heldActions: [] },
    vm: { held, slots }, ui: { modalOpen: false }, input: input(), game: game(),
    _gpRecord: (id) => records[id] || null }
}

test('HELD-C01 · el panel está anclado abajo a la izquierda y no vuelve a la derecha', () => {
  const code = systemCode('held_actions')
  assert.match(code, /\.rt-held-actions\s*\{[^}]*left:\s*clamp\(/)
  assert.match(code, /\.rt-held-actions\s*\{[^}]*bottom:\s*clamp\(/)
  assert.doesNotMatch(code, /\.rt-held-actions\s*\{[^}]*right:/)
})
test('HELD-C02 · todas las teclas y etiquetas comparten dos columnas fijas', () => {
  const code = systemCode('held_actions')
  assert.match(code, /grid-template-columns:\s*max-content\s+minmax\(0,\s*max-content\)/)
  assert.match(code, /\.rt-held-row\s*\{\s*display:\s*contents/)
  assert.match(code, /\.rt-held-label\s*\{[^}]*text-align:\s*left/)
  assert.doesNotMatch(code, /justify-content:\s*flex-end/)
})
test('HELD-C03 · tipografía, filas y teclas compactas', () => {
  const code = systemCode('held_actions')
  assert.match(code, /font:[^;}]*11px\/1\.25/)
  assert.match(code, /row-gap:\s*2px/)
  assert.match(code, /\.rt-held-key\s*\{[^}]*font-size:\s*10px/)
})
test('HELD-C04 · un solo Gameplay Object produce una lista sin marcas de mano', () => {
  const pm = instance([['obj','right']], { obj: gp('obj') })
  pm._updateHeldActions()
  assert.deepEqual(pm.state.heldActions.map((r) => r.id), ['use','store','drop','throw'])
  assert.equal(pm.state.heldActions.some((r) => r.label.includes(' · ')), false)
})
test('HELD-C05 · un único objeto en el slot izquierdo tampoco añade etiquetas innecesarias', () => {
  const pm = instance([['obj','left']], { obj: gp('obj') })
  pm._updateHeldActions()
  assert.equal(pm.state.heldActions.length, 4)
  assert.equal(pm.state.heldActions.some((r) => r.label.includes(' · ')), false)
})
test('HELD-C06 · dos objetos: Usar/Guardar apuntan al primer GP y Soltar/Lanzar a la derecha', () => {
  const pm = instance([['izq','left'],['der','right']], { izq: gp('izq'), der: gp('der') })
  pm._updateHeldActions()
  assert.deepEqual(pm.state.heldActions.map((r) => r.id), ['use:left','store:left','drop:right','throw:right'])
  assert.deepEqual(pm.state.heldActions.map((r) => r.label), ['Usar · Izq.','Guardar · Izq.','Soltar · Der.','Lanzar · Der.'])
})
test('HELD-C07 · si el Gameplay Object de la derecha fue el primero, las acciones siguen su destino real', () => {
  const pm = instance([['der','right'],['izq','left']], { der: gp('der'), izq: gp('izq') })
  pm._updateHeldActions()
  assert.deepEqual(pm.state.heldActions.map((r) => r.id), ['use:right','store:right','drop:right','throw:right'])
})
test('HELD-C08 · objeto heredado en una mano y Gameplay Object en la otra', () => {
  const pm = instance([['legacy','right'],['gp','left']], { gp: gp('gp') })
  pm._updateHeldActions()
  assert.deepEqual(pm.state.heldActions.map((r) => r.id), ['use:left','store:left','drop:right','throw:right'])
})
test('HELD-C09 · no se anuncian acciones de uso para una mano que no es el destino efectivo del Input Map', () => {
  const pm = instance([['legacy','left'],['gp','right']], { gp: gp('gp', { occasion: 'never' }) })
  pm._updateHeldActions()
  assert.deepEqual(pm.state.heldActions.map((r) => r.id), ['store:right','drop:right','throw:right'])
  assert.equal(pm.state.heldActions.some((r) => r.id.startsWith('use')), false)
})
test('HELD-C10 · un solo objeto sujeto en un slot llamado both muestra una sola lista', () => {
  const pm = instance([['obj','right']], { obj: gp('obj') })
  pm.vm.held.get('obj').slot = 'both'
  pm._updateHeldActions()
  assert.equal(pm.state.heldActions.length, 4)
  assert.equal(pm.state.heldActions.some((r) => r.label.includes(' · ')), false)
})
test('HELD-C11 · las abreviaturas de cada mano tienen respaldo inglés y español', () => {
  assert.equal(systemText('ui.held.hand.left', 'es'), 'Izq.')
  assert.equal(systemText('ui.held.hand.right', 'en'), 'Right')
  const pm = instance([['izq','left'],['der','right']], { izq: gp('izq'), der: gp('der') })
  pm.game.lang = 'en'; pm._updateHeldActions()
  assert.match(pm.state.heldActions[0].label, /Left$/)
  assert.match(pm.state.heldActions.at(-1).label, /Right$/)
})
test('HELD-C12 · la localización del proyecto manda también sobre la descripción de mano', () => {
  const pm = instance([['izq','left'],['der','right']], { izq: gp('izq'), der: gp('der') })
  pm.game.translate = (k) => k === 'ui.held.hand.left' ? 'Sinistra' : null
  pm._updateHeldActions()
  assert.equal(pm.state.heldActions[0].label, 'Usar · Sinistra')
})
test('HELD-C13 · cambios de Input Map actualizan una tecla, sin alterar la mano', () => {
  const pm = instance([['izq','left'],['der','right']], { izq: gp('izq'), der: gp('der') })
  pm._updateHeldActions()
  setBindings(pm.input.map, 'gp_use', ['KeyZ'])
  pm._updateHeldActions()
  assert.equal(pm.state.heldActions[0].key, 'Z')
  assert.equal(pm.state.heldActions[0].id, 'use:left')
})
test('HELD-C14 · si solo hay un objeto válido para soltar no se inventan opciones de uso', () => {
  const pm = instance([['legacy','right']], {})
  pm._updateHeldActions()
  assert.deepEqual(pm.state.heldActions.map((r) => r.id), ['drop','throw'])
})
test('HELD-C15 · la ausencia de un binding impide anunciar esa operación', () => {
  const pm = instance([['izq','left'],['der','right']], { izq: gp('izq'), der: gp('der') })
  setBindings(pm.input.map, 'drop', [])
  pm._updateHeldActions()
  assert.deepEqual(pm.state.heldActions.map((r) => r.id), ['use:left','store:left','throw:right'])
})
test('HELD-C16 · continúa la prioridad de Canvas y la UI no se muestra con manos vacías', () => {
  const pm = instance([], {})
  pm._updateHeldActions()
  assert.deepEqual(pm.state.heldActions, [])
  assert.equal(systemDoc('held_actions').id, 'sys:held_actions')
  assert.equal(roleVisible('held_actions', { focus: true, heldActions: [] }), false)
  const src = readFileSync(new URL('../src/engine/runtime/ui/manager.js', import.meta.url), 'utf8')
  assert.match(src, /const mine = canvases\.filter\(\(c\) => c\.role === r\.key\)/)
})

test('HELD-C17 · si el controlador de Gameplay está bloqueado no se anuncian Usar ni Guardar', () => {
  const pm = instance([['obj','right']], { obj: gp('obj') })
  pm.control = false
  pm._updateHeldActions()
  assert.deepEqual(pm.state.heldActions.map((r) => r.id), ['drop','throw'])
})
test('HELD-C18 · un evento principal no anuncia acciones que la entrada GP no ejecutaría', () => {
  const pm = instance([['obj','right']], { obj: gp('obj') })
  pm.main = { mode: 'free' }
  pm._updateHeldActions()
  assert.deepEqual(pm.state.heldActions.map((r) => r.id), ['drop','throw'])
})
