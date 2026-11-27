<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { store, addSceneSignalConnection, editSceneSignalConnection, removeSceneSignalConnection, createSceneSignalCallback, callbackGenerationBlockReason, openScriptEditor, toast } from '../core/store.js'
import Icon from './Icon.vue'
import { getNativeSignals } from '../engine/runtime/nodes/registry.js'
import { discoverNodeSignals, discoverNodeMethods, nodeScriptIds, buildNodeCallbackCode } from '../engine/runtime/scene/node-scripts.js'

// El Inspector solo lee metadata y recursos; nunca evalúa scripts en Edit Mode.
// Area3D: body_entered, body_exited, area_entered, area_exited.
const selected = computed(() => {
  if (store.projSel || store.audioInspector || store.selectedIds.length > 1 || store.sceneSel || store.locked) return null
  return store.project?.objects?.find(o => o.id === store.selectedId) || null
})
const objects = computed(() => store.project?.objects || [])
const byId = computed(() => new Map(objects.value.map(o => [o.id, o])))
const authored = computed(() => store.project?.signalConnections || [])
const outgoing = computed(() => authored.value.filter(c => c.emitterId === selected.value?.id))
const nativeDefinitions = computed(() => getNativeSignals(selected.value?.type))
const nativeSignals = computed(() => nativeDefinitions.value.map(s => s.name))
const discovered = computed(() => discoverNodeSignals(selected.value, store.project?.scripts || []))
const signalInfo = computed(() => new Map(discovered.value.signals.map(s => [s.name, s])))
const customSignals = computed(() => [...new Set([
  ...discovered.value.signals.map(s => s.name),
  ...outgoing.value.map(c => c.signal),
].filter(s => !nativeSignals.value.includes(s)))])
// Las conexiones antiguas son visibles, pero no autorizan nuevas conexiones
// a nombres cuya declaración ya no es localizable en el emisor seleccionado.
const connectableSignals = computed(() => new Set([
  ...nativeSignals.value,
  ...discovered.value.signals
    .filter(s => !s.nativeCollision && !s.duplicate)
    .map(s => s.name),
]))
const canConnectSignal = name => connectableSignals.value.has(name)
const customDiagnostics = computed(() => [
  ...discovered.value.diagnostics,
  ...discovered.value.signals.filter(s => s.nativeCollision || s.duplicate).map(s => ({
    scriptId: s.owners.join(', '),
    kind: s.nativeCollision ? 'native-collision' : 'duplicate',
    detail: s.nativeCollision ? `Señal ${s.name}: nombre nativo reservado` : `Señal ${s.name}: declaración duplicada entre scripts`,
  })),
])
const scriptCount = computed(() => nodeScriptIds(selected.value).length)
function customLabel(name) {
  const info = signalInfo.value.get(name)
  if (!info) return 'Conexión guardada · declaración no confirmada'
  if (info.nativeCollision) return 'Conflicto: nombre nativo reservado'
  if (info.duplicate) return 'Conflicto: varios declarantes'
  return 'Detectada en código · pendiente de validar en Play'
}

