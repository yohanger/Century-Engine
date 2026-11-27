// Exportador de juegos a AppImage (Linux). Sin herramientas externas:
//   AppImage = runtime (ELF, electron/vendor/appimage-runtime-x86_64) + imagen SquashFS (electron/squashfs.cjs)
// El contenido es un Electron completo (el mismo que ejecuta el editor) con `resources/app` = Runtime + juego:
//   main.cjs + preload.cjs (electron/runtime) · dist/ (motor compilado, runtime.html) · game.rtpkg (el paquete del juego) · config.json
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const sq = require('./squashfs.cjs')

const RUNTIME = path.join(__dirname, 'vendor', 'appimage-runtime-x86_64')
const DEFAULT_ICON = path.join(__dirname, 'vendor', 'icon.png')

const slugOf = (s) => String(s || 'juego').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'juego'

/** Recorre una carpeta del disco añadiendo sus archivos al árbol (streaming desde disco, no se cargan en memoria). */
function addTree(root, srcDir, destDir, { skip = () => false, rename = (rel) => rel, inMemory = false } = {}) {
  const walk = (rel) => {
    for (const d of fs.readdirSync(path.join(srcDir, rel), { withFileTypes: true })) {
      const r = rel ? rel + '/' + d.name : d.name
      if (skip(r, d)) continue
      const full = path.join(srcDir, r)
      const dest = (destDir ? destDir + '/' : '') + rename(r)
      if (d.isDirectory()) { sq.addDir(root, dest); walk(r) }
      else if (d.isSymbolicLink()) sq.addSymlink(root, dest, fs.readlinkSync(full))
      else if (d.isFile()) {
        const mode = fs.statSync(full).mode & 0o777
        if (inMemory) sq.addFile(root, dest, { data: fs.readFileSync(full), mode })
        else sq.addFile(root, dest, { path: full, mode })
      }
    }
  }
  walk('')
}

/**
 * @param o.outPath     archivo .AppImage de salida
 * @param o.name        nombre del juego (título)
 * @param o.version     versión
 * @param o.gameBytes   contenido de game.lfproj (Buffer/Uint8Array)
 * @param o.icon        PNG del icono (Buffer) o null = el de Century
 * @param o.window      'fullscreen' | 'maximized' | 'window' (+ width, height)
 * @param o.distDir     carpeta dist-runtime/ (npm run build): solo el Runtime autónomo, debe contener runtime.html
 * @param o.runtimeDir  carpeta del Electron a copiar (por defecto la del proceso actual)
 * @param o.onProgress  ({ phase, done, total })
 */
