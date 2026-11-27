import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import { runInNewContext } from 'node:vm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MONITOR_PROFILES, applyMonitorEncoding } from '../src/filmmaker/mobile-monitor-quality.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const source = (p) => readFileSync(join(root, p), 'utf8')
const sender = (initial = {}) => {
  const state = { transactionId: 'rtc-1', encodings: [{ active: true, ...initial }] }
  return { getParameters() { return structuredClone(state) }, async setParameters(p) { Object.assign(state, structuredClone(p)) }, state }
}

test('S03-01: perfiles limitados, escala preserva proporción y no sobrepasa 10 fps', () => {
  assert.deepEqual(Object.keys(MONITOR_PROFILES), ['ahorro', 'equilibrado', 'detalle'])
  assert.deepEqual(Object.values(MONITOR_PROFILES).map(p => p.scale), [2, 1, 1])
  assert.ok(Object.values(MONITOR_PROFILES).every(p => p.fps <= 10 && p.bitrate > 0))
})
test('S03-02: solo modifica sender encoding y conserva otras opciones WebRTC', async () => {
  const s = sender({ priority: 'high' })
  const result = await applyMonitorEncoding(s, 'ahorro')
  assert.equal(result.bitrate, 350000)
  assert.deepEqual(s.state.encodings[0], {active:true, priority:'high', maxBitrate:350000, maxFramerate:5, scaleResolutionDownBy:2})
  assert.equal(s.state.transactionId, 'rtc-1')
})
test('S03-03: rechaza perfil desconocido sin modificar codificador', async () => {
  const s = sender()
  await assert.rejects(applyMonitorEncoding(s, 'ultra'), /desconocido/)
  assert.deepEqual(s.state.encodings, [{active:true}])
})
test('S03-04: sin encoding modificable informa error y no simula control de calidad', async () => {
  await assert.rejects(applyMonitorEncoding({ getParameters:() => ({ encodings: [] }), setParameters:async()=>{} }, 'ahorro'), /no expone/)
})
test('S03-05: setParameters rechazado da error verificable', async () => {
  await assert.rejects(applyMonitorEncoding({ getParameters:() => ({ encodings: [{}] }), setParameters:async()=>{ throw Error('Unsupported') } }, 'detalle'), /Unsupported/)
})
test('S03-06: no se declara aplicado cuando el navegador no refleja el perfil', async () => {
  await assert.rejects(applyMonitorEncoding({ getParameters:() => ({ encodings: [{}] }), setParameters:async()=>{} }, 'ahorro'), /no confirmó/)
})
test('S03-07: el perfil afecta exclusivamente a RTCRtpSender, nunca a film.frame ni al viewport de producción', () => {
  const pc = source('src/filmmaker/mobile-live-bridge.js')
  const quality = source('src/filmmaker/mobile-monitor-quality.mjs')
  assert.match(pc, /applyMonitorEncoding\(currentSender, name\)/)
  assert.doesNotMatch(pc + quality, /film\.frame\s*=|renderer\.setSize\(|session\.film\s*=|startPass\(/)
})
test('S03-08: IPC de métricas está limitado a FilmMaker y propiedad de la sesión', () => {
  assert.match(source('electron/main.cjs'), /lf:film-mobile-resources[\s\S]*?isFilmWindow\(event.sender\)[\s\S]*?filmBridge\.isOwner/)
  assert.match(source('electron/preload.cjs'), /resources:\s*\(\) => ipcRenderer\.invoke\('lf:film-mobile-resources'\)/)
  assert.match(source('electron/main.cjs'), /app\.getAppMetrics\(\)/)
})
test('S03-09: RAM y CPU Android se muestrean sin servicios adicionales', () => {
  const native = source('filmmaker-mobile/android/app/src/main/java/com/levelforge/netherfilmmaker/MobileCapabilitiesPlugin.java')
  assert.match(native, /void monitorResources\(PluginCall call\)/)
  assert.match(native, /Process\.getElapsedCpuTime\(\)/)
  assert.match(native, /getProcessMemoryInfo\(new int\[\]\{android\.os\.Process\.myPid\(\)\}\)/)
  assert.doesNotMatch(native, /startService\(/)
})
test('S03-10: monitor invalida imagen antigua, deja de enviar orientación y cancela listeners al cerrar', () => {
  const mobile = source('src/filmmaker/mobile-live-monitor.js')
  assert.match(mobile, /performance\.now\(\) - lastDecodedAt/)
  assert.match(mobile, /age <= 2500/)
  assert.match(mobile, /state\.monitoring = fresh/)
  assert.match(mobile, /if \(!state\.monitoring \|\| performance\.now\(\) - lastDecodedAt > 2500 \|\| document\.hidden\) return/)
  assert.match(mobile, /removeEventListener\('timeupdate', fallbackFrame\)/)
  assert.match(mobile, /cancelVideoFrameCallback/)
  assert.match(mobile, /activeId !== connectionId/)
})
test('S03-11: latencia de vídeo solo estimada si captureTime y nunca inventada', () => {
  const mobile = source('src/filmmaker/mobile-live-monitor.js')
  const ui = source('src/filmmaker/MobileCapabilities.vue')
  assert.match(mobile, /Number\.isFinite\(metadata\?\.captureTime\)/)
  assert.match(ui, /latencia estimada p50\/p95/)
  assert.match(ui, /videoLatencyP50 \?\? '—'/)
})
test('S03-12: cliente informa FPS, bitrate, dimensión y PSS de forma independiente', () => {
  const mobile = source('src/filmmaker/mobile-live-monitor.js')
  const ui = source('src/filmmaker/MobileCapabilities.vue')
  assert.match(mobile, /stat\.type !== 'inbound-rtp'/)
  assert.match(mobile, /device\.monitorResources\(\)/)
  assert.match(ui, /data-test="mobile-monitor-resources"/)
  assert.match(ui, /data-test="mobile-monitor-quality-stats"/)
})
test('S03-13: se conserva visor móvil sin recortar, teléfono sin segunda escena 3D', () => {
  const ui = source('src/filmmaker/MobileCapabilities.vue')
  assert.match(ui, /object-fit:contain/)
  assert.doesNotMatch(source('src/filmmaker/mobile-live-monitor.js'), /new WebGLRenderer|new Scene\(/)
})
test('S03-14: ratificación contractual CA-MC-002 sin ampliar S04/05/06', () => {
  const ca = source('docs/architecture/LF-FILMMAKER-MOBILE-CAMERA-LIVE-BRIDGE-S02-G001-INTEGRAL_CA-MC-002.md')
  assert.match(ca, /RATIFICADO/)
  assert.match(ca, /2026-11-05/)
  assert.match(ca, /S04\/S05\/S06/)
})

// Evalúa la función real de creación de ventanas con un doble de Electron que
// rechaza cualquier acceso a webContents después de cerrar la ventana.
function createWindowHarness() {
  const main = source('electron/main.cjs')
  const start = main.indexOf('function createWindow(page =')
  const end = main.indexOf('\napp.whenReady()', start)
  assert.ok(start !== -1 && end > start, 'La función Electron createWindow debe existir')
  const disposed = []
  class FakeWindow extends EventEmitter {
    static windows = []
    static getAllWindows() { return FakeWindow.windows.filter(w => !w.destroyed) }
    constructor() {
      super()
      this.destroyed = false
      this.web = new EventEmitter()
      this.web.id = 73 + FakeWindow.windows.length
      this.web.isDestroyed = () => this.destroyed
      this.web.send = () => {}
      this.web.setWindowOpenHandler = () => {}
      FakeWindow.windows.push(this)
    }
    get webContents() {
      if (this.destroyed) throw new TypeError('Object has been destroyed')
      return this.web
    }
    isDestroyed() { return this.destroyed }
    isMinimized() { return false }
    restore() {}
    focus() { this.focused = true }
    show() {}
    loadURL() {}
    loadFile() {}
    close() {
      const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true } }
      this.emit('close', event)
      if (event.defaultPrevented) return
      this.destroyed = true
      this.emit('closed')
    }
  }
  const context = {
    BrowserWindow: FakeWindow,
    ipcMain: new EventEmitter(),
    filmBridge: { stopIfOwner(id) { disposed.push(id) } },
    path, fs: { existsSync() { return false } },
    __dirname: '/tmp/levelforge-qa/electron', DEV_URL: undefined, BAR_H: 36,
    shell: { openExternal() {} }, recoverySession: null, allEditorClosuresSafe: true,
    process: { argv: ['electron', '--filmmaker'] },
  }
  runInNewContext(main.slice(start, end) + '\nthis.createWindowForQA = createWindow', context)
  return { main, context, disposed, FakeWindow }
}

test('S03-15: closed libera la sesión por ID conservado sin acceder a webContents destruido', () => {
  const { context, disposed } = createWindowHarness()
  const win = context.createWindowForQA('filmmaker')
  const rendererId = win.webContents.id
  assert.doesNotThrow(() => win.close())
  assert.equal(win.isDestroyed(), true)
  assert.deepEqual(disposed, [rendererId])
  assert.equal(context.ipcMain.listenerCount('lf:close-hook'), 0)
  assert.equal(context.ipcMain.listenerCount('lf:close-result'), 0)
})

test('S03-16: second-instance recupera o enfoca una ventana válida, nunca la destruida', () => {
  const { main, context, FakeWindow } = createWindowHarness()
  const handler = main.match(/app\.on\('second-instance', \(\) => \{[\s\S]*?\n  \}\)/)?.[0]
  assert.ok(handler, 'Debe existir el manejador real de segunda instancia')
  context.app = new EventEmitter()
  runInNewContext(`let win = createWindowForQA('filmmaker'); ${handler}; this.runSecondInstance = () => app.emit('second-instance'); this.getPrimary = () => win`, context)
  const original = context.getPrimary()
  original.close()
  assert.doesNotThrow(() => context.runSecondInstance())
  const restored = context.getPrimary()
  assert.notEqual(restored, original)
  assert.equal(restored.isDestroyed(), false)
  assert.equal(FakeWindow.getAllWindows().length, 1)
  assert.doesNotThrow(() => context.runSecondInstance())
  assert.equal(context.getPrimary(), restored)
  assert.equal(restored.focused, true)
})
