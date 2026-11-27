<script setup>
import ChunkTree from './ChunkTree.vue'
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import {
  store, treeNodeOpen, setTreeNodeOpen, instantiateScene, selectObject, updateObject, addNodeScript, authoredNodeScriptIds, toggleOpen, renameObject, reparent, reorderSiblings, commit, isDescendant, selectionRoots,
  getObject, switchScene, descendantsOf, selectPiece, removeTerrain, terrainOn, setPieceVisible, renamePiece, selectScene, activeScene, openScriptEditor, toast,
} from '../core/store.js'
import { kindIcon } from '../engine/runtime/nodes/index.js'
import { nodeMenu, openAddMenu, terrainMenu, openSceneInstancePicker, canParentSceneInstance } from '../core/commands.js'
import Icon from './Icon.vue'
import { hasAssetEntry, nodeScriptFromDrop } from '../core/editor/script-drop.js'
import { resolveAssetDrop } from '../core/editor/asset-drop.js'
import { allEntries } from '../core/project.js'
import ColorPickerPanel from './ColorPickerPanel.vue'

const sceneActive = computed(() => store.sceneSel)
const filter = ref('')
const panelTab = ref('tree') // pestaña contextual junto a la Jerarquía
const sceneOpen = computed({get:()=>store.treeState.rootOpen,set:v=>{store.treeState.rootOpen=v}}) // la escena es la raíz del árbol; se pliega como cualquier nodo
const listEl = ref(null)
const searchEl = ref(null)
const renameText = ref('')
const drop = ref(null) // { id, zone: 'before' | 'inside' | 'after' }
let scrollDragRaf = 0, dragY = null
let anchor = null
let dragIds = []

const COLOR = {
  sceneInstance: 'var(--blue)', node: 'var(--text-2)', node3d: 'var(--text-2)', group: 'var(--n-group)',
  primitive: 'var(--n-mesh)', mesh: 'var(--n-mesh)', text: 'var(--n-mesh)',
  model: 'var(--n-model)', subtract: 'var(--n-mesh)', decal: 'var(--n-mesh)',
  sprite2d: 'var(--n-mesh)', sprite3d: 'var(--n-mesh)', light: 'var(--n-light)',
  camera: 'var(--n-camera)', cameraShake: 'var(--n-camera)', spawn: 'var(--n-spawn)',
  staticbody3d: 'var(--n-mesh)', rigidbody3d: 'var(--n-model)',
  characterbody3d: 'var(--n-spawn)', area3d: 'var(--n-area)', collisionshape3d: 'var(--n-area)',
  trigger: 'var(--n-area)', event: 'var(--amber)', gameplayObject: 'var(--n-spawn)',
  audio: 'var(--n-camera)', canvas: 'var(--n-group)', navigation: 'var(--n-spawn)',
}

const childMap = computed(() => {
  const m = new Map([[null, []]])
  for (const o of store.project.objects) {
    const k = o.parentId || null
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(o)
  }
  return m
})

