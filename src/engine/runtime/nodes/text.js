import * as THREE from 'three'
import { registerNode } from './registry.js'
import { makeRoot, applyBase } from './three-helpers.js'
import { textGeometry, TEXT_DEFAULTS } from '../geometry/text3d.js'
import { DEG } from '../util.js'

export const NEON_LIGHTS = { none: 'Solo brillo (sin luz)', omni: 'Punto (centro)', strip: 'Tira (a lo largo del texto)', spot: 'Foco frontal' }

const GEO_KEYS = ['text', 'font', 'size', 'depth', 'bevel', 'align', 'lineHeight']
const geoSig = (p) => GEO_KEYS.map((k) => p[k]).join('|')

/** Luces de neón en coordenadas del nodo: { type, pos:[x,y,z], energy, range, angle }. Mismo cálculo en editor y exportación. */
export function neonLights(o, box) {
  const p = o.props
  if (!p.neon || p.neonLight === 'none') return []
  const [sx, sy, sz] = o.scale
  const w = box[0] * sx, h = box[1] * sy, d = box[2] * sz
  const front = d / 2 + Math.max(0.15, h * 0.35) // delante del texto (+Z)
  const energy = p.neonLightEnergy
  if (p.neonLight === 'omni') return [{ type: 'omni', pos: [0, 0, front], energy, range: p.neonRange }]
  if (p.neonLight === 'spot') return [{ type: 'spot', pos: [0, 0, front * 0.6], energy, range: p.neonRange, angle: p.neonAngle }]
  const n = Math.max(2, Math.min(5, Math.round(w / Math.max(0.5, h * 1.6))))
  const out = []
  for (let i = 0; i < n; i++) out.push({ type: 'omni', pos: [n === 1 ? 0 : -w / 2 + (w * (i + 0.5)) / n, 0, front], energy: (energy * 2) / n, range: p.neonRange })
  return out
}

export default registerNode({
  type: 'text',
  label: 'Texto 3D',
  icon: 'text',
  category: 'Visuales',
  scalable: true,
  visualAnimationFields: {
    text: { label:'Texto',kind:'string',def:'TEXTO' },
    font: { label:'Fuente',kind:'enum',def:'sansBold',options:['sans','sansBold','serif','serifBold'] },
    size: { label:'Tamaño',kind:'number',def:1,min:0.05 },
    depth: { label:'Profundidad',kind:'number',def:0.3,min:0.01 },
    bevel: { label:'Bisel',kind:'number',def:0.02,min:0,max:0.3 },
    align: { label:'Alineación',kind:'enum',def:'center',options:['left','center','right'] },
    lineHeight: { label:'Interlineado',kind:'number',def:1.25,min:0.6,max:3 },
    neon: { label:'Emite luz',kind:'bool',def:false },
    neonColor: { label:'Neón color',kind:'color',def:'#ff3df0' },
    neonEnergy: { label:'Neón brillo',kind:'number',def:3,min:0,max:16 },
    neonLight: { label:'Forma neón',kind:'enum',def:'strip',options:['none','omni','strip','spot'] },
    neonLightEnergy: { label:'Energía neón',kind:'number',def:1.5,min:0 },
    neonRange: { label:'Rango neón',kind:'number',def:8,min:0.5 },
    neonAngle: { label:'Ángulo neón',kind:'number',def:50,min:5,max:89 },
    color: { label:'Color material',kind:'color',def:'#e8ecf4',scope:'object' },
  },
  kinds: { text: { label: 'Texto 3D', icon: 'text' } },
  create() {
    return {
      name: 'Texto', color: '#e8ecf4', roughness: 0.5, metallic: 0, collision: false,
      props: { ...TEXT_DEFAULTS, neon: false, neonColor: '#ff3df0', neonEnergy: 3, neonLight: 'strip', neonLightEnergy: 1.5, neonRange: 8, neonAngle: 50 },
    }
  },

  build(obj) {
    const { root, visual } = makeRoot(obj)
    const mat = new THREE.MeshStandardMaterial()
    root.userData.mat = mat
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat)
    visual.add(mesh)
    root.userData.body = mesh
    root.userData.lights = []
    root.userData.gsig = null
    return root
  },

  update(root, obj) {
    applyBase(root, obj, true)
    const u = root.userData, p = obj.props
    const sig = geoSig(p)
    if (u.gsig !== sig) {
      u.body.geometry.dispose()
      u.body.geometry = textGeometry(p)
      u.gsig = sig
    }
    const m = u.mat
    m.color.set(obj.color); m.roughness = obj.roughness; m.metalness = obj.metallic
    m.opacity = obj.opacity; m.transparent = obj.opacity < 1
    if (p.neon) { m.emissive.set(p.neonColor); m.emissiveIntensity = p.neonEnergy } else { m.emissive.set(0x000000); m.emissiveIntensity = 1 }
    // luces de neón (hijas del nodo, sin escala)
    const want = neonLights(obj, u.body.geometry.userData.box || [1, 1, 1])
    while (u.lights.length > want.length) { const l = u.lights.pop(); l.target?.parent?.remove(l.target); root.remove(l); l.dispose?.() }
    want.forEach((w, i) => {
      let l = u.lights[i]
      if (l && ((w.type === 'spot') !== !!l.isSpotLight)) { root.remove(l); l.target?.parent?.remove(l.target); l = null }
      if (!l) {
        l = w.type === 'spot' ? new THREE.SpotLight(0xffffff, 1) : new THREE.PointLight(0xffffff, 1)
        if (w.type === 'spot') { l.target.position.set(0, 0, 1); root.add(l.target) }
        root.add(l)
        u.lights[i] = l
      }
      l.position.set(...w.pos)
      if (l.isSpotLight) l.target.position.set(w.pos[0], w.pos[1], w.pos[2] + 1)
      l.color.set(p.neonColor)
      l.intensity = w.energy * Math.PI
      l.distance = w.range
      l.decay = 1
      if (l.isSpotLight) { l.angle = Math.min(89, w.angle) * DEG; l.penumbra = 1 }
    })
  },

})
