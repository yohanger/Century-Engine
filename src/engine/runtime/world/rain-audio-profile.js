// Perfil acústico de impactos: clips de Assets, sin audio generado ni volumen físico.
import { SURFACES } from '../layers.js'

const finite = (v, fallback, min, max) => typeof v === 'number' && Number.isFinite(v)
  ? Math.min(max, Math.max(min, v)) : fallback

export const RAIN_AUDIO_DEFAULT = Object.freeze({ enabled: false, surface: '', clips: [], volume: 0.7, pitch: 0.07, maxRate: 5 })

/** Los identificadores/nombres de clips se mantienen para compatibilidad con AudioScene.resolveClip. */
export function normalizeRainAudio(raw = {}) {
  const v = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const source = ['clip1', 'clip2', 'clip3', 'clip4'].some((key) => Object.hasOwn(v, key))
    ? [v.clip1, v.clip2, v.clip3, v.clip4] : (Array.isArray(v.clips) ? v.clips : [])
  const clips = source.map((c) => typeof c === 'string' ? c : c?.clip)
    .filter((c) => typeof c === 'string').slice(0, 8)
  return {
    enabled: v.enabled === true,
    surface: typeof v.surface === 'string' && SURFACES[v.surface] ? v.surface : '',
    clips,
    volume: finite(v.volume, RAIN_AUDIO_DEFAULT.volume, 0, 2),
    pitch: finite(v.pitch, RAIN_AUDIO_DEFAULT.pitch, 0, 0.3),
    maxRate: finite(v.maxRate, RAIN_AUDIO_DEFAULT.maxRate, 0, 15),
  }
}

export function normalizeRainProfiles(items) {
  const seen = new Set()
  return (Array.isArray(items) ? items : []).slice(0, 16).map((raw) => {
    const p = normalizeRainAudio(raw)
    return { ...p, clips: p.clips.filter(Boolean), clip1: p.clips[0] || '', clip2: p.clips[1] || '', clip3: p.clips[2] || '', clip4: p.clips[3] || '' }
  }).filter((p) => {
    if (!p.surface || seen.has(p.surface)) return false
    seen.add(p.surface)
    return true
  })
}
