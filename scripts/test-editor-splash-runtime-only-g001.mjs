import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')

test('Editor muestra progreso sin componente de branding ni ilustración de splash', () => {
  const app = source('src/App.vue')
  assert.doesNotMatch(app, /BrandingSplash|editorSplash|projectSplashImage|projectLoading\.branding/)
  assert.match(app, /<LoadingScreen\s+:title="projectLoading\.name[^\n]+:show-artwork="false"/)
  const loading = source('src/components/LoadingScreen.vue')
  assert.match(loading, /showArtwork:\s*\{\s*type:\s*Boolean,\s*default:\s*true/)
  assert.match(loading, /<img\s+v-if="showArtwork"/)
})

test('El flujo de proyectos mantiene progreso y limpieza sin splash editorial', () => {
  const loading = source('src/core/editor/project-loading.js')
  assert.doesNotMatch(loading, /beginBrandSplash|\beditorAppearance\b|\bbranding\b|\bsplash\b/)
  assert.match(loading, /await report\('project'\)/)
  assert.match(loading, /await report\('finish', 1, 1\)/)
  assert.match(loading, /finally\s*\{\s*projectLoading\.value = null\s*\}/)
  assert.doesNotMatch(source('src/core/state/project.js'), /brand:\s*store\.locked/)
})

test('La configuración y el puente Electron no ofrecen splash al Editor', () => {
  assert.doesNotMatch(source('electron/editor.toml'), /\[splash\]/)
  assert.doesNotMatch(source('electron/editor-config.cjs'), /get\('splash'|defaults\.splash|\bsplash, issues\b/)
  assert.doesNotMatch(source('electron/main.cjs'), /lf:editor-splash|__lfEditorConfig\.splash|splashDataUrl/)
  assert.doesNotMatch(source('electron/preload.cjs'), /editorSplash|lf:editor-splash/)
  assert.doesNotMatch(source('src/components/PreferencesModal.vue'), /splash de marca/i)
})

test('Runtime conserva su splash, utilidad y arte de carga', () => {
  const runtime = source('src/runtime-app/RuntimeApp.vue')
  assert.match(runtime, /beginBrandSplash\(/)
  assert.match(runtime, /<BrandingSplash v-if="branding"/)
  assert.match(runtime, /<LoadingScreen v-else-if="loadStatus"/)
  assert.match(source('electron/runtime/main.cjs'), /splashDataUrl/)
  assert.match(source('electron/appimage.cjs'), /splashMime/)
  assert.match(source('src/components/BrandingSplash.vue'), /brand-splash/)
  assert.match(source('src/engine/runtime/loading-progress.js'), /export function beginBrandSplash/)
})
