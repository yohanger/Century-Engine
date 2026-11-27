// Mapa de entradas del proyecto: ACCIONES con nombre (jump, interact…) que agrupan varias entradas (teclas, botones del
// ratón, rueda, mando). Hay acciones INTEGRADAS (las que usa el motor: mover, correr, saltar, interactuar…) que se pueden reasignar pero
// no borrar, y las que crees tú. Los scripts y los comandos preguntan por la acción, no por la tecla: reasignar no rompe nada.
// Sin DOM ni THREE: lo usa también el test de Node.
//
// TOKEN de entrada (texto, en project.inputMap.actions[].bindings):
//   · teclado: el `code` de KeyboardEvent → 'KeyW', 'Space', 'ShiftLeft', 'ArrowUp', 'Digit1', 'F2'…
//   · ratón: 'Mouse0' (izq.) · 'Mouse1' (central) · 'Mouse2' (der.) · 'Mouse3'/'Mouse4' (laterales) · 'WheelUp' / 'WheelDown'
//   · mando (mapeo estándar): botones 'Pad0'…'Pad16' · ejes 'PadLX-', 'PadLX+', 'PadLY-', 'PadLY+', 'PadRX±', 'PadRY±'

export const MAX_ACTIONS = 128
export const MAX_BINDINGS = 12

/** Acciones integradas: [nombre, etiqueta, grupo, entradas por defecto]. */
export const BUILTIN_DEFS = [
  ['move_forward', 'Avanzar', 'Movimiento', ['KeyW', 'ArrowUp', 'PadLY-']],
  ['move_back', 'Retroceder', 'Movimiento', ['KeyS', 'ArrowDown', 'PadLY+']],
  ['move_left', 'Izquierda', 'Movimiento', ['KeyA', 'ArrowLeft', 'PadLX-']],
  ['move_right', 'Derecha', 'Movimiento', ['KeyD', 'ArrowRight', 'PadLX+']],
  ['run', 'Correr', 'Movimiento', ['ShiftLeft', 'ShiftRight', 'Pad10']],
  ['jump', 'Saltar', 'Movimiento', ['Space', 'Pad0']],
  ['crouch', 'Agacharse', 'Movimiento', ['KeyC', 'ControlLeft', 'Pad11']],
  ['interact', 'Interactuar / avanzar texto', 'Juego', ['KeyE', 'Enter', 'NumpadEnter', 'Space', 'Pad2']],
  ['drop', 'Soltar lo que llevas en la mano', 'Juego', ['KeyG', 'Pad1']],
  ['throw', 'Lanzar lo que llevas en la mano', 'Juego', ['KeyT']],
  ['gp_use', 'Usar objeto de la mano', 'Juego', ['KeyF']],
  ['gp_store', 'Guardar objeto de la mano', 'Juego', ['KeyR']],
  ['gp_draw', 'Sacar objeto guardado', 'Juego', ['KeyQ']],
  ['ui_up', 'Menú: arriba', 'Menús', ['KeyW', 'ArrowUp', 'Pad12']],
  ['ui_down', 'Menú: abajo', 'Menús', ['KeyS', 'ArrowDown', 'Pad13']],
  ['ui_cancel', 'Menú: cancelar', 'Menús', ['Escape', 'Backspace', 'Pad1']],
]
export const BUILTIN_NAMES = BUILTIN_DEFS.map((d) => d[0])
const DEF = Object.fromEntries(BUILTIN_DEFS.map(([name, label, group, bindings]) => [name, { name, label, group, bindings }]))
export const isBuiltin = (name) => !!DEF[name]
export const builtinDefault = (name) => (DEF[name] ? [...DEF[name].bindings] : [])
export const DEFAULT_DEADZONE = 0.25

const TOKEN_RE = /^[A-Za-z][A-Za-z0-9]{0,23}(?:[+-])?$/
export const isToken = (t) => typeof t === 'string' && TOKEN_RE.test(t)
const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/
export const validName = (n) => NAME_RE.test(String(n ?? ''))

/** Entrada por eje de mando: 'PadLX-' → { axis: 0, sign: -1 } (LX=0, LY=1, RX=2, RY=3). */
export function padAxisOf(token) {
  const m = /^Pad([LR])([XY])([+-])$/.exec(token)
  return m ? { axis: (m[1] === 'L' ? 0 : 2) + (m[2] === 'X' ? 0 : 1), sign: m[3] === '+' ? 1 : -1 } : null
}
export const padAxisToken = (axis, sign) => `Pad${axis < 2 ? 'L' : 'R'}${axis % 2 ? 'Y' : 'X'}${sign > 0 ? '+' : '-'}`

