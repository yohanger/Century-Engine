// Textos de ayuda en la interfaz (plantillas .vue): párrafos que explican qué hace una propiedad o ventana. Para eso está la documentación.
// Todos llevan la clase `lf-help`, que styles.css oculta salvo con Preferencias ▸ «Mostrar tooltips» (los textos siguen en el código).
// Los avisos de estado («bake desactualizado», «la escena no tiene modelo») NO son ayuda: llevan `.keep` o están en EXCLUDE.
//
// Detección por patrones (no ejecuta Vue): clases típicas de ayuda, elementos con texto estático largo y {{ x.desc | hint | help | tip }}.
// Uso: node scripts/audit-help-text.mjs            informe por archivo
//      node scripts/audit-help-text.mjs --list     + cada texto
//      node scripts/audit-help-text.mjs --check    falla si hay ayuda sin `lf-help` (lo usa test-help-hidden.mjs)
//      node scripts/audit-help-text.mjs --fix      añade `lf-help` a lo que falte
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')
const HELP_CLASS = /\b(hint|hintp|hintf|phint|dim|note|help|sub|desc|empty|muted|tip|info|warn|lead|caption)\b/
const MIN_LONG = 45 // caracteres de texto estático para considerarlo explicación aunque no tenga clase de ayuda

/** Textos que NO son ayuda: etiquetas, lecturas de valores, estados y vacíos cortos. Se comprueban contra el texto de la plantilla. */
export const EXCLUDE = [
  /^(Alcance de acción|Base de datos|Rol \(obsoleto\):|Simular en la vista previa:|en juego: FPS|sin vista previa|EDITOR DE SCRIPTS|SHADER EDITOR|escena\(s\))/,
  /^(Aún no hay (tomas|proyectos guardados)|Sin subcarpetas aquí|no existe en la tabla|· con traducciones pendientes)/,
  /^(El bake está desactualizado|La escena no tiene ningún modelo|El aspecto del proyecto es «Clásico»|✓ Esqueleto humanoide)/,
  /^Ln\b/, // barra de estado del editor (posición del cursor)
  /^· (personaje|textos)/, // subtítulos de pestañas con contenido propio se tratan aparte (ver más abajo)
  /=>|\$\{|">|\?\./, // fragmentos de código que el patrón confundió con texto
  /^Largo m × ancho m/, // lectura de valores
  /^(En pantalla: centro en|Vista previa:)/, // llevan lecturas de valores
]
const hasKeep = (cls) => /\bkeep\b/.test(cls) || /\blf-help\b/.test(cls)

function* walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) yield* walk(p); else if (p.endsWith('.vue')) yield p } }

const ELEM = /<(p|div|span|small|em|li|label|header|section)\b([^>]*)>([^<]*(?:<(?:code|b|i|strong|kbd|em)[^>]*>[^<]*<\/(?:code|b|i|strong|kbd|em)>[^<]*)*)<\/\1>/g

