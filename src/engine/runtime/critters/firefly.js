// Luciérnagas. Comportamiento real, no una nube de puntos al azar:
//
//  · Salen al anochecer (o cuando se enciende la oscuridad del mundo) de forma ESCALONADA: cada una tiene su retraso.
//  · Parpadean con un oscilador propio (fase φ) y se SINCRONIZAN entre sí (modelo de Kuramoto): con el tiempo el cluster
//    enciende y apaga casi a la vez, como las luciérnagas de verdad. `sync` es la fuerza de ese acoplamiento.
//  · Vuelan despacio, con un deambular suave, atraídas hacia el centro del cluster y manteniendo una altura sobre el suelo.
//  · Se asustan si el jugador (la cámara) se acerca deprisa: huyen y apagan la luz un momento.
//  · Se refugian (bajan y se posan) con lluvia, con viento fuerte, con nieve o al amanecer.
// La IA es una máquina de estados (fsm.js): rest → rise → glow ⇄ flee → shelter → rest.
import { StateMachine } from './fsm.js'
import { registerSpecies } from './species.js'

const TAU = Math.PI * 2
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const lerp = (a, b, t) => a + (b - a) * t

/** Destello: un pulso corto y brillante con una cola suave. φ en 0–1. */
export const flash = (phi) => { const x = Math.sin(phi * TAU); return x > 0 ? Math.pow(x, 5) : 0 }

/** ¿Hay que quedarse en el suelo? lluvia, nieve, viento fuerte o de día. */
const mustHide = (cl, ctx) => ctx.rain > 0.25 || ctx.snow > 0.1 || ctx.windSpeed > cl.p.windLimit || ctx.dark < 0.4

const machine = new StateMachine({
  rest: {
    enter(a) { a.glow = 0; a.vx = a.vy = a.vz = 0 },
    update(a, dt, ctx) { if (a.t > a.delay && !mustHide(a.cl, ctx)) return 'rise' },
  },
  rise: {
    enter(a, ctx) { a.delay = 0; a.targetY = a.cl.groundAt(a.x, a.z, ctx) + lerp(a.cl.p.minHeight, a.cl.p.maxHeight, a.r1) },
    update(a, dt, ctx) {
      if (mustHide(a.cl, ctx)) return 'shelter'
      a.glow = sm(0, 2.5, a.t) * 0.6
      if (a.y > a.targetY - 0.15 || a.t > 8) return 'glow'
    },
  },
  glow: {
    update(a, dt, ctx) {
      if (mustHide(a.cl, ctx)) return 'shelter'
      const d2 = (a.x - ctx.cam.x) ** 2 + (a.y - ctx.cam.y) ** 2 + (a.z - ctx.cam.z) ** 2
      if (d2 < 2.2 * 2.2 && ctx.camSpeed > 1.2 || d2 < 0.9 * 0.9) return 'flee'
      a.glow = flash(a.phase) * a.cl.p.brightness
    },
  },
  flee: {
    enter(a, ctx) {
      const dx = a.x - ctx.cam.x, dz = a.z - ctx.cam.z, l = Math.hypot(dx, dz) || 1
      a.fx = dx / l; a.fz = dz / l
    },
    update(a, dt, ctx) {
      a.glow *= Math.exp(-dt * 6)
      if (mustHide(a.cl, ctx)) return 'shelter'
      if (a.t > 1.2 + a.r2) return 'glow'
    },
  },
  shelter: {
    update(a, dt, ctx) {
      a.glow *= Math.exp(-dt * 2.5)
      const g = a.cl.groundAt(a.x, a.z, ctx) + 0.12
      if (a.y <= g + 0.03 && a.glow < 0.02) { a.delay = 2 + a.r2 * 20; return 'rest' }
      if (!mustHide(a.cl, ctx) && a.t > 4 + a.r1 * 6) return 'rise'    // se acabó la lluvia: vuelven a salir
    },
  },
}, 'rest')

