// Proceso principal de Electron: una ventana sin marco nativo (sin barra de título ni menú de Electron)
// y sin menú contextual del navegador. La interfaz (Vue) dibuja su propia barra superior.
const { app, BrowserWindow, Menu, shell, dialog, ipcMain, session, safeStorage, screen } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { createRecoverySession } = require('./recovery-session.cjs')
const { createFilmMobileBridge } = require('./filmmaker-mobile-bridge.cjs')
const { loadEditorConfig, saveEditorPreferences, publicConfig } = require('./editor-config.cjs')

const DEV_URL = process.env.VITE_DEV_URL // lo define scripts/electron-dev.mjs
const BAR_H = 36 // alto de la barra superior de la interfaz (MenuBar.vue)
const WINDOW_CHROME = new Map([
  ['editor', { color: '#0e1116', symbolColor: '#bfc4cc' }],
])

const editorConfigPath = () => path.join(app.getPath('userData'), 'editor.toml')
const editorChrome = (mode, config) => mode === 'editor' && config
  ? { color: config.css['--editor-chrome'], symbolColor: config.css['--text-2'] }
  : WINDOW_CHROME.get(mode)
function setEditorChrome(win) {
  if (process.platform === 'darwin') return
  const config = win.__lfEditorConfig
  win.setTitleBarOverlay({ ...editorChrome(win.__lfChromeMode, config), height: Math.round(BAR_H * (config?.scale ?? 1)) })
}
function applyEditorConfig(win, config) {
  win.__lfEditorConfig = config
  win.webContents.setZoomFactor(config.scale)
  setEditorChrome(win)
  for (const tool of win.__lfTools) configureToolWindow(tool, config)
  return publicConfig(config)
}
const editorWindow = (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  return win?.__lfEditorConfig && event.senderFrame === event.sender.mainFrame ? win : null
}

if (!app.requestSingleInstanceLock()) app.quit()
let recoverySession = null
let allEditorClosuresSafe = true
ipcMain.handle('lf:recovery-state', () => ({ interrupted: !!recoverySession?.interrupted }))
ipcMain.on('lf:window-chrome', (event, mode) => {
  const win = editorWindow(event)
  if (!win || !WINDOW_CHROME.has(mode)) return
  win.__lfChromeMode = mode
  setEditorChrome(win)
})
ipcMain.handle('lf:editor-config', (event, reload) => {
  const win = editorWindow(event)
  if (!win) return null
  return reload ? applyEditorConfig(win, loadEditorConfig(editorConfigPath())) : publicConfig(win.__lfEditorConfig)
})
ipcMain.handle('lf:save-editor-preferences', (event, prefs) => {
  const win = editorWindow(event)
  if (!win) return null
  return applyEditorConfig(win, saveEditorPreferences(editorConfigPath(), prefs))
})
ipcMain.handle('lf:open-editor-config', (event) => editorWindow(event) ? shell.openPath(editorConfigPath()) : 'Preferencias no disponibles.')
ipcMain.on('lf:begin-tool-window-drag', (event, id) => {
  const owner = editorWindow(event)
  if (!owner || typeof id !== 'string' || !/^[A-Za-z][\w-]{0,63}$/.test(id)) return
  if (owner.__lfToolDrag?.tool && !owner.__lfToolDrag.tool.isDestroyed()) {
    owner.__lfToolDrag.tool.setIgnoreMouseEvents(false)
  }
  owner.__lfToolDrag = { id, tool: null }
})
ipcMain.on('lf:end-tool-window-drag', (event, id) => {
  const owner = editorWindow(event)
  const drag = owner?.__lfToolDrag
  if (!drag || drag.id !== id) return
  if (drag.tool && !drag.tool.isDestroyed()) drag.tool.setIgnoreMouseEvents(false)
  owner.__lfToolDrag = null
})
ipcMain.on('lf:move-tool-window', (event, name, x, y) => {
  const owner = editorWindow(event)
  if (!owner || typeof name !== 'string' || !/^lf-tool-(code|events|shaderEditor|shaderGraph|panel-\d+)$/.test(name) || !Number.isFinite(x) || !Number.isFinite(y)) return
  const tool = [...owner.__lfTools].find(w => !w.isDestroyed() && w.__lfToolName === name)
  if (!tool) return
  requestToolPosition(tool, Math.round(x), Math.round(y))
})

