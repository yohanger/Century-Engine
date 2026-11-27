import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import config from '../electron/editor-config.cjs'
import startup from '../electron/startup-splash.cjs'
import { beginBrandSplash, loadingProgress } from '../src/engine/runtime/loading-progress.js'
import { withProjectLoading, projectLoading } from '../src/core/editor/project-loading.js'

test('editor.toml se crea una vez y conserva cambios personalizados', (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'lf-editor-config-'))
  t.after(() => rmSync(folder, { recursive: true, force: true }))
  const path = join(folder, 'editor.toml')
  const first = config.loadEditorConfig(path)
  assert.deepEqual(first.issues, [])
  assert.equal('splash' in first, false)
  assert.equal(first.css['--g-900'], '#11141b')
  assert.equal(first.css['--editor-color-scheme'], 'dark')
  assert.equal(first.prefs.navigation, 'mouse')
  assert.equal(first.prefs.editorFov, 90)
  assert.equal(first.prefs.selectionStyle, 'box')
  const custom = `[interface]
font = "IBM Plex Sans"
scale = 1.25
font_size = 15
[colors]
background = "#202933"
accent = "invalid"
[navigation]
device = "trackpad"
[camera]
fov = 105
[selection]
style = "outline"
color = "#abcdef"
width = 2.5
strength = 4.0
[splash]
image = 'arte/arranque.webp'
show_version = false
`
  writeFileSync(path, custom)
  const loaded = config.loadEditorConfig(path)
  assert.equal(loaded.scale, 1.25)
  assert.match(loaded.css['--font'], /^"IBM Plex Sans"/)
  assert.equal(loaded.css['--editor-font-size'], '15px')
  assert.equal(loaded.css['--g-900'], '#202933')
  assert.equal(loaded.css['--blue'], first.css['--blue'])
  assert.equal(loaded.prefs.navigation, 'trackpad')
  assert.equal(loaded.prefs.editorFov, 105)
  assert.equal(loaded.prefs.selectionStyle, 'outline')
  assert.equal(loaded.prefs.selectionOutlineColor, '#abcdef')
  assert.ok(loaded.missingPrefs.includes('mouseOrbit'))
  assert.equal('splash' in loaded, false)
  assert.deepEqual(loaded.issues, ['Valor inválido en colors.accent'])
  assert.equal(readFileSync(path, 'utf8'), custom)
  writeFileSync(path, '[interface\nfont =')
  const malformed = config.loadEditorConfig(path)
  assert.equal(malformed.scale, first.scale)
  assert.equal(malformed.issues.length, 1)
})

test('Preferencias escribe editor.toml sin destruir comentarios ni secciones ajenas', (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'lf-editor-prefs-'))
  t.after(() => rmSync(folder, { recursive: true, force: true }))
  const path = join(folder, 'editor.toml')
  writeFileSync(path, `[interface]\nfont = "Selawik"\n\n[navigation]\ndevice = "mouse" # conservar comentario\n\n[plugin_demo]\nenabled = true\n`)
  const saved = config.saveEditorPreferences(path, {
    navigation: 'trackpad', editorFov: 100, gizmoSize: 1.4,
    selectionStyle: 'outline', selectionOutlineColor: '#123456',
  })
  const text = readFileSync(path, 'utf8')
  assert.match(text, /device = "trackpad" # conservar comentario/)
  assert.match(text, /\[plugin_demo\]\nenabled = true/)
  assert.match(text, /\[camera\]\nfov = 100/)
  assert.match(text, /\[gizmos\]\nsize = 1\.4/)
  assert.equal(saved.prefs.navigation, 'trackpad')
  assert.equal(saved.prefs.editorFov, 100)
  assert.equal(saved.prefs.selectionOutlineColor, '#123456')
  assert.ok(!saved.missingPrefs.includes('editorFov'))
  assert.throws(() => config.saveEditorPreferences(path, { editorFov: 500 }), /camera\.fov/)
})

test('Renderer aplica TOML a CSS y prefs antes de montar, y sincroniza cambios de vuelta', () => {
  const appearance = readFileSync(new URL('../src/core/editor/appearance.js', import.meta.url), 'utf8')
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  const electronMain = readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8')
  const preload = readFileSync(new URL('../electron/preload.cjs', import.meta.url), 'utf8')
  const hub = readFileSync(new URL('../src/components/WelcomeScreen.vue', import.meta.url), 'utf8')
  assert.match(main, /await applyEditorAppearance\(\)/)
  assert.ok(main.indexOf('await applyEditorAppearance()') < main.indexOf("createApp(App)"))
  assert.match(appearance, /Object\.assign\(store\.prefs, config\.prefs\)/)
  assert.match(appearance, /config\.missingPrefs/)
  assert.match(appearance, /window\.lf\.saveEditorPreferences\(requested\)/)
  assert.match(electronMain, /lf:save-editor-preferences/)
  assert.match(preload, /saveEditorPreferences/)
  assert.match(hub, /--titlebar: var\(--editor-chrome\)/)
  assert.doesNotMatch(hub, /\.hub\.dark|store\.prefs\.hubDark/)
})

test('Runtime conserva la validación de imagen de splash', () => {
  const file = new URL('../electron/assets/ngm-engine-emblem.webp', import.meta.url)
  assert.match(startup.splashDataUrl(file), /^data:image\/webp;base64,/)
  assert.equal(startup.splashMime(Buffer.from('<svg width="10" height="10"></svg>')), '')
})

test('el porcentaje sigue los pasos y las unidades completadas', async () => {
  const log = []
  const report = loadingProgress([['scene', 'Escena'], ['models', 'Modelos'], ['ready', 'Listo']], (state) => log.push(state))
  await report('scene')
  await report('models', 2, 4)
  await report('scene')
  await report('ready', 1, 1)
  assert.deepEqual(log.map((state) => [state.phase, state.percent, state.step, state.done, state.total]), [
    ['Escena', 0, 1, 0, 0], ['Modelos', 50, 2, 2, 4], ['Listo', 100, 3, 1, 1],
  ])
})

test('Runtime conserva el ciclo de vida del splash de marca', async () => {
  const visibility = []
  const splash = beginBrandSplash((visible) => visibility.push(visible))
  assert.deepEqual(visibility, [true])
  splash.finish()
  await splash.done
  splash.finish()
  assert.deepEqual(visibility, [true, false])
})

test('el progreso editorial solo existe durante una operación de proyecto y se limpia si falla', async () => {
  assert.equal(projectLoading.value, null)
  await assert.rejects(withProjectLoading('Demo', async (report) => {
    assert.equal(projectLoading.value.name, 'Demo')
    assert.equal('branding' in projectLoading.value, false)
    await report('models', 1, 2)
    assert.equal(projectLoading.value.status.percent, 62)
    throw new Error('Proyecto inválido')
  }), /Proyecto inválido/)
  assert.equal(projectLoading.value, null)
})
