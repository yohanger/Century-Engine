// Traducción visual de las fases de World. No modifica física, recursos .vfx ni nubes persistidas.
const clamp01 = (x) => Math.max(0, Math.min(1, x))
const ease = (x) => { const p = clamp01(x); return p * p * (3 - 2 * p) }

/** Datos visuales derivados del único estado meteorológico; tiempos físicos y visuales independientes. */
export function tornadoVisualState(t, cloudBase = 900, durations = {}) {
  const phase = t?.phase ?? 'idle'
  const seconds = {
    development: durations.development ?? 8,
    organization: durations.organization ?? 6,
    formation: durations.formation ?? 5,
    active: t?.duration ?? 50,
    weakening: durations.weakening ?? 5,
    dissipation: durations.dissipation ?? 5,
  }
  const progress = ease((t?.phaseAge ?? 0) / Math.max(0.001, seconds[phase] ?? 1))
  const height = Math.max(t?.height ?? 5, Math.min(1800, (Number.isFinite(cloudBase) ? cloudBase : 900) - (t?.y ?? 0)))
  let reach = 0, opacity = 0, rope = 1
  switch (phase) {
    case 'development': opacity = progress * 0.16; reach = 0.008 + progress * 0.042; break
    case 'organization': opacity = 0.16 + progress * 0.23; reach = 0.05 + progress * 0.13; break
    case 'formation': opacity = 0.39 + progress * 0.61; reach = 0.18 + progress * 0.82; break
    case 'active': opacity = 1; reach = 1; break
    case 'weakening': opacity = 1 - progress * 0.27; reach = 1; rope = 1 - progress * 0.48; break
    case 'dissipation': opacity = 0.73 * (1-progress); reach = 1; rope = 0.52 - progress * 0.35; break
  }
  return { phase, progress, height, reach, opacity, rope, ground: reach > 0.7 && (t?.active === true),
    radius: Math.max(2, t?.radius ?? 18) }
}

/** Radio orientativo de condensación a lo largo del tramo visible, no radio del viento físico. */
export function tornadoFunnelRadius(visual, fraction) {
  const y = clamp01(fraction)
  return Math.max(35, visual.radius * 5) * Math.max(0.12, visual.rope) * (0.06 + 1.08 * Math.pow(y, 1.62))
}
