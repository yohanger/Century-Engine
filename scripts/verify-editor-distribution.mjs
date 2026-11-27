// LF-EDITOR-DISTRIBUTION-LINUX-WINDOWS-G001
// Valida el empaquetado del editor sin confundirlo con el AppImage que exporta juegos.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const defaultRoot = path.resolve(here, '..')
const requiredRenderer = [
  'dist/index.html', 'dist/filmmaker.html', 'dist-runtime/runtime.html',
  'dist/three-decoders/basis/basis_transcoder.wasm',
  'dist/three-decoders/draco/draco_decoder.wasm',
  'dist-runtime/three-decoders/basis/basis_transcoder.wasm',
  'dist-runtime/three-decoders/draco/draco_decoder.wasm',
]

/** Errores verificables; no atribuye un PASS a binarios que todavía no existen. */
export function verifyEditorDistribution(root = defaultRoot, mode = 'source') {
  const errors = []
  const exists = (relative) => fs.existsSync(path.join(root, relative))
  const mustExist = (relative) => {
    if (!exists(relative)) errors.push(`Falta ${relative}`)
  }
  const read = (relative) => fs.readFileSync(path.join(root, relative))
  const config = JSON.parse(read('package.json'))
  const builder = config.build || {}
  const version = config.version
  const targets = (platform) => (builder[platform]?.target || []).map((t) => typeof t === 'string' ? t : t.target)

  if (config.main !== 'electron/main.cjs') errors.push('La entrada principal no es electron/main.cjs')
  if (builder.appId !== 'com.levelforge.editor') errors.push('El identificador del Editor cambió')
  if (builder.asar !== true) errors.push('El paquete del Editor debe usar ASAR')
  for (const target of ['AppImage', 'deb']) if (!targets('linux').includes(target)) errors.push(`Falta Linux ${target}`)
  for (const target of ['nsis', 'portable']) if (!targets('win').includes(target)) errors.push(`Falta Windows ${target}`)
  for (const name of ['dist/**/*', 'dist-runtime/**/*', 'electron/**/*']) if (!(builder.files || []).includes(name)) errors.push(`No se empaqueta ${name}`)
  if (builder.publish?.length) errors.push('No se permiten servidores de actualización ficticios')
  if (!/electron-builder.*--linux AppImage deb.*--x64/.test(config.scripts?.['dist:linux:package'] || '')) errors.push('Falta el comando Linux x64')
  if (!/electron-builder.*--win nsis portable.*--x64/.test(config.scripts?.['dist:win:package'] || '')) errors.push('Falta el comando Windows x64')
  if (builder.nsis?.artifactName === builder.portable?.artifactName) errors.push('Setup y Portable no pueden tener el mismo nombre')
  if (builder.win?.icon !== 'build/icon.ico') errors.push('Falta configurar el icono Windows ICO')
  if (builder.linux?.icon !== 'build/icons') errors.push('Falta configurar el icono Linux')
  for (const relative of ['electron/main.cjs', 'electron/preload.cjs', 'electron/runtime/main.cjs', 'electron/appimage.cjs']) mustExist(relative)
  // La mera existencia y los cuatro bytes de firma no bastan: se valida cada tamaño,
  // la cabecera IHDR y la estructura real del ICO antes de iniciar electron-builder.
  const pngDimensions = (png, expectedSize, label) => {
    if (png.length < 57 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
      png.readUInt32BE(8) !== 13 || png.toString('ascii', 12, 16) !== 'IHDR' ||
      png.readUInt32BE(16) !== expectedSize || png.readUInt32BE(20) !== expectedSize ||
      png[24] !== 8 || png[25] !== 6 ||
      png.readUInt32BE(png.length - 12) !== 0 ||
      png.toString('ascii', png.length - 8, png.length - 4) !== 'IEND' ||
      png.readUInt32BE(29) !== (zlib.crc32(png.subarray(12, 29)) >>> 0)) {
      errors.push(`${label}: PNG RGBA inválido o dimensiones incorrectas (${expectedSize}x${expectedSize})`)
      return false
    }
    // Carga el IDAT: detecta archivos truncados aunque tengan cabecera e IEND correctos.
    try {
      let cursor = 8
      const idat = []
      while (cursor + 12 <= png.length) {
        const len = png.readUInt32BE(cursor)
        if (cursor + len + 12 > png.length) throw new Error('Chunk truncado')
        const tag = png.toString('ascii', cursor + 4, cursor + 8)
        const data = png.subarray(cursor + 8, cursor + 8 + len)
        const crc = zlib.crc32(png.subarray(cursor + 4, cursor + 8 + len)) >>> 0
        if (crc !== png.readUInt32BE(cursor + 8 + len)) throw new Error('CRC incorrecto')
        if (tag === 'IDAT') idat.push(data)
        cursor += len + 12
        if (tag === 'IEND') break
      }
      const uncompressed = zlib.inflateSync(Buffer.concat(idat))
      if (uncompressed.length !== expectedSize * (expectedSize * 4 + 1)) throw new Error('Raster RGBA incompleto')
    } catch {
      errors.push(`${label}: PNG corrupto o incompleto`)
      return false
    }
    return true
  }
  const sizes = [16, 24, 32, 48, 64, 96, 128, 256, 512]
  for (const size of sizes) {
    const rel = `build/icons/${size}x${size}.png`
    mustExist(rel)
    if (exists(rel)) pngDimensions(read(rel), size, rel)
  }
  mustExist('build/icon.png')
  if (exists('build/icon.png')) pngDimensions(read('build/icon.png'), 512, 'build/icon.png')
  mustExist('build/icon.ico')
  if (exists('build/icon.ico')) {
    const ico = read('build/icon.ico')
    const icoSizes = [16, 24, 32, 48, 64, 128, 256]
    if (ico.length < 6 + icoSizes.length * 16 || ico.readUInt16LE(0) !== 0 ||
      ico.readUInt16LE(2) !== 1 || ico.readUInt16LE(4) !== icoSizes.length) {
      errors.push('build/icon.ico: ICO inválido o faltan tamaños múltiples')
    } else {
      for (let i = 0; i < icoSizes.length; i++) {
        const at = 6 + i * 16, size = icoSizes[i]
        const embeddedSize = ico[at] || 256, embeddedHeight = ico[at + 1] || 256
        const bytes = ico.readUInt32LE(at + 8), offset = ico.readUInt32LE(at + 12)
        if (embeddedSize !== size || embeddedHeight !== size || bytes < 57 ||
          offset < 6 + icoSizes.length * 16 || offset + bytes > ico.length) {
          errors.push(`build/icon.ico: entrada ${size}x${size} inválida`)
          continue
        }
        pngDimensions(ico.subarray(offset, offset + bytes), size, `build/icon.ico (${size}x${size})`)
      }
    }
  }
  if (mode === 'source') return errors

  // La salida de Vite contiene el Editor, su Runtime autónomo y decodificadores sin depender de una CDN.
  for (const relative of requiredRenderer) mustExist(relative)
  if (mode === 'preflight') return errors

  const magic = (relative, expected) => {
    mustExist(relative)
    if (!exists(relative)) return
    const info = fs.statSync(path.join(root, relative))
    if (!info.isFile() || info.size < 1024 * 1024) errors.push(`${relative}: artefacto demasiado pequeño`)
    else {
      // No cargar instaladores de cientos de MB en la memoria del Editor o del runner.
      const fd = fs.openSync(path.join(root, relative), 'r')
      const header = Buffer.alloc(expected.length)
      try { fs.readSync(fd, header, 0, header.length, 0) } finally { fs.closeSync(fd) }
      if (!header.equals(expected)) errors.push(`${relative}: cabecera inválida`)
    }
  }
  if (mode === 'linux') {
    magic(`release/Century-${version}-linux-x86_64.AppImage`, Buffer.from('7f454c46', 'hex'))
    magic(`release/Century-${version}-linux-x86_64.deb`, Buffer.from('213c617263683e0a', 'hex'))
  } else if (mode === 'win') {
    magic(`release/Century-Setup-${version}-win-x64.exe`, Buffer.from('4d5a', 'hex'))
    magic(`release/Century-Portable-${version}-win-x64.exe`, Buffer.from('4d5a', 'hex'))
  } else errors.push(`Modo desconocido: ${mode}`)
  return errors
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] || 'source'
  const errors = verifyEditorDistribution(defaultRoot, mode)
  if (errors.length) {
    for (const err of errors) console.error('ERROR:', err)
    process.exitCode = 1
  } else console.log(`Distribución Century (${mode}): estructura verificada. ${mode === 'source' ? 'Sin comprobar binarios.' : mode === 'preflight' ? 'Sin comprobar instaladores.' : 'Artefactos presentes con cabeceras válidas; falta QA de ejecución.'}`)
}
