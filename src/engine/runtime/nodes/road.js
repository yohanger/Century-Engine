import * as THREE from 'three'
import { registerNode } from './registry.js'
import { makeRoot, applyBase } from './three-helpers.js'
import { buildRoad, normalizeRoad, roadGeoKey, ROAD_SLOTS } from '../geometry/road.js'
import { makePbrMaterial, syncPbrMaterial, ensureRoadPaintPbrEffect, PBR_ENV } from '../render/pbr.js'
import { roadSlotMaterial, defaultNewRoadAsphalt } from '../render/road-material.js'
import { updateRoadPaint } from '../render/road-paint.js'


function geometryOf(b, tile, length, width) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(b.positions, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(b.normals, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(b.uvs, 2))
  g.setAttribute('lfPaintUV', new THREE.BufferAttribute(b.paintUvs, 2))
  // Blockout métrico: reutiliza las UV longitudinales de la carretera, deshaciendo el
  // factor de repetición. La cuadrícula sigue la curva sin distorsión ni nueva geometría.
  const uv = new Float32Array(b.uvs.length), size = new Float32Array(b.uvs.length)
  for (let i = 0; i < b.uvs.length; i += 2) {
    uv[i] = b.uvs[i] * tile; uv[i + 1] = b.uvs[i + 1] * tile
    size[i] = width; size[i + 1] = length
  }
  g.setAttribute('lfBlockUV', new THREE.BufferAttribute(uv, 2))
  g.setAttribute('lfBlockSize', new THREE.BufferAttribute(size, 2))
  g.setIndex(new THREE.BufferAttribute(b.indices, 1))
  g.computeBoundingSphere()
  return g
}

// Material de cada superficie: valores temporales en la instancia, nunca en
// Assets/Materials. No se incluyen tamaños, puntos ni tile (rehacen geometría).
const ROAD_ANIM_FIELDS = [
  ['color', 'Color', 'color'],
  ['roughness', 'Rugosidad', 'number', 0, 1],
  ['emissive', 'Brillo propio', 'number', 0, 3],
]
function refreshRoadMaterial(root, obj) {
  // La sincronización PBR pasa por update(), que también aplica la pose autoral.
  // Preservar transformaciones, visibilidad y escala ya animadas por otras pistas.
  const position = root.position?.clone?.(), rotation = root.quaternion?.clone?.()
  const scale = root.userData.visual?.scale?.clone?.(), visible = root.visible
  roadDefinition.update(root, obj)
  if (position) root.position.copy(position)
  if (rotation) root.quaternion.copy(rotation)
  if (scale) root.userData.visual.scale.copy(scale)
  if (visible !== undefined) root.visible = visible
  root.updateMatrixWorld?.(true)
}
const roadAnimation = Object.fromEntries(ROAD_SLOTS.flatMap(([slot, label]) => ROAD_ANIM_FIELDS.filter(([field]) => field !== 'emissive' || slot === 'center' || slot === 'lanes')
  .map(([field, title, kind, min, max]) => {
    const property = `road.${slot}${field[0].toUpperCase()}${field.slice(1)}`
    const original = obj => roadSlotMaterial(normalizeRoad(obj.props).slots[slot],slot,PBR_ENV.materials,obj.opacity ?? 1)
    const current = root => root.userData.timelineRoadMaterial?.[slot] || null
    const spec = {
      label: `${label}: ${title}`, kind,
      def: field === 'color' ? '#ffffff' : field === 'roughness' ? 0.6 : 0,
      ...(kind === 'number' ? {min,max} : {}),
      // La superficie lateral solo existe cuando las aceras están activas.
      available: obj => slot !== 'side' || normalizeRoad(obj.props).sidewalks,
      read: obj => field === 'emissive' ? normalizeRoad(obj.props).slots[slot].emissive || 0 : original(obj)[field],
      runtimeRead: (root,obj) => current(root)?.[field] ?? (field === 'emissive' ? normalizeRoad(obj.props).slots[slot].emissive || 0 : original(obj)[field]),
      apply: (root,value,obj) => {
        ((root.userData.timelineRoadMaterial ??= {})[slot] ??= {})[field] = value
        refreshRoadMaterial(root,obj)
      },
      capture: root => ({had:Object.hasOwn(current(root) || {},field),value:current(root)?.[field]}),
      restore: (root,saved,obj) => {
        const list=root.userData.timelineRoadMaterial
        if (saved?.had) ((root.userData.timelineRoadMaterial ??= {})[slot] ??= {})[field]=saved.value
        else if (list?.[slot]) {
          delete list[slot][field]
          if (!Object.keys(list[slot]).length) delete list[slot]
          if (!Object.keys(list).length) delete root.userData.timelineRoadMaterial
        }
        refreshRoadMaterial(root,obj)
      },
    }
    return [property,spec]
  })))

