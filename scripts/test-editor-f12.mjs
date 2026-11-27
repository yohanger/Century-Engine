// LF-EDITOR-F12-G001: las mismas entradas de Electron para editor y Runtime, sin iniciar una ventana gráfica.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const source = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')

async function electronFixture(entry, env = {}, argv = ['electron', '.']) {
  const windows = [], handlers = new Map(), appHandlers = new Map(), menuCalls = []
  const app = {
    getPath: () => '/tmp/lf-f12-test-does-not-exist',
    requestSingleInstanceLock: () => true,
    whenReady: () => Promise.resolve(),
    on: (name, fn) => appHandlers.set(name, fn),
    quit: () => {},
  }
  class WebContents {
    constructor() { this.callbacks = new Map(); this.toggles = 0; this.reloads = 0 }
    on(name, fn) { this.callbacks.set(name, fn) }
    setWindowOpenHandler(fn) { this.windowOpenHandler = fn }
    toggleDevTools() { this.toggles++ }
    reload() { this.reloads++ }
    emitKey(input) {
      const result = { prevented: false, preventDefault() { this.prevented = true } }
      const fn = this.callbacks.get('before-input-event')
      assert.ok(fn, 'before-input-event debe registrarse en la ventana')
      fn(result, input)
      return result.prevented
    }
    getURL() { return 'file:///runtime/dist/runtime.html' }
  }
  class Window {
    constructor(options) {
      this.options = options
      this.webContents = new WebContents()
      this.handlers = new Map()
      this.fullscreen = Boolean(options.fullscreen)
      windows.push(this)
    }
    on(name, fn) { this.handlers.set(name, fn) }
    once(name, fn) { this.handlers.set(name, fn) }
    loadURL(url) { this.url = url }
    loadFile(file) { this.file = file }
    setFullScreen(value) { this.fullscreen = value }
    isFullScreen() { return this.fullscreen }
    maximize() {}
  }
  Window.fromWebContents = (wc) => windows.find(w => w.webContents === wc)
  Window.getAllWindows = () => windows
  const webRequest = { onBeforeRequest: (fn) => { webRequest.guard = fn } }
  const defaultSession = {
    webRequest,
    setPermissionRequestHandler: () => {},
    setPermissionCheckHandler: () => {},
  }
  const ipcMain = {
    handle: (name, fn) => handlers.set(name, fn),
    on: (name, fn) => handlers.set(name, fn),
    removeListener: (name) => handlers.delete(name),
  }
  const electron = {
    app, BrowserWindow: Window, ipcMain, session: { defaultSession },
    Menu: { setApplicationMenu: (v) => menuCalls.push(v), buildFromTemplate: () => ({}) },
    shell: { openExternal() {}, showItemInFolder() {} },
    dialog: { showOpenDialog: async () => ({ canceled: true }), showSaveDialog: async () => ({ canceled: true }) },
  }
  const req = (name) => {
    if (name === 'electron') return electron
    if (name === './appimage.cjs') return { exportAppImage: async () => ({}), slugOf: (s) => s }
    if (name === './saves.cjs') return { createSaves: () => ({}) }
    if (name === 'node:path') return path
    if (name === 'node:url') return { pathToFileURL }
    if (name === 'node:fs') return { readFileSync: () => { throw new Error('no hay archivos en fixture') }, existsSync: () => false }
    throw new Error('Importación no reconocida en fixture: ' + name)
  }
  const ctx = {
    require: req, __dirname: '/tmp/lf-f12-test-does-not-exist',
    process: { env, platform: 'linux', arch: 'x64', argv },
    URL, Buffer, setTimeout,
    module: { exports: {} },
  }
  runInNewContext(source(entry), ctx, { filename: entry })
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(windows.length, 1, 'Electron debe crear una ventana')
  return { win: windows[0], windows, handlers, defaultSession, menuCalls }
}

const key = (name, extra = {}) => ({ type: 'keyDown', key: name, control: false, meta: false, alt: false, shift: false, ...extra })

test('F12-01 · editor compilado: F12 abre/cierra DevTools usando un único listener', async () => {
  const f = await electronFixture('electron/main.cjs')
  assert.equal(f.win.webContents.emitKey(key('F12')), true)
  assert.equal(f.win.webContents.emitKey(key('F12')), true)
  assert.equal(f.win.webContents.toggles, 2)
  assert.ok(f.win.file?.endsWith('index.html') || f.win.url?.startsWith('data:text/html'))
  assert.equal(f.win.webContents.callbacks.size > 0, true)
})

test('F12-02 · desarrollo con Vite: F12 sigue funcionando', async () => {
  const f = await electronFixture('electron/main.cjs', { VITE_DEV_URL: 'http://127.0.0.1:5173/' })
  assert.equal(f.win.url, 'http://127.0.0.1:5173/')
  assert.equal(f.win.webContents.emitKey(key('F12')), true)
  assert.equal(f.win.webContents.toggles, 1)
})

