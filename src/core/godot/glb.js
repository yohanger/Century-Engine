import { parseOBJ } from '../../engine/runtime/geometry/objconv.js'
// Escritor mínimo de GLB (glTF 2.0 binario) para un mesh con posiciones, normales, índices y,
// opcionalmente, colores por vértice. Sin dependencias del DOM: funciona igual en el navegador y en Node.

function pad4(n) { return (n + 3) & ~3 }

/**
 * @param positions Float32Array xyz   @param normals Float32Array xyz   @param indices Uint32Array
 * @param colors    Float32Array rgb (opcional; si existe se escribe COLOR_0)
 * @param uvs       Float32Array uv (opcional)   @param imagePng Uint8Array PNG/JPEG (opcional; baseColorTexture con alfa recortado)
 * @param material  { name, color:[r,g,b,a], roughness, metallic, doubleSided } (opcional)
 */
export function buildMeshGLB({ name = 'Mesh', positions, normals, colors, indices, roughness = 0.95, material, uvs, imagePng }) {
  const parts = [
    new Uint8Array(indices.buffer, indices.byteOffset, indices.byteLength),
    new Uint8Array(positions.buffer, positions.byteOffset, positions.byteLength),
    new Uint8Array(normals.buffer, normals.byteOffset, normals.byteLength),
  ]
  const slot = {}
  if (colors) { slot.colors = parts.length; parts.push(new Uint8Array(colors.buffer, colors.byteOffset, colors.byteLength)) }
  if (uvs) { slot.uvs = parts.length; parts.push(new Uint8Array(uvs.buffer, uvs.byteOffset, uvs.byteLength)) }
  if (imagePng) { slot.img = parts.length; parts.push(imagePng) }

  const offsets = []
  let total = 0
  for (const p of parts) { offsets.push(total); total += pad4(p.byteLength) }
  const bin = new Uint8Array(total)
  parts.forEach((p, i) => bin.set(p, offsets[i]))

  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = positions[i + k]
      if (v < min[k]) min[k] = v
      if (v > max[k]) max[k] = v
    }
  }
  const vcount = positions.length / 3

  const attributes = { POSITION: 1, NORMAL: 2 }
  const bufferViews = parts.map((p, i) => ({ buffer: 0, byteOffset: offsets[i], byteLength: p.byteLength, ...(i === slot.img ? {} : { target: i === 0 ? 34963 : 34962 }) }))
  const accessors = [
    { bufferView: 0, componentType: 5125, count: indices.length, type: 'SCALAR' },
    { bufferView: 1, componentType: 5126, count: vcount, type: 'VEC3', min, max },
    { bufferView: 2, componentType: 5126, count: vcount, type: 'VEC3' },
  ]
  if (colors) { accessors.push({ bufferView: slot.colors, componentType: 5126, count: vcount, type: 'VEC3' }); attributes.COLOR_0 = accessors.length - 1 }
  if (uvs) { accessors.push({ bufferView: slot.uvs, componentType: 5126, count: vcount, type: 'VEC2' }); attributes.TEXCOORD_0 = accessors.length - 1 }

  const mat = material
    ? { name: material.name || 'Material', pbrMetallicRoughness: { baseColorFactor: material.color || [1, 1, 1, 1], metallicFactor: material.metallic ?? 0, roughnessFactor: material.roughness ?? 0.8 }, ...((material.color?.[3] ?? 1) < 1 ? { alphaMode: 'BLEND' } : {}), ...(material.doubleSided ? { doubleSided: true } : {}) }
    : { name: 'TerrainMaterial', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: roughness } }

  let usesEmissive = false
  if (material?.emissive) {
    // glTF limita emissiveFactor a [0,1]; la energía extra va en KHR_materials_emissive_strength (Godot → emission_energy_multiplier)
    mat.emissiveFactor = material.emissive
    if ((material.emissiveStrength ?? 1) !== 1) { mat.extensions = { KHR_materials_emissive_strength: { emissiveStrength: material.emissiveStrength } }; usesEmissive = true }
  }
  if (imagePng) {
    mat.pbrMetallicRoughness.baseColorTexture = { index: 0 }
    mat.alphaMode = 'MASK'
    mat.alphaCutoff = 0.5
    mat.doubleSided = true
  }

  const json = {
    asset: { version: '2.0', generator: 'Century' },
    ...(usesEmissive ? { extensionsUsed: ['KHR_materials_emissive_strength'] } : {}),
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name, mesh: 0 }],
    meshes: [{ name, primitives: [{ attributes, indices: 0, material: 0, mode: 4 }] }],
    materials: [mat],
    buffers: [{ byteLength: total }],
    bufferViews,
    accessors,
    ...(imagePng ? { images: [{ bufferView: slot.img, mimeType: material?.mimeType || 'image/png' }], textures: [{ source: 0 }] } : {}),
  }

  const enc = new TextEncoder()
  const jsonBytes = enc.encode(JSON.stringify(json))
  const jsonPadded = new Uint8Array(pad4(jsonBytes.length)).fill(0x20)
  jsonPadded.set(jsonBytes)

  const length = 12 + 8 + jsonPadded.length + 8 + bin.length
  const out = new Uint8Array(length)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, 0x46546c67, true) // 'glTF'
  dv.setUint32(4, 2, true)
  dv.setUint32(8, length, true)
  dv.setUint32(12, jsonPadded.length, true)
  dv.setUint32(16, 0x4e4f534a, true) // 'JSON'
  out.set(jsonPadded, 20)
  const binStart = 20 + jsonPadded.length
  dv.setUint32(binStart, bin.length, true)
  dv.setUint32(binStart + 4, 0x004e4942, true) // 'BIN\0'
  out.set(bin, binStart + 8)
  return out
}

