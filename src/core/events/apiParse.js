// Lector de game-api.d.ts (sin Vite ni DOM: lo usan también las pruebas de Node).
/**
 * Miembros de `interface <name>` del .d.ts: [{ name, signature, description, property }].
 * Formato esperado (el del propio archivo): comentario `/** … *\/` opcional y después `miembro(...)…` o `miembro: Tipo`,
 * una declaración por línea, con la sangría del cuerpo de la interfaz.
 */
export function parseInterface(dts, name = 'Game') {
  const lines = dts.split('\n')
  const start = lines.findIndex((l) => new RegExp(`^\\s*interface ${name}\\b.*\\{\\s*$`).test(l))
  if (start < 0) return []
  const baseIndent = lines[start].match(/^\s*/)[0].length
  const out = []
  let doc = [], inDoc = false
  for (let i = start + 1; i < lines.length; i++) {
    const raw = lines[i], t = raw.trim()
    const indent = raw.match(/^\s*/)[0].length
    if (t === '}' && indent === baseIndent) break
    if (!t) { doc = []; continue }
    if (t.startsWith('/**')) { doc = [t.replace(/^\/\*\*\s?/, '').replace(/\s?\*\/\s*$/, '')]; inDoc = !t.endsWith('*/'); continue }
    if (inDoc) { doc.push(t.replace(/^\*\s?/, '').replace(/\*\/\s*$/, '').trim()); if (t.endsWith('*/')) inDoc = false; continue }
    if (indent !== baseIndent + 2) continue
    const m = /^(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*(\??)(\(|:|<)/.exec(t)
    if (!m) { doc = []; continue }
    const property = m[3] === ':'
    out.push({ name: m[1], signature: `game.${t.replace(/^readonly\s+/, '').replace(/;\s*$/, '')}`, description: doc.join(' ').trim(), property })
    doc = []
  }
  // los métodos sobrecargados (game.on) se agrupan en una sola sugerencia
  const seen = new Map()
  for (const e of out) {
    const prev = seen.get(e.name)
    if (!prev) seen.set(e.name, { ...e })
    else prev.signature += '\n' + e.signature
  }
  return [...seen.values()]
}


/** Nombre del tipo de una propiedad, p. ej. `game.viewModel: ViewModel` → «ViewModel» (para sugerir también game.viewModel.attach). */
export function propertyType(entry) {
  const m = /:\s*(?:LF\.)?([A-Z]\w*)\s*$/.exec(entry.signature.split('\n')[0])
  return m ? m[1] : null
}
