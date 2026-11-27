const KEYWORDS = new Set(['editable', 'header', 'header_descripcion', 'editable_descricption', 'editable_description'])
const NUMBER = '-?(?:0|[1-9]\\d*)(?:\\.\\d+)?(?:[eE][+-]?\\d+)?'
const STRING = '"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\''
const LITERAL = `(?:${STRING}|true|false|${NUMBER})`
const DECLARATION = new RegExp(`^\\s*(?:let|const|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(${LITERAL})\\s*;?\\s*(?://.*)?$`)
const ANNOTATION = /^\s*@([a-z_]+)(?:\(\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\s*\))?\s*;?\s*$/

function stringLiteral(raw) {
  if (raw[0] === '"') return JSON.parse(raw)
  const inner = raw.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"')
  return JSON.parse(`"${inner}"`)
}

function literalValue(raw) {
  if (raw[0] === '"' || raw[0] === "'") return stringLiteral(raw)
  if (raw === 'true') return true
  if (raw === 'false') return false
  const n = Number(raw)
  if (!Number.isFinite(n)) throw new Error('Número no finito')
  return n
}

function sourceMask(source) {
  let mask = '', mode = 'code', previous = '', escaped = false, characterClass = false
  for (let i = 0; i < source.length; i++) {
    const c = source[i], next = source[i + 1]
    if (mode === 'line') {
      if (c === '\n') { mode = 'code'; mask += '\n' } else mask += ' '
      continue
    }
    if (mode === 'block') {
      if (c === '*' && next === '/') { mask += '  '; i++; mode = 'code' }
      else mask += c === '\n' ? '\n' : ' '
      continue
    }
    if (mode === 'single' || mode === 'double' || mode === 'template' || mode === 'regex') {
      mask += c === '\n' ? '\n' : ' '
      if (escaped) { escaped = false; continue }
      if (c === '\\') { escaped = true; continue }
      if (mode === 'regex') {
        if (c === '[') characterClass = true
        else if (c === ']') characterClass = false
        else if (c === '/' && !characterClass) mode = 'code'
      } else if ((mode === 'single' && c === "'") || (mode === 'double' && c === '"') || (mode === 'template' && c === '`')) mode = 'code'
      continue
    }
    if (c === '/' && next === '/') { mode = 'line'; mask += '  '; i++; continue }
    if (c === '/' && next === '*') { mode = 'block'; mask += '  '; i++; continue }
    if (c === "'" || c === '"' || c === '`') { mode = c === "'" ? 'single' : c === '"' ? 'double' : 'template'; mask += ' '; continue }
    if (c === '/' && (/[=([{:,;!?]/.test(previous) || /\b(?:return|throw|case)\s*$/.test(mask.slice(Math.max(0, mask.length - 16))))) {
      mode = 'regex'; characterClass = false; mask += ' '; continue
    }
    mask += c
    if (!/\s/.test(c)) previous = c
  }
  return mask
}

/** Analiza directivas literales de nivel superior, sin ejecutar el script. */
export function analyzeScriptEditables(code) {
  const source = typeof code === 'string' ? code : ''
  const masked = sourceMask(source)
  const originalLines = source.split('\n'), maskLines = masked.split('\n')
  const fields = [], diagnostics = [], replacements = [], names = new Set()
  let depth = 0, offset = 0, pending = [], group = null, groupDescription = '', groupOrder = 0
  const error = (line, message) => diagnostics.push({ line, message })
  const flush = (line) => {
    if (pending.length) { error(line, 'Directivas sin variable @editable compatible'); pending = [] }
  }
  for (let index = 0; index < originalLines.length; index++) {
    const raw = originalLines[index], view = maskLines[index] || '', line = index + 1
    const top = depth === 0
    const at = top && /^\s*@/.test(view) ? ANNOTATION.exec(raw) : null
    if (top && /^\s*@/.test(view)) {
      if (!at || !KEYWORDS.has(at[1])) error(line, 'Directiva de Inspector no reconocida o sintaxis inválida')
      else {
        const name = at[1], argument = at[2]
        const expectsText = name !== 'editable'
        if ((expectsText && !argument) || (!expectsText && argument)) error(line, `Argumento inválido para @${name}`)
        else {
          try {
            const value = expectsText ? stringLiteral(argument) : null
            if (name === 'header') { flush(line); group = value; groupDescription = ''; groupOrder++ }
            else if (name === 'header_descripcion') {
              if (group === null) error(line, '@header_descripcion requiere @header')
              else groupDescription = value
            } else pending.push({ name, value, line })
            replacements.push({ start: offset, end: offset + raw.length, text: raw.replace(/[^\r]/g, ' ') })
          } catch { error(line, `Texto literal inválido en @${name}`) }
        }
      }
    } else if (top && pending.length && view.trim()) {
      const declaration = DECLARATION.exec(raw)
      const editable = pending.filter(p => p.name === 'editable')
      const descriptions = pending.filter(p => p.name === 'editable_descricption' || p.name === 'editable_description')
      if (!declaration || editable.length !== 1 || descriptions.length > 1) flush(line)
      else {
        const name = declaration[1], literal = declaration[2]
        try {
          const defaultValue = literalValue(literal)
          if (name === '__centuryEditableValues') error(line, `Nombre reservado para el motor: ${name}`)
          else if (names.has(name)) error(line, `Propiedad @editable duplicada: ${name}`)
          else {
            names.add(name)
            fields.push({ name, type: typeof defaultValue, defaultValue, header: group, headerDescription: groupDescription, groupOrder, description: descriptions[0]?.value || '' })
            const from = raw.indexOf(literal, raw.indexOf('=') + 1)
            const replacement = `(Object.hasOwn(__centuryEditableValues, ${JSON.stringify(name)}) ? __centuryEditableValues[${JSON.stringify(name)}] : (${literal}))`
            replacements.push({ start: offset + from, end: offset + from + literal.length, text: replacement })
          }
        } catch { error(line, `Inicializador no compatible de ${name}`) }
        pending = []
      }
    }
    for (const c of view) {
      if (c === '{') depth++
      else if (c === '}') depth = Math.max(0, depth - 1)
    }
    offset += raw.length + (index < originalLines.length - 1 ? 1 : 0)
  }
  flush(originalLines.length)
  let transformed = source, editorSource = source
  for (const r of replacements.sort((a, b) => b.start - a.start)) {
    transformed = transformed.slice(0, r.start) + r.text + transformed.slice(r.end)
    if (r.text.length === r.end - r.start) editorSource = editorSource.slice(0, r.start) + r.text + editorSource.slice(r.end)
  }
  const annotationLines = replacements.filter(r => r.text.length === r.end - r.start).map(r => ({ line: source.slice(0, r.start).split('\n').length, value: source.slice(r.start, r.end).trim() }))
  return { fields, diagnostics, source: transformed, editorSource, annotationLines }
}

export function validEditableValue(value, type) {
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value)
  return typeof value === type && (type === 'boolean' || type === 'string')
}

export function editableValuesForNode(node, scriptId, fields) {
  const saved = node?.scriptProperties?.[scriptId]
  const values = Object.create(null)
  for (const field of fields) {
    if (saved && Object.hasOwn(saved, field.name) && validEditableValue(saved[field.name], field.type)) values[field.name] = saved[field.name]
  }
  return values
}