registerSpecies({
  id: 'firefly',
  label: 'Luciérnagas',
  params: [
    { key: 'count', label: 'Cantidad', type: 'number', min: 1, max: 300, step: 1, def: 40 },
    { key: 'radius', label: 'Radio (m)', type: 'number', min: 0.5, max: 60, step: 0.5, def: 8, hint: 'Zona donde viven; vuelven a ella si se alejan' },
    { key: 'minHeight', label: 'Altura mín. (m)', type: 'number', min: 0.1, max: 10, step: 0.1, def: 0.5 },
    { key: 'maxHeight', label: 'Altura máx. (m)', type: 'number', min: 0.2, max: 20, step: 0.1, def: 2.6 },
    { key: 'speed', label: 'Velocidad (m/s)', type: 'number', min: 0.05, max: 4, step: 0.05, def: 0.55 },
    { key: 'blink', label: 'Parpadeo (s)', type: 'number', min: 0.8, max: 12, step: 0.1, def: 3.2, hint: 'Tiempo entre destellos' },
    { key: 'sync', label: 'Sincronía', type: 'number', min: 0, max: 1, step: 0.05, def: 0.45, hint: '0 = cada una a lo suyo · 1 = todas a la vez' },
    { key: 'brightness', label: 'Brillo', type: 'number', min: 0.1, max: 3, step: 0.05, def: 1 },
    { key: 'size', label: 'Tamaño', type: 'number', min: 0.2, max: 4, step: 0.05, def: 1 },
    { key: 'color', label: 'Color', type: 'color', def: '#c9ff4f' },
    { key: 'windLimit', label: 'Se refugian con viento (m/s)', type: 'number', min: 2, max: 30, step: 0.5, def: 8 },
  ],
  machine,
  look: { size: 0.09 },

  init(a, cl, rnd) {
    a.cl = cl
    a.r1 = rnd(); a.r2 = rnd()
    const ang = rnd() * TAU, r = Math.sqrt(rnd()) * cl.p.radius
    a.x = cl.x + Math.cos(ang) * r; a.z = cl.z + Math.sin(ang) * r
    a.y = cl.groundAt(a.x, a.z, null) + 0.12
    a.vx = a.vy = a.vz = 0
    a.phase = rnd(); a.omega = (1 / cl.p.blink) * (0.9 + rnd() * 0.2)
    a.heading = rnd() * TAU
    a.glow = 0; a.delay = rnd() * 45                                 // salen escalonadas
    a.fx = a.fz = 0
  },

  /** Campo medio de la sincronización (Kuramoto): R·e^{iΨ} = media de e^{iφ} de las que vuelan. */
  groupStep(cl, dt, ctx) {
    let c = 0, s = 0, n = 0
    for (const a of cl.agents) if (a.state === 'glow') { c += Math.cos(a.phase * TAU); s += Math.sin(a.phase * TAU); n++ }
    cl.mf = n ? { R: Math.hypot(c, s) / n, psi: Math.atan2(s, c) / TAU } : { R: 0, psi: 0 }
  },

  step(a, dt, cl, ctx) {
    const p = cl.p, st = a.state
    // el reloj del parpadeo corre siempre (las apagadas también), acoplado al campo medio cuando vuelan
    let dphi = a.omega
    if (st === 'glow' && cl.mf.R > 0.01) dphi += (p.sync * 3 * cl.mf.R * Math.sin((cl.mf.psi - a.phase) * TAU)) / TAU  // Kuramoto: dφ/dt = ω + K·R·sin(Ψ − φ)
    a.phase = (a.phase + dphi * dt) % 1
    if (st === 'rest') return
    const ground = cl.groundAt(a.x, a.z, ctx) + 0.1
    let ax = 0, ay = 0, az = 0
    const sp = p.speed * (st === 'flee' ? 3.2 : st === 'rise' ? 0.7 : 1)
    if (st === 'glow' || st === 'rise' || st === 'flee') {
      // deambular: el rumbo gira un poco al azar; la deriva del viento arrastra suavemente
      a.heading += (Math.sin(ctx.time * (0.7 + a.r1) + a.r2 * 30) * 0.9 + (a.r1 - 0.5) * 0.5) * dt
      ax += Math.cos(a.heading) * sp; az += Math.sin(a.heading) * sp
      // vuelven a su zona
      const dx = cl.x - a.x, dz = cl.z - a.z, d = Math.hypot(dx, dz)
      if (d > p.radius * 0.7) { const k = Math.min(2, (d - p.radius * 0.7) / (p.radius * 0.3)); ax += (dx / d) * sp * 1.6 * k; az += (dz / d) * sp * 1.6 * k }
      if (st === 'flee') { ax += a.fx * sp; az += a.fz * sp; ay += 0.6 }
      ax += ctx.wind.x * 0.2; az += ctx.wind.z * 0.2
      // altura objetivo: oscila despacio entre mín. y máx.
      const ty = a.targetY !== undefined ? a.targetY + Math.sin(ctx.time * 0.4 + a.r2 * 20) * 0.25 : ground
      ay += (ty - a.y) * 1.4
    } else if (st === 'shelter') { ay += -0.9; ax += ctx.wind.x * 0.05; az += ctx.wind.z * 0.05 }
    // suavizado de la velocidad
    const k = 1 - Math.exp(-dt * 2.2)
    a.vx += (ax - a.vx) * k; a.vy += (ay - a.vy) * k; a.vz += (az - a.vz) * k
    a.x += a.vx * dt; a.y += a.vy * dt; a.z += a.vz * dt
    if (a.y < ground) a.y = ground
  },
})
