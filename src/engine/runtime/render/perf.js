// Medición del render: tiempos por pasada (CPU y GPU), duración de los fotogramas y contadores del renderer.
// PerfStats es lógica pura (se prueba en Node: «prueba retirada»). GpuTimer envuelve EXT_disjoint_timer_query_webgl2 cuando el
// navegador la ofrece (si no, el panel muestra solo tiempos de CPU). Fuera del panel, Play puede muestrear el presupuesto sin medir pasadas.

const WINDOW = 120

/** Media, máximo y percentil 95 de una lista (ya en ms). */
export function summarize(list) {
  const n = list.length
  if (!n) return { avg: 0, median: 0, max: 0, p95: 0, n: 0 }
  let sum = 0, max = 0
  for (const v of list) { sum += v; if (v > max) max = v }
  const sorted = [...list].sort((a, b) => a - b)
  return { avg: sum / n, median: n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2, max, p95: sorted[Math.min(n - 1, Math.floor(n * 0.95))], n }
}

class Ring {
  constructor(size) { this.size = size; this.a = []; this.i = 0 }
  push(v) { if (this.a.length < this.size) this.a.push(v); else { this.a[this.i] = v; this.i = (this.i + 1) % this.size } }
  /** En orden cronológico. */
  list() { return this.a.length < this.size ? this.a.slice() : [...this.a.slice(this.i), ...this.a.slice(0, this.i)] }
}

export class PerfStats {
  constructor(size = WINDOW) {
    this.size = size
    this.frames = new Ring(size)   // intervalo entre fotogramas (ms)
    this.cpu = new Map()           // nombre → Ring (ms de CPU por fotograma)
    this.gpu = new Map()           // nombre → Ring (ms de GPU por fotograma)
    this.gpuDetails = new Map()    // suboperaciones informativas, ya incluidas en las pasadas principales
    this.info = {}                 // contadores del renderer del último fotograma
    this.extra = {}                // datos libres (escala de resolución, luces volumétricas…)
    this._cur = new Map()          // nombre → ms acumulados en el fotograma en curso
    this._open = new Map()         // nombre → instante de inicio
  }

  /** Intervalo entre dos fotogramas (ms). Pausas largas (pestaña oculta) no cuentan. */
  frame(dtMs) { if (dtMs > 0 && dtMs < 500) this.frames.push(dtMs) }

  begin(name, now) { this._open.set(name, now) }
  end(name, now) {
    const t0 = this._open.get(name)
    if (t0 === undefined) return
    this._open.delete(name)
    this._cur.set(name, (this._cur.get(name) || 0) + (now - t0))
  }
  /** Cierra el fotograma: lo acumulado por nombre pasa a su serie. */
  endFrame() {
    for (const [k, v] of this._cur) { if (!this.cpu.has(k)) this.cpu.set(k, new Ring(this.size)); this.cpu.get(k).push(v) }
    for (const [k, r] of this.cpu) if (!this._cur.has(k)) r.push(0) // pasada que ya no se ejecuta: baja a 0 en lugar de quedarse congelada
    this._cur.clear()
  }
  gpuSample(name, ms) { if (!this.gpu.has(name)) this.gpu.set(name, new Ring(this.size)); this.gpu.get(name).push(ms) }
  /** Un único resultado por fotograma GPU completo. Una pasada ausente se registra a cero. */
  gpuFrame(samples) {
    for (const [name, ms] of Object.entries(samples)) this.gpuSample(name, ms)
    for (const [name, ring] of this.gpu) if (!(name in samples)) ring.push(0)
  }

  /** Desglose no sumable al total GPU: se publica por fotograma, con ceros para fases ausentes. */
  gpuDetailFrame(samples) {
    for (const [name, ms] of Object.entries(samples)) {
      if (!this.gpuDetails.has(name)) this.gpuDetails.set(name, new Ring(this.size))
      this.gpuDetails.get(name).push(ms)
    }
    for (const [name, ring] of this.gpuDetails) if (!(name in samples)) ring.push(0)
  }

