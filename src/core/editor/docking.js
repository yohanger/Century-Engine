// Distribución del Editor. Solo contiene ubicaciones y tamaños; los paneles mantienen sus propios datos.
export const DOCK_PANELS = Object.freeze({
  sceneView: ['Edit Mode', 'box', 'center'],
  gameView: ['Play Mode', 'play', 'center'],
  codeView: ['Code', 'script', 'center'],
  hierarchy: ['Jerarquía', 'tree', 'left'],
  object: ['Inspector', 'sliders', 'right'],
  signals: ['Señales', 'network', 'right'],
  mesh: ['Malla', 'mesh', 'right'],
  paint: ['Pintura', 'brush', 'right'],
  project: ['Proyecto', 'folder', 'bottom'],
  console: ['Consola', 'terminal', 'bottom'],
  mixer: ['Audio Mixer', 'audio', 'bottom'],
  timeline: ['Timeline', 'play', 'bottom'],
  anim: ['Cinematics', 'play', 'bottom'],
  vcs: ['Versiones', 'git-branch', 'bottom'],
  eventEditor: ['Event Editor', 'event', 'bottom'],
  scriptEditor: ['Editor de scripts', 'script', 'bottom'],
  shaderEditor: ['Shader Editor', 'shader', 'bottom'],
  shaderGraph: ['Shader Graph', 'shader', 'bottom'],
  uiEditor: ['Diseñador UI', 'ui', 'bottom'],
  database: ['Base de datos', 'database', 'bottom'],
  localization: ['Localización', 'globe', 'bottom'],
  themeEditor: ['Tema de interfaz', 'paint', 'bottom'],
  docs: ['Documentación', 'help', 'bottom'],
})
export const DOCK_ZONES = Object.freeze(['left', 'right', 'top', 'bottom', 'center'])

/** Zona de destino de un grupo. La barra de pestañas siempre comparte espacio. */
export function dockDropEdge(rect, clientX, clientY, onTabs = false) {
  if (onTabs) return 'center'
  const x = clientX - rect.left, y = clientY - rect.top
  const xMargin = Math.min(28, rect.width * .12)
  const yMargin = Math.min(28, rect.height * .12)
  const edges = [
    ['left', x, xMargin], ['right', rect.width - x, xMargin],
    ['top', y, yMargin], ['bottom', rect.height - y, yMargin],
  ].filter(([, distance, margin]) => margin > 0 && distance >= 0 && distance <= margin)
  if (!edges.length) return 'center'
  edges.sort((a, b) => a[1] / a[2] - b[1] / b[2])
  return edges[0][0]
}
export const SPECIAL_DOCK_PANELS = Object.freeze(['eventEditor', 'scriptEditor', 'codeView', 'shaderEditor', 'shaderGraph', 'uiEditor', 'database', 'localization', 'themeEditor', 'docs'])
const CONTEXT_PANELS = new Set(['mesh', 'paint'])
const SPECIAL = new Set(SPECIAL_DOCK_PANELS)
export const REQUIRED_DOCK_VIEWS = Object.freeze(['sceneView', 'gameView', 'codeView'])
export const DEFAULT_DOCK_PANELS = Object.freeze(['sceneView', 'gameView', 'codeView', 'hierarchy', 'project', 'object', 'console'])
const REQUIRED = new Set(REQUIRED_DOCK_VIEWS)
const DEFAULT = new Set(DEFAULT_DOCK_PANELS)
const has = (id) => id !== 'scriptEditor' && Object.hasOwn(DOCK_PANELS, id)
const copy = (value) => JSON.parse(JSON.stringify(value))
const group = (id, tabs, active = tabs[0]) => ({ type: 'group', id, tabs, active })

export function defaultDockLayout() {
  return {
    version: 1,
    zones: {
      left: group('lf-dock-left', ['hierarchy']),
      right: group('lf-dock-right', ['object']),
      top: null,
      bottom: group('lf-dock-bottom', ['project', 'console']),
      center: group('lf-dock-center', ['sceneView', 'gameView', 'codeView']),
    },
    floats: [], hidden: Object.keys(DOCK_PANELS).filter(id => !DEFAULT.has(id) && !SPECIAL.has(id)),
  }
}

