import * as THREE from 'three'
import { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import helvR from '../fonts/helvetiker_regular.typeface.json' with { type: 'json' }
import helvB from '../fonts/helvetiker_bold.typeface.json' with { type: 'json' }
import optR from '../fonts/optimer_regular.typeface.json' with { type: 'json' }
import optB from '../fonts/optimer_bold.typeface.json' with { type: 'json' }

/** Tipografías incluidas (typeface.js de three.js). Solo tienen glifos latinos básicos: las tildes y ñ se componen aquí. */
export const TEXT_FONTS = {
  sans: { label: 'Sans', data: helvR },
  sansBold: { label: 'Sans negrita', data: helvB },
  serif: { label: 'Serif', data: optR },
  serifBold: { label: 'Serif negrita', data: optB },
}

const fonts = new Map()
const fontOf = (k) => {
  const key = TEXT_FONTS[k] ? k : 'sansBold'
  if (!fonts.has(key)) fonts.set(key, new Font(TEXT_FONTS[key].data))
  return fonts.get(key)
}

const MARKS = { '́': ['´', "'"], '̀': ['`', "'"], '̃': ['~'], '̈': ['"'], '̂': ['^'], '̧': [','] }

export const TEXT_DEFAULTS = { text: 'TEXTO', font: 'sansBold', size: 1, depth: 0.3, bevel: 0.02, align: 'center', lineHeight: 1.25 }

const bbox = (shapes) => {
  if (!shapes.length) return null
  const g = new THREE.ShapeGeometry(shapes)
  g.computeBoundingBox()
  const b = g.boundingBox.clone()
  g.dispose()
  return b
}

/**
 * Geometría extruida del texto, centrada en el origen (la cara frontal mira a +Z).
 * Devuelve la geometría; `userData.box` lleva el tamaño [w,h,d].
 */
export function textGeometry(p) {
  const o = { ...TEXT_DEFAULTS, ...p }
  const font = fontOf(o.font)
  const glyphs = font.data.glyphs
  const size = Math.max(0.05, +o.size || 1)
  const depth = Math.max(0.001, +o.depth || 0.001)
  const bevel = Math.min(+o.bevel || 0, size * 0.15, depth * 0.45)
  const opts = { depth, bevelEnabled: bevel > 0.0005, bevelThickness: bevel, bevelSize: bevel, bevelOffset: 0, bevelSegments: 2, curveSegments: 6 }
  const scale = size / font.data.resolution
  const adv = (ch) => (glyphs[ch] ? glyphs[ch].ha * scale : size * 0.5)
  const shapesOf = (ch) => (glyphs[ch] && glyphs[ch].o ? font.generateShapes(ch, size) : [])
  const xTop = bbox(shapesOf('x'))?.max.y ?? size * 0.5
  const capTop = bbox(shapesOf('H'))?.max.y ?? size * 0.7

  const lines = String(o.text ?? '').split('\n')
  const pieces = []
  const lineW = []
  lines.forEach((ln, li) => {
    let x = 0
    const y0 = -li * size * o.lineHeight
    for (const c of ln.normalize('NFC')) {
      if (c === '¿' || c === '¡') {
        const src = c === '¿' ? '?' : '!'
        const sh = shapesOf(src)
        const b = bbox(sh)
        if (b) pieces.push({ li, shapes: sh, dx: x, dy: y0, rot: { cx: (b.min.x + b.max.x) / 2, cy: capTop / 2 } })
        x += adv(src)
        continue
      }
      if (c === ' ' || c === '\t') { x += glyphs[' '] ? adv(' ') : size * 0.4; continue }
      const parts = glyphs[c] ? [c] : c.normalize('NFD').split('')
      let base = parts[0]
      if (!glyphs[base]) { x += size * 0.5; continue }
      const marks = parts.slice(1)
      const bsh = shapesOf(base)
      const bb = bbox(bsh)
      if (bsh.length) pieces.push({ li, shapes: bsh, dx: x, dy: y0 })
      for (const m of marks) {
        const cand = (MARKS[m] || []).find((g) => glyphs[g])
        if (!cand || !bb) continue
        const msh = shapesOf(cand)
        const mb = bbox(msh)
        if (!mb) continue
        const dotted = base === 'i' || base === 'j'
        const top = dotted ? Math.max(bb.max.y, xTop) : bb.max.y
        let dy
        if (m === '̧') dy = 0.04 * size - mb.max.y
        else dy = top + 0.06 * size - mb.min.y + (dotted ? 0.05 * size : 0)
        const dx = (bb.min.x + bb.max.x) / 2 - (mb.min.x + mb.max.x) / 2
        pieces.push({ li, shapes: msh, dx: x + dx, dy: y0 + dy })
      }
      x += adv(base)
    }
    lineW.push(x)
  })

  const maxW = Math.max(0, ...lineW)
  const geos = []
  for (const pc of pieces) {
    const g = new THREE.ExtrudeGeometry(pc.shapes, opts)
    if (pc.rot) { g.translate(-pc.rot.cx, -pc.rot.cy, 0); g.rotateZ(Math.PI); g.translate(pc.rot.cx, pc.rot.cy, 0) }
    g.translate(pc.dx, pc.dy, 0)
    pc.g = g
    geos.push(g)
  }
  pieces.forEach((pc) => {
    const w = lineW[pc.li] || 0
    const shift = o.align === 'left' ? 0 : o.align === 'right' ? maxW - w : (maxW - w) / 2
    if (shift) pc.g.translate(shift, 0, 0)
  })
  let geo
  if (!geos.length) {
    geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(0), 3))
    geo.setIndex([])
    geo.userData.box = [size, size, depth]
    return geo
  }
  for (const g of geos) g.deleteAttribute('uv')
  const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g))
  geo = mergeGeometries(flat, false)
  geos.forEach((g) => g.dispose())
  geo.computeBoundingBox()
  const b = geo.boundingBox
  geo.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -(b.min.z + b.max.z) / 2)
  geo.computeBoundingBox()
  const s = new THREE.Vector3(); geo.boundingBox.getSize(s)
  geo.userData.box = [s.x, s.y, s.z]
  return geo
}

/** Buffers indexados (posiciones/normales/índices) escalados, listos para el GLB. */
export function textBuffers(geo, scale = [1, 1, 1]) {
  const pos = geo.attributes.position.array, nor = geo.attributes.normal.array
  const positions = new Float32Array(pos.length), normals = new Float32Array(nor.length)
  const [sx, sy, sz] = scale
  for (let i = 0; i < pos.length; i += 3) { positions[i] = pos[i] * sx; positions[i + 1] = pos[i + 1] * sy; positions[i + 2] = pos[i + 2] * sz }
  for (let i = 0; i < nor.length; i += 3) { // normales con la inversa traspuesta de la escala
    const x = nor[i] / sx, y = nor[i + 1] / sy, z = nor[i + 2] / sz, l = Math.hypot(x, y, z) || 1
    normals[i] = x / l; normals[i + 1] = y / l; normals[i + 2] = z / l
  }
  const n = positions.length / 3
  const indices = new Uint32Array(n)
  for (let i = 0; i < n; i++) indices[i] = i
  return { positions, normals, indices }
}