const search = ref('')
const filter = (name) => name.toLowerCase().includes(search.value.trim().toLowerCase())
const nativeVisible = computed(() => nativeSignals.value.filter(filter))
const customVisible = computed(() => customSignals.value.filter(filter))
const editable = computed(() => !!selected.value && !store.play.on && !store.edit.on && !store.paint.on && !store.locked)
const foldedGroups = ref(new Set())
const foldedSignals = ref(new Set())
function toggleGroup(key) {
  const next = new Set(foldedGroups.value)
  if (next.has(key)) next.delete(key); else next.add(key)
  foldedGroups.value = next
}
function toggleSignal(name) {
  const next = new Set(foldedSignals.value)
  if (next.has(name)) next.delete(name); else next.add(name)
  foldedSignals.value = next
}
function groupOf(signal) {
  if (signal.source === 'node-lifecycle') return { key:'node', label:'Nodo', icon:'box' }
  if (signal.source === 'animation-runner') return { key:'animation', label:'Animación', icon:'play' }
  if (signal.source === 'audio-voice') return { key:'audio', label:'Audio', icon:'audio' }
  if (signal.source === 'jolt-area') return { key:'area3d', label:'Area3D', icon:'area3d' }
  return { key:'type', label:selected.value?.type || 'Específicas', icon:'network' }
}
function signature(meta) {
  if (!meta) return '' // Una Custom Signal no tiene firma estática verificable.
  return `${meta.name}(${(meta.args || []).map(a => `${a.name}${a.type ? ': ' + a.type : ''}`).join(', ')})`
}
const groups = computed(() => {
  const result = new Map()
  for (const meta of nativeDefinitions.value.filter(s => filter(s.name))) {
    const type = groupOf(meta)
    if (!result.has(type.key)) result.set(type.key, { ...type, signals:[] })
    result.get(type.key).signals.push({ name:meta.name, meta })
  }
  if (customVisible.value.length) result.set('custom', {
    key:'custom', label:'Personalizadas', icon:'script',
    signals: customVisible.value.map(name => ({ name, meta:null })),
  })
  return [...result.values()]
})
const getTarget = (c) => byId.value.get(c.receiverId)
const connectionsFor = (name) => outgoing.value.filter(c => c.signal === name)
const runtime = computed(() => store.editor?.player?.on ? store.editor?.nodeLifecycle?.scripts : null)
function linkStatus(c) {
  if (!byId.value.has(c.emitterId) || !byId.value.has(c.receiverId)) return { label:'Incompleta', cls:'bad' }
  if (store.play.on && runtime.value) {
    if (runtime.value.sceneConnections?.has(c.id)) return { label:'Activa en Play', cls:'active' }
    if (runtime.value.sceneConnectionErrors?.has(c.id)) return { label:'Error de activación', cls:'bad' }
  }
  return nativeSignals.value.includes(c.signal) ? { label:'Registrada', cls:'stored' } : { label:'Pendiente de validar en Play', cls:'pending' }
}
function signalStatus(name) { return connectionsFor(name).length }
function onTreeKeydown(event) {
  if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return
  const tree = event.currentTarget
  const rows = [...tree.querySelectorAll('.sig-tree-focusable')].filter(el => el.getClientRects().length)
  const index = rows.indexOf(event.target)
  if (index < 0 || !rows.length) return
  event.preventDefault()
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1
    : Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))
  rows[next]?.focus()
}
function signalKeydown(event, name) {
  if (event.key === 'ArrowRight' && foldedSignals.value.has(name)) { event.preventDefault(); toggleSignal(name) }
  if (event.key === 'ArrowLeft' && !foldedSignals.value.has(name)) { event.preventDefault(); toggleSignal(name) }
}

const dialog = ref(false)
const dialogEl = ref(null)
const receiverFilterInput = ref(null)
const editingId = ref(null)
const openedEmitterId = ref(null)
const dialogSignal = ref('')
const receiverSearch = ref('')
const form = ref({ receiverId:'', method:'' })
const currentReceiver = computed(() => byId.value.get(form.value.receiverId))
const receiverMethods = computed(() => discoverNodeMethods(currentReceiver.value, store.project?.scripts || []))
const validReceiverMethods = computed(() => receiverMethods.value.methods.filter(m => !m.duplicate && !m.reserved))
const generationScriptId = ref('')
const generationMethod = ref('')
const generationCode = ref(null)
const generationScripts = computed(() => nodeScriptIds(currentReceiver.value)
  .map(id => store.project?.scripts?.find(s => s.id === id && s.execution === 'node'))
  .filter(Boolean))
const generationTarget = computed(() => generationScripts.value.find(s => s.id === generationScriptId.value))
const generationBlock = computed(() => {
  if (!dialog.value || editingId.value || !currentReceiver.value) return 'Selecciona un receptor para crear el método'
  if (!generationTarget.value) return 'Selecciona un Script de Nodo del receptor'
  if (generationCode.value === null || generationTarget.value.code !== generationCode.value) return 'El script cambió; vuelve a seleccionarlo'
  const reason = callbackGenerationBlockReason(generationScriptId.value)
  if (reason) return reason
  if (receiverMethods.value.diagnostics.length || receiverMethods.value.methods.some(m => m.duplicate || m.reserved || m.name === generationMethod.value))
    return 'Conflicto o método no verificable en los scripts del receptor'
  try { buildNodeCallbackCode(generationCode.value, generationMethod.value, chosenMeta.value?.args?.map(a => a.name) || []) }
  catch (error) { return error.message }
  return ''
})
const generatedCode = computed(() => {
  if (generationBlock.value) return ''
  return buildNodeCallbackCode(generationCode.value, generationMethod.value, chosenMeta.value?.args?.map(a => a.name) || [])
})
const generatedInsertion = computed(() => {
  if (!generatedCode.value) return ''
  const start = generatedCode.value.indexOf('node.expose(' + JSON.stringify(generationMethod.value))
  return start < 0 ? '' : generatedCode.value.slice(start, start + generatedCode.value.length - generationCode.value.length)
})
function setGenerationScript(id) {
  generationScriptId.value = id
  generationCode.value = generationTarget.value?.code ?? null
}
function generateCallback() {
  if (generationBlock.value) { toast(generationBlock.value, 'error', 4500); return }
  try {
    const result = createSceneSignalCallback({emitterId:openedEmitterId.value,signal:dialogSignal.value,
      receiverId:form.value.receiverId,scriptId:generationScriptId.value,
      method:generationMethod.value,expectedCode:generationCode.value})
    closeDialog()
    openScriptEditor(result.scriptId)
  } catch (error) { toast(error.message || String(error), 'error', 5000) }
}
const manualMethod = ref(false)
function chooseMethod(name) {
  if (!validReceiverMethods.value.some(m => m.name === name)) return
  form.value.method = name
  manualMethod.value = false
}
function chooseManualMethod() { manualMethod.value = true }

