// Baking de iluminación: lightmaps (luz directa de las luces estáticas + rebotes + cielo) y sondas SH, con path tracing en GPU.
// Aquí se RECOGE la escena del editor (necesita los objetos de three del visor) y se convierte en datos planos; el trazado en sí vive en
// core.js y se ejecuta en un Worker con su propio contexto GPU (bake.worker.js), de modo que el motor y la interfaz no se bloquean.
import * as THREE from 'three'
import { isCutter } from '../geometry/csg.js'
import { giOf, normalizeBake } from './config.js'
import { normalizeRender } from '../render/config.js'
import { lightmapGeometryFrom, terrainLightmapGeometryFrom, toHalf } from './core.js'
import { runBakeWorkerJob } from './worker-protocol.js'

export { toHalf }
const lin = (hex) => new THREE.Color(hex)

/** Geometría local sin índice con UV2 de lightmap (ver core.js). `node` = raíz del objeto. */
export function lightmapGeometry(mesh, node, obj, cfg) {
  node.updateWorldMatrix(true, true)
  mesh.updateWorldMatrix(true, false)
  return lightmapGeometryFrom(mesh.geometry, mesh.getWorldScale(new THREE.Vector3()), obj.lmScale || 1, cfg)
}

/** UV2 plana de una pieza de terreno. */
export const terrainLightmapGeometry = (mesh, cfg) => terrainLightmapGeometryFrom(mesh.geometry, cfg)

/** La malla que recibe el lightmap de un objeto (primitiva/malla: la que usa su material). */
export const receiverMesh = (node) => { let f = null; node.traverse((m) => { if (!f && m.isMesh && m.geometry && !m.userData.helper && m.material === node.userData.mat) f = m }); return f }

const meshesOf = (node) => {
  const out = []
  node.traverse((m) => {
    if (!m.isMesh || !m.geometry || m.userData.helper || m.userData.isMeshBody === false) return
    const mat = Array.isArray(m.material) ? m.material[0] : m.material
    if (!mat || (mat.transparent && mat.opacity < 1) || mat.wireframe) return
    let p = m, vis = true
    while (p) { if (p.visible === false) vis = false; p = p.parent }
    if (vis) out.push(m)
  })
  return out
}

/** Lo que interviene en el baking de la escena abierta. */
export function collectBakeScene(editor, project) {
  const receivers = [], occluders = [], lights = [], seen = new Set()
  for (const obj of project.objects) {
    const node = editor.nodes.get(obj.id)
    if (!node) continue
    if (obj.type === 'light') {
      const l = node.userData.light, mode = obj.light?.mode || 'dynamic'
      // El trazador sólo admite punto, foco y direccional; nunca interpretar una RectAreaLight como sol.
      if (!l || obj.light?.type === 'area' || obj.visible === false || mode === 'dynamic') continue
      node.updateWorldMatrix(true, true)
      const pos = l.getWorldPosition(new THREE.Vector3()), dir = new THREE.Vector3(0, 0, -1)
      if (l.target) dir.copy(l.target.getWorldPosition(new THREE.Vector3())).sub(pos).normalize()
      const ty = obj.light.type
      lights.push({
        id: obj.id, type: ty === 'omni' ? 0 : ty === 'spot' ? 1 : 2, pos, dir, color: l.color.clone().multiplyScalar(l.intensity),
        range: Math.max(0.1, l.distance || obj.light.range || 10), decay: l.decay ?? 1, angle: l.angle || 0.78, penumbra: l.penumbra ?? 1, baked: mode === 'baked',
      })
      continue
    }
    if (!['primitive', 'mesh', 'model', 'road', 'text'].includes(obj.type) || isCutter(obj)) continue
    const gi = giOf(obj)
    if (gi !== 'lightmap') continue
    node.updateWorldMatrix(true, true)
    for (const m of meshesOf(node)) {
      const mat = Array.isArray(m.material) ? m.material[0] : m.material
      if (!seen.has(m)) {
        seen.add(m)
        const color = (mat.color?.clone() || new THREE.Color('#999999')).multiplyScalar(1 - (mat.metalness || 0))
        const emission = new THREE.Color(0)
        if (mat.emissive) emission.copy(mat.emissive).multiplyScalar(mat.emissiveIntensity ?? 1)
        const uniforms = mat.userData?.rt?.uniforms
        const tint = uniforms?.uEmissiveColor?.value, power = uniforms?.uEmissiveStrength?.value
        if (tint && power > 0) emission.add(new THREE.Color(tint.x, tint.y, tint.z).multiplyScalar(power))
        occluders.push({ mesh: m, color, emission, doubleSided: mat.side === THREE.DoubleSide })
      }
      if ((obj.type === 'primitive' || obj.type === 'mesh') && m === receiverMesh(node)) receivers.push({ key: obj.id, obj, node, mesh: m, terrain: false })
    }
  }
  const tl = project.terrain?.layers || []
  const tcol = lin(tl[0]?.color || '#6f8450')
  for (const t of editor.terrains || []) {
    if (!t.mesh || !t.enabled || !t.mesh.visible) continue
    t.mesh.updateWorldMatrix(true, false)
    occluders.push({ mesh: t.mesh, color: tcol })
    receivers.push({ key: 'terrain:' + t.id, obj: null, node: t.mesh, mesh: t.mesh, terrain: true })
  }
  return { receivers, occluders, lights }
}


