// Proceso principal autónomo del Runtime exportado (se copia dentro del AppImage). Ventana única, sin menú; carga dist/runtime.html.
// Superficie mínima: el Runtime solo puede leer su paquete, salir y guardar/leer sus datos (ver preload.cjs). Sin red, sin ventanas
// nuevas, sin navegación fuera del Runtime; solo pantalla completa y captura de ratón para la página del juego.
const { app, BrowserWindow, Menu, ipcMain, session } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { pathToFileURL } = require('node:url')
const { createSaves } = require('./saves.cjs')

// Instancia única: una segunda ejecución solo trae la ventana existente al frente.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  main()
}

function main() {
  // Dentro de un AppImage el binario chrome-sandbox no puede ser setuid, así que el lanzador (AppRun) arranca con --no-sandbox.
  // El contenido que corre es el propio juego (sin red ni páginas externas, ver CSP y guardas de abajo). Quien quiera el sandbox
  // de Chromium (si su sistema permite espacios de nombres de usuario) puede ejecutar con GAME_SANDBOX=1.
  let config = { title: 'Juego', window: 'fullscreen', width: 1280, height: 720 }
  try { config = { ...config, ...JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')) } } catch { /* valores por defecto */ }

  const diagnostics = { devtools: config.diagnostics?.devtools === true, stats: config.diagnostics?.stats === true }
  const PAGE = pathToFileURL(path.join(__dirname, 'dist', 'runtime.html')).href
  const DIST = pathToFileURL(path.join(__dirname, 'dist') + path.sep).href
  const fromRuntime = (e) => { try { return e.senderFrame && e.senderFrame.url.startsWith(PAGE) } catch { return false } } // solo el Runtime propio habla con el proceso principal

  // ---- IPC (ver preload.cjs): paquete, salir y almacenamiento del jugador (síncrono para el Runtime; ver saves.cjs) ----
  let saves = null
  const S = () => saves || (saves = createSaves(path.join(app.getPath('userData'), 'saves')))
  ipcMain.handle('lf-runtime:game', (e) => { if (!fromRuntime(e)) throw new Error('no permitido'); return fs.promises.readFile(path.join(__dirname, 'game.rtpkg')) })
  ipcMain.handle('lf-runtime:game-entry', async (e, type, id) => {
    if (!fromRuntime(e)) throw new Error('no permitido')
    if (!config.streaming) return null
    if (type === 'game') return fs.promises.readFile(path.join(__dirname, 'game-data', 'game.json'), 'utf8')
    if ((type !== 'scene' && type !== 'file') || typeof id !== 'string' || !id || id.length > 200)
      throw new Error('Entrada del juego inválida')
    const name = type === 'scene' ? `scene-${encodeURIComponent(id)}.json` : `asset-${encodeURIComponent(id)}.bin`
    try {
      return await fs.promises.readFile(path.join(__dirname, 'game-data', name), type === 'scene' ? 'utf8' : undefined)
    } catch (error) {
      if (error.code === 'ENOENT') return null
      throw error
    }
  })
  ipcMain.handle('lf-runtime:loading-info', (e) => {
    if (!fromRuntime(e)) return null
    let image = ''
    if (config.splash === true) {
      try {
        const { splashDataUrl } = require('./startup-splash.cjs')
        image = splashDataUrl(path.join(__dirname, 'splash.image'))
      } catch (error) { console.warn('Splash del juego:', error.message) }
    }
    return { title: config.title, version: config.version, image }
  })
  ipcMain.handle('lf-runtime:diagnostics', (e) => { if (!fromRuntime(e)) throw new Error('no permitido'); return { stats: diagnostics.stats } })
  ipcMain.on('lf-runtime:quit', (e) => { if (fromRuntime(e)) app.quit() })
  ipcMain.on('lf-runtime:get', (e, k) => { e.returnValue = fromRuntime(e) ? S().get(k) : null })
  ipcMain.on('lf-runtime:set', (e, k, v) => { e.returnValue = fromRuntime(e) ? S().set(k, v) : false })
  ipcMain.on('lf-runtime:remove', (e, k) => { e.returnValue = fromRuntime(e) ? S().remove(k) : false })
  ipcMain.on('lf-runtime:keys', (e, p) => { e.returnValue = fromRuntime(e) ? S().keys(p) : [] })

  let win = null
  function createWindow() {
    Menu.setApplicationMenu(null)
    // El juego necesita Pointer Lock para la cámara FPS. No concederlo a otros contenidos ni subframes.
    const fromGamePage = (wc, requestUrl) => {
      if (!win || wc !== win.webContents || wc.getURL() !== PAGE) return false
      return !requestUrl || requestUrl === PAGE
    }
    const allowedPermission = (wc, permission, requestUrl) =>
      permission === 'fullscreen' || (permission === 'pointerLock' && fromGamePage(wc, requestUrl))
    // Mantener la política anterior de fullscreen; el resto sigue denegado.
    session.defaultSession.setPermissionRequestHandler((wc, permission, cb, details) =>
      cb(allowedPermission(wc, permission, details?.requestingUrl)))
    session.defaultSession.setPermissionCheckHandler((wc, permission, _origin, details) =>
      allowedPermission(wc, permission, details?.requestingUrl))
    win = new BrowserWindow({
      title: config.title,
      width: config.width, height: config.height,
      fullscreen: config.window === 'fullscreen',
      show: false,
      backgroundColor: '#000000',
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true, nodeIntegration: false, sandbox: true,
        webSecurity: true, allowRunningInsecureContent: false, spellcheck: false, backgroundThrottling: false,
        devTools: diagnostics.devtools, // permiso incorporado a esta exportación, nunca derivado del entorno
      },
    })
    const show = () => {
      if (config.window === 'maximized') win.maximize()
      win.show()
    }
    win.once('ready-to-show', show)
    const wc = win.webContents
    wc.setWindowOpenHandler(() => ({ action: 'deny' })) // ningún window.open
    wc.on('will-navigate', (e, url) => { if (url !== PAGE && !url.startsWith(PAGE + '?')) e.preventDefault() }) // no sale del Runtime
    wc.on('will-redirect', (e) => e.preventDefault())
    wc.on('will-attach-webview', (e) => e.preventDefault())
    // Solo se sirven archivos de dist/ (y blob:/data: que crea el propio juego); cualquier otra petición se cancela.
    session.defaultSession.webRequest.onBeforeRequest((d, cb) => {
      const u = d.url
      cb({ cancel: !(u.startsWith(DIST) || u.startsWith('blob:') || u.startsWith('data:') || (diagnostics.devtools && u.startsWith('devtools://'))) })
    })
    wc.on('before-input-event', (e, input) => {
      if (input.type !== 'keyDown') return
      const ctrlShift = input.control && input.shift && !input.alt && !input.meta
      if (ctrlShift && input.key === 'F12') {
        e.preventDefault()
        if (diagnostics.devtools && !input.isAutoRepeat && fromGamePage(wc)) wc.toggleDevTools()
        return
      }
      if (ctrlShift && input.key === 'F3') {
        e.preventDefault()
        if (diagnostics.stats && !input.isAutoRepeat && fromGamePage(wc)) wc.send('lf-runtime:stats-toggle')
        return
      }
      // Evita las combinaciones habituales de DevTools cuando la compilación solo habilita el acceso NGME.
      if (diagnostics.devtools && (input.key === 'F12' || (ctrlShift && input.key?.toLowerCase() === 'i'))) { e.preventDefault(); return }
      if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault() }
    })
    win.on('closed', () => { win = null })
    win.loadFile(path.join(__dirname, 'dist', 'runtime.html'))
  }

  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus() } })
  app.whenReady().then(createWindow)
  app.on('window-all-closed', () => app.quit())
}
