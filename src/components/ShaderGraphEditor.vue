<script setup>
// Editor de nodos del Shader Graph. El grafo vive en project.shaders[i].graph; cada cambio regenera el GLSL (setShaderGraph)
// y se comprueba con el compilador real de WebGL. Ventana flotante igual que el editor de código.
import { computed, onBeforeUnmount, onMounted, reactive, ref, nextTick, watch } from 'vue'
import { store, setShaderGraph, closeShaderEditor, saveAll } from '../core/store.js'
import { NODE_DEFS, NODE_LIST, CATEGORIES, TYPE_COLORS, DIM } from '../core/shadergraph/nodes.js'
import { newNode, newProp, normalizeGraph, compileGraph, PROP_TYPES, POST_NODES } from '../core/shadergraph/compile.js'
import { checkShader } from '../engine/runtime/render/pbr.js'
import { uid } from '../engine/runtime/util.js'
import FloatingEditorWindow from './FloatingEditorWindow.vue'
import Icon from './Icon.vue'
import ShaderPreview from './ShaderPreview.vue'
import ColorInput from './ColorInput.vue'
import { assetUrl } from '../core/state/files.js'
import { findDockPanel, floatDockPanel } from '../core/editor/docking.js'
import { shaderGraphSessions, toggleShaderGraphDock } from '../core/state/shaders.js'

const props = defineProps({ shaderId: { type: String, default: '' }, visible: { type: Boolean, default: true } })
const documentId = props.shaderId || store.shaderEditId
const project = store.project
const sc = computed(() => project.shaders.find((s) => s.id === documentId))
const workspaceDocked = computed(() => findDockPanel(store.prefs.dockLayout, 'shaderGraph')?.kind === 'dock')
const docked = computed(() => !!store.prefs.shaderGraphDocked || workspaceDocked.value)
const editorRoot = ref(null)
const g = reactive(normalizeGraph(sc.value?.graph))
const view = reactive({ x: 40, y: 40, k: 1 })
const sel = ref(null)
const selected = reactive(new Set())
const clipboard = ref(null)
const boxSelect = ref(null)
const post = computed(() => g.target === 'post')
const showCode = ref(false) // Pestaña de salida: errores o GLSL, nunca superpuesto al lienzo
const paletteQuery = ref('')
const nodeDragType = 'application/x-levelforge-shader-node'
const search = ref(null) // { x, y, wx, wy, q }
const pending = ref(null) // arista en curso { from:[node,key] | null, to:[node,key] | null, x, y }
const status = ref({ ok: true, message: 'Sin comprobar', errors: [] })
const surface = ref(null)

const W = 222, HEAD = 32, ROW = 27, PARAM = 31
const undo = reactive([]), redo = reactive([])
const snap = () => JSON.stringify({ target: g.target, props: g.props, nodes: g.nodes, edges: g.edges })
function load(json) { const n = normalizeGraph(JSON.parse(json)); g.target = n.target; g.props = n.props; g.nodes = n.nodes; g.edges = n.edges }
function push() { undo.push(snap()); if (undo.length > 80) undo.shift(); redo.length = 0 }
function doUndo() { if (!undo.length) return; redo.push(snap()); load(undo.pop()); apply() }
function doRedo() { if (!redo.length) return; undo.push(snap()); load(redo.pop()); apply() }

let applyTimer = 0
function apply(now = false) {
  clearTimeout(applyTimer)
  const run = () => {
    applyTimer = 0
    if (!sc.value || store.project !== project) return
    const errors = setShaderGraph(sc.value.id, { target: g.target, props: g.props, nodes: g.nodes, edges: g.edges })
    let message = errors.length ? errors[0].message : 'Grafo validado correctamente'
    let ok = !errors.length
    const vp = store.editor?.vp
    if (ok && vp && !post.value) { try { const e = checkShader(vp.renderer, sc.value.code); if (e) { ok = false; message = e } } catch (e) { ok = false; message = String(e.message || e) } }
    status.value = { ok, message, errors }
  }
  if (now) run(); else applyTimer = setTimeout(run, 160)
}
function edit(fn) { push(); fn(); apply() }
function flush() { if (applyTimer) apply(true) }
function save() { flush(); return saveAll() }
function close() { flush(); closeShaderEditor() }
function toggleDock() {
  search.value = null; moreTools.value = false
  if (workspaceDocked.value) {
    store.prefs.dockLayout = floatDockPanel(store.prefs.dockLayout, 'shaderGraph')
    store.prefs.shaderGraphDocked = false
    store.modal = 'shader'
  } else toggleShaderGraphDock()
  nextTick(() => editorRoot.value?.focus())
}
function previewError(message) { status.value = { ok: false, message, errors: [{ message }] } }
watch(() => props.visible, (visible) => { if (!visible) flush() })

