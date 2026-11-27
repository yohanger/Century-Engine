// Tipos JSDoc del documento activo. No ejecuta código ni modifica los scripts del usuario.
// Solo interpreta declaraciones explícitas y tipos que el analizador actual puede representar.
import { matchClose, clean, mask } from './types-text.js'

const ID = /^[A-Za-z_$][\w$]*$/
const TAG = /@(type|typedef|property|prop|param|arg|argument|returns|return)\b/g

function comments(text) {
  const found = []
  let q = '', line = false, block = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1]
    if (line) { if (c === '\n') line = false; continue }
    if (block) { if (c === '*' && next === '/') { block = false; i++ } continue }
    if (q) { if (c === '\\') i++; else if (c === q) q = ''; continue }
    if (c === '"' || c === "'" || c === '`') { q = c; continue }
    if (c === '/' && next === '/') { line = true; i++; continue }
    if (c === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2)
      if (end < 0) break
      if (text[i + 2] === '*') found.push({ start: i, end: end + 2, raw: text.slice(i + 3, end) })
      i = end + 1
    }
  }
  return found
}

function tags(raw) {
  const out = []
  TAG.lastIndex = 0
  let m
  while ((m = TAG.exec(raw))) {
    let i = TAG.lastIndex
    while (/\s/.test(raw[i] || '') || raw[i] === '*') i++
    let type = ''
    if (raw[i] === '{') {
      const end = matchClose(raw, i)
      if (end < 0) continue // JSDoc incompleto: no adivinar un tipo
      type = clean(raw.slice(i + 1, end))
      i = end + 1
    }
    const tail = raw.slice(i).match(/^\s*(\[?[A-Za-z_$][\w$.]*(?:=[^\]]+)?\]?)/)
    const name = tail?.[1]?.replace(/^\[|\]$/g, '').replace(/=.*$/, '') || ''
    out.push({ tag: m[1], type, name, optional: tail?.[1]?.startsWith('[') || type.endsWith('=') || false })
  }
  return out
}

function normalize(t) {
  t = clean(t)
  if (t.endsWith('=')) t = t.slice(0, -1).trim()
  if (t.startsWith('...')) t = `${t.slice(3).trim()}[]`
  return t.replace(/^Array\.<(.+)>$/, 'Array<$1>').replace(/\b(Number|String|Boolean)\b/g, (s) => ({ Number: 'number', String: 'string', Boolean: 'boolean' })[s])
}

function paramList(s) {
  return s.split(',').map(p => p.trim().replace(/^\.\.\./, '').replace(/\s*=.*$/, '')).filter(p => ID.test(p))
}

