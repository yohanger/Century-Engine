// Análisis de código para el IntelliSense, sin CodeMirror ni DOM (lo prueba «prueba retirada» en Node):
// qué es cada palabra (hover), qué llamada rodea al cursor (ayuda de parámetros) y diagnósticos.
import { createTypeEngine, mask } from './types.js'
import { jsdocLiteralDiagnostics } from './types-jsdoc.js'

// ---------------------------------------------------------------- contextos (qué nombres existen en cada tipo de código)
export const ROOT_DOCS = {
  game: 'La API del juego (LF.Game).', node: 'El nodo dueño del script (solo en recursos de tipo Nodo).', event: 'El evento que ejecuta este código (comando «Script» o condición). undefined en scripts del proyecto.',
  args: 'Argumentos con los que se llamó al script (game.call / «Llamar función de script»).',
  ui: 'Abrir y cerrar pantallas y Canvas.', play: 'Estado de la partida: diálogo, opciones, indicación, fundido…', props: 'Parámetros recibidos con game.ui.open(nombre, props).',
  close: 'close(resultado): cierra esta pantalla; game.ui.open() devuelve el resultado.', call: 'call(nombre, ...args): equivale a game.call(nombre, ...args).',
  asset: 'asset("nombre"): URL de un archivo del proyecto (imágenes, fuentes…).', ref: 'ref(valor): estado reactivo; se lee y escribe con .value.',
  reactive: 'reactive(objeto): objeto reactivo.', computed: 'computed(() => …): valor derivado que se recalcula solo.', watch: 'watch(fuente, (nuevo, viejo) => …)',
  watchEffect: 'watchEffect(() => …): se repite cuando cambia lo que lee.', onMounted: 'onMounted(() => …): al mostrarse la pantalla.',
  onUnmounted: 'onUnmounted(() => …): al cerrarse.', nextTick: 'await nextTick(): espera al siguiente repintado.', onUpdate: 'onUpdate((dt) => …): cada fotograma (dt en segundos).',
}
export const CONTEXTS = {
  script: { game: 'Game', event: 'EventHandle', args: 'any[]' },
  nodeScript: { game: 'Game', node: 'NodeScriptHandle' },
  ui: {
    game: 'Game', ui: 'UiApi', play: 'UiPlay', props: 'Record<string, any>', close: '(result?: any) => void', call: '(name: string, ...args: any[]) => Promise<any>',
    asset: '(name: string) => string', ref: '(value?: any) => UiRef', computed: '(fn: () => any) => UiRef', reactive: '(obj: object) => any',
    watch: '(source: any, fn: (value: any, old: any) => void) => void', watchEffect: '(fn: () => void) => void', onMounted: '(fn: () => void) => void',
    onUnmounted: '(fn: () => void) => void', nextTick: '() => Promise<void>', onUpdate: '(fn: (dt: number) => void) => void',
  },
}


/** Las capacidades específicas solo se habilitan con asociaciones inequívocas. */
export function scriptRoots(context = 'script', ownerType = null) {
  const roots = CONTEXTS[context] || CONTEXTS.script
  return context === 'nodeScript' && ownerType === 'characterbody3d'
    ? { ...roots, node: 'CharacterBody3DNodeScriptHandle' } : roots
}

