// Fase F5: reapunta los importadores de las reexportaciones de compatibilidad (src/core/<x>.js → engine/…) al archivo real y borra la reexportación.
import fs from 'node:fs'
import path from 'node:path'
const SRC = 'src'
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.(js|mjs|vue)$/.test(e.name) ? [path.join(d, e.name)] : []))
const files = walk(SRC)
const shims = new Map() // ruta absoluta del shim → ruta absoluta del destino
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.trim() && !l.trim().startsWith('//'))
  if (t.length === 1) { const m = /^export \* from '([^']+)'$/.exec(t[0].trim()); if (m && m[1].includes('engine/')) shims.set(path.resolve(f), path.resolve(path.dirname(f), m[1])) }
}
console.log('reexportaciones:', [...shims.keys()].map((s) => path.relative(SRC, s)).join(', '))
const resolveTo = (from, spec) => { const b = path.resolve(path.dirname(from), spec); return [b, b + '.js'].find((c) => shims.has(c)) }
let n = 0
for (const f of files) {
  if (shims.has(path.resolve(f))) continue
  let s = fs.readFileSync(f, 'utf8'), ch = false
  s = s.replace(/(from\s+|import\(\s*|import\s+)(['"])(\.{1,2}\/[^'"]+)\2/g, (m, pre, q, spec) => {
    const sh = resolveTo(f, spec); if (!sh) return m
    let r = path.relative(path.dirname(f), shims.get(sh)).split(path.sep).join('/'); if (!r.startsWith('.')) r = './' + r
    ch = true; n++; return `${pre}${q}${r}${q}`
  })
  if (ch) fs.writeFileSync(f, s)
}
if (!process.argv.includes('--keep')) for (const s of shims.keys()) fs.unlinkSync(s)
console.log('importaciones reapuntadas:', n)
