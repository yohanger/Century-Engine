// Núcleo del path tracing en el Worker con su propio contexto WebGL2.
//
// Entrada `input` (datos planos, transferibles):
//   occluders: [{ position: Float32Array, index|null, matrix[16], color: [r,g,b] }]
//   receivers: [{ key, terrain, position, normal|null, index|null, matrix[16], scale[3], lmScale }]
//   lights:    [{ id, type, pos[3], dir[3], color[3], range, angle, penumbra, baked }]
//   sky:       { texture } (hilo principal) | { size, faces: [Uint16Array × 6] } (Worker: cubo en half-float)
//   reflections: número
// Control de GPU: el trazado se reparte en franjas de filas con duración acotada y, entre franjas, se espera lo necesario para que la
// GPU quede libre el (1 − gpuUsage) del tiempo. Así el compositor y el editor siguen fluidos mientras se hornea.
import * as THREE from 'three'
import { buildBvh } from './geometry-bvh.js'
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'
import { unwrapLightmap, planarLightmapUV, lightmapSizeFor } from './unwrap.js'
import { TRACE_VERT, TRACE_FRAG, MAX_BAKE_LIGHTS, makeGbufferMaterial } from './tracer.js'
import { tileShape, nextGpuBudget, waitForGpu, estimatedTraceMemoryBytes, GPU_TILE_START } from './scheduler.js'


let _ch = null
/** Cede el hilo sin el retardo mínimo de setTimeout (cola de mensajes). */
const yieldNow = () => new Promise((r) => { _ch ||= new MessageChannel(); _ch.port1.onmessage = () => r(); _ch.port2.postMessage(0) })
/** Error de «la GPU se perdió»: el horneado se detiene y NO se reintenta en otro hilo ni se guarda nada. */
export const gpuLost = () => Object.assign(new Error('Se perdió el contexto WebGL durante el horneado. No se guardaron resultados. Reduce la resolución, las muestras o la densidad de sondas.'), { contextLost: true })
const sleep = (ms) => (ms > 2 ? new Promise((r) => setTimeout(r, ms)) : yieldNow())

/** Geometría local sin índice con UV2 de lightmap. `ws` = escala mundial del objeto (la posición/rotación no influyen, sí la escala). */
export function lightmapGeometryFrom(src, ws, lmScale, cfg) {
  const g = src.index ? src.toNonIndexed() : src.clone()
  if (!g.attributes.normal) g.computeVertexNormals()
  const p = g.attributes.position, out = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) { out[i * 3] = p.getX(i) * Math.abs(ws.x); out[i * 3 + 1] = p.getY(i) * Math.abs(ws.y); out[i * 3 + 2] = p.getZ(i) * Math.abs(ws.z) }
  const r = unwrapLightmap(out, { density: cfg.density, maxSize: cfg.maxSize, scale: lmScale || 1 })
  g.setAttribute('lfLightmapUv', new THREE.BufferAttribute(r.uv, 2))
  return { geometry: g, size: r.size }
}

/** UV2 plana de una pieza de terreno (geometría indexada con vértices compartidos). */
export function terrainLightmapGeometryFrom(src, cfg) {
  const g = src.clone()
  g.computeBoundingBox()
  const b = g.boundingBox
  g.setAttribute('lfLightmapUv', new THREE.BufferAttribute(planarLightmapUV(g.attributes.position.array, [b.min.x, b.min.z], [b.max.x, b.max.z]), 2))
  return { geometry: g, size: lightmapSizeFor((b.max.x - b.min.x) * (b.max.z - b.min.z), cfg.density, Math.min(1024, cfg.maxSize * 2), 32) }
}

function skyFromFaces({ size, faces }) {
  const imgs = faces.map((d) => { const t = new THREE.DataTexture(d, size, size, THREE.RGBAFormat, THREE.HalfFloatType); t.needsUpdate = true; return t })
  const cube = new THREE.CubeTexture(imgs)
  cube.format = THREE.RGBAFormat; cube.type = THREE.HalfFloatType; cube.generateMipmaps = false
  cube.minFilter = cube.magFilter = THREE.LinearFilter; cube.needsUpdate = true
  return cube
}

