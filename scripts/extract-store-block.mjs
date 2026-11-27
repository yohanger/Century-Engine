// Herramienta de refactor (fase F4): mueve un bloque de líneas de src/core/store.js a un módulo nuevo sin dejar nombres sin definir.
//   node scripts/extract-store-block.mjs <desde> <hasta> <src/core/state/nombre.js> "<comentario de cabecera>" [--dry] [--hook nombre=expr ...]
// · Calcula qué nombres del resto de store.js usa el bloque (declaraciones de nivel superior) y qué imports de store.js necesita.
// · Si usa algo que aún vive en store.js lo informa (hay que extraerlo antes o inyectarlo): no escribe nada en ese caso.
// · Deja en store.js un import + `export { … }` de lo que el bloque exportaba (los 92 importadores no cambian) y añade los imports
//   de lo que el resto de store.js sigue usando del bloque (también lo no exportado, que pasa a exportarse).
import fs from 'node:fs'
import path from 'node:path'
const MARK = '// ---------- módulos extraídos de este archivo (fase F4): se reexportan para no cambiar a los importadores ----------'
const [from, to, out, header] = process.argv.slice(2)
const NEW = '// @@F4-NUEVOS-IMPORTS@@'
if (from === '--consolidate') { // sube lo añadido al final (tras NEW) junto a los imports de la cabecera, sin tocar nada más
  const T = fs.readFileSync('src/core/store.js', 'utf8').split('\n'), n = T.indexOf(NEW); if (n < 0) { console.log('nada que consolidar'); process.exit(0) }
  const blk = T.slice(n + 1).filter(Boolean); const base = T.slice(0, n); while (base.at(-1) === '') base.pop()
  let k = base.indexOf(MARK); if (k < 0) { let at = 0; for (let q = 0; q < 60; q++) if (/^import .* from '[^']+'|^\} from '[^']+'/.test(base[q] || '')) at = q; base.splice(at + 1, 0, MARK); k = at + 1 }
  base.splice(k + 1, 0, ...blk); fs.writeFileSync('src/core/store.js', base.join('\n') + '\n'); console.log('consolidado:', blk.length, 'líneas'); process.exit(0) }
