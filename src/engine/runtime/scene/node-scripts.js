import { getNativeSignal } from '../nodes/registry.js'
import { compileScript, createScriptConsole } from '../host.js'
import { analyzeScriptEditables, editableValuesForNode } from './script-editables.js'

// Scripts adjuntos a nodos: usa los recursos JavaScript del proyecto y el mismo ciclo de vida de SceneGraph.
// No administra un árbol propio ni registra callbacks globales. Cada nodo recibe su propio cierre JavaScript.
const CALLBACKS = ['_enter_tree', '_ready', '_process', '_physics_process', '_exit_tree']
const RESERVED_METHODS = new Set(CALLBACKS)

/** Compatibilidad de lectura: scriptIds es autoritativo cuando existe; scriptId solo para escenas antiguas. */
export function nodeScriptIds(obj) {
  if (Array.isArray(obj?.scriptIds)) return obj.scriptIds
  return obj?.scriptId ? [obj.scriptId] : []
}

/**
 * Descubrimiento conservador para el Inspector. No invoca eval, Function ni callbacks.
 * El lexer omite comentarios, textos, plantillas y expresiones regulares; solo reconoce
 * node.define_signal('literal') / node.define_signal("literal") con un argumento exacto.
 * Cualquier otro caso se informa como indeterminado, no como una señal activa.
 */
function signalTokens(code) {
  const tokens = []
  const isStart = c => /[a-zA-Z_$]/.test(c || '')
  const isPart = c => /[\w$]/.test(c || '')
  const text = typeof code === 'string' ? code : ''
  const n = text.length
  const skipQuote = (from, quote) => {
    let i = from + 1
    let escaped = false
    let value = ''
    while (i < n) {
      const c = text[i++]
      if (c === '\\') { escaped = true; i++; continue }
      if (c === quote) return { end: i, value, valid: !escaped }
      if (c === '\n' || c === '\r') break
      value += c
    }
    return { end: i, value: null, valid: false }
  }
  const skipTemplate = (from) => {
    let i = from + 1
    while (i < n) {
      if (text[i] === '\\') { i += 2; continue }
      if (text[i++] === '`') return i
    }
    return i
  }
  let i = 0
  while (i < n) {
    const c = text[i]
    if (/\s/.test(c)) { i++; continue }
    if (c === '/' && text[i + 1] === '/') {
      i += 2; while (i < n && text[i] !== '\n') i++
      continue
    }
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2); i = end < 0 ? n : end + 2
      continue
    }
    if (c === '"' || c === "'") {
      const parsed = skipQuote(i, c)
      tokens.push({ type: 'string', value: parsed.value, valid: parsed.valid })
      i = parsed.end; continue
    }
    if (c === '`') { i = skipTemplate(i); tokens.push({ type: 'template' }); continue }
    // Los literales regex no son código ejecutable. Un slash en posición de
    // expresión puede iniciar uno; no inspeccionar su contenido como declaraciones.
    const prev = tokens.at(-1)
    const regexContext = !prev || ['(', '[', '{', '=', ':', ',', ';', '!', '?', '=>'].includes(prev.value) ||
      (prev.type === 'id' && ['return', 'throw', 'case', 'yield', 'await'].includes(prev.value))
    if (c === '/' && regexContext) {
      let j = i + 1, charClass = false, closed = false
      while (j < n && text[j] !== '\n' && text[j] !== '\r') {
        if (text[j] === '\\') { j += 2; continue }
        if (text[j] === '[') charClass = true
        else if (text[j] === ']') charClass = false
        else if (text[j] === '/' && !charClass) { closed = true; j++; break }
        j++
      }
      if (closed) {
        while (j < n && /[a-z]/i.test(text[j])) j++
        i = j; tokens.push({ type: 'regex' }); continue
      }
    }
    if (isStart(c)) {
      let j = i + 1; while (j < n && isPart(text[j])) j++
      tokens.push({ type: 'id', value: text.slice(i, j) }); i = j; continue
    }
    if (c === '?' && text[i + 1] === '.') { tokens.push({type:'punct',value:'?.'}); i += 2; continue }
    if (c === '=' && text[i + 1] === '>') { tokens.push({type:'punct',value:'=>' }); i += 2; continue }
    tokens.push({ type: 'punct', value: c }); i++
  }
  return tokens
}

function literalSignalCalls(code) {
  const tokens = signalTokens(code), found = [], dynamic = []
  for (let i = 0; i + 4 < tokens.length; i++) {
    const t = tokens[i]
    if (t.type !== 'id' || t.value !== 'node' || tokens[i-1]?.value === '.' || tokens[i-1]?.value === '?.' ||
        tokens[i+1]?.value !== '.' || tokens[i+2]?.value !== 'define_signal' || tokens[i+3]?.value !== '(') continue
    const arg = tokens[i+4], close = tokens[i+5]
    if (arg.type === 'string' && arg.valid && close?.value === ')' && arg.value?.trim() === arg.value && arg.value.length) {
      found.push(arg.value)
    } else {
      dynamic.push('Argumento dinámico, no literal o no compatible con el análisis estático')
    }
  }
  return { found, dynamic }
}