// atributo → Float32Array plano (copia; admite atributos intercalados)
function plain(attr) {
  if (!attr.isInterleavedBufferAttribute && attr.array instanceof Float32Array) return new Float32Array(attr.array)
  const out = new Float32Array(attr.count * attr.itemSize)
  for (let i = 0; i < attr.count; i++) { out[i * attr.itemSize] = attr.getX(i); if (attr.itemSize > 1) out[i * attr.itemSize + 1] = attr.getY(i); if (attr.itemSize > 2) out[i * attr.itemSize + 2] = attr.getZ(i) }
  return out
}

/** Convierte lo recogido en datos planos (transferibles). La geometría de los oclusores se pasa ya en espacio mundo. */
function serialize(scene, reflections) {
  const transfer = []
  const occluders = scene.occluders.map(({ mesh, color, emission, doubleSided }) => {
    const g = mesh.userData.lmOrig || mesh.geometry
    mesh.updateWorldMatrix(true, false)
    const position = plain(g.attributes.position), index = g.index ? new Uint32Array(g.index.array) : null
    transfer.push(position.buffer)
    if (index) transfer.push(index.buffer)
    return { position, index, matrix: mesh.matrixWorld.toArray(), color: [color.r, color.g, color.b], emission: emission ? [emission.r, emission.g, emission.b, doubleSided ? 1 : 0] : [0, 0, 0, 0] }
  })
  const receivers = scene.receivers.map((r) => {
    const g = r.mesh.userData.lmOrig || r.mesh.geometry
    r.mesh.updateWorldMatrix(true, false)
    const position = plain(g.attributes.position), normal = g.attributes.normal ? plain(g.attributes.normal) : null
    const index = g.index ? new Uint32Array(g.index.array) : null
    for (const a of [position, normal, index]) if (a) transfer.push(a.buffer)
    const ws = r.mesh.getWorldScale(new THREE.Vector3())
    return { key: r.key, terrain: !!r.terrain, position, normal, index, matrix: r.mesh.matrixWorld.toArray(), scale: [ws.x, ws.y, ws.z], lmScale: r.obj?.lmScale || 1 }
  })
  const lights = scene.lights.map((l) => ({ id: l.id, type: l.type, pos: l.pos.toArray(), dir: l.dir.toArray(), color: [l.color.r, l.color.g, l.color.b], range: l.range, decay: l.decay, angle: l.angle, penumbra: l.penumbra, baked: l.baked }))
  return { input: { occluders, receivers, lights, reflections }, transfer }
}

