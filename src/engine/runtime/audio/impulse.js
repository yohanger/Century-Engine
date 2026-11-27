// Respuesta al impulso sintética para la reverb.
/** Respuesta al impulso sintética para la reverb (ruido que decae; `damping` oscurece la cola). */
export function makeImpulse(ctx, time, damping) {
  const rate = ctx.sampleRate, len = Math.max(1, Math.floor(rate * time))
  const buf = ctx.createBuffer(2, len, rate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    let lp = 0
    for (let i = 0; i < len; i++) {
      const t = i / len, env = Math.pow(1 - t, 2.6)
      const n = Math.random() * 2 - 1
      const k = 0.15 + (1 - damping) * 0.85 * (1 - t * 0.6) // filtro de un polo: más damping = más grave con el tiempo
      lp += (n - lp) * k
      d[i] = lp * env
    }
  }
  return buf
}

