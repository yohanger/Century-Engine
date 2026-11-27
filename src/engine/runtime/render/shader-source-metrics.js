// Cuenta únicamente ramas preprocesadas y funciones alcanzables desde main.
// Sigue siendo análisis estático: los bucles y ramas por uniformes no son tiempo GPU.
function activeSource(source) {
  const macros = new Map([['GL_ES', '1'], ['__VERSION__', source.match(/#version\s+(\d+)/)?.[1] || '100']]), stack = []
  let active = true
  const evaluate = (expression, depth = 0) => {
    if (depth > 16) throw new Error('Macro recursiva')
    let code = expression.replace(/defined\s*(?:\(\s*(\w+)\s*\)|(\w+))/g,
      (_, a, b) => macros.has(a || b) ? '1' : '0')
    code = code.replace(/\b[A-Za-z_]\w*\b/g, name =>
      name === 'true' ? '1' : name === 'false' ? '0' :
        macros.has(name) ? `(${evaluate(macros.get(name) || '1', depth + 1)})` : '0')
    // Solo literales numéricos y operadores aritméticos/lógicos del preprocesador.
    if (!/^[\d\s.()+\-*/%<>=!&|~^]+$/.test(code)) throw new Error('Condición GLSL no soportada')
    return Number(Function(`"use strict"; return Number(${code});`)())
  }
  const lines = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/\\\r?\n/g, '').split('\n')
  const output = []
  for (const line of lines) {
    const directive = line.match(/^\s*#\s*(\w+)\s*(.*)$/)
    if (!directive) { if (active) output.push(line); continue }
    const [, op, argument] = directive
    if (['if', 'ifdef', 'ifndef'].includes(op)) {
      const pass = active && (op === 'if' ? !!evaluate(argument) : op === 'ifdef' ? macros.has(argument.trim()) : !macros.has(argument.trim()))
      stack.push({ parent: active, taken: pass }); active = pass
    } else if (op === 'elif' || op === 'else') {
      const branch = stack.at(-1)
      if (!branch) return null
      active = branch.parent && !branch.taken && (op === 'else' || !!evaluate(argument))
      branch.taken ||= active
    } else if (op === 'endif') {
      if (!stack.length) return null
      active = stack.pop().parent
    } else if (active && op === 'define') {
      const macro = argument.match(/^(\w+)(.*)$/)
      if (macro) macros.set(macro[1], macro[2].trim() || '1')
    } else if (active && op === 'undef') macros.delete(argument.trim())
  }
  return stack.length ? null : output.join('\n')
}

function reachableFunctions(code) {
  const functions = new Map()
  const pattern = /\b(?:void|float|int|bool|[biu]?vec[234]|mat[234](?:x[234])?)\s+(\w+)\s*\([^;{}]*\)\s*\{/g
  let match
  while ((match = pattern.exec(code))) {
    let end = pattern.lastIndex, depth = 1
    while (end < code.length && depth) { if (code[end] === '{') depth++; if (code[end] === '}') depth--; end++ }
    if (depth) return null
    const bodies = functions.get(match[1]) || []
    bodies.push(code.slice(pattern.lastIndex, end - 1)); functions.set(match[1], bodies)
    pattern.lastIndex = end
  }
  if (!functions.has('main')) return code // fragmentos de fuente usados por pruebas/diagnóstico
  const pending = ['main'], seen = new Set(), reachable = []
  while (pending.length) {
    const name = pending.pop()
    if (seen.has(name)) continue
    seen.add(name)
    for (const body of functions.get(name) || []) {
      reachable.push(body)
      for (const call of body.matchAll(/\b(\w+)\s*\(/g)) if (functions.has(call[1])) pending.push(call[1])
    }
  }
  return reachable.join('\n')
}

export function fragmentSourceMetrics(source) {
  if (typeof source !== 'string' || !source.trim()) return null
  let code
  try { code = activeSource(source) } catch { return null }
  if (code == null) return null
  code = reachableFunctions(code)
  if (code == null) return null
  const count = pattern => [...code.matchAll(pattern)].length
  return {
    textureCalls: count(/\b(?:texture(?:2D|Cube|Lod|Grad|Proj|2DLod|CubeLod)?|texelFetch)\s*\(/g),
    discardCalls: count(/\bdiscard\s*;/g),
    loopStatements: count(/\b(?:for|while)\s*\(/g),
    sourceLines: code.split('\n').length,
  }
}
