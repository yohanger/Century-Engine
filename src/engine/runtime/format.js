// Formato de datos del Runtime, versionado. Es del Runtime (no del editor): lo usan igual el editor al abrir un proyecto y el
// reproductor del juego exportado. El `.lfproj` es solo el contenedor; lo que el Runtime interpreta (interfaces .ui, shaders .glsl)
// lleva aquí su propia versión (`runtimeFormat`) y sus propias migraciones.
//
//   v1  vocabulario antiguo: etiquetas <lf-bar>, clases lf-*, variables --lf-*, funciones GLSL lfNoise…
//   v2  vocabulario `rt` (rt-*, --rt-*, rtNoise…). Una sola nomenclatura, sin alias del vocabulario antiguo.
//
// Este es el ÚNICO archivo del Runtime que conoce el vocabulario antiguo (check-layers y la prueba autónoma lo permiten aquí).

export const FORMAT_VERSION = 2

// Reglas v1 → v2 (por palabra completa; no tocan identificadores que solo contienen «lf» por dentro).
const RULES_V1_TO_V2 = [
  [/(?<![A-Za-z0-9_])(?<![A-Za-z0-9_]-)lf-/g, 'rt-'], // etiquetas, clases, variables CSS (no «a-lf-b»)
  [/\blf([A-Z])/g, 'rt$1'], // funciones y uniforms GLSL / JS
  [/\bLf([A-Z])/g, 'Rt$1'], // componentes
]
// Lo mismo para detectar restos (informe de revisión manual).
const LEGACY_RE = /(?<![A-Za-z0-9_])(?<![A-Za-z0-9_]-)lf-|\blf[A-Z]|\bLf[A-Z]/

/** Reescribe el vocabulario v1 de un texto al v2. Devuelve el texto nuevo (o el mismo si no hay nada). */
export function renameMarks(text) {
  if (typeof text !== 'string' || !text) return text
  let out = text
  for (const [re, to] of RULES_V1_TO_V2) out = out.replace(re, to)
  return out
}

/** ¿El texto contiene algo del vocabulario antiguo? */
export const hasLegacyMarks = (text) => typeof text === 'string' && LEGACY_RE.test(text)

/** Primeras líneas de un texto que mencionan el vocabulario antiguo: [{ line, text }] (para el informe). */
export function legacyLines(text, max = 5) {
  const out = []
  if (typeof text !== 'string') return out
  const lines = text.split('\n')
  for (let i = 0; i < lines.length && out.length < max; i++) if (LEGACY_RE.test(lines[i])) out.push({ line: i + 1, text: lines[i].trim().slice(0, 120) })
  return out
}

// Reescribe todas las cadenas de un valor JSON (grafos de shader, etc.). Devuelve cuántas cadenas cambió.
function renameDeep(v, bump) {
  if (typeof v === 'string') { const n = renameMarks(v); if (n !== v) bump(); return n }
  if (Array.isArray(v)) return v.map((x) => renameDeep(x, bump))
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = renameDeep(v[k], bump); return o }
  return v
}

/**
 * Versión de formato de unos datos. Los proyectos anteriores no la traen → 1.
 * @param {{runtimeFormat?: number}} data
 */
export const formatOf = (data) => (Number.isInteger(data?.runtimeFormat) ? data.runtimeFormat : 1)

/**
 * Sube los datos del Runtime a FORMAT_VERSION, EN EL SITIO. Si ya están al día no toca nada.
 * Trabaja sobre `data.uis[]` y `data.shaders[]` (código y grafo) y revisa `data.scripts[]` sin modificarlos.
 * Devuelve el informe: { from, to, upgraded (subió de versión), changed (hubo algo reescrito o que revisar), rewritten: [{ kind, name }], review: [{ kind, name, lines }] }.
 * `review` lista lo que el Runtime no se atreve a reescribir (código de scripts que menciona el vocabulario antiguo).
 */
export function upgradeFormat(data) {
  const from = formatOf(data)
  const report = { from, to: FORMAT_VERSION, upgraded: false, changed: false, rewritten: [], review: [] }
  if (!data || from >= FORMAT_VERSION) return report
  if (from < 2) {
    for (const [kind, list] of [['ui', data.uis], ['shader', data.shaders]]) {
      for (const it of list || []) {
        let n = 0
        const bump = () => n++
        if (typeof it.code === 'string') { const c = renameMarks(it.code); if (c !== it.code) { it.code = c; n++ } }
        if (it.graph) it.graph = renameDeep(it.graph, bump)
        if (n) report.rewritten.push({ kind, name: it.name || it.id })
      }
    }
    // Los scripts son código del usuario: no se tocan, pero se avisa de los que usan el vocabulario antiguo (p. ej. clases en cadenas).
    for (const s of data.scripts || []) {
      const lines = legacyLines(s.code)
      if (lines.length) report.review.push({ kind: 'script', name: s.name || s.id, lines })
    }
  }
  data.runtimeFormat = FORMAT_VERSION
  report.upgraded = true
  report.changed = report.rewritten.length > 0 || report.review.length > 0 // hay algo que contar al usuario
  return report
}
