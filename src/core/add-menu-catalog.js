// Proyección del registro de nodos para Shift+A (modo objeto).
// No es un segundo registro: conserva los tipos y claves del sistema existente.
const PRIMITIVE_KIND_ALIAS = Object.freeze({ cube: 'box' })

/** Evita duplicar en Shift+A las mallas que ya pueden crearse como primitivas.
 * Las geometrías exclusivas del tipo mesh siguen accesibles y mantienen su tipo real. */
export function shiftANodeCatalog(definitions = []) {
  const primitive = definitions.find((def) => def.type === 'primitive')
  const primitiveKinds = new Set(Object.keys(primitive?.kinds || {}))
  const items = []

  for (const def of definitions) {
    if (def.type === 'model' || def.creatable === false) continue // La sección de modelos importados es independiente.
    const category = def.type === 'mesh' ? 'Herramientas de modelado' : def.category
    if (def.kinds) {
      for (const [kind, variant] of Object.entries(def.kinds)) {
        const equivalent = PRIMITIVE_KIND_ALIAS[kind] || kind
        if (def.type === 'mesh' && primitiveKinds.has(equivalent)) continue
        items.push({ category, type: def.type, kind, label: variant.label, icon: variant.icon })
      }
    } else {
      items.push({ category, type: def.type, kind: def.type,
        label: def.type === 'group' ? 'Grupo vacío' : def.label, icon: def.icon })
    }
  }
  return items
}