/** Elementos de ayuda de un archivo: [{ at (posición de `attrs`), attrs, tag, cls, text, kind, marked }] */
export function scan(src) {
  const start = src.indexOf('\n<template>'), end = src.lastIndexOf('\n</template>')
  if (start < 0 || end < 0) return []
  const out = []
  const tpl = src.slice(start, end)
  let m
  ELEM.lastIndex = 0
  while ((m = ELEM.exec(tpl))) {
    const attrs = m[2], raw = m[3]
    const cls = /\bclass="([^"]*)"/.exec(attrs)?.[1] || ''
    const text = raw.replace(/<[^>]+>/g, '').replace(/\{\{[^}]*\}\}/g, '').replace(/\s+/g, ' ').trim()
    const mus = /^\s*\{\{\s*([^}]*?)\s*\}\}\s*$/.exec(raw)
    const dynHelp = !!mus && /\b(desc|hint|help|tip)\b/i.test(mus[1]) && !/^(hint|tip)$/.test(mus[1]) /* variable de estado, no ayuda */ && !/[?:]|=>/.test(mus[1].replace(/\|\|/g, ''))
    if (!dynHelp && (!text || /^[\W\d]*$/.test(text))) continue
    const helpCls = HELP_CLASS.test(cls) && (text.length >= 12 || dynHelp)
    const long = text.length >= MIN_LONG && m[1] !== 'label' && m[1] !== 'header'
    if (!dynHelp && !helpCls && !long) continue
    if (!dynHelp && EXCLUDE.some((re) => re.test(text))) continue
    if (/\b(keep|warn|dep)\b/.test(cls)) continue // aviso de estado
    const kind = dynHelp ? 'dinámica' : /\bempty\b/.test(cls) ? 'vacío' : /\b(hint|hintp|hintf|phint|help|note)\b/.test(cls) ? 'ayuda' : /\b(dim|muted|sub|desc)\b/.test(cls) ? 'secundario' : 'texto largo'
    out.push({ at: start + m.index + 1 + m[1].length, attrs, tag: m[1], cls, text: dynHelp ? `{{ ${mus[1]} }}` : text, kind, marked: hasKeep(cls) && /\blf-help\b/.test(cls), line: src.slice(0, start + m.index).split('\n').length + 1 })
  }
  return out
}

/** Añade `lf-help` a la etiqueta de apertura (class estático; si solo hay :class, se añade además un class). */
export function fixSource(src) {
  const items = scan(src).filter((r) => !r.marked).sort((a, b) => b.at - a.at)
  for (const r of items) {
    let attrs = r.attrs
    if (/\bclass="/.test(attrs)) attrs = attrs.replace(/\bclass="([^"]*)"/, (_, c) => `class="${c} lf-help"`.replace('" lf-help"', ' lf-help"'))
    else attrs = ` class="lf-help"${attrs}`
    src = src.slice(0, r.at) + attrs + src.slice(r.at + r.attrs.length)
  }
  return { src, n: items.length }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fix = process.argv.includes('--fix'), check = process.argv.includes('--check'), list = process.argv.includes('--list')
  const by = {}
  let total = 0, pending = 0
  for (const f of walk(SRC)) {
    const src = fs.readFileSync(f, 'utf8')
    const items = scan(src)
    if (!items.length) continue
    const rel = path.relative(SRC, f)
    const miss = items.filter((r) => !r.marked)
    total += items.length; pending += miss.length
    by[rel] = { n: items.length, miss: miss.length, chars: items.reduce((a, r) => a + r.text.length, 0), items }
    if (fix && miss.length) { const r = fixSource(src); fs.writeFileSync(f, r.src) }
  }
  if (fix) { console.log(`lf-help añadido a ${pending} textos de ayuda`); process.exit(0) }
  if (check) {
    if (pending) {
      console.error(`✗ ${pending} textos de ayuda sin la clase lf-help (node scripts/audit-help-text.mjs --fix, o .keep si es un aviso de estado):`)
      for (const [f, v] of Object.entries(by)) for (const r of v.items.filter((x) => !x.marked)) console.error(`  ${f}:${r.line} [${r.kind}] ${r.text.slice(0, 90)}`)
      process.exit(1)
    }
    console.log(`✓ ${total} textos de ayuda, todos con lf-help (ocultos salvo «Mostrar tooltips»)`); process.exit(0)
  }
  const sorted = Object.entries(by).sort((a, b) => b[1].chars - a[1].chars)
  console.log('archivo'.padEnd(46), 'textos'.padStart(6), 'sin marcar'.padStart(11))
  for (const [f, v] of sorted) console.log(f.padEnd(46), String(v.n).padStart(6), String(v.miss).padStart(11))
  console.log(`\nTOTAL ${total} textos en ${sorted.length} archivos; sin marcar: ${pending}`)
  if (list) for (const [f, v] of sorted) for (const r of v.items) console.log(`${f}:${r.line} [${r.kind}${r.marked ? ', oculto' : ''}] ${r.text.slice(0, 110)}`)
}
