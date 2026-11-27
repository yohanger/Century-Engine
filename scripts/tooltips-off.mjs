// Quita los tooltips del editor SIN borrar los textos: en las plantillas Vue, el atributo `title` (y `:title`) de los elementos HTML
// nativos pasa a `data-tooltip` (y `:data-tooltip`). Los componentes (AppWindow, Icon… en PascalCase) no se tocan: su `title` es el
// título de la ventana, no un tooltip. Para recuperarlos: Preferencias ▸ «Mostrar tooltips» (core/tooltips.js los vuelve a poner).
// Uso: node scripts/tooltips-off.mjs [--check]   (--check: falla si queda algún title nativo)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const DIRS = ['src/components', 'src']
const SKIP_TAGS = new Set(['component', 'transition', 'transition-group', 'template', 'slot', 'keep-alive', 'teleport'])
const check = process.argv.includes('--check')

/** Recorre las etiquetas de apertura de una plantilla y aplica `fn(tag, text)` → texto nuevo. Respeta las comillas. */
export function mapTags(tpl, fn) {
  let out = '', i = 0
  while (i < tpl.length) {
    const lt = tpl.indexOf('<', i)
    if (lt < 0) { out += tpl.slice(i); break }
    out += tpl.slice(i, lt)
    if (tpl.startsWith('<!--', lt)) { const e = tpl.indexOf('-->', lt); const end = e < 0 ? tpl.length : e + 3; out += tpl.slice(lt, end); i = end; continue }
    const m = /^<([a-zA-Z][\w-]*)/.exec(tpl.slice(lt))
    if (!m) { out += '<'; i = lt + 1; continue }
    let j = lt + m[0].length, q = null
    for (; j < tpl.length; j++) { const c = tpl[j]; if (q) { if (c === q) q = null } else if (c === '"' || c === "'") q = c; else if (c === '>') break }
    const text = tpl.slice(lt, j + 1)
    out += fn(m[1], text)
    i = j + 1
  }
  return out
}
const native = (tag) => /^[a-z][a-z0-9]*$/.test(tag) && !SKIP_TAGS.has(tag)
/** Cambia title/:title por data-tooltip en una etiqueta (fuera de los valores entre comillas). */
export function disableTitle(text) {
  let out = '', q = null
  for (let k = 0; k < text.length; k++) {
    const c = text[k]
    if (q) { out += c; if (c === q) q = null; continue }
    if (c === '"' || c === "'") { q = c; out += c; continue }
    const m = /^(\s)(v-bind:|:)?title=/.exec(text.slice(k))
    if (m) { out += `${m[1]}${m[2] ? ':' : ''}data-tooltip=`; k += m[0].length - 1; continue }
    out += c
  }
  return out
}
export function processSfc(src) {
  const a = src.indexOf('<template'), b = src.lastIndexOf('</template>')
  if (a < 0 || b < 0) return { code: src, n: 0 }
  let n = 0
  const tpl = mapTags(src.slice(a, b), (tag, text) => { if (!native(tag)) return text; const t = disableTitle(text); if (t !== text) n++; return t })
  return { code: src.slice(0, a) + tpl + src.slice(b), n }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let total = 0, files = 0
  for (const d of DIRS) for (const f of readdirSync(d)) {
    if (!f.endsWith('.vue')) continue
    const p = join(d, f), src = readFileSync(p, 'utf8')
    const { code, n } = processSfc(src)
    if (!n) continue
    total += n; files++
    if (check) console.log(`  ${p}: ${n}`)
    else writeFileSync(p, code)
  }
  if (check && total) { console.error(`✗ quedan ${total} tooltips en ${files} archivos`); process.exit(1) }
  console.log(check ? '✓ ningún tooltip nativo en las plantillas' : `✓ ${total} tooltips desactivados en ${files} archivos (texto conservado en data-tooltip)`)
}
