// Presupuesto de Play/Player. Decide con muestras reales; nunca ejecuta IA, red ni cambia gameplay.
import { summarize } from './perf.js'

const LOD = [1, 0.85, 0.65, 0.5]
const AO = [1, 0.75, 0.5, 0.5]

/** Política pura: ventanas de un segundo, calentamiento e histéresis para evitar oscilación. */
export class FrameBudgetPolicy {
  constructor(target = 60) { this.target = target; this.reset() }

  reset(now = 0) {
    this.geometry = 0; this.effects = 0
    this.slow = 0; this.fast = 0
    this.settleUntil = now + 1500
    this.clearWindow()
    this.report = { state: 'warming', bottleneck: 'unknown', target: this.target }
  }

  clearWindow() { this.frames = []; this.cpu = []; this.logic = []; this.gpu = []; this.elapsed = 0; this.calls = 0 }

  sample({ frameMs, cpuMs, logicMs, gpuMs = null, calls = 0, canGeometry = true, canEffects = true }, now) {
    const budget = 1000 / this.target
    // La visibilidad la resuelve el adaptador. Un GPU lento puede tardar >250 ms
    // y publicar consultas con varios frames de retraso: eso sigue siendo carga real.
    if (![frameMs, cpuMs, logicMs].every(Number.isFinite) || frameMs <= 0 || frameMs >= 2000 || cpuMs < 0 || logicMs < 0) {
      this.clearWindow(); this.slow = 0; this.fast = 0; this.settleUntil = now + 1500
      this.report = { state: 'warming', bottleneck: 'unknown', target: this.target,
        geometry: this.geometry, effects: this.effects }
      return false
    }
    if (now < this.settleUntil) return false
    // Una carga que acaba de desaparecer no debe disparar otra bajada con su ventana anterior.
    if (frameMs <= budget * 1.03 && cpuMs < budget * 0.7 && Number.isFinite(gpuMs) && gpuMs < budget * 0.7) this.slow = 0
    this.frames.push(frameMs); this.cpu.push(cpuMs); this.logic.push(logicMs)
    if (Number.isFinite(gpuMs) && gpuMs >= 0) this.gpu.push(gpuMs)
    this.elapsed += frameMs; this.calls += calls
    if (this.elapsed < 1000 || this.frames.length < 12 && (this.elapsed < 2000 || this.frames.length < 4)) return false

    const frame = summarize(this.frames), cpu = summarize(this.cpu), logic = summarize(this.logic)
    const gpu = this.gpu.length >= 2 ? summarize(this.gpu).avg : null
    const late = frame.avg > budget * 1.03 || frame.avg > budget * 1.01 && frame.p95 > budget * 1.15
    // Un tiempo de CPU incluye envío al driver, pero no sustituye una medida GPU.
    const bottleneck = logic.avg >= budget ? 'logic'
      : gpu !== null && gpu > budget * 0.85 ? 'gpu'
      : cpu.avg > budget * 0.85 ? 'submission'
      : late ? (gpu === null ? 'unknown' : 'pacing') : 'balanced'
    const headroom = !late && Math.max(cpu.avg, gpu ?? cpu.avg) < budget * 0.7
    this.slow = late ? this.slow + 1 : 0
    this.fast = headroom ? this.fast + 1 : 0
    let changed = false, state = late ? 'pressure' : 'stable'
    if (this.slow >= 2) {
      // Bajar efectos no resuelve un script lento ni una pantalla limitada a 30 Hz.
      if (bottleneck === 'logic' || bottleneck === 'pacing' || bottleneck === 'unknown') state = 'limited'
      else {
        const available = [canGeometry && this.geometry < 3 && 'geometry',
          bottleneck === 'gpu' && canEffects && this.effects < 3 && 'effects'].filter(Boolean)
        const key = available.includes('effects') && this.effects <= this.geometry ? 'effects' : available[0]
        if (key) { this[key]++; changed = true }
        else state = 'limited'
      }
    } else if (this.fast >= 6 && (this.geometry || this.effects)) {
      if (this.geometry >= this.effects && this.geometry) this.geometry--
      else this.effects--
      changed = true
    }
    this.report = { state: changed ? 'adapting' : state, bottleneck, target: this.target,
      fps: 1000 / frame.avg, frameMs: frame.avg, p95: frame.p95, cpuMs: cpu.avg, logicMs: logic.avg,
      gpuMs: gpu, calls: Math.round(this.calls / frame.n), geometry: this.geometry, effects: this.effects }
    this.clearWindow()
    if (changed) { this.slow = 0; this.fast = 0; this.settleUntil = now + 1500 }
    return changed
  }
}

