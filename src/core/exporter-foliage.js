// Exportación de nivel · vegetación: geometría de cada tipo a GLB y los archivos de datos que lee el cargador.
import * as THREE from 'three'
import { buildMeshGLB, encodePngRGBA } from './godot/glb.js'
import { slug } from '../engine/runtime/util.js'
import { Foliage, BUILTIN_FOLIAGE, composeInstance, crossedQuads, modelPivot } from '../engine/runtime/geometry/foliage.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { FOLIAGE_LOADER } from './exporter-templates.js'

const r4 = (v) => +v.toFixed(4)

/** Geometría del tipo como arrays listos para GLB. */
function foliageGeometry(cfg) {
  let geo
  if (cfg.source === 'builtin') geo = mergeGeometries(BUILTIN_FOLIAGE[cfg.builtin].build(), false)
  else geo = null
  return geo
}
function toGlbArrays(geo, withUv = false) {
  const g = geo.index ? geo : geo.clone()
  const pos = g.attributes.position.array, nor = g.attributes.normal.array
  const idx = g.index ? Uint32Array.from(g.index.array) : Uint32Array.from({ length: pos.length / 3 }, (_, i) => i)
  return { positions: Float32Array.from(pos), normals: Float32Array.from(nor), colors: g.attributes.color ? Float32Array.from(g.attributes.color.array) : undefined, uvs: withUv && g.attributes.uv ? Float32Array.from(g.attributes.uv.array) : undefined, indices: idx }
}

/** Hornea los colores de vértice en una paleta-textura (UV por vértice): Godot la muestrea sin ambigüedad de espacio de color. */
function bakePalette(arrays) {
  const { colors, positions } = arrays
  const n = positions.length / 3
  const keys = new Map(), list = [], ids = new Uint32Array(n)
  const S = 4
  for (let i = 0; i < n; i++) {
    const r = colors ? colors[i * 3] : 1, g = colors ? colors[i * 3 + 1] : 1, b = colors ? colors[i * 3 + 2] : 1
    const k = `${r.toFixed(4)},${g.toFixed(4)},${b.toFixed(4)}`
    let idx = keys.get(k)
    if (idx === undefined) { idx = list.length; keys.set(k, idx); list.push([r, g, b]) }
    ids[i] = idx
  }
  const total = list.length
  const w = total * S, h = S
  const rgba = new Uint8Array(w * h * 4)
  const enc = (v) => { const c = Math.min(1, Math.max(0, v)); return Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255) }
  list.forEach((c, i) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < S; x++) { const o = (y * w + i * S + x) * 4; rgba[o] = enc(c[0]); rgba[o + 1] = enc(c[1]); rgba[o + 2] = enc(c[2]); rgba[o + 3] = 255 }
  })
  const uvs = new Float32Array(n * 2)
  for (let i = 0; i < n; i++) { uvs[i * 2] = (ids[i] * S + S / 2) / w; uvs[i * 2 + 1] = 0.5 }
  return { arrays: { positions, normals: arrays.normals, indices: arrays.indices, uvs }, png: encodePngRGBA(w, h, rgba) }
}

export function exportFoliage({ terrain, models, modelFile, files, resDir, textures }) {
  const out = { types: [], total: 0 }
  const fol = terrain.foliage
  if (!fol || terrain.enabled === false) return out
  const used = new Set()
  const m = new THREE.Matrix4(), piv = new THREE.Matrix4()
  for (const id of fol.types.keys()) {
    const d = fol.exportData(id)
    if (!d || !d.count) continue
    const cfg = d.cfg
    let scene = null, pivot = [0, 0, 0]
    const base = slug(cfg.name || 'vegetacion', 'vegetacion')
    let f = base, n = 2
    while (used.has(f)) f = `${base}_${n++}`
    used.add(f)
    const tint = new THREE.Color(cfg.color)
    const factor = [tint.r, tint.g, tint.b, 1]
    if (cfg.source === 'builtin' && BUILTIN_FOLIAGE[cfg.builtin]) {
      const geo = foliageGeometry(cfg)
      const pal = bakePalette(toGlbArrays(geo))
      files.set(`foliage/${f}.glb`, buildMeshGLB({ name: cfg.name || f, ...pal.arrays, imagePng: pal.png, material: { name: f, color: factor, roughness: 0.9, doubleSided: true } }))
      scene = `${resDir}foliage/${f}.glb`
    } else if (cfg.source === 'texture') {
      const img = textures.get(cfg.texture)
      if (!img) continue
      const geo = crossedQuads(img.width / Math.max(1, img.height))
      files.set(`foliage/${f}.glb`, buildMeshGLB({ name: cfg.name || f, ...toGlbArrays(geo, true), imagePng: img.bytes, material: { name: f, color: factor, roughness: 1, doubleSided: true, mimeType: img.mime || 'image/png' } }))
      scene = `${resDir}foliage/${f}.glb`
    } else if (cfg.source === 'model') {
      const rel = modelFile(cfg.modelId)
      if (!rel) continue
      scene = `${resDir}${rel}`
      const ms = Foliage.modelLookup?.(cfg.modelId)
      pivot = ms ? modelPivot(ms) : [0, 0, 0]
    } else continue
    piv.makeTranslation(...pivot) // los modelos se colocan con la base centrada, igual que en el editor
    const tr = new Array(d.count * 12)
    for (let i = 0; i < d.count; i++) {
      const o = i * 4
      composeInstance(terrain, cfg, d.data[o], d.data[o + 1], d.data[o + 2], d.data[o + 3], m)
      if (cfg.source === 'model') m.multiply(piv)
      const e = m.elements
      const k = i * 12
      tr[k] = r4(e[0]); tr[k + 1] = r4(e[1]); tr[k + 2] = r4(e[2])
      tr[k + 3] = r4(e[4]); tr[k + 4] = r4(e[5]); tr[k + 5] = r4(e[6])
      tr[k + 6] = r4(e[8]); tr[k + 7] = r4(e[9]); tr[k + 8] = r4(e[10])
      tr[k + 9] = r4(e[12]); tr[k + 10] = r4(e[13]); tr[k + 11] = r4(e[14])
    }
    out.types.push({ name: cfg.name || f, scene, count: d.count, shadows: !!cfg.castShadow, vertex_colors: false, tint: cfg.color, transforms: tr })
    out.total += d.count
  }
  if (out.types.length) {
    files.set('foliage/foliage.json', JSON.stringify({ generator: 'Century', types: out.types }))
    files.set('foliage/foliage_loader.gd', FOLIAGE_LOADER(`${resDir}foliage/foliage.json`))
  }
  return out
}
