// IntelliSense · utilidades de texto: partir por el nivel superior, emparejar paréntesis, limpiar tipos y enmascarar cadenas y comentarios.

// ---------------------------------------------------------------- utilidades de texto
export const OPEN = { '(': ')', '[': ']', '{': '}', '<': '>' }
export const CLOSE = { ')': '(', ']': '[', '}': '{', '>': '<' }

/** Divide `s` por `sep` (un carácter) solo al nivel 0 de paréntesis, corchetes, llaves y <>. `=>` no cierra un <. */
export function splitTop(s, sep) {
  const out = []
  let depth = 0, start = 0, q = null
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue }
    if (c === '"' || c === "'" || c === '`') { q = c; continue }
    if (c === '>' && s[i - 1] === '=') continue
    if (OPEN[c]) depth++
    else if (CLOSE[c]) depth--
    else if (c === sep && depth === 0) { out.push(s.slice(start, i)); start = i + 1 }
  }
  out.push(s.slice(start))
  return out
}

/** Índice del cierre que corresponde a la apertura en `i` (o -1). Respeta cadenas y no confunde `=>` con un >. */
export function matchClose(s, i) {
  const open = s[i], close = OPEN[open]
  let depth = 0, q = null
  for (let k = i; k < s.length; k++) {
    const c = s[k]
    if (q) { if (c === '\\') k++; else if (c === q) q = null; continue }
    if ((c === '"' || c === "'" || c === '`') && open !== '<') { q = c; continue }
    if (c === '>' && s[k - 1] === '=') continue
    if (c === open) depth++
    else if (c === close && --depth === 0) return k
  }
  return -1
}

export const clean = (t) => {
  t = String(t ?? '').trim().replace(/\bLF\./g, '')
  while (t.startsWith('(') && matchClose(t, 0) === t.length - 1 && !/=>/.test(t.slice(matchClose(t, 0) + 1))) t = t.slice(1, -1).trim()
  return t
}
export const NULLISH = new Set(['undefined', 'null', 'void', 'never'])
/** Quita undefined/null de una unión: «NodeHandle | undefined» → «NodeHandle». */
export function nonNull(t) {
  const parts = splitTop(clean(t), '|').map(clean).filter((p) => p && !NULLISH.has(p))
  return parts.join(' | ')
}
export const isFnType = (t) => { t = clean(t); if (!t.startsWith('(')) return false; const j = matchClose(t, 0); return j > 0 && /^\s*=>/.test(t.slice(j + 1)) }

/**
 * Enmascara cadenas y comentarios (mismo largo; deja las comillas) para poder buscar paréntesis y comas sin que un «(» dentro de un texto
 * cuente. Devuelve también si `pos` cae dentro de una cadena y dónde empieza.
 */
export function mask(text, pos = text.length) {
  const cursor = Math.max(0, Math.min(text.length, pos))
  let out = '', q = null, start = -1, inLine = false, inBlock = false, blockStart = -1
  let atString = null, atComment = false, captured = false

  // La información contextual corresponde al cursor, no al final del documento.
  function capture() {
    if (captured) return
    atString = q ? { quote: q, start } : null
    atComment = inLine || inBlock
    captured = true
  }
  for (let i = 0; i < text.length; i++) {
    if (i >= cursor) capture()
    const c = text[i], n = text[i + 1]
    if (inLine) { if (c === '\n') { inLine = false; out += c } else out += ' '; continue }
    if (inBlock) {
      if (c === '*' && n === '/') {
        // Si el cursor está entre los dos caracteres del cierre, continúa dentro del comentario.
        if (cursor === i + 1) capture()
        inBlock = false; blockStart = -1; out += '  '; i++
      } else out += c === '\n' ? c : ' '
      continue
    }
    if (q) {
      if (c === '\\') {
        if (cursor === i + 1) capture()
        out += '  '; i++; continue
      }
      if (c === q) { q = null; out += c; continue }
      out += c === '\n' ? c : ' '
      continue
    }
    if (c === '/' && n === '/') {
      inLine = true
      if (cursor === i + 1) capture()
      out += '  '; i++; continue
    }
    if (c === '/' && n === '*') {
      inBlock = true; blockStart = i
      if (cursor === i + 1) capture()
      out += '  '; i++; continue
    }
    if (c === '"' || c === "'" || c === '`') { q = c; start = i; out += c; continue }
    out += c
  }
  if (!captured) capture()
  return { text: out, string: atString, comment: atComment, unclosedBlockStart: inBlock ? blockStart : -1 }
}
