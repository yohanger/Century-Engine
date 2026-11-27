// Puente seguro: la interfaz sabe que corre en Electron y accede al disco solo a través de estas funciones.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('lf', {
  isElectron: true,
  setWindowChrome: (mode) => ipcRenderer.send('lf:window-chrome', mode),
  beginToolWindowDrag: (id) => ipcRenderer.send('lf:begin-tool-window-drag', id),
  endToolWindowDrag: (id) => ipcRenderer.send('lf:end-tool-window-drag', id),
  moveToolWindow: (name, x, y) => ipcRenderer.send('lf:move-tool-window', name, x, y),
  editorConfig: (reload = false) => ipcRenderer.invoke('lf:editor-config', reload),
  saveEditorPreferences: (prefs) => ipcRenderer.invoke('lf:save-editor-preferences', prefs),
  openEditorConfig: () => ipcRenderer.invoke('lf:open-editor-config'),
  recoveryState: () => ipcRenderer.invoke('lf:recovery-state'),
  platform: process.platform,
  // La interfaz se registra aquí; al cerrar la ventana, el proceso principal espera a que termine de guardar.
  onBeforeClose: (cb) => {
    ipcRenderer.on('lf:before-close', async () => {
      let decision = 'cancel'
      try { decision = (await cb()) === 'close' ? 'close' : 'cancel' }
      catch (e) { console.error('Cierre cancelado por error:', e) }
      ipcRenderer.send('lf:close-result', decision)
    })
    ipcRenderer.send('lf:close-hook')
  },
  // Exportación del juego a AppImage: devuelve { ok, path, size } o { canceled }. `onProgress({ phase, done, total })`.
  exportAppImage: async (opts, onProgress) => {
    const h = (_e, p) => { try { onProgress?.(p) } catch { /* ignorar */ } }
    ipcRenderer.on('lf:export-progress', h)
    try { return await ipcRenderer.invoke('lf:exportAppImage', opts) } finally { ipcRenderer.removeListener('lf:export-progress', h) }
  },
  showItem: (p) => ipcRenderer.invoke('lf:showItem', p),
  openFilmmaker: (context = null) => ipcRenderer.invoke('lf:openFilmmaker', context),
  setCinematicProject: (projectId) => ipcRenderer.send('lf:cinematic-project', projectId),
  onCinematicRequest: (callback) => {
    const listener = (_e, request) => {
      Promise.resolve().then(() => callback(request.action, request.payload)).then(
        result => ipcRenderer.send('lf:cinematic-result', request.id, { ok: true, result }),
        error => ipcRenderer.send('lf:cinematic-result', request.id, { ok: false, error: error?.message || String(error) }),
      )
    }
    ipcRenderer.on('lf:cinematic-request', listener)
    return () => ipcRenderer.removeListener('lf:cinematic-request', listener)
  },
  cinematic: (action, payload) => ipcRenderer.invoke('lf:cinematic', action, payload),
  filmMobileBridge: {
    start: (offer, production) => ipcRenderer.invoke('lf:film-mobile-start', offer, production),
    stop: () => ipcRenderer.invoke('lf:film-mobile-stop'),
    resources: () => ipcRenderer.invoke('lf:film-mobile-resources'),
    onAnswer: (callback) => {
      const listener = (_event, answer) => callback(answer)
      ipcRenderer.on('lf:film-mobile-answer', listener)
      return () => ipcRenderer.removeListener('lf:film-mobile-answer', listener)
    },
  },
  openVSCode: (root, file) => ipcRenderer.invoke('lf:openVSCode', root, file),
  insertNodeVSCode: (root, nodeId) => ipcRenderer.invoke('lf:insertNodeVSCode', root, nodeId),
  releaseVSCode: (root) => ipcRenderer.invoke('lf:releaseVSCode', root),
  onVSCodeStatus: (callback) => {
    const listener = (_event, status) => callback(status)
    ipcRenderer.on('lf:vscode-status', listener)
    return () => ipcRenderer.removeListener('lf:vscode-status', listener)
  },
  vcs: { execute: (action, root, data) => ipcRenderer.invoke('lf:vcs', action, root, data) },
  fs: {
    pickDir: (opts) => ipcRenderer.invoke('lf:pickDir', opts),
    exists: (root, rel) => ipcRenderer.invoke('lf:exists', root, rel),
    listDirs: (root, rel) => ipcRenderer.invoke('lf:listDirs', root, rel),
    readFile: (root, rel) => ipcRenderer.invoke('lf:readFile', root, rel),
    scan: (root, rel, ext) => ipcRenderer.invoke('lf:scan', root, rel, ext),
    mkdir: (root, rel) => ipcRenderer.invoke('lf:mkdir', root, rel),
    writeFiles: (root, files, remove) => ipcRenderer.invoke('lf:writeFiles', root, files, remove),
  },
})