const KEY_LABELS = {
  Space: 'Espacio', Enter: 'Intro', NumpadEnter: 'Intro (num.)', Escape: 'Esc', Backspace: 'Retroceso', Tab: 'Tab', ShiftLeft: 'Shift izq.', ShiftRight: 'Shift der.',
  ControlLeft: 'Ctrl izq.', ControlRight: 'Ctrl der.', AltLeft: 'Alt izq.', AltRight: 'Alt der.', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Minus: '-', Equal: '=', Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Semicolon: ';', Quote: "'", Backquote: '`', BracketLeft: '[', BracketRight: ']',
  CapsLock: 'Bloq Mayús', Delete: 'Supr', Insert: 'Insert', Home: 'Inicio', End: 'Fin', PageUp: 'Re Pág', PageDown: 'Av Pág',
  Mouse0: 'Clic izquierdo', Mouse1: 'Clic central', Mouse2: 'Clic derecho', Mouse3: 'Ratón atrás', Mouse4: 'Ratón adelante', WheelUp: 'Rueda ↑', WheelDown: 'Rueda ↓',
}
const PAD_LABELS = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Select', 'Start', 'L3', 'R3', 'D-pad ↑', 'D-pad ↓', 'D-pad ←', 'D-pad →', 'Inicio']

/** Texto legible de una entrada («KeyW» → «W», «Pad0» → «Mando A», «PadLY-» → «Mando stick izq. ↑»). */
export function labelOf(token) {
  if (KEY_LABELS[token]) return KEY_LABELS[token]
  let m
  if ((m = /^Key([A-Z])$/.exec(token))) return m[1]
  if ((m = /^Digit(\d)$/.exec(token))) return m[1]
  if ((m = /^Numpad(\w+)$/.exec(token))) return 'Num ' + ({ Add: '+', Subtract: '-', Multiply: '*', Divide: '/', Decimal: '.' }[m[1]] || m[1])
  if ((m = /^Pad(\d+)$/.exec(token))) return 'Mando ' + (PAD_LABELS[+m[1]] ?? m[1])
  const ax = padAxisOf(token)
  if (ax) return `Mando stick ${ax.axis < 2 ? 'izq.' : 'der.'} ${ax.axis % 2 ? (ax.sign > 0 ? '↓' : '↑') : (ax.sign > 0 ? '→' : '←')}`
  return token
}
export const deviceOf = (token) => (/^Mouse|^Wheel/.test(token) ? 'mouse' : /^Pad/.test(token) ? 'pad' : 'key')

const cleanBindings = (list) => {
  const out = []
  for (const t of Array.isArray(list) ? list : []) if (isToken(t) && !out.includes(t) && out.length < MAX_BINDINGS) out.push(t)
  return out
}

/** Mapa por defecto: solo las acciones integradas. */
export function defaultInputMap() {
  return { actions: BUILTIN_DEFS.map(([name, , , bindings]) => ({ name, bindings: [...bindings], deadzone: DEFAULT_DEADZONE })) }
}

/**
 * Mapa válido a partir de datos guardados: las integradas siempre existen (con sus entradas guardadas, o las de fábrica si faltan);
 * las personalizadas se limpian (nombre válido y único, entradas válidas). El orden: integradas primero, luego las tuyas.
 */
export function normalizeInputMap(raw) {
  const src = Array.isArray(raw?.actions) ? raw.actions : []
  const byName = new Map()
  for (const a of src) if (a && typeof a === 'object' && validName(a.name) && !byName.has(a.name)) byName.set(a.name, a)
  const dz = (a) => { const v = +a?.deadzone; return Number.isFinite(v) ? Math.min(0.95, Math.max(0, v)) : DEFAULT_DEADZONE }
  const actions = BUILTIN_DEFS.map(([name, , , def]) => {
    const a = byName.get(name)
    let bindings = a && Array.isArray(a.bindings) ? cleanBindings(a.bindings) : [...def]
    // Los mapas anteriores guardaban clic izquierdo para interactuar y soltar. Lo quitamos sin tocar las acciones propias.
    if (name === 'interact' || name === 'drop' || name === 'throw') bindings = bindings.filter((t) => t !== 'Mouse0' && t !== 'Mouse2')
    return { name, bindings, deadzone: dz(a) }
  })
  for (const [name, a] of byName) {
    if (isBuiltin(name) || actions.length >= MAX_ACTIONS) continue
    actions.push({ name, bindings: cleanBindings(a.bindings), deadzone: dz(a) })
  }
  return { actions }
}

