// Documentos de interfaz (.ui): un archivo de texto con la forma de un componente Vue de un solo archivo.
//
//   <template modal layer="50">   ← HTML de Vue: {{ }}, v-if, v-for, @click, :style…
//   <script>                      ← cuerpo de setup(): ref, computed, game, ui, play, props, close…
//   <style>                       ← CSS; se aísla solo en esta pantalla
//   <design>                      ← (opcional) JSON del diseñador visual; de él se genera <template> (ver design.js)
//
// Este módulo no toca el DOM: se usa igual en el navegador, en el juego exportado y en Node.

const TAGS = ['template', 'script', 'style', 'design']

function parseAttrs(s) {
  const out = {}
  s.replace(/([\w:-]+)(?:\s*=\s*"([^"]*)")?/g, (_, k, v) => { out[k] = v === undefined ? true : v; return '' })
  return out
}

/** Separa el texto del documento en { attrs, template, script, style }. */
export function parseUi(src) {
  src = String(src || '')
  const out = { attrs: {}, template: '', script: '', style: '', design: '' }
  const open = /<(template|script|style|design)\b([^>]*)>/g
  let pos = 0
  while (pos < src.length) {
    open.lastIndex = pos
    const m = open.exec(src)
    if (!m) break
    const tag = m[1]
    let i = m.index + m[0].length, end = -1
    if (tag === 'template') {
      // las plantillas pueden anidar <template v-slot>: se cuenta la profundidad
      let depth = 1
      const re = /<(\/?)template\b[^>]*>/g
      re.lastIndex = i
      let t
      while ((t = re.exec(src))) {
        depth += t[1] ? -1 : /\/>$/.test(t[0]) ? 0 : 1
        if (depth === 0) { end = t.index; pos = t.index + t[0].length; break }
      }
    } else {
      end = src.indexOf('</' + tag + '>', i)
      pos = end < 0 ? src.length : end + tag.length + 3
    }
    if (end < 0) { out[tag] = src.slice(i); break }
    out[tag] = src.slice(i, end).replace(/^\n/, '').replace(/\s+$/, '')
    if (tag === 'template') out.attrs = parseAttrs(m[2])
  }
  return out
}

/** Inverso de parseUi. */
export function composeUi({ attrs = {}, template = '', script = '', style = '', design = '' }) {
  const a = Object.entries(attrs).filter(([, v]) => v !== false && v != null && v !== '').map(([k, v]) => (v === true ? k : `${k}="${v}"`)).join(' ')
  const blocks = [`<template${a ? ' ' + a : ''}>\n${template}\n</template>`]
  if (script.trim()) blocks.push(`<script>\n${script}\n</script>`)
  if (style.trim()) blocks.push(`<style>\n${style}\n</style>`)
  if (String(design).trim()) blocks.push(`<design>\n${design}\n</design>`)
  return blocks.join('\n\n') + '\n'
}

function splitSelectorList(text) {
  const selectors = []
  let start = 0, nesting = 0, quote = ''
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '\\') { i++; continue }
    if (quote) { if (char === quote) quote = ''; continue }
    if (char === '"' || char === "'") quote = char
    else if (char === '(' || char === '[') nesting++
    else if (char === ')' || char === ']') nesting--
    else if (char === ',' && nesting === 0) { selectors.push(text.slice(start, i)); start = i + 1 }
  }
  selectors.push(text.slice(start))
  return selectors
}

/** Aísla el CSS de una pantalla: antepone `.cls` a cada selector (`:root` = la propia pantalla). */
export function scopeCss(css, cls) {
  css = String(css || '').replace(/\/\*[\s\S]*?\*\//g, '')
  const scopeSel = (sel) => splitSelectorList(sel).map((s) => {
    s = s.trim()
    if (!s) return ''
    if (/^(html|body)$/.test(s)) return '.' + cls
    if (/^:(root|host)(?=$|[\s>+~])/.test(s)) return s.replace(/^:(root|host)/, '.' + cls)
    return `.${cls} ${s}`
  }).filter(Boolean).join(', ')
  let out = '', i = 0
  while (i < css.length) {
    const b = css.indexOf('{', i)
    if (b < 0) break
    const head = css.slice(i, b).trim()
    let depth = 1, j = b + 1
    while (j < css.length && depth) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++ }
    const body = css.slice(b + 1, j - 1)
    if (/^@(media|supports|container|layer)/.test(head)) out += `${head}{${scopeCss(body, cls)}}\n`
    else if (head.startsWith('@')) out += `${head}{${body}}\n` // @keyframes, @font-face…
    else out += `${scopeSel(head)}{${body}}\n`
    i = j
  }
  return out
}

export const uiClass = (id) => 'ui-' + String(id).replace(/\W/g, '')
export const uiScreenName = (name) => String(name || '').replace(/\.ui$/i, '')
export { TAGS }
