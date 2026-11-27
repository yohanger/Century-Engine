// Motor de tipos del IntelliSense (sin DOM ni CodeMirror: lo prueban «prueba retirada» en Node).
//
// Lee game-api.d.ts (interfaces, alias y JSDoc) y entiende lo justo de JavaScript para saber qué hay a la izquierda de un punto:
//   game.node('Puerta').light.            → LightHandle
//   const l = game.lights('Pasillo')[0]; l.  → LightHandle
//   for (const n of game.findByTag('X'))   → n: NodeHandle
//   game.on('footstep', (e) => e.          → { surface, running, landing }
//   (await game.save.info(1)).             → SaveInfo
// Todo es por texto (no hace falta un árbol sintáctico válido mientras se escribe). Lo que no sabe resolver devuelve null y el editor no
// sugiere ni avisa nada: mejor callar que inventar.

const ID = /[A-Za-z_$][\w$]*/y
const isId = (c) => !!c && /[\w$]/.test(c)

import { BUILTINS } from './types-builtins.js'
import { jsdocContext } from './types-jsdoc.js'
import { OPEN, CLOSE, splitTop, matchClose, clean, nonNull, isFnType, mask } from './types-text.js'
export { splitTop, matchClose, nonNull, mask }
import { parseBody, parseParams, parseDts } from './types-dts.js'
export { parseBody, parseParams, parseDts }
// ---------------------------------------------------------------- motor
const GLOBAL_TYPES = { Math: 'Math', JSON: 'JSON', console: 'Console', Object: 'Object' }
const PROJECT_KEYS = ['switches', 'variables', 'nodes', 'events', 'scenes', 'prefabs', 'timelines', 'uis', 'clips', 'groups', 'slots', 'items', 'weapons', 'armors', 'skills', 'actors', 'classes', 'enemies', 'states', 'quests', 'lore', 'commonEvents', 'texts', 'languages']

