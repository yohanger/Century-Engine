// Informa a la UI de lo que se puede hacer con el objeto sostenido. No ejecuta ninguna acción.
import { deviceOf, findAction, labelOf } from '../input/inputmap.js'
import { systemText } from '../i18n/system-texts.js'

/** Obtiene la entrada del dispositivo en uso. Si no está asignada, utiliza otra entrada válida. */
export function heldActionKey(input, action) {
  if (!input?.isEnabled?.(action)) return ''
  const bindings = findAction(input.map, action)?.bindings || []
  if (!bindings.length) return ''
  const last = input.lastDevice || 'key'
  const order = last === 'pad' ? ['pad', 'key', 'mouse'] : last === 'mouse' ? ['mouse', 'key', 'pad'] : ['key', 'mouse', 'pad']
  const token = order.map((d) => bindings.find((b) => deviceOf(b) === d)).find(Boolean)
  return token ? labelOf(token) : ''
}

export function heldObjectActions({ held, gameplayObject, input, game, dropEnabled = true, actions = null, hand = '' } = {}) {
  if (!held || !input || !game) return []
  const rows = []
  const add = (action, key, title) => {
    if (actions && !actions.includes(key)) return
    const binding = heldActionKey(input, action)
    if (!binding) return
    // Una traducción del proyecto tiene prioridad; en su ausencia manda el texto built-in.
    const text = game.translate?.(title) ?? systemText(title, game.lang)
    const side = hand === 'left' || hand === 'right' ? `ui.held.hand.${hand}` : ''
    const suffix = side ? (game.translate?.(side) ?? systemText(side, game.lang)) : hand
    rows.push({ id: side || hand ? `${key}:${hand}` : key, key: binding, label: suffix ? `${text} · ${suffix}` : text })
  }

  const g = gameplayObject
  if (g) {
    if (g.busy || g.state?.status !== 'hand' || !g.info) return []
    const { kind, record } = g.info
    const party = game.party
    const actor = game.db?.player?.actorId || party?.members?.[0]
    const equipped = kind === 'weapons' && !!actor && party?.actor(actor)?.equips?.[0] === record.id
    const skill = kind === 'weapons' ? party?.rec?.('skills', record.actionSkill) : null
    const enemy = Number(g.obj?.props?.targetEnemy)
    const validTarget = !skill || skill.scope !== 'enemy' || (Number.isSafeInteger(enemy) && enemy > 0)
    if ((kind === 'items' && g.state.inventory && party?.has('items', record.id) && !['never', 'menu'].includes(record.occasion)) || (equipped && !!record.actionSkill && validTarget)) add('gp_use', 'use', 'ui.held.use')
    const max = +game.db?.system?.maxItems || 99
    if (g.state.inventory || party?.count(kind, record.id) < max) add('gp_store', 'store', 'ui.held.store')
  }
  if (dropEnabled) {
    add('drop', 'drop', 'ui.held.drop')
    add('throw', 'throw', 'ui.held.throw')
  }
  return rows
}

export const heldActionsMethods = {
  _updateHeldActions() {
    const vm = this.vm
    const state = this.state
    const blocked = !this.on || !state.focus || this.paused || !!state.dialog || !!state.choices || this.ui?.modalOpen
    const held = [...(vm?.held?.values() || [])]
    const gp = !this.main && this.control !== false ? held.find((h) => this._gpRecord?.(h.id)) : null
    const drop = vm?.slots?.get('right')?.items?.at(-1) || held.at(-1)
    const both = held.length > 1 && new Set(held.map((h) => h.slot)).size > 1
    const common = { input: this.input, game: this.game }
    // Usar/Guardar y Soltar/Lanzar no eligen la misma mano en el controlador actual.
    // Mostramos el destino real de cada tecla, sin anunciar una acción que todavía no puede ejecutar.
    const next = blocked ? [] : [
      ...heldObjectActions({ ...common, held: gp, gameplayObject: this._gpRecord?.(gp?.id),
        dropEnabled: false, actions: ['use', 'store'], hand: both ? gp?.slot : '' }),
      ...heldObjectActions({ ...common, held: drop, gameplayObject: this._gpRecord?.(drop?.id),
        dropEnabled: this.game?.db?.player?.dropEnabled !== false,
        actions: ['drop', 'throw'], hand: both ? drop?.slot : '' }),
    ]
    const old = state.heldActions || []
    if (old.length === next.length && old.every((v, i) => v.id === next[i].id && v.key === next[i].key && v.label === next[i].label)) return
    state.heldActions = next
  },
}