/** Metadata de autoría detectada; no demuestra ejecución ni muta las señales del runtime. */
export function discoverNodeSignals(obj, scripts = []) {
  const signals = new Map(), diagnostics = []
  const seenScriptIds = new Set()
  for (const scriptId of nodeScriptIds(obj)) {
    if (typeof scriptId !== 'string' || !scriptId || seenScriptIds.has(scriptId)) {
      diagnostics.push({ scriptId: String(scriptId), kind: 'association', detail: 'Referencia de script duplicada o inválida' })
      continue
    }
    seenScriptIds.add(scriptId)
    const script = scripts.find(s => s.id === scriptId)
    if (!script || script.execution !== 'node') {
      diagnostics.push({ scriptId, kind: 'missing', detail: 'Script de Nodo no disponible o no marcado como Nodo' })
      continue
    }
    const { found, dynamic } = literalSignalCalls(script.code)
    for (const detail of dynamic) diagnostics.push({ scriptId, kind: 'dynamic', detail })
    for (const name of found) {
      let signal = signals.get(name)
      if (!signal) {
        signal = { name, owners: [], nativeCollision: !!getNativeSignal(obj?.type, name), duplicate: false }
        signals.set(name, signal)
      }
      if (signal.owners.includes(scriptId) || signal.owners.length) signal.duplicate = true
      signal.owners.push(scriptId)
    }
  }
  return { signals: [...signals.values()], diagnostics }
}

/**
 * Métodos declarados literalmente mediante node.expose(nombre, callback).
 * Reutiliza el lexer del Inspector; no interpreta ni ejecuta código del usuario.
 * Detectar la llamada no demuestra que el callback se registre durante Play.
 */
function literalExposeCalls(code) {
  const tokens = signalTokens(code), found = [], dynamic = []
  for (let i = 0; i + 4 < tokens.length; i++) {
    if (tokens[i].type !== 'id' || tokens[i].value !== 'node' ||
        ['.', '?.'].includes(tokens[i - 1]?.value) || tokens[i + 1]?.value !== '.' ||
        tokens[i + 2]?.value !== 'expose' || tokens[i + 3]?.value !== '(') continue
    const arg = tokens[i + 4], separator = tokens[i + 5], callback = tokens[i + 6]
    if (arg?.type === 'string' && arg.valid && arg.value?.trim() === arg.value && arg.value.length &&
        separator?.value === ',' && callback && ![')', ',', ';'].includes(callback.value) &&
        !(callback.type === 'id' && ['null', 'undefined'].includes(callback.value))) {
      found.push(arg.value)
    } else {
      dynamic.push('node.expose(): nombre dinámico, inválido o llamada sin callback reconocible')
    }
  }
  return { found, dynamic }
}

