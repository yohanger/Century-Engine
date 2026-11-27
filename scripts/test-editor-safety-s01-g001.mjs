import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { EventEmitter } from 'node:events'
import vm from 'node:vm'

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const project = read('src/core/state/project.js')
const electron = read('electron/main.cjs')
const preload = read('electron/preload.cjs')
const dbSource = read('src/core/db.js')
const dialogs = read('src/core/dialogs.js')
const askWindows = read('src/components/AskWindows.vue')
const app = read('src/App.vue')
const history = read('src/core/state/history.js')
const sourceBetween = (text, start, end) => {
  const a = text.indexOf(start)
  const b = text.indexOf(end, a)
  assert.ok(a >= 0 && b > a, `${start}: falta la función original`)
  return text.slice(a, b).replace(/^export /gm, '')
}
const loadClose = (options = {}) => {
  const calls = []
  const state = { project: { id: 'p1', name: 'Prueba' }, locked: false, unsavedChanges: true, disk: { state: 'dirty' }, saveState: 'saved', closeBusy: false, ...options.state }
  const env = {
    store: state,
    askCloseDecision: async () => options.decision ?? 'cancel',
    cancelPendingAutosave: () => calls.push('cancelAutosave'),
    saveChain: Promise.resolve(), pendingWrites: Promise.resolve(), flushing: null, unconfirmedDiskWrite: null, restoreConfirmedDisk: async () => {},
    db: { consumeRecoveryProject: async () => {}, restoreConfirmedProject: async () => { calls.push('restore'); if (options.failRestore) throw new Error('Fallo de IndexedDB') } },
    saveAll: async () => { calls.push('saveAll'); if (options.saveSuccess !== false) { state.unsavedChanges = false; state.saveState = 'saved' }; return options.saveSuccess ?? true },
    saveNow: async () => { calls.push('saveNow'); if (options.cacheSuccess !== false) state.saveState = 'saved'; return options.cacheSuccess ?? true },
    vsc: { flush: async () => calls.push('vscodeFlush') },
    projLoc: { kind: 'path', path: '/proyecto' },
    toast: (...args) => calls.push(['toast', ...args]),
  }
  const code = sourceBetween(project, 'export async function requestClose()', '/** Compatibilidad para llamadas existentes:')
  const api = new Function(...Object.keys(env), `${code}\nreturn requestClose;`)(...Object.values(env))
  return { requestClose: api, store: state, calls }
}

test('SAFE-S01-01 · cancelar conserva ventana y copia de trabajo', async () => {
  const f = loadClose({ decision: 'cancel' })
  assert.equal(await f.requestClose(), 'cancel')
  assert.deepEqual(f.calls, ['vscodeFlush'])
  assert.equal(f.store.unsavedChanges, true)
})
test('SAFE-S01-02 · guardar autoriza cerrar solo tras guardado confirmado', async () => {
  const f = loadClose({ decision: 'save' })
  assert.equal(await f.requestClose(), 'close')
  assert.deepEqual(f.calls, ['vscodeFlush', 'saveAll'])
  assert.equal(f.store.closeBusy, false)
})
test('SAFE-S01-03 · fallo o cancelación de guardado bloquea cierre', async () => {
  const f = loadClose({ decision: 'save', saveSuccess: false })
  assert.equal(await f.requestClose(), 'cancel')
  assert.deepEqual(f.calls, ['vscodeFlush', 'saveAll'])
})
test('SAFE-S01-04 · descartar restaura copia confirmada antes de permitir cerrar', async () => {
  const f = loadClose({ decision: 'discard' })
  assert.equal(await f.requestClose(), 'close')
  assert.deepEqual(f.calls, ['vscodeFlush', 'cancelAutosave', 'restore'])
  assert.equal(f.store.unsavedChanges, false)
})
test('SAFE-S01-05 · un fallo de restauración bloquea cierre', async () => {
  const f = loadClose({ decision: 'discard', failRestore: true })
  assert.equal(await f.requestClose(), 'cancel')
  assert.equal(f.store.unsavedChanges, true)
  assert.ok(f.calls.some((c) => Array.isArray(c) && c[0] === 'toast'))
})
test('SAFE-S01-06 · proyecto sin cambios cierra sin preguntas', async () => {
  const f = loadClose({ state: { unsavedChanges: false, disk: { state: 'saved' }, saveState: 'saved' } })
  assert.equal(await f.requestClose(), 'close')
  assert.deepEqual(f.calls, ['vscodeFlush'])
})
test('SAFE-S01-07 · error de copia local impide cierre sin cambios', async () => {
  const f = loadClose({ state: { unsavedChanges: false, disk: { state: 'saved' }, saveState: 'dirty' }, cacheSuccess: false })
  assert.equal(await f.requestClose(), 'cancel')
  assert.deepEqual(f.calls, ['vscodeFlush', 'saveNow'])
})