const currentLink = computed(() => authored.value.find(c => c.id === editingId.value))
const chosenMeta = computed(() => nativeDefinitions.value.find(s => s.name === dialogSignal.value))
// El árbol parte del emisor; la escena completa es una vista opcional.
// Se reutiliza parentId y se preservan nodos huérfanos o ciclos en modo escena.
const receiverScope = ref('subtree')
function isInEmitterTree(id) {
  const source = openedEmitterId.value || selected.value?.id
  const visited = new Set()
  let current = id
  while (current && !visited.has(current)) {
    if (current === source) return true
    visited.add(current)
    current = byId.value.get(current)?.parentId
  }
  return false
}
const receiverRows = computed(() => {
  const children = new Map(), seen = new Set(), all = objects.value
  for (const o of all) {
    const parent = o.parentId && byId.value.has(o.parentId) && o.parentId !== o.id ? o.parentId : null
    if (!children.has(parent)) children.set(parent, [])
    children.get(parent).push(o)
  }
  const rows = []
  const visit = (o, depth) => {
    if (!o || seen.has(o.id)) return
    seen.add(o.id)
    rows.push({ ...o, depth:Math.min(depth, 12) })
    for (const child of children.get(o.id) || []) visit(child, depth + 1)
  }
  if (receiverScope.value === 'subtree') {
    visit(byId.value.get(openedEmitterId.value || selected.value?.id), 0)
  } else {
    for (const root of children.get(null) || []) visit(root, 0)
    for (const remaining of all) visit(remaining, 0)
  }
  const query = receiverSearch.value.trim().toLowerCase()
  if (!query) return rows
  const visible = new Set(rows.map(o => o.id))
  const wanted = new Set(rows.filter(o => o.name.toLowerCase().includes(query) || o.id.toLowerCase().includes(query)).map(o => o.id))
  for (const row of rows.filter(o => wanted.has(o.id))) {
    const walked = new Set()
    let parent = row.parentId
    while (parent && visible.has(parent) && !walked.has(parent)) {
      walked.add(parent)
      wanted.add(parent)
      parent = byId.value.get(parent)?.parentId
    }
  }
  return rows.filter(o => wanted.has(o.id))
})
function selectReceiver(id) {
  if (form.value.receiverId !== id && !editingId.value) form.value.method = ''
  if (form.value.receiverId !== id) { generationScriptId.value = ''; generationCode.value = null }
  form.value.receiverId = id
  manualMethod.value = false
}
function receiverKeydown(event, index) {
  if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return
  event.preventDefault()
  const list = receiverRows.value
  if (!list.length) return
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 :
    Math.max(0, Math.min(list.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))
  selectReceiver(list[next].id)
  nextTick(() => dialogEl.value?.querySelectorAll('.sig-receiver-row')[next]?.focus())
}
function openNew(name) {
  if (!editable.value || !canConnectSignal(name)) return
  editingId.value = null
  openedEmitterId.value = selected.value.id
  dialogSignal.value = name
  form.value = { receiverId:'', method:'' }
  generationScriptId.value = ''; generationCode.value = null
  generationMethod.value = 'on_' + name.replace(/[^a-zA-Z0-9_$]/g, '_')
  manualMethod.value = false
  receiverSearch.value = ''
  receiverScope.value = 'subtree'
  dialog.value = true
  nextTick(() => receiverFilterInput.value?.focus())
}
function openEdit(c) {
  if (!editable.value || !outgoing.value.some(link => link.id === c.id)) return
  editingId.value = c.id
  openedEmitterId.value = selected.value.id
  dialogSignal.value = c.signal // Historial: conservar incluso señales sin declaración actual.
  form.value = { receiverId:c.receiverId, method:c.method }
  manualMethod.value = true // Historial: conservar métodos dinámicos o que ya no se detecten.
  receiverSearch.value = ''
  receiverScope.value = isInEmitterTree(c.receiverId) ? 'subtree' : 'scene'
  dialog.value = true
  nextTick(() => receiverFilterInput.value?.focus())
}
function closeDialog() {
  dialog.value = false
  editingId.value = null
  openedEmitterId.value = null
  dialogSignal.value = ''
  generationScriptId.value = ''; generationCode.value = null
}
function onDialogKeydown(event) {
  if (event.key !== 'Tab') return
  const focusables = [...dialogEl.value?.querySelectorAll('input:not([disabled]),button:not([disabled])') || []]
  if (!focusables.length) return
  if (event.shiftKey && document.activeElement === focusables[0]) { event.preventDefault(); focusables.at(-1).focus() }
  else if (!event.shiftKey && document.activeElement === focusables.at(-1)) { event.preventDefault(); focusables[0].focus() }
}
function save() {
  if (!dialog.value || !selected.value || !editable.value) return
  try {
    if (selected.value.id !== openedEmitterId.value) throw new Error('Cambió el nodo emisor')
    const original = editingId.value ? currentLink.value : null
    if (editingId.value && (!original || original.emitterId !== openedEmitterId.value || original.signal !== dialogSignal.value))
      throw new Error('La conexión original ya no corresponde al nodo seleccionado')
    const signal = original ? original.signal : dialogSignal.value
    if (!original && !canConnectSignal(signal)) throw new Error('Selecciona una señal disponible en el nodo emisor')
    const method = form.value.method.trim(), receiverId = form.value.receiverId
    if (!method || !receiverId) throw new Error('Indica nodo receptor y método')
    if (!byId.value.has(receiverId)) throw new Error('El nodo receptor ya no está en esta escena')
    const data = { emitterId:openedEmitterId.value, signal, receiverId, method }
    if (original) editSceneSignalConnection(original.id, data)
    else addSceneSignalConnection(data)
    closeDialog()
  } catch (error) { toast(error.message || String(error), 'error', 4500) }
}
function remove(c) {
  if (!editable.value) return
  try { removeSceneSignalConnection(c.id) } catch (error) { toast(error.message || String(error), 'error') }
}
watch(() => [store.selectedId, store.project?.activeSceneId, store.projSel?.id], () => {
  closeDialog(); foldedSignals.value = new Set(); foldedGroups.value = new Set()
})
watch(() => store.project?.signalConnections, () => { if (editingId.value && !currentLink.value) closeDialog() })
watch(editable, enabled => { if (!enabled) closeDialog() })
</script>