export const findAction = (map, name) => map.actions.find((a) => a.name === name) || null

/** Añade una acción personalizada. Devuelve la acción o null (nombre inválido/repetido o mapa lleno). */
export function addAction(map, name, bindings = []) {
  name = String(name ?? '').trim()
  if (!validName(name) || findAction(map, name) || map.actions.length >= MAX_ACTIONS) return null
  const a = { name, bindings: cleanBindings(bindings), deadzone: DEFAULT_DEADZONE }
  map.actions.push(a)
  return a
}
/** Quita una acción personalizada (las integradas no se pueden quitar). */
export function removeAction(map, name) {
  if (isBuiltin(name)) return false
  const i = map.actions.findIndex((a) => a.name === name)
  if (i < 0) return false
  map.actions.splice(i, 1)
  return true
}
/** Renombra una acción personalizada. */
export function renameAction(map, name, to) {
  const a = findAction(map, name)
  to = String(to ?? '').trim()
  if (!a || isBuiltin(name) || !validName(to) || (to !== name && findAction(map, to))) return false
  a.name = to
  return true
}
/** Añade una entrada a una acción. Devuelve false si ya estaba, no es válida o la acción está llena. */
export function addBinding(map, name, token) {
  const a = findAction(map, name)
  if (!a || !isToken(token) || a.bindings.includes(token) || a.bindings.length >= MAX_BINDINGS) return false
  a.bindings.push(token)
  return true
}
export function removeBinding(map, name, token) {
  const a = findAction(map, name)
  const i = a ? a.bindings.indexOf(token) : -1
  if (i < 0) return false
  a.bindings.splice(i, 1)
  return true
}
/** Sustituye todas las entradas de una acción. */
export function setBindings(map, name, tokens) {
  const a = findAction(map, name)
  if (!a) return false
  a.bindings = cleanBindings(tokens)
  return true
}
/** Restablece una integrada a sus entradas de fábrica (en las personalizadas la vacía). */
export function resetAction(map, name) {
  const a = findAction(map, name)
  if (!a) return false
  a.bindings = builtinDefault(name)
  a.deadzone = DEFAULT_DEADZONE
  return true
}
/** Acciones que ya usan esta entrada (para avisar de conflictos al asignarla). */
export const conflictsOf = (map, token, except = null) => map.actions.filter((a) => a.name !== except && a.bindings.includes(token)).map((a) => a.name)

// ================= estado en ejecución =================
/**
 * Estado de las entradas en juego. El host (PlayMode) llama a `set(token, valor)` desde los eventos del navegador y del mando, y a
 * `step()` UNA vez por fotograma antes de la lógica; después, `pressed / justPressed / justReleased / strength` valen para ese fotograma.
 *  · `set(token, v)`: v ∈ [0, 1]. Una tecla repetida (1 → 1) no genera «justPressed».
 *  · Si una entrada se pulsa y se suelta dentro del mismo fotograma no se pierde: cuenta como justPressed y justReleased.
 *  · Una acción está «pressed» con fuerza ≥ 0.5; los ejes del mando aplican su zona muerta.
 */
export class InputState {
  constructor(map = defaultInputMap()) {
    this.held = new Map()        // token → fuerza 0..1
    this._edgeDown = new Set()   // entradas que se pulsaron desde el último step()
    this._edgeUp = new Set()
    this.rawDown = new Set(); this.rawUp = new Set() // lo mismo, congelado para el fotograma en curso
    this.st = new Map()          // acción → { s, p, jp, jr }
    this.disabled = new Set()
    this.listeners = new Map()   // 'press:accion' | 'release:accion' → Set<fn>
    this.lastDevice = 'key'   // último dispositivo que inició una pulsación real
    this._pointerPending = { x: 0, y: 0 }
    this.pointerDelta = { x: 0, y: 0 }
    this.any = null              // (accion, pressed) cada vez que cambia
    this.setMap(map)
  }
  setMap(map) {
    this.map = map
    const keep = this.st
    this.st = new Map()
    for (const a of map.actions) this.st.set(a.name, keep.get(a.name) || { s: 0, p: false, jp: false, jr: false })
  }
  clear() {
    this.held.clear(); this._edgeDown.clear(); this._edgeUp.clear()
    this._pointerPending = { x: 0, y: 0 }; this.pointerDelta = { x: 0, y: 0 }
  }

