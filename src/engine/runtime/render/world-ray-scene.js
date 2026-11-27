import { DataTexture } from 'three'
import WorldRayWorker from './world-ray.worker.js?worker&inline'

import { collectRayMeshes, rayMeshesSignature, snapshotRayMesh } from './world-ray-geometry.js'

const REFRESH_MS = 1200

export class WorldRayScene {
  constructor(vp) {
    this.vp = vp
    this.next = 0
    this.key = ''
    this.worker = null
    this.active = null
    this.pending = false
    this.pendingMeshes = null
    this.failed = false
  }

  setScene(id) {
    if (id === this.sceneId) return
    this.sceneId = id
    this.dispose()
  }

  update(enabled, now) {
    if (!enabled) {
      if (this.worker || this.active || this.failed) this.dispose()
      return
    }
    if (this.pending || this.failed || now < this.next) return
    this.next = now + REFRESH_MS
    const entries = collectRayMeshes(this.vp.world, this.vp.camera.layers)
    const key = rayMeshesSignature(entries)
    if (key === this.key) return
    this.key = key
    if (!entries.length) {
      this._replace(null)
      return
    }
    try {
      if (!this.worker) {
        const worker = new WorldRayWorker()
        this.worker = worker
        worker.onmessage = ({ data }) => {
          if (this.worker !== worker) return
          this.pending = false
          const meshes = this.pendingMeshes
          this.pendingMeshes = null
          if (!data) { this._replace(null); return }
          const textures = Object.fromEntries(Object.entries(data.textures).map(([id, info]) => {
            const texture = new DataTexture(info.data, info.width, info.height, info.format, info.type)
            texture.internalFormat = info.internalFormat
            texture.needsUpdate = true
            return [id, texture]
          }))
          const { albedo, emission, surface, ...bvh } = textures
          this._replace({ bvh, albedo, emission, surface, meshes, tris: data.tris })
          this.vp.requestRender()
        }
        worker.onerror = () => { this.dispose(); this.failed = true }
        worker.onmessageerror = worker.onerror
      }
      const snapshot = entries.map(snapshotRayMesh)
      this.pendingMeshes = new Set(entries.map(entry => entry.mesh))
      this.pending = true
      this.worker.postMessage(snapshot, snapshot.flatMap(part => [part.position.buffer, part.index.buffer]))
    } catch {
      this.dispose()
      this.failed = true
    }
  }

  _replace(next) {
    if (this.active) {
      for (const tex of Object.values(this.active.bvh)) tex.dispose()
      this.active.albedo.dispose()
      this.active.emission.dispose()
      this.active.surface.dispose()
    }
    this.active = next
    const extra = this.vp.perf?.stats?.extra
    if (extra) {
      if (next) extra.worldRayTriangles = next.tris
      else delete extra.worldRayTriangles
    }
  }

  dispose() {
    this.worker?.terminate()
    this.worker = null
    this._replace(null)
    this.pending = false
    this.pendingMeshes = null
    this.failed = false
    this.next = 0
    this.key = ''
  }
}