<template>
  <div class="sig-panel" data-testid="signal-connections-panel">
    <header class="sig-heading"><Icon name="network" :size="15" /><strong>Señales</strong><span>{{ outgoing.length }} conexiones</span></header>
    <p v-if="!selected" class="sig-empty" role="status">Selecciona un único nodo en la Jerarquía para consultar sus señales.</p>
    <template v-else>
      <div class="sig-source" :title="selected.id"><Icon name="box" :size="14" /><strong>{{ selected.name }}</strong><small>{{ selected.type }}</small></div>
      <label class="sig-search" for="lf-signal-search"><Icon name="search" :size="14" /><input id="lf-signal-search" v-model="search" type="search" placeholder="Filtrar señales…" autocomplete="off" /></label>
      <div class="sig-tree" role="tree" aria-label="Señales disponibles" @keydown="onTreeKeydown">
        <section v-for="group in groups" :key="group.key" class="sig-tree-group" role="group" :aria-label="group.label">
          <button type="button" class="sig-tree-category sig-tree-focusable" role="treeitem" aria-level="1" :aria-expanded="!foldedGroups.has(group.key)" @click="toggleGroup(group.key)" @keydown.left.prevent="foldedGroups.has(group.key) || toggleGroup(group.key)" @keydown.right.prevent="foldedGroups.has(group.key) && toggleGroup(group.key)">
            <Icon :name="foldedGroups.has(group.key) ? 'chevr' : 'chevd'" :size="13" />
            <Icon :name="group.icon" :size="14" class="sig-category-icon" />
            <span>{{ group.label }}</span><small>{{ group.signals.length }}</small>
          </button>
          <div v-if="!foldedGroups.has(group.key)" role="group" :aria-label="group.label">
            <div v-for="signal in group.signals" :key="group.key+'-'+signal.name" class="sig-entry">
              <div class="sig-entry-head">
                <button type="button" class="sig-signal-row sig-tree-focusable" role="treeitem" aria-level="2" :aria-expanded="!foldedSignals.has(signal.name)" :title="signal.meta?.condition || customLabel(signal.name)" @click="toggleSignal(signal.name)" @dblclick.stop="openNew(signal.name)" @keydown.enter.prevent="openNew(signal.name)" @keydown="signalKeydown($event, signal.name)">
                  <Icon :name="foldedSignals.has(signal.name) ? 'chevr' : 'chevd'" :size="12" />
                  <Icon name="network" :size="13" class="sig-symbol" />
                  <span class="sig-signature">{{ signal.meta ? signature(signal.meta) : signal.name }}</span>
                  <span class="sig-count">{{ signalStatus(signal.name) }}</span>
                </button>
                <button v-if="editable && canConnectSignal(signal.name)" type="button" class="sig-connect-icon" :aria-label="'Conectar '+signal.name" :title="'Conectar '+signal.name" @click="openNew(signal.name)"><Icon name="plus" :size="14" /></button>
              </div>
              <div v-if="!foldedSignals.has(signal.name)" class="sig-entry-children" role="group">
                <div v-if="!signal.meta" class="sig-custom-details" :class="{ bad: signalInfo.get(signal.name)?.nativeCollision || signalInfo.get(signal.name)?.duplicate }">
                  <span>{{ customLabel(signal.name) }}</span>
                  <small v-if="signalInfo.get(signal.name)">Script{{ signalInfo.get(signal.name).owners.length > 1 ? 's' : '' }}: {{ signalInfo.get(signal.name).owners.join(', ') }}</small>
                </div>
                <div v-for="c in connectionsFor(signal.name)" :key="c.id" class="sig-link">
                  <Icon name="chevr" :size="11" class="sig-link-mark" />
                  <button type="button" class="sig-link-target sig-tree-focusable" role="treeitem" aria-level="3" :title="getTarget(c)?.name || c.receiverId" :aria-label="'Editar conexión de '+signal.name+' a '+(getTarget(c)?.name || c.receiverId)" @click="openEdit(c)">
                    <span>{{ getTarget(c)?.name || 'Nodo inexistente' }} → {{ c.method }}()</span>
                    <small :class="linkStatus(c).cls">{{ linkStatus(c).label }}</small>
                    <small v-if="runtime?.sceneConnectionErrors?.has(c.id)" class="bad">{{ runtime.sceneConnectionErrors.get(c.id) }}</small>
                  </button>
                  <button v-if="editable" type="button" class="sig-connection-action" :aria-label="'Editar '+c.id" title="Editar" @click="openEdit(c)"><Icon name="script" :size="12" /></button>
                  <button v-if="editable" type="button" class="sig-connection-action" :aria-label="'Desconectar '+c.id" title="Desconectar" @click="remove(c)"><Icon name="x" :size="12" /></button>
                </div>
              </div>
            </div>
          </div>
        </section>
        <p v-if="!groups.length" class="sig-empty">Sin señales para esta búsqueda.</p>
      </div>
      <p v-if="scriptCount && customDiagnostics.length" class="sig-diagnostics" role="status"><Icon name="help" :size="13" /> Diagnósticos de scripts: <span v-for="(d,i) in customDiagnostics" :key="i">{{ d.scriptId }}: {{ d.detail }}{{ i < customDiagnostics.length - 1 ? ' · ' : '' }}</span></p>
      <p class="sig-quiet">Las señales personalizadas detectadas en código no se validan hasta Play. El Editor no ejecuta scripts.</p>
      <p v-if="!editable" class="sig-quiet" role="status">La edición de conexiones está deshabilitada durante Play o los modos de edición.</p>
    </template>
    <div v-if="dialog && selected" class="sig-dialog-backdrop" @keydown.esc="closeDialog" @keydown="onDialogKeydown">
      <div ref="dialogEl" class="sig-dialog" role="dialog" aria-modal="true" aria-labelledby="lf-sig-dialog-title">
        <header><div><strong id="lf-sig-dialog-title">{{ editingId ? 'Editar conexión' : 'Conectar señal a método' }}</strong><small>{{ selected.name }} · {{ selected.type }}</small></div><button type="button" aria-label="Cerrar diálogo" @click="closeDialog"><Icon name="x" :size="16" /></button></header>
        <form @submit.prevent="save">
          <label for="lf-sig-name">Señal de origen</label>
          <div id="lf-sig-name" class="sig-fixed-source" :title="dialogSignal" data-testid="signal-dialog-source">
            <Icon name="network" :size="13" />
            <span>{{ chosenMeta ? signature(chosenMeta) : dialogSignal }}</span>
          </div>
          <p v-if="editingId && !canConnectSignal(dialogSignal)" class="sig-quiet">Conexión antigua: la declaración de esta señal no está confirmada. Se conserva su nombre original.</p>
          <div class="sig-receiver-title"><label for="lf-sig-target-filter">Nodo receptor</label><span>{{ receiverScope === 'subtree' ? 'Emisor y descendientes' : 'Toda la escena' }}</span></div>
          <div class="sig-receiver-scope" role="group" aria-label="Alcance del árbol receptor">
            <button type="button" :aria-pressed="receiverScope === 'subtree'" @click="receiverScope = 'subtree'">Subárbol del emisor</button>
            <button type="button" :aria-pressed="receiverScope === 'scene'" @click="receiverScope = 'scene'">Toda la escena</button>
          </div>
          <input ref="receiverFilterInput" id="lf-sig-target-filter" v-model="receiverSearch" type="search" placeholder="Buscar en el árbol…" autocomplete="off" />
          <div class="sig-receiver-tree" role="tree" aria-label="Árbol de nodos receptores">
            <button v-for="(o,i) in receiverRows" :key="o.id" type="button" role="treeitem" class="sig-receiver-row" :class="{ on:form.receiverId === o.id }" :aria-selected="form.receiverId === o.id" :aria-level="o.depth+1" :style="{ paddingLeft:(9+o.depth*15)+'px' }" @click="selectReceiver(o.id)" @keydown="receiverKeydown($event,i)">
              <Icon name="box" :size="13" /><span class="sig-receiver-name">{{ o.name }}</span><small>{{ o.type }}</small><Icon v-if="form.receiverId===o.id" name="check" :size="13" />
            </button>
            <p v-if="!receiverRows.length" class="sig-empty">No hay nodos que coincidan.</p>
          </div>
          <p v-if="form.receiverId && !currentReceiver" class="sig-warning">Nodo receptor ausente: no se guardará la conexión.</p>
          <p v-else-if="currentReceiver && !receiverRows.some(o => o.id === currentReceiver.id)" class="sig-quiet" role="status">El receptor seleccionado está fuera de esta vista. Selecciona «Toda la escena» para localizarlo.</p>
          <div class="sig-method-heading"><strong>Método del receptor</strong><small v-if="currentReceiver">{{ currentReceiver.name }}</small></div>
          <div v-if="currentReceiver" class="sig-method-picker" role="group" aria-label="Métodos públicos detectados del receptor">
            <button v-for="method in receiverMethods.methods" :key="method.name" type="button" class="sig-method-choice"
              :class="{on:!manualMethod && form.method===method.name, bad:method.duplicate || method.reserved}"
              :aria-pressed="!manualMethod && form.method===method.name" :disabled="method.duplicate || method.reserved"
              @click="chooseMethod(method.name)">
              <Icon name="script" :size="13" />
              <span>{{ method.name }}<small>{{ method.owners.join(', ') }} · Detectado en código</small></span>
              <Icon v-if="!manualMethod && form.method===method.name" name="check" :size="13" />
              <small v-if="method.duplicate || method.reserved">{{ method.reserved ? 'Reservado' : 'Conflicto' }}</small>
            </button>
            <p v-if="!receiverMethods.methods.length" class="sig-quiet">No se detectaron métodos públicos literales en los Scripts de Nodo de este receptor.</p>
            <p v-if="receiverMethods.diagnostics.length" class="sig-method-diagnostics" role="status">{{ receiverMethods.diagnostics.map(d => `${d.scriptId}: ${d.detail}`).join(' · ') }}</p>
          </div>
          <button type="button" class="sig-method-manual" :aria-pressed="manualMethod" @click="chooseManualMethod">Escribir método manualmente (dinámico o no detectable)</button>
          <label for="lf-sig-method">Nombre del método</label>
          <input id="lf-sig-method" v-model="form.method" @input="manualMethod = true" required autocomplete="off" placeholder="método publicado con node.expose()" />
          <p v-if="!manualMethod && form.method && !validReceiverMethods.some(m => m.name === form.method)" class="sig-warning">El método guardado no está confirmado en código. Puedes conservarlo mediante la entrada manual.</p>
          <p class="sig-quiet">Los métodos encontrados no se validan hasta Play. La entrada manual permite métodos dinámicos.</p>
          <section v-if="currentReceiver" class="sig-generate" aria-label="Script de nodo receptor">
            <label for="lf-callback-script">Script receptor</label>
            <select id="lf-callback-script" :value="generationScriptId" @change="setGenerationScript($event.target.value)">
              <option value="">Seleccionar script…</option>
              <option v-for="sc in generationScripts" :key="sc.id" :value="sc.id">{{ sc.folder }}/{{ sc.name }}</option>
            </select>
            <p v-if="!generationScripts.length" class="sig-warning">El nodo receptor no tiene un Script de Nodo. Usa el flujo existente para crearlo y asignarlo primero.</p>
            <button type="button" class="sig-open-script" :disabled="!generationTarget" @click="openScriptEditor(generationScriptId)">Editar receptor</button>
            <template v-if="!editingId">
              <label for="lf-callback-name">Nombre del nuevo método</label>
              <input id="lf-callback-name" v-model="generationMethod" autocomplete="off" />
              <p v-if="generationBlock" class="sig-warning" role="status">{{ generationBlock }}</p>
              <template v-else>
                <label for="lf-callback-preview">Vista previa de código nuevo</label>
                <pre id="lf-callback-preview" class="sig-generation-preview">{{ generatedInsertion }}</pre>
                <p class="sig-quiet">Una sola transacción: insertar publicación y conectar señal. Undo/Redo revierten ambos cambios.</p>
              </template>
              <button type="button" class="sig-generate-action" :disabled="!!generationBlock" @click="generateCallback">Generar método y conectar</button>
            </template>
          </section>
          <footer><button type="button" @click="closeDialog">Cancelar</button><button type="submit" class="sig-submit" :disabled="!form.receiverId">{{ editingId ? 'Guardar cambio' : 'Conectar' }}</button></footer>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sig-panel { padding:8px 0 12px; min-width:0; color:var(--text); font-size:12px; }
