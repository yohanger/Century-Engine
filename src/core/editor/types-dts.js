// IntelliSense · lector de declaraciones .d.ts (interfaces, alias y JSDoc) a una estructura de tipos.
import { OPEN, CLOSE, splitTop, matchClose, clean } from './types-text.js'

// ---------------------------------------------------------------- lector del .d.ts
function readDoc(raw) {
  return raw.replace(/^\/\*\*/, '').replace(/\*\/$/, '').split('\n').map((l) => l.replace(/^\s*\*\s?/, '')).join('\n').trim()
}

/** Miembros de un cuerpo `{ … }` (interfaz o tipo objeto en línea). */
export function parseBody(body) {
  const members = []
  let doc = '', i = 0, depth = 0, start = 0
  const flush = (end) => {
    const t = body.slice(start, end).trim()
    start = end + 1
    if (!t) return
    const m = parseMember(t, doc)
    doc = ''
    if (m) members.push(m)
  }
  while (i < body.length) {
    const c = body[i], n = body[i + 1]
    if (c === '/' && n === '*') {
      const e = body.indexOf('*/', i + 2), end = e < 0 ? body.length : e + 2
      if (depth === 0) { if (body.slice(start, i).trim()) flush(i); doc = body[i + 2] === '*' ? readDoc(body.slice(i, end)) : doc; start = end }
      i = end; continue
    }
    if (c === '/' && n === '/') {
      const e = body.indexOf('\n', i), end = e < 0 ? body.length : e
      if (depth === 0) { if (body.slice(start, i).trim()) flush(i); start = end }
      i = end; continue
    }
    if (c === '"' || c === "'") { const e = body.indexOf(c, i + 1); i = e < 0 ? body.length : e + 1; continue }
    if (c === '>' && body[i - 1] === '=') { i++; continue }
    if (OPEN[c]) depth++
    else if (CLOSE[c]) depth--
    else if ((c === ';' || c === '\n' || c === ',') && depth === 0) {
      // una línea que termina en | (unión partida en varias líneas) continúa
      if (c === '\n' && /[|&:(,<]\s*$/.test(body.slice(start, i))) { i++; continue }
      flush(i)
    }
    i++
  }
  flush(body.length)
  return members
}

function parseMember(t, doc) {
  t = t.replace(/[;,]\s*$/, '').trim()
  const idx = /^(readonly\s+)?\[\s*[\w$]+\s*:\s*(string|number)\s*\]\s*:\s*(.+)$/s.exec(t)
  if (idx) return { name: '[index]', kind: 'index', type: clean(idx[3]), doc }
  const m = /^(readonly\s+)?([A-Za-z_$][\w$]*)\s*(\?)?\s*(<[^(]*?>)?\s*([(:])/.exec(t)
  if (!m) return null
  const base = { name: m[2], doc, readonly: !!m[1], optional: !!m[3], text: t.replace(/^readonly\s+/, '') }
  if (m[5] === ':') return { ...base, kind: 'property', type: clean(t.slice(m[0].length)) }
  const open = m[0].length - 1, close = matchClose(t, open)
  if (close < 0) return null
  const after = t.slice(close + 1).trim()
  return { ...base, kind: 'method', params: parseParams(t.slice(open + 1, close)), ret: clean(after.replace(/^:/, '')) || 'void' }
}

/** «a: number, b?: string, ...rest: T[]» → [{ name, type, optional, rest }]. */
export function parseParams(s) {
  if (!s.trim()) return []
  return splitTop(s, ',').map((p) => {
    const m = /^\s*(\.\.\.)?([\w$]+)\s*(\?)?\s*(?::\s*([\s\S]+))?$/.exec(p)
    if (!m) return { name: p.trim(), type: 'any', optional: false, rest: false }
    return { name: m[2], type: clean(m[4] || 'any'), optional: !!m[3], rest: !!m[1] }
  })
}

/** Interfaces (fusionando declaraciones repetidas) y alias de tipo de un .d.ts. */
export function parseDts(text) {
  const interfaces = new Map(), aliases = new Map()
  const re = /(\/\*\*(?:(?!\*\/)[\s\S])*\*\/\s*)?(?:export\s+)?(interface|type)\s+([A-Za-z_$][\w$]*)\s*(<[^>{=]*>)?\s*/g
  let m
  while ((m = re.exec(text))) {
    const doc = m[1] ? readDoc(m[1].trim()) : ''
    if (m[2] === 'interface') {
      let i = re.lastIndex, ext = []
      const em = /^extends\s+([^{]+)/.exec(text.slice(i))
      if (em) { ext = splitTop(em[1], ',').map((s) => clean(s.replace(/<.*$/, ''))).filter(Boolean); i += em[0].length }
      const open = text.indexOf('{', i)
      if (open < 0) continue
      const close = matchClose(text, open)
      const body = text.slice(open + 1, close)
      const prev = interfaces.get(m[3])
      const members = parseBody(body)
      if (prev) { prev.members.push(...members); prev.extends.push(...ext); prev.doc ||= doc }
      else interfaces.set(m[3], { name: m[3], doc, extends: ext, members })
      re.lastIndex = close + 1
    } else {
      // type X = …  hasta fin de línea al nivel 0
      let i = re.lastIndex
      if (text[i] !== '=') continue
      i++
      let depth = 0, k = i
      for (; k < text.length; k++) {
        const c = text[k]
        if (c === '>' && text[k - 1] === '=') continue
        if (OPEN[c]) depth++
        else if (CLOSE[c]) depth--
        else if (c === '\n' && depth <= 0 && !/[|&=,(]\s*$/.test(text.slice(i, k))) break
      }
      aliases.set(m[3], { name: m[3], doc, type: clean(text.slice(i, k)), generic: !!m[4] })
      re.lastIndex = k
    }
  }
  return { interfaces, aliases }
}