export function dockGroups(node) {
  if (!node) return []
  if (node.type === 'group') return [node]
  if (node.type !== 'split') return []
  return [...dockGroups(node.first), ...dockGroups(node.second)]
}

function sanitizeNode(node, used, ids, depth = 0) {
  if (!node || depth > 12 || typeof node !== 'object') return null
  if (node.type === 'group') {
    const tabs = Array.isArray(node.tabs) ? node.tabs.filter((id) => has(id) && !used.has(id) && (used.add(id), true)) : []
    if (!tabs.length) return null
    let id = typeof node.id === 'string' && /^lf-dock-[a-zA-Z0-9-]+$/.test(node.id) ? node.id : `lf-dock-restored-${ids.size}`
    if (ids.has(id)) id = `lf-dock-restored-${ids.size}`
    ids.add(id)
    return group(id, tabs, tabs.includes(node.active) ? node.active : tabs[0])
  }
  if (node.type === 'split') {
    const first = sanitizeNode(node.first, used, ids, depth + 1)
    const second = sanitizeNode(node.second, used, ids, depth + 1)
    if (!first || !second) return first || second
    let id = typeof node.id === 'string' && /^lf-dock-[a-zA-Z0-9-]+$/.test(node.id) ? node.id : `lf-dock-split-${ids.size}`
    if (ids.has(id)) id = `lf-dock-split-${ids.size}`
    ids.add(id)
    return { type: 'split', id, dir: node.dir === 'column' ? 'column' : 'row', ratio: cap(node.ratio, .2, .8, .5), first, second }
  }
  return null
}
const cap = (value, min, max, fallback) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback

/** Migra preferencias previas y repara layouts dañados sin duplicar identidades. */
export function normalizeDockLayout(layout, prefs = {}) {
  const initial = defaultDockLayout()
  if (!layout || layout.version !== 1 || !layout.zones) {
    if (initial.zones.right.tabs.includes(prefs.rightTab)) initial.zones.right.active = prefs.rightTab
    if (initial.zones.bottom.tabs.includes(prefs.bottomTab)) initial.zones.bottom.active = prefs.bottomTab
    return initial
  }
  const used = new Set(), ids = new Set()
  const zones = Object.fromEntries(DOCK_ZONES.map((zone) => [zone, sanitizeNode(layout.zones[zone], used, ids)]))
  const floats = []
  for (const item of Array.isArray(layout.floats) ? layout.floats : []) {
    if (!item || !has(item.id) || used.has(item.id) || floats.length >= 20) continue
    used.add(item.id)
    floats.push({ id: item.id, x: cap(item.x, -20000, 20000, 80), y: cap(item.y, -20000, 20000, 90), w: cap(item.w, 220, 3000, 560), h: cap(item.h, 160, 2200, 390) })
  }
  const hidden = []
  for (const id of Array.isArray(layout.hidden) ? layout.hidden : []) {
    if (has(id) && !used.has(id) && !REQUIRED.has(id)) { used.add(id); hidden.push(id) }
  }
  // Las vistas obligatorias se restauran aunque un layout antiguo las haya ocultado
  // o colocado en una zona auxiliar. Las ubicaciones flotantes válidas se respetan.
  for (const id of REQUIRED_DOCK_VIEWS) {
    for (const zone of DOCK_ZONES.filter(z => z !== 'center')) {
      if (dockGroups(zones[zone]).some(g => g.tabs.includes(id))) {
        zones[zone] = prune(zones[zone], id)
        used.delete(id)
      }
    }
    if (used.has(id)) continue
    const target = dockGroups(zones.center)[0]
    if (target) target.tabs.push(id)
    else zones.center = group('lf-dock-center-restored', [id])
    used.add(id)
  }
  // Paneles auxiliares nuevos permanecen disponibles pero no se abren
  // sobre distribuciones guardadas por el usuario.
  for (const id of Object.keys(DOCK_PANELS)) {
    if (used.has(id) || SPECIAL.has(id)) continue
    hidden.push(id)
    used.add(id)
  }
  return { version: 1, zones, floats, hidden }
}