/** Filas visibles en orden de árbol; con filtro se muestran las coincidencias junto a sus ancestros. */
const rows = computed(() => {
  const f = filter.value.trim().toLowerCase()
  const out = []
  const matches = (o) => o.name.toLowerCase().includes(f)
  const matchCache = new Map()
  const subtreeHas = (o) => {
    if (matchCache.has(o.id)) return matchCache.get(o.id)
    const match = matches(o) || (childMap.value.get(o.id) || []).some(subtreeHas)
    matchCache.set(o.id, match)
    return match
  }
  const walk = (pid, depth) => {
    for (const o of childMap.value.get(pid) || []) {
      if (f && !subtreeHas(o)) continue
      const kids = childMap.value.get(o.id) || []
      out.push({ o, depth, hasKids: kids.length > 0 })
      if (kids.length && (f || treeNodeOpen(o))) walk(o.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
})

const descCount = (id) => (childMap.value.get(id) || []).reduce((n, c) => n + 1 + descCount(c.id), 0)
const total = computed(() => store.project.objects.length)

// ---------- virtualización: solo se montan las filas visibles (alto fijo) ----------
const ROW_H = 24, OVERSCAN = 8, UNIT = 14
const scrollTop = ref(0)
const viewH = ref(400)
const range = computed(() => {
  const n = rows.value.length
  const st = Math.min(scrollTop.value, Math.max(0, n * ROW_H - viewH.value)) // el navegador acota el scroll si la lista se acorta
  const a = Math.max(0, Math.floor(st / ROW_H) - OVERSCAN)
  const b = Math.min(n, Math.ceil((st + viewH.value) / ROW_H) + OVERSCAN)
  return { a, b }
})
const rowIndex = computed(() => new Map(rows.value.map((r, i) => [r.o.id, i])))
const shown = computed(() => rows.value.slice(range.value.a, range.value.b))
const padTop = computed(() => range.value.a * ROW_H)
const padBottom = computed(() => Math.max(0, rows.value.length - range.value.b) * ROW_H)
const selSet = computed(() => new Set([
  ...store.selectedIds,
  ...(store.terrainSel && store.activePieceId ? [store.activePieceId] : []),
]))
const scriptNames = computed(() => new Map((store.project?.scripts || []).map((script) => [script.id, script.name])))
function openNodeScript(o) {
  const ids = authoredNodeScriptIds(o)
  if (!ids.length) return
  selectObject(o.id)
  // Con varios scripts se muestra la sección del Inspector; uno solo mantiene acceso directo.
  store.prefs.rightTab = 'object'
  if (ids.length === 1 && scriptNames.value.has(ids[0])) openScriptEditor(ids[0])
}
function searchKey(e) {
  if (e.key === 'Escape') { filter.value = ''; searchEl.value?.blur(); listEl.value?.focus(); e.preventDefault() }
  else if (e.key === 'ArrowDown' || e.key === 'Enter') { listEl.value?.focus(); e.preventDefault() }
}
let scrollRaf = 0
function onScroll() {
  if (listEl.value && sceneOpen.value && !filter.value) store.treeState.scroll = listEl.value.scrollTop
  if (scrollRaf) return
  scrollRaf = requestAnimationFrame(() => { scrollRaf = 0; if (listEl.value) scrollTop.value = listEl.value.scrollTop })
}
async function restoreTreeScroll() {
  const tree = store.treeState, saved = tree.scroll
  await nextTick()
  if (store.treeState !== tree || !listEl.value || !sceneOpen.value) return
  listEl.value.scrollTop = saved
  scrollTop.value = listEl.value.scrollTop
}
watch(() => store.treeState, restoreTreeScroll, {flush:'post'})
watch(sceneOpen, open => { if (open) restoreTreeScroll() })
let ro = null
onMounted(() => {
  ro = new ResizeObserver(() => { if (listEl.value) viewH.value = listEl.value.clientHeight || 400 })
  if (listEl.value) ro.observe(listEl.value)
  restoreTreeScroll()
})
onBeforeUnmount(() => { ro?.disconnect(); if (scrollRaf) cancelAnimationFrame(scrollRaf); stopDragScroll() })
/** Desplaza la lista lo mínimo para que la fila `id` quede a la vista. */
function revealRow(id) {
  const el = listEl.value
  if (!el) return
  const i = rowIndex.value.get(id)
  if (i === undefined) return
  const top = i * ROW_H, bottom = top + ROW_H
  if (top < el.scrollTop) el.scrollTop = top
  else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight
  scrollTop.value = el.scrollTop
  if (!filter.value) store.treeState.scroll = el.scrollTop
}

// ---------- selección ----------
function onRowClick(e, row) {
  listEl.value?.focus({ preventScroll: true })
  const id = row.o.id
  if (row.o.type === 'terrain') { selectPiece(id); anchor = id; return }
  if (e.shiftKey && !e.ctrlKey && !e.metaKey && anchor) {
    const ids = rows.value.filter((r) => r.o.type !== 'terrain').map((r) => r.o.id)
    const a = ids.indexOf(anchor), b = ids.indexOf(id)
    if (a >= 0 && b >= 0) {
      const [lo, hi] = a < b ? [a, b] : [b, a]
      selectObject(null, { range: ids.slice(lo, hi + 1) })
      return
    }
  }
  if (e.ctrlKey || e.metaKey) selectObject(id, { toggle: true })
  else selectObject(id, { additive: e.shiftKey })
  anchor = id
}

/** Los hijos vinculados se inspeccionan abriendo su escena fuente, nunca modificando la copia. */
async function openInstanceSource(o) {
  const sourceId = o.type === 'sceneInstance' ? o.props?.sceneId : o.sceneSourceSceneId
  if (!sourceId || store.play.on || store.filmMode || !store.project.scenes.some(s => s.id === sourceId)) return
  if (await switchScene(sourceId) && o.sceneSourceNodeId) selectObject(o.sceneSourceNodeId)
}
/** El botón y el menú contextual abren la misma ventana global que Ctrl+Shift+A. */
const canParentInstance = canParentSceneInstance
function openInstancePicker(parentId = null) { return openSceneInstancePicker(parentId) }

async function openLinkedSource(o) { if (o.sceneInstanceOwner) await openInstanceSource(o) }
function onContext(e, row) {
  if (row.o.sceneInstanceOwner) {
    selectObject(row.o.sceneInstanceOwner)
    store.menu = { x: e.clientX, y: e.clientY, items: [{
      label: 'Abrir escena fuente', icon: 'scene',
      disabled: store.play.on || store.filmMode || !store.project.scenes.some(s => s.id === row.o.sceneSourceSceneId),
      run: () => void openLinkedSource(row.o),
    }] }
    return
  }
  if (row.o.type === 'terrain') {
    selectPiece(row.o.id)
    store.menu = { x: e.clientX, y: e.clientY, items: terrainMenu(), rebuild: terrainMenu }
    return
  }
  if (!store.selectedIds.includes(row.o.id)) selectObject(row.o.id)
  store.menu = { x: e.clientX, y: e.clientY, items: [
    { label: 'Instanciar escena hija…', icon: 'scene',
      disabled: !canParentInstance(row.o) || store.play.on || store.filmMode || store.locked,
      run: () => openInstancePicker(row.o.id) },
    { sep: true }, ...nodeMenu(row.o.id),
  ] }
}

function openAdd(e) {
  const r = e.currentTarget.getBoundingClientRect()
  openAddMenu({ x: r.left, y: r.bottom + 2 })
}

// al seleccionar desde el viewport: abrir ancestros y traer la fila a la vista
watch([() => store.selectedId, () => store.treeState], async ([id, tree], [, previousTree]) => {
  if (!id || tree !== previousTree) return
  // Una selección desde el viewport debe ser visible aunque el filtro la oculte.
  if (filter.value && !rows.value.some((row) => row.o.id === id)) filter.value = ''
  let o = getObject(id)
  while (o?.parentId) {
    const p = getObject(o.parentId)
    if (p && !treeNodeOpen(p)) setTreeNodeOpen(p, true)
    o = p
  }
  await nextTick()
  revealRow(id)
  anchor = id
})

// ---------- renombrar ----------
const renaming = computed(() => store.renameId)
watch(renaming, async (id) => {
  if (!id) return
  renameText.value = getObject(id)?.name || store.pieces.find((piece) => piece.id === id)?.name || ''
  await nextTick()
  revealRow(id)
  await nextTick()
  const inp = listEl.value?.querySelector('input.rename')
  inp?.focus()
  inp?.select()
})
function finishRename(save) {
  const id = store.renameId
  store.renameId = null
  if (save && id) {
    if (store.pieces.some((piece) => piece.id === id)) renamePiece(id, renameText.value)
    else renameObject(id, renameText.value)
  }
}

// ---------- teclado ----------
function onKey(e) {
  if (e.target.closest?.('input, textarea, select, button')) return
  const ids = rows.value.map((r) => r.o.id)
  const i = ids.indexOf(store.selectedId || (store.terrainSel ? store.activePieceId : null))
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
    e.preventDefault()
    const index = e.key === 'Home' ? 0 : e.key === 'End' ? ids.length - 1 : Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1))
    const n = ids[Math.min(ids.length - 1, index)]
    if (!n) return
    if (rows.value.some((r) => r.o.id === n && r.o.type === 'terrain')) {
      selectPiece(n); anchor = n
    } else if (e.shiftKey && anchor && ids.includes(anchor)) {
      const selectable = rows.value.filter((row) => row.o.type !== 'terrain').map((row) => row.o.id)
      const a = selectable.indexOf(anchor), b = selectable.indexOf(n)
      if (a >= 0 && b >= 0) selectObject(null, { range: selectable.slice(Math.min(a, b), Math.max(a, b) + 1) })
      else selectObject(n)
    } else { selectObject(n); anchor = n }
    revealRow(n)
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    const o = getObject(store.selectedId)
    if (!o) return
    const children = childMap.value.get(o.id) || []
    if (e.key === 'ArrowRight' && children.length && !treeNodeOpen(o) && !filter.value) toggleOpen(o.id)
    else if (e.key === 'ArrowRight' && children.length && ids.includes(children[0].id)) selectObject(children[0].id)
    else if (e.key === 'ArrowLeft' && children.length && treeNodeOpen(o) && !filter.value) toggleOpen(o.id)
    else if (e.key === 'ArrowLeft' && o.parentId) selectObject(o.parentId)
    else return
    e.preventDefault()
  } else if (e.key === 'F2' && (store.selectedId || store.terrainSel)) {
    e.preventDefault()
    store.renameId = store.selectedId || store.activePieceId
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && store.terrainSel) {
    e.preventDefault()
    e.stopPropagation()
    removeTerrain()
  } else if (e.key === 'Escape' && filter.value) {
    e.preventDefault()
    filter.value = ''
  }
}