const toolPositionDiagnostics = new WeakMap()
function requestToolPosition(tool, x, y) {
  const previous = toolPositionDiagnostics.get(tool)
  if (previous?.timer) clearTimeout(previous.timer)
  const record = { requested: [x, y], status: previous?.status, timer: null }
  toolPositionDiagnostics.set(tool, record)
  const report = (status, actual, error) => {
    if (record.status === status) return
    record.status = status
    const details = { window: tool.id, requested: record.requested, actual,
      requestedBackend: app.commandLine.getSwitchValue('ozone-platform') || null,
      sessionType: process.env.XDG_SESSION_TYPE || null, status, ...(error ? { error: String(error.message || error).slice(0, 512) } : {}) }
    if (status === 'observed') console.info('[Century/Docking] window-position', details)
    else console.warn('[Century/Docking] window-position', details)
  }
  try { tool.setPosition(x, y) }
  catch (error) { report('rejected', null, error); return }
  record.timer = setTimeout(() => {
    record.timer = null
    if (tool.isDestroyed()) return
    try {
      const actual = tool.getPosition()
      report(actual[0] === x && actual[1] === y ? 'observed' : 'unconfirmed', actual)
    } catch (error) { report('unavailable', null, error) }
  }, 200)
  record.timer.unref?.()
}

function recoverToolWindowPosition(tool) {
  const bounds = tool.getBounds()
  const grip = { x: bounds.x, y: bounds.y, width: Math.min(90, bounds.width), height: Math.min(24, bounds.height) }
  const visible = screen.getAllDisplays().some(({ workArea: r }) =>
    grip.x >= r.x && grip.y >= r.y && grip.x + grip.width <= r.x + r.width && grip.y + grip.height <= r.y + r.height)
  if (visible) return
  const r = screen.getDisplayMatching(bounds).workArea
  const x = Math.max(r.x, Math.min(bounds.x, r.x + r.width - grip.width))
  const y = Math.max(r.y, Math.min(bounds.y, r.y + r.height - grip.height))
  try { tool.setPosition(x, y) } catch (error) { console.warn('[Century/Docking] window-position-unavailable', error.message) }
}

function configureToolWindow(win, config) {
  if (!config || win.isDestroyed()) return
  win.webContents.setZoomFactor(config.scale)
  if (process.platform !== 'darwin') win.setTitleBarOverlay({ ...editorChrome('editor', config), height: Math.round(BAR_H * config.scale) })
}

// Sesión acotada al WebContents de FilmMaker. Ninguna ventana Century puede gobernar el enlace.
const filmBridge = createFilmMobileBridge({
  onAnswer: (id, answer) => {
    const window = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && w.webContents.id === id)
    if (window) window.webContents.send('lf:film-mobile-answer', answer)
  },
})
const isFilmWindow = (sender) => BrowserWindow.fromWebContents(sender)?.__lfFilmMaker === true
// Solicitudes de películas nativas: sólo el editor con el proyecto abierto puede escribirlas.
// Electron intermedia, pero no guarda una segunda copia del proyecto.
let cinematicRequestSeq = 0
const cinematicRequests = new Map()
ipcMain.on('lf:cinematic-project', (e, projectId) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win || win.__lfFilmMaker) return
  win.__lfProjectId = typeof projectId === 'string' && projectId ? projectId : null
})
ipcMain.handle('lf:cinematic', (e, action, payload) => {
  const filmWin = BrowserWindow.fromWebContents(e.sender)
  if (!filmWin?.__lfFilmMaker || !filmWin.__lfCinematicContext) throw new Error('Esta ventana no está vinculada a un Cinematic nativo')
  const context = filmWin.__lfCinematicContext
  if (!['open', 'save'].includes(action) || payload?.projectId !== context.projectId || payload?.cinematicId !== context.cinematicId)
    throw new Error('Solicitud Cinematic fuera del recurso autorizado')
  const editors = BrowserWindow.getAllWindows().filter(w => !w.isDestroyed() && !w.__lfFilmMaker && w.__lfProjectId === context.projectId)
  if (!editors.length) throw new Error('El proyecto original debe permanecer abierto en Century')
  if (editors.length !== 1) throw new Error('Conflicto: varias ventanas Century editarían el mismo proyecto')
  const editor = editors[0]
  return new Promise((resolve, reject) => {
    const id = ++cinematicRequestSeq
    const timeout = setTimeout(() => {
      cinematicRequests.delete(id)
      reject(new Error('Century no respondió a la solicitud de Cinematic'))
    }, 30000)
    cinematicRequests.set(id, { resolve, reject, timeout, editor: editor.webContents, requester: e.sender })
    editor.webContents.send('lf:cinematic-request', { id, action, payload })
  })
})
ipcMain.on('lf:cinematic-result', (e, id, response) => {
  const request = cinematicRequests.get(id)
  if (!request || request.editor !== e.sender) return
  cinematicRequests.delete(id); clearTimeout(request.timeout)
  if (request.requester.isDestroyed()) return
  if (response?.ok) request.resolve(response.result)
  else request.reject(new Error(response?.error || 'Guardado cinematográfico fallido'))
})

