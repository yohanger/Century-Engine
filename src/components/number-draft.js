// Un número incompleto pertenece al editor de texto, nunca al modelo del proyecto.
const VALID = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/
export function readNumberDraft(text, min = -Infinity, max = Infinity) {
  const raw = String(text).trim().replace(',', '.')
  if (!VALID.test(raw)) return null
  const value = Number(raw)
  const bounded = Math.min(max, Math.max(min, value))
  return Number.isFinite(value) && Number.isFinite(bounded) ? bounded : null
}
