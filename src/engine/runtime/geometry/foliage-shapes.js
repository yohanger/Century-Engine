// Vegetación · catálogo procedural: hierba, flores, arbustos, árboles y rocas con geometría generada (origen en la base).
import * as THREE from 'three'
import { clamp } from '../util.js'

// ---------- geometrías procedurales (origen en la base, ~1 m de alto salvo árboles) ----------
let _seed = 1
const rnd = () => ((_seed = (_seed * 1664525 + 1013904223) >>> 0) / 4294967296)

function paint(geo, bottom, top = bottom, y0 = 0, y1 = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo
  const pos = g.attributes.position
  const col = new Float32Array(pos.count * 3)
  const a = new THREE.Color(bottom), b = new THREE.Color(top), c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    c.copy(a).lerp(b, clamp((pos.getY(i) - y0) / Math.max(1e-6, y1 - y0), 0, 1))
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.deleteAttribute('uv')
  return g
}

function blade(h, w, lean, rot, x, z, bottom, top) {
  const g = new THREE.BufferGeometry()
  const v = new Float32Array([-w / 2, 0, 0, w / 2, 0, 0, lean * 0.4 - w * 0.25, h * 0.55, 0, lean * 0.4 + w * 0.25, h * 0.55, 0, lean, h, 0])
  g.setAttribute('position', new THREE.BufferAttribute(v, 3))
  g.setIndex([0, 1, 3, 0, 3, 2, 2, 3, 4])
  g.computeVertexNormals()
  const ng = g.toNonIndexed()
  const n = ng.attributes.normal
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0) // sombreado suave tipo hierba
  ng.rotateY(rot)
  ng.translate(x, 0, z)
  return paint(ng, bottom, top, 0, h)
}

function clump(count, h, spread, bottom, top) {
  _seed = 7
  const parts = []
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2, r = rnd() * spread
    parts.push(blade(h * (0.6 + rnd() * 0.6), 0.07 + rnd() * 0.04, (rnd() - 0.5) * h * 0.5, rnd() * Math.PI, Math.cos(a) * r, Math.sin(a) * r, bottom, top))
  }
  return parts
}

function blob(r, detail, x, y, z, sy, bottom, top, jitter = 0.18) {
  const g = new THREE.IcosahedronGeometry(r, detail).toNonIndexed()
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    // desplazamiento determinista por posición (los vértices repetidos deben moverse igual)
    const k = 1 + (Math.sin(p.getX(i) * 12.9 + p.getY(i) * 78.2 + p.getZ(i) * 37.7) * 0.5) * jitter
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * sy, p.getZ(i) * k)
  }
  g.translate(x, y, z)
  g.computeVertexNormals()
  return paint(g, bottom, top, y - r * sy, y + r * sy)
}

function cyl(rb, rt, h, y, color, seg = 6) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, false).toNonIndexed()
  g.translate(0, y + h / 2, 0)
  g.computeVertexNormals()
  return paint(g, color, color)
}

function cone(r, h, y, bottom, top) {
  const g = new THREE.ConeGeometry(r, h, 8, 1, false).toNonIndexed()
  g.translate(0, y + h / 2, 0)
  g.computeVertexNormals()
  return paint(g, bottom, top, y, y + h)
}

export const BUILTIN_FOLIAGE = {
  grass: {
    name: 'Hierba', icon: 'grass', density: 250, minScale: 0.8, maxScale: 1.3, alignNormal: 0.7, maxSlope: 55, castShadow: false,
    wind: { bend: 1.0 }, // viento: bend (flexión), flutter (aleteo de hojas); null = rígido
    build: () => clump(9, 0.55, 0.14, '#3f6b2a', '#9acd5a'),
  },
  tallgrass: {
    name: 'Hierba alta', icon: 'grass', density: 120, minScale: 0.8, maxScale: 1.4, alignNormal: 0.5, maxSlope: 50, castShadow: false,
    wind: { bend: 1.15 }, // viento: bend (flexión), flutter (aleteo de hojas); null = rígido
    build: () => clump(11, 1.15, 0.22, '#4a6b2a', '#c4cf6a'),
  },
  flowers: {
    name: 'Flores', icon: 'flower', density: 60, minScale: 0.7, maxScale: 1.2, alignNormal: 0.6, maxSlope: 50, castShadow: false,
    wind: { bend: 0.9 }, // viento: bend (flexión), flutter (aleteo de hojas); null = rígido
    build: () => {
      _seed = 11
      const parts = clump(5, 0.5, 0.1, '#3f6b2a', '#79a846')
      const cols = ['#f4d03f', '#e8527a', '#ffffff', '#a66bd6']
      for (let i = 0; i < 3; i++) {
        const a = rnd() * Math.PI * 2, r = 0.05 + rnd() * 0.08, h = 0.4 + rnd() * 0.25
        parts.push(blob(0.055, 0, Math.cos(a) * r, h, Math.sin(a) * r, 0.7, cols[(rnd() * cols.length) | 0], cols[(rnd() * cols.length) | 0], 0))
      }
      return parts
    },
  },
  bush: {
    name: 'Arbusto', icon: 'bush', density: 6, minScale: 0.8, maxScale: 1.4, alignNormal: 0, maxSlope: 40, castShadow: true,
    wind: { bend: 0.22, flutter: 0.6 }, // viento: bend (flexión), flutter (aleteo de hojas); null = rígido
    build: () => [blob(0.5, 1, 0, 0.42, 0, 0.8, '#2f5a22', '#5f9a3a'), blob(0.34, 1, 0.38, 0.32, 0.1, 0.8, '#2f5a22', '#6aa642'), blob(0.3, 1, -0.3, 0.3, -0.2, 0.8, '#2b5320', '#5a9438')],
  },
  pine: {
    name: 'Pino', icon: 'tree', density: 3, minScale: 0.8, maxScale: 1.5, alignNormal: 0, maxSlope: 35, castShadow: true,
    leaves: true, wind: { bend: 0.1, flutter: 0.25 }, // viento: bend (flexión), flutter (aleteo de hojas); null = rígido
    build: () => [cyl(0.16, 0.1, 1.0, 0, '#5b3f26'), cone(1.15, 1.7, 0.7, '#1f4a2a', '#2f6b3a'), cone(0.9, 1.5, 1.7, '#22522f', '#347a42'), cone(0.62, 1.3, 2.6, '#265a33', '#3b8a4c')],
  },
  tree: {
    name: 'Árbol', icon: 'tree', density: 3, minScale: 0.8, maxScale: 1.4, alignNormal: 0, maxSlope: 35, castShadow: true,
    leaves: true, wind: { bend: 0.16, flutter: 0.7 }, // viento: bend (flexión), flutter (aleteo de hojas); null = rígido
    build: () => [cyl(0.22, 0.14, 1.9, 0, '#6a4a2e'), blob(1.15, 1, 0, 2.7, 0, 0.9, '#2f6a2c', '#6fb544', 0.22), blob(0.8, 1, 0.8, 2.3, 0.2, 0.9, '#2f6a2c', '#5fa83c', 0.22), blob(0.75, 1, -0.7, 2.4, -0.3, 0.9, '#2c622a', '#5aa03a', 0.22)],
  },
  rock: {
    name: 'Roca', icon: 'rock', density: 2, minScale: 0.5, maxScale: 1.6, alignNormal: 0.4, maxSlope: 90, castShadow: true,
    wind: null, // viento: bend (flexión), flutter (aleteo de hojas); null = rígido
    build: () => [blob(0.5, 1, 0, 0.22, 0, 0.6, '#6f6f72', '#a4a4a8', 0.35)],
  },
}
