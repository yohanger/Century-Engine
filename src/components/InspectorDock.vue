<script setup>
// Dock derecho: Inspector contextual / Señales (+ Malla o Pintura según el modo).
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { activeScene, getObject, store } from '../core/store.js'
import Inspector from './Inspector.vue'
import ChunkInspector from './ChunkInspector.vue'
import SignalConnectionsPanel from './SignalConnectionsPanel.vue'
import ProfileEditor from './ProfileEditor.vue'
import MaterialResourceEditor from './MaterialResourceEditor.vue'
import LiquidResourceEditor from './LiquidResourceEditor.vue'
import VfxEditor from './VfxEditor.vue'
import CinematicResourceInspector from './CinematicResourceInspector.vue'
import { isFilmMakerTimeline } from '../core/timeline/model.js'
import GameManagerEditor from './GameManagerEditor.vue'
import MeshPanel from './MeshPanel.vue'
import PaintPanel from './PaintPanel.vue'
import Icon from './Icon.vue'
import { filterSceneInspector, sceneFoldPreferred } from './scene-inspector-search.js'
import Splitter from './Splitter.vue'
import searchIcon from '../assets/icons/icn_search.png'
import settingsIcon from '../assets/icons/icn_settings.png'

const props = defineProps({ pane: { type: String, default: '' } })
const tabs = computed(() => {
  const t = [['object', 'Inspector', 'sliders'], ['signals', 'Señales', 'network']]
  if (store.edit.on) t.unshift(['mesh', 'Malla', 'mesh'])
  if (store.paint.on) t.unshift(['paint', 'Pintura', 'brush'])
  return t
})
const tab = computed(() => (props.pane || (tabs.value.some((t) => t[0] === store.prefs.rightTab) ? store.prefs.rightTab : 'object')))
const isDetails = computed(() => tab.value === 'object' || tab.value === 'mesh')
const detailTitle = computed(() => {
  if (tab.value === 'mesh') return getObject(store.edit.id)?.name || 'Malla'
  if (store.audioInspector?.groupId || store.projSel?.kind) return ''
  if (store.selectedIds.length > 1) return `${store.selectedIds.length} nodos`
  if (store.chunkSelection) {
    const chunk = store.streamingPreviewRows.find(row => row.index === store.chunkSelection.index)
    return chunk?.nodes.find(node => node.id === store.chunkSelection.nodeId)?.name || chunk?.name || ''
  }
  if (store.sceneSel) return activeScene()?.name || 'Escena'
  return getObject(store.selectedId)?.name || 'Ningún nodo seleccionado'
})
const root = ref(null)
const dock = ref(null)
const settings = ref(null)
const query = ref('')
const searchMiss = ref(false)
const dockW = ref(296)
const compact = computed(() => dockW.value <= 260)
const maxLabelW = computed(() => Math.min(240, Math.max(90, dockW.value - 124)))
const labelW = computed(() => Math.round(Math.max(72, Math.min(maxLabelW.value, Number(store.prefs.inspLabelWidth) || 112))))
function setLabelWidth(v) { if (Number.isFinite(v)) store.prefs.inspLabelWidth = Math.max(72, Math.min(maxLabelW.value, Math.round(v))) }
let sizeObserver = null
// Reutiliza inspFold con identidad semántica: el texto visible solo sirve para leer preferencias antiguas.
const hasFold = (folds, key) => Object.prototype.hasOwnProperty.call(folds, key)
function foldContext(header) {
  if (tab.value !== 'object') return `pane:${tab.value}`
  if (store.audioInspector?.groupId) return 'resource:audio-mixer'
  const resourceKind = store.projSel?.kind
  if (resourceKind && resourceKind !== 'timeline') return `resource:${resourceKind}`
  const nodeType = header.closest('.insp')?.dataset.nodeType
  if (nodeType && nodeType !== 'scene') return `node:${nodeType}`
  return store.sceneSel ? 'scene' : 'node:scene'
}
function foldId(header) {
  const section = header.parentElement
  const explicit = section.dataset.foldId || section.dataset.primitiveSection || section.dataset.testid
  if (explicit) return explicit
  // Compatibilidad temporal para inspectores especializados sin identificadores explícitos.
  // Cada familia se estabilizará en su propio Gate antes de cambiar el orden de sus secciones.
  const siblings = [...section.parentElement.children].filter(el => el.classList.contains('sect'))
  return `section-${siblings.indexOf(section) + 1}`
}
function keyOf(header) { return `fold:${foldContext(header)}:${foldId(header)}` }
function legacyKeyOf(header) {
  const context = header.closest('.insp')?.dataset.nodeType || 'resource'
  const label = [...header.childNodes].find((node) => node.nodeType === 3 && node.textContent.trim())?.textContent.trim()
    || header.textContent.trim().slice(0, 40)
  return `${context}:${label}`
}
function sectionScope() { return tab.value === 'mesh' ? root.value?.querySelector('[data-mesh-inspector]') : root.value }
function forcedOpen(section) { return tab.value === 'mesh' && section.dataset.foldForceOpen === 'true' }
function applyFolds() {
  const folds = store.prefs.inspFold || {}
  const migrated = {}
  sectionScope()?.querySelectorAll('.sect > header').forEach((header) => {
    const key = keyOf(header)
    let closed = hasFold(folds, key) ? !!folds[key] : !!migrated[key] || header.parentElement.dataset.foldDefault === 'closed'
    if (tab.value !== 'mesh' && !hasFold(folds, key) && !hasFold(migrated, key)) {
      const legacy = legacyKeyOf(header)
      if (hasFold(folds, legacy)) {
        const context = foldContext(header)
        // La antigua clave «resource» era ambigua: se adjudica solo al primer contexto
        // montado, sin borrar la preferencia anterior ni contaminar otras familias.
        const claim = `fold:legacy-owner:${legacy}`
        if (context.startsWith('node:') || !hasFold(folds, claim) && !hasFold(migrated, claim)
          || folds[claim] === context || migrated[claim] === context) {
          closed = !!folds[legacy]
          migrated[key] = closed
          if (!context.startsWith('node:')) migrated[claim] = context
        }
      }
    }
    if (forcedOpen(header.parentElement)) closed = false
    header.parentElement.classList.toggle('closed', closed)
    header.setAttribute('role', 'button')
    header.setAttribute('tabindex', '0')
    header.setAttribute('aria-expanded', String(!closed))
    if (tab.value === 'mesh') header.setAttribute('aria-disabled', String(forcedOpen(header.parentElement)))
  })
  if (Object.keys(migrated).length) store.prefs.inspFold = { ...folds, ...migrated }
}
const searchText = (value) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
function sceneScope() {
  return tab.value === 'object' && store.sceneSel && !store.projSel && !store.audioInspector?.groupId && !store.chunkSelection
    ? root.value?.querySelector('[data-scene-inspector]') : null
}
function filterSections() {
  const scene = sceneScope()
  if (scene) {
    const result = filterSceneInspector(scene, query.value, store.prefs.inspFold || {})
    searchMiss.value = !!query.value.trim() && !result.found
    return
  }
  const term = searchText(query.value.trim())
  const sections = sectionScope()?.querySelectorAll('.sect') || []
  let found = false
  for (const section of sections) {
    const header = section.querySelector(':scope > header')
    if (!header) continue
    const matches = !term || searchText(header.textContent).includes(term) ||
      [...section.querySelectorAll(tab.value === 'mesh' ? 'label, button, .row > span, .numeric-title, [aria-label], [data-tooltip]' : 'label')].some(label => searchText([label.textContent, tab.value === 'mesh' ? label.getAttribute('aria-label') : '', tab.value === 'mesh' ? label.getAttribute('data-tooltip') : ''].filter(Boolean).join(' ')).includes(term))
    section.classList.toggle('details-filtered', !matches && !forcedOpen(section))
    section.classList.toggle('details-search-open', !!term && matches)
    header.setAttribute('aria-expanded', String(!!term && matches || !section.classList.contains('closed')))
    found ||= matches
  }
  searchMiss.value = !!term && sections.length > 0 && !found
}
function updateSections() {
  applyFolds()
  filterSections()
}
function closeSettings() {
  settings.value.open = false
  settings.value.querySelector('summary').focus()
}
function setAllFolds(closed) {
  const scene = sceneScope()
  if (scene) {
    const folds = { ...store.prefs.inspFold }
    const sections = [...scene.querySelectorAll('details[data-scene-fold]:not([hidden])')]
    for (const el of sections) folds[`fold:scene:${el.dataset.sceneFold}`] = closed
    store.prefs.inspFold = folds
    if (!query.value.trim()) for (const el of sections) el.open = sceneFoldPreferred(el, folds)
    closeSettings()
    return
  }
  const headers = sectionScope()?.querySelectorAll('.sect:not(.details-filtered) > header') || []
  const folds = { ...store.prefs.inspFold }
  for (const header of headers) if (!forcedOpen(header.parentElement)) folds[keyOf(header)] = closed
  store.prefs.inspFold = folds
  applyFolds()
  closeSettings()
}
function toggleFold(header) {
  if (forcedOpen(header.parentElement)) return
  const key = keyOf(header)
  const folds = store.prefs.inspFold || {}
  store.prefs.inspFold = { ...folds, [key]: !header.parentElement.classList.contains('closed') }
  applyFolds()
}
function onFold(e) {
  if (e.target.closest?.('summary')?.parentElement?.dataset.sceneSearch === 'true') { e.preventDefault(); return }
  const header = e.target.closest?.('.sect > header')
  const interactive = e.target.closest?.('button, input, select, a, textarea, summary, [contenteditable], [role="button"]')
  if (header && (!interactive || interactive === header)) toggleFold(header)
}
function onFoldKey(e) {
  if (e.key !== 'Enter' && e.key !== ' ') return
  if (e.target.closest?.('summary')?.parentElement?.dataset.sceneSearch === 'true') { e.preventDefault(); return }
  const header = e.target.closest?.('.sect > header')
  if (header && e.target === header) {
    e.preventDefault()
    if (tab.value === 'mesh') e.stopPropagation?.()
    toggleFold(header)
  } else if (tab.value === 'mesh' && e.target.closest?.('button, summary')) {
    e.stopPropagation?.()
  }
}
// Las cabeceras que Vue reutiliza también cambian de contexto al cambiar de nodo.
watch(() => [store.selectedId, store.projSel?.kind, store.projSel?.id, store.temporalSelection?.kind, store.temporalSelection?.resourceId, store.temporalSelection?.itemId, store.audioInspector?.groupId, store.audioInspector?.effectId, store.prefs.rightTab, store.sceneSel, store.chunkSelection, store.project?.activeSceneId, tab.value], async () => {
  await nextTick()
  updateSections()
})
watch(tab, (value, previous) => { if (value === 'mesh' || previous === 'mesh') query.value = '' })
watch(query, filterSections, { flush: 'post' })
watch(() => store.prefs.inspFold, () => { if (sceneScope() && query.value.trim()) filterSections() }, { flush: 'post' })
watch(() => store.edit.modalControl?.inspecting, async () => { if (tab.value === 'mesh') { await nextTick(); updateSections() } })
watch(() => store.edit.modalControl?.kind, async () => { if (tab.value === 'mesh') { await nextTick(); updateSections() } })
let mo = null, tick = 0
function observeSections() {
  mo?.disconnect()
  if (root.value) mo?.observe(root.value, { childList: true, subtree: true, characterData: true })
  updateSections()
}
watch(root, observeSections, { flush: 'post' })
onMounted(() => {
  sizeObserver = new ResizeObserver((entries) => { dockW.value = entries[0]?.contentRect.width || 296 })
  if (dock.value) sizeObserver.observe(dock.value)
  mo = new MutationObserver(() => { cancelAnimationFrame(tick); tick = requestAnimationFrame(updateSections) })
  observeSections()
})
onBeforeUnmount(() => { sizeObserver?.disconnect(); mo?.disconnect(); cancelAnimationFrame(tick) })
// Migración no destructiva de preferencias guardadas con la pestaña Terreno separada.
watch(() => store.prefs.rightTab, (tab) => { if (tab === 'terrain') store.prefs.rightTab = 'object' }, { immediate: true })
</script>

