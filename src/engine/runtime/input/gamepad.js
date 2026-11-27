// Mando → InputState. Se llama una vez por fotograma: lee el primer mando conectado (mapeo estándar) y vuelca botones y ejes como entradas
// 'Pad0'…'Pad16' y 'PadLX±'/'PadLY±'/'PadRX±'/'PadRY±'. Sin mando conectado no hace nada (y suelta lo que hubiera pulsado).
import { padAxisToken } from './inputmap.js'

const AXES = [0, 1, 2, 3]
/** `pads` = lista de Gamepad (navigator.getGamepads()); inyectable para los tests. */
export function pollGamepad(input, pads = (typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [])) {
  const gp = Array.from(pads || []).find((p) => p && p.connected)
  const seen = (input._padTokens ||= new Set())
  const now = new Set()
  if (gp) {
    gp.buttons.forEach((b, i) => { const v = b.value > 0 ? b.value : b.pressed ? 1 : 0; const t = 'Pad' + i; input.set(t, v); if (v > 0) now.add(t) })
    for (const a of AXES) {
      const v = gp.axes[a] || 0
      const pos = padAxisToken(a, 1), neg = padAxisToken(a, -1)
      input.set(pos, v > 0 ? Math.min(1, v) : 0); input.set(neg, v < 0 ? Math.min(1, -v) : 0)
      if (v > 0) now.add(pos); else if (v < 0) now.add(neg)
    }
  }
  for (const t of seen) if (!now.has(t)) input.set(t, 0) // lo que se soltó o el mando desconectado
  input._padTokens = now
  return !!gp
}

/** Giro de cámara con el stick derecho: devuelve { yaw, pitch } en radianes para este fotograma (zona muerta 0,15 y curva cuadrática). */
export function padLook(input, dt, sensitivity = 1, speed = 2.6) {
  const ax = (p, n) => (input.held.get(p) || 0) - (input.held.get(n) || 0)
  const f = (v) => { const a = Math.abs(v); if (a < 0.15) return 0; const t = (a - 0.15) / 0.85; return Math.sign(v) * t * t }
  const k = speed * (sensitivity || 1) * dt
  return { yaw: -f(ax("PadRX+", "PadRX-")) * k + 0, pitch: -f(ax("PadRY+", "PadRY-")) * k + 0 }
}