.sig-heading { display:flex; align-items:center; gap:7px; padding:3px 11px 10px; border-bottom:1px solid var(--hair); }
.sig-heading strong { flex:1; font-size:12px; }
.sig-heading>span { color:var(--text-3); font-size:10px; }
.sig-source { display:flex; align-items:center; gap:7px; padding:9px 12px 6px; min-width:0; }
.sig-source strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sig-source small { color:var(--text-3); margin-left:auto; }
.sig-search { display:flex; align-items:center; gap:6px; margin:4px 9px 9px; padding:0 7px; border:1px solid var(--hair); background:var(--g-850); border-radius:4px; }
.sig-search input { border:none !important; background:transparent !important; padding:6px 0 !important; }
.sig-panel input { box-sizing:border-box; width:100%; min-width:0; color:var(--text); border:1px solid var(--hair); border-radius:4px; background:var(--g-850); padding:7px 9px; }
.sig-panel button { cursor:pointer; color:var(--text-2); background:transparent; border:0; border-radius:3px; }
.sig-panel button:hover { color:var(--text); background:var(--g-800); }
.sig-panel button:focus-visible,.sig-panel input:focus-visible { outline:2px solid var(--blue); outline-offset:1px; }
.sig-tree { min-width:0; }
.sig-tree-group { margin:1px 0 5px; }
.sig-tree-category { display:flex; align-items:center; gap:6px; width:100%; padding:6px 10px; text-align:left; background:var(--g-850) !important; font-weight:650; font-size:11px; }
.sig-category-icon { color:var(--text-3); }
.sig-tree-category span { flex:1; }
.sig-tree-category small { color:var(--text-3); font-variant-numeric:tabular-nums; font-weight:400; }
.sig-entry { min-width:0; }
.sig-entry-head { display:flex; align-items:center; gap:3px; min-width:0; padding:0 8px 0 16px; }
.sig-entry-head:hover,.sig-entry-head:focus-within { background:var(--g-850); }
.sig-signal-row { display:flex; align-items:center; gap:6px; flex:1; min-width:0; padding:6px 0; text-align:left; }
.sig-symbol { color:var(--blue); flex-shrink:0; }
.sig-signature { white-space:normal; overflow-wrap:anywhere; min-width:0; font-family:ui-monospace, monospace; font-size:11px; }
.sig-count { font-size:10px; color:var(--text-3); margin-left:auto; padding:1px 4px; }
.sig-connect-icon { flex:none; padding:4px; opacity:.48; }
.sig-entry-head:hover .sig-connect-icon,.sig-connect-icon:focus-visible { opacity:1; }
.sig-entry-children { margin-left:32px; border-left:1px solid var(--hair); }
.sig-link { display:flex; gap:3px; align-items:center; min-width:0; padding:2px 5px 2px 7px; }
.sig-link-mark { flex:none; color:var(--text-3); }
.sig-link-target { min-width:0; flex:1; text-align:left; display:flex; flex-direction:column; gap:2px; padding:4px 2px; }
.sig-link-target span { overflow-wrap:anywhere; font-size:11px; }
.sig-link-target small { font-size:10px; }
.sig-link .active { color:var(--green, #7ec7a1); }
.sig-link .bad,.sig-custom-details.bad,.sig-warning { color:var(--red, #e69b96); }
.sig-link .pending,.sig-diagnostics { color:var(--amber, #e0b66e); }
.sig-link .stored { color:var(--text-3); }
.sig-connection-action { padding:4px; flex:none; }
.sig-custom-details { padding:2px 6px 6px; color:var(--text-3); font-size:10px; line-height:1.5; }
.sig-custom-details small { display:block; }
.sig-diagnostics { display:flex; align-items:flex-start; gap:4px; flex-wrap:wrap; padding:3px 11px; font-size:10px; line-height:1.4; }
.sig-quiet { padding:2px 11px; margin:6px 0; font-size:10px; line-height:1.5; color:var(--text-3); }
.sig-empty { padding:12px; margin:0; color:var(--text-3); line-height:1.45; }
.sig-dialog-backdrop { position:fixed; inset:0; z-index:2000; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.66); padding:12px; }
.sig-dialog { box-sizing:border-box; width:min(490px,100%); max-height:min(720px,94vh); overflow-y:auto; background:var(--g-900); border:1px solid var(--hair); border-radius:7px; padding:0 14px 12px; box-shadow:0 20px 50px rgba(0,0,0,.55); }
.sig-dialog header { display:flex; align-items:center; justify-content:space-between; padding:12px 0; gap:8px; border-bottom:1px solid var(--hair); }
.sig-dialog header>div { min-width:0; }
.sig-dialog header strong { display:block; font-size:13px; }
.sig-dialog header small { display:block; color:var(--text-3); margin-top:3px; }
.sig-dialog header button { padding:4px; }
.sig-dialog label { display:block; margin:11px 0 5px; color:var(--text-2); font-size:11px; }
.sig-fixed-source { display:flex; align-items:center; gap:7px; padding:8px 9px; background:var(--g-850); border:1px solid var(--hair); border-radius:4px; font:11px ui-monospace, monospace; overflow-wrap:anywhere; color:var(--text); }
.sig-fixed-source svg { flex:none; color:var(--blue); }
.sig-fixed-source span { min-width:0; }
.sig-receiver-title { display:flex; justify-content:space-between; align-items:end; gap:6px; }
.sig-receiver-title span { font-size:10px; color:var(--text-3); }
.sig-receiver-scope { display:flex; gap:5px; margin:7px 0 2px; }
.sig-receiver-scope button { flex:1; padding:6px 7px; border:1px solid var(--hair); background:var(--g-850); font-size:10px; }
.sig-receiver-scope button[aria-pressed="true"] { border-color:var(--blue); color:var(--text); background:var(--blue-wash); }
 .sig-method-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; margin:9px 0 5px; }
.sig-method-heading small { color:var(--text-3); font-size:10px; }
.sig-method-picker { max-height:150px; overflow:auto; border:1px solid var(--hair); border-radius:4px; background:var(--g-850); }
.sig-method-choice { display:flex; align-items:center; gap:7px; width:100%; text-align:left; padding:6px 8px; }
.sig-method-choice span { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; }
.sig-method-choice span small { display:block; color:var(--text-3); font-size:10px; margin-top:2px; }
.sig-method-choice.on { background:var(--blue-wash); color:var(--text); }
.sig-method-choice.bad { opacity:.7; }
.sig-method-diagnostics { font-size:10px; padding:5px 8px; color:var(--red, #e69b96); }
.sig-method-manual { display:block; margin:6px 0; padding:5px 7px; border:1px solid var(--hair) !important; font-size:11px; }
.sig-method-manual[aria-pressed="true"] { border-color:var(--blue) !important; color:var(--text); }
.sig-receiver-tree { min-height:90px; max-height:min(230px,32vh); overflow:auto; margin-top:7px; border:1px solid var(--hair); background:var(--g-850); border-radius:4px; padding:4px 0; }
.sig-receiver-row { display:flex; align-items:center; gap:6px; width:100%; text-align:left; min-height:27px; padding-top:4px; padding-bottom:4px; padding-right:8px; }
.sig-receiver-row.on { background:var(--blue-wash); color:var(--text); }
.sig-receiver-name { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sig-receiver-row small { color:var(--text-3); font-size:10px; }
.sig-dialog .sig-quiet { padding:0; }
.sig-warning { margin:5px 0; font-size:10px; }
.sig-dialog footer { display:flex; justify-content:flex-end; gap:7px; margin-top:15px; padding-top:10px; border-top:1px solid var(--hair); }
.sig-dialog footer button { padding:7px 12px; border:1px solid var(--hair); background:var(--g-850); }
.sig-submit { background:var(--blue-wash) !important; color:var(--text) !important; }
.sig-submit:disabled { opacity:.5; cursor:not-allowed; }
.sig-generate { display:flex; flex-direction:column; gap:6px; padding:10px; margin:10px 0; border:1px solid var(--hair); border-radius:5px; }
.sig-generate select,.sig-generate input { width:100%; min-width:0; }
.sig-generation-preview { white-space:pre-wrap; overflow-wrap:anywhere; max-height:130px; overflow:auto; padding:9px; background:var(--bg-2,#171717); font-size:11px; }
.sig-open-script, .sig-generate-action { padding:8px; border-radius:4px; }
.sig-open-script:disabled, .sig-generate-action:disabled { opacity:.45; cursor:not-allowed; }
</style>