ipcMain.handle('lf:film-mobile-start', (event, offer, production) => {
  if (!isFilmWindow(event.sender)) throw new Error('Solo FilmMaker puede iniciar una cámara móvil')
  return filmBridge.start(event.sender.id, offer, production)
})
ipcMain.handle('lf:film-mobile-stop', (event) => {
  if (!filmBridge.isOwner(event.sender.id)) return false
  filmBridge.stop(); return true
})
ipcMain.handle('lf:film-mobile-resources', (event) => {
  if (!isFilmWindow(event.sender) || !filmBridge.isOwner(event.sender.id)) return null
  // Métrica agregada de procesos Electron, no CPU/RAM total del sistema.
  const metrics = app.getAppMetrics()
  const cpu = metrics.reduce((sum, metric) => sum + (Number(metric.cpu?.percentCPUUsage) || 0), 0)
  const memory = metrics.reduce((sum, metric) => sum + (Number(metric.memory?.workingSetSize) || 0), 0)
  return { cpuPercent: Math.round(cpu * 10) / 10, memoryMiB: Math.round(memory / 1024) }
})

// ---- acceso al disco (solo dentro de carpetas que el usuario eligió con el diálogo del sistema) ----
const rootsFile = () => path.join(app.getPath('userData'), 'roots.json')
let roots = new Set()
try { roots = new Set(JSON.parse(fs.readFileSync(rootsFile(), 'utf8'))) } catch { /* primera vez */ }
const saveRoots = () => { try { fs.writeFileSync(rootsFile(), JSON.stringify([...roots])) } catch { /* ignorar */ } }
function resolveIn(root, rel) {
  const r = path.resolve(root)
  if (![...roots].some((x) => r === x || r.startsWith(x + path.sep))) throw new Error('Carpeta no autorizada: ' + root)
  const full = path.resolve(r, rel || '.')
  if (full !== r && !full.startsWith(r + path.sep)) throw new Error('Ruta fuera de la carpeta: ' + rel)
  return full
}
// Git integrado: operaciones acotadas al directorio de proyecto autorizado.
require('./vcs.cjs').registerVcsIpc(ipcMain, { authorize: (root) => resolveIn(root, '.'), packaged: app.isPackaged, resourcesPath: process.resourcesPath, appPath: path.join(__dirname,'..'), secretStore: require('./vcs-credentials.cjs').createCredentialStore(safeStorage, app.getPath('userData')) })
ipcMain.handle('lf:pickDir', async (e, opts = {}) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  const res = await dialog.showOpenDialog(win, { title: opts.title || 'Elegir carpeta', properties: ['openDirectory', 'createDirectory'] })
  if (res.canceled || !res.filePaths[0]) return null
  const p = path.resolve(res.filePaths[0])
  roots.add(p); saveRoots()
  return p
})
ipcMain.handle('lf:exists', (e, root, rel) => fs.existsSync(resolveIn(root, rel)))
ipcMain.handle('lf:listDirs', (e, root, rel) => { try { return fs.readdirSync(resolveIn(root, rel), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) } catch { return [] } })
ipcMain.handle('lf:readFile', (e, root, rel) => { try { return fs.readFileSync(resolveIn(root, rel)) } catch { return null } })
ipcMain.handle('lf:scan', (e, root, rel, ext = '') => { // todos los archivos bajo `rel`, recursivo: [{ path, mtime, size }]
  const out = [], base = resolveIn(root, rel), top = path.resolve(root)
  const walk = (dir, depth) => {
    if (depth > 8 || out.length > 3000) return
    let list = []
    try { list = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const d of list) {
      const full = path.join(dir, d.name)
      if (d.isDirectory()) walk(full, depth + 1)
      else if (d.isFile() && !d.name.endsWith('.lftmp') && (!ext || d.name.endsWith(ext))) { try { const st = fs.statSync(full); out.push({ path: path.relative(top, full).split(path.sep).join('/'), mtime: Math.round(st.mtimeMs), size: st.size }) } catch { /* desapareció */ } }
    }
  }
  walk(base, 0)
  return out
})
ipcMain.handle('lf:mkdir', (e, root, rel) => { const f = resolveIn(root, rel); fs.mkdirSync(f, { recursive: true }); return f })
ipcMain.handle('lf:writeFiles', (e, root, files, remove = []) => {
  for (const r of remove) { try { fs.rmSync(resolveIn(root, r), { force: true }) } catch { /* ya no existe */ } }
  for (const f of files) {
    const full = resolveIn(root, f.path)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    // escritura atómica: primero a un temporal y luego renombrar, así un cierre a mitad no deja el proyecto a medias
    const tmp = full + '.lftmp'
    fs.writeFileSync(tmp, typeof f.data === 'string' ? f.data : Buffer.from(f.data))
    fs.renameSync(tmp, full)
  }
  return true
})

