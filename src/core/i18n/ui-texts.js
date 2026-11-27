// Textos de las INTERFACES (.ui) para la Localización (Juego ▸ Localización ▸ Interfaz). Sin DOM.
//   · Controles del diseñador con texto (Etiqueta, Botón, Casilla y el texto de ayuda del Cuadro de texto): con «Clave de
//     localización» la plantilla generada usa game.t(clave, texto) y el texto sale de la tabla en el idioma del jugador.
//   · Llamadas game.t('clave') escritas a mano en la plantilla o el script de cualquier .ui.
import { parseUi, composeUi } from '../../engine/runtime/ui/sfc.js'
import { parseDesign, serializeDesign, generateTemplate, localizable } from '../../engine/runtime/ui/design-html.js'
import { slug } from '../../engine/runtime/i18n/localization.js'

const TEXT_OF = { label: 'text', button: 'text', checkbox: 'text', textbox: 'placeholder' }
const KEY_RE = /game\.t\(\s*(['"`])([^'"`]+)\1/g

/** Todos los textos de las interfaces: [{ docId, doc, control, controlId, type, text, key, kind: 'control' | 'code' }]. */
export function uiTexts(uis = []) {
  const out = []
  for (const d of uis) {
    if (!d || typeof d.code !== 'string') continue
    const parts = parseUi(d.code)
    const design = parts.design?.trim() ? parseDesign(parts.design) : null
    const ctlKeys = new Set()
    for (const c of design?.controls || []) {
      const prop = TEXT_OF[c.type]
      if (!prop) continue
      const text = c[prop] || ''
      if (!localizable(text) && !c.locKey) continue
      if (c.locKey) ctlKeys.add(c.locKey)
      out.push({ docId: d.id, doc: d.name, control: c.name, controlId: c.id, type: c.type, text, key: c.locKey || '', kind: 'control' })
    }
    // game.t('…') escritas a mano (sin contar las que genera el diseñador)
    const src = `${design ? '' : parts.template}\n${parts.script}`
    for (const m of src.matchAll(KEY_RE)) if (!ctlKeys.has(m[2])) out.push({ docId: d.id, doc: d.name, control: '', controlId: '', type: 'code', text: '', key: m[2], kind: 'code' })
  }
  return out
}

/** Mapa clave → usos en interfaces ([{ docId, doc, control }]). */
export function uiKeyUsage(uis = []) {
  const m = new Map()
  for (const t of uiTexts(uis)) if (t.key) { if (!m.has(t.key)) m.set(t.key, []); m.get(t.key).push(t) }
  return m
}

/**
 * Crea una clave por cada texto de control sin clave (ui.<interfaz>.<control>) con su texto en el idioma base, la pone en el
 * control y regenera la plantilla de esa interfaz. Las claves que ya existen en la tabla se reutilizan. Devuelve { created, docs }.
 */
export function collectUiTexts(loc, uis = []) {
  let created = 0
  const docs = []
  for (const d of uis) {
    const parts = parseUi(d.code || '')
    if (!parts.design?.trim()) continue
    const design = parseDesign(parts.design)
    if (!design) continue
    let changed = false
    for (const c of design.controls) {
      const prop = TEXT_OF[c.type]
      if (!prop || c.locKey || !localizable(c[prop])) continue
      const base = `ui.${slug(String(d.name || 'ui').replace(/\.ui$/, '')) || 'ui'}.${slug(c.name) || 'texto'}`
      let key = base, i = 2
      while (loc.entries.some((e) => e.key === key && e.text[loc.base] !== c[prop])) key = `${base}_${i++}`
      if (!loc.entries.some((e) => e.key === key)) { loc.entries.push({ key, note: `Interfaz ${d.name} · ${c.name}`, text: { [loc.base]: c[prop] }, voice: {} }); created++ }
      c.locKey = key
      changed = true
    }
    if (!changed) continue
    d.code = composeUi({ ...parts, template: generateTemplate(design), design: serializeDesign(design) })
    docs.push(d.id)
  }
  return { created, docs }
}