  reset() { this.frames = new Ring(this.size); this.cpu.clear(); this.gpu.clear(); this.gpuDetails.clear(); this._cur.clear(); this._open.clear() }

  snapshot() {
    const f = summarize(this.frames.list())
    const rows = (m) => Object.fromEntries([...m].map(([k, r]) => [k, summarize(r.list())]))
    return {
      frameMs: f.avg, medianMs: f.median, p95: f.p95, maxMs: f.max, fps: f.avg ? 1000 / f.avg : 0,
      cpu: rows(this.cpu), gpu: rows(this.gpu), gpuDetails: rows(this.gpuDetails), info: { ...this.info }, extra: { ...this.extra },
      history: this.frames.list(),
    }
  }
}

/**
 * Temporizador de GPU por secciones. Las consultas de tiempo no se pueden anidar, así que una sección hija (las sombras dentro de la
 * escena) pausa a la madre y la reanuda al terminar. Los resultados llegan unos fotogramas después y se reparten por fotograma.
 */
export class GpuTimer {
  constructor(gl) {
    this.gl = gl
    this.ext = gl?.getExtension?.('EXT_disjoint_timer_query_webgl2') || null
    this.supported = !!this.ext
    this.stack = []        // secciones abiertas (la última es la activa)
    this.active = null     // { q, name }
    this.pending = []      // { q, name, frame }
    this.frame = 0
    this.done = new Map()  // fotograma → { nombre: ms }
    this.sink = null       // compatibilidad: (name, ms) al terminar un fotograma
    this.sinkFrame = null  // (samples) → una vez por fotograma GPU completo
  }

  _start(name) { if (!this.supported) return; const q = this.gl.createQuery(); this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q); this.active = { q, name } }
  _stop() {
    if (!this.supported || !this.active) return
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT)
    this.pending.push({ ...this.active, frame: this.frame })
    this.active = null
  }
  begin(name) {
    if (!this.supported) return
    if (this.stack.length) this._stop()
    this.stack.push(name)
    this._start(name)
  }
  end() {
    if (!this.supported || !this.stack.length) return
    this._stop()
    this.stack.pop()
    if (this.stack.length) this._start(this.stack[this.stack.length - 1])
  }
  /** Fin de fotograma: recoge lo que ya está listo. */
  endFrame() {
    if (!this.supported) return
    this.frame++
    const gl = this.gl
    if (gl.getParameter(this.ext.GPU_DISJOINT_EXT)) {
      for (const p of this.pending) gl.deleteQuery(p.q)
      this.pending.length = 0
      this.done.clear() // Tampoco publicar resultados anteriores al evento disjoint.
      return
    }
    while (this.pending.length) {
      const p = this.pending[0]
      if (!gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) break
      const ms = gl.getQueryParameter(p.q, gl.QUERY_RESULT) / 1e6
      gl.deleteQuery(p.q); this.pending.shift()
      const m = this.done.get(p.frame) || {}
      m[p.name] = (m[p.name] || 0) + ms
      this.done.set(p.frame, m)
    }
    // un fotograma está completo cuando ya no quedan consultas suyas pendientes
    const oldest = this.pending.length ? this.pending[0].frame : this.frame
    for (const [f, m] of [...this.done]) if (f < oldest) {
      this.done.delete(f)
      this.sinkFrame?.(m, { latencyFrames: this.frame - f })
      if (this.sink) for (const [k, v] of Object.entries(m)) this.sink(k, v)
    }
  }
  dispose() {
    if (this.active) {
      this.gl.endQuery(this.ext.TIME_ELAPSED_EXT)
      this.gl.deleteQuery(this.active.q)
      this.active = null
    }
    for (const p of this.pending) this.gl.deleteQuery(p.q)
    this.pending.length = 0
    this.stack.length = 0
    this.done.clear()
  }
}

