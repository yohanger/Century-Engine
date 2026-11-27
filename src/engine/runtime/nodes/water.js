import * as THREE from 'three'
import { registerNode } from './registry.js'
import { makeRoot, applyBase } from './three-helpers.js'
import { WATER_NODE_DEFAULTS, normalizeWaterNode, waterGeoKey, waterShapeBuffers } from '../geometry/watershape.js'
import { makeWaterUniforms, patchWaterMaterial, setWaterUniforms } from '../geometry/watershader.js'
import { WM } from '../geometry/waterfx.js'

const KINDS = {
  ocean: { label: 'Océano', icon: 'water-ocean', props: { shape: 'ocean', size: 4000 } },
  rect: { label: 'Lago / piscina', icon: 'water', props: { shape: 'rect', width: 40, length: 40 } },
  circle: { label: 'Estanque circular', icon: 'water-circle', props: { shape: 'circle', radius: 20 } },
  river: { label: 'Río', icon: 'water-river', props: { shape: 'river', riverWidth: 8 } },
}
const NAMES = { ocean: 'Océano', rect: 'Lago', circle: 'Estanque', river: 'Río' }

function geometryOf(b) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(b.positions, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(b.normals, 3))
  if (b.flow) g.setAttribute('rtAFlow', new THREE.BufferAttribute(b.flow, 2)) // ríos: sentido de la corriente en cada vértice
  g.setIndex(new THREE.BufferAttribute(b.indices, 1))
  g.computeBoundingSphere()
  return g
}

// Las olas, colores, materiales y texturas ya tienen aplicador en update().
// La forma, la región física y los puntos no se animan aquí: requieren
// reconstrucción/autoridad, no un shader aplicado sin consecuencias físicas.
const APPEARANCE = [
  ['color', 'Color superficial', 'color'],
  ['deepColor', 'Color profundo', 'color'],
  ['opacity', 'Opacidad', 'number', 0.1, 1],
  ['roughness', 'Brillo (rugosidad)', 'number', 0, 0.6],
  ['foam', 'Espuma', 'number', 0, 1],
  ['clarity', 'Claridad (m)', 'number', 0.5, 24],
  ['shoreFoam', 'Espuma de orilla', 'number', 0, 1],
  ['shoreWidth', 'Ancho espuma (m)', 'number', 0.1, 4],
  ['faceted', 'Facetado (PS1)', 'bool'],
  ['waveHeight', 'Altura de olas (m)', 'number', 0, 10],
  ['waveLength', 'Longitud de onda (m)', 'number', 1, 200],
  ['waveSpeed', 'Velocidad de olas', 'number', 0, 3],
  ['wind', 'Viento', 'number', 0, 1],
  ['windDir', 'Dirección del viento (°)', 'number'],
  ['ripples', 'Ondulación fina', 'number', 0, 1],
  ['rippleScale', 'Tamaño de ondulación (m)', 'number', 0.2, 30],
  ['texture', 'Textura', 'string'],
  ['textureMode', 'Uso de textura', 'enum'],
  ['textureScale', 'Repetición (m)', 'number', 0.5],
  ['textureSpeed', 'Desplazamiento de textura', 'number', 0, 2],
  ['textureStrength', 'Intensidad de textura', 'number', 0, 1],
]
const waterAnimation = Object.fromEntries(APPEARANCE.map(([key, label, kind, min, max]) => {
  const def = kind === 'string' ? '' : WATER_NODE_DEFAULTS[key]
  const spec = { label, kind, def,
    ...(kind === 'number' && Number.isFinite(min) ? { min } : {}),
    ...(kind === 'number' && Number.isFinite(max) ? { max } : {}),
    ...(key === 'textureMode' ? { options: ['color', 'normal'] } : {}),
  }
  if (key === 'texture') spec.read = obj => obj.props?.texture || ''
  return [key, spec]
}))

export default registerNode({
  type: 'water',
  label: 'Agua',
  icon: 'water',
  category: 'Ambiente',
  scalable: false,
  visualAnimationFields: waterAnimation,
  kinds: Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, { label: v.label, icon: v.icon }])),
  create(kind) {
    const k = KINDS[kind] || KINDS.ocean
    return { name: NAMES[kind] || 'Agua', color: '#3a78a8', collision: false, castShadow: false, props: normalizeWaterNode(k.props) }
  },

  build(obj, ctx) {
    const { root } = makeRoot(obj)
    root.userData.ctx = ctx || {}
    const u = makeWaterUniforms()
    u.rtWM = WM.rtWM; u.rtWMp = WM.rtWMp // el mapa de profundidad del terreno es común a todas las aguas
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, roughness: 0.08, metalness: 0, depthWrite: false, side: THREE.DoubleSide })
    patchWaterMaterial(mat, u)
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat)
    mesh.frustumCulled = false // la malla se desplaza en el shader
    mesh.renderOrder = 2
    mesh.castShadow = false; mesh.receiveShadow = false
    root.add(mesh)
    root.userData.waterU = u
    root.userData.waterMesh = mesh
    root.userData.gkey = null
    return root
  },

  update(root, obj) {
    applyBase(root, obj, false)
    const u = root.userData
    const p = normalizeWaterNode(obj.props)
    const key = waterGeoKey(p)
    if (u.gkey !== key) {
      u.gkey = key
      u.waterMesh.geometry.dispose()
      u.waterMesh.geometry = geometryOf(waterShapeBuffers(p))
    }
    const tex = p.texture && u.ctx.getTexture ? u.ctx.getTexture(p.texture, p.textureMode === 'normal' ? 'normal' : 'color') : null
    u.waterMesh.material.roughness = p.roughness
    setWaterUniforms(u.waterU, p, tex)
    u.waterMove = p.waveSpeed > 0 || (!!tex && p.textureSpeed > 0)
  },

})

export { WATER_NODE_DEFAULTS }