// ---------- arrastrar y soltar ----------
function isMoveLocked(o) {
  let current = o
  while (current) {
    if (current.locked) return true
    current = current.parentId ? getObject(current.parentId) : null
  }
  return false
}
function stopDragScroll() {
  if (scrollDragRaf) cancelAnimationFrame(scrollDragRaf)
  scrollDragRaf = 0; dragY = null
}
function endDragging() {
  stopDragScroll()
  drop.value = null
  dragIds = []
}
// El autoscroll funciona sobre la lista virtualizada: nunca desmonta la selección.
function dragScrollFrame() {
  scrollDragRaf = 0
  const list = listEl.value
  if (!dragIds.length || !list || dragY == null) return
  const rect = list.getBoundingClientRect()
  const margin = Math.min(42, rect.height / 3)
  const above = Math.max(0, rect.top + margin - dragY)
  const below = Math.max(0, dragY - (rect.bottom - margin))
  const delta = above ? -Math.max(3, above * 0.4) : below ? Math.max(3, below * 0.4) : 0
  if (delta) {
    list.scrollTop += delta
    scrollTop.value = list.scrollTop
  }
  if (delta) scrollDragRaf = requestAnimationFrame(dragScrollFrame)
}
function trackDrag(e) {
  if (!dragIds.length) return
  dragY = e.clientY
  if (!scrollDragRaf) scrollDragRaf = requestAnimationFrame(dragScrollFrame)
}
function onDragStart(e, row) {
  if (isMoveLocked(row.o)) { e.preventDefault(); toast('Desbloquea el nodo antes de moverlo', 'error'); return }
  const id = row.o.id
  const selected = store.selectedIds.includes(id) ? selectionRoots() : [id]
  // El orden visible manda; la selección puede haberse construido en otro orden.
  dragIds = selected.sort((a, b) => (rowIndex.value.get(a) ?? Infinity) - (rowIndex.value.get(b) ?? Infinity))
  if (!dragIds.length || dragIds.some(k => isMoveLocked(getObject(k)))) { e.preventDefault(); endDragging(); return }
  e.dataTransfer.effectAllowed = 'copyMove'
  e.dataTransfer.setData('text/plain', dragIds.join(','))
  e.dataTransfer.setData('application/x-lf-node', JSON.stringify(dragIds)) // soltar en Proyecto crea un prefab
}
function zoneOf(e, el) {
  // Tres zonas visibles: arriba = antes; centro = dentro; abajo = después.
  // Alt permite seleccionar explícitamente dentro sin depender del cuadrante.
  if (e.altKey) return 'inside'
  const r = el.getBoundingClientRect()
  const y = (e.clientY - r.top) / Math.max(1, r.height)
  return y < 0.27 ? 'before' : y > 0.73 ? 'after' : 'inside'
}
function onDragOver(e, row) {
  if (hasAssetEntry(e.dataTransfer) && !dragIds.length) {
    if (!canParentInstance(row.o)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    drop.value = { id: row.o.id, zone: 'script' }
    return
  }
  if (!dragIds.length) return
  trackDrag(e)
  const id = row.o.id
  if (dragIds.includes(id) || dragIds.some(d => isDescendant(id, d))) { drop.value = null; return }
  const zone = zoneOf(e, e.currentTarget)
  if (zone === 'inside' && (row.o.type === 'terrain' || isMoveLocked(row.o))) { drop.value = null; return }
  if (zone === 'inside' && dragIds.some(d => getObject(d)?.type === 'terrain')) { drop.value = null; return }
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  drop.value = { id, zone }
}
function nextSiblingId(o) {
  const siblings = store.project.objects.filter(x => (x.parentId || null) === (o.parentId || null))
  const i = siblings.indexOf(o)
  // Los hermanos arrastrados se excluyen como punto de inserción.
  for (let k = i + 1; k < siblings.length; k++) if (!dragIds.includes(siblings[k].id)) return siblings[k].id
  return null
}

/** Un drag de varios nodos es una operación: si uno falla se restaura el árbol completo. */
function moveDragged(resolveTarget, label) {
  if (!dragIds.length) return
  const objects = store.project.objects
  const [newParent, beforeId] = resolveTarget(dragIds[0])
  const sameParent = dragIds.every(id => (getObject(id)?.parentId || null) === (newParent || null))
  if (sameParent) {
    const changed = reorderSiblings(dragIds, newParent, beforeId, { commit: false })
    const count = dragIds.length
    endDragging()
    if (changed) commit(count > 1 ? 'Reordenar nodos' : 'Reordenar nodo')
    return
  }
  if (dragIds.some(id => getObject(id)?.type === 'terrain')) {
    toast('Terreno solo puede reordenarse dentro de la raíz', 'error'); endDragging(); return
  }
  const order = [...objects]
  const originals = dragIds.map((id) => {
    const o = getObject(id)
    return o && { id, parentId: o.parentId, position: o.position && [...o.position], rotation: o.rotation && [...o.rotation], scale: o.scale && [...o.scale] }
  }).filter(Boolean)
  let moved = false
  for (const id of dragIds) {
    const [parentId, beforeId] = resolveTarget(id)
    if (!reparent(id, parentId, beforeId, { commit: false })) {
      if (moved) {
        objects.splice(0, objects.length, ...order)
        for (const prev of originals) {
          const o = getObject(prev.id)
          if (!o) continue
          o.parentId = prev.parentId
          if (prev.position) o.position = prev.position
          if (prev.rotation) o.rotation = prev.rotation
          if (prev.scale) o.scale = prev.scale
          store.editor.syncObject(o.id)
          for (const child of descendantsOf(o.id)) store.editor.syncObject(child.id)
        }
      }
      endDragging()
      return
    }
    moved = true
  }
  const count = dragIds.length
  endDragging()
  if (moved) commit(count > 1 ? 'Mover nodos' : label)
}
function onDrop(e, row) {
  e.preventDefault()
  e.stopPropagation()
  if (hasAssetEntry(e.dataTransfer) && !dragIds.length) {
    drop.value = null
    if (!canParentInstance(row.o)) return
    const scene = resolveAssetDrop(e.dataTransfer, allEntries(store.project), { kinds: ['scene'] })
    if (scene) { void instantiateScene(scene.id, { parentId: row.o.id }); return }
    const script = nodeScriptFromDrop(e.dataTransfer, store.project?.scripts)
    if (!script) { toast('Arrastra una escena o un Script desde Assets', 'error'); return }
    if (script.execution !== 'node') { toast('El Script Global no se puede asociar a un nodo', 'error'); return }
    addNodeScript(row.o.id, script.id)
    return
  }
  // El destino procede de la fila bajo el cursor; no depende de un dragover anterior.
  const zone = zoneOf(e, e.currentTarget)
  drop.value = null
  if (!dragIds.length || dragIds.includes(row.o.id) || dragIds.some(id => isDescendant(row.o.id, id)) ||
      (zone === 'inside' && (row.o.type === 'terrain' || isMoveLocked(row.o) || dragIds.some(id => getObject(id)?.type === 'terrain')))) {
    endDragging(); return
  }
  moveDragged(() => zone === 'inside' ? [row.o.id, null] :
    [row.o.parentId || null, zone === 'before' ? row.o.id : nextSiblingId(row.o)], 'Mover nodo')
}
function onDragOverRoot(e) {
  if ((!dragIds.length && !hasAssetEntry(e.dataTransfer)) || e.target.closest?.('[role="treeitem"]')) return
  e.preventDefault()
  if (dragIds.length) trackDrag(e)
  e.dataTransfer.dropEffect = dragIds.length ? 'move' : 'copy'
  drop.value = { id: null, zone: 'root' }
}
function onDropRoot(e) {
  if (e.target.closest?.('[role="treeitem"]')) return
  if (!dragIds.length && !hasAssetEntry(e.dataTransfer)) return
  e.preventDefault()
  e.stopPropagation()
  drop.value = null
  if (!dragIds.length) {
    const scene = resolveAssetDrop(e.dataTransfer, allEntries(store.project), { kinds: ['scene'] })
    if (scene) void instantiateScene(scene.id)
    return
  }
  moveDragged(() => [null, null], 'Mover a la raíz')
}

const toggle = (o, key, label) => {
  if (o.type === 'terrain') {
    if (key === 'visible') setPieceVisible(o.id, !o.visible)
    return
  }
  updateObject(o.id, { [key]: !o[key] }, { label })
}
</script>

<template>
  <div class="tree">
    <div class="panel-head">
      <button class="tab-head" :class="{ on: panelTab === 'tree' }" @click="panelTab = 'tree'">Jerarquía</button>
      <button class="tab-head" :class="{ on: panelTab === 'color' }" @click="panelTab = 'color'">Color</button>
      <span v-if="panelTab === 'tree'" class="sub">{{ total }}</span>
      <span class="grow"></span>
      <button v-if="panelTab === 'tree'" class="ghost icon" type="button" data-testid="scene-tree-add-node"
        data-tooltip="Añadir nodo" aria-label="Añadir nodo" @click="openAdd"><Icon name="plus" /></button>
      <button v-if="panelTab === 'tree'" class="ghost icon" type="button" data-testid="scene-tree-instance-scene"
        data-tooltip="Instanciar escena existente · Ctrl+Shift+A" aria-label="Instanciar escena existente"
        :disabled="store.locked || store.play.on || store.filmMode || store.editor?.edit" @click="openInstancePicker()"><Icon name="scene" /></button>
    </div>
    <ColorPickerPanel v-if="panelTab === 'color'" />
    <template v-else>
    <div class="find"><Icon name="search" :size="13" /><input ref="searchEl" v-model="filter" placeholder="Buscar nodos…" aria-label="Buscar nodos en la escena" spellcheck="false" @keydown="searchKey" /><button v-if="filter" class="clear-find" aria-label="Limpiar búsqueda" data-tooltip="Limpiar búsqueda" @click="filter = ''; searchEl?.focus()"><Icon name="x" :size="12" /></button></div>

    <div class="row sceneroot" :class="{ sel: sceneActive, main: sceneActive, 'd-in': drop?.zone === 'root' }" tabindex="0" @dragover="onDragOverRoot" @drop="onDropRoot" data-tooltip="Ajustes de la escena (hora, clima, cielo, luz, baking)" @click="selectScene()" @keydown.enter="selectScene()">
      <span class="guides" style="width:0"></span>
      <button class="chev" tabindex="-1" :data-tooltip="sceneOpen ? 'Plegar' : 'Desplegar'" @click.stop="sceneOpen = !sceneOpen"><Icon :name="sceneOpen ? 'chevron-down' : 'chevron-right'" :size="12" /></button>
      <span class="glyph" style="color: var(--blue)"><Icon name="globe" :size="14" /></span>
      <span class="name">{{ activeScene()?.name || 'Escena' }}</span>
    </div>
    <div
      ref="listEl" v-show="sceneOpen" class="list" tabindex="0" role="tree" aria-label="Nodos de la escena" @keydown="onKey"
      @dragover="onDragOverRoot" @drop="onDropRoot" @click.self="selectObject(null)"
      @dragleave.self="drop = null" @scroll.passive="onScroll"
    >
      <div v-if="padTop" class="pad" :style="{ height: padTop + 'px' }" @click="selectObject(null)"></div>
      <div
        v-for="row in shown" :key="row.o.id" :data-id="row.o.id" class="row" role="treeitem" :aria-selected="selSet.has(row.o.id)" :aria-level="row.depth + 1" :aria-expanded="row.hasKids ? (treeNodeOpen(row.o) || !!filter) : undefined"
        :class="{
          sel: selSet.has(row.o.id), main: store.selectedId === row.o.id || (row.o.type === 'terrain' && store.terrainSel && store.activePieceId === row.o.id),
          off: row.o.active === false, 'd-in': drop?.id === row.o.id && ['inside', 'script'].includes(drop.zone),
          'd-before': drop?.id === row.o.id && drop.zone === 'before', 'd-after': drop?.id === row.o.id && drop.zone === 'after',
        }"
        :draggable="!row.o.sceneInstanceOwner" :data-tooltip="row.o.sceneInstanceOwner || row.o.type === 'sceneInstance' ? 'Escena vinculada · doble clic para abrir su fuente' : undefined"
        @click="onRowClick($event, row)" @dblclick="row.o.sceneInstanceOwner ? openLinkedSource(row.o) : row.o.type === 'sceneInstance' ? openInstanceSource(row.o) : (store.renameId = row.o.id)" @contextmenu.prevent="onContext($event, row)"
        @dragstart="onDragStart($event, row)" @dragover="onDragOver($event, row)" @drop="onDrop($event, row)" @dragend="endDragging"
      >
        <span class="guides" :style="{ width: (row.depth + 1) * UNIT + 'px' }"><i v-for="d in row.depth + 1" :key="d" :style="{ left: (d - 1) * UNIT + 6 + 'px' }"></i></span>
        <button class="chev" :class="{ hidden: !row.hasKids }" tabindex="-1" @click.stop="toggleOpen(row.o.id)">
          <Icon :name="treeNodeOpen(row.o) || filter ? 'chevron-down' : 'chevron-right'" :size="12" />
        </button>
        <span class="glyph" :style="{ color: row.o.type === 'terrain' ? 'var(--n-model)' : COLOR[row.o.type] }"><Icon :name="row.o.type === 'terrain' ? 'terrain' : kindIcon(row.o)" :size="14" /></span>

        <input
          v-if="store.renameId === row.o.id" v-model="renameText" class="rename"
          @click.stop @dblclick.stop @keydown.enter="finishRename(true)" @keydown.esc="finishRename(false)" @blur="finishRename(true)"
        />
        <span v-else class="name" :class="{ pf: row.o.prefabId || row.o.type === 'sceneInstance' }">{{ row.o.name }}</span>
        <Icon v-if="row.o.sceneInstanceOwner || row.o.type === 'sceneInstance'" name="scene" :size="11" class="pfi" data-tooltip="Escena vinculada · doble clic para abrir la fuente" />
        <Icon v-if="row.o.prefabId" name="prefab" :size="12" class="pfi" :title="'Instancia de prefab'" />
        <button v-if="authoredNodeScriptIds(row.o).length" class="script-indicator"
          :class="{ missing: authoredNodeScriptIds(row.o).some(id => !scriptNames.has(id)) }"
          :data-tooltip="authoredNodeScriptIds(row.o).length === 1 ? 'Script: ' + (scriptNames.get(authoredNodeScriptIds(row.o)[0]) || 'Recurso inexistente') : authoredNodeScriptIds(row.o).length + ' Scripts de Nodo · Ver en Inspector'"
          :aria-label="authoredNodeScriptIds(row.o).length + ' Scripts de Nodo en ' + row.o.name" tabindex="-1"
          @click.stop="openNodeScript(row.o)"><Icon name="script" :size="12" /><span v-if="authoredNodeScriptIds(row.o).length > 1" class="script-count">{{ authoredNodeScriptIds(row.o).length }}</span></button>

        <span v-if="row.hasKids && !treeNodeOpen(row.o) && !filter" class="count">{{ descCount(row.o.id) }}</span>

        <span class="flags">
          <button v-if="row.o.type !== 'terrain' && !row.o.sceneInstanceOwner" class="mini" :class="{ active: row.o.locked }" :data-tooltip="row.o.locked ? 'Desbloquear' : 'Bloquear'" tabindex="-1" @click.stop="toggle(row.o, 'locked', 'Bloqueo')"><Icon :name="row.o.locked ? 'lock' : 'unlock'" :size="12" /></button>
          <button v-if="!row.o.sceneInstanceOwner" class="mini" :class="{ active: !row.o.visible }" :data-tooltip="row.o.visible ? 'Ocultar' : 'Mostrar'" tabindex="-1" @click.stop="toggle(row.o, 'visible', 'Visibilidad')"><Icon :name="row.o.visible ? 'eye' : 'eye-off'" :size="12" /></button>
        </span>
      </div>

      <div v-if="padBottom" class="pad" :style="{ height: padBottom + 'px' }" @click="selectObject(null)"></div>
      <ChunkTree :filter="filter" />
      <div v-if="!rows.length && !store.streamingPreviewRows.length" class="empty">
        <template v-if="filter">Ningún nodo coincide con «{{ filter }}».</template>
        <template v-else>La escena está vacía. Añade un nodo con <b>+</b> o instancia otra escena.</template>
      </div>
    </div>
    </template>
  </div>