/** Captura el cielo con el visor y lee sus caras sin esperar a la GPU en el hilo del editor. */
async function captureSky(vp, signal) {
  const renderer = vp.renderer
  if (vp._glLost || renderer.getContext().isContextLost()) throw new Error('El contexto gráfico del editor no está disponible para capturar el cielo.')
  const size = 64
  const target = new THREE.WebGLCubeRenderTarget(size, { type: THREE.FloatType, generateMipmaps: false, minFilter: THREE.LinearFilter })
  const u = vp.skyMat.uniforms
  const keep = [u.uCamY.value, u.uTime.value, u.uCloudSteps.value]
  const mapping = renderer.toneMapping
  try {
    u.uCamY.value = 0; u.uTime.value = 0; u.uCloudSteps.value = 24
    renderer.toneMapping = THREE.NoToneMapping
    new THREE.CubeCamera(0.1, 100, target).update(renderer, vp.envScene)
  } catch (error) {
    target.dispose()
    throw error
  } finally {
    renderer.toneMapping = mapping
    ;[u.uCamY.value, u.uTime.value, u.uCloudSteps.value] = keep
  }
  try {
    // Una sola lectura pendiente por vez: la captura continúa siendo un paso pequeño del viewport.
    const faces = []
    for (let face = 0; face < 6; face++) {
      if (signal?.aborted) throw new Error('Cancelado')
      if (vp._glLost || renderer.getContext().isContextLost()) throw new Error('Se perdió el contexto gráfico durante la captura del cielo.')
      const data = await renderer.readRenderTargetPixelsAsync(target, 0, 0, size, size, new Float32Array(size * size * 4), face)
      faces.push(toHalf(data))
    }
    return { size, faces }
  } finally { target.dispose() }
}

async function bakeInWorker(input, transfer, cfg, onProgress, signal, viewportCanvas) {
  const { createBakeWorker } = await import('./workerClient.js')
  if (signal?.aborted) throw new Error('Cancelado')
  return runBakeWorkerJob({ createWorker: createBakeWorker, input, transfer, cfg, onProgress, signal, viewportCanvas })
}

/**
 * Hornea la escena. opts: { editor, project, onProgress({label,fraction}), signal }
 * Devuelve { lightmaps: [{ key, size, half: Uint16Array }], probes: { origin, dims, spacing, half } | null, stats, lightsUsed }
 */
export async function bakeScene({ editor, project, onProgress = () => {}, signal }) {
  if (signal?.aborted) throw new Error('Cancelado')
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined')
    throw new Error('El horneado en segundo plano requiere WebGL2 en un Worker.')
  const cfg = normalizeBake(project.bake), vp = editor.vp
  const wasActive = !!editor.world?.active, wasSuspended = editor.world?.suspended
  if (wasActive) { editor.world.suspended = true; editor.applyWorld() }
  let snapshot, skyRead
  try {
    onProgress({ label: 'Recogiendo geometría y luces de la escena…', fraction: 0 })
    const scene = collectBakeScene(editor, project)
    if (!scene.occluders.length) throw new Error('No hay geometría estática que hornear (objetos con GI «Estático»).')
    const render = normalizeRender(project.render)
    snapshot = serialize(scene, render.look === 'clasico' ? 1 : render.reflections)
    const env = vp._effectiveEnv ? vp._effectiveEnv(vp._rawEnv || {}, null) : {}
    const ambient = new THREE.Color(env.ambientColor || env.skyHorizon || '#808080').multiplyScalar((env.ambient ?? 0.5) * Math.PI)
    snapshot.input.ambient = [ambient.r, ambient.g, ambient.b]
    onProgress({ label: 'Capturando cielo (pasada breve del viewport)…', fraction: 0.01 })
    skyRead = captureSky(vp, signal)
  } finally {
    if (wasActive) { editor.world.suspended = wasSuspended; editor.applyWorld() }
  }
  onProgress({ label: 'Preparando el horneado en segundo plano…', fraction: 0 })
  snapshot.input.sky = await skyRead
  if (signal?.aborted) throw new Error('Cancelado')
  for (const face of snapshot.input.sky.faces) snapshot.transfer.push(face.buffer)
  onProgress({ label: 'Iniciando Worker de iluminación…', fraction: 0.04 })
  const result = await bakeInWorker(snapshot.input, snapshot.transfer, cfg, (o) => onProgress({ label: o.label, fraction: 0.04 + o.fraction * 0.96 }), signal, vp.renderer.domElement)
  return { ...result, worldIgnored: wasActive, params: cfg }
}
