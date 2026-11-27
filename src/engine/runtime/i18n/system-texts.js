// Textos nativos de las interfaces del motor. El proyecto puede sobrescribirlos desde Localización.
const HELD = {
  'ui.held.use': { es: 'Usar', en: 'Use' },
  'ui.held.store': { es: 'Guardar', en: 'Store' },
  'ui.held.drop': { es: 'Soltar', en: 'Drop' },
  'ui.held.throw': { es: 'Lanzar', en: 'Throw' },
  'ui.held.hand.left': { es: 'Izq.', en: 'Left' },
  'ui.held.hand.right': { es: 'Der.', en: 'Right' },
}

export function systemText(key, language = 'es') {
  const translations = HELD[key]
  if (!translations) return String(key)
  return translations[String(language || '').toLowerCase().split('-')[0]] || translations.es
}