  /** Delta relativo de ratón capturado. Se congela una vez por frame, como el Input Map. */
  movePointer(dx, dy) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return
    this._pointerPending.x += Math.max(-250, Math.min(250, dx))
    this._pointerPending.y += Math.max(-250, Math.min(250, dy))
  }

  set(token, v) {
    v = v > 0 ? Math.min(1, v) : 0
    const prev = this.held.get(token) || 0
    if (v > 0) this.held.set(token, v); else this.held.delete(token)
    if (prev === 0 && v > 0) this._edgeDown.add(token)
    if (prev < 0.5 && v >= 0.5) this.lastDevice = deviceOf(token)
    else if (prev > 0 && v === 0) this._edgeUp.add(token)
  }
  /** Pulso de un solo fotograma (rueda del ratón). */
  pulse(token) { this._edgeDown.add(token); this._edgeUp.add(token); this.lastDevice = deviceOf(token) }

  step() {
    this.pointerDelta = this._pointerPending
    this._pointerPending = { x: 0, y: 0 }
    this.rawDown = this._edgeDown; this.rawUp = this._edgeUp
    this._edgeDown = new Set(); this._edgeUp = new Set()
    for (const a of this.map.actions) {
      const st = this.st.get(a.name) || (this.st.set(a.name, { s: 0, p: false, jp: false, jr: false }), this.st.get(a.name))
      const was = st.p
      let s = 0, touched = false, released = false
      if (!this.disabled.has(a.name)) {
        for (const t of a.bindings) {
          let v = this.held.get(t) || 0
          if (v > 0 && padAxisOf(t)) v = v <= a.deadzone ? 0 : (v - a.deadzone) / (1 - a.deadzone)
          if (v > s) s = v
          if (this.rawDown.has(t)) touched = true
          if (this.rawUp.has(t)) released = true
        }
      }
      const p = s >= 0.5
      st.s = s; st.p = p
      st.jp = !was && (p || touched)
      st.jr = (was && !p) || (!was && touched && released && !p)
      if (st.jp) this._fire('press', a.name, true)
      if (st.jr) this._fire('release', a.name, false)
    }
  }
  _fire(kind, name, pressed) {
    this.any?.(name, pressed)
    const set = this.listeners.get(kind + ':' + name)
    if (set) for (const fn of [...set]) { try { fn() } catch (e) { console.error(e) } }
  }

  // ---- consulta por acción
  has(name) { return this.st.has(name) }
  pressed(name) { return !!this.st.get(name)?.p }
  justPressed(name) { return !!this.st.get(name)?.jp }
  justReleased(name) { return !!this.st.get(name)?.jr }
  strength(name) { return this.st.get(name)?.s || 0 }
  /** -1..1 entre dos acciones (negativa, positiva). */
  axis(neg, pos) { return this.strength(pos) - this.strength(neg) }
  /** Vector (x, y) de cuatro acciones, de longitud ≤ 1. */
  vector(negX, posX, negY, posY) {
    const x = this.axis(negX, posX), y = this.axis(negY, posY), l = Math.hypot(x, y)
    return l > 1 ? { x: x / l, y: y / l } : { x, y }
  }
  // ---- consulta por entrada (teclas «normales»: 'KeyF', 'Mouse1'…)
  key(token) { return (this.held.get(token) || 0) >= 0.5 }
  keyPressed(token) { return this.rawDown.has(token) }
  keyReleased(token) { return this.rawUp.has(token) }
  /** ¿Esta entrada pertenece a la acción? */
  bound(name, token) { return !!this.map.actions.find((a) => a.name === name)?.bindings.includes(token) }

  /** Una acción o una entrada: «jump» → acción; «KeyF» → tecla. */
  anyPressed(ref) { return this.has(ref) ? this.pressed(ref) : this.key(ref) }
  anyJustPressed(ref) { return this.has(ref) ? this.justPressed(ref) : this.keyPressed(ref) }
  anyJustReleased(ref) { return this.has(ref) ? this.justReleased(ref) : this.keyReleased(ref) }

  setEnabled(name, on) { if (on) this.disabled.delete(name); else this.disabled.add(name) }
  isEnabled(name) { return !this.disabled.has(name) }

  /** Llama a `fn` cada vez que se pulsa/suelta la acción. Devuelve la función que lo cancela. */
  on(kind, name, fn) {
    const k = kind + ':' + name
    if (!this.listeners.has(k)) this.listeners.set(k, new Set())
    this.listeners.get(k).add(fn)
    return () => this.listeners.get(k)?.delete(fn)
  }
}
