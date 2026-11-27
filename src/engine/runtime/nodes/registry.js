// Registro de tipos de nodo. Añadir un tipo nuevo = crear un archivo en nodes/ y registrarlo en index.js.
//
// Un tipo define:
//   type, label, icon, category     identidad y UI
//   scalable                         si el gizmo de escala aplica (tamaño propio del nodo)
//   kinds                            variantes opcionales { clave: { label, icon } }
//   create(kind)                     valores iniciales del objeto
//   build(obj, ctx)  -> Group        representación 3D del editor; root.userData.visual lleva la escala
//   update(root, obj)                sincroniza la representación con los datos
import { registerNodeAnimationProperties } from '../anim/model.js'
const defs = new Map()

// Metadata de Area3D: los cuatro eventos salen de Jolt/NodeSpatialRuntime, no de Scripts.
// Se comparte la definición con physics.js y con los registros simplificados de QA.
export const AREA3D_NATIVE_SIGNALS = Object.freeze([
  'body_entered', 'body_exited', 'area_entered', 'area_exited',
].map(name => Object.freeze({
  name, source: 'jolt-area', phase: 'physics',
  condition: name.startsWith('area_') ? 'monitoring y otra Area3D monitorable' : 'monitoring y cuerpo detectado',
  args: Object.freeze([Object.freeze({ name: 'event', type: 'Area3DEvent', fields: Object.freeze(['areaId', 'type', 'id']) })]),
})))

// Señal del ciclo de vida: emite NodeLifecycle, incluso si el nodo no tiene scripts.
export const NODE_READY_SIGNAL = Object.freeze({
  name: 'ready', source: 'node-lifecycle', phase: 'after-ready',
  condition: 'tras ejecutar _ready() en una estancia nueva del nodo', args: Object.freeze([]),
})

// Eventos comunes emitidos por NodeLifecycle: no requieren scripts asociados.
export const NODE_TREE_SIGNALS = Object.freeze([
  { name: 'tree_entered', phase: 'after-enter', condition: 'tras _enter_tree(), al entrar en el árbol' },
  { name: 'tree_exiting', phase: 'before-detach', condition: 'tras _exit_tree(), con el nodo todavía montado' },
  { name: 'tree_exited', phase: 'after-detach', condition: 'tras abandonar el árbol' },
].map(signal => Object.freeze({ ...signal, source: 'node-lifecycle', args: Object.freeze([]) })))
// Toda animación de Nodo usa el reproductor existente. Los slots de ViewModel no son nodos.
export const NODE_ANIMATION_FINISHED_SIGNAL = Object.freeze({
  name: 'animation_finished', source: 'animation-runner', phase: 'natural-end',
  condition: 'finalización natural de clip de claves o clip GLB/GLTF perteneciente al nodo',
  args: Object.freeze([Object.freeze({ name: 'clipName', type: 'string' })]),
})
const NODE_LIFECYCLE_SIGNALS = Object.freeze([NODE_READY_SIGNAL, ...NODE_TREE_SIGNALS, NODE_ANIMATION_FINISHED_SIGNAL])
const EMPTY_NATIVE_SIGNALS = Object.freeze([])

/** Metadata estable por tipo: nunca ejecuta scripts ni activa Jolt. */
export function getNativeSignals(type) {
  return defs.get(type)?.nativeSignals || EMPTY_NATIVE_SIGNALS
}
export function getNativeSignal(type, name) {
  return getNativeSignals(type).find(signal => signal.name === name) || null
}

