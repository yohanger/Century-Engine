// Superficie PBR de las regiones físicas. Lee WaterWorld; nunca calcula ni almacena otra física.
import * as THREE from 'three'
import { makeWaterUniforms, patchWaterMaterial } from './watershader.js'

const VISIBLE_DEPTH = 0.002

function createMesh(region) {
  const maxCells = region.width * region.height
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array(maxCells * 12)
  const depths = new Float32Array(maxCells * 4)
  const flow = new Float32Array(maxCells * 8)
  const turbulence = new Float32Array(maxCells * 4)
  const indices = new Uint16Array(maxCells * 6) // S02 limita la escena a 4096 celdas.
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage))
  geometry.setAttribute('rtWaterDepth', new THREE.BufferAttribute(depths, 1).setUsage(THREE.DynamicDrawUsage))
  geometry.setAttribute('rtAFlow', new THREE.BufferAttribute(flow, 2).setUsage(THREE.DynamicDrawUsage))
  geometry.setAttribute('rtSimFoam', new THREE.BufferAttribute(turbulence, 1).setUsage(THREE.DynamicDrawUsage))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1).setUsage(THREE.DynamicDrawUsage))
  let mat
  try {
    const u = makeWaterUniforms()
    u.rtShallow.value.set(region.color); u.rtDeep.value.set(region.deepColor)
    u.rtOpacity.value = 0.74; u.rtFoam.value = 0; u.rtTotalAmp.value = 1
    u.rtWMp.value.z = 0; u.rtWFx.value.set(region.clarity, 0, 1)
    mat = new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, roughness: 0.09,
      metalness: 0, side: THREE.DoubleSide, color: '#ffffff' })
    patchWaterMaterial(mat, u, { simulated: true })
    const mesh = new THREE.Mesh(geometry, mat)
    mesh.name = `Agua física: ${region.name}`
    mesh.renderOrder = 2; mesh.castShadow = false; mesh.receiveShadow = false
    mesh.frustumCulled = false
    mesh.userData.waterSimulated = true
    return { mesh, u }
  } catch (error) {
    geometry.dispose()
    mat?.dispose()
    throw error
  }
}

export class WaterSurfaceView {
  constructor(scene, water) {
    this.scene = scene
    this.group = new THREE.Group()
    this.group.name = 'WaterWorld · superficies simuladas'
    this.group.userData.waterSimulated = true
    this.items = new Map()
    scene.add(this.group)
    try { this.update(water) }
    catch (error) { this.dispose(); throw error }
  }

  update(water) {
    this.water = water // misma autoridad para gotas, superficie y gameplay
    for (const region of water.regions.values()) {
      let item = this.items.get(region.id)
      if (!item) {
        item = createMesh(region)
        this.items.set(region.id, item)
        this.group.add(item.mesh)
      }
      if (region.revision > 0 && item.lastRevision === region.revision) continue
      item.lastRevision = region.revision
      const { width: w, height: h, dx, dz } = region
      const geom = item.mesh.geometry, pos = geom.attributes.position.array
      const dep = geom.attributes.rtWaterDepth.array, flow = geom.attributes.rtAFlow.array
      const turbulence = geom.attributes.rtSimFoam.array, idx = geom.index.array
      const surfaceAtCorner = (col, row) => {
        let total = 0, samples = 0
        for (let j = row - 1; j <= row; j++) for (let i = col - 1; i <= col; i++) {
          if (i < 0 || j < 0 || i >= w || j >= h) continue
          const k = j * w + i
          if (!region.valid[k] || region.depth[k] <= VISIBLE_DEPTH) continue
          total += region.effectiveBed[k] + region.depth[k]; samples++
        }
        return samples ? total / samples + 0.002 : 0
      }
      let count = 0
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const k = j * w + i, d = region.depth[k]
        if (!region.valid[k] || d <= VISIBLE_DEPTH) continue
        const x0 = region.x + i * dx, z0 = region.z + j * dz
        const y00 = surfaceAtCorner(i,j), y10 = surfaceAtCorner(i+1,j)
        const y01 = surfaceAtCorner(i,j+1), y11 = surfaceAtCorner(i+1,j+1)
        const offset = count * 12, di = count * 4, fi = count * 6
        pos.set([x0,y00,z0, x0+dx,y10,z0, x0,y01,z0+dz, x0+dx,y11,z0+dz], offset)
        dep.fill(d, di, di+4)
        const speedX = d > 1e-9 ? region.qx[k] / d : 0
        const speedZ = d > 1e-9 ? region.qz[k] / d : 0
        // Espuma de corriente/cresta obtenida exclusivamente del solver, no de una
        // textura animada que no conozca la geometría ni las fuerzas del agua.
        const slope = Math.max(Math.abs(y10-y00)/dx, Math.abs(y01-y00)/dz,
          Math.abs(y11-y10)/dz, Math.abs(y11-y01)/dx)
        const foam = Math.min(1, Math.max(0, slope*0.7 + (Math.hypot(speedX,speedZ)-0.45)*0.22))
        for (let a = 0; a < 4; a++) {
          flow[(count * 4 + a) * 2] = speedX; flow[(count * 4 + a) * 2 + 1] = speedZ
          turbulence[count * 4 + a] = foam
        }
        const v = count * 4
        idx.set([v,v+2,v+1,v+1,v+2,v+3], fi)
        count++
      }
      geom.setDrawRange(0, count * 6)
      geom.attributes.position.needsUpdate = true
      geom.attributes.rtWaterDepth.needsUpdate = true
      geom.attributes.rtAFlow.needsUpdate = true
      geom.attributes.rtSimFoam.needsUpdate = true
      geom.index.needsUpdate = true
      item.mesh.visible = count > 0
      const authored = water.bodies?.find((b) => b.id === region.bodyId)?.p
      item.u.rtShallow.value.set(authored?.color || region.color)
      item.u.rtDeep.value.set(authored?.deepColor || region.deepColor)
      item.u.rtOpacity.value = authored?.opacity ?? 0.74
      item.u.rtFoam.value = authored?.foam ?? 0
      item.u.rtWFx.value.set(authored?.clarity ?? region.clarity, authored?.shoreFoam ?? 0.4, authored?.shoreWidth ?? 1)
      item.mesh.material.roughness = authored?.roughness ?? 0.09
    }
    for (const [id, item] of this.items) if (!water.regions.has(id)) {
      this.group.remove(item.mesh); item.mesh.geometry.dispose(); item.mesh.material.dispose(); this.items.delete(id)
    }
  }

  dispose() {
    this.scene.remove(this.group)
    for (const item of this.items.values()) { item.mesh.geometry.dispose(); item.mesh.material.dispose() }
    this.items.clear()
  }
}
