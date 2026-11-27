// Generador único del rombo visual existente de Century.
// Sin argumentos: conserva el comportamiento original (icono por defecto de los juegos exportados).
// --distribution: crea los recursos reales de electron-builder para el Editor Linux/Windows.
// No requiere ImageMagick, Pillow ni dependencias npm: es reproducible desde SOURCE_BASELINE.
import zlib from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PNG_HEADER = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const PNG_SIZES = [16, 24, 32, 48, 64, 96, 128, 256, 512]
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
const inDiamond = (x, y, r) => Math.abs(x - 0.5) + Math.abs(y - 0.5) <= r

function pngChunk(type, data) {
  const result = Buffer.alloc(12 + data.length)
  result.writeUInt32BE(data.length, 0)
  result.write(type, 4)
  data.copy(result, 8)
  result.writeUInt32BE(zlib.crc32(result.subarray(4, 8 + data.length)) >>> 0, 8 + data.length)
  return result
}

/** Dibuja el mismo rombo del Editor en cualquier resolución, sin escalar un PNG de 256 px. */
export function renderCenturyIcon(size) {
  if (!Number.isInteger(size) || size < 16 || size > 512) throw new RangeError('Tamaño de icono no válido')
  const raw = Buffer.alloc(size * (size * 4 + 1))
  const samples = 3
  for (let j = 0; j < size; j++) {
    const scan = j * (size * 4 + 1)
    for (let i = 0; i < size; i++) {
      let outside = 0, center = 0
      for (let sy = 0; sy < samples; sy++) for (let sx = 0; sx < samples; sx++) {
        const x = (i + (sx + 0.5) / samples) / size
        const y = (j + (sy + 0.5) / samples) / size
        if (inDiamond(x, y, 0.46)) {
          outside++
          if (inDiamond(x, y, 0.2)) center++
        }
      }
      const r = outside ? center / outside : 0
      const p = scan + 1 + i * 4
      raw[p] = Math.round(0x47 * (1 - r) + 0x0d * r)
      raw[p + 1] = Math.round(0x8c * (1 - r) + 0x0d * r)
      raw[p + 2] = Math.round(0xbf * (1 - r) + 0x0d * r)
      raw[p + 3] = Math.round(outside / (samples * samples) * 255)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // RGBA
  ihdr[9] = 6
  return Buffer.concat([
    PNG_HEADER,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

/** ICO válido para Windows 10+: siete imágenes PNG RGBA embebidas. */
export function encodeWindowsIcon(pngBySize, sizes = ICO_SIZES) {
  const header = Buffer.alloc(6 + sizes.length * 16)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(sizes.length, 4)
  const parts = [header]
  let offset = header.length
  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i]
    const png = pngBySize.get(size)
    if (!png) throw new Error(`Falta el PNG ${size}x${size} para ICO`)
    const at = 6 + i * 16
    header[at] = size === 256 ? 0 : size
    header[at + 1] = size === 256 ? 0 : size
    header[at + 2] = 0
    header[at + 3] = 0
    header.writeUInt16LE(1, at + 4) // color planes
    header.writeUInt16LE(32, at + 6) // bits per pixel
    header.writeUInt32LE(png.length, at + 8)
    header.writeUInt32LE(offset, at + 12)
    offset += png.length
    parts.push(png)
  }
  return Buffer.concat(parts)
}

export function generateDistributionIcons(targetRoot = root) {
  const bySize = new Map()
  const dir = path.join(targetRoot, 'build', 'icons')
  fs.mkdirSync(dir, { recursive: true })
  for (const size of PNG_SIZES) {
    const png = renderCenturyIcon(size)
    bySize.set(size, png)
    fs.writeFileSync(path.join(dir, `${size}x${size}.png`), png)
  }
  fs.writeFileSync(path.join(targetRoot, 'build', 'icon.png'), bySize.get(512))
  fs.writeFileSync(path.join(targetRoot, 'build', 'icon.ico'), encodeWindowsIcon(bySize))
  return { pngSizes: [...PNG_SIZES], icoSizes: [...ICO_SIZES] }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--distribution') {
    const result = generateDistributionIcons()
    console.log(`Iconos Editor Linux/Windows: ${result.pngSizes.length} PNG + ICO (${result.icoSizes.length} tamaños).`)
  } else if (process.argv.length === 2) {
    fs.mkdirSync(path.join(root, 'electron', 'vendor'), { recursive: true })
    fs.writeFileSync(path.join(root, 'electron', 'vendor', 'icon.png'), renderCenturyIcon(256))
    console.log('electron/vendor/icon.png listo')
  } else {
    console.error('Uso: node scripts/make-icon.mjs [--distribution]')
    process.exitCode = 2
  }
}
