// Animación de entrada y salida de un diálogo, unas opciones o un subtítulo, elegida en el COMANDO («Mostrar texto», «Mostrar
// opciones», «Subtítulo») o en game.say / game.choose / game.caption. Si no se elige, manda la de la interfaz (diseñador).
// Viaja en play.dialog.anim / play.choices.anim / play.caption.anim = { in, out, ms }; la aplica UiRoot. Sin DOM.
export const ANIM_IN = [['', 'Según la interfaz'], ['none', 'Ninguna'], ['fade', 'Fundido'], ['rise', 'Subir'], ['pop', 'Aparecer (escala)'], ['slide', 'Deslizar']]
export const ANIM_OUT = [['', 'Según la interfaz'], ['none', 'Ninguna'], ['fade', 'Fundido'], ['sink', 'Bajar'], ['shrink', 'Encoger'], ['slide', 'Deslizar']]
const IN = new Set(ANIM_IN.map(([k]) => k).filter(Boolean))
const OUT = new Set(ANIM_OUT.map(([k]) => k).filter(Boolean))

/** { enter, exit, duration (s) } → { in, out, ms } o null si se deja «según la interfaz». Acepta los alias in/out/ms. */
export function normalizeAnim(o) {
  if (!o || typeof o !== 'object') return null
  const i = String(o.enter ?? o.in ?? '').trim(), e = String(o.exit ?? o.out ?? '').trim()
  const a = { in: IN.has(i) ? i : '', out: OUT.has(e) ? e : '' }
  if (!a.in && !a.out) return null
  const s = o.duration ?? (o.ms != null ? +o.ms / 1000 : undefined)
  a.ms = Math.round(Math.min(3, Math.max(0, Number.isFinite(+s) && s !== '' && s != null ? +s : 0.25)) * 1000)
  return a
}

/** Fotogramas clave (Web Animations) de cada animación. */
export const ENTER_FRAMES = {
  fade: [{ opacity: 0 }, { opacity: 1 }],
  rise: [{ opacity: 0, translate: '0 24px' }, { opacity: 1, translate: '0 0' }],
  pop: [{ opacity: 0, scale: '.94' }, { opacity: 1, scale: '1' }],
  slide: [{ opacity: 0, translate: '-40px 0' }, { opacity: 1, translate: '0 0' }],
}
export const EXIT_FRAMES = {
  fade: [{ opacity: 1 }, { opacity: 0 }],
  sink: [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '0 28px' }],
  shrink: [{ opacity: 1, scale: '1' }, { opacity: 0, scale: '.94' }],
  slide: [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '-40px 0' }],
}
/** Qué estado de play lleva la animación de cada uso de interfaz. */
export const ANIM_SOURCE = { dialog: 'dialog', choices: 'choices', caption: 'caption' }
