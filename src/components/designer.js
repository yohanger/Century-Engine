// Estado y acciones del diseñador visual de interfaces (lo usan UiEditor, UiDesignerPanel y UiDesignOverlay).
// El modelo (core/ui/design.js) es la fuente de la <template>: cada cambio la regenera, guarda el bloque <design> y
// crea en el <script> las funciones y variables que el diseño necesita.
import { reactive } from 'vue'
import { newDesign, addControl, removeControl, duplicateControl, bringToFront, sendToBack, reparent, byId, sanitizeName, uniqueName, CONTROLS, handlerName, IDENT, cssIdent, cssClasses } from '../engine/runtime/ui/design.js'
import { parseDesign, serializeDesign, generateTemplate, templateInSync, isBlankTemplate } from '../engine/runtime/ui/design-html.js'
import { ensureScriptSymbol, requiredSymbols, scriptHasSymbol } from '../engine/runtime/ui/design-script.js'
import { presetDesign } from '../engine/runtime/ui/dialog-presets.js'

/**
 * @param getParts  () => { template, script, design }  (texto actual de cada bloque)
 * @param patch     ({ template?, script?, design? }) => void   escribe los bloques y guarda el .ui
 * @param jump      (tab, line) => void                          abre una pestaña del editor en una línea
 */
