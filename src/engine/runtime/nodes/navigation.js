import * as THREE from 'three'
import { registerNode } from './registry.js'
import { makeRoot, applyBase, lineMat, hitSphere } from './three-helpers.js'
import { unitGeometry } from '../geometry/primitives.js'
import { NAV_DEFAULTS } from '../nav/bake.js'
import { navCache } from '../nav/world.js'

/** Caja del mundo que cubre la región (la rotación se ignora: la región es siempre una caja alineada con los ejes). */
export const navBounds = (o) => ({ min: [o.position[0] - Math.abs(o.scale[0]) / 2, o.position[1] - Math.abs(o.scale[1]) / 2, o.position[2] - Math.abs(o.scale[2]) / 2], max: [o.position[0] + Math.abs(o.scale[0]) / 2, o.position[1] + Math.abs(o.scale[1]) / 2, o.position[2] + Math.abs(o.scale[2]) / 2] })

function buildPreview(root, grid) {
  if (root.userData.cells) { root.remove(root.userData.cells); root.userData.cells.geometry.dispose() }
  root.userData.cells = null
  root.userData.cellsFor = grid || null
  if (!grid) return
  const pos = []
  for (let i = 0; i < grid.ok.length; i++) if (grid.ok[i]) { const p = grid.nodePos(i); pos.push(p[0], p[1] + 0.06, p[2]) }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: root.userData.color || '#2fd3ff', size: Math.max(2, 4), sizeAttenuation: false, depthWrite: false }))
  pts.userData.helper = true; pts.raycast = () => {}; pts.frustumCulled = false
  root.userData.cells = pts
  root.add(pts)
}

// El horneado es caro: el descriptor publica el estado temporal en el nodo y
// solicita un trabajo coalescido a NavWorld, nunca modifica Assets directamente.
const navBakeFields = {
  cell: { label:'Celda (m)', def:NAV_DEFAULTS.cell, min:0.1, max:4 },
  agentRadius: { label:'Radio del agente', def:NAV_DEFAULTS.agentRadius, min:0, max:3 },
  agentHeight: { label:'Altura del agente', def:NAV_DEFAULTS.agentHeight, min:0.3, max:6 },
  maxSlope: { label:'Pendiente máxima', def:NAV_DEFAULTS.maxSlope, min:1, max:89 },
  layers: { label:'Capas', def:NAV_DEFAULTS.layers, min:1, max:6 },
}
const navBakeAnimation = Object.fromEntries(Object.entries(navBakeFields).map(([key, info]) => [
  `navigation.${key}`, {
    ...info, kind:'number',
    available: obj => !!obj.props?.asset && navCache.has(obj.props.asset),
    read: obj => obj.props?.[key] ?? info.def,
    runtimeRead: (root,obj) => root.userData.timelineNavBake?.[key] ?? obj.props?.[key] ?? info.def,
    capture: root => ({ had:Object.hasOwn(root.userData.timelineNavBake || {},key), value:root.userData.timelineNavBake?.[key] }),
    apply: (root,value) => {
      if (!Number.isFinite(value) || value < info.min || value > info.max)
        throw new RangeError(`Navigation: ${key} temporal inválido`)
      // Capas define el número de superficies por celda; no existen medias capas.
      const effective = key === 'layers' ? Math.round(value) : value
      if (root.userData.timelineNavBake?.[key] === effective) return
      ;(root.userData.timelineNavBake ??= {})[key] = effective
      root.userData.navBakeRuntime?.refresh()
    },
    restore: (root,saved) => {
      if (saved?.had) (root.userData.timelineNavBake ??= {})[key] = saved.value
      else if (root.userData.timelineNavBake) {
        delete root.userData.timelineNavBake[key]
        if (!Object.keys(root.userData.timelineNavBake).length) delete root.userData.timelineNavBake
      }
      root.userData.navBakeRuntime?.refresh()
    },
  },
]))

export default registerNode({
  type: 'navigation',
  label: 'Navegación',
  icon: 'navigation',
  category: 'Gameplay',
  scalable: true,
  // Una malla ya horneada permite cambiar la altura de conexión entre celdas
  // transitables. No regenera celdas descartadas durante el horneado.
  animation: {
    ...navBakeAnimation,
    'navigation.stepHeight': {
      label: 'Escalón máximo entre celdas', kind: 'number', def: NAV_DEFAULTS.stepHeight, min: 0, max: 3,
      available: obj => !!obj.props?.asset && navCache.has(obj.props.asset),
      read: obj => obj.props?.stepHeight ?? NAV_DEFAULTS.stepHeight,
      runtimeRead: (root,obj) => root.userData.timelineNavStepHeight ?? obj.props?.stepHeight ?? NAV_DEFAULTS.stepHeight,
      apply: (root,value) => {
        if (root.userData.timelineNavStepHeight === value) return
        root.userData.timelineNavStepHeight = value
        if (root.userData.timelineNavBake) root.userData.navBakeRuntime?.refresh()
      },
      capture: root => ({ had:Object.hasOwn(root.userData,'timelineNavStepHeight'), value:root.userData.timelineNavStepHeight }),
      restore: (root,saved) => {
        if (saved?.had) root.userData.timelineNavStepHeight = saved.value
        else delete root.userData.timelineNavStepHeight
        if (root.userData.timelineNavBake) root.userData.navBakeRuntime?.refresh()
      },
    },
  },
  visualAnimationFields: {
    color: { scope: 'object', label: 'Color', kind: 'color', def: '#2fd3ff' },
  },
  create: () => ({ name: 'Navegación', collision: false, color: '#2fd3ff', scale: [20, 6, 20], props: { ...NAV_DEFAULTS, asset: '' } }),

  build(obj) {
    const { root, visual } = makeRoot(obj)
    const fill = new THREE.Mesh(unitGeometry('box'), new THREE.MeshBasicMaterial({ color: obj.color, transparent: true, opacity: 0.05, depthWrite: false }))
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(unitGeometry('box')), lineMat(obj.color))
    root.userData.fillMat = fill.material; root.userData.edgeMat = edges.material
    fill.raycast = () => {}
    visual.add(fill, edges)
    root.userData.editorGizmos = [visual]
    root.add(hitSphere(0.4))
    return root
  },
  update(root, obj) {
    applyBase(root, obj, true)
    root.rotation.set(0, 0, 0) // la región es una caja alineada con los ejes
    root.userData.color = obj.color
    root.userData.fillMat.color.set(obj.color); root.userData.edgeMat.color.set(obj.color)
    const grid = obj.props.asset ? navCache.get(obj.props.asset) || null : null
    if (root.userData.cellsFor !== grid) buildPreview(root, grid)
    if (root.userData.cells) root.userData.cells.material.color.set(obj.color)
    // los puntos están en coordenadas del mundo: la raíz no se mueve con ellos
    if (root.userData.cells) { root.userData.cells.position.set(-root.position.x, -root.position.y, -root.position.z) }
  },
})