/** Analizador sobre un .d.ts (game-api.d.ts). */
export function createAnalysis(dts) {
  const engine = createTypeEngine(dts)
  function wordAt(text, pos) {
    let a = pos, b = pos
    while (a > 0 && /[\w$]/.test(text[a - 1])) a--
    while (b < text.length && /[\w$]/.test(text[b])) b++
    return a < b ? { from: a, to: b, word: text.slice(a, b) } : null
  }
  /** Qué es la palabra en `pos`: { from, to, entries, prefix } o { from, to, type, title }. */
  function describeAt(text, pos, roots) {
    const w = wordAt(text, pos)
    if (!w) return null
    const mk = mask(text, w.from)
    if (mk.string || mk.comment) return null
    const prev = text[w.from - 1]
    if (prev === '.') {
      const exprEnd = text[w.from - 2] === '?' ? w.from - 2 : w.from - 1
      const start = engine.expressionStart(mk.text, exprEnd)
      const expr = text.slice(start, exprEnd)
      const ctx = engine.contextAt(text, start, roots)
      const owner = engine.evaluate(expr, ctx).type
      const entries = owner && engine.memberEntries(owner, w.word)
      if (entries) return { ...w, entries, prefix: /^[A-Za-z_$][\w$]*$/.test(expr) ? `${expr}.` : '', owner }
      return null
    }
    if (Object.prototype.hasOwnProperty.call(roots, w.word)) {
      const t = roots[w.word]
      return { ...w, title: `${/=>/.test(t) ? 'function' : 'const'} ${w.word}: ${t}`, doc: ROOT_DOCS[w.word] || engine.interfaceDoc(t) }
    }
    const ctx = engine.contextAt(text, w.from, roots)
    const t = ctx.lookup(w.word)
    if (t) return { ...w, title: `${w.word}: ${t}`, doc: engine.interfaceDoc(t.replace(/\s*\|.*$/, '')) }
    return null
  }
  /** Firma de la llamada que rodea a `pos`: { entries, active (sobrecarga), param } o null. */
  function signatureAt(text, pos, roots) {
    const mk = mask(text, pos)
    if (mk.comment && !mk.string) return null
    const cc = engine.callContext(text, mk.string ? mk.string.start : pos, mk.text)
    if (!cc) return null
    const ctx = engine.contextAt(text, cc.open, roots)
    const entries = engine.evaluateCallee(cc.callee, ctx)
    if (!entries?.length) return null
    const chosen = engine.pickOverload(entries, cc.args)
    return { entries, active: Math.max(0, entries.indexOf(chosen)), param: cc.argIndex, callee: cc.callee, open: cc.open }
  }
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
  /**
   * Diagnósticos del código: [{ from, to, severity, message }]. `kind`: 'script' (cuerpo de función async) o 'ui' (setup síncrono).
   * Se puede llamar sin editor (pruebas): `tree` es opcional.
   */
  function diagnose(text, { context = 'script', ownerType = null, names = {}, tree = null } = {}) {
    const roots = scriptRoots(context, ownerType)
    const out = []
    // 1) sintaxis: el mismo compilador que usa el juego
    try {
      if (context === 'ui') new Function(...Object.keys(roots), text) // eslint-disable-line no-new-func
      else if (context === 'nodeScript') new Function('game', 'node', `"use strict";\n${text}`)
      else new AsyncFunction('game', 'event', 'args', `"use strict";\n${text}`)
    } catch (e) {
      let at = text.length
      if (tree) tree.iterate({ enter: (n) => { if (n.type.isError && at === text.length) { at = n.from; return false } } })
      const line = Math.max(0, text.lastIndexOf('\n', at - 1) + 1)
      out.push({ from: Math.min(at, text.length), to: Math.min(Math.max(at + 1, text.indexOf('\n', at) < 0 ? text.length : text.indexOf('\n', at)), text.length), severity: 'error', message: `Error de sintaxis: ${e.message}`, source: 'js', line })
      return out // con errores de sintaxis el resto de comprobaciones daría falsos avisos
    }
    if (!tree) return out
    const mk = mask(text)
    let count = 0
    tree.iterate({
      enter: (n) => {
        if (count > 600) return false
        if (n.name === 'MemberExpression') {
          count++
          const prop = n.node.lastChild
          if (!prop || prop.name !== 'PropertyName') return
          let dot = prop.from
          while (dot > n.from && text[dot - 1] !== '.') dot--
          const exprEnd = text[dot - 2] === '?' ? dot - 2 : dot - 1
          const expr = text.slice(n.from, exprEnd)
          if (!expr.trim() || /\n\s*\n/.test(expr)) return
          const ctx = engine.contextAt(text, n.from, roots)
          const owner = engine.evaluate(expr, ctx).type
          const sh = owner && engine.shape(owner)
          if (!sh || sh.index || sh.open || !['interface', 'object'].includes(sh.kind)) return
          if (sh.kind === 'interface' && !engine.isInterface(sh.name)) return
          const name = text.slice(prop.from, prop.to)
          if (!sh.members.has(name)) {
            const near = closest(name, [...sh.members.keys()])
            out.push({ from: prop.from, to: prop.to, severity: 'warning', message: `«${name}» no existe en ${sh.kind === 'interface' ? sh.name : 'este objeto'}.${near ? ` ¿Querías decir «${near}»?` : ''}` })
          }
        } else if (n.name === 'CallExpression' && context === 'script') {
          // promesa sin await en una sentencia suelta: game.say("…") sin await no espera
          const parent = n.node.parent
          if (parent?.name !== 'ExpressionStatement') return
          const callee = n.node.firstChild
          if (!callee) return
          const ctx = engine.contextAt(text, n.from, roots)
          const entries = engine.evaluateCallee(text.slice(callee.from, callee.to), ctx)
          const args = text.slice(callee.to + 1, n.to - 1)
          const e = entries && engine.pickOverload(entries, args)
          if (e && /^Promise</.test(e.ret) && WAITS.has(e.name)) {
            out.push({ from: callee.from, to: callee.to, severity: 'info', message: `${text.slice(callee.from, callee.to)}() devuelve una promesa: sin await el script sigue sin esperar a que termine.` })
          }
        } else if (n.name === 'String') {
          // nombres del proyecto que no existen: game.node('Puerta2')
          const val = text.slice(n.from + 1, n.to - 1)
          if (!val || /\$\{/.test(val)) return
          const cc = engine.callContext(text, n.from, mk.text)
          if (!cc || cc.objectAt != null) return
          const ctx = engine.contextAt(text, cc.open, roots)
          const entries = engine.evaluateCallee(cc.callee, ctx)
          const e = entries && engine.pickOverload(entries, cc.args)
          const p = e && engine.paramAt(e, cc.argIndex)
          const keys = p ? engine.projectKeysOf(p.type) : []
          if (!keys.length) return
          const known = keys.flatMap((k) => names[k] || [])
          if (!known.length || known.includes(val) || /^\d+$/.test(val)) return
          const near = closest(val, known)
          out.push({ from: n.from + 1, to: n.to - 1, severity: 'info', message: `No hay ${KEY_NAME[keys[0]] || keys[0]} «${val}» en el proyecto${keys[0] === 'nodes' || keys[0] === 'events' ? ' (en esta escena)' : ''}.${near ? ` ¿«${near}»?` : ''}` })
        }
      },
    })
    return [...out, ...jsdocLiteralDiagnostics(text)]
  }
  const WAITS = new Set(['say', 'choose', 'wait', 'fade', 'caption', 'teleport', 'teleportTo', 'moveRoute', 'goScene', 'common', 'move', 'fadeTo', 'turnOn', 'turnOff', 'play', 'attach', 'release', 'throw', 'waitFor'])
  const KEY_NAME = { texts: 'ninguna clave de localización', languages: 'ningún idioma', nodes: 'ningún nodo', events: 'ningún evento', switches: 'ningún interruptor', variables: 'ninguna variable', scenes: 'ninguna escena', timelines: 'ninguna cinemática', uis: 'ninguna interfaz', clips: 'ningún audio', groups: 'ningún grupo de audio', items: 'ningún objeto', actors: 'ningún personaje', commonEvents: 'ningún evento común' }
  function closest(word, list) {
    let best = null, bd = 3
    const w = word.toLowerCase()
    for (const c of list) {
      const d = lev(w, c.toLowerCase())
      if (d < bd) { bd = d; best = c }
    }
    return best
  }
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 3) return 9
    const dp = Array.from({ length: b.length + 1 }, (_, i) => i)
    for (let i = 1; i <= a.length; i++) {
      let prev = dp[0]; dp[0] = i
      for (let j = 1; j <= b.length; j++) { const tmp = dp[j]; dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = tmp }
    }
    return dp[b.length]
  }

  return { engine, describeAt, signatureAt, diagnose }
}

