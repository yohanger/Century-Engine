// Huella reproducible de las entradas propias del bundle del Editor/FilmMaker.
// Se comparte entre el build de Vite y el launcher: nunca depende del mtime.
import { createHash } from 'node:crypto'
import { readdirSync, lstatSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const SOURCE_DIRS = ['src', 'public']
const SOURCE_FILES = ['index.html', 'filmmaker.html', 'vite.config.js', 'package.json', 'package-lock.json']
export const BUILD_MANIFEST_NAME = 'build-source-manifest.json'

export function editorSourceFingerprint(root) {
  const files = [...SOURCE_FILES]
  const visit = relative => {
    for (const item of readdirSync(path.join(root, relative)).sort()) {
      const name = `${relative}/${item}`
      const stat = lstatSync(path.join(root, name))
      if (stat.isDirectory()) visit(name)
      else if (stat.isFile()) files.push(name)
      // No seguir enlaces simbólicos: el SOURCE_BASELINE es un árbol de archivos propio.
    }
  }
  for (const directory of SOURCE_DIRS) visit(directory)
  files.sort()
  const hash = createHash('sha256')
  for (const relative of files) {
    const content = readFileSync(path.join(root, relative))
    hash.update(relative).update('\0').update(String(content.length)).update('\0').update(content)
  }
  return { sha256: hash.digest('hex'), fileCount: files.length }
}

export function editorBuildStatus(root, dist = path.join(root, 'dist')) {
  const filename = path.join(dist, BUILD_MANIFEST_NAME)
  if (!existsSync(filename)) return { state: 'unknown', reason: `Falta dist/${BUILD_MANIFEST_NAME} (compilación anterior sin huella)` }
  let manifest
  try {
    manifest = JSON.parse(readFileSync(filename, 'utf8'))
    if (manifest.schema !== 1 || !/^[a-f0-9]{64}$/.test(manifest.sha256) ||
        !Number.isInteger(manifest.fileCount) || manifest.fileCount < 1 || typeof manifest.packageVersion !== 'string') {
      throw new Error('formato de manifiesto inválido')
    }
  } catch (error) { return { state: 'unknown', reason: `No se puede verificar dist/${BUILD_MANIFEST_NAME}: ${error.message}` } }
  try {
    const current = editorSourceFingerprint(root)
    const packageVersion = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version
    if (manifest.sha256 !== current.sha256 || manifest.fileCount !== current.fileCount || manifest.packageVersion !== packageVersion) {
      return { state: 'outdated', compiledVersion: manifest.packageVersion, currentVersion: packageVersion }
    }
    return { state: 'current', compiledVersion: packageVersion }
  } catch (error) { return { state: 'unknown', reason: `No se pudo inspeccionar el código fuente: ${error.message}` } }
}