</template>

<style scoped>
.tree { display: flex; flex-direction: column; min-height: 0; height: 100%; }
.tab-head { background:transparent; color:var(--text-3); padding:4px 7px; border:0; border-bottom:2px solid transparent; font-size:12px; }
.tab-head.on { color:var(--text); border-bottom-color:var(--blue); }
.find { display: flex; align-items: center; gap: 6px; margin: 6px 8px; padding: 0 7px; background: var(--g-950); border: 1px solid var(--hair); border-radius: var(--r); color: var(--text-3); }
.find:focus-within { border-color: var(--blue); }
.find input { flex: 1; min-width: 0; border: none; background: transparent; padding: 0; height: 22px; }
.clear-find { display:grid;place-items:center;flex:none;width:20px;height:20px;background:transparent;border:0;color:var(--text-3);padding:0; }
.clear-find:hover { color:var(--text); }
.find input:focus { outline: none; }
.list { flex: 1; overflow: auto; min-height: 40px; padding: 0 0 8px; outline: none; }
.list:focus-visible { outline: 1px solid var(--blue); outline-offset: -1px; }

.pad { flex: none; }
.sceneroot, .terrow { outline: none; }
.sceneroot .name { font-weight: 600; }
.row { position: relative; flex: none; display: flex; align-items: center; height: 24px; padding-right: 6px; cursor: default; border-left: 2px solid transparent; }
.row:hover { background: var(--g-800); }
.row.sel { background: var(--blue-wash); }
.row.main { background: var(--editor-selection); border-left-color: var(--blue-hi); }
.row:focus-visible { outline: 1px solid var(--blue); outline-offset: -1px; }
.row.off .name, .row.off .glyph { opacity: .42; }
.guides { position: relative; align-self: stretch; flex: none; margin-left: 4px; }
.guides i { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--hair); }
.chev { width: 16px; height: 16px; padding: 0; background: transparent; border: none; color: var(--text-3); flex: none; margin-left: 2px; }
.chev:hover { color: var(--text); background: transparent; }
.chev.hidden { visibility: hidden; }
.glyph { display: flex; margin: 0 6px 0 2px; flex: none; }
.name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.name.pf { color: var(--blue-hi); }
.pfi { color: var(--blue-hi); flex: none; margin-left: 4px; }
.rename { flex: 1; height: 20px; padding: 0 4px; min-width: 0; }
.count { font-size: 10px; color: var(--text-3); background: var(--g-950); border-radius: 8px; padding: 0 5px; margin-left: 4px; }
.flags { display: flex; gap: 0; margin-left: 4px; }
.script-indicator { flex:none;display:inline-flex;gap:2px;align-items:center;justify-content:center;background:transparent;border:0;padding:0 2px;min-width:18px;height:20px;color:var(--blue-hi); }
.script-count { font-size:9px;font-variant-numeric:tabular-nums;color:var(--text-2); }
.script-indicator.missing { color:var(--amber); }
.script-indicator:hover { background:var(--g-700); }
.mini { width: 20px; height: 20px; padding: 0; background: transparent; border: none; color: var(--text-3); opacity: 0; }
.row:hover .mini, .row.main .mini, .list:focus-within .row.sel .mini { opacity: 1; }
.mini.active { opacity: 1; color: var(--amber); }
.mini:hover { background: var(--g-700); color: var(--text); }

.row.d-in { background: var(--blue-wash); outline: 1px solid var(--blue); outline-offset: -1px; }
.row.d-before::before, .row.d-after::after { content: ''; position: absolute; left: 6px; right: 6px; height: 2px; background: var(--blue-hi); border-radius: 1px; z-index: 2; }
.row.d-before::before { top: -1px; }
.row.d-after::after { bottom: -1px; }

.empty { padding: 18px 14px; color: var(--text-3); line-height: 1.5; }
</style>
