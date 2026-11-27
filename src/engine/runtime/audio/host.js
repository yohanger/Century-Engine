// Quién puede llevar una fuente de audio: el nodo AudioSource (sus props) y, como componente interno, toda luz salvo la direccional (obj.light.audio).
export const hasAudio = (o) => !!o && (o.type === 'audio' || (o.type === 'light' && o.light?.type !== 'directional'))
/** Objeto con los parámetros de la fuente (normalizeSource los completa). En luces se crea al pedirlo para escribir. */
export function audioHost(o) {
  if (o.type === 'audio') return o.props
  return (o.light.audio ||= {})
}
/** ¿Hay que sonar al empezar? Una luz sin clip no suena. */
export const audible = (o) => hasAudio(o) && (o.type === 'audio' || !!o.light?.audio?.clip)
