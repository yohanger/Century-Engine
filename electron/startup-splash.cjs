const fs = require('node:fs')

const MAX_BITMAP = 16 * 1024 * 1024
const PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

function splashMime(bytes) {
  if (bytes.length < 12 || bytes.length > MAX_BITMAP) return ''
  if (bytes.subarray(0, 8).equals(PNG_MAGIC)) return 'image/png'
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg'
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return ''
}

function splashDataUrl(file) {
  const stat = fs.statSync(file)
  if (!stat.isFile() || stat.size > MAX_BITMAP) throw new Error('La imagen del splash debe pesar como máximo 16 MiB.')
  const bytes = fs.readFileSync(file)
  const mime = splashMime(bytes)
  if (!mime) throw new Error('El splash admite imágenes PNG, JPEG o WebP.')
  return `data:${mime};base64,${bytes.toString('base64')}`
}

module.exports = { splashDataUrl, splashMime }