// ---- abrir el proyecto en VS Code con un archivo opcional ----
const { openVSCode } = require('./vscode.cjs')
const { createVSCodeBridge } = require('./vscode-bridge.cjs')
const vscodeBundleDir = path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, '..', 'vendor'), 'vscode-extension')
const vscodeBridge = createVSCodeBridge({
  minimumVersion: JSON.parse(fs.readFileSync(path.join(vscodeBundleDir, 'manifest.json'), 'utf8')).version,
  launch: (dir, file, options) => openVSCode(dir, file, { bundleDir: vscodeBundleDir, home: app.getPath('home'), ...options }),
})
const vscodeRetryDialogs = new WeakMap()
ipcMain.handle('lf:insertNodeVSCode', async (_event, root, nodeId) => {
  const dir = resolveIn(root, '.')
  if (!fs.statSync(resolveIn(dir, 'project.lfproj'), { throwIfNoEntry: false })?.isFile()) return { ok:false, error:'Guarda el proyecto antes de insertar nodos en VS Code.' }
  return vscodeBridge.insertNode(dir, nodeId)
})
ipcMain.handle('lf:releaseVSCode', async (e, root) => { await vscodeBridge.release(resolveIn(root, '.')); return true })
ipcMain.handle('lf:openVSCode', async (e, root, file = null) => {
  const dir = resolveIn(root, '.')
  if (!fs.statSync(resolveIn(dir, 'project.lfproj'), { throwIfNoEntry: false })?.isFile()) {
    return { ok: false, error: 'La carpeta no contiene un project.lfproj guardado.' }
  }
  const script = file === null ? null : resolveIn(dir, file)
  if (script && (!file.startsWith('Assets/') || !file.endsWith('.js') ||
      !fs.statSync(script, { throwIfNoEntry: false })?.isFile())) {
    return { ok: false, error: 'El script no está disponible en la carpeta Assets del proyecto.' }
  }
  const options = { onPhase: phase => { if (!e.sender.isDestroyed()) e.sender.send('lf:vscode-status', { root, file, phase }) } }
  while (!e.sender.isDestroyed()) {
    const result = await vscodeBridge.open(dir, script, options)
    if (result.ok || result.canceled) return result
    options.onPhase('failed')
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win || win.isDestroyed()) return result
    let pending = vscodeRetryDialogs.get(win)
    if (!pending) {
      pending = dialog.showMessageBox(win, {
        type: 'error', title: 'Abrir en VS Code', message: 'No se pudo completar la apertura.',
        detail: result.error, buttons: ['Reintentar', 'Cancelar'], defaultId: 0, cancelId: 1,
      }).finally(() => { if (vscodeRetryDialogs.get(win) === pending) vscodeRetryDialogs.delete(win) })
      vscodeRetryDialogs.set(win, pending)
    }
    const answer = await pending
    if (answer.response !== 0) return { ...result, canceled: true }
  }
  return { ok: false, canceled: true }
})

