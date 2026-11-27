// Casos de «Match». Las identidades no dependen de la posición: mover un caso mueve su contenido con él.
let nextId = 0
export function newMatchCase() {
  return { id: 'm' + Date.now().toString(36) + (nextId++).toString(36), src: 'number', value: 0, text: '', flag: true, variable: 1 }
}
export const matchCaseKey = (entry) => 'case:' + entry.id

export function matchBlocks(p) {
  const cases = Array.isArray(p?.cases) ? p.cases : []
  return [
    ...cases.filter((c) => c && typeof c.id === 'string' && c.id).map((c, i) => ({ key: matchCaseKey(c), label: `Case ${i + 1}: ${caseLabel(c)}` })),
    ...(p?.hasDefault ? [{ key: 'default', label: 'Default (_)' }] : []),
  ]
}

export function caseLabel(c) {
  if (c.src === 'text') return `«${String(c.text ?? '').slice(0, 32)}»`
  if (c.src === 'bool') return c.flag === false ? 'No' : 'Sí'
  if (c.src === 'variable') return `Variable #${c.variable}`
  return String(c.value ?? 0)
}

export function moveMatchCase(p, index, by) {
  const items = p?.cases
  const to = index + by
  if (!Array.isArray(items) || index < 0 || to < 0 || to >= items.length) return false
  const [item] = items.splice(index, 1)
  items.splice(to, 0, item)
  return true
}

// Match compara tipos estrictos: 1 no coincide con "1" ni con true.
export function matchCaseValue(c, getVar) {
  if (c.src === 'text') return String(c.text ?? '')
  if (c.src === 'bool') return c.flag !== false
  if (c.src === 'variable') return getVar(c.variable)
  return Number(c.value ?? 0)
}
export const matchEquals = (a, b) => (typeof a === 'number' && !Number.isFinite(a)) ? false : (typeof b === 'number' && !Number.isFinite(b)) ? false : a === b