async function exportAppImage(o) {
  if (process.platform !== 'linux') throw new Error('La exportación a AppImage solo funciona en Linux')
  if (process.arch !== 'x64') throw new Error('De momento solo se genera AppImage x86_64 (este equipo es ' + process.arch + ')')
  const distDir = o.distDir
  if (!distDir || !fs.existsSync(path.join(distDir, 'runtime.html'))) throw new Error('Falta dist-runtime/runtime.html: ejecuta «npm run build» antes de exportar')
  const runtimeDir = o.runtimeDir || path.dirname(process.execPath)
  const exeName = o.runtimeExe || path.basename(process.execPath)
  if (!fs.existsSync(path.join(runtimeDir, exeName))) throw new Error('No se encuentra el runtime de Electron en ' + runtimeDir)
  const progress = o.onProgress || (() => {})

  const title = String(o.name || 'Juego')
  const splash = o.splash
  if (splash && !require('./startup-splash.cjs').splashMime(splash)) throw new Error('El splash del juego debe ser PNG, JPEG o WebP y pesar como máximo 16 MiB.')
  const exec = slugOf(title)
  const root = sq.dir()

  progress({ phase: 'Preparando archivos…', done: 0, total: 1 })
  // 1) runtime de Electron (sin la app del editor)
  addTree(root, runtimeDir, '', {
    skip: (rel) => {
      if (rel === 'AppRun' || rel === '.DirIcon' || rel === 'usr/share') return true
      if (!rel.includes('/') && /\.(desktop|png|svg)$/i.test(rel)) return true
      if (rel === 'resources/app' || rel === 'resources/app.asar' || rel === 'resources/app.asar.unpacked' || rel === 'resources/default_app.asar') return true
      return false
    },
    rename: (rel) => (rel === exeName ? exec : rel),
  })
  // 2) el juego
  const app = 'resources/app'
  const cfg = { title, version: o.version || '1.0.0', window: o.window || 'fullscreen', width: o.width || 1280, height: o.height || 720 }
  const diagnostics = { devtools: o.diagnostics?.devtools === true, stats: o.diagnostics?.stats === true }
  if (diagnostics.devtools || diagnostics.stats) cfg.diagnostics = diagnostics
  if (splash) cfg.splash = true
  if (o.streaming) cfg.streaming = true
  sq.addFile(root, `${app}/package.json`, { data: Buffer.from(JSON.stringify({ name: exec, productName: title, version: cfg.version, main: 'main.cjs' }, null, 2)) })
  sq.addFile(root, `${app}/main.cjs`, { data: fs.readFileSync(path.join(__dirname, 'runtime', 'main.cjs')) })
  sq.addFile(root, `${app}/preload.cjs`, { data: fs.readFileSync(path.join(__dirname, 'runtime', 'preload.cjs')) })
  sq.addFile(root, `${app}/config.json`, { data: Buffer.from(JSON.stringify(cfg, null, 2)) })
  sq.addFile(root, `${app}/saves.cjs`, { data: fs.readFileSync(path.join(__dirname, 'runtime', 'saves.cjs')) })
  if (splash) {
    sq.addFile(root, `${app}/startup-splash.cjs`, { data: fs.readFileSync(path.join(__dirname, 'startup-splash.cjs')) })
    sq.addFile(root, `${app}/splash.image`, { data: splash })
  }
  if (!o.streaming) sq.addFile(root, `${app}/game.rtpkg`, { data: Buffer.from(o.gameBytes) })
  // dist-runtime puede estar dentro de un .asar: se lee con readFileSync. Solo lleva el reproductor (sin editor, Film Maker ni MediaPipe).
  addTree(root, distDir, `${app}/dist`, { inMemory: true })
  // 3) lanzador, icono y entrada de escritorio
  const hasUsrLib = (() => { try { return fs.statSync(path.join(runtimeDir, 'usr', 'lib')).isDirectory() } catch { return false } })()
  const appRun = `#!/bin/sh\nHERE="$(dirname "$(readlink -f "$0")")"\n${hasUsrLib ? 'export LD_LIBRARY_PATH="$HERE/usr/lib:$LD_LIBRARY_PATH"\n' : ''}if [ "$GAME_SANDBOX" = "1" ]; then exec "$HERE/${exec}" "$@"; fi\nexec "$HERE/${exec}" --no-sandbox "$@"\n`
  sq.addFile(root, 'AppRun', { data: Buffer.from(appRun), mode: 0o755 })
  const icon = o.icon && o.icon.length ? Buffer.from(o.icon) : fs.readFileSync(DEFAULT_ICON)
  sq.addFile(root, `${exec}.png`, { data: icon })
  sq.addSymlink(root, '.DirIcon', `${exec}.png`)
  const desktop = `[Desktop Entry]\nType=Application\nName=${title.replace(/[\r\n]/g, ' ')}\nExec=${exec} %U\nIcon=${exec}\nCategories=Game;\nTerminal=false\nX-AppImage-Version=${cfg.version}\n`
  sq.addFile(root, `${exec}.desktop`, { data: Buffer.from(desktop) })

  // 4) imagen
  const out = o.outPath
  const tmp = out + '.part'
  const writeImage = () => sq.writeSquashfs(root, tmp, {
    prefix: fs.readFileSync(RUNTIME),
    level: o.level || 6,
    onProgress: (done, total) => progress({ phase: 'Comprimiendo…', done, total }),
  })
  const r = o.streaming
    ? await require('./stream-package.cjs').stageEntries(o.gameBytes,
      (name, source) => sq.addFile(root, `${app}/game-data/${name}`, { path: source }), writeImage)
    : await writeImage()
  fs.chmodSync(tmp, 0o755)
  fs.renameSync(tmp, out)
  progress({ phase: 'Listo', done: 1, total: 1 })
  return { path: out, size: r.size, exec }
}

module.exports = { exportAppImage, slugOf }