// ---- exportar el juego como AppImage (ver electron/appimage.cjs) ----
const { exportAppImage, slugOf } = require('./appimage.cjs')
ipcMain.handle('lf:exportAppImage', async (e, o) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (process.platform !== 'linux') throw new Error('La exportación a AppImage solo está disponible en Linux')
  // LF_TEST_EXPORT_PATH: solo para las pruebas automáticas (sin diálogo)
  const res = process.env.LF_TEST_EXPORT_PATH ? { filePath: process.env.LF_TEST_EXPORT_PATH } : await dialog.showSaveDialog(win, {
    title: 'Exportar juego como AppImage',
    defaultPath: path.join(app.getPath('documents'), `${slugOf(o.name)}-x86_64.AppImage`),
    filters: [{ name: 'AppImage', extensions: ['AppImage'] }],
  })
  if (res.canceled || !res.filePath) return { canceled: true }
  let out = res.filePath
  if (!/\.AppImage$/i.test(out)) out += '.AppImage'
  const r = await exportAppImage({
    outPath: out, name: o.name, version: o.version, gameBytes: Buffer.from(o.bytes), icon: o.icon ? Buffer.from(o.icon) : null,
    splash: o.splash ? Buffer.from(o.splash) : null, streaming: o.streaming === true,
    window: o.window, width: o.width, height: o.height, distDir: path.join(app.getAppPath(), 'dist-runtime'),
    diagnostics: { devtools: o.diagnostics?.devtools === true, stats: o.diagnostics?.stats === true },
    onProgress: (p) => { try { e.sender.send('lf:export-progress', p) } catch { /* ventana cerrada */ } },
  })
  return { ok: true, path: r.path, size: r.size }
})
ipcMain.handle('lf:showItem', (e, p) => { try { shell.showItemInFolder(String(p)) } catch { /* nada */ } })

