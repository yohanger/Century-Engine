const { contextBridge, ipcRenderer } = require('electron')
// Superficie mínima del juego hacia el proceso principal: leer el paquete, salir y el almacenamiento del jugador (síncrono, contrato del host).
contextBridge.exposeInMainWorld('lfRuntime', {
  loadGame: () => ipcRenderer.invoke('lf-runtime:game'),
  gameEntry: (type, id) => ipcRenderer.invoke('lf-runtime:game-entry', type, id),
  loadingInfo: () => ipcRenderer.invoke('lf-runtime:loading-info'),
  quit: () => ipcRenderer.send('lf-runtime:quit'),
  diagnostics: {
    permissions: () => ipcRenderer.invoke('lf-runtime:diagnostics'),
    onStatsToggle: (fn) => {
      const onToggle = () => fn()
      ipcRenderer.on('lf-runtime:stats-toggle', onToggle)
      return () => ipcRenderer.removeListener('lf-runtime:stats-toggle', onToggle)
    },
  },
  storage: {
    get: (k) => ipcRenderer.sendSync('lf-runtime:get', String(k)),
    set: (k, v) => ipcRenderer.sendSync('lf-runtime:set', String(k), String(v)),
    remove: (k) => ipcRenderer.sendSync('lf-runtime:remove', String(k)),
    keys: (p) => ipcRenderer.sendSync('lf-runtime:keys', String(p)),
  },
})