<template>
  <div ref="dock" class="idock" :class="{ details: isDetails, 'with-tabs': !pane }" :style="{ '--lf-property-label-width': labelW + 'px' }">
    <Splitter v-if="!compact && tab === 'object'" class="property-divider" dir="x" :model-value="labelW" :min="84" :max="maxLabelW" label="Ajustar ancho entre nombre de propiedad y valor" @update:model-value="setLabelWidth" />
    <nav v-if="!pane" class="tabs" role="tablist">
      <button v-for="[id, label, ic] in tabs" :key="id" role="tab" :aria-selected="tab === id" :class="{ on: tab === id }" @click="store.prefs.rightTab = id">
        <Icon :name="ic" :size="13" /><span>{{ label }}</span>
      </button>
    </nav>
    <template v-if="isDetails">
      <h2 class="details-title" :title="detailTitle">{{ tab === 'mesh' ? 'Edit Mesh' : store.sceneSel && !store.projSel && !store.audioInspector?.groupId && !store.chunkSelection ? 'Escena' : 'Detalles' }}<span v-if="detailTitle">: {{ detailTitle }}</span></h2>
      <div class="details-tools">
        <label class="details-search">
          <img :src="searchIcon" alt="" />
          <input v-model="query" type="search" :aria-label="tab === 'mesh' ? 'Buscar herramientas de malla' : 'Buscar propiedades'" :placeholder="tab === 'mesh' ? 'Buscar herramienta…' : 'Buscar…'" spellcheck="false" />
        </label>
        <details ref="settings" class="details-settings"
          @focusout="!$event.currentTarget.contains($event.relatedTarget) && ($event.currentTarget.open = false)"
          @keydown.escape.stop="closeSettings">
          <summary aria-label="Ajustes del inspector" title="Ajustes del inspector"><img :src="settingsIcon" alt="" /></summary>
          <div class="details-menu">
            <button type="button" @click="setAllFolds(false)">Expandir secciones</button>
            <button type="button" @click="setAllFolds(true)">Contraer secciones</button>
            <button v-if="tab === 'object'" type="button" @click="setLabelWidth(112); closeSettings()">Restablecer ancho de etiquetas</button>
          </div>
        </details>
      </div>
    </template>
    <div ref="root" class="scroll" :key="store.project.id" @click="onFold" @keydown="onFoldKey">
      <MeshPanel v-if="tab === 'mesh'" :search="query" />
      <PaintPanel v-if="tab === 'paint'" />
      <CinematicResourceInspector v-if="tab === 'object' && store.projSel?.kind === 'cinematic' && (store.project?.cinematics?.some(c => c.id === store.projSel.id) || store.project?.timelines?.some(t => t.id === store.projSel.id && isFilmMakerTimeline(t)))" :resource-id="store.projSel.id" />
      <ProfileEditor v-else-if="tab === 'object' && store.projSel?.kind === 'profile' && store.project?.profiles?.some((p) => p.id === store.projSel.id)" :key="store.projSel.id" :profile-id="store.projSel.id" />
      <MaterialResourceEditor v-else-if="tab === 'object' && store.projSel?.kind === 'material' && store.project?.materials?.some((m) => m.id === store.projSel.id)" :key="store.projSel.id" :material-id="store.projSel.id" />
      <LiquidResourceEditor v-else-if="tab === 'object' && store.projSel?.kind === 'liquid' && store.project?.liquids?.some((l) => l.id === store.projSel.id)" :key="store.projSel.id" :liquid-id="store.projSel.id" />
      <GameManagerEditor v-else-if="tab === 'object' && store.projSel?.kind === 'gamemanager' && store.project?.gameManagers?.some((g) => g.id === store.projSel.id)" :key="store.projSel.id" :manager-id="store.projSel.id" />
      <VfxEditor v-else-if="tab === 'object' && store.projSel?.kind === 'vfx' && store.project?.vfx?.some((r) => r.id === store.projSel.id)" :key="store.projSel.id" :vfx-id="store.projSel.id" />
      <ChunkInspector v-else-if="tab === 'object' && store.chunkSelection" />
      <Inspector v-else v-show="tab === 'object'" />
      <SignalConnectionsPanel v-if="tab === 'signals'" />
      <p v-if="isDetails && searchMiss" class="details-empty" role="status">{{ tab === 'mesh' ? 'No se encontraron herramientas.' : 'No se encontraron propiedades.' }}</p>
    </div>
  </div>