/** Índice de navegación del script: funciones, señales, game.define y regiones. */
function scanOutline(text) {
  const out = []
  const masked = mask(text)
  const m = masked.text
  const lineOf = (i) => text.slice(0, i).split('\n').length
  const push = (i, label, kind) => out.push({ label, kind, pos: i, line: lineOf(i) })
  let x
  const reDef = /\bgame\.(define|on|once)\(\s*(['"`])([^'"`]+)\2/g
  while ((x = reDef.exec(text))) if (m[x.index] === 'g') push(x.index, x[1] === 'define' ? x[3] : `${x[1]}('${x[3]}')`, x[1] === 'define' ? 'define' : 'on')
  const reFn = /\b(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g
  while ((x = reFn.exec(m))) push(x.index, x[1], 'function')
  const reArrow = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^()]*\)|[A-Za-z_$][\w$]*)\s*=>/g
  while ((x = reArrow.exec(m))) push(x.index, x[1], 'function')
  const reRegion = /\/\/\s*(?:#region|MARK:)\s*(.+)/g
  while ((x = reRegion.exec(text))) {
    if (masked.unclosedBlockStart >= 0 && x.index >= masked.unclosedBlockStart) continue
    push(x.index, x[1].trim(), 'region')
  }
  return { items: out.sort((a, b) => a.pos - b.pos), unclosedBlockStart: masked.unclosedBlockStart }
}

export function outlineOf(text) { return scanOutline(text).items }

/**
 * Estado de navegación desacoplado del análisis sintáctico transitorio.
 * Si `/*` está abierto, conserva solo símbolos conocidos que han pasado a ser comentario,
 * marcándolos provisionales. No altera la sintaxis, el código ni el diagnóstico del editor.
 * `mapPosition` permite usar el mapeo de cambios nativo de CodeMirror.
 */
export function outlineForDocument(text, previous = [], mapPosition = (pos) => pos) {
  const { items, unclosedBlockStart } = scanOutline(text)
  if (unclosedBlockStart < 0) return { items, pending: false, unclosedBlockStart: -1 }

  const confirmed = items.filter((item) => item.pos < unclosedBlockStart)
  const carried = previous.filter((item) => item.pos >= 0).map((item) => {
    const mapped = mapPosition(item.pos)
    if (!Number.isFinite(mapped)) return null
    const pos = Math.max(0, Math.min(text.length, mapped))
    return { ...item, pos, line: text.slice(0, pos).split('\n').length, provisional: true }
  }).filter((item) => item && item.pos >= unclosedBlockStart &&
    !confirmed.some((known) => known.pos === item.pos && known.kind === item.kind && known.label === item.label))

  return {
    items: [...confirmed, ...carried].sort((a, b) => a.pos - b.pos),
    pending: true,
    unclosedBlockStart,
  }
}

/**
 * Trozo de JavaScript de una plantilla .ui que contiene `pos`: el interior de {{ … }} o el valor de un atributo v-* / :* / @*.
 * { start, end } o null si `pos` está en HTML normal.
 */
export function jsSegment(text, pos) {
  const open = text.lastIndexOf('{{', pos - 1)
  if (open >= 0 && text.lastIndexOf('}}', pos - 1) < open) {
    const close = text.indexOf('}}', pos)
    return { start: open + 2, end: close < 0 ? text.length : close }
  }
  const lineStart = text.lastIndexOf('\n', pos - 1) + 1
  const before = text.slice(Math.max(lineStart, pos - 2000), pos)
  const m = /\s(?:v-[\w:.-]+|:[\w.-]+|@[\w.-]+)="([^"]*)$/.exec(before)
  if (!m) return null
  const start = pos - m[1].length
  const close = text.indexOf('"', pos)
  return { start, end: close < 0 ? text.length : close }
}