function uploadLights(mat, lights) {
  const u = mat.uniforms, n = Math.min(MAX_BAKE_LIGHTS, lights.length)
  u.uNL.value = n
  for (let i = 0; i < n; i++) {
    const l = lights[i]
    u.uLPos.value[i].copy(l.pos); u.uLDir.value[i].copy(l.dir); u.uLCol.value[i].set(l.color.r, l.color.g, l.color.b)
    u.uLInfo.value[i].set(l.type, l.range, Math.cos(l.angle), Math.cos(l.angle * (1 - l.penumbra)))
    u.uLFlag.value[i].set(l.baked ? 1 : 0, l.decay ?? 1, 0, 0)
  }
}

function makeTracer(ctx, probe) {
  const vecs = (n, V) => Array.from({ length: n }, () => new V())
  const u = {
    bvh: { value: ctx.bvh.uni }, tAlbedo: { value: ctx.bvh.albTex }, tEmission: { value: ctx.bvh.emissionTex }, tPos: { value: null }, tNor: { value: null }, tProbes: { value: null }, tSky: { value: ctx.sky.texture }, tPrev: { value: null },
    uSkyI: { value: ctx.cfg.skyIntensity * ctx.reflections }, uSkyMax: { value: 32 }, uAmbient: { value: new THREE.Vector3(...ctx.ambient) }, uSeed: { value: 0 }, uEps: { value: ctx.eps }, uLightRadius: { value: ctx.cfg.lightRadius }, uSunAngle: { value: Math.tan(ctx.cfg.sunAngle * Math.PI / 180) },
    uSpp: { value: 4 }, uBounces: { value: ctx.cfg.bounces }, uNL: { value: 0 },
    uLPos: { value: vecs(MAX_BAKE_LIGHTS, THREE.Vector3) }, uLDir: { value: vecs(MAX_BAKE_LIGHTS, THREE.Vector3) }, uLCol: { value: vecs(MAX_BAKE_LIGHTS, THREE.Vector3) },
    uLInfo: { value: vecs(MAX_BAKE_LIGHTS, THREE.Vector4) }, uLFlag: { value: vecs(MAX_BAKE_LIGHTS, THREE.Vector4) },
  }
  const mat = new THREE.ShaderMaterial({
    uniforms: u, vertexShader: TRACE_VERT, fragmentShader: TRACE_FRAG, defines: probe ? { PROBE: '' } : {},
    depthTest: false, depthWrite: false,
  })
  uploadLights(mat, ctx.lights)
  return mat
}



/** Acumula `passes` pasadas del trazador en un RT float. Cada pasada se reparte en franjas de filas con duración acotada (ver arriba). */
async function accumulate(ctx, mat, w, h, passes, sppPerPass, tick) {
  const { renderer, quad } = ctx
  const gl = renderer.getContext()
  const duty = Math.min(1, Math.max(0.1, ctx.cfg.gpuUsage ?? 0.5))
  const mk = () => new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false })
  const a = mk(), b = mk()
  let read = a, write = b, done = 0, pixels = Math.min(GPU_TILE_START, w * h)
  quad.material = mat
  mat.uniforms.uSpp.value = sppPerPass
  renderer.setClearColor(0x000000, 0)
  try {
    for (const rt of [a, b]) { renderer.setRenderTarget(rt); renderer.clear(true, false, false) }
    if (gl.isContextLost()) throw gpuLost()
    for (let i = 0; i < passes; i++) {
      if (ctx.aborted()) throw new Error('Cancelado')
      mat.uniforms.uSeed.value = ctx.seed++
      mat.uniforms.tPrev.value = read.texture
      // Scissor 2D: nunca despachar una fila entera de 512–2048 píxeles.
      write.scissorTest = true
      for (let y = 0; y < h;) {
        const tile = tileShape(w, pixels)
        const tileH = Math.min(tile.height, h - y)
        for (let x = 0; x < w; x += tile.width) {
          if (ctx.aborted()) throw new Error('Cancelado')
          if (gl.isContextLost()) throw gpuLost()
          write.scissor.set(x, y, Math.min(tile.width, w - x), tileH)
          renderer.setRenderTarget(write)
          const t0 = performance.now()
          quad.render(renderer)
          // El fence permite que el Worker ceda CPU sin esperas síncronas.
          let ms
          try { ms = await waitForGpu(gl, { cancelled: ctx.aborted }) }
          catch (error) { if (error.contextLost) throw gpuLost(); throw error }
          ms = Math.max(ms, performance.now() - t0)
          ctx.gpuDispatch.tiles++
          ctx.gpuDispatch.waitMs += ms
          ctx.gpuDispatch.worstWaitMs = Math.max(ctx.gpuDispatch.worstWaitMs, ms)
          pixels = nextGpuBudget(pixels, ms)
          if (tick) tick(i + (y + (x + tile.width) / w * tileH) / h, passes)
          await sleep(duty < 1 ? ms * (1 / duty - 1) : 0)
        }
        y += tileH
      }
      write.scissorTest = false
      ;[read, write] = [write, read]
      done++
    }
    if (ctx.aborted()) throw new Error('Cancelado')
    if (gl.isContextLost()) throw gpuLost()
    const buf = new Float32Array(w * h * 4)
    if (renderer.readRenderTargetPixelsAsync) await renderer.readRenderTargetPixelsAsync(read, 0, 0, w, h, buf)
    else renderer.readRenderTargetPixels(read, 0, 0, w, h, buf)
    if (ctx.aborted()) throw new Error('Cancelado')
    if (gl.isContextLost()) throw gpuLost()
    const f = 1 / Math.max(1, done)
    for (let i = 0; i < buf.length; i++) buf[i] *= f
    return buf
  } finally {
    read.scissorTest = false; write.scissorTest = false
    a.dispose(); b.dispose()
  }
}