/** Adaptador de los subsistemas existentes. Todos los cambios son transitorios y reversibles. */
export class RuntimePerformanceController {
  constructor(vp) {
    this.vp = vp
    this.policy = new FrameBudgetPolicy()
    this.active = false
    this.cloudScale = 1
    this.reflectionInterval = 900
    this.captureScale = 1
  }

  configure(cfg) {
    this.cfg = cfg
    const target = Number.isFinite(cfg.targetFps) ? Math.min(240, Math.max(20, cfg.targetFps)) : 60
    if (this.policy.target !== target) {
      this.policy.target = target
      this.policy.reset(performance.now())
    }
    if (cfg.performanceAuto === false) this.setActive(false)
    this.apply()
  }

  sync(now, visible = true) {
    const vp = this.vp
    this.setActive(!!(vp.playing && this.cfg && this.cfg.performanceAuto !== false && visible &&
      !vp._glLost && !vp.nativeBackend?.active), now)
    if (this._lod !== vp.lodManager) {
      this._lod = vp.lodManager
      if (this.active) { this.policy.reset(now); this.apply() }
    }
    // El gestor cambia al cargar otra escena; aplicar sin reconstruir ni regenerar LODs.
    this.applyLod()
  }

  setActive(on, now = performance.now()) {
    if (on === this.active) return
    this.active = on
    this.policy.reset(now)
    this.vp.perf.setBudgetEnabled(on)
    this.apply()
  }

  applyLod() {
    const lod = this.vp.lodManager
    if (!lod || lod.editorDiagnostics || !lod.enableLod) return
    const quality = Math.max(0.25, (this.cfg?.lodQuality || 1) * (this.active ? LOD[this.policy.geometry] : 1))
    lod.setBudgetQuality(quality)
  }

  apply() {
    const e = this.active ? this.policy.effects : 0
    this.cloudScale = 1 // El cielo conserva todas sus muestras: SkyVariants elimina ramas, no detalle.
    this.reflectionInterval = 900 * (1 + e)
    this.captureScale = 1 + e
    this.vp.perf.setRuntimeAoScale(AO[e])
    this.applyLod()
    this.publish()
    this.vp.requestRender()
  }

  sample(sample, now) {
    if (!this.active) return
    const vp = this.vp, lod = vp.lodManager
    sample.canGeometry = !!(lod?.enableLod && (lod.meshes.length || lod.terrains.length || lod.foliages.length || lod.clusters.entries.length))
    sample.canEffects = !!(vp.look.aoPass || this.cfg.dynamicReflections && this.cfg.reflections > 0 ||
      this.cfg.indirectProbeGrid && vp.look.profile !== 'bajo')
    if (this.policy.sample(sample, now)) this.apply()
    this.publish()
  }

  publish() {
    if (this._publishedReport === this.policy.report && this._publishedActive === this.active) return
    this._publishedReport = this.policy.report
    this._publishedActive = this.active
    this.vp.perf.stats.extra.performanceController = {
      ...this.policy.report, active: this.active, cloudScale: this.cloudScale,
      aoScale: this.vp.perf.runtimeAoScale, reflectionInterval: this.reflectionInterval, captureScale: this.captureScale,
    }
  }

  dispose() { this.setActive(false); this.vp.perf.gpu.dispose() }
}
