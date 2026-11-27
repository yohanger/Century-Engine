import { BufferAttribute, BufferGeometry, Frustum, Matrix4, Vector3 } from 'three'
import { IndirectStorageBufferAttribute, StorageBufferAttribute } from 'three/webgpu'
import { clusterCandidate, geometryRevision } from './cluster-mesh.js'
import { lodTransferables, serializeLodGeometry } from './lodgeo.js'
import LodWorker from './lod.worker.js?worker&inline'

const MAX_RESIDENT_BYTES = 48 * 1024 * 1024

const COMPUTE = /* wgsl */`
struct Cluster {
  sphere: vec4f,
  ranges0: vec4u,
  ranges1: vec4u,
  errors: vec4f,
}
struct View {
  world: mat4x4f,
  planes: array<vec4f,6>,
  cameraNear: vec4f,
  params: vec4f,
}
struct Draw { indexCount: atomic<u32>, instanceCount: u32, firstIndex: u32, baseVertex: i32, firstInstance: u32 }
@group(0) @binding(0) var<storage,read> clusters: array<Cluster>;
@group(0) @binding(1) var<storage,read> source: array<u32>;
@group(0) @binding(2) var<storage,read_write> outputIndex: array<u32>;
@group(0) @binding(3) var<storage,read_write> draw: Draw;
@group(0) @binding(4) var<uniform> view: View;
var<workgroup> first: u32;
var<workgroup> count: u32;
var<workgroup> destination: u32;

@compute @workgroup_size(64)
fn buildDraw(@builtin(workgroup_id) group: vec3u, @builtin(local_invocation_index) lane: u32) {
  if (lane == 0u) {
    let c = clusters[group.x];
    let center = (view.world * vec4f(c.sphere.xyz,1.0)).xyz;
    let radius = view.params.x * c.sphere.w;
    var visible = true;
    for (var i = 0u; i < 6u; i++) {
      if (dot(view.planes[i], vec4f(center,1.0)) < -radius) { visible = false; }
    }
    count = 0u;
    if (visible || view.params.w > 0.5) {
      let near = select(max(view.cameraNear.w, distance(center,view.cameraNear.xyz)-radius),1.0,view.params.z > 0.5);
      let projected = view.params.x * view.params.y / near;
      var range = c.ranges0.xy;
      if (visible && c.ranges1.z > 1u && projected * c.errors.x <= c.errors.z) {
        range = c.ranges0.zw;
        if (c.ranges1.z > 2u && projected * c.errors.y <= c.errors.z) { range = c.ranges1.xy; }
      }
      first = range.x;
      count = range.y;
      destination = atomicAdd(&draw.indexCount, count);
    }
  }
  workgroupBarrier();
  for (var i = lane; i < count; i += 64u) { outputIndex[destination+i] = source[first+i]; }
}
`

export class GpuClusterDraw {
  constructor(renderer) {
    this.backend = renderer.backend
    this.device = this.backend.device
    this.pipeline = this.device.createComputePipeline({ layout: 'auto',
      compute: { module: this.device.createShaderModule({ code: COMPUTE }), entryPoint: 'buildDraw' } })
    this.shared = new Map()
    this.entries = new Map()
    this.bytes = 0
    this.jobs = new Set()
    this.revisions = new Map()
    this.frustum = new Frustum()
    this.view = new Matrix4()
    this.position = new Vector3()
    this.worker = new LodWorker()
    this.worker.onmessage = ({ data }) => {
      const base = this.job
      this.job = null
      if (!base) return
      if (geometryRevision(base) !== this.jobRevision) return // geometría editada antes de responder worker
      this.jobs.add(base)
      if (data) { this.shared.set(base, data); this.revisions.set(base, this.jobRevision) }
    }
    this.worker.onerror = () => { this.job = null; this.failed = true }
  }

  _prepare(geo) {
    if (this.failed || this.job || this.jobs.has(geo)) return
    const input = serializeLodGeometry(geo)
    this.job = geo
    this.jobRevision = geometryRevision(geo)
    this.worker.postMessage({ input, gpuClusters: true }, lodTransferables(input))
  }

  _buffer(array) {
    const b = this.device.createBuffer({ size: array.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST })
    this.device.queue.writeBuffer(b, 0, array)
    return b
  }

  _entry(base, data) {
    const bytes = data.position.byteLength + data.source.byteLength + data.metadata.byteLength + data.maxOutput * 4 +
      Object.values(data.attrs).reduce((n, attribute) => n + attribute.array.byteLength, 0)
    if (this.bytes + bytes > MAX_RESIDENT_BYTES) return null
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(data.position, 3))
    for (const [name, a] of Object.entries(data.attrs)) geometry.setAttribute(name, new BufferAttribute(a.array, a.itemSize))
    geometry.boundingSphere = base.boundingSphere?.clone() ?? null
    geometry.boundingBox = base.boundingBox?.clone() ?? null
    const index = new StorageBufferAttribute(new Uint32Array(data.maxOutput), 1)
    const indirect = new IndirectStorageBufferAttribute(new Uint32Array([0, 1, 0, 0, 0]), 1)
    geometry.setIndex(index)
    geometry.setIndirect(indirect)