/** `page`: 'index' (Century) o 'filmmaker' (Nether Film Maker, con marco nativo normal). */
function createWindow(page = 'index', cinematicContext = null) {
  const film = page === 'filmmaker'
  const config = film ? null : loadEditorConfig(editorConfigPath())
  const win = new BrowserWindow({
    width: film ? 1280 : 1440,
    height: film ? 800 : 900,
    minWidth: film ? 360 : 720,
    minHeight: 480,
    show: false,
    backgroundColor: config?.css['--g-900'] || '#0d0d0d',
    title: film ? 'Nether Film Maker' : 'Century',
    autoHideMenuBar: true,
    // Sin barra de título nativa. Windows/Linux conservan los botones minimizar · maximizar · cerrar superpuestos
    // sobre nuestra barra (titleBarOverlay); en macOS quedan los tres semáforos a la izquierda.
    ...(film ? {} : { titleBarStyle: 'hidden', titleBarOverlay: { ...editorChrome('editor', config), height: Math.round(BAR_H * config.scale) }, trafficLightPosition: { x: 12, y: 10 } }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      zoomFactor: config?.scale ?? 1,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false, // evita el subrayado y su menú contextual en los campos de texto
      backgroundThrottling: false,
    },
  })

  win.__lfFilmMaker = film
  win.__lfEditorConfig = config
  win.__lfChromeMode = 'editor'
  win.__lfTools = new Set()
  win.__lfToolDrag = null
  win.__lfCinematicContext = film ? cinematicContext : null
  const rendererId = win.webContents.id // El id sigue siendo válido después de destruir la ventana.
  win.once('ready-to-show', () => { if (!win.isDestroyed()) win.show() })

  // El proceso principal no cierra hasta recibir una decisión explícita de la interfaz.
  // Sin temporizador de cierre forzado: un error o un diálogo abierto conserva la ventana.
  let hooked = false, closing = false
  const onHook = (e) => { if (e.sender === win.webContents) hooked = true }
  const onResult = (e, decision) => {
    if (e.sender !== win.webContents || !closing) return
    if (decision === 'close') { closing = 'done'; if (typeof film !== 'undefined' && !film) allEditorClosuresSafe = true; win.close() }
    else closing = false // cancelar o fallo de guardado: sigue abierta
  }
  ipcMain.on('lf:close-hook', onHook)
  ipcMain.on('lf:close-result', onResult)
  win.on('close', (e) => {
    if (closing === 'done' || !hooked || win.webContents.isDestroyed()) return
    e.preventDefault()
    if (closing) return
    closing = true
    win.webContents.send('lf:before-close')
  })
  // Una recarga o caída del renderer invalida el hook anterior.
  win.webContents.on('did-start-navigation', () => { hooked = false; closing = false; filmBridge.stopIfOwner(rendererId) })
  win.webContents.on('render-process-gone', () => { hooked = false; closing = false; if (!film) { allEditorClosuresSafe = false; recoverySession?.rendererCrashed() } })
  win.on('closed', () => {
    for (const tool of [...win.__lfTools]) if (!tool.isDestroyed()) tool.close()
    filmBridge.stopIfOwner(rendererId)
    if (typeof film !== 'undefined' && !film && closing !== 'done') allEditorClosuresSafe = false
    ipcMain.removeListener('lf:close-hook', onHook)
    ipcMain.removeListener('lf:close-result', onResult)
  })

  // Sin menú contextual nativo: el editor tiene sus propios menús (jerarquía, proyecto, Shift+A…).
  win.webContents.on('context-menu', (e) => e.preventDefault())

  // Nada de navegar fuera de la app; los enlaces externos se abren en el navegador del sistema.
  win.webContents.setWindowOpenHandler(({ url, frameName }) => {
    if (!film && url === 'about:blank' && /^lf-tool-(code|events|shaderEditor|shaderGraph|panel-\d+)$/.test(frameName)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          titleBarStyle: 'hidden',
          titleBarOverlay: { ...editorChrome('editor', win.__lfEditorConfig), height: Math.round(BAR_H * win.__lfEditorConfig.scale) },
          minWidth: 340,
          minHeight: 250,
          modal: false,
          show: false,
          backgroundColor: win.__lfEditorConfig.css['--g-850'],
          autoHideMenuBar: true,
        },
      }
    }
    if (/^https?:/i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('did-create-window', (tool, details) => {
    if (/^lf-tool-(code|events|shaderEditor|shaderGraph|panel-\d+)$/.test(details?.frameName || '')) tool.setParentWindow(null)
    tool.__lfToolName = details?.frameName
    win.__lfTools.add(tool)
    const drag = win.__lfToolDrag
    if (drag && !drag.tool) {
      drag.tool = tool
      // El popup no roba el pointerup al editor mientras el gesto original
      // continúa; así la ventana puede seguir al cursor sin saltos.
      tool.setIgnoreMouseEvents(true, { forward: true })
    } else recoverToolWindowPosition(tool)
    tool.once('closed', () => {
      clearTimeout(toolPositionDiagnostics.get(tool)?.timer)
      toolPositionDiagnostics.delete(tool)
      win.__lfTools.delete(tool)
      if (win.__lfToolDrag?.tool === tool) win.__lfToolDrag = null
    })
    configureToolWindow(tool, win.__lfEditorConfig)
    tool.showInactive()
    tool.removeMenu()
    tool.webContents.on('will-navigate', (event) => event.preventDefault())
    tool.webContents.on('context-menu', (event) => event.preventDefault())
    tool.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:/i.test(url)) shell.openExternal(url)
      return { action: 'deny' }
    })
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (DEV_URL ? !url.startsWith(DEV_URL) : !url.startsWith('file://')) e.preventDefault()
  })

  // En builds locales, F12 y Ctrl+Shift+I abren DevTools también en FilmMaker.
  // Las aplicaciones distribuidas conservan el acceso previo: FilmMaker no habilita DevTools en el AppImage.
  if (!film || DEV_URL || !app.isPackaged) win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'F12' || ((input.control || input.meta) && input.shift && input.key?.toLowerCase() === 'i')) {
      e.preventDefault()
      if (!input.isAutoRepeat) win.webContents.toggleDevTools()
      return
    }
    if (DEV_URL && (input.control || input.meta) && input.key?.toLowerCase() === 'r') {
      win.webContents.reload()
      e.preventDefault()
    }
  })

  if (DEV_URL) {
    const target = new URL(film ? 'filmmaker.html' : '', DEV_URL)
    if (film && cinematicContext) { target.searchParams.set('project', cinematicContext.projectId); target.searchParams.set('cinematic', cinematicContext.cinematicId) }
    win.loadURL(target.href)
  } else {
    const index = path.join(__dirname, '..', 'dist', film ? 'filmmaker.html' : 'index.html')
    if (fs.existsSync(index)) win.loadFile(index, film && cinematicContext ? { query: { project: cinematicContext.projectId, cinematic: cinematicContext.cinematicId } } : {})
    else {
      const msg = '<body style="background:#0d0d0d;color:#e2e2e2;font:14px system-ui;padding:40px"><h2>Falta compilar la interfaz</h2><p>Cierra esta ventana y ejecuta <code>npm run build</code> en la carpeta del proyecto.</p></body>'
      win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(msg))
    }
  }
  return win
}