export function createDesigner({ getParts, patch, jump }) {
  const dz = reactive({ design: null, sel: null, tool: null, snap: true, grid: 8, stale: false, mode: 'html', legacy: false }) // las vistas comparten dz, sin estado de panel alternable
  const cur = () => (dz.design && dz.sel ? byId(dz.design, dz.sel) : null)

  /** Decide la vista inicial según lo que haya en el .ui. */
  function load() {
    const { template, design } = getParts()
    const d = parseDesign(design)
    dz.sel = null; dz.tool = null; dz.stale = false; dz.legacy = false
    if (d) {
      dz.design = d
      if (templateInSync(d, template)) dz.mode = 'designer'
      else { dz.mode = 'html'; dz.stale = true }
    } else if (isBlankTemplate(template)) { dz.design = newDesign(); dz.mode = 'designer' }
    else { dz.design = null; dz.mode = 'html'; dz.legacy = true }
  }

  /** Regenera la plantilla, guarda y completa el script. */
  function commit() {
    const d = dz.design
    if (!d) return
    const out = { template: generateTemplate(d), design: serializeDesign(d) }
    let script = getParts().script
    for (const s of requiredSymbols(d)) if (!scriptHasSymbol(script, s.name)) script = ensureScriptSymbol(script, s.kind, s.name, s.init).script
    if (script !== getParts().script) out.script = script
    dz.stale = false
    patch(out)
  }

  const select = (id) => { dz.sel = id }
  const setTool = (t) => { dz.tool = dz.tool === t ? null : t }
  function add(type, rect = {}, parentId = null) {
    if (!dz.design) dz.design = newDesign()
    const c = addControl(dz.design, type, rect, parentId)
    dz.sel = c.id; dz.tool = null
    commit()
    return c
  }
  /** Doble clic en la caja de herramientas: lo coloca en el contenedor seleccionado (o en el formulario), escalonado. */
  function addDefault(type) {
    const n = dz.design?.controls.length || 0
    const sel = cur()
    const parent = sel && CONTROLS[sel.type].container ? sel.id : null
    return add(type, { x: 24 + (n % 8) * 16, y: 24 + (n % 8) * 16 }, parent)
  }
  function remove(id = dz.sel) {
    if (!id || !dz.design) return
    removeControl(dz.design, id)
    if (!byId(dz.design, dz.sel)) dz.sel = null
    commit()
  }
  function duplicate(id = dz.sel) { const c = id && dz.design && duplicateControl(dz.design, id); if (c) { dz.sel = c.id; commit() } }
  function front(id = dz.sel) { if (id) { bringToFront(dz.design, id); commit() } }
  function back(id = dz.sel) { if (id) { sendToBack(dz.design, id); commit() } }
  /** Cambia el contenedor conservando las coordenadas absolutas; no permite ciclos ni padres sin capacidad de contener. */
  function moveToParent(id, parentId = null) {
    const d = dz.design
    if (!d || !byId(d, id)) return false
    const parent = parentId ? byId(d, parentId) : null
    if (parentId && (!parent || !CONTROLS[parent.type]?.container)) return false
    if (!reparent(d, id, parentId)) return false
    dz.sel = id
    commit()
    return true
  }

  /** Cambia una propiedad (con validación). */
  function setProp(id, key, val) {
    const c = byId(dz.design, id)
    if (!c) return
    if (key === 'name') {
      let n = sanitizeName(val, CONTROLS[c.type].base)
      if (dz.design.controls.some((x) => x.id !== id && x.name.toLowerCase() === n.toLowerCase())) n = uniqueName(dz.design, n.replace(/\d+$/, '') || CONTROLS[c.type].base)
      c.name = n
    } else if (key === 'anchor') c.anchor = val.map(Boolean)
    else if (key === 'cssId') c.cssId = cssIdent(val)
    else if (key === 'cssClass') c.cssClass = cssClasses(val)
    else if (typeof c[key] === 'number') { const v = +val; c[key] = Number.isFinite(v) ? (['x', 'y', 'w', 'h'].includes(key) ? Math.round(v) : v) : c[key]; if (key === 'w' || key === 'h') c[key] = Math.max(1, c[key]) }
    else if (typeof c[key] === 'boolean') c[key] = !!val
    else c[key] = String(val ?? '')
    commit()
  }
  function setEvent(id, evt, expr) {
    const c = byId(dz.design, id)
    if (!c) return
    if (String(expr || '').trim()) c.events[evt] = String(expr).trim(); else delete c.events[evt]
    commit()
  }
  /** «Crear función»: pone boton1_Click en el evento, la declara en el script y salta a ella. */
  function createHandler(id, evt) {
    const c = byId(dz.design, id)
    if (!c) return
    const ex = (c.events[evt] || '').trim()
    const name = IDENT.test(ex) ? ex : handlerName(c, evt)
    c.events[evt] = name
    const r = ensureScriptSymbol(getParts().script, 'function', name)
    dz.stale = false
    patch({ template: generateTemplate(dz.design), design: serializeDesign(dz.design), script: r.script })
    jump('script', r.line + 1)
  }
  const setForm = (key, val) => {
    if (!dz.design) dz.design = newDesign()
    const f = dz.design.form
    if (key === 'back') f.back = String(val || '')
    else if (key === 'kind' || key === 'enter' || key === 'exit') f[key] = String(val || (key === 'kind' ? '' : 'none'))
    else if (key === 'exitMs') { const v = Math.round(+val); if (Number.isFinite(v)) f.exitMs = Math.min(3000, Math.max(0, v)) }
    else if (key === 'scale') f.scale = val === 'screen' ? 'screen' : 'none'
    else if (key === 'enterMs') { const v = Math.round(+val); if (Number.isFinite(v)) f.enterMs = Math.min(3000, Math.max(0, v)) }
    else { const v = Math.round(+val); if (Number.isFinite(v)) f[key] = Math.min(key === 'w' ? 7680 : 4320, Math.max(100, v)) }
    commit()
  }

  /** Sustituye el diseño por una plantilla (diálogo clásico, novela visual…); el Script y el Estilo se conservan. */
  function applyPreset(kind, key) {
    const d = presetDesign(kind, key)
    if (!d) return
    dz.design = d; dz.sel = null; dz.legacy = false; dz.stale = false; dz.mode = 'designer'
    commit()
  }

  // --- paso entre vistas / plantilla escrita a mano ---
  const setMode = (m) => { dz.mode = m; dz.tool = null }
  /** Empieza un diseño nuevo: sustituye el HTML escrito a mano. */
  function startNew() { dz.design = newDesign(); dz.sel = null; dz.legacy = false; dz.mode = 'designer'; commit() }
  /** Vuelve a generar la plantilla desde el diseño (descarta el HTML tocado a mano). */
  function regenerate() { dz.mode = 'designer'; commit() }
  /** Conserva el HTML y suelta el diseño. */
  function detach() { dz.design = null; dz.stale = false; dz.legacy = true; dz.mode = 'html'; patch({ design: '' }) }
  /** Se editó la plantilla a mano. */
  function htmlEdited() { if (dz.design && !templateInSync(dz.design, getParts().template)) dz.stale = true }

  return { dz, applyPreset, cur, load, commit, select, setTool, add, addDefault, remove, duplicate, front, back, moveToParent, setProp, setEvent, createHandler, setForm, setMode, startNew, regenerate, detach, htmlEdited }
}