export function findDockPanel(layout, panelId) {
  if (!layout || !has(panelId)) return null
  for (const zone of DOCK_ZONES) {
    const found = dockGroups(layout.zones?.[zone]).find((g) => g.tabs.includes(panelId))
    if (found) return { zone, groupId: found.id, active: found.active === panelId, kind: 'dock' }
  }
  const floating = layout.floats?.find((f) => f.id === panelId)
  if (floating) return { kind: 'float', ...floating }
  return layout.hidden?.includes(panelId) ? { kind: 'hidden' } : null
}

function prune(node, id) {
  if (!node) return null
  if (node.type === 'group') {
    const tabs = node.tabs.filter((tab) => tab !== id)
    return tabs.length ? { ...node, tabs, active: tabs.includes(node.active) ? node.active : tabs[0] } : null
  }
  const first = prune(node.first, id), second = prune(node.second, id)
  return first && second ? { ...node, first, second } : first || second
}
function remove(layout, id) {
  for (const zone of DOCK_ZONES) layout.zones[zone] = prune(layout.zones[zone], id)
  layout.floats = layout.floats.filter((it) => it.id !== id)
  layout.hidden = layout.hidden.filter((it) => it !== id)
}
function replaceGroup(node, id, fn) {
  if (!node) return null
  if (node.id === id) return fn(node)
  if (node.type === 'split') return { ...node, first: replaceGroup(node.first, id, fn), second: replaceGroup(node.second, id, fn) }
  return node
}
function nextId(layout) {
  const ids = DOCK_ZONES.flatMap((z) => dockGroups(layout.zones[z]).map((g) => g.id))
  const match = ids.map((id) => /^lf-dock-g-(\d+)$/.exec(id)).filter(Boolean).map((m) => Number(m[1]))
  return `lf-dock-g-${Math.max(0, ...match) + 1}`
}

function insertDockTab(tabs, id, beforeTab) {
  const next = tabs.filter(tab => tab !== id)
  const index = next.indexOf(beforeTab)
  next.splice(index < 0 ? next.length : index, 0, id)
  return next
}

/** Mueve una pestaña a otro grupo o divide el grupo de destino sin duplicar el panel. */
export function moveDockPanel(layout, id, zone, groupId = null, edge = 'center', beforeTab = null) {
  if (!has(id) || !DOCK_ZONES.includes(zone)) return layout
  if (REQUIRED.has(id) && zone !== 'center') return layout
  const src = findDockPanel(layout, id)
  if (src?.kind === 'dock' && src.zone === zone && src.groupId === groupId && edge === 'center') {
    if (beforeTab === null || beforeTab === id) return focusDockPanel(layout, id)
    const out = copy(layout)
    out.zones[zone] = replaceGroup(out.zones[zone], groupId, g => ({ ...g, tabs: insertDockTab(g.tabs, id, beforeTab), active: id }))
    return out
  }
  if (src?.kind === 'dock' && src.zone === zone && src.groupId === groupId &&
      dockGroups(layout.zones[zone]).find(g => g.id === groupId)?.tabs.length === 1) return focusDockPanel(layout, id)
  const out = copy(layout)
  const targetId = groupId && dockGroups(out.zones[zone]).some((g) => g.id === groupId) ? groupId : dockGroups(out.zones[zone])[0]?.id
  const target = targetId ? dockGroups(out.zones[zone]).find((g) => g.id === targetId) : null
  if (target && !['center', 'left', 'right', 'top', 'bottom'].includes(edge)) edge = 'center'
  // Al partir el mismo grupo, primero se retira la pestaña y luego se busca la rama restante.
  remove(out, id)
  const newGroup = group(nextId(out), [id])
  const after = targetId && dockGroups(out.zones[zone]).find((g) => g.id === targetId)
  if (!after) { out.zones[zone] = out.zones[zone] || newGroup; if (out.zones[zone] !== newGroup) {
    const first = dockGroups(out.zones[zone])[0]
    out.zones[zone] = replaceGroup(out.zones[zone], first.id, (g) => ({ ...g, tabs: [...g.tabs, id], active: id }))
  } }
  else if (edge === 'center') {
    out.zones[zone] = replaceGroup(out.zones[zone], after.id, (g) => ({ ...g, tabs: insertDockTab(g.tabs, id, beforeTab), active: id }))
  } else {
    const splitId = `lf-dock-split-${newGroup.id.replace('lf-dock-g-', '')}`
    const before = edge === 'left' || edge === 'top'
    const dir = edge === 'left' || edge === 'right' ? 'row' : 'column'
    out.zones[zone] = replaceGroup(out.zones[zone], after.id, (g) => ({ type: 'split', id: splitId, dir, ratio: .5, first: before ? newGroup : g, second: before ? g : newGroup }))
  }
  return out
}

