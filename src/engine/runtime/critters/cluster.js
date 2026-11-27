// Un cluster = un grupo de agentes de UNA especie con su centro, su radio y sus parámetros. No dibuja: solo simula.
import { getSpecies, normalizeCritter } from './species.js'

let seed = 1
const makeRnd = (s) => { let r = (s >>> 0) || 1; return () => { r ^= r << 13; r >>>= 0; r ^= r >>> 17; r ^= r << 5; r >>>= 0; return r / 4294967296 } }
const hashStr = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0 }

export class CritterCluster {
  /** `obj` = nodo de la escena (type «critters»): position + props. */
  constructor(obj) {
    this.id = obj.id
    this.sig = ''
    this.agents = []
    this.mf = { R: 0, psi: 0 }
    this.configure(obj)
  }

  configure(obj) {
    this.p = normalizeCritter(obj.props)
    this.sp = getSpecies(this.p.species)
    this.x = obj.position[0]; this.y = obj.position[1]; this.z = obj.position[2]
    const n = Math.round(this.p.count)
    const rnd = makeRnd(hashStr(this.id) + 7)
    // conserva los agentes existentes si solo cambió algo suave; añade o quita hasta `count`
    while (this.agents.length > n) this.agents.pop()
    while (this.agents.length < n) { const a = { state: null, t: 0 }; this.sp.init(a, this, rnd); this.sp.machine.reset(a, null); this.agents.push(a) }
    for (const a of this.agents) a.cl = this
  }

  /** Altura del suelo bajo (x, z): el terreno o, sin él, el plano del cluster. */
  groundAt(x, z, ctx) {
    const g = ctx?.ground ? ctx.ground(x, z) : NaN
    return Number.isFinite(g) ? g : this.y
  }

  step(dt, ctx) {
    const sp = this.sp
    sp.groupStep?.(this, dt, ctx)
    for (const a of this.agents) { sp.machine.tick(a, dt, ctx); sp.step(a, dt, this, ctx) }
  }

  /** ¿Algún agente se mueve o brilla? (si todos descansan no hace falta seguir dibujando). */
  get active() { return this.agents.some((a) => a.state !== 'rest') }
}
