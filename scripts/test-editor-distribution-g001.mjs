// LF-EDITOR-DISTRIBUTION-LINUX-WINDOWS-G001 — Contrato, portabilidad y verificación de binarios.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyEditorDistribution } from './verify-editor-distribution.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const get = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

// Fixture temporal de artefactos. No son ejecutables reales: valida solo el verificador de entrega.
function fixture(t) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lf-desktop-qa-'))
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }))
  fs.mkdirSync(path.join(tmp, 'build/icons'), { recursive: true })
  fs.mkdirSync(path.join(tmp, 'electron/runtime'), { recursive: true })
  fs.mkdirSync(path.join(tmp, 'dist/three-decoders/basis'), { recursive: true })
  fs.mkdirSync(path.join(tmp, 'dist/three-decoders/draco'), { recursive: true })
  fs.mkdirSync(path.join(tmp, 'dist-runtime/three-decoders/basis'), { recursive: true })
  fs.mkdirSync(path.join(tmp, 'dist-runtime/three-decoders/draco'), { recursive: true })
  fs.mkdirSync(path.join(tmp, 'release'), { recursive: true })
  for (const f of ['build/icon.png', 'build/icon.ico', ...[16,24,32,48,64,96,128,256,512].map(size => `build/icons/${size}x${size}.png`), 'electron/main.cjs', 'electron/preload.cjs', 'electron/runtime/main.cjs', 'electron/appimage.cjs']) {
    fs.copyFileSync(path.join(root, f), path.join(tmp, f))
  }
  fs.copyFileSync(path.join(root, 'package.json'), path.join(tmp, 'package.json'))
  for (const rel of [
    'dist/index.html', 'dist/filmmaker.html', 'dist-runtime/runtime.html',
    'dist/three-decoders/basis/basis_transcoder.wasm', 'dist/three-decoders/draco/draco_decoder.wasm',
    'dist-runtime/three-decoders/basis/basis_transcoder.wasm', 'dist-runtime/three-decoders/draco/draco_decoder.wasm',
  ]) fs.writeFileSync(path.join(tmp, rel), 'fixture')
  return tmp
}
function fakeArtifact(rootPath, rel, hex, size = 2 * 1024 * 1024) {
  const p = path.join(rootPath, 'release', rel), fd = fs.openSync(p, 'w')
  try { fs.writeSync(fd, Buffer.from(hex, 'hex')); fs.ftruncateSync(fd, size) }
  finally { fs.closeSync(fd) }
}
const version = pkg.version

