// Herramienta de refactor (fase F4): mueve métodos de `class Editor` (src/core/editor.js) a un módulo mixin en src/core/editor/.
//   node scripts/extract-class-methods.mjs <desde> <hasta> <nombre> "<cabecera>" [--dry]
// El módulo exporta `export const <nombre>Methods = { …métodos… }` y editor.js los aplica a Editor.prototype con
// `mixin(Editor, <nombre>Methods)` (descriptores, así que los getters no se ejecutan al mezclar).
// · El rango son líneas completas (métodos enteros con sus comentarios). Se comprueba que empiece en un método y acabe en un cierre de método.
// · Se llevan solo los imports que el bloque usa; los de editor.js que dejen de usarse se podan (`--prune`).
// · Usa `--prune` solo para podar los imports sin uso de editor.js.
import fs from 'node:fs'
import path from 'node:path'
// Por defecto trabaja sobre Editor; para otra clase: CLS_SRC=src/engine/runtime/events/play.js CLS_DIR=src/core/events CLS_PREFIX=play- CLS_NAME=PlayMode
const SRC = process.env.CLS_SRC || 'src/core/editor.js'
const DIR = process.env.CLS_DIR || 'src/core/editor'
const PREFIX = process.env.CLS_PREFIX || ''
const CLS = process.env.CLS_NAME || 'Editor'
const SAME = path.resolve(DIR) === path.resolve(path.dirname(SRC))
const IMP_DIR = SAME ? '.' : './' + path.basename(DIR)
const [from, to, name, header] = process.argv.slice(2)
const dry = process.argv.includes('--dry')
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''")
const usedIn = (code, n) => new RegExp('(?<![\\w$])(?<![^.]\\.)' + n.replace(/\$/g, '\\$') + '(?![\\w$])').test(code)

/** Imports del archivo: [{ text, spec, names:[{local, src}], kind }] */
function parseImports(lines) {
  const out = []
  for (let i = 0; i < lines.length; i++) {
    if (!/^import\b/.test(lines[i])) continue
    let j = i
    while (!/from\s+['"][^'"]+['"]|^import\s+['"][^'"]+['"]/.test(lines[j])) j++
    const text = lines.slice(i, j + 1).join('\n')
    const spec = /['"]([^'"]+)['"]/.exec(text.slice(text.lastIndexOf('from') >= 0 ? text.lastIndexOf('from') : 0))[1]
    const ns = /\*\s+as\s+([\w$]+)/.exec(text)
    const def = /^import\s+([\w$]+)\s*[,\s]/.exec(text)
    const named = /\{([\s\S]*?)\}/.exec(text)
    const names = []
    if (ns) names.push({ local: ns[1], src: ns[1], kind: 'ns' })
    if (def && !text.startsWith('import {') && !text.startsWith('import *')) names.push({ local: def[1], src: 'default', kind: 'default' })
    if (named) for (const p of named[1].split(',').map((x) => x.trim()).filter(Boolean)) { const [s, l] = p.split(/\s+as\s+/); names.push({ local: (l || s).trim(), src: s.trim(), kind: 'named' }) }
    out.push({ from: i, to: j, text, spec, names, trail: /\/\/[^\n]*$/.exec(lines[j])?.[0] || '' })
    i = j
  }
  return out
}
const render = (imp, used, rel) => {
  const keep = imp.names.filter((n) => used(n.local))
  if (!keep.length) return null
  const spec = rel(imp.spec)
  const parts = []
  const ns = keep.find((n) => n.kind === 'ns'), df = keep.find((n) => n.kind === 'default'), nm = keep.filter((n) => n.kind === 'named')
  if (ns) parts.push(`* as ${ns.local}`)
  if (df) parts.push(df.local)
  if (nm.length) parts.push(`{ ${nm.map((n) => (n.src === n.local ? n.src : `${n.src} as ${n.local}`)).join(', ')} }`)
  return `import ${parts.join(', ')} from '${spec}'${imp.trail ? ' ' + imp.trail : ''}`
}

const L = fs.readFileSync(SRC, 'utf8').split('\n')
const imports = parseImports(L)
const importEnd = Math.max(...imports.map((i) => i.to)) + 1

if (process.argv.includes('--prune')) {
  const body = L.filter((_, i) => !imports.some((m) => i >= m.from && i <= m.to)).join('\n')
  const code = strip(body)
  const out = []
  let k = 0
  for (let i = 0; i < L.length; i++) {
    const imp = imports.find((m) => m.from === i)
    if (!imp) { if (!imports.some((m) => i > m.from && i <= m.to)) out.push(L[i]); continue }
    const r = render(imp, (n) => usedIn(code, n), (s) => s)
    if (r) out.push(r)
    i = imp.to
    k++
  }
  fs.writeFileSync(SRC, out.join('\n'))
  console.log('imports podados en editor.js'); process.exit(0)
}

