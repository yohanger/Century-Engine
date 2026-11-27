import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const main = readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8')
const start = main.indexOf("if (!film || DEV_URL || !app.isPackaged) win.webContents.on('before-input-event'")
const end = main.indexOf('\n  if (DEV_URL) {', start)
assert.ok(start >= 0 && end > start, 'No se encontró el controlador de teclado existente')
const actualHook = Function('film', 'DEV_URL', 'app', 'win', main.slice(start, end))
function run({ film = true, packaged = false, devUrl = null } = {}) {
  let listener, toggleCount = 0, reloads = 0
  const win = { webContents: {
    on(event, handler) { assert.equal(event, 'before-input-event'); listener = handler },
    toggleDevTools() { toggleCount++ },
    reload() { reloads++ },
  } }
  actualHook(film, devUrl, { isPackaged: packaged }, win)
  const press = (input) => {
    let prevented = false
    listener?.({ preventDefault() { prevented = true } }, { type: 'keyDown', ...input })
    return prevented
  }
  return { press, get active() { return !!listener }, get toggled() { return toggleCount }, get reloaded() { return reloads } }
}

test('CORR002-01: FilmMaker local compilado recibe F12 sin servidor Vite', () => {
  const local = run()
  assert.equal(local.active, true)
  assert.equal(local.press({ key: 'F12', isAutoRepeat: false }), true)
  assert.equal(local.toggled, 1)
})

test('CORR002-02: no se abren varias ventanas DevTools al mantener F12', () => {
  const local = run()
  assert.equal(local.press({ key: 'F12', isAutoRepeat: true }), true)
  assert.equal(local.toggled, 0)
})

test('CORR002-03: Ctrl+Shift+I funciona como alternativa en FilmMaker local', () => {
  const local = run()
  assert.equal(local.press({ key: 'I', control: true, shift: true }), true)
  assert.equal(local.toggled, 1)
})

test('CORR002-04: no intercepta teclas normales, recarga o entrada de texto', () => {
  const local = run()
  assert.equal(local.press({ key: 'A' }), false)
  assert.equal(local.press({ key: 'r', control: true }), false)
  assert.equal(local.reloaded, 0)
  assert.equal(local.toggled, 0)
})

test('CORR002-05: FilmMaker distribuido conserva DevTools desactivadas', () => {
  const packaged = run({ film: true, packaged: true })
  assert.equal(packaged.active, false)
  assert.equal(packaged.press({ key: 'F12' }), false)
})

test('CORR002-06: el Editor principal conserva su atajo F12 incluso empaquetado', () => {
  const editor = run({ film: false, packaged: true })
  assert.equal(editor.active, true)
  assert.equal(editor.press({ key: 'F12' }), true)
  assert.equal(editor.toggled, 1)
})

test('CORR002-07: Vite mantiene F12 y Ctrl+R sin modificar su comportamiento', () => {
  const vite = run({ film: true, packaged: true, devUrl: 'http://localhost:5173' })
  assert.equal(vite.active, true)
  assert.equal(vite.press({ key: 'F12' }), true)
  assert.equal(vite.press({ key: 'r', control: true }), true)
  assert.equal(vite.reloaded, 1)
})

test('CORR002-08: la entrega sigue incluyendo el selector de nodos y el host Inspector de S01 CORR001', () => {
  const timeline = readFileSync(new URL('../src/filmmaker/NleTimeline.vue', import.meta.url), 'utf8')
  const app = readFileSync(new URL('../src/filmmaker/FilmApp.vue', import.meta.url), 'utf8')
  assert.match(timeline, /data-test="film-node-chooser"/)
  assert.match(timeline, /data-test="node-add"/)
  assert.match(timeline, /inspectorTarget \|\| 'body'/)
  assert.match(app, /filmClipInspectorTarget/)
  assert.match(app, /film-clip-inspector-host/)
})
