// Servicio de navegación en juego y utilidades del editor: carga de los mapas horneados y consultas (ruta, punto más cercano, aleatorio).
import { NavGrid } from './grid.js'

/** Caché de mapas ya decodificados (id de archivo → NavGrid). Lo comparten el editor (vista previa) y el juego. */
export const navCache = new Map()

/** Mundo de navegación de la escena en juego: uno o varios mapas (uno por región). `game.nav` lo expone. */
export class NavWorld {
  constructor(regions = []) { this.regions = regions } // [{ id, name, grid }]
  get ready() { return this.regions.length > 0 }

  /** Reevaluación asíncrona de una región. Conserva el NavGrid original (Asset)
   * y publica el sustituto solo si pertenece a la misma solicitud y escena.
   * Un solo trabajo Jolt a la vez: no reconstruir en cada frame de Timeline.
   */
  requestBake(id, signature, builder, onError) {
    const region = this.regions.find(r => r.id === id)
    if (!region) throw new Error(`Navigation: región ${id} no existe`)
    if (signature === null) { this.restoreBake(id); return }
    if (typeof builder !== 'function' || typeof signature !== 'string')
      throw new TypeError('Navigation: solicitud de horneado inválida')
    const jobs = (this._bakeJobs ??= new Map())
    let job = jobs.get(id)
    if (job?.signature === signature) return
    if (!job) {
      job = { id, region, original:region.grid, signature:null, timer:null, working:false,
        controller:null, builder, onError }
      jobs.set(id,job)
    }
    job.signature = signature
    job.builder = builder
    job.onError = onError
    job.controller?.abort()
    if (!job.working && !job.timer) job.timer = setTimeout(() => this._runBake(job), 180)
  }

  _runBake(job) {
    if (this._bakeJobs?.get(job.id) !== job) return
    job.timer = null
    if (job.working) return
    // Solo hay un mundo de bake temporal a la vez, incluso con regiones múltiples.
    if (this._bakeActive && this._bakeActive !== job) {
      job.timer = setTimeout(() => this._runBake(job), 180)
      return
    }
    this._bakeActive = job
    job.working = true
    const key = job.signature
    const controller = new AbortController()
    job.controller = controller
    Promise.resolve().then(() => job.builder(controller.signal)).then(grid => {
      if (controller.signal.aborted || this._bakeJobs?.get(job.id) !== job || job.signature !== key) return
      if (!(grid instanceof NavGrid) || !grid.h?.length || grid.h.length !== grid.ok?.length)
        throw new Error('Navigation: el horneado devolvió una malla inválida')
      job.region.grid = grid
    }).catch(error => {
      if (controller.signal.aborted || this._bakeJobs?.get(job.id) !== job) return
      job.region.grid = job.original
      try { job.onError?.(error) }
      catch (reportError) { console.error('Navigation: error al informar un horneado fallido', reportError) }
    }).finally(() => {
      if (this._bakeActive === job) this._bakeActive = null
      job.working = false
      if (job.controller === controller) job.controller = null
      if (this._bakeJobs?.get(job.id) === job && job.signature !== key && !job.timer)
        job.timer = setTimeout(() => this._runBake(job), 180)
    })
  }

  /** STOP/teardown abortan cualquier operación pendiente y restauran al instante.
   * Ningún resultado asíncrono de otra escena podrá reemplazar el mapa.
   */
  restoreBake(id) {
    const job = this._bakeJobs?.get(id)
    if (!job) return
    this._bakeJobs.delete(id)
    if (job.timer) clearTimeout(job.timer)
    job.controller?.abort()
    job.region.grid = job.original
  }
  dispose() {
    for (const id of [...this._bakeJobs?.keys() || []]) this.restoreBake(id)
    this.regions.length = 0
  }

  /** Región que contiene (x,z) o, si no, la más cercana. */
  gridAt(x, z) {
    let best = null, region = null, bd = Infinity
    for (const r of this.regions) {
      const g = r.grid, cx = Math.max(g.x0, Math.min(x, g.x0 + g.nx * g.cell)), cz = Math.max(g.z0, Math.min(z, g.z0 + g.nz * g.cell))
      const d = Math.hypot(cx - x, cz - z)
      if (d < bd) { bd = d; best = g; region = r }
    }
    if (!best) return null
    // Vista por región: las consultas A* respetan la altura animada sin mutar
    // NavGrid compartido en Assets/Navigation ni sus arrays horneados.
    const step = region?.node?.userData && Object.hasOwn(region.node.userData,'timelineNavStepHeight')
      ? region.node.userData.timelineNavStepHeight : undefined
    if (step === undefined) return best
    if (!Number.isFinite(step) || step < 0 || step > 3)
      throw new RangeError('Navigation: escalón máximo temporal fuera de rango')
    const view = Object.create(best)
    view.step = step
    return view
  }
  /** Ruta de `from` a `to` ([x,y,z]). → { points:[[x,y,z]…], length, partial } o null. */
  path(from, to, opts = {}) {
    const g = this.gridAt(from[0], from[2]); if (!g) return null
    return g.findPath(from, to, opts)
  }
  /** Punto transitable más cercano ([x,y,z]) o null. */
  nearest(p, maxDist = 6) {
    const g = this.gridAt(p[0], p[2]); if (!g) return null
    const n = g.nearest(p[0], p[1], p[2], maxDist)
    return n < 0 ? null : g.nodePos(n)
  }
  /** Punto transitable al azar alrededor de `center` ([x,y,z]) dentro de `radius`. */
  randomPoint(center, radius = 5, rng = Math.random) {
    const g = this.gridAt(center[0], center[2]); if (!g) return null
    return g.randomPoint(center, radius, rng)
  }
  /** ¿Se puede ir andando en línea recta? */
  canWalk(a, b) { const g = this.gridAt(a[0], a[2]); return !!g && g.canWalk(a, b) }
}