function postProcess(rgba, pos, nor, size, denoise) {
  const N = size * size
  const cov = new Uint8Array(N)
  for (let i = 0; i < N; i++) cov[i] = pos[i * 4 + 3] > 0.5 ? 1 : 0
  let src = rgba
  if (denoise) {
    const out = new Float32Array(src)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = y * size + x
      if (!cov[i]) continue
      const nx = nor[i * 4], ny = nor[i * 4 + 1], nz = nor[i * 4 + 2], px = pos[i * 4], py = pos[i * 4 + 1], pz = pos[i * 4 + 2]
      let r = 0, g = 0, b = 0, ws = 0
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, yy = y + dy
        if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue
        const j = yy * size + xx
        if (!cov[j]) continue
        if (nor[j * 4] * nx + nor[j * 4 + 1] * ny + nor[j * 4 + 2] * nz < 0.9) continue
        const d = Math.hypot(pos[j * 4] - px, pos[j * 4 + 1] - py, pos[j * 4 + 2] - pz)
        if (d > 0.3) continue
        const w = Math.exp(-(dx * dx + dy * dy) / 2.5) * Math.exp(-d * d / 0.05)
        r += src[j * 4] * w; g += src[j * 4 + 1] * w; b += src[j * 4 + 2] * w; ws += w
      }
      if (ws > 0) { out[i * 4] = r / ws; out[i * 4 + 1] = g / ws; out[i * 4 + 2] = b / ws }
    }
    src = out
  }
  // relleno de los bordes de los charts (evita costuras al filtrar)
  const res = new Float32Array(src), have = Uint8Array.from(cov)
  for (let it = 0; it < 4; it++) {
    const add = []
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = y * size + x
      if (have[i]) continue
      let r = 0, g = 0, b = 0, c = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy
        if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue
        const j = yy * size + xx
        if (have[j]) { r += res[j * 4]; g += res[j * 4 + 1]; b += res[j * 4 + 2]; c++ }
      }
      if (c) add.push([i, r / c, g / c, b / c])
    }
    for (const [i, r, g, b] of add) { res[i * 4] = r; res[i * 4 + 1] = g; res[i * 4 + 2] = b; have[i] = 1 }
  }
  for (let i = 0; i < N; i++) res[i * 4 + 3] = 1
  return res
}

/** Float32 → half-float (Uint16) con THREE.DataUtils. */
export function toHalf(f32) { const o = new Uint16Array(f32.length); for (let i = 0; i < f32.length; i++) o[i] = THREE.DataUtils.toHalfFloat(Math.min(65000, Math.max(0, f32[i]))); return o }