// Campos visuales que el propietario ya sabe aplicar mediante su update().
// No se utiliza con datos físicos, recursos compartidos ni acciones estructurales.
function buildVisualAnimation(def) {
  const fields = def.visualAnimationFields || {}
  if (!Object.keys(fields).length) return {}
  const originalUpdate = def.update
  const view = (root, obj) => {
    const overrides = root.userData.timelineVisualFields
    if (!overrides) return obj
    return {
      ...obj,
      ...(overrides.object || {}),
      props: { ...(obj.props || {}), ...(overrides.props || {}) },
    }
  }
  def.update = (root, obj) => originalUpdate(root, view(root, obj))
  const refresh = (root, obj) => {
    // update() contiene applyBase: preservar la pose que otras pistas controlan.
    const pose = root.position?.clone?.(), rot = root.quaternion?.clone?.()
    const scale = root.userData.visual?.scale?.clone?.(), shown = root.visible
    def.update(root, obj)
    if (pose) root.position.copy(pose)
    if (rot) root.quaternion.copy(rot)
    if (scale) root.userData.visual.scale.copy(scale)
    if (shown !== undefined) root.visible = shown
    root.updateMatrixWorld?.(true)
  }
  return Object.fromEntries(Object.entries(fields).map(([key, info]) => {
    const { scope = 'props', ...spec } = info
    if (scope !== 'props' && scope !== 'object') throw new Error(`Campo visual sin propietario: ${key}`)
    const override = root => root.userData.timelineVisualFields?.[scope]
    const authored = obj => (spec.read ? spec.read(obj) : (scope === 'props' ? obj.props?.[key] : obj[key])) ?? spec.def
    return [`${def.type}.${key}`, {
      ...spec,
      read: authored,
      runtimeRead: (root, obj) => override(root)?.[key] ?? authored(obj),
      apply: (root, value, obj) => {
        const values = (root.userData.timelineVisualFields ??= {})
        ;(values[scope] ??= {})[key] = value
        refresh(root, obj)
      },
      capture: root => ({ had:Object.hasOwn(override(root) || {}, key), value:override(root)?.[key] }),
      restore: (root, saved, obj) => {
        const values = root.userData.timelineVisualFields
        if (saved?.had) ((root.userData.timelineVisualFields ??= {})[scope] ??= {})[key] = saved.value
        else if (values?.[scope]) {
          delete values[scope][key]
          if (!Object.keys(values[scope]).length) delete values[scope]
          if (!Object.keys(values).length) delete root.userData.timelineVisualFields
        }
        refresh(root,obj)
      },
    }]
  }))
}

export function registerNode(def) {
  if (!def?.type || typeof def.create !== 'function' || typeof def.build !== 'function' || typeof def.update !== 'function') {
    throw new TypeError('Un tipo de nodo requiere type, create, build y update')
  }
  if (def.base && def.base !== 'Node' && def.base !== 'Node3D') throw new TypeError(`Base de nodo inválida: ${def.base}`)
  // La definición física estándar y los stubs de QA reutilizan la misma metadata.
  // [] explícito permite declarar un tipo sin señales; nunca se mezclan dos catálogos.
  const declared = def.nativeSignals ?? (def.type === 'area3d' ? AREA3D_NATIVE_SIGNALS : EMPTY_NATIVE_SIGNALS)
  const incoming = Array.isArray(declared) ? [...NODE_LIFECYCLE_SIGNALS, ...declared] : declared
  if (!Array.isArray(incoming)) throw new TypeError(`nativeSignals de ${def.type} debe ser una lista`)
  const seen = new Set()
  for (const signal of incoming) {
    if (!signal || typeof signal.name !== 'string' || !signal.name.trim() || signal.name !== signal.name.trim() || seen.has(signal.name) ||
        !Array.isArray(signal.args) || typeof signal.source !== 'string' || !signal.source.trim() ||
        typeof signal.phase !== 'string' || !signal.phase.trim()) {
      throw new TypeError(`Metadata de señal nativa inválida para ${def.type}`)
    }
    seen.add(signal.name)
  }
  const nativeSignals = Object.freeze(incoming.map(signal => Object.freeze({ ...signal,
    args: Object.freeze(signal.args.map(arg => Object.freeze({ ...arg }))),
  })))
  const animation = registerNodeAnimationProperties(def.type, {
    ...buildVisualAnimation(def), ...(def.animation || {}),
  })
  defs.set(def.type, { base: def.base || 'Node3D', ...def, nativeSignals, animation })
  return def
}
export const getDef = (type) => defs.get(type)
export const allDefs = () => [...defs.values()]
