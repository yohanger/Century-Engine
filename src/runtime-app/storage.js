// Almacenamiento de la aplicación de juego exportada (ajustes y partidas), síncrono (contrato del host).
// En Electron lo guarda el proceso principal en disco (escritura atómica, con versión); en el navegador (pruebas) usa localStorage.
const PRE = 'rt-x/'

export function createStorage() {
  const ipc = /** @type {any} */ (window).lfRuntime?.storage
  if (ipc) return {
    get: (k) => { try { return ipc.get(k) } catch { return null } },
    set: (k, v) => { if (!ipc.set(k, v)) throw new Error('No se pudo guardar en disco') },
    remove: (k) => { try { ipc.remove(k) } catch { /* nada */ } },
    keys: (p) => { try { return ipc.keys(p) } catch { return [] } },
  }
  return {
    get: (k) => { try { return localStorage.getItem(PRE + k) } catch { return null } },
    set: (k, v) => localStorage.setItem(PRE + k, v),
    remove: (k) => { try { localStorage.removeItem(PRE + k) } catch { /* nada */ } },
    keys: (p) => { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(PRE + p)) out.push(k.slice(PRE.length)) } } catch { /* nada */ } return out },
  }
}