export function focusDockPanel(layout, id) {
  const where = findDockPanel(layout, id)
  if (where?.kind !== 'dock') return layout
  const out = copy(layout)
  out.zones[where.zone] = replaceGroup(out.zones[where.zone], where.groupId, (g) => ({ ...g, active: id }))
  return out
}

export function floatDockPanel(layout, id, rect = {}) {
  if (!has(id)) return layout
  const old = layout.floats?.find((it) => it.id === id)
  const out = copy(layout)
  remove(out, id)
  out.floats.push({ id, x: cap(rect.x ?? old?.x, -20000, 20000, 80), y: cap(rect.y ?? old?.y, -20000, 20000, 90), w: cap(rect.w ?? old?.w, 220, 3000, 560), h: cap(rect.h ?? old?.h, 160, 2200, 390) })
  return out
}
export function hideDockPanel(layout, id) {
  if (!has(id) || REQUIRED.has(id)) return layout
  const out = copy(layout)
  remove(out, id)
  out.hidden.push(id)
  return out
}
export function restoreDockPanel(layout, id) {
  const zone = DOCK_PANELS[id]?.[2]
  return zone ? moveDockPanel(layout, id, zone) : layout
}
export function resizeDockSplit(layout, splitId, ratio) {
  const out = copy(layout)
  function change(node) {
    if (!node || node.type !== 'split') return node
    if (node.id === splitId) return { ...node, ratio: cap(ratio, .2, .8, .5) }
    return { ...node, first: change(node.first), second: change(node.second) }
  }
  for (const zone of DOCK_ZONES) out.zones[zone] = change(out.zones[zone])
  return out
}
export function updateDockFloat(layout, id, rect) {
  const out = copy(layout)
  const found = out.floats.find((f) => f.id === id)
  if (found) Object.assign(found, Object.fromEntries(['x', 'y', 'w', 'h'].filter((k) => Number.isFinite(rect[k])).map((k) => [k, rect[k]])))
  return out
}
export function dockPanelIsActive(layout, prefs, id) {
  const at = findDockPanel(layout, id)
  if (at?.kind === 'float') return true
  if (at?.kind !== 'dock' || prefs[at.zone + 'Open'] === false) return false
  const groupNode = dockGroups(layout.zones[at.zone]).find((g) => g.id === at.groupId)
  return groupNode?.active === id
}
export function dockPanelAvailable(id, state) {
  if (id === 'mesh') return !!state.edit.on
  if (id === 'paint') return !!state.paint.on
  if (id === 'eventEditor') return !!state.eventEditId
  if (id === 'scriptEditor') return false
  if (id === 'shaderEditor') return state.modal === 'shader' && !state.project?.shaders?.find((s) => s.id === state.shaderEditId)?.graph
  if (id === 'shaderGraph') return !!state.ui.shaderWorkspace && !!state.project?.shaders?.find((s) => s.id === state.shaderEditId)?.graph
  if (id === 'uiEditor') return state.modal === 'ui'
  if (id === 'database') return state.modal === 'database'
  if (id === 'localization') return !!state.locWin
  if (id === 'themeEditor') return state.modal === 'theme'
  if (id === 'docs') return !!state.docsWin
  return true
}
export function activeDockTab(groupNode, state) {
  return dockPanelAvailable(groupNode.active, state) ? groupNode.active : groupNode.tabs.find((id) => dockPanelAvailable(id, state)) || null
}

/** Un grupo contextual sin ninguna pestaña utilizable no debe reservar espacio en el layout. */
export function dockNodeHasAvailablePanel(node, state) {
  return dockGroups(node).some(groupNode => !!activeDockTab(groupNode, state))
}
