// Puerta única del motor al navegador/Electron. El código del motor (core/, engine/) no toca `document`/`window` directamente: pide aquí
// lo que necesita (lienzos, escuchas globales, bloqueo del puntero). Así el motor puede ejecutarse sin DOM
// (pruebas, servidor) sustituyendo esta capa, y cada acceso a la plataforma queda localizado y auditable.
// Excepciones deliberadas, con motivo (ver scripts/check-layers.mjs): audio/engine.js (Web Audio), disk.js (File System Access),
// tooltips.js (ayuda emergente del editor) y engine/render/viewport.js (el lienzo WebGL y sus eventos).
const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined'

/** Lienzo 2D/WebGL nuevo, con tamaño opcional. */
export function makeCanvas(w, h) {
  const c = document.createElement('canvas')
  if (w != null) { c.width = w; c.height = h ?? w }
  return c
}
/** Elemento HTML suelto (los editores de código y el selector de archivos lo usan). */
export const makeEl = (tag) => document.createElement(tag)
/** Elemento SVG suelto. */
export const makeSvg = (tag = 'svg') => document.createElementNS('http://www.w3.org/2000/svg', tag)

/** Escuchas globales y tamaño de la ventana. Sin DOM no hacen nada. */
export const win = {
  addEventListener: (...a) => { if (hasDom) window.addEventListener(...a) },
  removeEventListener: (...a) => { if (hasDom) window.removeEventListener(...a) },
  get innerWidth() { return hasDom ? window.innerWidth : 0 },
  get innerHeight() { return hasDom ? window.innerHeight : 0 },
}
/** Escuchas del documento y bloqueo del puntero (mirar con el ratón en el juego). */
export const doc = {
  addEventListener: (...a) => { if (hasDom) document.addEventListener(...a) },
  removeEventListener: (...a) => { if (hasDom) document.removeEventListener(...a) },
  get hidden() { return hasDom ? document.hidden : false },
  get pointerLockElement() { return hasDom ? document.pointerLockElement : null },
  exitPointerLock: () => { if (hasDom) document.exitPointerLock() },
}

/** Descarga un Blob como archivo. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = makeEl('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function pickFile(accept, multiple = false, owner = globalThis.document) {
  return new Promise((resolve) => {
    const input = owner.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.onchange = () => resolve(Array.from(input.files || []))
    input.oncancel = () => resolve([])
    input.click()
  })
}