/** Gestor único: Stats detallado al abrir el panel; presupuesto muestreado opcional durante Play. */
export class PerfMonitor {
  constructor(renderer, now = () => performance.now()) {
    this.renderer = renderer
    this.now = now
    this.stats = new PerfStats()
    this.gpu = new GpuTimer(renderer.getContext())
    this.gpu.sinkFrame = (samples, meta) => {
      if (this.budgetEnabled) this._budgetGpu = Object.values(samples).reduce((sum, ms) => sum + ms, 0)
      if (!this.enabled) return
      // La copia y la mezcla están incluidas en composición: solo los detalles las duplican.
      const compact = { ...samples }
      const copy = compact['AO · copia'], blend = compact['AO · mezcla'], fused = compact['AO · fusión']
      delete compact['AO · copia']; delete compact['AO · mezcla']; delete compact['AO · fusión']
      const details = {}
      if (copy !== undefined || blend !== undefined || fused !== undefined) {
        details['AO · copia'] = copy || 0
        details['AO · mezcla'] = blend || 0
        details['AO · fusión'] = fused || 0
        details['AO · preparación de salida'] = compact['AO · composición'] || 0
        compact['AO · composición'] = (compact['AO · composición'] || 0) + (copy || 0) + (blend || 0) + (fused || 0)
      }
      this.stats.gpuDetailFrame(details)
      const phaseNames = ['AO · G-buffer', 'AO · oclusión', 'AO · denoise', 'AO · composición']
      const phases = phaseNames.filter(name => name in compact)
      if (phases.length) {
        // AO y las demás fases GPU son exclusivas: no sumar AO total otra vez.
        const total = (compact.AO || 0) + phases.reduce((sum, name) => sum + compact[name], 0)
        compact['AO · total'] = total
      }
      this.stats.gpuFrame(compact)
      if (meta) this.stats.extra.gpuLatencyFrames = meta.latencyFrames
    }
    this.enabled = false
    this.budgetEnabled = false
    this._budgetFrame = 0
    this.budgetStride = 8
    this._budgetOpen = false
    this._budgetGpu = null
    this.runtimeAoScale = 1 // calidad temporal del controlador; independiente de los experimentos de F3
    this._last = 0
    this.aoScale = 1 // Experimento de Stats; nunca se guarda en el proyecto.
    this.aoCompositeMode = 'native' // La versión de un solo dibujo nunca se exporta por defecto.
    this.aoPass = null
  }
  get gpuSupported() { return this.gpu.supported }

  reset() {
    // Las consultas llegan diferidas: un reinicio también debe descartar las
    // pendientes para no mezclar resultados anteriores con las nuevas medias.
    this.gpu.dispose()
    this._budgetGpu = null
    this._budgetOpen = false
    this.stats.reset()
    this._last = 0
  }

  enable(on) {
    on = !!on
    if (this.enabled === on) return
    this.enabled = on
    this.renderer.info.autoReset = !(on || this.budgetEnabled) // incluye todas las pasadas del frame
    if (on) this.reset()
    else {
      this.setAoScale(1) // Restaura el experimento; el presupuesto AO de Play conserva su autoridad.
      this.setAoCompositeMode('native')
      this.gpu.dispose()
      this._budgetGpu = null
    }
  }

  setBudgetEnabled(on) {
    if (this.budgetEnabled === !!on) return
    this.budgetEnabled = !!on
    this.renderer.info.autoReset = !(this.enabled || this.budgetEnabled)
    this._budgetGpu = null
    this._budgetFrame = 0
    if (!this.enabled) this.gpu.dispose()
  }

  takeBudgetGpu() { const ms = this._budgetGpu; this._budgetGpu = null; return ms }

  /** Solo redimensiona GTAO existente: no cambia materiales, escena, exposición ni resolución de salida. */
  setRuntimeAoScale(scale) {
    if (![1, 0.75, 0.5].includes(scale) || this.runtimeAoScale === scale) return
    this.runtimeAoScale = scale
    const pass = this.aoPass, size = pass?._lfAoFullSize
    if (size) pass.setSize(size.w, size.h)
  }