/** Construye una inserción conservadora; solo valida sintaxis, nunca evalúa el script. */
export function buildNodeCallbackCode(code, name, argNames = []) {
  if (typeof code !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(name) || RESERVED_METHODS.has(name))
    throw new Error('Nombre de callback inválido o reservado')
  const keywords = new Set(['await','break','case','catch','class','const','continue','debugger','default','delete','do','else','enum','export','extends','false','finally','for','function','if','import','in','instanceof','new','null','return','super','switch','this','throw','true','try','typeof','var','void','while','with','yield'])
  if (keywords.has(name)) throw new Error('Nombre de callback reservado por JavaScript')
  if (!Array.isArray(argNames) || argNames.some(a => !/^[A-Za-z_$][\w$]*$/.test(a) || keywords.has(a)) || new Set(argNames).size !== argNames.length)
    throw new Error('Firma de la señal no compatible con generación automática')
  // Un enlace léxico llamado node interceptaría la API inyectada en el punto de inserción.
  if (/\b(?:const|let|var|function|class)\s+node\b/.test(code)) throw new Error('El script declara un identificador node incompatible')
  const compile = (text) => new Function('game', 'node', `"use strict";\n${text}\nreturn {};`)
  try { compile(code) } catch { throw new Error('El script receptor tiene errores de sintaxis') }
  const nl = code.includes('\r\n') ? '\r\n' : '\n'
  const call = `node.expose(${JSON.stringify(name)}, function (${argNames.join(', ')}) {${nl}  // Implementar respuesta a la señal.${nl}});${nl}${nl}`
  // La inserción al principio evita que un return anterior deje inaccesible la publicación.
  // Una directiva estricta inicial mantiene su posición y semántica.
  const directive = code.match(/^(\s*(['"])use strict\2\s*;?[ \t]*(?:\r?\n)?)/)
  const offset = directive ? directive[0].length : 0
  const next = code.slice(0, offset) + call + code.slice(offset)
  try { compile(next) } catch { throw new Error('No es segura la inserción en este script') }
  return next
}

/** Descubrimiento de autoría de métodos, no confirmación de registro en runtime. */
export function discoverNodeMethods(obj, scripts = []) {
  const methods = new Map(), diagnostics = [], seenScriptIds = new Set()
  for (const scriptId of nodeScriptIds(obj)) {
    if (typeof scriptId !== 'string' || !scriptId || seenScriptIds.has(scriptId)) {
      diagnostics.push({ scriptId: String(scriptId), kind: 'association', detail: 'Referencia de script duplicada o inválida' })
      continue
    }
    seenScriptIds.add(scriptId)
    const script = scripts.find(s => s.id === scriptId)
    if (!script || script.execution !== 'node') {
      diagnostics.push({ scriptId, kind: 'missing', detail: 'Script de Nodo no disponible o no marcado como Nodo' })
      continue
    }
    const { found, dynamic } = literalExposeCalls(script.code)
    for (const detail of dynamic) diagnostics.push({ scriptId, kind: 'dynamic', detail })
    for (const name of found) {
      let method = methods.get(name)
      if (!method) {
        method = { name, owners: [], duplicate: false, reserved: RESERVED_METHODS.has(name) }
        methods.set(name, method)
      }
      if (method.owners.length) method.duplicate = true
      method.owners.push(scriptId)
    }
  }
  return { methods: [...methods.values()], diagnostics }
}

/** Resuelve la jerarquía del proyecto, sin árbol ni índice duplicado. */
export function resolveNodePath(objects, origin, path) {
  const text = String(path ?? '')
  const absolute = text.startsWith('/')
  let current = absolute ? null : origin
  for (const part of text.split('/').filter(Boolean)) {
    if (part === '.') continue
    if (part === '..') {
      if (!current) return null
      current = current.parentId ? objects.find((o) => o.id === current.parentId) || null : null
      continue
    }
    current = objects.find((o) => (o.parentId || null) === (current?.id || null) && (o.id === part || o.name === part)) || null
    if (!current) return null
  }
  return current
}

export class NodeScriptRuntime {
  constructor(play) {
    this.play = play
    this.instances = new Map()
    this.nativeSources = new Map() // Solo conexiones físicas activas: no es otro bus de eventos.
    this.sceneConnections = new Map() // Identidades de conexiones autoradas activadas en S04/S05.
    this.sceneConnectionErrors = new Map() // Diagnósticos deduplicados por carga/cambio de escena.
  }

  _report(error, obj, method = 'script') {
    const name = obj?.name || obj?.id || 'desconocido'
    if (this._spawnInitIds?.has(obj?.id)) this._spawnInitFailure ??= error
    // Una inicialización asíncrona que falle después de _ready también invalida
    // la aparición diferida, pero nunca una instancia ajena ni la escena siguiente.
    else if (/_enter_tree|_ready/.test(method) && this.play?._nativePlayerId) {
      const owner = [...(this.play._runtimePrefabInstances?.values() || [])]
        .find(p => p.ids.has(this.play._nativePlayerId) && p.ids.has(obj?.id))
      if (owner) Promise.resolve().then(() => {
        if (this.play.on && this.play.project?.activeSceneId === owner.scene &&
            this.play._runtimePrefabInstances?.get(owner.rootId) === owner)
          this.play._prefabDestroy(owner.rootId)
      })
    }
    if (this.play.game?.report) this.play.game.report(error, `Nodo ${name} · ${method}`)
    else console.error(`Nodo ${name} · ${method}`, error)
  }

  _handle(obj, entry, slot) {
    const node = this.play._nodeHandle(obj.id)
    if (!node) throw new Error(`Nodo sin representación activa: ${obj.id}`)
    if (!('get_node' in node)) {
      const alive = () => this.play.project.objects.includes(obj) && this.play.ed?.nodes?.has(obj.id) !== false
      const requireAlive = () => { if (!alive()) throw new Error(`Referencia de nodo inválida: ${obj.id}`) }
      Object.defineProperties(node, {
        children: { get: () => { requireAlive(); return this.play.project.objects.filter((o) => o.parentId === obj.id).map((o) => this.play._nodeHandle(o.id)).filter(Boolean) } },
        parent: { get: () => { requireAlive(); return obj.parentId ? this.play._nodeHandle(obj.parentId) || null : null } },
        get_node: { value: (path) => { requireAlive(); const o = resolveNodePath(this.play.project.objects, obj, path); return o ? this.play._nodeHandle(o.id) || null : null } },
      })
    }
    const requireSlot = () => {
      if (!slot.active || slot.exiting || !this._isCurrentEntry(entry)) throw new Error(`Script de nodo inactivo: ${obj.id} · ${slot.scriptId}`)
    }
    Object.defineProperty(node, 'expose', { value: (name, fn) => {
      requireSlot()
      if (typeof name !== 'string' || !name.trim() || name !== name.trim() || RESERVED_METHODS.has(name)) throw new Error(`Nombre de método público inválido: ${String(name)}`)
      if (typeof fn !== 'function') throw new TypeError(`node.expose(${name}) requiere una función`)
      if (entry.conflictedMethods.has(name)) throw new Error(`Método público ambiguo ${name} en nodo ${obj.id}`)
      const owner = entry.methodOwners.get(name)
      if (owner) {
        if (owner === slot) throw new Error(`Método público duplicado: ${name} · ${slot.scriptId}`)
        // Ningún script gana una colisión por orden accidental.
        entry.methods.delete(name)
        entry.methodOwners.delete(name)
        entry.conflictedMethods.add(name)
        throw new Error(`Método público ambiguo ${name} entre ${owner.scriptId} y ${slot.scriptId} en ${obj.id}`)
      }
      entry.methods.set(name, fn)
      entry.methodOwners.set(name, slot)
    } })
    Object.defineProperties(node, {
      define_signal: { value: (name) => {
        requireSlot()
        const key = this._signalName(name)
        if (getNativeSignal(obj.type, key)) throw new Error(`Señal nativa reservada: ${obj.type}.${key}`)
        if (entry.conflictedSignals.has(key)) throw new Error(`Señal de nodo ambigua: ${key}`)
        const owner = entry.signalOwners.get(key)
        if (owner) {
          if (owner === slot) throw new Error(`Señal de nodo duplicada: ${key} · ${slot.scriptId}`)
          const signal = entry.signals.get(key)
          for (const c of [...(signal || [])]) this._disconnectConnection(c)
          entry.signals.delete(key)
          entry.signalOwners.delete(key)
          entry.conflictedSignals.add(key)
          throw new Error(`Señal de nodo ambigua ${key} entre ${owner.scriptId} y ${slot.scriptId} en ${obj.id}`)
        }
        entry.signals.set(key, new Set())
        entry.signalOwners.set(key, slot)
      } },
      emit_signal: { value: (name, ...args) => {
        requireSlot()
        return this.emitSignal(obj, name, args)
      } },
    })
    return node
  }

  _isCurrentEntry(entry) {
    return !!(entry && this.instances.get(entry.obj.id) === entry && entry.active && !entry.exiting &&
      entry.idsKey === JSON.stringify(nodeScriptIds(entry.obj)) && entry.node?.is_valid?.())
  }

  _signalName(name) {
    if (typeof name !== 'string' || !name.trim() || name !== name.trim()) {
      throw new Error(`Nombre de señal de nodo inválido: ${String(name)}`)
    }
    return name
  }

  /** Comprueba identidad, sesión y fase. Nunca reorienta una conexión al mismo ID recreado. */
  _requireEntry(obj) {
    const entry = obj && this.instances.get(obj.id)
    if (!entry || entry.obj !== obj || !this._isCurrentEntry(entry)) {
      throw new Error(`Script de nodo no disponible: ${obj?.id ?? 'desconocido'}`)
    }
    return entry
  }

  /** Resuelve únicamente un handle vigente del SceneGraph, no un ID suelto. */
  _receiverEntry(handle) {
    if (!handle || typeof handle.is_valid !== 'function' || !handle.is_valid()) {
      throw new Error('Receptor de señal inválido')
    }
    const obj = handle.object3D?._lfNodeOwner
    if (!obj || obj.id !== handle.id) throw new Error('Receptor de señal sin identidad activa')
    return this._requireEntry(obj)
  }

  /** El sensor Jolt es la única fuente de señales nativas; su identidad no se resuelve solo por ID. */
  _nativeArea(emitter) {
    const spatial = this.play.phys?.nodeSpatial
    const area = spatial?.areas?.get(emitter.id)
    const node = this.play._nodeHandle(emitter.id)
    if (!spatial || spatial.disposed || !area?.active || area.obj !== emitter ||
        !node?.is_valid?.() || node.object3D?._lfNodeOwner !== emitter) {
      throw new Error(`Area3D sin sensor activo o referencia inválida: ${emitter.id}`)
    }
    return { spatial, node }
  }

  /** Un único contenedor nativo por nodo: soporta Jolt y ciclo de vida sin buses paralelos. */
  _nativeSource(emitter, node, create) {
    let source = this.nativeSources.get(emitter)
    if (!source && create) {
      source = { native: true, obj: emitter, node, signals: new Map() }
      this.nativeSources.set(emitter, source)
    }
    return source || null
  }

  _nativeSignal(emitter, name, create) {
    const meta = getNativeSignal(emitter.type, name)
    if (!meta || !['jolt-area', 'node-lifecycle', 'audio-voice', 'animation-runner'].includes(meta.source)) {
      throw new Error(`Emisor nativo sin adaptador: ${emitter.type}.${name}`)
    }
    let node, spatial = null
    if (meta.source === 'jolt-area') ({ node, spatial } = this._nativeArea(emitter))
    else {
      const life = this.play.ed?.nodeLifecycle
      node = this.play._nodeHandle(emitter.id)
      if (!life?.active || life.entered.get(emitter.id)?.obj !== emitter || !node?.is_valid?.() ||
          node.object3D?._lfNodeOwner !== emitter) {
        throw new Error(`Nodo sin ciclo de vida activo: ${emitter.id}`)
      }
    }
    const source = this._nativeSource(emitter, node, create)
    if (!source) return null
    let slot = source.signals.get(name)
    // Una recreación de Jolt no debe reorientar conexiones a otro sensor.
    if (slot && meta.source === 'jolt-area' && slot.spatial !== spatial) {
      for (const connection of [...slot.signal]) this._disconnectConnection(connection)
      // Si era el último listener, _disconnectConnection retiró el contenedor.
      if (!slot.signal.size) { slot.off?.(); source.signals.delete(name) }
      if (!this.nativeSources.has(emitter) && create) this.nativeSources.set(emitter, source)
      slot = null
    }
    if (!slot && create) {
      const signal = new Set()
      const off = meta.source === 'jolt-area'
        ? spatial.onArea(emitter.id, name, (event) => this._dispatchSignal(signal, name, [event])) : null
      slot = { signal, off, spatial, nativeSource: meta.source }
      source.signals.set(name, slot)
    }
    return slot ? { source, signal: slot.signal } : null
  }

  /** Emisión síncrona del ciclo de vida. En salida la identidad se valida en la fase del emisor,
   * incluso si ya se retiró del índice de escena; los receptores sí deben seguir vigentes. */
  emitLifecycle(obj, name, leaving = false) {
    const slot = this.nativeSources.get(obj)?.signals.get(name)
    if (slot?.nativeSource === 'node-lifecycle') this._dispatchSignal(slot.signal, name, [], leaving ? obj : null)
  }

  emitLifecycleReady(obj) { this.emitLifecycle(obj, 'ready') }

  /** AudioScene ya verificó la voz y su token. Validar también la identidad activa del nodo. */
  emitNativeAudioFinished(obj) {
    if (getNativeSignal(obj?.type, 'finished')?.source !== 'audio-voice') return
    const slot = this.nativeSources.get(obj)?.signals.get('finished')
    if (slot?.nativeSource === 'audio-voice') this._dispatchSignal(slot.signal, 'finished', [])
  }

  /** El reproductor ya confirmó el final natural; esta ruta conserva las conexiones de Nodo. */
  emitNativeAnimationFinished(obj, clipName) {
    if (getNativeSignal(obj?.type, 'animation_finished')?.source !== 'animation-runner') return
    const slot = this.nativeSources.get(obj)?.signals.get('animation_finished')
    if (slot?.nativeSource === 'animation-runner') this._dispatchSignal(slot.signal, 'animation_finished', [clipName])
  }

  connectSignal(emitter, name, receiver, method, authoredId = null) {
    const key = this._signalName(name)
    const native = getNativeSignal(emitter.type, key)
    // Validar primero el receptor para no dejar listeners vacíos en Jolt ante errores.
    const target = this._receiverEntry(receiver)
    if (typeof method !== 'string' || !method.trim() || method !== method.trim() || !this.hasPublic(target.obj, method)) {
      throw new Error(`Método receptor no publicado: ${target.obj.id}.${String(method)}`)
    }
    const resolved = native ? this._nativeSignal(emitter, key, true) : null
    const source = native ? resolved.source : this._requireEntry(emitter)
    const signal = native ? resolved.signal : source.signals.get(key)
    if (!signal) throw new Error(`Señal de nodo no declarada: ${emitter.id}.${key}`)
    if ([...signal].some((c) => c.target === target && c.method === method)) return false
    const connection = { source, target, method, signal, nativeSource: native?.source || null }
    if (authoredId) { connection.authoredId = authoredId; connection.authoredSignal = key; this.sceneConnections.set(authoredId, connection) }
    signal.add(connection)
    target.incomingSignals.add(connection)
    return true
  }

  _disconnectConnection(connection) {
    if (connection.authoredId) this.sceneConnections.delete(connection.authoredId)
    connection.signal.delete(connection)
    connection.target.incomingSignals.delete(connection)
    const source = connection.source
    if (source.native && connection.signal.size === 0) {
      for (const [name, slot] of source.signals) if (slot.signal === connection.signal) {
        slot.off?.()
        source.signals.delete(name)
        break
      }
      if (!source.signals.size) this.nativeSources.delete(source.obj)
    }
  }

  _releaseNative(obj) {
    const source = this.nativeSources.get(obj)
    if (!source) return
    for (const slot of [...source.signals.values()]) {
      for (const connection of [...slot.signal]) this._disconnectConnection(connection)
      // La señal también puede no tener receptores si falló una conexión antes de completarse.
      slot.off?.()
    }
    source.signals.clear()
    this.nativeSources.delete(obj)
  }

  disconnectSignal(emitter, name, receiver, method) {
    const key = this._signalName(name)
    const native = getNativeSignal(emitter.type, key)
    const resolved = native ? this._nativeSignal(emitter, key, false) : null
    const source = native ? resolved?.source : this._requireEntry(emitter)
    const signal = native ? resolved?.signal : source.signals.get(key)
    if (!signal) return false
    const target = this._receiverEntry(receiver)
    const connection = [...signal].find((c) => c.target === target && c.method === method)
    if (!connection) return false
    this._disconnectConnection(connection)
    return true
  }

  /** Instantánea de conexiones: desconectar antes del turno cancela, conectar durante el despacho espera. */
  _dispatchSignal(signal, name, args, leavingSource = null) {
    for (const connection of [...signal]) {
      if (!signal.has(connection) || !this._isCurrentConnection(connection, leavingSource)) continue
      try {
        const result = this.callPublic(connection.target.obj, connection.method, args)
        if (result && typeof result.then === 'function') {
          Promise.resolve(result).catch((error) => this._report(error, connection.target.obj, `signal ${name} · ${connection.method}`))
        }
      } catch (error) {
        this._report(error, connection.target.obj, `signal ${name} · ${connection.method}`)
      }
    }
  }

  /** Reconciliación tras entrada completa y antes de _ready, o al cambiar la escena. Nunca por fotograma. */
  syncSceneConnections({ onlySignal = null } = {}) {
    if (!this.play._sceneSignalReady || !this.play.on) return
    const desired = this.play.project.signalConnections || []
    const activeScene = this.play.project.activeSceneId
    const desiredById = new Map(desired.map((c) => [c.id, c]))
    for (const [id, connection] of [...this.sceneConnections]) {
      const record = desiredById.get(id)
      if (!record || record.emitterId !== connection.source.obj.id || record.receiverId !== connection.target.obj.id ||
          record.signal !== connection.authoredSignal || record.method !== connection.method ||
          !connection.signal.has(connection) || !this._isCurrentConnection(connection)) {
        this._disconnectConnection(connection)
      }
    }
    const objects = new Map((this.play.project.objects || []).map((o) => [o.id, o]))
    for (const c of desired) {
      if (onlySignal && c.signal !== onlySignal) continue
      if (this.sceneConnections.has(c.id)) { this.sceneConnectionErrors.delete(c.id); continue }
      const source = objects.get(c.emitterId), target = objects.get(c.receiverId)
      try {
        if (!source || !target) throw new Error('emisor o receptor ausente de la escena')
        const emitter = this.play._nodeHandle(source.id), receiver = this.play._nodeHandle(target.id)
        if (!emitter?.is_valid?.() || !receiver?.is_valid?.()) throw new Error('nodo desmontado o inválido')
        const added = this.connectSignal(source, c.signal, receiver, c.method, c.id)
        if (!added) throw new Error('la conexión ya está gestionada por código runtime')
        this.sceneConnectionErrors.delete(c.id)
      } catch (error) {
        const reason = String(error.message || error)
        if (this.sceneConnectionErrors.get(c.id) !== reason) {
          this.sceneConnectionErrors.set(c.id, reason)
          const detail = `Conexión ${c.id} (escena ${activeScene}, ${c.emitterId}.${c.signal} → ${c.receiverId}.${c.method}): ${reason}`
          if (this.play.game?.report) this.play.game.report(new Error(detail), 'Conexiones de escena')
          else console.error(detail)
        }
      }
    }
    for (const id of [...this.sceneConnectionErrors.keys()]) if (!desiredById.has(id)) this.sceneConnectionErrors.delete(id)
  }

  /** Libera únicamente enlaces de autoría, no conexiones creadas por scripts. */
  clearSceneConnections() {
    for (const connection of [...this.sceneConnections.values()]) this._disconnectConnection(connection)
    this.sceneConnections.clear()
    this.sceneConnectionErrors.clear()
  }

  emitSignal(emitter, name, args) {
    const source = this._requireEntry(emitter)
    const signal = source.signals.get(this._signalName(name))
    if (!signal) throw new Error(`Señal de nodo no declarada: ${emitter.id}.${name}`)
    this._dispatchSignal(signal, name, args)
  }

  _isCurrentConnection(connection, leavingSource = null) {
    const { source, target } = connection
    const slot = source.native && [...source.signals.values()].find(s => s.signal === connection.signal)
    const sourceValid = !source.native ? this._isCurrentEntry(source)
      : ['node-lifecycle', 'audio-voice', 'animation-runner'].includes(connection.nativeSource)
        ? this.play.ed?.nodeLifecycle?.active &&
          (leavingSource === source.obj || (
            this.play.ed.nodeLifecycle.entered.get(source.obj.id)?.obj === source.obj &&
            source.node?.is_valid?.() && source.node.object3D?._lfNodeOwner === source.obj))
        : !!(slot && slot.spatial === this.play.phys?.nodeSpatial && !slot.spatial.disposed &&
          slot.spatial.areas.get(source.obj.id)?.obj === source.obj &&
          slot.spatial.areas.get(source.obj.id)?.active && source.node?.is_valid?.())
    return sourceValid && this._isCurrentEntry(target)
  }

  /** Un método público pertenece a la instancia activa, no al ID ni al recurso JS. */
  callPublic(obj, name, args) {
    const entry = this.instances.get(obj.id)
    if (!entry || entry.obj !== obj || !this._isCurrentEntry(entry) || !this.play._nodeEnabled(obj)) {
      throw new Error(`Script de nodo no disponible: ${obj.id}`)
    }
    if (typeof name !== 'string' || !name.trim()) throw new Error('Nombre de método público inválido')
    if (entry.conflictedMethods.has(name)) throw new Error(`Método público ambiguo: ${obj.id}.${name}`)
    const fn = entry.methods.get(name)
    if (!fn) throw new Error(`Método público no encontrado: ${obj.id}.${name}`)
    return fn.apply(entry.methodOwners.get(name)?.node || entry.node, args)
  }

  /** Consulta puntual de métodos públicos de una instancia vigente (Groups). */
  hasPublic(obj, name) {
    const entry = this.instances.get(obj.id)
    return !!(entry && entry.obj === obj && this._isCurrentEntry(entry) && this.play._nodeEnabled(obj) && entry.methods.has(name))
  }

  // Exponer únicamente las suscripciones propias de la instancia, nunca alterar game.api global.
  _scopedGame(entry) {
    const base = this.play.game.api
    const api = Object.create(base)
    api.log = (...args) => entry.console.log(...args)
    const on = (name, fn) => {
      if (typeof fn !== 'function') throw new Error('game.on necesita una función')
      if (!entry.active || entry.exiting) return () => {}
      const listener = (...args) => entry.active && !entry.exiting && this.play._nodeEnabled(entry.obj) ? fn(...args) : undefined
      const disconnect = base.on(name, listener)
      let connected = true
      const off = () => {
        if (!connected) return
        connected = false
        entry.subscriptions.delete(off)
        disconnect()
      }
      entry.subscriptions.add(off)
      return off
    }
    api.on = on
    api.once = (name, fn) => {
      if (typeof fn !== 'function') throw new Error('game.on necesita una función')
      let off = () => {}
      off = on(name, (...args) => { off(); return fn(...args) })
      return off
    }
    api.waitFor = (name, timeout = 0) => {
      if (!entry.active || entry.exiting) return Promise.resolve(undefined)
      // El mismo intérprete dispone de cancelación por contexto y elimina timers/waiters.
      if (typeof this.play.game.waitSignalResult === 'function') {
        return this.play.game.waitSignalResult(name, timeout, { waitCancels: entry.waitCancels }).then(
          (result) => entry.active && result.status === 'received' ? result.data : undefined
        )
      }
      // No iniciar esperas sin cancelación automática si el intérprete no la ofrece.
      return Promise.reject(new Error('game.waitFor requiere un intérprete con cancelación por instancia'))
    }
    return api
  }

  _releaseSlot(group, slot) {
    if (!slot?.active) return
    slot.exiting = true
    for (const cancel of [...slot.waitCancels]) cancel()
    for (const off of [...slot.subscriptions]) off()
    for (const [name, owner] of [...group.methodOwners]) if (owner === slot) {
      group.methodOwners.delete(name)
      group.methods.delete(name)
    }
    for (const [name, owner] of [...group.signalOwners]) if (owner === slot) {
      const signal = group.signals.get(name)
      for (const connection of [...(signal || [])]) this._disconnectConnection(connection)
      group.signalOwners.delete(name)
      group.signals.delete(name)
    }
    slot.active = false
    slot.subscriptions.clear()
    slot.waitCancels.clear()
  }

  _release(entry) {
    if (!entry || !entry.active) return
    entry.exiting = true
    for (const slot of [...entry.slots].reverse()) this._releaseSlot(entry, slot)
    for (const signal of entry.signals.values()) for (const connection of [...signal]) this._disconnectConnection(connection)
    for (const connection of [...entry.incomingSignals]) this._disconnectConnection(connection)
    entry.signals.clear()
    entry.incomingSignals.clear()
    entry.methods.clear()
    entry.methodOwners.clear()
    entry.signalOwners.clear()
    entry.conflictedMethods.clear()
    entry.conflictedSignals.clear()
    entry.slots.length = 0
    entry.active = false
  }

  hasCallback(id, method) {
    const name = { onProcess: '_process', onPhysicsProcess: '_physics_process' }[method]
    return !!name && !!this.instances.get(id)?.periodic[name]?.length
  }

  prepare(obj) {
    if (this.instances.get(obj.id)?.obj === obj) return
    const ids = nodeScriptIds(obj)
    if (!ids.length) return
    const entry = {
      obj, scriptId: ids[0], idsKey: JSON.stringify(ids), node: null, callbacks: null,
      slots: [], periodic: { _process: [], _physics_process: [] },
      methods: new Map(), methodOwners: new Map(), conflictedMethods: new Set(),
      signals: new Map(), signalOwners: new Map(), conflictedSignals: new Set(),
      incomingSignals: new Set(), active: true, exiting: false,
    }
    if (this.instances.has(obj.id)) throw new Error(`Instancia de Script de Nodo duplicada: ${obj.id}`)
    this.instances.set(obj.id, entry)
    const unique = new Set()
    for (const scriptId of ids) {
      if (typeof scriptId !== 'string' || !scriptId || unique.has(scriptId)) {
        this._report(new Error(`Script duplicado o ID inválido en nodo: ${String(scriptId)}`), obj, 'multiscript')
        continue
      }
      unique.add(scriptId)
      const script = this.play.project?.scripts?.find((s) => s.id === scriptId)
      if (!script || script.execution !== 'node') {
        this._report(new Error(`Script de nodo no disponible o no marcado como Nodo: ${scriptId}`), obj)
        continue
      }
      const slot = { scriptId, node: null, callbacks: null, active: true, exiting: false, subscriptions: new Set(), waitCancels: new Set() }
      try {
        slot.node = this._handle(obj, entry, slot)
        if (!entry.node) entry.node = slot.node
        // Un cierre JavaScript por recurso y por nodo. No se evalúa nuevamente cada fotograma.
        const callbackLookup = CALLBACKS.map((name) => `${name}: typeof ${name} === 'function' ? ${name} : null`).join(',\n')
        slot.console = createScriptConsole(() => this.play.game?.host || this.play.rt, `Nodo ${obj.name || obj.id} · ${script.name || scriptId}`, () => slot.active)
        const editable = analyzeScriptEditables(script.code)
        if (editable.diagnostics.length) throw new Error(editable.diagnostics.map(d => `Línea ${d.line}: ${d.message}`).join('; '))
        const parameters = editable.fields.length ? ['game', 'node', '__centuryEditableValues'] : ['game', 'node']
        const factory = compileScript(parameters, `${editable.source}\nreturn { ${callbackLookup} };`)(slot.console)
        slot.callbacks = editable.fields.length
          ? factory(this._scopedGame(slot), slot.node, editableValuesForNode(obj, scriptId, editable.fields))
          : factory(this._scopedGame(slot), slot.node)
        entry.slots.push(slot)
        if (!entry.callbacks) entry.callbacks = slot.callbacks // Compatibilidad de observación S05.
        for (const name of ['_process', '_physics_process']) if (typeof slot.callbacks?.[name] === 'function') entry.periodic[name].push(slot)
      } catch (error) {
        this._releaseSlot(entry, slot)
        if (entry.node === slot.node) entry.node = entry.slots[0]?.node || null
        this._report(error, obj, `_enter_tree · ${scriptId}`)
      }
    }
    if (!entry.slots.length) {
      this._release(entry)
      this.instances.delete(obj.id)
      return
    }
    // Los callbacks _enter_tree se despachan al entrar; preparar solo evalúa una vez el script.
  }

  enter(obj, prepared = false) {
    if (!prepared) this.prepare(obj)
    this.call(obj, 'onEnterTree')
  }

  call(obj, method, dt) {
    const entry = this.instances.get(obj.id)
    if (!entry || entry.obj !== obj || !entry.active) return
    if (!['onExitTree', 'onEnterTree', 'onReady'].includes(method) && !this.play._nodeEnabled(obj)) return
    const methodName = { onEnterTree: '_enter_tree', onReady: '_ready', onProcess: '_process', onPhysicsProcess: '_physics_process', onExitTree: '_exit_tree' }[method]
    if (!methodName) return
    const slots = methodName === '_process' || methodName === '_physics_process'
      ? entry.periodic[methodName]
      : methodName === '_exit_tree' ? [...entry.slots].reverse() : entry.slots
    for (const slot of [...slots]) {
      if (!slot.active || (slot.exiting && methodName !== '_exit_tree')) continue
      const fn = slot.callbacks?.[methodName]
      if (typeof fn !== 'function') continue
      try {
        const result = dt === undefined ? fn.call(slot.node) : fn.call(slot.node, dt)
        if (result?.catch) result.catch((error) => this._report(error, obj, `${methodName} · ${slot.scriptId}`))
      } catch (error) { this._report(error, obj, `${methodName} · ${slot.scriptId}`) }
    }
  }

  /** Separar el callback de salida y la liberación permite entregar las señales de árbol.
   * No se invalidan los receptores mientras se emite tree_exiting. */
  beginExit(obj) { this.call(obj, 'onExitTree') }

  finishExit(obj) {
    this._releaseNative(obj)
    const entry = this.instances.get(obj.id)
    if (!entry || entry.obj !== obj) return
    this._release(entry)
    this.instances.delete(obj.id)
  }

  exit(obj) {
    try { this.beginExit(obj) }
    finally { this.finishExit(obj) }
  }

  clear() {
    this.clearSceneConnections()
    for (const obj of [...this.nativeSources.keys()]) this._releaseNative(obj)
    for (const entry of this.instances.values()) this._release(entry)
    this.instances.clear()
  }
}
