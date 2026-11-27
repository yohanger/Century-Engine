// Transiciones por escena. Ausencia del campo = comportamiento heredado (sin automatización).
export const SCENE_FADE_DEFAULTS = Object.freeze({
  enter: true, exit: true, inSeconds: 1.2, outSeconds: 0.8,
  delay: 0.2, color: '#000000', curve: 'ease-in-out',
})
const curves = new Set(['linear', 'ease-in', 'ease-out', 'ease-in-out'])
const duration = (value, fallback) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(60, Number(value))) : fallback
export const normalizeSceneTransitions = (value) => {
  const src = value && typeof value === 'object' ? value : null
  const d = SCENE_FADE_DEFAULTS
  return {
    enter: src ? src.enter === true : false,
    exit: src ? src.exit === true : false,
    inSeconds: duration(src?.inSeconds, d.inSeconds),
    outSeconds: duration(src?.outSeconds, d.outSeconds),
    delay: duration(src?.delay, d.delay),
    color: /^#[0-9a-fA-F]{6}$/.test(src?.color || '') ? src.color : d.color,
    curve: curves.has(src?.curve) ? src.curve : d.curve,
  }
}
export const fadeState = (dir, seconds, color = '#000000', curve = 'linear') => ({
  color, alpha: dir === 'out' ? 1 : 0,
  ms: Math.round(duration(seconds, 0) * 1000),
  curve: curves.has(curve) ? curve : 'linear',
})
export const sceneFadeState = (...args) => ({ ...fadeState(...args), scene: true })

export const sceneFadeSeconds = (cfg, which, explicit) => {
  if (explicit !== undefined && explicit !== null) return duration(explicit, 0)
  return which === 'in' ? (cfg.enter ? cfg.inSeconds : 0) : (cfg.exit ? cfg.outSeconds : 0)
}