// ---------------------------------------------------------------------------------------------
// PNG mínimo (sin compresión) para paletas de color
// ---------------------------------------------------------------------------------------------
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })()
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
function adler32(b) { let a = 1, c = 0; for (let i = 0; i < b.length; i++) { a = (a + b[i]) % 65521; c = (c + a) % 65521 } return ((c << 16) | a) >>> 0 }

/** Codifica píxeles RGBA8 (w·h·4) como PNG con bloques deflate "stored". */
export function encodePngRGBA(w, h, rgba) {
  const raw = new Uint8Array((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1) }
  const blocks = []
  for (let o = 0; o < raw.length; o += 65535) {
    const len = Math.min(65535, raw.length - o)
    const hdr = new Uint8Array([o + len >= raw.length ? 1 : 0, len & 255, len >> 8, ~len & 255, (~len >> 8) & 255])
    blocks.push(hdr, raw.subarray(o, o + len))
  }
  const ad = adler32(raw)
  const z = [new Uint8Array([0x78, 0x01]), ...blocks, new Uint8Array([ad >>> 24, (ad >>> 16) & 255, (ad >>> 8) & 255, ad & 255])]
  const zlen = z.reduce((a, b) => a + b.length, 0), zb = new Uint8Array(zlen)
  let zo = 0; for (const b of z) { zb.set(b, zo); zo += b.length }
  const chunk = (type, data) => {
    const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer)
    dv.setUint32(0, data.length)
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
    out.set(data, 8)
    dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
    return out
  }
  const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer)
  dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 6
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zb), chunk('IEND', new Uint8Array(0))]
  const out = new Uint8Array(parts.reduce((a, b) => a + b.length, 0)); let o = 0
  for (const b of parts) { out.set(b, o); o += b.length }
  return out
}

/** OBJ → bytes de un .glb (material gris neutro; Godot lo importa como escena). */
export function objToGlb(input, name = 'Model') {
  const m = parseOBJ(input)
  return buildMeshGLB({ name, positions: m.positions, normals: m.normals, indices: m.indices, material: { name: 'Material', color: [0.8, 0.8, 0.8, 1], roughness: 0.8, metallic: 0 } })
}
