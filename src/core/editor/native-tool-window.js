import { nextTick, onBeforeMount, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'

import { resolveViewportDockTarget } from './view-dock-session.js'
import { registerNativeTool, unregisterNativeTool } from './native-tool-registry.js'
export { focusNativeTool } from './native-tool-registry.js'
let panelNumber = 0

/** Los destinos dinámicos se resuelven después del parche de los grupos. */
export function useMountedDockTarget(selector, fallback, dependencies) {
  const target = shallowRef('body')
  let generation = 0, disposed = false
  async function refresh() {
    const current = ++generation
    await nextTick()
    if (disposed || current !== generation) return
    target.value = resolveViewportDockTarget(document, selector(), fallback()) || document.body
  }
  watch(() => [selector(), fallback(), ...dependencies()], refresh, { flush: 'post', immediate: true })
  onMounted(refresh)
  onBeforeUnmount(() => { disposed = true; generation++ })
  return target
}

// La vista usa el store del Editor mediante Teleport. No monta otro motor ni
// carga una segunda copia del proyecto para alimentar las ventanas de herramientas.
export function useNativeToolWindow({ kind, enabled, title, width, height, position = () => null, registryId = '', canClose = () => true, close }) {
  const target = shallowRef(null)
  let popup, observer, name, retiring, disposed = false, reopen = false

  function closing(event) {
    event.preventDefault()
    event.returnValue = ''
    if (!canClose()) return
    // La ventana permanece viva hasta que Vue termine de devolver sus Teleport.
    closeWindow()
    close()
  }
  function closed() {
    if (!popup) return
    unregisterNativeTool(name, popup)
    if (registryId) unregisterNativeTool(registryId, popup)
    target.value = null
    popup = null
    observer?.disconnect()
    observer = null
    close()
  }

  function openWindow() {
    if (disposed || popup || !window.lf?.isElectron || !enabled()) return
    if (retiring) { reopen = true; return }
    name = kind === 'panel' ? `panel-${++panelNumber}` : kind
    const w = Math.min(width(), window.screen.availWidth)
    const h = Math.min(height(), window.screen.availHeight - 24)
    const point = position()
    // Las coordenadas negativas son válidas en escritorios con un monitor a
    // la izquierda/encima del principal.
    const x = Number.isFinite(point?.x) ? Math.round(point.x) : null
    const y = Number.isFinite(point?.y) ? Math.round(point.y) : null
    const location = x !== null && y !== null ? `,left=${x},top=${y}` : ''
    popup = window.open('about:blank', `lf-tool-${name}`, `width=${w},height=${h}${location}`)
    if (!popup || !popup.document.body) { popup = null; return }

    const currentPopup = popup
    const doc = currentPopup.document
    doc.title = title()
    doc.documentElement.className = document.documentElement.className
    doc.documentElement.lang = document.documentElement.lang
    const base = doc.createElement('base')
    base.href = document.baseURI
    doc.head.append(base)
    const styles = new Map()
    function syncStyles() {
      if (currentPopup.closed || popup !== currentPopup) return
      const sources = new Set(document.head.querySelectorAll('link[rel="stylesheet"], style'))
      for (const [source, copy] of styles) {
        if (!sources.has(source)) { copy.remove(); styles.delete(source) }
      }
      for (const source of sources) {
        const copy = styles.get(source)
        if (!copy) {
          const element = doc.importNode(source, true)
          styles.set(source, element)
          doc.head.append(element)
        } else if (source.tagName === 'STYLE' && copy.textContent !== source.textContent) {
          copy.textContent = source.textContent
        }
      }
      doc.documentElement.className = document.documentElement.className
      doc.documentElement.style.cssText = document.documentElement.style.cssText
    }
    syncStyles()
    observer = new MutationObserver(syncStyles)
    observer.observe(document.head, { childList: true, subtree: true, characterData: true })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] })
    popup.addEventListener('beforeunload', closing)
    popup.addEventListener('pagehide', closed, { once: true })
    registerNativeTool(name, popup)
    if (registryId) registerNativeTool(registryId, popup)
    target.value = doc.body
  }

  function closeWindow() {
    observer?.disconnect()
    observer = null
    if (!popup) { target.value = null; return }
    const current = popup
    popup = null
    unregisterNativeTool(name, current)
    if (registryId) unregisterNativeTool(registryId, current)
    current.removeEventListener('beforeunload', closing)
    current.removeEventListener('pagehide', closed)
    target.value = null
    retiring = current
    void finishClose(current)
  }

  async function finishClose(current) {
    // Se retira primero el registro; los consumidores deben volver a resolver su destino.
    await nextTick()
    window.dispatchEvent(new Event('century:native-dock-changed'))
    await nextTick()
    await nextTick()
    // Salir del despacho de beforeunload antes de solicitar el cierre definitivo.
    await new Promise(resolve => setTimeout(resolve, 0))
    if (!current.closed) current.close()
    if (retiring === current) retiring = null
    const requested = reopen
    reopen = false
    if (requested && !disposed && enabled()) openWindow()
  }

  onBeforeMount(openWindow)
  watch(enabled, (active) => { if (active) openWindow(); else { reopen = false; closeWindow() } }, { flush: 'sync' })
  watch(title, value => { if (target.value && !popup.closed) popup.document.title = value })
  onBeforeUnmount(() => { disposed = true; reopen = false; closeWindow() })
  return target
}