test('DIST-01 SOURCE_BASELINE incorpora recursos de distribución íntegros', () => assert.deepEqual(verifyEditorDistribution(root, 'source'), []))
test('DIST-02 AppImage y DEB x86-64 están configurados', () => assert.deepEqual(pkg.build.linux.target, ['AppImage', 'deb']))
test('DIST-03 Windows incluye instalador NSIS y portable x64', () => assert.deepEqual(pkg.build.win.target, ['nsis', 'portable']))
test('DIST-04 no hay servidor ficticio de actualizaciones ni publicación automática', () => {
  assert.equal(pkg.build.publish, undefined)
  assert.match(pkg.scripts['dist:linux:package'], /--publish never/)
  assert.match(pkg.scripts['dist:win:package'], /--publish never/)
})
test('DIST-05 el instalador Windows permite seleccionar la carpeta', () => {
  assert.equal(pkg.build.nsis.oneClick, false)
  assert.equal(pkg.build.nsis.allowToChangeInstallationDirectory, true)
})
test('DIST-06 instalador y ejecutable portable no colisionan en nombres', () => assert.notEqual(pkg.build.nsis.artifactName, pkg.build.portable.artifactName))
test('DIST-07 iconos Linux y Windows correctos y multi-resolución', () => {
  const ico = fs.readFileSync(path.join(root, 'build/icon.ico'))
  assert.equal(ico.readUInt16LE(4), 7)
  for (const size of [16,24,32,48,64,96,128,256,512]) assert.ok(fs.statSync(path.join(root, `build/icons/${size}x${size}.png`)).size > 50)
})
test('DIST-08 ASAR incluye Editor, Runtime y Electron sin publicar código de desarrollo', () => {
  assert.equal(pkg.build.asar, true)
  assert.ok(pkg.build.files.includes('dist/**/*'))
  assert.ok(pkg.build.files.includes('dist-runtime/**/*'))
  assert.ok(pkg.build.files.includes('electron/**/*'))
  assert.equal(pkg.build.files.includes('src/**/*'), false)
})
test('DIST-09 no se modifican comandos de desarrollo ni exportación de juegos', () => {
  assert.equal(pkg.scripts.electron, 'node scripts/electron-start.mjs')
  assert.equal(pkg.scripts['filmmaker:dev'], 'node scripts/electron-dev.mjs --filmmaker')
  assert.match(get('electron/main.cjs'), /lf:exportAppImage/)
})
test('DIST-10 Vite usa base relativa para el protocolo file:// del Editor', () => {
  assert.match(get('vite.config.js'), /base:\s*['"]\.\/['"]/) 
  assert.match(get('electron/main.cjs'), /win\.loadFile\(index\)/)
})
test('DIST-11 proyecto .lfproj incorpora escenas y recursos por rutas relativas', () => {
  const lf = get('src/core/lfproj.js')
  assert.match(lf, /const entryPath\s*=\s*\(e\)\s*=>\s*`\$\{e.folder\}\/\$\{e.file\}`/)
  assert.match(lf, /zip\.file\('project.json'/)
  assert.match(lf, /zip\.file\(entryPath\(e\)/)
})
test('DIST-12 la carpeta del proyecto se solicita en cada sistema mediante diálogo nativo', () => {
  assert.match(get('electron/main.cjs'), /dialog\.showOpenDialog/)
  assert.match(get('src/core/state/project.js'), /openFromFolder\(loc\)/)
  assert.match(get('src/core/state/project.js'), /'project\.lfproj'/)
})
test('DIST-13 la escritura en disco utiliza ruta relativa y guardado atómico', () => {
  const electron = get('electron/main.cjs')
  assert.match(electron, /resolveIn\(root, f\.path\)/)
  assert.match(electron, /\.lftmp/)
  assert.match(electron, /fs\.renameSync\(tmp, full\)/)
})
test('DIST-14 los recursos de Three.js son locales para Editor y Runtime', () => {
  const vite = get('vite.config.js')
  assert.match(vite, /three-decoders\/\$\{folder\}/)
  assert.match(vite, /threeDecoderAssets\(\)/)
})
test('DIST-15 la build Linux no se confunde con el AppImage de juego', () => {
  assert.match(pkg.scripts['dist:linux'], /dist:linux:package/)
  assert.match(get('electron/appimage.cjs'), /game\.rtpkg/)
  assert.match(get('electron/main.cjs'), /dist-runtime/)
})
test('DIST-16 existe workflow Linux y Windows con artefactos diferenciados', () => {
  const workflow = get('.github/workflows/desktop-build.yml')
  assert.match(workflow, /ubuntu-24\.04/)
  assert.match(workflow, /windows-2022/)
  assert.match(workflow, /actions\/upload-artifact@v4/)
  assert.match(workflow, /workflow_dispatch/)
})
test('DIST-17 preflight bloquea compilación sin las salidas Vite y sus WASM', (t) => {
  const tmp = fixture(t);fs.rmSync(path.join(tmp, 'dist-runtime/runtime.html'))
  assert.ok(verifyEditorDistribution(tmp, 'preflight').some(e => e.includes('dist-runtime/runtime.html')))
})
test('DIST-18 preflight acepta todos los recursos obligatorios en un fixture', (t) => assert.deepEqual(verifyEditorDistribution(fixture(t), 'preflight'), []))
test('DIST-19 validador comprueba cabeceras y nombres de AppImage y DEB', (t) => {
  const tmp = fixture(t)
  fakeArtifact(tmp, `LevelForge-${version}-linux-x86_64.AppImage`, '7f454c46')
  fakeArtifact(tmp, `LevelForge-${version}-linux-x86_64.deb`, '213c617263683e0a')
  assert.deepEqual(verifyEditorDistribution(tmp, 'linux'), [])
})
test('DIST-20 validador rechaza DEB cuya cabecera no es ar', (t) => {
  const tmp = fixture(t)
  fakeArtifact(tmp, `LevelForge-${version}-linux-x86_64.AppImage`, '7f454c46')
  fakeArtifact(tmp, `LevelForge-${version}-linux-x86_64.deb`, '00000000')
  assert.ok(verifyEditorDistribution(tmp, 'linux').some(e=>e.includes('cabecera inválida')))
})
test('DIST-21 validador comprueba cabeceras y nombres de los dos ejecutables Windows', (t) => {
  const tmp = fixture(t)
  fakeArtifact(tmp, `LevelForge-Setup-${version}-win-x64.exe`, '4d5a')
  fakeArtifact(tmp, `LevelForge-Portable-${version}-win-x64.exe`, '4d5a')
  assert.deepEqual(verifyEditorDistribution(tmp, 'win'), [])
})
test('DIST-22 validador detecta ejecutable portable ausente', (t) => {
  const tmp = fixture(t)
  fakeArtifact(tmp, `LevelForge-Setup-${version}-win-x64.exe`, '4d5a')
  assert.ok(verifyEditorDistribution(tmp, 'win').some(e=>e.includes('Portable')))
})
test('DIST-23 validador rechaza binarios demasiado pequeños', (t) => {
  const tmp = fixture(t)
  fakeArtifact(tmp, `LevelForge-Setup-${version}-win-x64.exe`, '4d5a', 256)
  fakeArtifact(tmp, `LevelForge-Portable-${version}-win-x64.exe`, '4d5a', 256)
  assert.ok(verifyEditorDistribution(tmp, 'win').filter(e=>e.includes('demasiado pequeño')).length===2)
})
test('DIST-24 se conserva el Runtime exportable como bundle separado', () => {
  assert.match(get('vite.config.js'), /outDir:\s*'dist-runtime'/)
  assert.match(get('electron/appimage.cjs'), /addTree\(root, distDir/)
})

// LF-EDITOR-DISTRIBUTION-CORR-001: pruebas contra recursos reales y falsos positivos.
test('DIST-CORR-01 las nueve dimensiones PNG y los siete fotogramas del ICO son auténticos', () => {
  for (const size of [16,24,32,48,64,96,128,256,512]) {
    const png = fs.readFileSync(path.join(root, `build/icons/${size}x${size}.png`))
    assert.equal(png.readUInt32BE(16), size)
    assert.equal(png.readUInt32BE(20), size)
  }
  const ico = fs.readFileSync(path.join(root, 'build/icon.ico'))
  assert.equal(ico.readUInt16LE(4), 7)
  assert.ok(ico.length > 2000)
  assert.deepEqual(verifyEditorDistribution(root, 'source'), [])
})
test('DIST-CORR-02 detecta un PNG de tamaño incorrecto aunque exista', (t) => {
  const tmp = fixture(t)
  fs.copyFileSync(path.join(root, 'build/icons/128x128.png'), path.join(tmp, 'build/icons/256x256.png'))
  assert.ok(verifyEditorDistribution(tmp, 'source').some(e => e.includes('256x256.png')))
})
test('DIST-CORR-03 detecta corrupción de datos IDAT y cabecera ICO', (t) => {
  const tmp = fixture(t)
  const p = path.join(tmp, 'build/icons/512x512.png')
  const png = fs.readFileSync(p)
  png[75] ^= 0xff
  fs.writeFileSync(p, png)
  assert.ok(verifyEditorDistribution(tmp, 'source').some(e => e.includes('512x512.png')))
  const ico = path.join(tmp, 'build/icon.ico')
  const data = fs.readFileSync(ico)
  data.writeUInt32LE(0x7fffffff, 6 + 8)
  fs.writeFileSync(ico, data)
  assert.ok(verifyEditorDistribution(tmp, 'source').some(e => e.includes('icon.ico')))
})
test('DIST-CORR-04 generador reproducible integrado en make-icon.mjs y sin dependencias nuevas', () => {
  const src = get('scripts/make-icon.mjs')
  assert.match(src, /export function generateDistributionIcons/)
  assert.match(src, /export function encodeWindowsIcon/)
  assert.equal(pkg.scripts['icons:distribution'], 'node scripts/make-icon.mjs --distribution')
  assert.equal(pkg.build.directories.buildResources, 'build')
})
test('DIST-CORR-05 workflow restaurado, ejecuta distribución en dos plataformas sin publicar', () => {
  const workflow = get('.github/workflows/desktop-build.yml')
  assert.match(workflow, /npm run test:distribution/)
  assert.match(workflow, /npm run dist:linux/)
  assert.match(workflow, /npm run dist:win/)
  assert.match(workflow, /if-no-files-found: error/)
})
test('DIST-CORR-06 el recurso de 256px conserva exactamente el rombo del producto', () => {
  assert.deepEqual(fs.readFileSync(path.join(root, 'electron/vendor/icon.png')),
    fs.readFileSync(path.join(root, 'build/icons/256x256.png')))
})

// LF-EDITOR-DISTRIBUTION-CORR-001: la corrección anterior no preparaba iconos
// automáticamente al empaquetar. Verificar el comportamiento, no solo archivos presentes.
import { prepareEditorDistribution } from './prepare-editor-distribution.mjs'

test('DIST-CORR-07 restaura los iconos cuando faltan, sin requerir intervención manual', t => {
  const tmp = fixture(t)
  fs.rmSync(path.join(tmp, 'build'), { recursive: true })
  assert.ok(verifyEditorDistribution(tmp, 'source').some(e => e.startsWith('Falta build/icon')))
  assert.deepEqual(prepareEditorDistribution(tmp), { restored: true })
  assert.deepEqual(verifyEditorDistribution(tmp, 'preflight'), [])
})
test('DIST-CORR-08 regenera iconos dañados, sin desactivar el preflight', t => {
  const tmp = fixture(t)
  fs.writeFileSync(path.join(tmp, 'build/icon.png'), 'PNG inválido')
  assert.deepEqual(prepareEditorDistribution(tmp), { restored: true })
  assert.deepEqual(verifyEditorDistribution(tmp, 'preflight'), [])
})
test('DIST-CORR-09 respeta los iconos válidos existentes', t => {
  const tmp = fixture(t)
  const icon = path.join(tmp, 'build/icon.png')
  const before = fs.readFileSync(icon)
  assert.deepEqual(prepareEditorDistribution(tmp), { restored: false })
  assert.deepEqual(fs.readFileSync(icon), before)
})
test('DIST-CORR-10 no oculta errores ajenos a los iconos', t => {
  const tmp = fixture(t)
  fs.rmSync(path.join(tmp, 'electron/main.cjs'))
  assert.throws(() => prepareEditorDistribution(tmp), /electron\/main\.cjs/)
})
test('DIST-CORR-11 todos los empaquetados preparan recursos antes de electron-builder', () => {
  for (const name of ['dist:linux:package', 'dist:win:package', 'dist:filmmaker']) {
    const script = pkg.scripts[name]
    assert.ok(script.includes('npm run dist:prepare'), `${name} debe preparar recursos`)
    assert.ok(script.indexOf('dist:prepare') < script.indexOf('electron-builder'), `${name}: orden incorrecto`)
  }
  assert.equal(pkg.scripts['dist:prepare'], 'node scripts/prepare-editor-distribution.mjs')
})
