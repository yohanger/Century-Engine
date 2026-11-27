import * as THREE from 'three'
import { registerNode } from './registry.js'
import { makeRoot, applyBase, lineMat } from './three-helpers.js'
import { SYSTEM_ROLE } from '../ui/system.js'
import { makeCanvas } from '../platform.js'

// Canvas: nodo de interfaz (estilo Unity). Lleva adjunto un recurso `.ui` (props.ui = id del documento) que se dibuja sobre el juego
// mientras el nodo esté activo. Diálogos y avisos del motor funcionan sin añadir Canvas.
// Resolución de referencia (como el «Canvas Scaler» de Unity): el rectángulo del editor es del tamaño de esa pantalla, no un icono.
// 50 px = 1 unidad: un Canvas de 1920×1080 mide 38,4 × 21,6 en la escena.
export const CANVAS_PPU = 50
export const CANVAS_DEFAULTS = { ui: '', role: '', layer: 10, interactive: false, modal: false, visible: true, refW: 1920, refH: 1080, alpha: 1 }
const dim = (v, d) => (Number.isFinite(+v) && +v >= 16 ? Math.min(16384, Math.round(+v)) : d)
export const normalizeCanvas = (p = {}) => ({
  ui: typeof p.ui === 'string' ? p.ui : '',
  // «Uso» (ui/system.js): '' = interfaz propia; 'dialog', 'choices', 'prompt', 'fade', 'letterbox', 'caption', 'skip' = interfaz del sistema
  role: SYSTEM_ROLE[p.role] ? p.role : '',
  layer: Number.isFinite(+p.layer) ? +p.layer : CANVAS_DEFAULTS.layer,
  interactive: !!p.interactive,
  modal: !!p.modal,
  visible: p.visible !== false,
  refW: dim(p.refW, CANVAS_DEFAULTS.refW),
  refH: dim(p.refH, CANVAS_DEFAULTS.refH),
  alpha: Number.isFinite(p.alpha) ? Math.max(0, Math.min(1, p.alpha)) : 1,
})

function labelTexture(text, color) {
  const c = makeCanvas(); c.width = 512; c.height = 64
  const g = c.getContext('2d')
  g.fillStyle = color; g.fillRect(0, 0, 512, 64)
  g.fillStyle = '#0d0d0d'; g.font = '600 30px system-ui, sans-serif'; g.textBaseline = 'middle'; g.fillText(text, 18, 34)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Rectángulo de pantalla (relleno translúcido que no se puede elegir, marco, esquinas y rótulo). Solo el marco y el rótulo se pueden clicar. */
function fill(visual, obj) {
  const p = normalizeCanvas(obj.props)
  const w = p.refW / CANVAS_PPU, h = p.refH / CANVAS_PPU
  for (const c of [...visual.children]) { visual.remove(c); c.traverse?.((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose() }) }
  const col = obj.color
  const area = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }))
  area.raycast = () => {} // un plano enorme tapa todo lo de detrás: no se elige por el relleno
  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, h)), lineMat(col))
  const k = Math.min(w, h) * 0.06, pts = []
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const x = sx * w / 2, y = sy * h / 2
    pts.push(new THREE.Vector3(x, y, 0), new THREE.Vector3(x - sx * k, y, 0), new THREE.Vector3(x, y, 0), new THREE.Vector3(x, y - sy * k, 0))
  }
  const corners = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat(col))
  corners.raycast = () => {}
  const lw = Math.min(w * 0.4, 4.2), lh = lw / 8
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh), new THREE.MeshBasicMaterial({ map: labelTexture(`Canvas · ${p.role ? SYSTEM_ROLE[p.role].label.replace(/ \(.*$/, '') : `${p.refW}×${p.refH}`}`, col), side: THREE.DoubleSide }))
  tag.position.set(-w / 2 + lw / 2, h / 2 + lh / 2, 0)
  area.userData.helper = frame.userData.helper = corners.userData.helper = true
  visual.add(area, frame, corners, tag)
  visual.parent.userData.editorGizmos = [area, frame, corners] // el rótulo continúa visible para seleccionar el Canvas
  visual.position.y = h / 2 // el borde inferior queda en la posición del nodo
  visual.userData.mats = [area.material, frame.material, corners.material]
  visual.userData.cv = `${p.refW}x${p.refH}|${obj.color}|${p.role}`
}

const CANVAS_ANIMATION_FIELDS = [
  ['ui', 'Recurso .ui', 'string', ''],
  ['role', 'Uso', 'enum', '', { options: ['', ...Object.keys(SYSTEM_ROLE)] }],
  ['layer', 'Capa', 'number', 10],
  ['interactive', 'Recibe clics', 'bool', false],
  ['modal', 'Modal', 'bool', false],
  ['visible', 'Visible al iniciar', 'bool', true],
  ['refW', 'Resolución ancho', 'number', 1920, { min: 16, max: 16384 }],
  ['refH', 'Resolución alto', 'number', 1080, { min: 16, max: 16384 }],
  ['alpha', 'Opacidad', 'number', 1, { min: 0, max: 1 }],
]
const canvasAnimation = Object.fromEntries(CANVAS_ANIMATION_FIELDS.map(([key,label,kind,def,limits={}]) => [`canvas.${key}`, {
  label,kind,def,...limits,
  read: o => normalizeCanvas(o.props)[key],
  runtimeRead: (root,o) => root.userData.timelineCanvas?.[key] ?? normalizeCanvas(o.props)[key],
  apply: (root,value) => { (root.userData.timelineCanvas ??= {})[key] = value },
  capture: root => ({ had: Object.hasOwn(root.userData.timelineCanvas || {},key), value: root.userData.timelineCanvas?.[key] }),
  restore: (root,snapshot) => {
    if (snapshot?.had) (root.userData.timelineCanvas ??= {})[key] = snapshot.value
    else if (root.userData.timelineCanvas) {
      delete root.userData.timelineCanvas[key]
      if (!Object.keys(root.userData.timelineCanvas).length) delete root.userData.timelineCanvas
    }
  },
}]))

export default registerNode({
  type: 'canvas',
  label: 'Canvas (interfaz)',
  icon: 'ui',
  category: 'Interfaz',
  scalable: false,
  animation: canvasAnimation,
  // Los Canvas del sistema ya existen en Assets/UI/Sistema. Los antiguos se siguen cargando.
  kinds: { ui: { label: 'Canvas (interfaz propia)', icon: 'ui' } },
  create: (kind = 'ui') => {
    const r = SYSTEM_ROLE[kind]
    return { name: r ? `Canvas ${r.label.replace(/ \(.*$/, '')}` : 'Canvas', collision: false, color: '#c77dff', props: { ...CANVAS_DEFAULTS, ...(r ? { role: r.key, layer: r.layer } : {}) } }
  },

  build(obj) {
    const { root, visual } = makeRoot(obj)
    fill(visual, obj)
    return root
  },
  update(root, obj) {
    applyBase(root, obj, false)
    const v = root.userData.visual
    const p = normalizeCanvas(obj.props)
    if (v.userData.cv !== `${p.refW}x${p.refH}|${obj.color}|${p.role}`) fill(v, obj)
  },
})