// ---------- geometría ----------
const def = (n) => NODE_DEFS[n?.type]
const propOf = (n) => g.props.find((p) => p.id === n.params?.prop)
function outType(n, o, seen = new Set()) {
  if (!n || !o || seen.has(n.id)) return 'float'
  seen.add(n.id)
  if (def(n).dynOut === 'prop') { const p = propOf(n); return p?.type === 'color' || p?.type === 'vec3' ? 'vec3' : 'float' }
  if (o.t !== 'T') return o.t
  let d = 1
  for (const i of def(n).in) { const e = edgeTo(n.id, i.k); if (e) { const a = byId(e.from[0]); const ao = def(a).out.find((x) => x.k === e.from[1]); d = Math.max(d, DIM[outType(a, ao, new Set(seen))] || 1) } }
  return ['', 'float', 'vec2', 'vec3', 'vec4'][d]
}
const byId = (id) => g.nodes.find((n) => n.id === id)
const edgeTo = (id, k) => g.edges.find((e) => e.to[0] === id && e.to[1] === k)
const rows = (n) => Math.max(def(n).in.length, def(n).out.length)
const isTexture = (n) => ['texture', 'triplanar', 'packedOrm', 'triplanarNormal'].includes(n.type)
const previewH = (n) => isTexture(n) ? 100 : n.type === 'color' ? 28 : 0
const inputStart = (n) => HEAD + (isTexture(n) ? 0 : previewH(n))
const paramStart = (n) => HEAD + (isTexture(n) ? Math.max(previewH(n), rows(n) * ROW) : previewH(n) + rows(n) * ROW)
const nodeH = (n) => paramStart(n) + (def(n).params?.length || 0) * PARAM + 8
const portPos = (n, side, idx) => ({ x: n.x + (side === 'out' ? W : 0), y: n.y + inputStart(n) + idx * ROW + ROW / 2 })
const colorOf = (t) => TYPE_COLORS[t] || '#aaa'
const edgePath = (a, b) => { const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5); return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}` }
const paths = computed(() => g.edges.map((e) => {
  const a = byId(e.from[0]), b = byId(e.to[0])
  if (!a || !b) return null
  const oi = def(a).out.findIndex((o) => o.k === e.from[1]), ii = def(b).in.findIndex((i) => i.k === e.to[1])
  return { id: e.id, d: edgePath(portPos(a, 'out', oi), portPos(b, 'in', ii)), c: colorOf(outType(a, def(a).out[oi])) }
}).filter(Boolean))
const tempPath = computed(() => {
  const p = pending.value
  if (!p) return null
  const cur = { x: p.x, y: p.y }
  if (p.from) { const a = byId(p.from[0]); const oi = def(a).out.findIndex((o) => o.k === p.from[1]); return edgePath(portPos(a, 'out', oi), cur) }
  const b = byId(p.to[0]); const ii = def(b).in.findIndex((i) => i.k === p.to[1]); return edgePath(cur, portPos(b, 'in', ii))
})

// ---------- ratón ----------
const toWorld = (e) => { const r = surface.value.getBoundingClientRect(); return { x: (e.clientX - r.left - view.x) / view.k, y: (e.clientY - r.top - view.y) / view.k } }
let drag = null
function onBgDown(e) {
  if (e.button === 2) return
  if (e.button !== 0 && e.button !== 1) return
  search.value = null
  if (e.shiftKey && e.button === 0) {
    const w = toWorld(e)
    boxSelect.value = { x: w.x, y: w.y, x2: w.x, y2: w.y }
    drag = { kind: 'box' }
  } else {
    if (!e.ctrlKey && !e.metaKey) { sel.value = null; selected.clear() }
    drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }
  }
  window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp)
}
function onNodeDown(e, n) {
  if (e.button !== 0 || e.target.closest('input,select,.port,button')) return
  e.stopPropagation()
  sel.value = n.id
  if (e.shiftKey || e.ctrlKey || e.metaKey) {
    if (selected.has(n.id)) selected.delete(n.id); else selected.add(n.id)
    return
  }
  if (!selected.has(n.id)) { selected.clear(); selected.add(n.id) }
  const moving = g.nodes.filter((x) => selected.has(x.id)).map((x) => ({ node: x, x: x.x, y: x.y }))
  drag = { kind: 'node', moving, sx: e.clientX, sy: e.clientY, moved: false }
  window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp)
}
function onPortDown(e, n, side, k) {
  e.stopPropagation(); e.preventDefault()
  const w = toWorld(e)
  if (side === 'out') pending.value = { from: [n.id, k], to: null, ...w }
  else {
    const ex = edgeTo(n.id, k)
    if (ex) { push(); g.edges.splice(g.edges.indexOf(ex), 1); pending.value = { from: ex.from, to: null, ...w }; apply() } // recoger la conexión
    else pending.value = { from: null, to: [n.id, k], ...w }
  }
  drag = { kind: 'edge' }
  window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp)
}
function onMove(e) {
  if (!drag) return
  if (drag.kind === 'pan') { view.x = drag.vx + e.clientX - drag.sx; view.y = drag.vy + e.clientY - drag.sy }
  else if (drag.kind === 'node') {
    const dx = (e.clientX - drag.sx) / view.k, dy = (e.clientY - drag.sy) / view.k
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 1) { push(); drag.moved = true }
    for (const m of drag.moving) { m.node.x = Math.round(m.x + dx); m.node.y = Math.round(m.y + dy) }
  }
  else if (drag.kind === 'box') { const w = toWorld(e); boxSelect.value.x2 = w.x; boxSelect.value.y2 = w.y }
  else if (pending.value) Object.assign(pending.value, toWorld(e))
}
function onUp(e) {
  window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp)
  if (drag?.kind === 'box' && boxSelect.value) {
    const b = boxSelect.value
    const left = Math.min(b.x, b.x2), right = Math.max(b.x, b.x2), top = Math.min(b.y, b.y2), bottom = Math.max(b.y, b.y2)
    for (const n of g.nodes) if (n.x < right && n.x + W > left && n.y < bottom && n.y + nodeH(n) > top) selected.add(n.id)
    sel.value = [...selected].at(-1) || null
    boxSelect.value = null
  }
  if (drag?.kind === 'edge' && pending.value) {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.port')
    if (el) {
      const nid = el.dataset.node, side = el.dataset.side, k = el.dataset.key
      const p = pending.value
      if (p.from && side === 'in' && nid !== p.from[0]) connect(p.from, [nid, k])
      else if (p.to && side === 'out' && nid !== p.to[0]) connect([nid, k], p.to)
    }
    pending.value = null
  }
  const changed = drag?.kind === 'node' && drag.moved
  drag = null
  if (changed) apply()
}
function connect(from, to) {
  push()
  g.edges = g.edges.filter((e) => !(e.to[0] === to[0] && e.to[1] === to[1]))
  g.edges.push({ id: uid('e'), from, to })
  apply()
}
function onWheel(e) {
  const r = surface.value.getBoundingClientRect()
  const k = Math.min(2, Math.max(0.3, view.k * (e.deltaY < 0 ? 1.1 : 1 / 1.1)))
  const mx = e.clientX - r.left, my = e.clientY - r.top
  view.x = mx - (mx - view.x) * (k / view.k); view.y = my - (my - view.y) * (k / view.k); view.k = k
}
function openSearch(e) {
  const r = surface.value.getBoundingClientRect()
  const w = e ? toWorld(e) : { x: (200 - view.x) / view.k, y: (120 - view.y) / view.k }
  search.value = { x: e ? e.clientX - r.left : 200, y: e ? e.clientY - r.top : 120, wx: w.x, wy: w.y, q: '' }
  nextTick(() => document.getElementById('sg-search')?.focus())
}
function findNodes(query) {
  const q = query.toLowerCase().trim()
  const list = NODE_LIST.filter((d) => (post.value ? POST_NODES.has(d.id) : !d.postOnly) && (!q || d.label.toLowerCase().includes(q) || d.id.toLowerCase().includes(q) || d.cat.toLowerCase().includes(q)))
  return CATEGORIES.map((c) => ({ cat: c, items: list.filter((d) => d.cat === c) })).filter((c) => c.items.length)
}
const results = computed(() => findNodes(search.value?.q || ''))
const palette = computed(() => findNodes(paletteQuery.value))
function dragPaletteNode(event, type) {
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData(nodeDragType, type)
}
function allowPaletteDrop(event) {
  if (!event.dataTransfer.types.includes(nodeDragType)) return
  event.preventDefault()
  event.dataTransfer.dropEffect = 'copy'
}
function dropPaletteNode(event) {
  const type = event.dataTransfer.getData(nodeDragType)
  if (!findNodes('').some(group => group.items.some(node => node.id === type))) return
  event.preventDefault()
  addNode(type, null, toWorld(event))
}
function insertPaletteNode(type) {
  if (!surface.value) return
  addNode(type, null, {
    x: (surface.value.clientWidth / 2 - view.x) / view.k - W / 2,
    y: (surface.value.clientHeight / 2 - view.y) / view.k - HEAD / 2,
  })
}
function addNode(type, params = null, point = null) {
  const s = search.value
  const x = point?.x ?? s?.wx ?? 120, y = point?.y ?? s?.wy ?? 120
  edit(() => { const n = newNode(type, Math.round(x), Math.round(y)); if (params) Object.assign(n.params, params); g.nodes.push(n); sel.value = n.id; selected.clear(); selected.add(n.id) })
  search.value = null
}
function delNode(id) {
  const n = byId(id)
  if (!n || def(n).master) return
  edit(() => { g.nodes = g.nodes.filter((x) => x.id !== id); g.edges = g.edges.filter((e) => e.from[0] !== id && e.to[0] !== id) })
  if (sel.value === id) sel.value = null
}
function dupNode(id) {
  const n = byId(id)
  if (!n || def(n).master) return
  edit(() => { const c = JSON.parse(JSON.stringify(n)); c.id = uid('n'); c.x += 30; c.y += 30; g.nodes.push(c); sel.value = c.id })
}
function removeSelected() {
  const ids = new Set([...selected].filter((id) => !def(byId(id))?.master))
  if (!ids.size) return
  edit(() => { g.nodes = g.nodes.filter((n) => !ids.has(n.id)); g.edges = g.edges.filter((e) => !ids.has(e.from[0]) && !ids.has(e.to[0])) })
  selected.clear(); sel.value = null
}
function copySelected() {
  const ids = new Set(selected)
  clipboard.value = { nodes: g.nodes.filter((n) => ids.has(n.id)).map((n) => JSON.parse(JSON.stringify(n))),
    edges: g.edges.filter((e) => ids.has(e.from[0]) && ids.has(e.to[0])).map((e) => JSON.parse(JSON.stringify(e))) }
}
function pasteSelected() {
  if (!clipboard.value?.nodes.length) return
  edit(() => {
    const idMap = new Map()
    selected.clear()
    for (const n of clipboard.value.nodes) {
      if (def(n).master) continue
      const id = uid('n'); idMap.set(n.id, id)
      g.nodes.push({ ...JSON.parse(JSON.stringify(n)), id, x: n.x + 48, y: n.y + 48 }); selected.add(id)
    }
    for (const e of clipboard.value.edges) if (idMap.has(e.from[0]) && idMap.has(e.to[0])) {
      g.edges.push({ id: uid('e'), from: [idMap.get(e.from[0]), e.from[1]], to: [idMap.get(e.to[0]), e.to[1]] })
    }
    sel.value = [...selected].at(-1) || null
  })
  clipboard.value.nodes.forEach((n) => { n.x += 28; n.y += 28 })
}
function frameNodes(onlySelected = false) {
  const nodes = onlySelected ? g.nodes.filter((n) => selected.has(n.id)) : g.nodes
  if (!nodes.length || !surface.value) return
  const minX = Math.min(...nodes.map((n) => n.x)), minY = Math.min(...nodes.map((n) => n.y))
  const maxX = Math.max(...nodes.map((n) => n.x + W)), maxY = Math.max(...nodes.map((n) => n.y + nodeH(n)))
  const rect = surface.value.getBoundingClientRect()
  const k = Math.max(0.3, Math.min(1.7, Math.min((rect.width - 100) / (maxX - minX), (rect.height - 100) / (maxY - minY))))
  view.k = k; view.x = (rect.width - (maxX + minX) * k) / 2; view.y = (rect.height - (maxY + minY) * k) / 2
}
function onKey(e) {
  e.stopPropagation()
  if (e.target.closest?.('input,select,textarea,[contenteditable=true]')) return
  if (e.target.closest?.('button') && [' ', 'Enter'].includes(e.key)) return
  if (e.key === 'Delete' || e.key === 'Backspace') { removeSelected() }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo() }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo() }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); copySelected(); pasteSelected() }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); g.nodes.forEach((n) => selected.add(n.id)); sel.value = [...selected].at(-1) }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') { e.preventDefault(); copySelected() }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteSelected() }
  else if (e.key === 'Home') { e.preventDefault(); frameNodes() }
  else if (e.key.toLowerCase() === 'f') { e.preventDefault(); frameNodes(true) }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void save() }
  else if (e.key === ' ') { e.preventDefault(); openSearch(null) }
}
function onEsc(e) { if (search.value) { search.value = null; e.stopPropagation(); return } close() }

// ---------- valores en línea / parámetros / propiedades ----------
const inline = (n, i) => (n.v[i.k] !== undefined ? n.v[i.k] : (typeof i.def === 'string' ? null : i.def))
function setInline(n, i, comp, val) {
  const v = parseFloat(val)
  edit(() => {
    if (Array.isArray(i.def)) { const cur = Array.isArray(n.v[i.k]) ? [...n.v[i.k]] : [...i.def]; cur[comp] = Number.isFinite(v) ? v : 0; n.v[i.k] = cur }
    else n.v[i.k] = Number.isFinite(v) ? v : 0
  })
}
function setParam(n, p, val, comp = -1) {
  edit(() => {
    if (p.type === 'number') n.params[p.k] = Number.isFinite(parseFloat(val)) ? parseFloat(val) : 0
    else if (p.type === 'vec') { const cur = [...(n.params[p.k] || p.def)]; cur[comp] = parseFloat(val) || 0; n.params[p.k] = cur }
    else n.params[p.k] = val
  })
}
const propsFor = (p) => g.props.filter((x) => (p.only ? x.type === p.only : x.type !== 'texture'))
const connected = (n, k) => !!edgeTo(n.id, k)
function addProp(type) { edit(() => { const p = newProp(type); let nm = p.name, i = 2; while (g.props.some((x) => x.name === nm)) nm = p.name + i++; p.name = p.label = nm; g.props.push(p) }) }
function delProp(p) { edit(() => { g.props = g.props.filter((x) => x !== p); for (const n of g.nodes) if (n.params?.prop === p.id) n.params.prop = '' }) }
function setProp(p, k, val) { edit(() => { p[k] = val; if (k === 'name') p.label = val }) }
function setPropDef(p, val, comp = -1) {
  edit(() => {
    if (p.type === 'float') p.def = parseFloat(val) || 0
    else if (p.type === 'bool') p.def = !!val
    else if (p.type === 'vec3') { const c = [...p.def]; c[comp] = parseFloat(val) || 0; p.def = c }
    else p.def = val
  })
}
const propNode = (p) => { search.value = { wx: (260 - view.x) / view.k, wy: (140 - view.y) / view.k, q: '' }; addNode(p.type === 'texture' ? 'texture' : 'property', { prop: p.id }) }
const code = computed(() => sc.value?.code || '')
const nodeTitle = (n) => def(n).label
const hasVertex = computed(() => g.nodes.some((n) => n.type === 'vertex'))
function addVertexOut() { edit(() => { const n = newNode('vertex', 760, 360); g.nodes.push(n); sel.value = n.id }) }
const selectablePropTypes = computed(() => post.value ? PROP_TYPES.filter((t) => t[0] !== 'texture') : PROP_TYPES)
const errNodes = computed(() => new Set((status.value.errors || []).map((e) => e.node).filter(Boolean)))
// Un solo origen de datos para parámetros: el Inspector y cada nodo editan los mismos objetos del grafo.
const selectedNode = computed(() => byId(sel.value))
const uvNode = computed(() => {
  const edge = selectedNode.value && edgeTo(selectedNode.value.id, 'uv')
  const node = edge && byId(edge.from[0])
  return node?.type === 'tilingOffset' ? node : null
})
const visibleNodeCount = computed(() => `${g.nodes.length} nodos · ${g.edges.length} conexiones`)
const detailTab = ref('node')
watch(sel, (id) => { if (id) detailTab.value = 'node' })
const moreTools = ref(false)
const materialId = ref('')
const linkedMaterials = computed(() => (project.materials || []).filter((m) => m.mat?.shader === documentId))
const activeMaterial = computed(() => linkedMaterials.value.find((m) => m.id === materialId.value) || linkedMaterials.value[0] || null)
const assetThumbs = reactive({})
const textureName = (n) => project.assets?.find((a) => a.id === linkedTextureId(n))?.name || propOf(n)?.name || 'Sin textura'
const linkedTextureId = (n) => {
  if (!n || !['texture', 'triplanar', 'packedOrm', 'triplanarNormal'].includes(n.type)) return ''
  const property = propOf(n)
  return property?.type === 'texture' ? activeMaterial.value?.mat?.params?.['u' + property.name] || '' : ''
}
watch(() => JSON.stringify({ shader: sc.value?.id, props: g.props.filter((p) => p.type === 'texture'), params: activeMaterial.value?.mat?.params, nodes: g.nodes.map((n) => n.params?.prop) }), async () => {
  const ids = new Set(g.nodes.map(linkedTextureId).filter(Boolean))
  for (const id of ids) {
    if (assetThumbs[id]) continue
    const url = await assetUrl(id)
    if (url) assetThumbs[id] = url
  }
}, { immediate: true })

onMounted(async () => {
  const session = shaderGraphSessions(project).get(documentId)
  if (session) {
    Object.assign(view, session.view)
    sel.value = g.nodes.some((n) => n.id === session.sel) ? session.sel : null
    for (const id of session.selected) if (byId(id)) selected.add(id)
    detailTab.value = session.detailTab; showCode.value = session.showCode
    materialId.value = session.materialId; clipboard.value = session.clipboard
    if (session.snapshot === snap()) { undo.push(...session.undo); redo.push(...session.redo) }
  } else {
    const initial = g.nodes.find((n) => !def(n)?.master) || g.nodes[0]
    if (initial) { sel.value = initial.id; selected.add(initial.id) }
    await nextTick(); frameNodes()
  }
  apply(true)
})
onBeforeUnmount(() => {
  flush()
  shaderGraphSessions(project).set(documentId, { view: { ...view }, sel: sel.value, selected: [...selected],
    detailTab: detailTab.value, showCode: showCode.value, materialId: materialId.value, clipboard: clipboard.value,
    undo: [...undo], redo: [...redo], snapshot: snap() })
  window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp)
})
</script>

<template>
  <FloatingEditorWindow dock-panel-id="shaderGraph" native-tool="shaderGraph" :native-on-demand="true" v-if="sc" :initial-width="1180" :initial-height="760" :start-maximized="true" :docked="docked" :visible="visible" label="Shader Graph" @close="close">
    <div ref="editorRoot" v-show="visible" class="edwin sg" :class="{ docked }" tabindex="0" @keydown="onKey" @keydown.esc.stop="onEsc">
      <h2 class="sg-header" data-window-drag-handle>
        <Icon name="shader" :size="15" />
        <span class="cap">{{ sc.name }}</span>
        <span class="div"></span>
        <span class="path">{{ sc.folder }}/{{ sc.name }}</span>
      </h2>
      <div class="sg-tools" role="toolbar" aria-label="Acciones del Shader Graph">
        <div class="sg-tools-group primary-actions">
          <button class="mini add-node" aria-label="Añadir nodo" @click="openSearch(null)"><Icon name="plus" :size="15" /><span>Añadir nodo</span></button>
          <button class="mini" aria-label="Guardar grafo" @click="save"><Icon name="save" :size="15" /><span>Guardar</span></button>
          <button class="mini apply-action" aria-label="Aplicar grafo" @click="apply(true)"><span class="tool-symbol">⟳</span><span>Aplicar</span></button>
          <button class="mini accent" aria-label="Compilar grafo" @click="apply(true)"><Icon name="play" :size="14" /><span>Compilar</span></button>
        </div>
        <span class="tool-separator" aria-hidden="true"></span>
        <div class="sg-tools-group history-actions">
          <button class="mini" :disabled="!undo.length" @click="doUndo" aria-label="Deshacer" title="Deshacer (Ctrl+Z)">↶ <span>Deshacer</span></button>
          <button class="mini" :disabled="!redo.length" @click="doRedo" aria-label="Rehacer" title="Rehacer (Ctrl+Y)">↷ <span>Rehacer</span></button>
        </div>
        <button class="sg-search-trigger" type="button" aria-label="Buscar nodo" @click="openSearch(null)">
          <span class="search-symbol" aria-hidden="true">⌕</span><span>Buscar nodo…</span><kbd>Espacio</kbd>
        </button>
        <div class="sg-tools-group sg-quick-tools">
          <button class="mini icon-action" aria-label="Encajar nodos" title="Encajar todos (Inicio)" @click="frameNodes()">⊞</button>
          <button class="mini icon-action" aria-label="Enfocar selección" title="Enfocar selección (F)" @click="frameNodes(true)">⌖</button>
          <div class="sg-more-wrap">
            <button class="mini" :aria-expanded="moreTools" aria-label="Más acciones de grafos" @click="moreTools = !moreTools">Más ▾</button>
            <div v-if="moreTools" class="sg-more-menu" @pointerdown.stop>
              <button :disabled="!selected.size" @click="copySelected(); pasteSelected(); moreTools = false">Duplicar</button>
              <button :disabled="!selected.size" @click="copySelected(); moreTools = false">Copiar</button>
              <button :disabled="!clipboard?.nodes?.length" @click="pasteSelected(); moreTools = false">Pegar</button>
              <button :disabled="!selected.size" @click="removeSelected(); moreTools = false">Eliminar</button>
              <button v-if="!post" :disabled="hasVertex" @click="addVertexOut(); moreTools = false">＋ Salida de vértices</button>
              <button @click="showCode = true; moreTools = false">Código GLSL</button>
            </div>
          </div>
        </div>
        <button class="mini dock-action" :aria-label="docked ? 'Undock Shader Graph' : 'Dock Shader Graph'" @click="toggleDock"><Icon name="frame" :size="14" /><span>{{ docked ? 'Undock' : 'Dock' }}</span></button>
        <span class="sg-tools-target">{{ post ? 'Post' : 'Material' }}</span>
      </div>
      <div class="sg-workspace">

        <div class="sg-graph-pane">
          <div ref="surface" class="sg-canvas" @pointerdown="onBgDown" @wheel.prevent="onWheel" @contextmenu.prevent="openSearch($event)" @dragover="allowPaletteDrop" @drop="dropPaletteNode">
            <div class="sg-canvas-title" aria-hidden="true">{{ sc.name }}</div>
          <div class="grid" :style="{ backgroundSize: `${24 * view.k}px ${24 * view.k}px, ${24 * view.k}px ${24 * view.k}px, ${120 * view.k}px ${120 * view.k}px, ${120 * view.k}px ${120 * view.k}px`, backgroundPosition: `${view.x}px ${view.y}px` }"></div>
          <div v-if="boxSelect" class="sg-marquee" :style="{ left: Math.min(boxSelect.x, boxSelect.x2) * view.k + view.x + 'px', top: Math.min(boxSelect.y, boxSelect.y2) * view.k + view.y + 'px', width: Math.abs(boxSelect.x2 - boxSelect.x) * view.k + 'px', height: Math.abs(boxSelect.y2 - boxSelect.y) * view.k + 'px' }"></div>
          <div class="world" :style="{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }">
            <svg class="edges" width="1" height="1" style="overflow: visible">
              <path v-for="p in paths" :key="p.id" :d="p.d" :stroke="p.c" fill="none" stroke-width="2" class="sg-wire" />
              <path v-if="tempPath" :d="tempPath" stroke="#fff" stroke-dasharray="5 4" fill="none" stroke-width="2" />
            </svg>
            <div v-for="n in g.nodes" :key="n.id" class="node" :class="{ texture: isTexture(n), sel: selected.has(n.id), master: def(n).master, bad: errNodes.has(n.id) }"
                 :style="{ left: n.x + 'px', top: n.y + 'px', width: W + 'px', height: nodeH(n) + 'px' }" :data-type="n.type" @pointerdown="onNodeDown($event, n)">
              <div class="nh" :class="'c-' + (def(n).cat || 'x')">{{ nodeTitle(n) }} <span v-if="isTexture(n)" class="nh-sub">TEX</span></div>
              <div v-if="n.type === 'texture' || n.type === 'triplanar'" class="sg-texture-thumb" :class="{ empty: !assetThumbs[linkedTextureId(n)] }" aria-hidden="true">
                <img v-if="assetThumbs[linkedTextureId(n)]" :src="assetThumbs[linkedTextureId(n)]" alt="" />
                <span v-else>Sin textura</span>
              </div>
              <div v-if="n.type === 'color'" class="sg-color-chip" :style="{ background: n.params.v }" aria-hidden="true"></div>
              <div v-for="r in rows(n)" :key="r" class="nrow" :class="{ 'texture-row': isTexture(n) }" :style="{ top: inputStart(n) + (r - 1) * ROW + 'px', height: ROW + 'px' }">
                <template v-if="def(n).in[r - 1]">
                  <span class="port in" :data-node="n.id" :data-side="'in'" :data-key="def(n).in[r - 1].k"
                        :style="{ background: colorOf(def(n).in[r - 1].t === 'T' ? 'float' : def(n).in[r - 1].t) }"
                        @pointerdown="onPortDown($event, n, 'in', def(n).in[r - 1].k)"></span>
                  <span v-if="!isTexture(n)" class="lbl">{{ def(n).in[r - 1].label }}</span>
                  <template v-if="!connected(n, def(n).in[r - 1].k) && inline(n, def(n).in[r - 1]) !== null && !def(n).master && !isTexture(n)">
                    <template v-if="Array.isArray(inline(n, def(n).in[r - 1]))">
                      <input v-for="(c, ci) in inline(n, def(n).in[r - 1])" :key="ci" class="iv s" type="number" step="any" :value="c"
                             @change="setInline(n, def(n).in[r - 1], ci, $event.target.value)" />
                    </template>
                    <input v-else class="iv" type="number" step="any" :value="inline(n, def(n).in[r - 1])" @change="setInline(n, def(n).in[r - 1], 0, $event.target.value)" />
                  </template>
                  <template v-else-if="def(n).master && !connected(n, def(n).in[r - 1].k)">
                    <span class="off">sin asignar</span>
                  </template>
                </template>
                <template v-if="def(n).out[r - 1]">
                  <span class="grow"></span>
                  <span class="lbl r">{{ def(n).out[r - 1].label }}</span>
                  <span class="port out" :data-node="n.id" :data-side="'out'" :data-key="def(n).out[r - 1].k"
                        :style="{ background: colorOf(outType(n, def(n).out[r - 1])) }" @pointerdown="onPortDown($event, n, 'out', def(n).out[r - 1].k)"></span>
                </template>
              </div>
              <div v-for="(p, pi) in def(n).params || []" :key="p.k" class="nparam" :style="{ top: paramStart(n) + pi * PARAM + 'px', height: PARAM + 'px' }">
                <label class="nparam-label">{{ p.label }}</label>
                <input v-if="p.type === 'number'" type="number" step="any" :value="n.params[p.k]" @change="setParam(n, p, $event.target.value)" />
                <template v-else-if="p.type === 'vec'">
                  <input v-for="c in p.n" :key="c" class="s" type="number" step="any" :value="(n.params[p.k] || p.def)[c - 1]" @change="setParam(n, p, $event.target.value, c - 1)" />
                </template>
                <ColorInput v-else-if="p.type === 'color'" :value="n.params[p.k]" @input="setParam(n, p, $event.target.value)" />
                <select v-else-if="p.type === 'prop'" :value="n.params[p.k]" @change="setParam(n, p, $event.target.value)">
                  <option value="">— propiedad —</option>
                  <option v-for="o in propsFor(p)" :key="o.id" :value="o.id">{{ o.name }}</option>
                </select>
              </div>
            </div>
          </div>
          <div v-if="search" class="sg-search" :style="{ left: Math.max(0, Math.min(search.x, (surface?.clientWidth || 300) - 270)) + 'px', top: Math.max(0, Math.min(search.y, (surface?.clientHeight || 330) - 300)) + 'px' }" @pointerdown.stop>
            <input id="sg-search" v-model="search.q" placeholder="Buscar nodo…" @keydown.enter="results[0] && addNode(results[0].items[0].id)" />
            <div class="list">
              <template v-for="c in results" :key="c.cat">
                <div class="cat">{{ c.cat }}</div>
                <button v-for="d in c.items" :key="d.id" @click="addNode(d.id)">{{ d.label }}</button>
              </template>
            </div>
          </div>
          </div>
          <section class="sg-output" aria-label="Salida de compilación">
            <div class="sg-output-tabs" role="tablist" aria-label="Panel inferior">
              <button type="button" role="tab" :aria-selected="!showCode" :class="{ active: !showCode }" @click="showCode = false">Salida</button>
              <button type="button" role="tab" :aria-selected="showCode" :class="{ active: showCode }" @click="showCode = true">Código GLSL</button>
              <span class="grow"></span>
              <span class="output-count" :class="status.ok ? 'ok' : 'bad'">{{ status.errors.length }} errores</span>
            </div>
            <pre v-if="showCode" class="sg-code" tabindex="0">{{ code }}</pre>
            <div v-else class="sg-messages" role="status" aria-live="polite">
              <div class="sg-result" :class="status.ok ? 'ok' : 'bad'">{{ status.ok ? '✓' : '✕' }} {{ status.message }}</div>
              <div v-for="(error, i) in status.errors" :key="i" class="sg-error">{{ error.message }}</div>
              <div v-if="status.ok" class="sg-output-note">El código se actualiza al editar el grafo. Pulsa Compilar para verificarlo nuevamente.</div>
            </div>
          </section>
        </div>
        <aside class="sg-inspector" aria-label="Detalles y previsualización">
          <div class="sg-detail-tabs" role="tablist" aria-label="Inspector del Shader Graph">
            <button :class="{ active: detailTab === 'node' }" role="tab" :aria-selected="detailTab === 'node'" @click="detailTab = 'node'">Detalles</button>
            <button :class="{ active: detailTab === 'graph' }" role="tab" :aria-selected="detailTab === 'graph'" @click="detailTab = 'graph'">Propiedades del grafo</button>
            <button :class="{ active: detailTab === 'palette' }" role="tab" :aria-selected="detailTab === 'palette'" @click="detailTab = 'palette'">Paleta</button>
          </div>
          <section v-if="detailTab === 'palette'" class="sg-board sg-palette" aria-label="Paleta de nodos">
            <input v-model="paletteQuery" type="search" placeholder="Buscar nodos…" aria-label="Buscar nodos en la paleta" />
            <p v-if="!palette.length" class="lf-help">Sin resultados</p>
            <div v-for="group in palette" :key="group.cat">
              <div class="bh">{{ group.cat }}</div>
              <button v-for="node in group.items" :key="node.id" class="sg-palette-node" type="button" draggable="true"
                @dragstart="dragPaletteNode($event, node.id)" @click="insertPaletteNode(node.id)">
                <span class="sg-type-mark" :class="'c-' + group.cat"></span>{{ node.label }}
              </button>
            </div>
          </section>
          <section v-else-if="detailTab === 'node'" class="sg-board" aria-label="Propiedades del nodo seleccionado">
            <template v-if="selectedNode">
              <div class="sg-node-title"><div class="sg-detail-type"><span class="sg-type-mark" :class="'c-' + def(selectedNode).cat"></span><strong>{{ nodeTitle(selectedNode) }}</strong></div><small>{{ def(selectedNode).cat }} · {{ selectedNode.type }}</small></div>
              <div v-if="isTexture(selectedNode)" class="sg-detail-group">
                <div class="bh">Recurso de textura</div>
                <div class="sg-texture-resource">
                  <div class="sg-resource-thumb"><img v-if="assetThumbs[linkedTextureId(selectedNode)]" :src="assetThumbs[linkedTextureId(selectedNode)]" alt="Miniatura de la textura asociada" /><span v-else>Sin asignar</span></div>
                  <div class="sg-resource-info"><strong>{{ textureName(selectedNode) }}</strong><small>Asociada al material del proyecto</small></div>
                </div>
                <div v-if="propOf(selectedNode)" class="sg-detail-field"><label>Espacio de color</label><select :value="propOf(selectedNode).srgb ? 'srgb' : 'linear'" aria-label="Espacio de color" @change="setProp(propOf(selectedNode), 'srgb', $event.target.value === 'srgb')"><option value="srgb">sRGB · Color</option><option value="linear">Lineal · Datos</option></select></div>
              </div>
              <div v-if="def(selectedNode).params?.length" class="sg-detail-group">
                <div class="bh">Parámetros</div>
                <div v-for="p in def(selectedNode).params" :key="p.k" class="sg-detail-field">
                  <label>{{ p.label }}</label>
                  <input v-if="p.type === 'number'" type="number" step="any" :value="selectedNode.params[p.k]" @change="setParam(selectedNode, p, $event.target.value)" />
                  <div v-else-if="p.type === 'vec'" class="sg-vector-fields">
                    <input v-for="i in p.n" :key="i" type="number" step="any" :aria-label="`${p.label} ${['X','Y','Z','W'][i-1]}`" :value="(selectedNode.params[p.k] || p.def)[i-1]" @change="setParam(selectedNode, p, $event.target.value, i-1)" />
                  </div>
                  <div v-else-if="p.type === 'color'" class="sg-detail-color"><ColorInput :value="selectedNode.params[p.k]" @change="setParam(selectedNode, p, $event.target.value)" /><code>{{ selectedNode.params[p.k] }}</code></div>
                  <select v-else-if="p.type === 'prop'" :value="selectedNode.params[p.k]" @change="setParam(selectedNode, p, $event.target.value)">
                    <option value="">— propiedad —</option><option v-for="o in propsFor(p)" :key="o.id" :value="o.id">{{ o.name }}</option>
                  </select>
                  <span v-if="p.type === 'prop' && ['texture','triplanar'].includes(selectedNode.type)" class="sg-detail-hint">La textura se asigna desde el material que usa este grafo.</span>
                </div>
              </div>
              <div v-if="def(selectedNode).in.length" class="sg-detail-group">
                <div class="bh">Entradas</div>
                <div v-for="i in def(selectedNode).in" :key="i.k" class="sg-detail-field">
                  <label><span class="sg-pin-mini" :style="{ background: colorOf(i.t === 'T' ? 'float' : i.t) }"></span>{{ i.label }}</label>
                  <span v-if="connected(selectedNode, i.k)" class="sg-connected">Conectada</span>
                  <template v-else-if="inline(selectedNode, i) !== null && !def(selectedNode).master">
                    <div v-if="Array.isArray(inline(selectedNode, i))" class="sg-vector-fields">
                      <input v-for="(v, ci) in inline(selectedNode, i)" :key="ci" type="number" step="any" :value="v" :aria-label="`${i.label} ${ci+1}`" @change="setInline(selectedNode, i, ci, $event.target.value)" />
                    </div>
                    <input v-else type="number" step="any" :value="inline(selectedNode, i)" @change="setInline(selectedNode, i, 0, $event.target.value)" />
                  </template>
                  <span v-else class="sg-detail-hint">{{ def(selectedNode).master ? 'Sin asignar' : 'Automática' }}</span>
                </div>
              </div>
              <div v-if="!def(selectedNode).params?.length && !def(selectedNode).in.length" class="sg-detail-empty">Este nodo no tiene parámetros editables. Puedes conectar sus salidas en el lienzo.</div>
              <details v-if="uvNode" class="sg-detail-group" open>
                <summary class="bh">Coordenadas UV · nodo conectado</summary>
                <div v-for="i in def(uvNode).in.filter((i) => i.k !== 'uv')" :key="i.k" class="sg-detail-field">
                  <label>{{ i.label }}</label><span v-if="connected(uvNode, i.k)" class="sg-connected">Conectada</span>
                  <div v-else class="sg-vector-fields"><input v-for="(v, ci) in inline(uvNode, i)" :key="ci" type="number" step="any" :value="v" :aria-label="`${i.label} ${['X','Y'][ci]}`" @change="setInline(uvNode, i, ci, $event.target.value)" /></div>
                </div>
              </details>
            </template>
            <div v-else class="sg-detail-empty"><strong>Sin nodo seleccionado</strong><span>Selecciona un nodo en el lienzo para editar sus parámetros, entradas y propiedades.</span></div>
          </section>
          <section v-else class="sg-board sg-graph-properties" aria-label="Propiedades del grafo">
            <div class="sg-node-title"><strong>{{ sc.name }}</strong><small>{{ post ? 'Post Processing' : 'Material' }} · {{ visibleNodeCount }}</small></div><div class="bh">Propiedades públicas</div>
            <div v-if="!g.props.length" class="hint lf-help">Añade propiedades para exponer parámetros en el material y en scripts.</div>
            <div v-for="p in g.props" :key="p.id" class="prop">
              <div class="prow">
                <input class="pname" :value="p.name" @change="setProp(p, 'name', $event.target.value)" />
                <span class="ptype">{{ PROP_TYPES.find((t) => t[0] === p.type)?.[1] }}</span>
                <button class="x" data-tooltip="Nodo de esta propiedad" @click="propNode(p)">⊕</button>
                <button class="x" data-tooltip="Eliminar" @click="delProp(p)">✕</button>
              </div>
              <div class="prow sub">
                <template v-if="p.type === 'float'">
                  <input type="number" step="any" :value="p.def" data-tooltip="Por defecto" @change="setPropDef(p, $event.target.value)" />
                  <input type="number" step="any" :value="p.min" data-tooltip="Mín" @change="setProp(p, 'min', parseFloat($event.target.value) || 0)" />
                  <input type="number" step="any" :value="p.max" data-tooltip="Máx" @change="setProp(p, 'max', parseFloat($event.target.value) || 0)" />
                </template>
                <ColorInput v-else-if="p.type === 'color'" :value="p.def" @input="setPropDef(p, $event.target.value)" />
                <template v-else-if="p.type === 'vec3'">
                  <input v-for="c in 3" :key="c" type="number" step="any" :value="p.def[c - 1]" @change="setPropDef(p, $event.target.value, c - 1)" />
                </template>
                <label v-else-if="p.type === 'bool'"><input type="checkbox" :checked="p.def" @change="setPropDef(p, $event.target.checked)" /> activada</label>
                <span v-else class="hint lf-help">La textura se elige en el material.</span>
              </div>
            </div>
            <div class="addrow">
              <button v-for="t in selectablePropTypes" :key="t[0]" class="mini" @click="addProp(t[0])">＋ {{ t[1] }}</button>
            </div>

          </section>
          <section class="sg-preview-panel" aria-label="Vista previa del shader">
            <div class="sg-panel-heading"><span>Vista previa de {{ post ? 'postprocesado' : 'material' }}</span><span class="meta">{{ post ? 'Post' : 'PBR · Material' }}</span></div>
            <div v-if="linkedMaterials.length" class="sg-material-picker"><label>Material</label><select :value="activeMaterial?.id" aria-label="Material de vista previa" @change="materialId = $event.target.value"><option v-for="m in linkedMaterials" :key="m.id" :value="m.id">{{ m.name }}</option></select></div>
            <div class="sg-preview-stage"><ShaderPreview :code="code" :target="g.target" :graph="g" :shader-id="sc.id" :material-id="activeMaterial?.id || ''" :active="visible" :size="300" @error="previewError" /></div>
          </section>
        </aside>
      </div>
      <div class="sg-status">
        <span :class="status.ok ? 'ok' : 'bad'" :data-tooltip="status.message">{{ status.ok ? '✓' : '✕' }} {{ status.message }}</span>
        <span class="grow"></span>
        <span class="sg-count">{{ g.nodes.length }} nodos · {{ g.edges.length }} conexiones · {{ selected.size }} seleccionados</span><button class="sg-zoom" aria-label="Restablecer zoom" @click="view.k = 1">{{ Math.round(view.k * 100) }}%</button>
        <span class="sg-hint">Espacio buscar · Mayús arrastrar: selección · Rueda: zoom · Inicio: encajar · F: selección</span>
      </div>
    </div>
  </FloatingEditorWindow>
</template>

<style scoped>
.edwin.sg { --sg-line:#394045; display:flex; flex-direction:column; width:100%; height:100%; max-width:none; max-height:none; min-width:0; min-height:0; margin:0; overflow:hidden; container-type:size; color:#d6d9db; background:#202528; border:1px solid #43494d; border-radius:3px; outline:none; font:12px/1.4 var(--font,'IBM Plex Sans',sans-serif); }
.edwin.sg.docked { border:0; border-radius:0; }
.edwin.sg .sg-header { display:flex; flex:none; align-items:center; gap:10px; height:32px; min-height:32px; margin:0; padding:0 90px 0 13px; background:#1b2023; border-bottom:1px solid #101618; font:500 12px var(--font); }
.cap { color:#e8ebed; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.div { height:14px; border-left:1px solid #465058; }
.path { color:#97a0a7; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sg-tools { display:flex; flex:none; align-items:center; gap:7px; min-width:0; height:38px; padding:3px 8px; background:linear-gradient(#2b3135,#252a2e); border-bottom:1px solid #101619; overflow:visible; }
.sg-tools-group { display:flex; align-items:center; gap:3px; flex:none; min-width:0; }
.sg-tools .mini { display:inline-flex; align-items:center; justify-content:center; gap:5px; min-height:28px; height:28px; padding:3px 9px; border:1px solid transparent; border-radius:2px; white-space:nowrap; font:12px var(--font); color:#cfd4d8; background:transparent; }
.sg-tools .mini:hover:not(:disabled) { background:#3a4349; border-color:#4b555b; }
.sg-tools .mini:disabled { opacity:.35; cursor:default; }
.sg-tools .accent { border-color:#414b50; background:#262e31; }
.sg-tools .accent :deep(svg) { color:#63bf7e; }
.tool-symbol { font-size:16px; line-height:1; }
.tool-separator { height:24px; width:1px; background:#41484c; flex:none; }
.sg-search-trigger { display:flex; flex:1; align-items:center; gap:8px; height:27px; min-width:75px; max-width:430px; padding:3px 8px; border:1px solid #444d52; border-radius:2px; background:#181d20; color:#929da5; text-align:left; font:12px var(--font); }
.sg-search-trigger span:nth-child(2) { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.search-symbol { font-size:18px; }
.sg-search-trigger kbd { margin-left:auto; font:9px var(--font); color:#707b83; }
.sg-quick-tools { margin-left:auto; }
.sg-tools .icon-action { width:28px; padding:0; font-size:16px; }
.sg-tools .dock-action { border-color:#495258; }
.sg-tools-target { flex:none; font-size:11px; color:#a9b3ba; border-left:1px solid #41494e; padding:0 9px; }
.sg-more-wrap { position:relative; }
.sg-more-menu { position:absolute; z-index:40; right:0; top:30px; display:flex; flex-direction:column; min-width:175px; padding:4px; border:1px solid #4e585e; border-radius:3px; background:#252c30; box-shadow:0 8px 24px #0009; }
.sg-more-menu button { border:0; background:transparent; color:#d6dbde; text-align:left; min-height:28px; padding:5px 10px; }
.sg-more-menu button:hover:not(:disabled) { background:#354d5d; }
.sg-more-menu button:disabled { opacity:.35; }
.grow { flex:1; }
.sg-workspace { display:grid; flex:1; min-width:0; min-height:0; overflow:hidden; grid-template-columns:minmax(0,1fr) clamp(285px,27%,410px); }
.sg-graph-pane { display:flex; flex-direction:column; min-width:0; min-height:0; overflow:hidden; }
.sg-canvas { position:relative; flex:1; min-width:0; min-height:0; overflow:hidden; background:#1c2225; cursor:grab; }
.sg-canvas-title { position:absolute; bottom:12px; right:15px; z-index:3; color:#899196; font-size:12px; pointer-events:none; }
.grid { position:absolute; inset:0; pointer-events:none; background-color:#1d2326; background-image:linear-gradient(#9eacb309 1px,transparent 1px),linear-gradient(90deg,#9eacb309 1px,transparent 1px),linear-gradient(#9eacb313 1px,transparent 1px),linear-gradient(90deg,#9eacb313 1px,transparent 1px); }
.world { position:absolute; left:0; top:0; transform-origin:0 0; }
.edges { position:absolute; left:0; top:0; pointer-events:none; }
.sg-wire { opacity:.95; stroke-linecap:round; filter:drop-shadow(0 1px 1px #0008); }
.node { position:absolute; background:linear-gradient(145deg,#252b2e,#191e21); border:1px solid #4e585c; border-radius:6px; box-shadow:0 3px 5px #0009; cursor:move; user-select:none; }
.node:hover { border-color:#7d898e; }
.node.sel { border-color:#38b4ed; box-shadow:0 0 0 1px #2896d2,0 3px 7px #000a; }
.node.bad { border-color:#df7770; }
.nh { display:flex; align-items:center; height:32px; padding:0 13px; color:#e9edf0; font-size:13px; font-weight:600; background:linear-gradient(105deg,#2b5573,#263f53); border-radius:5px 5px 0 0; border-bottom:1px solid #ffffff12; }
.nh-sub { margin-left:auto; color:#b5c7d2; font-size:9px; font-weight:400; }
.c-Textura,.c-Entrada { background:linear-gradient(105deg,#285876,#233f59); }
.c-Matemáticas,.c-Trigonometría { background:linear-gradient(105deg,#315d45,#234639); }
.c-Vectores { background:linear-gradient(105deg,#465879,#343f59); }
.c-Procedural { background:linear-gradient(105deg,#69513b,#493c2f); }
.c-Organización,.c-Pantalla { background:linear-gradient(105deg,#635275,#403c59); }
.node.master .nh,.c-Salida { background:linear-gradient(105deg,#77543f,#524036); }
.nrow { position:absolute; left:0; right:0; display:flex; align-items:center; gap:5px; padding:0 12px; }
.lbl { font-size:12px; white-space:nowrap; color:#d4dade; }
.lbl.r { text-align:right; }
.off { font-size:10px; color:#76848c; font-style:italic; }
.port { position:absolute; z-index:2; width:11px; height:11px; border-radius:50%; border:1px solid #152026; box-shadow:0 0 0 1px #8b96984d; cursor:crosshair; }
.port.in { left:-6px; } .port.out { right:-6px; }
.port:hover { box-shadow:0 0 0 3px #70c8f766; }
.iv { width:52px; min-width:0; height:21px; padding:1px 4px; font:11px var(--font); }
.iv.s { width:32px; }
.nparam { position:absolute; left:0; right:0; display:flex; align-items:center; gap:7px; padding:2px 10px; }
.nparam-label { flex:none; font-size:11px; color:#bfc7cb; max-width:70px; overflow:hidden; text-overflow:ellipsis; }
.nparam input,.nparam select { flex:1; min-width:0; width:100%; height:24px; padding:2px 5px; font:11px var(--font); }
.nparam :deep(.lf-color-input) { flex:1; min-width:0; }
.node input,.node select { background:#1a2227; border:1px solid #465259; border-radius:2px; color:#d9e1e5; }
.node input:focus,.node select:focus { outline:1px solid #53a9d7; }
.sg-texture-thumb { position:absolute; top:39px; left:12px; width:91px; height:88px; display:flex; justify-content:center; align-items:center; border:1px solid #505b60; background:#151b1e; color:#89959c; font-size:11px; }
.sg-texture-thumb img { width:100%; height:100%; object-fit:cover; }
.texture-row { padding-left:112px; }
.sg-color-chip { position:absolute; top:37px; left:11px; right:11px; height:19px; border:1px solid #ffffff25; border-radius:2px; }
.sg-marquee { position:absolute; z-index:5; pointer-events:none; background:#3d9ace24; border:1px solid #68b9e0; }
.sg-search { position:absolute; z-index:25; width:265px; max-width:100%; max-height:300px; display:flex; flex-direction:column; padding:6px; background:#242c31; border:1px solid #53636c; border-radius:3px; box-shadow:0 10px 30px #000b; cursor:default; }
.sg-search input { flex:none; width:100%; height:28px; font-size:12px; }
.sg-search .list { overflow:auto; min-height:0; }
.sg-search .cat { padding:8px 7px 3px; color:#849aa8; font-size:10px; text-transform:uppercase; letter-spacing:.6px; }
.sg-search button { display:block; width:100%; padding:5px 8px; border:0; background:transparent; text-align:left; font:12px var(--font); }
.sg-search button:hover { background:#345367; }
.sg-inspector { display:flex; flex-direction:column; min-width:0; min-height:0; overflow:hidden; background:#252a2d; border-left:1px solid #111719; }
.sg-detail-tabs { display:flex; flex:none; height:33px; border-bottom:1px solid #111719; background:#202629; }
.sg-detail-tabs button { flex:1; min-width:0; padding:4px 7px; border:0; border-bottom:2px solid transparent; border-radius:0; font:11px var(--font); color:#abb4ba; background:transparent; }
.sg-detail-tabs button.active { color:#e3e6e8; border-bottom-color:#389bcc; background:#2c3337; }
.sg-palette input { width:100%; margin-bottom:8px; }
.sg-palette-node { display:flex; width:100%; gap:8px; align-items:center; text-align:left; margin:3px 0; padding:6px 8px; cursor:grab; }
.sg-palette-node:active { cursor:grabbing; }
.sg-board { flex:1; min-height:0; overflow:auto; padding:12px; }
.sg-node-title { display:flex; flex-direction:column; gap:5px; padding:0 2px 10px; border-bottom:1px solid #3d4549; margin-bottom:10px; }
.sg-node-title strong { font-size:15px; font-weight:600; color:#e4e7e9; }
.sg-node-title small { font-size:10px; color:#909ca4; }
.sg-detail-type { display:flex; align-items:center; gap:7px; }
.sg-type-mark { width:3px; height:15px; border-radius:1px; }
.sg-detail-group { margin-bottom:10px; }
.sg-detail-group .bh,.bh { font-size:11px; font-weight:500; color:#c9d0d5; padding:6px 2px; border-bottom:1px solid #3a4247; }
.sg-detail-field { display:grid; grid-template-columns:minmax(75px,.8fr) minmax(0,1.2fr); gap:8px; align-items:center; min-width:0; padding:5px 2px; border-bottom:1px solid #ffffff05; font-size:11px; }
.sg-detail-field label { display:flex; align-items:center; gap:5px; color:#b6c0c7; }
.sg-detail-field input,.sg-detail-field select { min-width:0; width:100%; height:25px; padding:2px 6px; background:#191f22; border:1px solid #3e484e; border-radius:2px; color:#dce2e6; font:11px var(--font); }
.sg-vector-fields { display:flex; gap:4px; min-width:0; }
.sg-detail-color { display:flex; align-items:center; gap:7px; min-width:0; }
.sg-detail-color code { font:10px ui-monospace,monospace; color:#9eacb5; }
.sg-detail-hint { grid-column:1/-1; color:#8998a2; font-size:10px; line-height:1.5; }
.sg-pin-mini { width:8px; height:8px; border-radius:50%; }
.sg-connected { color:#99c5ac; font-size:11px; }
.sg-detail-empty,.hint { color:#91a1aa; font-size:11px; line-height:1.5; }
.sg-texture-resource { display:flex; align-items:center; gap:9px; padding:8px 2px; }
.sg-resource-thumb { flex:none; width:44px; height:44px; display:flex; align-items:center; justify-content:center; border:1px solid #525b60; background:#1a2024; color:#87959d; font-size:9px; }
.sg-resource-thumb img { width:100%; height:100%; object-fit:cover; }
.sg-resource-info { display:flex; flex-direction:column; min-width:0; gap:3px; }
.sg-resource-info strong { font-size:11px; font-weight:500; overflow:hidden; text-overflow:ellipsis; }
.sg-resource-info small { font-size:10px; color:#8b9aa3; }
.prop { padding:7px 0; border-bottom:1px solid #3c454a; }
.prow { display:flex; align-items:center; gap:5px; min-width:0; } .prow.sub { margin-top:5px; }
.prow input { min-width:0; width:100%; height:24px; font-size:11px; background:#1a2024; border:1px solid #424c52; border-radius:2px; }
.pname { flex:1; } .ptype { flex:none; font-size:10px; color:#9eacb5; }
.x { padding:0 3px; background:transparent; border:0; color:#acb7bf; }
.addrow { display:flex; flex-wrap:wrap; gap:4px; padding-top:9px; }
.addrow button { font-size:10px; padding:4px 6px; }
.sg-preview-panel { flex:0 0 46%; display:flex; flex-direction:column; min-height:205px; min-width:0; overflow:hidden; border-top:1px solid #111719; }
.sg-panel-heading { display:flex; flex:none; align-items:center; justify-content:space-between; gap:6px; min-height:29px; padding:0 10px; background:#2c3236; border-bottom:1px solid #161d20; font-size:11px; }
.sg-panel-heading .meta { font-size:9px; color:#8c9aa4; }
.sg-material-picker { display:flex; flex:none; align-items:center; gap:8px; padding:3px 8px; font-size:10px; color:#a2afb7; background:#252b2f; }
.sg-material-picker select { flex:1; min-width:0; height:22px; padding:2px 5px; font:10px var(--font); background:#1a2024; border:1px solid #414b51; border-radius:2px; }
.sg-preview-stage { display:flex; flex:1; min-height:0; overflow:hidden; }
.sg-output { display:flex; flex:none; flex-direction:column; height:clamp(82px,16%,128px); min-height:0; border-top:1px solid #101719; background:#1b2023; }
.sg-output-tabs { display:flex; flex:none; align-items:center; height:30px; padding:0 4px; border-bottom:1px solid #3b444a; background:#252c30; }
.sg-output-tabs button { height:29px; padding:3px 13px; border:0; border-bottom:2px solid transparent; border-radius:0; color:#aebac3; background:transparent; font:11px var(--font); }
.sg-output-tabs button.active { border-bottom-color:#369dcc; background:#30393e; color:#e2e8ec; }
.output-count { padding-right:8px; font-size:10px; color:#9eafb9; }
.sg-messages { flex:1; min-height:0; overflow:auto; padding:10px 14px; font:11px/1.5 var(--font); }
.sg-result { margin-bottom:5px; } .sg-error { color:#e7a09b; white-space:pre-wrap; }
.sg-output-note { color:#8f9aa3; font-size:10px; }
.sg-code { flex:1; min-height:0; width:100%; margin:0; padding:10px 14px; overflow:auto; color:#b8cbd8; font:11px/1.5 ui-monospace,monospace; background:#191f22; user-select:text; }
.sg-status { display:flex; flex:none; align-items:center; gap:12px; height:25px; min-width:0; padding:0 10px; border-top:1px solid #41494e; background:#292f33; font-size:10px; }
.sg-status > span:first-child { max-width:35%; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.ok { color:#77c49b; } .bad { color:#ef9a91; }
.sg-count { white-space:nowrap; color:#aab6be; }
.sg-hint { max-width:44%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#83939e; font-size:9px; }
.sg-zoom { flex:none; height:20px; padding:1px 6px; border:1px solid #465159; border-radius:2px; font-size:10px; background:#20272b; }
@container (max-width:1100px) { .sg-tools .mini { padding:3px 7px; } .history-actions span,.add-node span,.sg-search-trigger kbd,.sg-hint { display:none; } }
@container (max-width:850px) { .sg-workspace { grid-template-columns:minmax(0,1fr) 265px; } .primary-actions .mini span,.sg-tools-target,.sg-search-trigger span:nth-child(2) { display:none; } .sg-search-trigger { flex:1; min-width:28px; } .sg-tools { gap:4px; } .sg-preview-panel { min-height:155px; } .sg-board { padding:9px; } .sg-count { font-size:9px; } }
@container (max-width:620px) { .sg-workspace { grid-template-columns:minmax(0,1fr) 220px; } .sg-quick-tools .icon-action { display:none; } .sg-tools .mini { padding:3px 5px; } .sg-status .sg-count { display:none; } .sg-detail-tabs button { font-size:10px; } }
@container (max-height:540px) { .sg-preview-panel { flex-basis:49%; min-height:140px; } .sg-output { height:73px; } .sg-output-note { display:none; } .sg-panel-heading { min-height:25px; } .sg-board { padding:8px; } }
</style>