/** Índice de la siguiente declaración inmediatamente posterior al comentario. */
function nextDeclaration(text, end) {
  const remaining = text.slice(end)
  const ws = /^\s*/.exec(remaining)[0]
  const start = end + ws.length
  const tail = remaining.slice(ws.length)
  let m = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(([^()]*)\)\s*\{/.exec(tail)
  if (m) return { kind: 'function', name: m[1], params: paramList(m[2]), start, body: start + m[0].length - 1 }
  m = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b/.exec(tail)
  if (!m) return null
  const aft = tail.slice(m[0].length)
  const arrow = /^\s*=\s*(?:async\s*)?(?:\(([^()]*)\)|([A-Za-z_$][\w$]*))\s*=>/.exec(aft)
  if (arrow) {
    const params = arrow[1] == null ? [arrow[2]] : paramList(arrow[1])
    const from = start + m[0].length + arrow[0].length
    const open = /\s*\{/.exec(text.slice(from))
    const body = open && open.index === 0 ? from + open[0].length - 1 : -1
    return { kind: 'function', name: m[1], params, start, body, arrow: true }
  }
  return { kind: 'variable', name: m[1], start }
}

/** JSDoc visible antes de `pos`; no mezcla tipos de otros recursos del proyecto. */
export function jsdocContext(text, pos) {
  const before = text.slice(0, pos)
  const entries = []
  const aliases = new Map()
  for (const block of comments(before)) {
    const ts = tags(block.raw)
    if (!ts.length) continue
    const def = ts.find(t => t.tag === 'typedef' && t.name && ID.test(t.name))
    if (def) {
      const properties = ts.filter(t => ['property', 'prop'].includes(t.tag) && ID.test(t.name) && t.type)
      const shape = properties.length ? `{ ${properties.map(t => `${t.name}${t.optional ? '?' : ''}: ${normalize(t.type)}`).join('; ')} }` : normalize(def.type)
      if (shape && !['Object', 'object'].includes(shape)) aliases.set(def.name, shape)
      continue
    }
    const decl = nextDeclaration(before, block.end)
    if (!decl) continue
    const type = ts.find(t => t.tag === 'type' && t.type)
    const ps = new Map(ts.filter(t => ['param', 'arg', 'argument'].includes(t.tag) && ID.test(t.name) && t.type).map(t => [t.name, t]))
    const ret = ts.find(t => ['returns', 'return'].includes(t.tag) && t.type)
    if (type || ps.size || ret) entries.push({ ...decl, type: type?.type, paramsJSDoc: ps, ret: ret?.type || null })
  }
  function resolve(type, seen = new Set()) {
    type = normalize(type)
    if (!type || seen.size > 8) return null
    return type.replace(/\b[A-Za-z_$][\w$]*\b/g, (word, at, whole) => {
      if (!aliases.has(word) || seen.has(word)) return word
      // Las claves de objeto no son identificadores de tipo.
      if (/^\s*\??\s*:/.test(whole.slice(at + word.length))) return word
      const next = new Set(seen); next.add(word)
      const r = resolve(aliases.get(word), next)
      return r ? (/\s[|&]\s/.test(r) ? `(${r})` : r) : word
    })
  }
  function variableTypeAt(name, at) {
    const found = entries.find(e => e.kind === 'variable' && e.name === name && e.start === at)
    return found?.type ? resolve(found.type) : null
  }
  function functionType(name) {
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i]
      if (e.name !== name || e.kind !== 'function' || e.start >= pos) continue
      const params = e.params.map(p => {
        const t = e.paramsJSDoc.get(p)
        return `${p}${t?.optional ? '?' : ''}: ${resolve(t?.type || 'any')}`
      }).join(', ')
      return `(${params}) => ${resolve(e.ret || 'any')}`
    }
    return null
  }
  function paramType(name, declarationAt) {
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i]
      if (e.kind !== 'function' || e.body < 0 || e.body >= pos || declarationAt < e.start || declarationAt > e.body) continue
      const close = matchClose(before, e.body)
      if (close >= 0 && close < pos) continue
      const tag = e.paramsJSDoc.get(name)
      if (tag) return resolve(tag.type)
    }
    return null
  }
  return { variableTypeAt, functionType, paramType, resolve, entries }
}

/** Diagnóstico limitado a incompatibilidades literales inequívocas; nunca ejecuta código. */
export function jsdocLiteralDiagnostics(text) {
  const out = []
  for (const block of comments(text)) {
    const t = tags(block.raw).find(t => t.tag === 'type' && ['number', 'string', 'boolean'].includes(normalize(t.type)))
    if (!t) continue
    const decl = nextDeclaration(text, block.end)
    if (!decl || decl.kind !== 'variable') continue
    const after = text.slice(decl.start)
    const m = /^(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*/.exec(after)
    if (!m) continue
    const at = decl.start + m[0].length
    const value = text.slice(at)
    const actual = /^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`$]*`)/.test(value) ? 'string'
      : /^(?:true|false)\b/.test(value) ? 'boolean'
      : /^-?\d+(?:\.\d+)?\b/.test(value) ? 'number' : null
    if (actual && actual !== normalize(t.type)) out.push({ from: at, to: at + Math.max(1, (/^[^\s;,]+/.exec(value)?.[0]?.length || 1)), severity: 'warning', message: `JSDoc declara ${normalize(t.type)}, pero el literal es ${actual}.`, source: 'jsdoc' })
  }
  return out
}
