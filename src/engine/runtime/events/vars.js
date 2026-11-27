// Variables de juego (filosofía RPG Maker MZ: una tabla numerada 1..N, cada posición con su nombre) pero con valores de cualquier tipo:
// número, texto, sí/no, lista (array) u objeto. Las operaciones de lista viven aquí y las comparten el comando «Variable: lista» y game.variables.
// Sin DOM: lo usa el intérprete y las pruebas.

/** Copia profunda segura (solo datos JSON). */
export const cloneVal = (v) => (v !== null && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v)
/** Normaliza lo que se guarda: NaN/Infinity/undefined → 0, funciones fuera, objetos y listas copiados. */
export function normVal(v) {
  if (v === undefined || v === null) return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string' || typeof v === 'boolean') return v
  if (typeof v === 'function' || typeof v === 'symbol') return 0
  try { return cloneVal(v) } catch { return 0 }
}
export const isArr = (v) => Array.isArray(v)
/** Cómo se ve el valor dentro de un texto (\V[n], {v:n}). */
export function showVal(v) {
  if (Array.isArray(v)) return v.map(showVal).join(', ')
  if (v !== null && typeof v === 'object') return JSON.stringify(v)
  if (typeof v === 'boolean') return v ? 'sí' : 'no'
  return String(v ?? 0)
}
/** Interpreta el texto escrito en el editor: «3» → 3, «sí/no» → boolean, lista «a, b, 3» → ['a','b',3], JSON válido tal cual. */
export function parseLiteral(s) {
  const t = String(s ?? '').trim()
  if (t === '') return ''
  if (/^-?\d+(\.\d+)?$/.test(t)) return +t
  if (/^(true|false)$/i.test(t)) return t.toLowerCase() === 'true'
  if (/^[\[{]/.test(t)) { try { return JSON.parse(t) } catch { /* se trata como texto */ } }
  return t
}
export const parseList = (s) => {
  const t = String(s ?? '').trim()
  if (t === '') return []
  if (t.startsWith('[')) { try { const a = JSON.parse(t); if (Array.isArray(a)) return a } catch { /* lista separada por comas */ } }
  return t.split(',').map((x) => parseLiteral(x))
}

const num = (x) => (Number.isFinite(+x) ? +x : 0)
export const ARRAY_OPS = ['push', 'pop', 'shift', 'unshift', 'insert', 'removeAt', 'removeValue', 'setAt', 'at', 'length', 'clear', 'shuffle', 'sort', 'reverse', 'includes', 'indexOf', 'join', 'sum', 'min', 'max', 'random']
/**
 * Aplica una operación a la lista `arr` (se modifica en el sitio) y devuelve { arr, result }.
 * index: base 0 · value: dato para push/insert/setAt/includes… · sep: separador de join.
 */
export function arrayOp(arr, op, { index = 0, value, sep = ', ' } = {}) {
  if (!Array.isArray(arr)) arr = arr === 0 || arr === '' || arr == null ? [] : [arr]
  const i = Math.trunc(num(index))
  let result
  switch (op) {
    case 'push': arr.push(cloneVal(value)); result = arr.length; break
    case 'unshift': arr.unshift(cloneVal(value)); result = arr.length; break
    case 'insert': arr.splice(Math.max(0, Math.min(arr.length, i)), 0, cloneVal(value)); result = arr.length; break
    case 'pop': result = arr.length ? arr.pop() : 0; break
    case 'shift': result = arr.length ? arr.shift() : 0; break
    case 'removeAt': result = i >= 0 && i < arr.length ? arr.splice(i, 1)[0] : 0; break
    case 'removeValue': { const k = arr.findIndex((x) => JSON.stringify(x) === JSON.stringify(value)); result = k >= 0 ? (arr.splice(k, 1), 1) : 0; break }
    case 'setAt': { if (i >= 0) { while (arr.length < i) arr.push(0); arr[i] = cloneVal(value) } result = arr.length; break }
    case 'at': result = i >= 0 && i < arr.length ? arr[i] : 0; break
    case 'length': result = arr.length; break
    case 'clear': arr.length = 0; result = 0; break
    case 'shuffle': for (let k = arr.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [arr[k], arr[j]] = [arr[j], arr[k]] } result = arr.length; break
    case 'sort': arr.sort((a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b)))); result = arr.length; break
    case 'reverse': arr.reverse(); result = arr.length; break
    case 'includes': result = arr.some((x) => JSON.stringify(x) === JSON.stringify(value)) ? 1 : 0; break
    case 'indexOf': result = arr.findIndex((x) => JSON.stringify(x) === JSON.stringify(value)); break
    case 'join': result = arr.map(showVal).join(sep); break
    case 'sum': result = arr.reduce((s, x) => s + num(x), 0); break
    case 'min': result = arr.length ? Math.min(...arr.map(num)) : 0; break
    case 'max': result = arr.length ? Math.max(...arr.map(num)) : 0; break
    case 'random': result = arr.length ? arr[Math.floor(Math.random() * arr.length)] : 0; break
    default: throw new Error(`Operación de lista desconocida: «${op}»`)
  }
  return { arr, result }
}

/** Comparación genérica (números, textos, listas por contenido). 'has' = contiene (lista o texto). */
export function cmpVals(op, a, b) {
  if (op === 'has') return Array.isArray(a) ? a.some((x) => JSON.stringify(x) === JSON.stringify(b)) : typeof a === 'string' ? a.includes(String(b)) : false
  if (op === 'nhas') return !cmpVals('has', a, b)
  const eq = (x, y) => (x !== null && typeof x === 'object') || (y !== null && typeof y === 'object') ? JSON.stringify(x) === JSON.stringify(y) : x === y || (typeof x !== typeof y && String(x) === String(y))
  switch (op) {
    case '==': return eq(a, b)
    case '!=': return !eq(a, b)
    case '>=': return a >= b
    case '>': return a > b
    case '<=': return a <= b
    case '<': return a < b
    default: return false
  }
}