export function createTypeEngine(dts) {
  const parsed = parseDts(dts + '\n' + BUILTINS)
  const { interfaces, aliases } = parsed
  const cache = new Map()

  const subst = (entry, T) => {
    if (!T) return entry
    const r = (s) => (s ? s.replace(/\bT\b/g, /[|&]/.test(T) ? `(${T})` : T) : s)
    return { ...entry, type: r(entry.type), ret: r(entry.ret), params: entry.params?.map((p) => ({ ...p, type: r(p.type) })), text: r(entry.text) }
  }

  function interfaceMembers(name, seen = new Set()) {
    const it = interfaces.get(name)
    if (!it || seen.has(name)) return []
    seen.add(name)
    return [...it.members, ...it.extends.flatMap((e) => interfaceMembers(e, seen))]
  }

  /** Descripción resoluble de un tipo: { kind, name?, members: Map(nombre → [entradas]), index? } o null si no se sabe. */
  function shape(t) {
    t = nonNull(t)
    if (!t) return null
    if (cache.has(t)) return cache.get(t)
    cache.set(t, null) // corta ciclos
    const r = computeShape(t)
    cache.set(t, r)
    return r
  }
  const group = (list, T) => {
    const map = new Map()
    let index = null
    for (const e0 of list) {
      const e = subst(e0, T)
      if (e.kind === 'index') { index = e.type; continue }
      if (!map.has(e.name)) map.set(e.name, [])
      map.get(e.name).push(e)
    }
    return { map, index }
  }
  function computeShape(t) {
    const parts = splitTop(t, '|').map(clean).filter(Boolean)
    if (parts.length > 1) {
      if (parts.every((p) => /^['"`]/.test(p) || p === 'string')) return shape('string')
      const firstObj = parts.find((p) => shape(p) && !['string', 'number', 'boolean'].includes(p))
      return firstObj ? shape(firstObj) : shape(parts[0])
    }
    if (/^['"`]/.test(t) || t === 'string') { const g = group(interfaceMembers('__String')); return { kind: 'string', name: 'string', members: g.map } }
    if (t === 'number' || /^-?\d/.test(t)) { const g = group(interfaceMembers('__Number')); return { kind: 'number', name: 'number', members: g.map } }
    if (t === 'boolean' || t === 'true' || t === 'false') return { kind: 'boolean', name: 'boolean', members: new Map() }
    if (['any', 'unknown', 'object', 'Function'].includes(t) || isFnType(t)) return null
    if (t.endsWith('[]')) return arrayShape(t.slice(0, -2))
    if (t.startsWith('[')) { // tupla
      const els = splitTop(t.slice(1, -1), ',').map(clean).filter((e) => e && !e.startsWith('...'))
      const uniq = [...new Set(els)]
      return arrayShape(uniq.length === 1 ? uniq[0] : uniq.join(' | '), t)
    }
    if (t.startsWith('{')) { const g = group(parseBody(t.slice(1, matchClose(t, 0)))); return { kind: 'object', name: t, members: g.map, index: g.index } }
    const gen = /^([A-Za-z_$][\w$]*)\s*<([\s\S]*)>$/.exec(t)
    if (gen) {
      const [, name, args] = gen
      const a = splitTop(args, ',').map(clean)
      if (name === 'Promise') { const g = group(interfaceMembers('__Promise'), a[0]); return { kind: 'promise', name: t, of: a[0], members: g.map } }
      if (name === 'Array') return arrayShape(a[0])
      if (name === 'Record') return { kind: 'record', name: t, members: new Map(), index: a[1] || 'any', open: true }
      if (name === 'Omit' || name === 'Partial' || name === 'Readonly' || name === 'Required') return shape(a[0])
      if (name === 'Ref') return shape('string')
      return shape(name)
    }
    const alias = aliases.get(t)
    if (alias) return shape(alias.type)
    if (interfaces.has(t)) {
      const g = group(interfaceMembers(t))
      return { kind: 'interface', name: t, doc: interfaces.get(t).doc, members: g.map, index: g.index }
    }
    return null
  }
  function arrayShape(el, name) {
    const g = group(interfaceMembers('__Array'), clean(el))
    return { kind: 'array', name: name || `${clean(el)}[]`, of: clean(el), members: g.map }
  }

  const memberEntries = (owner, name) => shape(owner)?.members.get(name) || null
  const elementType = (t) => {
    const s = shape(t)
    if (!s) return null
    if (s.kind === 'array') return s.of
    if (s.index) return s.index
    if (s.kind === 'string') return 'string'
    return null
  }
  const unwrapPromise = (t) => { const s = shape(t); return s?.kind === 'promise' ? s.of : t }
  /** Tipo de lo que devuelve llamar a una función `(a) => R`. */
  const fnReturn = (t) => { t = clean(t); const j = matchClose(t, 0); return clean(t.slice(j + 1).replace(/^\s*=>/, '')) }
  const fnParams = (t) => { t = clean(t); const j = matchClose(t, 0); return parseParams(t.slice(1, j)) }

  /** Primer argumento si es un literal de texto («footstep» en game.on('footstep', …)). */
  const firstLiteral = (args) => { const m = /^\s*(['"`])([^'"`]*)\1/.exec(args || ''); return m ? m[2] : null }
  /** Elige la sobrecarga: la que nombra el literal del primer argumento; si no, la genérica (string); si no, la primera. */
  function pickOverload(entries, args) {
    if (!entries?.length) return null
    if (entries.length === 1) return entries[0]
    const lit = firstLiteral(args)
    if (lit != null) {
      const hit = entries.find((e) => literalsOf(e.params?.[0]?.type).includes(lit))
      if (hit) return hit
    }
    return entries.find((e) => clean(e.params?.[0]?.type) === 'string') || entries[0]
  }

  /** Literales de texto de un tipo: «'out' | 'in'» → ['out', 'in'] (resuelve alias como WeatherId). */
  function literalsOf(t, depth = 0) {
    if (!t || depth > 4) return []
    const out = []
    for (const p of splitTop(clean(t), '|').map(clean)) {
      const m = /^(['"`])(.*)\1$/.exec(p)
      if (m) out.push(m[2])
      else if (aliases.has(p) && !aliases.get(p).generic) out.push(...literalsOf(aliases.get(p).type, depth + 1))
    }
    return out
  }
  /** Claves del proyecto que acepta un tipo: Ref<'items' | 'weapons'> → ['items', 'weapons']; NodeLike → ['nodes']. */
  function projectKeysOf(t, depth = 0) {
    if (!t || depth > 4) return []
    const out = []
    for (const p of splitTop(clean(t), '|').map(clean)) {
      const m = /^Ref\s*<([\s\S]*)>$/.exec(p)
      if (m) out.push(...literalsOf(m[1]).filter((k) => PROJECT_KEYS.includes(k)))
      else if (aliases.has(p)) out.push(...projectKeysOf(aliases.get(p).type, depth + 1))
    }
    return [...new Set(out)]
  }

  // ------------------------------------------------ evaluación de expresiones
  /**
   * Tipo de una expresión encadenada: `game.node('x').light`, `(await game.save.info(1)).name`, `lista[0]`…
   * ctx = { roots: { nombre: tipo }, lookup(nombre) → tipo | null }. Devuelve { type, entries } (entries = sobrecargas si lo último era un método).
   */
  function evaluate(src, ctx = {}, depth = 0) {
    let s = String(src || '').trim()
    if (!s || depth > 8) return { type: null, entries: null }
    let awaited = false
    const aw = /^await\s+/.exec(s)
    if (aw) { awaited = true; s = s.slice(aw[0].length) }
    if (/^new\s/.test(s)) return { type: null, entries: null }
    let i = 0, cur = null, entries = null
    const c0 = s[0]
    if (c0 === '(') {
      const j = matchClose(s, 0)
      if (j < 0) return { type: null, entries: null }
      cur = evaluate(s.slice(1, j), ctx, depth + 1).type
      i = j + 1
    } else if (c0 === '"' || c0 === "'" || c0 === '`') {
      const j = s.indexOf(c0, 1)
      cur = 'string'; i = j < 0 ? s.length : j + 1
    } else if (/\d/.test(c0)) {
      const m = /^\d[\d_.eE]*/.exec(s); cur = 'number'; i = m[0].length
    } else if (c0 === '[') {
      const j = matchClose(s, 0); cur = 'any[]'; i = j < 0 ? s.length : j + 1
    } else {
      ID.lastIndex = 0
      const m = ID.exec(s)
      if (!m) return { type: null, entries: null }
      const name = m[0]
      i = name.length
      if (name === 'true' || name === 'false') cur = 'boolean'
      else if (ctx.roots && Object.prototype.hasOwnProperty.call(ctx.roots, name)) cur = ctx.roots[name]
      else cur = ctx.lookup?.(name, depth + 1) ?? GLOBAL_TYPES[name] ?? null
      if (cur && isFnType(cur) && s[i] !== '(') { /* referencia a una función */ }
    }
    while (i < s.length) {
      while (/\s/.test(s[i] || '')) i++
      if (i >= s.length) break
      const c = s[i]
      if (c === '!' && s[i + 1] !== '=') { i++; continue }
      if (c === '.' || (c === '?' && s[i + 1] === '.')) {
        i += c === '.' ? 1 : 2
        while (/\s/.test(s[i] || '')) i++
        if (s[i] === '(' || s[i] === '[') continue // ?.( y ?.[
        ID.lastIndex = i
        const m = ID.exec(s)
        if (!m) { cur = null; entries = null; break }
        i += m[0].length
        const found = memberEntries(cur, m[0])
        if (found) {
          if (found[0].kind === 'method') { entries = found; cur = null }
          else { entries = null; cur = found[0].type + (found[0].optional ? '' : '') }
        } else {
          const sh = shape(cur)
          cur = sh?.index || null
          entries = null
        }
        continue
      }
      if (c === '(') {
        const j = matchClose(s, i)
        const args = j < 0 ? s.slice(i + 1) : s.slice(i + 1, j)
        if (entries) cur = pickOverload(entries, args)?.ret || null
        else if (cur && isFnType(cur)) cur = fnReturn(cur)
        else cur = null
        entries = null
        if (j < 0) break
        i = j + 1
        continue
      }
      if (c === '[') {
        const j = matchClose(s, i)
        cur = elementType(cur)
        entries = null
        if (j < 0) break
        i = j + 1
        continue
      }
      // operador u otra cosa: la expresión no es una cadena simple
      return { type: null, entries: null }
    }
    if (awaited) { cur = cur ? unwrapPromise(cur) : cur; entries = null }
    return { type: cur ? clean(cur) : null, entries }
  }

  /** Inicio de la expresión encadenada que termina en `end` (en texto ya enmascarado). Incluye un `await` delante. */
  function expressionStart(m, end) {
    let i = end
    for (let guard = 0; guard < 200; guard++) {
      while (i > 0 && isId(m[i - 1])) i--
      const prev = m[i - 1]
      if ((prev === ')' || prev === ']') && (i === end || !isId(m[i]))) {
        // ( … ) o [ … ] pegado a lo que viene detrás: busca su apertura
        let depth = 0, k = i - 1
        for (; k >= 0; k--) {
          const ch = m[k]
          if (CLOSE[ch] && ch !== '>') depth++
          else if (OPEN[ch] && ch !== '<' && --depth === 0) break
        }
        if (k < 0) break
        i = k
        // `foo(…)` / `a.b[…]`: sigue con lo que hay delante; `(…)` suelto es un paréntesis primario
        if (isId(m[i - 1]) || m[i - 1] === ')' || m[i - 1] === ']' || (m[i - 1] === '.' && m[i - 2] === '?')) continue
        // ¿un punto antes del paréntesis primario? (raro) → termina
        break
      }
      let k = i
      while (k > 0 && /\s/.test(m[k - 1])) k--
      if (m[k - 1] === '.' && m[k - 2] !== '.') {
        k--
        if (m[k - 1] === '?') k--
        while (k > 0 && /\s/.test(m[k - 1])) k--
        i = k
        continue
      }
      break
    }
    // `await a.b().` es await de toda la cadena: lo que va tras el punto se aplica antes del await, así que no se incluye
    return i
  }

  /**
   * Llamada que rodea a `pos`: { callee, argIndex, open, objectAt } — objectAt es el `{` sin cerrar de un objeto literal que es ese argumento.
   * null si no estamos dentro de los argumentos de una llamada.
   */
  function callContext(text, pos, masked) {
    const m = masked ?? mask(text, pos).text
    let depth = 0, commas = 0, objectAt = null, objDepth = 0
    const stop = Math.max(0, pos - 6000)
    for (let k = pos - 1; k >= stop; k--) {
      const c = m[k]
      if (c === ')' || c === ']' || c === '}') { depth++; continue }
      if (c === '(' || c === '[' || c === '{') {
        if (depth > 0) { depth--; continue }
        if (c === '{') {
          // el `{` de un objeto literal argumento ( `f(a, { …` ) o un bloque (cuerpo de función, if…): en un bloque paramos
          let p = k - 1
          while (p >= 0 && /\s/.test(m[p])) p--
          if (m[p] === '(' || m[p] === ',' || m[p] === ':' || (m[p] === '[')) {
            if (objectAt == null) { objectAt = k; objDepth = 0 }
            objDepth++
            commas = 0
            continue
          }
          return null
        }
        if (c === '[') { commas = 0; objectAt = null; continue }
        // c === '('
        const start = expressionStart(m, k)
        const callee = text.slice(start, k).trim()
        if (!callee || /^(if|for|while|switch|catch|function|return|typeof|await)$/.test(callee) || /[^\w$.?\s)\]]$/.test(callee)) return null
        // número de argumento: comas al nivel 0 entre ( y pos (contando desde el objeto si lo hay)
        const until = objectAt ?? pos
        let d = 0, idx = 0
        for (let q = k + 1; q < until; q++) {
          const ch = m[q]
          if (ch === '(' || ch === '[' || ch === '{') d++
          else if (ch === ')' || ch === ']' || ch === '}') d--
          else if (ch === ',' && d === 0) idx++
        }
        // ¿estamos en la clave o en el valor de una propiedad del objeto?
        let objectKey = null
        if (objectAt != null) {
          let d2 = 0, lastSep = objectAt
          for (let q = objectAt + 1; q < pos; q++) {
            const ch = m[q]
            if (ch === '(' || ch === '[' || ch === '{') d2++
            else if (ch === ')' || ch === ']' || ch === '}') d2--
            else if (ch === ',' && d2 === 0) lastSep = q
          }
          const seg = text.slice(lastSep + 1, pos)
          const km = /^\s*([\w$]+)\s*:\s*/.exec(seg)
          objectKey = km ? km[1] : null
        }
        return { callee, argIndex: idx, open: k, objectAt, objectKey, args: text.slice(k + 1, pos) }
      }
      if (depth === 0 && c === ';') return null
    }
    return null
  }

  /** Tipo del parámetro `paramIndex` de una función flecha que se pasa como argumento `argIndex` a la llamada `callee(args)`. */
  function callbackParamType(callee, args, argIndex, paramIndex, ctx) {
    const r = evaluateCallee(callee, ctx)
    const e = pickOverload(r, args)
    if (!e) return null
    const p = paramAt(e, argIndex)
    if (!p || !isFnType(nonNull(p.type))) return null
    const ps = fnParams(nonNull(p.type))
    const q = ps[paramIndex]
    return q ? (q.rest ? elementType(q.type) : q.type) : null
  }
  const paramAt = (e, i) => {
    const ps = e?.params || []
    if (i < ps.length) return ps[i]
    const last = ps[ps.length - 1]
    return last?.rest ? { ...last, type: elementType(last.type) || 'any' } : null
  }
  /** Sobrecargas del método al que se llama: `game.node` → [entrada de node]. */
  function evaluateCallee(callee, ctx) {
    const r = evaluate(callee, ctx)
    if (r.entries) return r.entries
    if (r.type && isFnType(r.type)) return [{ name: callee, kind: 'method', params: fnParams(r.type), ret: fnReturn(r.type), doc: '', text: `${callee}${r.type}` }]
    return null
  }

  /**
   * Busca el tipo de una variable local en el texto anterior a `pos`: const/let/var x = expr, for (const x of expr), y parámetros de funciones
   * flecha pasadas a métodos conocidos (forEach, game.on, …). `roots` se añade al contexto. Devuelve un ctx listo para evaluate().
   */
  function contextAt(text, pos, roots = {}) {
    const before = text.slice(0, pos)
    const m = mask(before).text
    const memo = new Map()
    const jsdoc = jsdocContext(text, pos)
    const ctx = { roots }
    ctx.lookup = (name, depth = 0) => {
      if (depth > 6) return null
      if (memo.has(name)) return memo.get(name)
      memo.set(name, null)
      const r = findVar(name, depth) || jsdoc.functionType(name)
      memo.set(name, r)
      return r
    }
    const esc = (s) => s.replace(/\$/g, '\\$')
    function stmtEnd(from) {
      let d = 0
      for (let k = from; k < m.length; k++) {
        const c = m[k]
        if (OPEN[c] && c !== '<') d++
        else if (CLOSE[c] && c !== '>') { if (d === 0) return k; d-- }
        else if (d === 0 && (c === ';' || c === ',')) return k
        else if (d === 0 && c === '\n') {
          const rest = m.slice(k + 1)
          if (!/^\s*[.?]/.test(rest)) return k
        }
      }
      return m.length
    }
    function findVar(name, depth) {
      const cands = []
      const decl = new RegExp(`\\b(?:const|let|var)\\s+${esc(name)}\\b`, 'g')
      let x
      while ((x = decl.exec(m))) {
        const next = /^\s*=\s*/.exec(m.slice(decl.lastIndex))
        cands.push({ at: x.index, kind: next ? 'decl' : 'noinit', from: decl.lastIndex + (next?.[0].length || 0) })
      }
      const forOf = new RegExp(`\\bfor\\s*\\(\\s*(?:const|let|var)\\s+${esc(name)}\\s+of\\s+`, 'g')
      while ((x = forOf.exec(m))) cands.push({ at: x.index, kind: 'of', from: x.index + x[0].length })
      // (a, b) => … | a => … | function (a, b) {
      const arrow = /(\(([^()]*)\)|([A-Za-z_$][\w$]*))\s*=>|function\s*[\w$]*\s*\(([^()]*)\)/g
      while ((x = arrow.exec(m))) {
        const list = (x[2] ?? x[3] ?? x[4] ?? '').split(',').map((s) => s.trim().replace(/[=:].*$/, '').trim())
        const pi = list.indexOf(name)
        if (pi >= 0) cands.push({ at: x.index, kind: 'param', paramIndex: pi })
      }
      cands.sort((a, b) => b.at - a.at)
      for (const c of cands) {
        if (c.kind === 'decl' || c.kind === 'noinit') {
          const annotated = jsdoc.variableTypeAt(name, c.at)
          if (annotated) return annotated
          if (c.kind === 'noinit') return null
          const end = stmtEnd(c.from)
          const sub = contextAtText(c.at)
          const t = evaluate(before.slice(c.from, end), sub, depth).type
          if (t) return t
          return null
        }
        if (c.kind === 'of') {
          let d = 0, k = c.from
          for (; k < m.length; k++) { if (m[k] === '(') d++; else if (m[k] === ')') { if (d === 0) break; d-- } }
          const t = evaluate(before.slice(c.from, k), contextAtText(c.at), depth).type
          return t ? elementType(t) : null
        }
        if (c.kind === 'param') {
          const annotated = jsdoc.paramType(name, c.at)
          if (annotated) return annotated
          const cc = callContext(before, c.at, m)
          if (!cc) continue
          return callbackParamType(cc.callee, cc.args, cc.argIndex, c.paramIndex, contextAtText(cc.open))
        }
      }
      return null
    }
    // contexto para evaluar algo que aparece antes (evita que `const n = n.x` se resuelva consigo mismo)
    const contextAtText = (at) => (at >= pos ? ctx : contextAt(text, at, roots))
    return ctx
  }

  // ------------------------------------------------ consultas para el editor
  /** Miembros sugeribles tras `expr.` → [{ name, entries }] o null. */
  function membersAfter(expr, ctx) {
    const t = evaluate(expr, ctx).type
    const s = t && shape(t)
    if (!s) return null
    return { type: t, shape: s, list: [...s.members.entries()].map(([name, entries]) => ({ name, entries })) }
  }

  /** Valores de texto que acepta el parámetro: literales, nombres del proyecto o las claves de las sobrecargas (game.on). */
  function stringChoices(callee, args, argIndex, ctx, names = {}) {
    const entries = evaluateCallee(callee, ctx)
    if (!entries) return null
    const out = []
    const seen = new Set()
    const add = (label, detail, info) => { if (!seen.has(label)) { seen.add(label); out.push({ label, detail, info }) } }
    const list = argIndex === 0 && entries.length > 1 ? entries : [pickOverload(entries, args)]
    for (const e of list) {
      const p = paramAt(e, argIndex)
      if (!p) continue
      for (const lit of literalsOf(p.type)) add(lit, entries.length > 1 && argIndex === 0 ? 'señal' : 'valor', e.doc)
      for (const key of projectKeysOf(p.type)) for (const n of names[key] || []) add(n, KEY_LABEL[key] || key)
    }
    return out
  }
  /** Propiedades del objeto literal que se pasa como argumento (opciones: { fadeOut, fadeIn… }). */
  function objectKeys(callee, args, argIndex, ctx) {
    const entries = evaluateCallee(callee, ctx)
    const e = pickOverload(entries, args)
    const p = e && paramAt(e, argIndex)
    const s = p && shape(p.type)
    if (!s || (s.kind !== 'object' && s.kind !== 'interface')) return null
    return [...s.members.entries()].map(([name, list]) => ({ name, entries: list }))
  }
  /** Valores posibles de una propiedad de un objeto literal argumento: { group: '…' } → grupos de audio. */
  function objectValueChoices(callee, args, argIndex, key, ctx, names = {}) {
    const entries = evaluateCallee(callee, ctx)
    const e = pickOverload(entries, args)
    const p = e && paramAt(e, argIndex)
    const s = p && shape(p.type)
    const m = s?.members.get(key)?.[0]
    if (!m) return null
    const out = literalsOf(m.type).map((label) => ({ label, detail: 'valor' }))
    for (const k of projectKeysOf(m.type)) for (const n of names[k] || []) out.push({ label: n, detail: KEY_LABEL[k] || k })
    return out
  }

  return {
    parsed, shape, evaluate, memberEntries, elementType, literalsOf, projectKeysOf, pickOverload, paramAt,
    expressionStart, callContext, contextAt, membersAfter, evaluateCallee, stringChoices, objectKeys, objectValueChoices,
    interfaceDoc: (name) => interfaces.get(name)?.doc || aliases.get(name)?.doc || '',
    isInterface: (name) => interfaces.has(name) && !name.startsWith('__'),
  }
}

const KEY_LABEL = {
  prefabs: 'prefab',
  switches: 'interruptor', variables: 'variable', nodes: 'nodo', events: 'evento', scenes: 'escena', timelines: 'cinemática', uis: 'interfaz',
  clips: 'audio', groups: 'grupo de audio', slots: 'slot', items: 'objeto', weapons: 'arma', armors: 'armadura', skills: 'habilidad', actors: 'personaje',
  classes: 'clase', enemies: 'enemigo', states: 'estado', quests: 'misión', lore: 'documento', commonEvents: 'evento común', texts: 'texto localizado', languages: 'idioma',
}

/** Firma legible de una entrada: «node(name: NodeLike): NodeHandle | undefined» o «light: LightHandle | undefined». */
export function signatureOf(e, prefix = '') {
  if (!e) return ''
  if (e.kind === 'method') return `${prefix}${e.name}(${e.params.map((p) => `${p.rest ? '...' : ''}${p.name}${p.optional ? '?' : ''}: ${p.type}`).join(', ')}): ${e.ret}`
  return `${prefix}${e.readonly ? 'readonly ' : ''}${e.name}${e.optional ? '?' : ''}: ${e.type}`
}
/** Tipo corto para la columna de detalle de las sugerencias. */
export function shortType(e) {
  const t = e.kind === 'method' ? e.ret : e.type
  const s = String(t || '').replace(/\s+/g, ' ')
  return s.length > 34 ? s.slice(0, 32) + '…' : s
}