  /** Al empezar un fotograma de dibujo. */
  frameStart() {
    if (this.budgetEnabled && !this.enabled) {
      this.renderer.info.reset()
      // Una consulta cada ocho dibujos (dos a pocos FPS); sin consultas por pasada.
      // Si el driver deja resultados pendientes, la cola no crece indefinidamente.
      this._budgetOpen = this.gpu.supported && this._budgetFrame++ % this.budgetStride === 0 && this.gpu.pending.length < 8
      if (this._budgetOpen) this.gpu.begin('Presupuesto')
      return
    }
    if (!this.enabled) return
    const t = this.now()
    if (this._last) this.stats.frame(t - this._last)
    this._last = t
    this.renderer.info.reset()
  }
  frameEnd() {
    if (this.budgetEnabled && !this.enabled) {
      if (this._budgetOpen) this.gpu.end()
      this._budgetOpen = false
      this.gpu.endFrame()
      return
    }
    if (!this.enabled) return
    const i = this.renderer.info
    this.stats.info = { calls: i.render.calls, triangles: i.render.triangles, lines: i.render.lines, points: i.render.points, geometries: i.memory.geometries, textures: i.memory.textures }
    this.stats.endFrame(); this.gpu.endFrame()
  }

  webGpuFrame(renderer, started) {
    if (!this.enabled) return
    if (this._last) this.stats.frame(started - this._last)
    this._last = started
    this.stats.begin('Fotograma (CPU)', started)
    this.stats.end('Fotograma (CPU)', this.now())
    const { render, memory } = renderer.info
    // El contador de índices del draw indirecto permanece en GPU.
    this.stats.info = { calls: render.drawCalls, geometries: memory.geometries, textures: memory.textures }
    this.stats.endFrame()
  }

  begin(name) { if (!this.enabled) return; this.stats.begin(name, this.now()); this.gpu.begin(name) }
  end(name) { if (!this.enabled) return; this.stats.end(name, this.now()); this.gpu.end() }
  /** Mide `fn` bajo ese nombre (devuelve lo que devuelva). */
  time(name, fn) { if (!this.enabled) return fn(); this.begin(name); try { return fn() } finally { this.end(name) } }
  /** Resolución AO experimental durante Stats: no altera la resolución de escena ni la composición. */
  setAoScale(scale) {
    const value = Number(scale)
    if (value !== 1 && value !== 0.75 && value !== 0.5) return false
    if (value === this.aoScale) return true
    this.aoScale = value
    const pass = this.aoPass
    if (pass?._lfAoFullSize && typeof pass.setSize === 'function') {
      pass.setSize(pass._lfAoFullSize.w, pass._lfAoFullSize.h)
    }
    this.reset() // La comparación A/B no mezcla consultas de distintas resoluciones.
    return true
  }

  /** Cambio de composición solo durante Stats: borra resultados GPU previos para comparación limpia. */
  setAoCompositeMode(mode) {
    if (mode !== 'native' && mode !== 'fused') return false
    if (mode === this.aoCompositeMode) return true
    this.aoCompositeMode = mode
    this.gpu.dispose() // No mezclar consultas diferidas del modo anterior.
    this.stats.reset()
    return true
  }

  /** El compositor dispone de los pases; el monitor no debe conservar uno destruido. */
  forgetAO(pass) { if (pass && this.aoPass === pass) this.aoPass = null }

