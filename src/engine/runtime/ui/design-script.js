// Diseñador de interfaz · funciones y variables en el <script>: asegura que el script declare lo que la plantilla usa.
import { IDENT } from './design.js'

// ---------- funciones y variables en el <script> ----------
const RET = /(?:^|\n)([ \t]*)return\s*\{([^{}]*)\}\s*;?\s*$/
const declRe = (name) => new RegExp(`(?:\\bfunction\\s+${name}\\b|\\b(?:const|let|var)\\s+${name}\\b)`)

/**
 * Garantiza que el script declare `name` (función o ref) y lo devuelva en `return { … }`, sin tocar lo demás.
 * kind: 'function' → function name() {} · 'ref' → const name = ref(init). Devuelve { script, line } (línea 1-based de la declaración).
 */
export function ensureScriptSymbol(script, kind, name, init = "''") {
  let s = String(script || '').replace(/\s+$/, '')
  const decl = kind === 'function' ? `function ${name}() {\n  \n}` : `const ${name} = ref(${init})`
  const m = RET.exec(s)
  const names = m ? m[2].split(',').map((x) => x.trim()).filter(Boolean) : []
  let body = m ? s.slice(0, m.index) : s
  if (!declRe(name).test(s)) body = (body ? body.replace(/\s+$/, '') + '\n\n' : '') + decl
  if (!names.includes(name)) names.push(name)
  const ret = `return { ${names.join(', ')} }`
  const out = body.replace(/\s+$/, '') + '\n\n' + ret + '\n'
  const idx = out.search(declRe(name))
  return { script: out, line: idx < 0 ? 1 : out.slice(0, idx).split('\n').length }
}

/** ¿El script ya declara `name` y lo devuelve en `return { … }`? */
export function scriptHasSymbol(script, name) {
  const s = String(script || '').replace(/\s+$/, '')
  const m = RET.exec(s)
  return declRe(name).test(s) && !!m && new RegExp(`(^|[\\s,:])${name}($|[\\s,:])`).test(m[2])
}

/** Funciones y variables que el diseño necesita en el script (eventos con nombre de función y enlaces). */
const bindingInit = (c) => {
  switch (c.type) {
    case 'checkbox': return 'false'
    case 'slider': return String(c.min)
    case 'inventory': return '[]'
    case 'select': return JSON.stringify(c.options.split('|')[0].trim())
    default: return "''"
  }
}

export function requiredSymbols(d) {
  const out = []
  for (const c of d.controls) {
    if (c.bind && IDENT.test(c.bind)) out.push({ kind: 'ref', name: c.bind, init: bindingInit(c) })
    for (const v of Object.values(c.events)) if (IDENT.test(String(v).trim())) out.push({ kind: 'function', name: String(v).trim() })
  }
  return out
}
