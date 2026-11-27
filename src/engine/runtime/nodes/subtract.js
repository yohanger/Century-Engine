// Volumen sustractivo editorial. El sólido BSP se genera en scene/brushes.js, no aquí.
import * as THREE from 'three'
import { registerNode } from './registry.js'
import { makeRoot, applyBase, lineMat } from './three-helpers.js'
import { unitGeometry, stairsGeometry } from '../geometry/primitives.js'
import { geometryOf } from './mesh.js'
import { subtractPolyOf } from '../mesh/subtract-edit.js'

const shapeTypes = ['box', 'cylinder', 'stairs']
const shapeKey = 'subtract.kind'
const shapeAnimation = {
  [shapeKey]: {
    label: 'Volumen', kind: 'enum', options: shapeTypes, def: 'box',
    read: obj => shapeTypes.includes(obj.kind) ? obj.kind : 'box',
    runtimeRead: (root, obj) => root.userData.timelineSubtractKind ?? obj.kind,
    capture: root => ({had: Object.hasOwn(root.userData,'timelineSubtractKind'), value:root.userData.timelineSubtractKind}),
    apply: (root, value) => {
      if (!shapeTypes.includes(value)) throw new TypeError('Substract: forma temporal inválida')
      root.userData.timelineSubtractKind = value
    },
    restore: (root, record) => {
      if (record?.had) root.userData.timelineSubtractKind = record.value
      else delete root.userData.timelineSubtractKind
    },
  },
}

export default registerNode({
  type: 'subtract', label: 'Substract', icon: 'subtract', category: 'Herramientas de modelado', scalable: true,
  animation: shapeAnimation,
  create: () => ({ name: 'Substract', kind: 'box', scale: [2, 2, 2], color: '#e0503c', collision: false,
    castShadow: false, props: { steps: 8, turn: 0, receiverId: '', composeWithMeshSubtract: false } }),
  build(obj) {
    const { root, visual } = makeRoot(obj)
    const fill = new THREE.Mesh(unitGeometry('box'), new THREE.MeshBasicMaterial({ color: '#e0503c', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }))
    fill.userData.pickProxy = true // seleccionable sin convertir el volumen en un objeto de juego
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(fill.geometry), lineMat('#ff7a5c'))
    edges.userData.pickIgnore = true
    visual.add(fill, edges)
    root.userData.meshBody = fill
    root.userData.fill = fill
    root.userData.edges = edges
    root.userData.editorGizmos = [visual]
    // El volumen es una ayuda editorial fuera de Edit Mesh, pero durante la
    // edición también contiene la malla activa y no se puede ocultar al sincronizar.
    root.userData.editMeshVisual = visual
    root.userData.disposeSubtractVisual = () => {
      if (root.userData.subtractVisualDisposed) return
      root.userData.subtractVisualDisposed = true
      root.userData.subtractOwnedGeometry?.dispose()
      root.userData.subtractOwnedGeometry = null
      edges.geometry.dispose()
      fill.material.dispose()
      edges.material.dispose()
    }
    return root
  },
  update(root, obj) {
    applyBase(root, obj, true)
    this.refreshShape(root, obj)
  },
  refreshShape(root, obj) {
    const { fill, edges } = root.userData
    const value = root.userData.timelineSubtractKind ?? obj.kind
    const shape = shapeTypes.includes(value) ? value : 'box'
    const effectiveScale = root.userData.visual?.scale?.toArray?.() ?? obj.scale
    const custom = subtractPolyOf(obj)
    const key = custom ? `editable:${obj.props.mesh.rev}` : `${shape}|${obj.props?.steps ?? 8}|${obj.props?.turn ?? 0}|${effectiveScale?.join(',')}`
    if (!root.userData.liveEdit && (root.userData.shapeKey !== key || (custom && root.userData.subtractMeshSource !== obj.props.mesh))) {
      const geo = custom ? geometryOf(custom) : shape === 'stairs'
        ? stairsGeometry(obj.props?.steps ?? 8, obj.props?.turn ?? 0, effectiveScale?.[0] ?? 1, effectiveScale?.[2] ?? 1, effectiveScale?.[1] ?? 1, obj.props)
        : unitGeometry(shape)
      // Las primitivas unitarias pueden compartir geometría: no liberar la geometría de catálogo.
      const oldEdges = edges.geometry
      fill.geometry = geo
      edges.geometry = new THREE.EdgesGeometry(geo)
      oldEdges.dispose()
      if (root.userData.subtractOwnedGeometry) root.userData.subtractOwnedGeometry.dispose()
      root.userData.subtractOwnedGeometry = custom ? geo : null
      root.userData.shapeKey = key
      root.userData.subtractMeshSource = custom ? obj.props.mesh : null
    }
    fill.material.color.set(obj.color || '#e0503c')
    edges.material.color.set(obj.color || '#e0503c')
  },
})