  /** Mide las fases del GTAOPass oficial sin alterar shaders, materiales ni el orden de las pasadas. */
  wrapAO(pass) {
    if (!pass || pass._lfAoPerfWrapped) return
    if (typeof pass._renderPass !== 'function' || typeof pass._renderOverride !== 'function') return
    pass._lfAoPerfWrapped = true
    if (typeof pass.setSize === 'function') {
      const setSize = pass.setSize.bind(pass)
      const fullSize = { w: pass.width, h: pass.height }
      pass._lfAoFullSize = fullSize
      pass.setSize = (w, h) => {
        fullSize.w = w; fullSize.h = h
        const scale = Math.min(this.aoScale, this.runtimeAoScale)
        return setSize(Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)))
      }
      // Composer.addPass ya asignó el tamaño; reconfigurar si el diagnóstico está activo.
      pass.setSize(fullSize.w, fullSize.h)
      this.aoPass = pass
    }
    const renderPass = pass._renderPass
    pass._renderPass = (renderer, material, ...args) => {
      if (!this.enabled) return renderPass.call(pass, renderer, material, ...args)
      const phase = material === pass.gtaoMaterial ? 'AO · oclusión'
        : material === pass.pdMaterial ? 'AO · denoise' : 'AO · composición'
      if (material === pass.gtaoMaterial) {
        const size = pass.gtaoRenderTarget || pass
        this.stats.extra.aoWorking = `${size.width}×${size.height}`
        const full = pass._lfAoFullSize || pass
        this.stats.extra.aoCompositing = `${full.w ?? full.width}×${full.h ?? full.height}`
      }
      if (phase !== 'AO · composición') return this.time(phase, () => renderPass.call(pass, renderer, material, ...args))
      // El temporizador externo conserva el contrato AO-G001; los hijos miden copia/mezcla
      // sin anidar consultas GPU ni contabilizarlos dos veces en el total.
      const fused = this.aoCompositeMode === 'fused' && pass.output === 0 && !!pass._lfAoFusedMaterial
      // La copia suprimida no debe generar una falsa consulta GPU.
      if (fused && material === pass.copyMaterial) return renderPass.call(pass, renderer, material, ...args)
      const detail = fused && material === pass._lfAoFusedMaterial ? 'AO · fusión'
        : material === pass.copyMaterial ? 'AO · copia'
        : material === pass.blendMaterial ? 'AO · mezcla' : null
      if (!detail || !this.gpu.supported) return this.time('AO · composición', () => renderPass.call(pass, renderer, material, ...args))
      // Una consulta GPU por dibujo; las operaciones CPU conservan su serie «composición».
      this.stats.begin('AO · composición', this.now())
      this.gpu.begin(detail)
      try { return renderPass.call(pass, renderer, material, ...args) }
      finally { this.gpu.end(); this.stats.end('AO · composición', this.now()) }
    }
    const renderOverride = pass._renderOverride
    pass._renderOverride = (renderer, material, ...args) => {
      if (!this.enabled) return renderOverride.call(pass, renderer, material, ...args)
      return this.time('AO · G-buffer', () => renderOverride.call(pass, renderer, material, ...args))
    }
  }
  /** Aísla únicamente el dibujo principal y el clear del RenderPass original.
   * Los envoltorios se aplican durante esa llamada síncrona y se restauran incluso si falla. */
  wrapScene(pass) {
    if (!pass || pass._lfScenePerfWrapped) return
    pass._lfScenePerfWrapped = true
    const original = pass.render.bind(pass)
    pass.render = (renderer, ...args) => {
      if (!this.enabled || typeof renderer?.render !== 'function') return original(renderer, ...args)
      const render = renderer.render
      const clear = renderer.clear
      const clearDepth = renderer.clearDepth
      let draws = 0
      const buffer = args[1] // RenderPass.render(renderer, writeBuffer, readBuffer, ...)
      if (buffer?.width && buffer?.height) this.stats.extra.sceneBuffer = `${buffer.width}×${buffer.height}`
      renderer.render = (...rargs) => { draws++; return this.time('Escena · dibujo', () => render.apply(renderer, rargs)) }
      if (typeof clear === 'function') renderer.clear = (...cargs) => this.time('Escena · limpieza', () => clear.apply(renderer, cargs))
      if (typeof clearDepth === 'function') renderer.clearDepth = (...cargs) => this.time('Escena · limpieza', () => clearDepth.apply(renderer, cargs))
      try { return original(renderer, ...args) }
      finally {
        renderer.render = render
        if (typeof clear === 'function') renderer.clear = clear
        if (typeof clearDepth === 'function') renderer.clearDepth = clearDepth
        this.stats.extra.sceneDraws = draws
      }
    }
  }

  /** Envuelve el método `render` de una pasada del composer para medirla. */
  wrapPass(pass, name) {
    if (pass._perfWrapped) return
    pass._perfWrapped = true
    const orig = pass.render.bind(pass)
    pass.render = (...a) => { if (!this.enabled) return orig(...a); this.begin(name); try { return orig(...a) } finally { this.end(name) } }
  }
  dispose() { this.gpu.dispose() }
}