const dry = process.argv.includes('--dry')
const SRC = 'src/core/store.js'
const L = fs.readFileSync(SRC, 'utf8').split('\n')
const a = +from - 1, b = +to
// los `import …` de dentro del bloque NO se mueven: se quedan en store.js (el resto puede usarlos) y el módulo nuevo recibe los suyos
const blockLines = L.slice(a, b)
const keep = blockLines.filter((l) => /^import .* from '[^']+'/.test(l) || /^import '[^']+'/.test(l))
const body = blockLines.filter((l) => !keep.includes(l)).join('\n')
const rest = [...L.slice(0, a), ...keep, ...L.slice(b)].join('\n')
const declRe = /^(?:export\s+)?(?:async\s+)?(?:function\*?\s+([\w$]+)|(?:const|let|var)\s+([\w$]+)|class\s+([\w$]+))/
const declsIn = (lines) => lines.map((l) => declRe.exec(l)).filter(Boolean).map((m) => m[1] || m[2] || m[3])
const bodyDecl = new Set(declsIn(L.slice(a, b))), restDecl = new Set(declsIn([...L.slice(0, a), ...L.slice(b)]))
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, "''")
const w = (n) => new RegExp('(?<![\\w$.])' + n.replace(/\$/g, '\\$') + '(?![\\w$])')
// imports de store.js (cabecera)
const head = L.join('\n')
const imports = [...(head + '\n' + keep.join('\n')).matchAll(/import\s+(?:(\*\s+as\s+\w+)|(\{[^}]*\})|(\w+))\s+from\s+'([^']+)'/g)].map((m) => ({ ns: m[1], names: m[2], def: m[3], from: m[4] }))
const sb = strip(body), sr = strip(rest)
const lines = []
const needFromStore = []
for (const n of restDecl) if (w(n).test(sb)) needFromStore.push(n)
for (const im of imports) {
  if (im.from.startsWith('./state/')) { // lo ya extraído: se importa desde su módulo
    const nm = (im.names || '').replace(/[{}]/g, '').split(',').map((s) => s.trim()).filter(Boolean)
    const used = nm.filter((s) => w(s.split(/\s+as\s+/).pop()).test(sb))
    if (used.length) lines.push(`import { ${used.join(', ')} } from '${im.from.replace('./state/', './')}'`)
    continue
  }
  const rel = im.from.startsWith('.') ? path.posix.relative(path.posix.dirname(out), path.posix.join('src/core', im.from)) : im.from
  const spec = im.from.startsWith('.') ? (rel.startsWith('.') ? rel : './' + rel) : im.from
  if (im.ns) { const nm = im.ns.split(/\s+as\s+/)[1]; if (w(nm).test(sb)) lines.push(`import ${im.ns} from '${spec}'`) } else if (im.def) { if (w(im.def).test(sb)) lines.push(`import ${im.def} from '${spec}'`) } else {
    const nm = im.names.replace(/[{}]/g, '').split(',').map((s) => s.trim()).filter(Boolean)
    const used = nm.filter((s) => w(s.split(/\s+as\s+/).pop()).test(sb))
    if (used.length) lines.push(`import { ${used.join(', ')} } from '${spec}'`)
  }
}
if (needFromStore.length) { console.error(`✗ el bloque usa nombres que siguen en store.js: ${needFromStore.join(', ')}\n  → extráelos antes, o inyéctalos; no se escribió nada.`); process.exit(2) }
const exported = [...body.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([\w$]+)/gm)].map((m) => m[1])
const usedByRest = [...bodyDecl].filter((n) => w(n).test(sr))
const toExport = [...new Set([...exported, ...usedByRest.filter((n) => !exported.includes(n))])]
const notExported = usedByRest.filter((n) => !exported.includes(n))
let newBody = body.replace(/import\(\s*'\.\.\//g, "import('../../").replace(/import\(\s*'\.\//g, "import('../") // import dinámico: rutas relativas a la nueva carpeta
for (const n of notExported) newBody = newBody.replace(new RegExp('^(async\\s+)?(function\\*?|const|let|class)\\s+' + n.replace(/\$/g, '\\$') + '(?![\\w$])', 'm'), (m0) => 'export ' + m0)
const mod = `// ${header}\n${[...new Set(lines)].join('\n')}\n\n${newBody}\n`
const rel2 = './' + path.posix.relative('src/core', out).replace(/\.js$/, '.js')
const reexp = exported.length ? `export { ${exported.join(', ')} }` : ''
const importStore = toExport.length ? `import { ${toExport.join(', ')} } from '${rel2}' // ${header.split('.')[0]}` : ''
console.log(`bloque ${from}-${to}: ${b - a} líneas → ${out}\n  declara: ${[...bodyDecl].join(', ')}\n  exporta (ya lo hacía): ${exported.join(', ') || '—'}\n  nuevo export (lo usa el resto de store.js): ${notExported.join(', ') || '—'}\n  imports: ${lines.length}`)
if (dry) process.exit(0)
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, mod)
const newL = [...L.slice(0, a), ...keep, ...L.slice(b)]
// el import va tras el último import de la cabecera
// los imports/exports nuevos van AL FINAL (bloque «módulos extraídos»): no desplazan los números de línea de lo que aún se va a extraer.
// `node scripts/extract-store-block.mjs --consolidate` los sube junto a los imports de la cabecera cuando se termina.
if (!newL.includes(NEW)) newL.push('', NEW)
newL.push(...(importStore ? [importStore] : []), ...(reexp ? [reexp] : []))
fs.writeFileSync(SRC, newL.join('\n'))
