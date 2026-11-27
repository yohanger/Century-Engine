// Índice de la documentación (docs/*.md): qué páginas hay y en qué sección del visor (Ayuda ▸ Documentación) aparecen.
// «prueba retirada» comprueba que coincide con los archivos de docs/.
export const DOC_SECTIONS = ['Inicio', 'Guía', 'Tutorial', 'Referencia']
export const DOC_PAGES = [
  { path: 'index.md', section: 'Inicio' },
  { path: 'guia/primeros-pasos.md', section: 'Guía' },
  { path: 'guia/conceptos.md', section: 'Guía' },
  { path: 'tutorial/vertical-slice.md', section: 'Tutorial' },
  { path: 'referencia/comandos.md', section: 'Referencia' },
  { path: 'referencia/api.md', section: 'Referencia' },
  { path: 'referencia/ui.md', section: 'Referencia' },
  { path: 'referencia/textos.md', section: 'Referencia' },
  { path: 'referencia/shaders.md', section: 'Referencia' },
]
/** Título de una página: su primer encabezado «# …». */
export const docTitle = (md) => (/^#\s+(.+)$/m.exec(String(md || '')) || [])[1]?.replace(/`/g, '').trim() || ''
/** Ruta de un enlace relativo desde una página: ('guia/conceptos.md', '../referencia/api.md#x') → { path: 'referencia/api.md', hash: 'x' }. */
export function resolveDocLink(from, href) {
  const [p, hash = ''] = String(href).split('#')
  if (!p) return { path: from, hash }
  const parts = from.split('/').slice(0, -1)
  for (const seg of p.split('/')) { if (seg === '..') parts.pop(); else if (seg && seg !== '.') parts.push(seg) }
  return { path: parts.join('/'), hash }
}
