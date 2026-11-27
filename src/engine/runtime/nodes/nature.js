// Instancias individuales de naturaleza: reutilizan las geometrías y el viento del follaje existente.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BUILTIN_FOLIAGE } from '../geometry/foliage-shapes.js'
import { applyWind, geometryHeight } from '../render/windlib.js'
import { registerNode } from './registry.js'
import { makeRoot, applyBase } from './three-helpers.js'

// Una geometría inmutable por variante; las instancias conservan material, Transform y estado propios.
const geometries = new Map()
function geometryFor(kind) {
  if (!BUILTIN_FOLIAGE[kind]) throw new Error(`Variante de naturaleza desconocida: ${kind}`)
  if (!geometries.has(kind)) {
    const parts = BUILTIN_FOLIAGE[kind].build()
    const geometry = mergeGeometries(parts, false)
    for (const part of parts) if (part !== geometry) part.dispose()
    if (!geometry) throw new Error(`No se pudo construir vegetación: ${kind}`)
    geometries.set(kind, geometry)
  }
  return geometries.get(kind)
}

const kinds = Object.fromEntries(Object.entries(BUILTIN_FOLIAGE).map(([key, def]) =>
  [key, { label: def.name, icon: def.icon }]))

export default registerNode({
  type: 'nature', label: 'Naturaleza', icon: 'tree', category: 'Naturaleza', scalable: true, kinds,
  visualAnimationFields: {
    color: {label:'Color',kind:'color',def:'#ffffff',scope:'object'},
    castShadow: {label:'Sombra',kind:'bool',def:true,scope:'object'},
    windSway: {label:'Influencia del viento',kind:'number',def:1,min:0,max:4},
  },
  create(kind) {
    const def = BUILTIN_FOLIAGE[kind]
    if (!def) throw new Error(`Variante de naturaleza desconocida: ${kind}`)
    return { name: def.name, color: '#ffffff', castShadow: def.castShadow, collision: false,
      props: { windSway: 1 } }
  },
  build(obj) {
    const { root, visual } = makeRoot(obj)
    const geometry = geometryFor(obj.kind)
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.receiveShadow = true
    visual.add(mesh)
    root.userData.natureMesh = mesh
    root.userData.disposeNature = () => material.dispose() // la geometría de catálogo se comparte
    return root
  },
  update(root, obj) {
    applyBase(root, obj, true)
    const mesh = root.userData.natureMesh
    if (!mesh) return
    const def = BUILTIN_FOLIAGE[obj.kind]
    mesh.castShadow = obj.castShadow !== false
    mesh.material.color.set(obj.color || '#ffffff')
    const sway = Math.max(0, Math.min(4, Number.isFinite(+obj.props?.windSway) ? +obj.props.windSway : 1))
    applyWind(mesh.material, {
      height: geometryHeight(mesh.geometry), bend: (def.wind?.bend || 0) * sway,
      flutter: (def.wind?.flutter || 0) * sway,
    })
  },
})