app.whenReady().then(() => {
  recoverySession = createRecoverySession(path.join(app.getPath('userData'), 'editor-session.json'))
  if (process.platform === 'darwin') {
    // macOS necesita un menú mínimo para que Cmd+C / Cmd+V / Cmd+Q funcionen; vive en la barra del sistema, no en la ventana.
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]))
  } else {
    Menu.setApplicationMenu(null) // sin menú de Electron (Archivo / Editar / Ver / Ayuda…)
  }

  // Nether Film Maker usa la cámara (o la webcam) para la pasada del actor y los sensores/AR para el camarógrafo
  // Jugar (F5) captura el ratón: sin «pointerLock» el jugador no recibía el control (no se podía mover ni mirar)
  const ALLOW = ['media', 'mediaKeySystem', 'sensors', 'pointerLock', 'fullscreen', 'keyboardLock', 'clipboard-sanitized-write']
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(ALLOW.includes(perm)))
  session.defaultSession.setPermissionCheckHandler((wc, perm) => ALLOW.includes(perm))
  // `--filmmaker`: arranca directamente en Nether Film Maker
  let win = createWindow(process.argv.includes('--filmmaker') ? 'filmmaker' : 'index')
  ipcMain.handle('lf:openFilmmaker', (event, context = null) => {
    const caller = BrowserWindow.fromWebContents(event.sender)
    if (!caller || caller.__lfFilmMaker) throw new Error('FilmMaker sólo se abre desde Century')
    if (context && (caller.__lfProjectId !== context.projectId || !context.cinematicId)) throw new Error('Proyecto Cinematic no autorizado')
    const w = createWindow('filmmaker', context); return !!w
  })
  app.on('second-instance', () => {
    const active = win && !win.isDestroyed()
      ? win
      : BrowserWindow.getAllWindows().find((window) => !window.isDestroyed() && window.__lfFilmMaker !== undefined)
    if (!active) {
      win = createWindow(process.argv.includes('--filmmaker') ? 'filmmaker' : 'index')
      return
    }
    win = active
    if (win.isMinimized()) win.restore()
    win.focus()
  })
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) win = createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

let vscodeBridgeClosed = false
app.on('will-quit', (event) => {
  filmBridge.stop()
  if (!vscodeBridgeClosed) {
    event.preventDefault()
    vscodeBridge.close().catch(() => {}).finally(() => { vscodeBridgeClosed = true; app.quit() })
    return
  }
  if (allEditorClosuresSafe) { try { recoverySession?.markClean() } catch (err) { console.error('No se pudo confirmar el cierre normal:', err) } } })
