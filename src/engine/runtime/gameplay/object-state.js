// Reglas del Gameplay Object. Los estados pertenecen a cada instancia; Database solo define el tipo.
export const GAMEPLAY_STATES = ['world', 'hand', 'stored', 'consumed']
export const GAMEPLAY_KINDS = ['items', 'weapons']
export const GAMEPLAY_MODES = ['inventory', 'direct']

/** Los valores del Timeline pertenecen al nodo renderizado; Database y proyecto no se mutan. */
export function gameplayRuntimeProps(obj, root) {
  const overrides = root?.userData?.timelineVisualFields?.props
  return overrides ? { ...(obj.props || {}), ...overrides } : (obj.props || {})
}

export function gameplayRecord(obj, db) {
  const kind = obj?.props?.recordKind
  const id = Number(obj?.props?.recordId)
  if (!GAMEPLAY_KINDS.includes(kind) || !Number.isSafeInteger(id) || id <= 0) return null
  const record = db?.[kind]?.find((r) => r.id === id)
  return record ? { kind, id, record } : null
}

export function gameplayProfile(obj, db) {
  const info = gameplayRecord(obj, db)
  const r = info?.record
  if (!r || !Object.hasOwn(r, 'physics')) return null // Los proyectos antiguos conservan las colisiones anteriores.
  if (!['none', 'static', 'dynamic', 'kinematic'].includes(r.physics)) throw new Error(`Physics no válido en ${r.name || r.id}`)
  return { type: r.physics, shape: r.bodyShape || 'box', mass: r.bodyMass ?? 1,
    friction: r.bodyFriction ?? 0.6, bounce: r.bodyBounce ?? 0.15 }
}

export function gameplayState(state, sceneId, obj) {
  const scenes = (state.gameplayObjects ||= {})
  const entries = (scenes[sceneId] ||= {})
  return (entries[obj.id] ||= { status: 'world', inventory: false, recordKind: obj.props.recordKind,
    recordId: Number(obj.props.recordId) || 0, slot: obj.props.slot || 'right' })
}

export function gameplayNext(status, operation) {
  const transitions = {
    world: { pickup: 'hand' },
    hand: { drop: 'world', throw: 'world', store: 'stored', consume: 'consumed' },
    stored: { draw: 'hand', consume: 'consumed' },
    consumed: {},
  }
  return transitions[status]?.[operation] || null
}