test('F12-03 · autorepetición de F12 no cambia el estado reiteradamente', async () => {
  const f = await electronFixture('electron/main.cjs')
  f.win.webContents.emitKey(key('F12'))
  assert.equal(f.win.webContents.emitKey(key('F12', { isAutoRepeat: true })), true)
  assert.equal(f.win.webContents.toggles, 1)
})

test('F12-04 · keyUp no vuelve a abrir DevTools y otras teclas no se consumen', async () => {
  const f = await electronFixture('electron/main.cjs')
  assert.equal(f.win.webContents.emitKey(key('F12', { type: 'keyUp' })), false)
  assert.equal(f.win.webContents.emitKey(key('F5')), false)
  assert.equal(f.win.webContents.emitKey(key('F11')), false)
  assert.equal(f.win.webContents.toggles, 0)
})

test('F12-05 · Ctrl/Cmd+R recarga únicamente en desarrollo', async () => {
  const dev = await electronFixture('electron/main.cjs', { VITE_DEV_URL: 'http://127.0.0.1:5173/' })
  assert.equal(dev.win.webContents.emitKey(key('r', { control: true })), true)
  assert.equal(dev.win.webContents.emitKey(key('R', { meta: true })), true)
  assert.equal(dev.win.webContents.reloads, 2)
  const prod = await electronFixture('electron/main.cjs')
  assert.equal(prod.win.webContents.emitKey(key('r', { control: true })), false)
  assert.equal(prod.win.webContents.reloads, 0)
})

test('F12-06 · Film Maker conserva el F12 previo solo en desarrollo; no se habilita nuevo en versión compilada', async () => {
  const dev = await electronFixture('electron/main.cjs', { VITE_DEV_URL: 'http://127.0.0.1:5173/' }, ['electron', '.', '--filmmaker'])
  assert.equal(dev.win.options.title, 'Nether Film Maker')
  assert.equal(dev.win.webContents.emitKey(key('F12')), true)
  assert.equal(dev.win.webContents.toggles, 1)
  const prod = await electronFixture('electron/main.cjs', {}, ['electron', '.', '--filmmaker'])
  assert.equal(prod.win.webContents.callbacks.has('before-input-event'), false)
})

test('F12-07 · Runtime exportado mantiene devTools desactivado aunque GAME_DEVTOOLS=1', async () => {
  const f = await electronFixture('electron/runtime/main.cjs', { GAME_DEVTOOLS: '1' })
  assert.equal(f.win.options.webPreferences.devTools, false)
  assert.equal(f.win.options.webPreferences.contextIsolation, true)
  assert.equal(f.win.options.webPreferences.nodeIntegration, false)
})

test('F12-08 · Runtime no abre DevTools con F12 o Ctrl+Shift+I', async () => {
  const f = await electronFixture('electron/runtime/main.cjs')
  assert.equal(f.win.webContents.emitKey(key('F12')), false)
  assert.equal(f.win.webContents.emitKey(key('I', { control: true, shift: true })), false)
  assert.equal(f.win.webContents.toggles, 0)
})

test('F12-09 · Runtime no permite solicitudes al protocolo devtools:', async () => {
  const f = await electronFixture('electron/runtime/main.cjs')
  const allow = async (url) => new Promise(resolve => f.defaultSession.webRequest.guard({ url }, resolve))
  assert.equal((await allow('devtools://devtools/bundled/inspector.html')).cancel, true)
  assert.equal((await allow('data:text/plain,hello')).cancel, false)
  assert.equal((await allow('blob:file:///player/id')).cancel, false)
  assert.equal((await allow('https://example.org')).cancel, true)
})

test('F12-10 · F11 alterna pantalla completa solo en el Runtime; F5 no se consume', async () => {
  const f = await electronFixture('electron/runtime/main.cjs')
  assert.equal(f.win.fullscreen, true)
  assert.equal(f.win.webContents.emitKey(key('F11')), true)
  assert.equal(f.win.fullscreen, false)
  assert.equal(f.win.webContents.emitKey(key('F11')), true)
  assert.equal(f.win.fullscreen, true)
  assert.equal(f.win.webContents.emitKey(key('F5')), false)
})

test('F12-11 · la ventana de atajos documenta F12 solamente como herramienta del editor', () => {
  const shortcuts = source('src/components/ShortcutsModal.vue')
  assert.match(shortcuts, /Herramientas de desarrollo \(solo editor\).*'F12'/)
})

test('F12-12 · el exportador empaqueta el proceso Runtime aislado, no el proceso principal del editor', () => {
  const exporter = source('electron/appimage.cjs')
  assert.match(exporter, /'runtime', 'main\.cjs'/)
  assert.match(exporter, /'runtime', 'preload\.cjs'/)
  assert.doesNotMatch(source('electron/runtime/main.cjs'), /GAME_DEVTOOLS/)
  assert.match(source('electron/main.cjs'), /toggleDevTools\(\)/)
})