</template>

<style scoped>
.idock { display: flex; flex-direction: column; height: 100%; min-height: 0; position: relative; }
.idock :deep(.property-divider) { position: absolute; left: calc(var(--lf-property-label-width) + 12px); top: 58px; bottom: 0; height: auto; z-index: 7; }
.idock.with-tabs :deep(.property-divider) { top: 89px; }
.idock :deep(.property-divider:hover), .idock :deep(.property-divider:focus-visible) { background: var(--blue-wash); }
.tabs { display: flex; border-bottom: 1px solid var(--hair); flex: none; background: var(--g-900); }
.tabs button { flex: 1; height: 30px; border: none; border-radius: 0; background: transparent; color: var(--text-3); border-bottom: 2px solid transparent; padding: 0 6px; min-width: 0; }
.tabs button span { overflow: hidden; text-overflow: ellipsis; }
.tabs button:hover { background: var(--g-800); color: var(--text); }
.tabs button.on { color: var(--text); border-bottom-color: var(--blue); background: var(--g-850); }
.scroll { overflow-y: auto; overflow-x: hidden; flex: 1; min-height: 0; }
.details { --details-chrome: #101318; --details-group: #272b32; --details-field: #0d1015; background: #171a21; }
.details-title {
  flex: none; height: 26px; line-height: 26px; padding: 0 8px; margin: 0;
  font-size: 12px; font-weight: 400; text-transform: uppercase; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; background: var(--details-chrome); color: var(--text);
}
.details-title span { text-transform: none; }
.details-tools { display: flex; flex: none; align-items: center; gap: 5px; height: 32px; padding: 3px 5px; background: var(--g-800); }
.details-search {
  display: flex; flex: 1; align-items: center; gap: 5px; min-width: 0; height: 23px; padding: 0 6px;
  border: 1px solid transparent; border-radius: 4px; background: var(--details-field);
}
.details-search:focus-within { border-color: var(--blue-hi); }
.details-search img, .details-settings img { width: 20px; height: 20px; object-fit: contain; flex: none; }
.details-search input { flex: 1; width: 100%; height: 100%; border: 0; outline: 0; padding: 0; background: transparent; }
.details-settings { position: relative; }
.details-settings summary {
  list-style: none; width: 25px; height: 25px; display: grid; place-items: center; cursor: pointer; border-radius: 4px;
}
.details-settings summary::-webkit-details-marker { display: none; }
.details-settings summary:hover, .details-settings[open] summary { background: var(--g-700); }
.details-menu {
  position: absolute; right: 0; top: calc(100% + 3px); z-index: 32; min-width: 180px;
  display: grid; gap: 2px; padding: 4px; background: var(--g-800); border: 1px solid var(--hair); border-radius: 4px;
}
.details-menu button { justify-content: flex-start; background: transparent; border: 0; }
.details-menu button:hover { background: var(--g-700); }
.details-menu button:focus-visible, .details-settings summary:focus-visible { outline: 2px solid var(--blue-hi); outline-offset: -2px; }
.details .scroll { padding: 2px 4px 0; }
.details .scroll::-webkit-scrollbar { width: 6px; }
.details .scroll::-webkit-scrollbar-thumb { border-width: 1px; }
.details .scroll :deep(.sect.details-filtered) { display: none; }
.details .scroll :deep(.sect.closed.details-search-open > :not(header)) { display: block !important; }
.details .scroll :deep(:is(.insp, .mp) > .sect.closed.details-search-open > header::before) { background-image: url('../assets/icons/icn_expand_down.png'); }
.details .scroll :deep(:is(.insp, .mp) > .sect > header) {
  min-height: 28px; border: 0; border-radius: 4px; background: var(--details-group); padding-left: 24px;
}
.details .scroll :deep(:is(.insp, .mp) > .sect > header:hover) { background: var(--g-700); }
.details .scroll :deep(:is(.insp, .mp) > .sect > header::before) {
  width: 11px; height: 11px; left: 7px; margin-top: -5px; border: 0; transform: none;
  background: url('../assets/icons/icn_expand_down.png') center / contain no-repeat;
}
.details .scroll :deep(:is(.insp, .mp) > .sect.closed > header::before) { background-image: url('../assets/icons/icn_expand_right.png'); }
.details-empty { margin: 8px; color: var(--text-3); }
</style>