const a = +from - 1, b = +to
const blk = L.slice(a, b)
const startRe = /^  (?:async\s+)?(?:get\s+|set\s+)?[A-Za-z_$][\w$]*\s*\(/
const first = blk.findIndex((l) => l.trim() && !/^\s*(\/\/|\/\*|\*)/.test(l))
if (!startRe.test(blk[first])) { console.error('✗ el rango no empieza en un método:', blk[first]); process.exit(1) }
const lastCode = [...blk].reverse().findIndex((l) => l.trim())
const lastLine = blk[blk.length - 1 - lastCode]
if (!(/^  \}$/.test(lastLine) || /\}\s*(\/\/.*)?$/.test(lastLine))) { console.error('✗ el rango no acaba en el cierre de un método:', lastLine); process.exit(1) }

// clases → objeto literal: coma tras cada método
const bal = (s) => { const t = strip(s); return (t.match(/\{/g) || []).length - (t.match(/\}/g) || []).length }
const outL = []
let open = false
for (let i = 0; i < blk.length; i++) {
  const l = blk[i]
  if (!open && startRe.test(l)) {
    if (bal(l) === 0) { // una sola línea
      const m = /^(.*\})(\s*\/\/.*)?$/.exec(l)
      outL.push(m ? m[1] + ',' + (m[2] || '') : l)
    } else { open = true; outL.push(l) }
    continue
  }
  if (open && /^  \}$/.test(l)) { outL.push('  },'); open = false; continue }
  outL.push(l)
}
if (open) { console.error('✗ método sin cerrar'); process.exit(1) }
const body = outL.join('\n').replace(/import\((['"])(\.{1,2}\/)/g, (m, q, d) => (SAME ? m : `import(${q}${d === './' ? '../' : '../../'}`))
const code = strip(body)
const rest = [...L.slice(0, a), ...L.slice(b)]

const rel = (s) => SAME ? s : (s.startsWith('./') ? '../' + s.slice(2) : s.startsWith('../') ? '../../' + s.slice(3) : s)
const head = []
for (const imp of imports) { const r = render(imp, (n) => usedIn(code, n), rel); if (r) head.push(r) }
// constantes de nivel superior de editor.js (no importadas) que usa el bloque
const consts = rest.map((l) => /^const ([\w$]+) =/.exec(l)?.[1]).filter(Boolean)
const usedConsts = consts.filter((c) => usedIn(code, c))
const stillUsed = usedConsts.filter((c) => usedIn(strip(rest.filter((l) => !l.startsWith(`const ${c} =`)).join('\n')), c))
if (stillUsed.length) { console.error('✗ constantes compartidas con editor.js (muévelas a un módulo común):', stillUsed.join(', ')); process.exit(1) }
const constLines = usedConsts.map((c) => rest.find((l) => l.startsWith(`const ${c} =`)))
console.log(`métodos ${from}-${to} → ${DIR}/${PREFIX}${name}.js · imports: ${head.length} · constantes: ${usedConsts.join(', ') || '—'}`)
const methods = [...body.matchAll(/^  (?:async\s+)?(?:get\s+|set\s+)?([A-Za-z_$][\w$]*)\s*\(/gm)].map((m) => m[1])
console.log('  ' + methods.join(', '))
if (dry) process.exit(0)

const modText = `// ${header}\n${head.join('\n')}\n\n${constLines.join('\n')}${constLines.length ? '\n\n' : ''}export const ${name}Methods = {\n${body}\n}\n`
fs.mkdirSync(DIR, { recursive: true })
fs.writeFileSync(path.join(DIR, PREFIX + name + '.js'), modText)
const newRest = rest.filter((l) => !usedConsts.some((c) => l.startsWith(`const ${c} =`)))
// import + mixin
const imp = `import { ${name}Methods } from '${IMP_DIR}/${PREFIX}${name}.js'`
const at = newRest.findIndex((l) => l === '// @@MIXINS@@')
if (at < 0) { console.error('✗ falta el marcador // @@MIXINS@@ en editor.js'); process.exit(1) }
newRest.splice(at, 0, `mixin(${CLS}, ${name}Methods)`)
const lastImp = newRest.reduce((m, l, i) => (/^import\b|^\} from /.test(l) ? i : m), 0)
newRest.splice(lastImp + 1, 0, imp)
fs.writeFileSync(SRC, newRest.join('\n'))
