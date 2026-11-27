import { findDockPanel, focusDockPanel, restoreDockPanel, hideDockPanel, defaultDockLayout, dockPanelIsActive, DOCK_PANELS, dockPanelAvailable } from './docking.js'
import { focusNativeTool, getNativeToolDocument } from './native-tool-registry.js'

/** Cambia solo la vista editorial; nunca crea ni detiene una sesión de juego. */
export function activateViewportDock(store, id) {
  if (id !== 'sceneView' && id !== 'gameView' || !store.editor) return false
  if (!store.play.on && store.ui.viewTab !== (id === 'sceneView' ? 'scene' : 'game')) store.editor.cancelEditorPointer?.('view-change')
  if (store.ui.viewTab === 'code' && typeof document !== 'undefined') document.activeElement?.blur?.()
  if (store.play.on) {
    const player = store.editor.player
    if (id === 'sceneView') {
      if (typeof document !== 'undefined' && document.pointerLockElement) document.exitPointerLock?.()
      player.keys?.clear()
      player.input?.clear()
    }
  } else if (store.ui.mode === 'desktop' && store.project) {
    if (store.gameView.on && !store.editor.setGameView(false)) return false
  } else if (!store.editor.setGameView(id === 'gameView')) return false
  store.ui.viewTab = id === 'sceneView' ? 'scene' : 'game'
  const location = findDockPanel(store.prefs.dockLayout, id)
  if (location?.kind === 'dock') store.prefs.dockLayout = focusDockPanel(store.prefs.dockLayout, id)
  else if (location?.kind === 'hidden') store.prefs.dockLayout = restoreDockPanel(store.prefs.dockLayout, id)
  return true
}

/** Abre Code sin cambiar la cámara editorial ni la sesión del juego. */
export function activateCodeDock(store) {
  if (store.ui.mode !== 'desktop' || !store.project || store.locked) return false
  if (!store.play.on) store.editor?.cancelEditorPointer?.('code-view')
  if (store.ui.codeNativeOpen && focusNativeTool('code')) return true
  if (typeof document !== 'undefined' && document.pointerLockElement) document.exitPointerLock?.()
  const player = store.editor?.player
  player?.keys?.clear()
  player?.input?.clear()
  if (!store.scriptEditId && store.project.scripts?.length) store.scriptEditId = store.project.scripts[0].id
  store.ui.viewTab = 'code'
  const location = findDockPanel(store.prefs.dockLayout, 'codeView')
  if (location?.kind === 'dock') store.prefs.dockLayout = focusDockPanel(store.prefs.dockLayout, 'codeView')
  else if (location?.kind === 'hidden') store.prefs.dockLayout = restoreDockPanel(store.prefs.dockLayout, 'codeView')
  if (store.ui.codeNativeOpen) focusNativeTool('code')
  return true
}

/** Resuelve el destino ya montado; el docking puede reconstruir un grupo sin cambiar su id. */
export function resolveViewportDockTarget(root, selector, fallback = null) {
  const target = selector ? root?.querySelector?.(selector) : null
  if (target?.isConnected) return target
  const floatId = /^#lf-dock-float-([a-zA-Z0-9]+)$/.exec(selector || '')?.[1]
  const native = floatId ? getNativeToolDocument(floatId)?.querySelector(selector) : null
  if (native?.isConnected) return native
  const backup = fallback ? root?.querySelector?.(fallback) : null
  return backup?.isConnected ? backup : null
}

/** Restaura el framebuffer existente después de mostrar o mover su contenedor. */
export function recoverViewportDrawing(editor, host) {
  const vp = editor?.vp
  if (!vp || !host?.isConnected || vp.container !== host || host.clientWidth < 2 || host.clientHeight < 2) return false
  vp.resize()
  vp.requestRender()
  return true
}

/** Accesos de menú a la distribución existente; no crean otra autoridad de docking. */
export function revealDockPanel(store, id) {
  const at = findDockPanel(store.prefs.dockLayout, id)
  if (!at || at.kind === 'hidden') store.prefs.dockLayout = restoreDockPanel(store.prefs.dockLayout, id)
  else if (at.kind === 'dock') store.prefs.dockLayout = focusDockPanel(store.prefs.dockLayout, id)
  const dest = findDockPanel(store.prefs.dockLayout, id)
  if (dest?.kind === 'dock') store.prefs[dest.zone + 'Open'] = true
}

export function dockPanelToggleActive(store, id) {
  if (store.ui.mode !== 'desktop') return store.ui.drawer === id
  return dockPanelIsActive(store.prefs.dockLayout, store.prefs, id === 'inspector' ? 'object' : id)
}

export function toggleDockPanel(store, id) {
  if (store.ui.mode !== 'desktop') { store.ui.drawer = store.ui.drawer === id ? null : id; return }
  const panel = id === 'inspector' ? 'object' : id
  if (dockPanelToggleActive(store, id)) store.prefs.dockLayout = hideDockPanel(store.prefs.dockLayout, panel)
  else revealDockPanel(store, panel)
}

export function resetDocking(store) {
  store.prefs.dockLayout = defaultDockLayout()
  Object.assign(store.prefs, { leftOpen:true, rightOpen:true, topOpen:false, bottomOpen:true, leftW:236, rightW:296, topH:150, bottomH:210, rightTab:'object', bottomTab:'project' })
}

export function dockMenuItems(store) {
  const toggles = [['hierarchy', 'tree', 'Jerarquía'], ['inspector', 'sliders', 'Inspector'], ['project', 'folder', 'Proyecto']]
    .map(([id, icon, label]) => ({ label, icon, checked: dockPanelToggleActive(store, id), run: () => toggleDockPanel(store, id) }))
  if (store.ui.mode !== 'desktop') return toggles
  const panels = Object.entries(DOCK_PANELS).filter(([id]) => dockPanelAvailable(id, store)).map(([id, spec]) => ({
    label: spec[0], icon: spec[1], run: () => id === 'codeView' ? activateCodeDock(store) : ['sceneView', 'gameView'].includes(id) ? activateViewportDock(store, id) : revealDockPanel(store, id),
  }))
  return [...toggles, { sep: true }, { label: 'Mostrar panel', children: panels }, { sep: true }, { label: 'Restaurar disposición', icon: 'rotate', run: () => resetDocking(store) }]
}

/** Solicita la ventana Code únicamente cuando el arrastre terminó fuera del editor. */
export function detachCodeFromDrag(event) {
  if (typeof window === 'undefined' || !window.lf?.isElectron || event.dataTransfer?.dropEffect !== 'none') return false
  const x = event.clientX, y = event.clientY
  const outside = x <= 0 || y <= 0 || x >= window.innerWidth || y >= window.innerHeight
  if (!outside) return false
  window.dispatchEvent(new Event('century:code-detach'))
  return true
}
