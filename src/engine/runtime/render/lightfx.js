// Estilos de luz animados. Misma función para el editor, el juego y la exportación: el resultado es un
// multiplicador de la energía de la luz en función del tiempo.
export const LIGHT_STYLES = {
  steady: { id: 0, label: 'Fija' },
  candle: { id: 1, label: 'Vela (parpadeo suave)' },
  torch: { id: 2, label: 'Antorcha / fuego' },
  pulse: { id: 3, label: 'Pulso (respira)' },
  neon: { id: 4, label: 'Neón con fallos' },
  strobe: { id: 5, label: 'Estrobo' },
}
const fract = (x) => x - Math.floor(x)
const sat = (x) => Math.max(0, Math.min(1, x))

/** Multiplicador (≥0) para el estilo `id`. t en segundos, speed y amount ≥ 0, phase en [0,1000). */
export function lightMult(id, t, speed, amount, phase) {
  const s = t * speed + phase
  switch (id) {
    case 1: { // vela: dos ondas lentas + un temblor rápido pequeño
      const n = 0.5 * Math.sin(s * 7.1) + 0.3 * Math.sin(s * 11.3 + 1.7) + 0.2 * Math.sin(s * 23.7 + 0.4)
      return Math.max(0, 1 + amount * 0.6 * n)
    }
    case 2: { // antorcha: más rápida y con saltos
      const n = 0.4 * Math.sin(s * 9.3) + 0.3 * Math.sin(s * 17.1 + 2.1) + 0.2 * Math.sin(s * 31.7 + 0.9) + 0.1 * Math.sin(s * 53.3 + 4.0)
      return Math.max(0, 1 + amount * 0.9 * n)
    }
    case 3: // pulso: respiración suave (fosforescente)
      return 1 - amount * (0.5 + 0.5 * Math.sin(s * 6.2831853 * 0.5))
    case 4: { // neón: casi siempre encendido, con cortes y zumbido
      const n = Math.sin(s * 13.0) * Math.sin(s * 7.3 + 1.0) * Math.sin(s * 3.1 + 2.0)
      const hum = 0.03 * Math.sin(s * 120.0)
      return Math.max(0, (n > 0.45 ? 1 - amount : 1) + hum)
    }
    case 5: // estrobo
      return fract(s) < 0.15 ? 1 : 1 - amount
    default: return 1
  }
}