    this.backend.createIndexAttribute(index)
    this.backend.createIndirectStorageAttribute(indirect)
    const indexBuffer = this.backend.get(index).buffer, indirectBuffer = this.backend.get(indirect).buffer
    const clusters = this._buffer(data.metadata)
    const triangles = this._buffer(data.source)
    const view = this.device.createBuffer({ size: 192, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
    const bind = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [clusters, triangles, indexBuffer, indirectBuffer, view].map((buffer, binding) => ({ binding, resource: { buffer } })),
    })
    this.bytes += bytes
    return { base, bytes, geometry, index, indirect, clusters, triangles, view, bind, count: data.metadata.length / 16, indirectBuffer }
  }

  _release(entry) {
    this.bytes -= entry.bytes
    entry.geometry.dispose()
    for (const attribute of [entry.index, entry.indirect]) {
      if (this.backend.get(attribute).buffer) this.backend.destroyAttribute(attribute)
    }
    for (const buffer of [entry.clusters, entry.triangles, entry.view]) buffer.destroy()
  }

  draw(scene, camera, focal, quality, callback) {
    scene.updateMatrixWorld()
    this.frustum.setFromProjectionMatrix(this.view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), camera.coordinateSystem)
    this.position.setFromMatrixPosition(camera.matrixWorld)
    const uniform = new Float32Array(48)
    for (let i = 0; i < 6; i++) {
      const { normal, constant } = this.frustum.planes[i]
      uniform.set([normal.x, normal.y, normal.z, constant], 16 + i * 4)
    }
    uniform.set([...this.position, camera.near], 40)
    const changes = [], seen = new Set(), used = new Set()
    const ready = []
    try {
      scene.traverseVisible((mesh) => {
        if (!mesh.isMesh || mesh.isBatchedMesh || !mesh.layers.test(camera.layers)) return
        let owner = mesh
        while (owner && !owner._lfNodeOwner) owner = owner.parent
        // Terrain conserva índices/splat normalizados en la ruta nativa CPU hasta validar su empaquetado WebGPU.
        if (mesh.userData?._lfNativeTerrain || !clusterCandidate(mesh)) return
        const base = mesh.geometry
        const revision = geometryRevision(base)
        if (this.revisions.has(base) && this.revisions.get(base) !== revision) {
          // Páginas anteriores no representan el terreno/pintura actual. No mostrar geometría desfasada.
          for (const [source, stale] of this.entries) if (stale.base === base) { this._release(stale); this.entries.delete(source) }
          this.shared.delete(base); this.jobs.delete(base); this.revisions.delete(base)
        }
        seen.add(mesh)
        used.add(base)
        let entry = this.entries.get(mesh)
        if (entry?.base !== base && entry) { this._release(entry); this.entries.delete(mesh); entry = null }
        const data = this.shared.get(base)
        if (!data) { this._prepare(base); return }
        if (!entry) {
          entry = this._entry(base, data)
          if (!entry) return
          this.entries.set(mesh, entry)
        }
        uniform.set(mesh.matrixWorld.elements)
        uniform.set([mesh.matrixWorld.getMaxScaleOnAxis(), focal, +!!camera.isOrthographicCamera, +mesh.castShadow], 44)
        // El umbral viaja en los metadatos, compartidos por esta instancia.
        if (entry.quality !== quality) {
          for (let i = 0; i < data.metadata.length; i += 16) data.metadata[i + 14] = 1.5 / quality
          this.device.queue.writeBuffer(entry.clusters, 0, data.metadata)
          entry.quality = quality
        }
        this.device.queue.writeBuffer(entry.view, 0, uniform)
        ready.push(entry)
        changes.push([mesh, base])
        mesh.geometry = entry.geometry
      })
      if (ready.length) {
        const encoder = this.device.createCommandEncoder()
        for (const entry of ready) encoder.clearBuffer(entry.indirectBuffer, 0, 4)
        const pass = encoder.beginComputePass()
        pass.setPipeline(this.pipeline)
        for (const entry of ready) {
          pass.setBindGroup(0, entry.bind)
          pass.dispatchWorkgroups(entry.count)
        }
        pass.end()
        this.device.queue.submit([encoder.finish()])
      }
      callback()
    } finally {
      for (const [mesh, base] of changes) mesh.geometry = base
      for (const [mesh, entry] of this.entries) if (!seen.has(mesh)) { this._release(entry); this.entries.delete(mesh) }
      for (const base of this.jobs) if (!used.has(base)) { this.jobs.delete(base); this.shared.delete(base); this.revisions.delete(base) }
    }
    return changes.length
  }

  dispose() {
    this.worker.terminate()
    for (const entry of this.entries.values()) this._release(entry)
    this.entries.clear()
    this.shared.clear()
    this.jobs.clear()
    this.revisions.clear()
  }
}