test('SAFE-S01-08 · Electron no fuerza el cierre: espera respuesta y acepta cancelación', () => {
  const code = electron.slice(electron.indexOf('  // El proceso principal no cierra'), electron.indexOf('  // Sin menú contextual nativo:'))
  assert.doesNotMatch(code, /setTimeout\s*\(/)
  assert.doesNotMatch(code, /lf:close-ready/)
  const ipcMain = new EventEmitter()
  const wc = new EventEmitter()
  wc.isDestroyed = () => false
  wc.sent = []
  wc.send = (...args) => wc.sent.push(args)
  const win = new EventEmitter()
  win.webContents = wc
  let closes = 0
  win.close = () => { let prevented = false; win.emit('close', { preventDefault: () => { prevented = true } }); if (!prevented) { closes++; win.emit('closed') } }
  new Function('ipcMain', 'win', code)(ipcMain, win)
  ipcMain.emit('lf:close-hook', { sender: wc })
  win.close()
  assert.equal(closes, 0)
  assert.equal(wc.sent.at(-1)[0], 'lf:before-close')
  win.close()
  assert.equal(wc.sent.length, 1, 'No debe abrir varios diálogos de cierre')
  ipcMain.emit('lf:close-result', { sender: { } }, 'close')
  assert.equal(closes, 0, 'No puede cerrar desde otra ventana')
  ipcMain.emit('lf:close-result', { sender: wc }, 'cancel')
  assert.equal(closes, 0)
  win.close()
  ipcMain.emit('lf:close-result', { sender: wc }, 'close')
  assert.equal(closes, 1)
})

test('SAFE-S01-09 · preload falla cerrado y no confirma errores', async () => {
  const ipc = new EventEmitter()
  ipc.send = (...args) => { ipc.messages.push(args) }
  ipc.messages = []
  ipc.invoke = async () => null
  const contextBridge = { exposeInMainWorld(_, value) { this.api = value } }
  vm.runInNewContext(preload, { require: (name) => { assert.equal(name, 'electron'); return { contextBridge, ipcRenderer: ipc } }, process: { platform: 'linux' }, console })
  contextBridge.api.onBeforeClose(async () => { throw new Error('No se guardó') })
  assert.equal(ipc.messages[0][0], 'lf:close-hook')
  ipc.emit('lf:before-close')
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(ipc.messages.at(-1), ['lf:close-result', 'cancel'])
})

test('SAFE-S01-10 · tres acciones exclusivas; Escape equivale a cancelar', () => {
  assert.match(dialogs, /export const askCloseDecision/)
  assert.match(dialogs, /kind: 'close'/)
  assert.match(askWindows, /d\.kind === 'close'/)
  assert.match(askWindows, /'discard'/)
  assert.match(askWindows, /@keydown\.esc\.stop="finish\(d, false\)"/)
})

test('SAFE-S01-11 · autosave solo escribe copia de trabajo y marca edición pendiente', () => {
  const saveCode = sourceBetween(project, 'async function saveNowImpl(', '/** Configuración de los tipos de vegetación')
  assert.doesNotMatch(saveCode, /flushDisk|diskSoon/)
  assert.match(history, /store\.unsavedChanges = true/)
  assert.match(history, /hooks\.markPending\?/)
  assert.match(project, /export async function persistNow\(\) \{ return saveNow\(\) \}/)
  assert.match(app, /S\.requestClose\(\)/)
  assert.doesNotMatch(app, /function onUnload\(\) \{ if \(store\.saveState/)
})

test('SAFE-S01-12 · checkpoint confirmado cubre todas las escenas y assets, rollback es atómico', async () => {
  const code = dbSource.slice(dbSource.indexOf('export async function restoreConfirmedProject(id)')).replace(/^export /gm, '')
  const actions = []
  const checkpoint = { id: 'p1', project: { id: 'p1', name: 'Confirmado' }, scenes: [{ key: 'p1:scene1', id: 1 }], assets: [{ key: 'p1:a', bytes: new Uint8Array([1]) }], dirty: true }
  const data = {
    projects: new Map([['p1', { id: 'p1', name: 'Trabajo' }]]),
    scenes: new Map([['p1:scene2', { key: 'p1:scene2' }]]),
    assets: new Map([['p1:b', { key: 'p1:b' }]]),
    confirmed: new Map([['p1', checkpoint]]),
  }
  const indexed = { transaction: (name) => ({ objectStore: () => ({ index: () => ({ getAllKeys: () => Promise.resolve([...data[name].keys()]) }) }) }) }
  const tx = async (_db, stores, mode, fn) => {
    assert.equal(mode, 'readwrite')
    assert.deepEqual(stores, ['projects', 'scenes', 'assets', 'confirmed'])
    const t = { objectStore: (name) => ({ put: (r) => { actions.push(['put', name, r]); data[name].set(name === 'projects' || name === 'confirmed' ? r.id : r.key, r) }, delete: (key) => { actions.push(['delete', name, key]); data[name].delete(key) } }) }
    fn(t)
  }
  const restoreConfirmedProject = new Function('db', 'getConfirmedProject', 'wrap', 'tx', code + '\nreturn restoreConfirmedProject')(
    async () => indexed, async () => checkpoint, async (promise) => promise, tx)
  await restoreConfirmedProject('p1')
  assert.equal(data.projects.get('p1').name, 'Confirmado')
  assert.deepEqual([...data.scenes.keys()], ['p1:scene1'])
  assert.deepEqual([...data.assets.keys()], ['p1:a'])
  assert.equal(data.confirmed.get('p1').dirty, false)
  assert.ok(actions.some(([op, store]) => op === 'delete' && store === 'assets'))
})

test('SAFE-S01-13 · se conserva el formato .lfproj y la seguridad del ZIP original', () => {
  assert.match(project, /missing\.length/)
  assert.match(dbSource, /confirmed.*keyPath: 'id'/)
  assert.match(dbSource, /DB_VER = [45]/)
  assert.match(project, /await db\.restoreConfirmedProject\(store\.project\.id\)/)
})