const roadDefinition = registerNode({
  type: 'road',
  label: 'Carretera',
  icon: 'road',
  category: 'Herramientas de modelado',
  scalable: false,
  animation: roadAnimation,
  kinds: { road: { label: 'Carretera', icon: 'road' } },
  create() {
    const props = normalizeRoad()
    props.slots.asphalt = { ...props.slots.asphalt, ...defaultNewRoadAsphalt() }
    return { name: 'Carretera', color: '#ffffff', collision: true, props }
  },

  build(obj, ctx) {
    const { root } = makeRoot(obj)
    root.userData.ctx = ctx || {}
    root.userData.parts = {}
    root.userData.mats = {}
    for (const [k] of ROAD_SLOTS) {
      const m = makePbrMaterial(THREE.DoubleSide)
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), m)
      mesh.userData.road = true
      mesh.userData.roadSlot = k
      if (k !== 'asphalt' && k !== 'side') mesh.renderOrder = 1
      root.userData.parts[k] = mesh
      root.userData.mats[k] = m
      root.add(mesh)
    }
    root.userData.gkey = null
    // el editor llama a refresh() ya con el nodo colgado del árbol (hace falta la matriz mundial para seguir el terreno)
    root.userData.refresh = () => {
      const u = root.userData, obj = u.obj
      if (!obj) return
      const p = normalizeRoad(obj.props)
      root.updateWorldMatrix(true, false)
      const wkey = p.conform ? root.matrixWorld.elements.map((v) => v.toFixed(3)).join() + ':' + (u.ctx.terrainVersion || 0) : ''
      const key = roadGeoKey(p) + wkey
      if (u.gkey === key) return
      u.gkey = key
      const r = buildRoad(p, { heightAt: u.ctx.heightAt, world: root.matrixWorld })
      for (const [k] of ROAD_SLOTS) {
        const mesh = u.parts[k]
        mesh.geometry.dispose()
        mesh.geometry = r[k] ? geometryOf(r[k], p.slots[k].tile, r.length, p.width * Math.max(...p.pw)) : new THREE.BufferGeometry()
        mesh.visible = !!r[k]
      }
      u.stats = { length: r.length }
    }
    return root
  },

  update(root, obj) {
    applyBase(root, obj, false)
    const u = root.userData
    u.obj = obj
    const p = normalizeRoad(obj.props)
    u.refresh()
    for (const [k] of ROAD_SLOTS) {
      const s = p.slots[k], m = u.mats[k]
      const data = roadSlotMaterial(s, k, PBR_ENV.materials, obj.opacity ?? 1)
      const animated = u.timelineRoadMaterial?.[k]
      if (animated) {
        if (animated.color !== undefined) data.color = animated.color
        if (animated.roughness !== undefined) data.roughness = animated.roughness
      }
      const shader = data.mat?.shader || ''
      // Shader PBR → mapas de Assets mediante PBR_ENV; material clásico → UV de carretera.
      const shaderAlbedo = shader === 'builtin:blockout' || shader === 'builtin:realista'
      const tex = data.directTexture && !shaderAlbedo && u.ctx.getTexture ? u.ctx.getTexture(data.directTexture) : null
      if (m.map !== tex) { m.map = tex; m.needsUpdate = true }
      m.userData.lfBlockFaces = shader === 'builtin:blockout' && !data.mat.params.uAlbedo
      // Un proyecto antiguo carece de mat: no imponerle el shader global al abrirlo.
      // Una carretera nueva o un recurso .material sí utiliza el pipeline PBR habitual.
      const legacy = !s.mat && !data.shared && !s.materialId
      syncPbrMaterial(m, data, legacy ? { ...PBR_ENV, look: 'clasico' } : PBR_ENV)
      m.emissive.set(animated?.color ?? s.color)
      m.emissiveIntensity = animated?.emissive ?? s.emissive ?? 0
      m.polygonOffset = k !== 'asphalt' && k !== 'side'; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1
      if ((k === 'asphalt' || k === 'side') && (p.paint || m.userData.rtRoadPaint)) updateRoadPaint(m, p.paint, k, {
        width: k === 'asphalt' ? p.width * Math.max(...p.pw) : p.sideWidth * 2,
        length: u.stats?.length || 1, closed: !!p.closed,
      }, PBR_ENV)
      if (m.userData.rtRoadPaint) ensureRoadPaintPbrEffect(m)
      const shadow = m.userData.rt
      u.parts[k].customDepthMaterial = shadow?.depthMat || undefined
      u.parts[k].customDistanceMaterial = shadow?.distMat || undefined
    }
  },

})

export default roadDefinition
