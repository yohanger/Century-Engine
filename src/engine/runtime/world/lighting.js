// Fuente única del control celeste. Ausencia del campo = proyecto antiguo sin migración implícita.
export function lightingMode(env = {}) {
  return env?.lightingMode === 'manual' || env?.lightingMode === 'cycle' ? env.lightingMode : 'legacy'
}

export function celestialTime(env = {}) {
  const time = { ...(env.time || {}) }
  const mode = lightingMode(env)
  if (mode === 'cycle') { time.on = true; time.celestialLights = true }
  if (mode === 'manual') { time.on = false; time.celestialLights = false }
  return time
}

import { nodeEffectiveActive } from '../nodes/hierarchy.js'

export function selectedSun(objects = [], env = {}, available = () => true) {
  const lights = objects.filter((o) => o?.type === 'light' && o.light?.type === 'directional' && o.visible !== false && available(o) && nodeEffectiveActive(objects, o))
  return lights.find((o) => o.id === env.sunLightId) || lights[0] || null
}
