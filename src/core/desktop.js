// Puente del EDITOR con la app de escritorio (Electron): `window.lf`, o undefined en el navegador. No es del Runtime.
const hasDom = typeof window !== 'undefined'
export const host = () => (hasDom ? window.lf : undefined)
/** Abre una pestaña/ventana del navegador. */
export const openTab = (url) => window.open(url, '_blank')