/**
 * Hornea. `renderer` = THREE.WebGLRenderer (en el Worker, el suyo; en el hilo principal, el del visor).
 * Devuelve { lightmaps: [{ key, size, half }], probes: { origin, dims, spacing, half } | null, stats, lightsUsed }
 */
export async function runBake({ renderer, input, cfg, onProgress = () => {}, aborted = () => false }) {
  const t0 = performance.now()
  const bvh = buildBvh(input.occluders)
  const skyTex = input.sky.texture || skyFromFaces(input.sky)
  const lights = input.lights.slice(0, MAX_BAKE_LIGHTS).map((l) => ({ ...l, pos: new THREE.Vector3(...l.pos), dir: new THREE.Vector3(...l.dir), color: new THREE.Color(l.color[0], l.color[1], l.color[2]) }))
  const diag = bvh.box.getSize(new THREE.Vector3()).length()
  const ctx = { renderer, bvh, sky: { texture: skyTex }, cfg, lights, ambient: input.ambient || [0, 0, 0], reflections: input.reflections, eps: Math.max(0.002, Math.min(0.01, diag * 1e-5)), seed: 1, aborted, gpuDispatch: { tiles: 0, waitMs: 0, worstWaitMs: 0 }, quad: new FullScreenQuad(null) }
  const prevRT = renderer.getRenderTarget(), prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha(), prevTM = renderer.toneMapping
  renderer.toneMapping = THREE.NoToneMapping
  const gbufMat = makeGbufferMaterial()
  const spp = 4, passes = Math.max(1, Math.ceil(cfg.samples / spp))
  const totalSteps = input.receivers.length + 1
  const lightmaps = []
  const stats = { receivers: input.receivers.length, triangles: bvh.tris, lights: lights.length, texels: 0 }
  const cancel = () => { throw new Error('Cancelado') }
  let tracer = null
  try {
    tracer = makeTracer(ctx, false)
    let done = 0
    for (const r of input.receivers) {
      if (aborted()) cancel()
      const src = new THREE.BufferGeometry()
      src.setAttribute('position', new THREE.BufferAttribute(r.position, 3))
      if (r.normal) src.setAttribute('normal', new THREE.BufferAttribute(r.normal, 3))
      if (r.index) src.setIndex(new THREE.BufferAttribute(r.index, 1))
      const geo = r.terrain ? terrainLightmapGeometryFrom(src, cfg) : lightmapGeometryFrom(src, { x: r.scale[0], y: r.scale[1], z: r.scale[2] }, r.lmScale, cfg)
      src.dispose()
      const size = geo.size
      if (size > renderer.capabilities.maxTextureSize || estimatedTraceMemoryBytes(size) > 160 * 1024 * 1024)
        throw new Error(`Lightmap ${size}×${size} excede el presupuesto conservador de GPU. Baja Lightmap máx. o texels/m antes de hornear.`)
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', geo.geometry.attributes.position); g.setAttribute('normal', geo.geometry.attributes.normal || geo.geometry.attributes.position)
      g.setAttribute('lmuv', geo.geometry.attributes.lfLightmapUv); if (geo.geometry.index) g.setIndex(geo.geometry.index)
      const mw = new THREE.Matrix4().fromArray(r.matrix)
      const gm = new THREE.Mesh(g, gbufMat); gm.matrixAutoUpdate = false; gm.matrix.copy(mw); gm.matrixWorld.copy(mw); gm.frustumCulled = false
      const gs = new THREE.Scene(); gs.add(gm)
      const gb = new THREE.WebGLRenderTarget(size, size, { count: 2, type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false })
      try {
        renderer.setRenderTarget(gb); renderer.setClearColor(0x000000, 0); renderer.clear(true, false, false)
        renderer.render(gs, new THREE.Camera())
        const pos = new Float32Array(size * size * 4), nor = new Float32Array(size * size * 4)
        renderer.readRenderTargetPixels(gb, 0, 0, size, size, pos, undefined, 0)
        renderer.readRenderTargetPixels(gb, 0, 0, size, size, nor, undefined, 1)
        tracer.uniforms.tPos.value = gb.textures[0]; tracer.uniforms.tNor.value = gb.textures[1]
        onProgress({ label: `Trazando lightmap ${done + 1}/${input.receivers.length} (GPU acotada)`, fraction: done / totalSteps })
        const raw = await accumulate(ctx, tracer, size, size, passes, spp, (i, n) => onProgress({ label: `Trazando lightmap ${done + 1}/${input.receivers.length}`, fraction: (done + i / n) / totalSteps }))
        if (aborted()) cancel()
        const final = postProcess(raw, pos, nor, size, cfg.denoise)
        lightmaps.push({ key: r.key, size, half: toHalf(final), uv: g.attributes.lmuv.array })
        stats.texels += size * size
        done++
      } finally { gb.dispose(); g.dispose(); geo.geometry.dispose() }
      await yieldNow()
    }
    // sondas de luz
    let probes = null
    const box = bvh.box.clone().expandByScalar(1)
    let sp = cfg.probeSpacing, dims
    for (let i = 0; i < 20; i++) {
      const s = box.getSize(new THREE.Vector3()); dims = [Math.max(2, Math.ceil(s.x / sp) + 1), Math.max(2, Math.ceil(s.y / sp) + 1), Math.max(2, Math.ceil(s.z / sp) + 1)]
      if (dims[0] * dims[1] * dims[2] <= 2048) break
      sp *= 1.25
    }
    const n = dims[0] * dims[1] * dims[2]
    const pp = new Float32Array(n * 4)
    let k = 0
    for (let z = 0; z < dims[2]; z++) for (let y = 0; y < dims[1]; y++) for (let x = 0; x < dims[0]; x++) { pp[k * 4] = box.min.x + x * sp; pp[k * 4 + 1] = box.min.y + y * sp; pp[k * 4 + 2] = box.min.z + z * sp; pp[k * 4 + 3] = 1; k++ }
    const pt = new THREE.DataTexture(pp, n, 1, THREE.RGBAFormat, THREE.FloatType); pt.needsUpdate = true; pt.minFilter = pt.magFilter = THREE.NearestFilter
    const pm = makeTracer(ctx, true)
    try {
      pm.uniforms.tProbes.value = pt
      const probePasses = Math.max(2, Math.ceil(cfg.samples / 16))
      const praw = await accumulate(ctx, pm, 9, n, probePasses, 16, (i, nn) => onProgress({ label: 'Sondas de luz', fraction: (input.receivers.length + i / nn) / totalSteps }))
      if (aborted()) cancel()
      const sh = new Float32Array(n * 27)
      for (let p = 0; p < n; p++) for (let c = 0; c < 9; c++) { const o = (p * 9 + c) * 4; sh[p * 27 + c * 3] = praw[o]; sh[p * 27 + c * 3 + 1] = praw[o + 1]; sh[p * 27 + c * 3 + 2] = praw[o + 2] }
      // Las sondas admiten coeficientes negativos: conversión half-float con signo.
      const half = new Uint16Array(sh.length); for (let i = 0; i < sh.length; i++) half[i] = THREE.DataUtils.toHalfFloat(Math.max(-65000, Math.min(65000, sh[i])))
      probes = { origin: box.min.toArray(), dims, spacing: sp, half }
    } finally { pt.dispose(); pm.dispose() }
    onProgress({ label: 'Listo', fraction: 1 })
    stats.seconds = (performance.now() - t0) / 1000; stats.probes = n
    // Son tiempos de espera medidos en el Worker, NO consultas GPU de tiempo transcurrido.
    stats.gpuDispatch = { ...ctx.gpuDispatch }
    return { lightmaps, probes, stats, lightsUsed: lights.map((l) => l.id) }
  } finally {
    renderer.setRenderTarget(prevRT); renderer.setClearColor(prevClear, prevAlpha); renderer.toneMapping = prevTM
    if (!input.sky.texture) skyTex.dispose()
    tracer?.dispose(); gbufMat.dispose(); ctx.quad.dispose(); bvh.geometry.dispose(); bvh.uni.dispose(); bvh.albTex.dispose(); bvh.emissionTex.dispose()
  }
}
