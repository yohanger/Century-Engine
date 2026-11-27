<script setup>
// Editor de eventos (estilo RPG Maker MZ): páginas con condiciones, gráfico, disparador y lista de comandos.
// Se trabaja sobre una copia; «Aceptar» la vuelve a escribir en el nodo (un solo paso de deshacer).
import VarPicker from './VarPicker.vue'
import { ref, reactive, computed, nextTick, watch } from 'vue'
import { store, getObject, updateObject, closeEventEditor, importFiles, toast, touchDb, markDirty } from '../core/store.js'
import { normalizeEvent, newPage, TRIGGERS, GRAPHIC_PARAMS, GAZE_PARAMS, INPUT_PARAMS, SIGNAL_PARAMS, MOVE_PARAMS, OPTION_PARAMS, clone, walk } from '../engine/runtime/events/model.js'
import { routeText } from '../engine/runtime/events/route.js'
import { stripCodes } from '../engine/runtime/events/textcodes.js'
import { COMMANDS, GROUP_ORDER, newCommand, syncBlocks, blocksOf, summaryOf } from '../engine/runtime/events/commandDefs.js'
import { uid, pickFile } from '../engine/runtime/util.js'
import { extOf } from '../core/project.js'
import DialogPreview from './DialogPreview.vue'
import ParamForm from './ParamForm.vue'
import NumberField from './NumberField.vue'
import InteractionZonesPanel from './InteractionZonesPanel.vue'
import FloatingEditorWindow from './FloatingEditorWindow.vue'
import AppWindow from './AppWindow.vue'
import EventPreview from './EventPreview.vue'
import RouteEditor from './RouteEditor.vue'
import Icon from './Icon.vue'
import commandSearchIcon from '../assets/icons/icn_search.png'

// «db:commonEvents:3» = evento común de la base de datos (solo lista de comandos)
const isAn = String(store.eventEditId).startsWith('an:') // «an:<animación>:<evento>» = comandos de un evento de animación
const isTl = String(store.eventEditId).startsWith('tl:') || isAn // «tl:<timeline>:<pista>:<clave>» = comandos de una clave de timeline
const tlKey = isAn ? (() => { const [, a, b] = String(store.eventEditId).split(':'); return (store.project.animations || []).find((c) => c.id === a)?.events.find((e) => e.id === b) })() : isTl ? (() => { const [, a, b, c] = String(store.eventEditId).split(':'); return store.project.timelines.find((t) => t.id === a)?.tracks.find((t) => t.id === b)?.keys.find((k) => k.id === c) })() : null
const isCommon = String(store.eventEditId).startsWith('db:') || isTl
const commonRec = isTl ? tlKey : isCommon ? store.project.database.commonEvents.find((r) => r.id === +String(store.eventEditId).split(':')[2]) : null
const obj = isCommon ? (commonRec ? { id: store.eventEditId, name: commonRec.name || (isTl ? 'Comandos del timeline' : 'Evento común'), scale: [1, 1, 1], props: { reach: 1, pages: [{ ...newPage(1), list: clone(commonRec.list || []) }] } } : null) : getObject(store.eventEditId)
const name = ref(obj?.name || 'Evento')
const draft = reactive(normalizeEvent(clone(obj?.props || {})))
const pi = ref(0)
const page = computed(() => draft.pages[pi.value])
const listEl = ref(null)
const modelBusy = ref(false)
const modelHover = ref(false)
const selectedModel = computed(() => store.project.models.find((m) => m.id === page.value.graphic.modelId))

// El modelo se importa al proyecto inmediatamente. Solo la asignación a la página es parte del borrador.
async function assignImportedModel(files) {
  if (modelBusy.value) return
  const input = Array.from(files || [])
  if (input.length !== 1 || !['glb', 'obj'].includes(extOf(input[0]?.name))) {
    toast('Drop exactly one .glb or .obj model', 'error', 4000)
    return
  }
  const target = page.value.graphic // capturar la página: el usuario puede cambiarla durante la importación
  modelBusy.value = true
  try {
    const count = await importFiles(input, 'Assets/Models')
    const created = count ? (importFiles.last || []).find((entry) => entry.kind === 'model') : null
    if (created && draft.pages.some((pg) => pg.graphic === target)) {
      target.kind = 'model'
      target.modelId = created.id
    }
  } catch (err) {
    toast(`Model import failed: ${err.message}`, 'error', 5000)
  } finally {
    modelBusy.value = false
    modelHover.value = false
  }
}
async function browseModel(event) {
  if (modelBusy.value) return
  const files = await pickFile('.glb,.obj', false, event.currentTarget.ownerDocument)
  if (files.length) await assignImportedModel(files)
}
function modelDragOver(e) {
  if (modelBusy.value || !e.dataTransfer?.types?.includes('Files')) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
  modelHover.value = true
}
function modelDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) modelHover.value = false
}
function modelDrop(e) {
  e.preventDefault()
  e.stopPropagation()
  modelHover.value = false
  if (e.dataTransfer?.files?.length) void assignImportedModel(e.dataTransfer.files)
}
function closeIfIdle() { if (!modelBusy.value) closeEventEditor() }

// ---------- portapapeles (compartido entre eventos mientras la app esté abierta) ----------
const clip = (window.__lfEventClip ??= { cmd: null, page: null })

// ---------- nombres para los resúmenes ----------
const pad = (i) => String(i).padStart(3, '0')
const nm = (kind, i) => { const n = store.project.database[kind][i - 1]; return n ? ` ${n}` : '' }
const R = {
  sw: (i) => `[${pad(i)}${nm('switches', i)}]`,
  vr: (i) => `[${pad(i)}${nm('variables', i)}]`,
  ui: (id) => store.project.uis.find((u) => u.id === id)?.name || '(sin interfaz)',
  scene: (id) => store.project.scenes.find((s) => s.id === id)?.name || '(sin escena)',
  node: (id) => getObject(id)?.name || (id ? `«${id}»` : '(sin nodo)'),
  db: (kind, id) => store.project.database[kind]?.find((r) => r.id === +id)?.name || `#${id}`,
}
const COLOR = { Mensajes: '#62a6d8', Flujo: '#e3b341', Datos: '#5fc88f', 'Jugador y escena': '#f88fc3', Mundo: '#f2a85f', 'Personajes e inventario': '#e8c35f', Audio: '#6fd3cf', Avanzado: '#8da5f3' }
const colorOf = (code) => COLOR[COMMANDS[code]?.group] || 'var(--text-2)'

// ---------- páginas ----------
function addPage() { draft.pages.push(newPage(draft.pages.length + 1)); pi.value = draft.pages.length - 1; sel.value = null }
function dupPage() { const c = clone(page.value); reid(c); c.name = `Página ${draft.pages.length + 1}`; draft.pages.splice(pi.value + 1, 0, c); pi.value++; sel.value = null }
function delPage() { if (draft.pages.length < 2) return; draft.pages.splice(pi.value, 1); pi.value = Math.min(pi.value, draft.pages.length - 1); sel.value = null }
function copyPage() { clip.page = JSON.stringify(page.value) }
function pastePage() { if (!clip.page) return; const c = JSON.parse(clip.page); reid(c); draft.pages.splice(pi.value + 1, 0, c); pi.value++; sel.value = null }
function reid(pg) { pg.id = uid('pg'); walk(pg.list, (c) => { c.id = 'c' + uid('') }) }
const trig = computed(() => TRIGGERS.find((t) => t[0] === page.value.trigger))
// condiciones con casilla (como MZ): activa = valor distinto de 0 / vacío
const cond = computed(() => page.value.cond)
const swIds = computed(() => Array.from({ length: Math.max(20, store.project.database.switches.length + 5) }, (_, i) => i + 1))
const vrIds = computed(() => Array.from({ length: Math.max(20, store.project.database.variables.length + 5) }, (_, i) => i + 1))
const opts = [['>=', '≥'], ['>', '>'], ['==', '='], ['<=', '≤'], ['<', '<'], ['!=', '≠']]
const setOn = (key, on, val = 1) => { cond.value[key] = on ? val : (typeof val === 'string' ? '' : 0) }
const gazeOn = computed(() => page.value.trigger === 'look' || !!page.value.gaze.on)
const zoneSize = computed(() => obj?.scale || [2, 2, 2])
const dbName = (kind, i) => store.project.database[kind][i - 1] || ''
const summary = (t) => stripCodes(t)

// ---------- filas de la lista de comandos ----------
const rows = computed(() => {
  const out = []
  const emit = (list, depth) => {
    list.forEach((cmd, idx) => {
      out.push({ k: 'cmd', cmd, list, idx, depth })
      const bl = blocksOf(cmd)
      if (bl.length) {
        for (const b of bl) {
          out.push({ k: 'blk', label: b.label, depth })
          const arr = cmd.b[b.key]
          emit(arr, depth + 1)
          out.push({ k: 'ins', list: arr, idx: arr.length, depth: depth + 1 })
        }
        out.push({ k: 'end', depth })
      }
    })
  }
  emit(page.value.list, 0)
  out.push({ k: 'ins', list: page.value.list, idx: page.value.list.length, depth: 0 })
  return out
})
const selectable = computed(() => rows.value.filter((r) => r.k === 'cmd' || r.k === 'ins'))
const sel = ref(null) // { list, idx }
const isSel = (r) => !!sel.value && (r.k === 'cmd' || r.k === 'ins') && sel.value.list === r.list && sel.value.idx === r.idx
const pick = (r) => { sel.value = { list: r.list, idx: r.idx }; listEl.value?.focus() }
const cur = computed(() => (sel.value ? sel.value.list[sel.value.idx] || null : null))
const spot = () => sel.value || { list: page.value.list, idx: page.value.list.length }

function moveSel(d) {
  const s = selectable.value
  let i = s.findIndex((r) => isSel(r))
  i = clamp(i + d, 0, s.length - 1)
  pick(s[i])
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

// ---------- insertar / editar ----------
const picker = ref(false)
const commandSearch = ref('')
const commandSearchInput = ref(null)
const edit = ref(null) // { cmd, copy, isNew, at: {list, idx} }
const previewOpen = ref(false) // ventana «Vista previa» de un comando de diálogo
watch(edit, (e) => { if (!e) previewOpen.value = false })
const groups = computed(() => GROUP_ORDER.map((g) => [g, Object.entries(COMMANDS).filter(([, d]) => d.group === g)]).filter(([, l]) => l.length))
// Selector de comandos en pestañas, como RPG Maker: cada pestaña agrupa varias secciones.
const PICK_TABS = [
  ['Básico', ['Mensajes', 'Flujo', 'Datos']],
  ['Personajes y jugador', ['Personajes e inventario', 'Jugador y escena']],
  ['Mundo y más', ['Mundo', 'Audio', 'Avanzado']],
]
const pickTab = ref(0)
const commandTerm = (text) => text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim()
const pickSections = computed(() => {
  const term = commandTerm(commandSearch.value)
  if (term) return groups.value.map(([group, commands]) => [group, commands.filter(([id, d]) =>
    commandTerm(`${d.label} ${group} ${id}`).includes(term)
  )]).filter(([, commands]) => commands.length)
  const names = PICK_TABS[pickTab.value][1]
  const known = new Set(PICK_TABS.flatMap((t) => t[1]))
  return groups.value.filter(([g]) => names.includes(g) || (pickTab.value === PICK_TABS.length - 1 && !known.has(g)))
})
watch(picker, async (open) => {
  if (!open) return
  commandSearch.value = ''
  await nextTick()
  commandSearchInput.value?.focus()
})
function pickSearchResult() {
  const commands = pickSections.value.flatMap(([, list]) => list)
  if (commands.length === 1) chooseCommand(commands[0][0])
}

function chooseCommand(code) {
  picker.value = false
  const d = COMMANDS[code]
  const at = { ...spot() }
  const cmd = newCommand(code)
  if (!d.params.length) return insert(cmd, at)
  edit.value = { cmd, copy: clone(cmd.p), isNew: true, at }
}
function insert(cmd, at) {
  at.list.splice(at.idx, 0, cmd)
  sel.value = { list: at.list, idx: at.idx + 1 }
}
function openEdit() {
  const c = cur.value
  if (!c) return picker.value = true
  if (!COMMANDS[c.code]?.params.length) return
  edit.value = { cmd: c, copy: clone(c.p), isNew: false, at: null }
}
function okEdit() {
  const e = edit.value
  e.cmd.p = e.copy
  syncBlocks(e.cmd)
  if (e.isNew) insert(e.cmd, e.at)
  edit.value = null
  nextTick(() => listEl.value?.focus())
}

// ---------- operaciones sobre la selección ----------
function del() {
  const s = sel.value
  if (!s || !s.list[s.idx]) return
  s.list.splice(s.idx, 1)
}
function move(d) {
  const s = sel.value
  if (!s || !s.list[s.idx]) return
  const j = s.idx + d
  if (j < 0 || j >= s.list.length) return
  const [c] = s.list.splice(s.idx, 1)
  s.list.splice(j, 0, c)
  sel.value = { list: s.list, idx: j }
}
function dup() {
  const c = cur.value
  if (!c) return
  const k = clone(c); walk([k], (x) => { x.id = 'c' + uid('') })
  sel.value.list.splice(sel.value.idx + 1, 0, k)
}
function copy() { if (cur.value) clip.cmd = JSON.stringify(cur.value) }
function paste() {
  if (!clip.cmd) return
  const k = JSON.parse(clip.cmd); walk([k], (x) => { x.id = 'c' + uid('') })
  const at = spot()
  insert(k, at)
}
function onKey(e) {
  if (edit.value || picker.value || e.altKey) return
  // Space edita en la lista, pero nunca roba espacios a campos o controles.
  if (e.target !== listEl.value) return
  const mod = e.ctrlKey || e.metaKey
  if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(1) } else if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(-1) } else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); del() } else if (e.key === 'Enter' || (e.code === 'Space' && !mod && !e.shiftKey)) { e.preventDefault(); openEdit() } else if (mod && e.key.toLowerCase() === 'c') { e.preventDefault(); copy() } else if (mod && e.key.toLowerCase() === 'v') { e.preventDefault(); paste() } else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); dup() }
}

// ---------- cierre ----------
function accept() {
  if (modelBusy.value) return
  if(isTl && !isAn) {
    const [,resourceId,trackId] = String(store.eventEditId).split(':')
    const track=store.project.timelines.find(t=>t.id===resourceId)?.tracks.find(t=>t.id===trackId)
    if(!track || track.locked || store.locked || store.play.on){toast('La pista de Timeline está bloqueada para edición','error');return}
  }
  const ids = new Set(store.project.models.map((m) => m.id))
  const missing = draft.pages.findIndex((pg) => pg.graphic.kind === 'model' && !ids.has(pg.graphic.modelId))
  if (missing !== -1) { toast(`Event Page ${missing + 1}: select an existing model`, 'error', 4500); pi.value = missing; return }
  if (isCommon) { commonRec.list = clone(draft.pages[0].list); commonRec.name = name.value.trim() || commonRec.name; isTl ? markDirty() : touchDb(); closeEventEditor(); return }
  if (!getObject(obj.id)) { toast('Vuelve a abrir la escena del evento para aplicar los cambios.', 'error'); return }
  updateObject(obj.id, { name: name.value.trim() || obj.name, props: clone(draft) }, { label: 'Editar evento' })
  closeEventEditor()
}
function esc() {
  if (modelBusy.value) return
  if (edit.value) edit.value = null
  else if (picker.value) picker.value = false
  else closeIfIdle()
}
const total = computed(() => { let n = 0; walk(page.value.list, () => n++); return n })
</script>

<template>
  <FloatingEditorWindow dock-panel-id="eventEditor" v-if="obj" native-tool="events" :native-on-demand="true" :native-closable="!modelBusy"
    :initial-width="1280" :initial-height="720" label="Editor de eventos" title-icon="event" :subtitle="name" @close="$event === 'native' ? closeIfIdle() : esc()">
    <div class="edwin ev" tabindex="-1" @keydown.esc.stop="esc">
      <h2 data-window-drag-handle>
        <span class="dim">{{ isAn ? 'Comandos del evento de animación' : isTl ? 'Comandos del timeline' : isCommon ? 'Evento común' : 'Evento' }}</span>
        <input v-model="name" class="nm" spellcheck="false" />
        <span class="grow"></span>
        <template v-if="!isCommon"><span class="dim small">Alcance de acción</span>
        <div class="reach"><NumberField :model-value="draft.reach" :step="0.1" :min="0" :max="10" @update:model-value="draft.reach = $event" /></div>
        <span class="dim small">m</span></template>
      </h2>

      <div v-if="!isCommon" class="tabs">
        <button v-for="(pg, i) in draft.pages" :key="pg.id" class="tab" :class="{ on: i === pi }" @click="pi = i; sel = null">{{ i + 1 }}</button>
        <button class="ghost icon" data-tooltip="Nueva página" @click="addPage">＋</button>
        <i class="sep"></i>
        <button class="ghost" data-tooltip="Duplicar la página" @click="dupPage">Duplicar</button>
        <button class="ghost" data-tooltip="Copiar la página" @click="copyPage">Copiar</button>
        <button class="ghost" :disabled="!clip.page" data-tooltip="Pegar la página copiada" @click="pastePage">Pegar</button>
        <button class="ghost danger" :disabled="draft.pages.length < 2" @click="delPage">Eliminar página</button>
      </div>

      <div class="main">
        <aside v-if="!isCommon" class="col c1">
          <fieldset>
            <legend>Condiciones</legend>
            <div class="crow"><input type="checkbox" :checked="!!cond.sw1" @change="setOn('sw1', $event.target.checked)" /><span class="lb">Interruptor</span>
              <VarPicker kind="switches" :disabled="!cond.sw1" v-model="cond.sw1" /><span class="t">está ON</span></div>
            <div class="crow"><input type="checkbox" :checked="!!cond.sw2" @change="setOn('sw2', $event.target.checked)" /><span class="lb">Interruptor</span>
              <VarPicker kind="switches" :disabled="!cond.sw2" v-model="cond.sw2" /><span class="t">está ON</span></div>
            <div class="crow"><input type="checkbox" :checked="!!cond.vr" @change="setOn('vr', $event.target.checked)" /><span class="lb">Variable</span>
              <VarPicker kind="variables" :disabled="!cond.vr" v-model="cond.vr" /></div>
            <div class="crow sub"><span class="lb"></span><select :disabled="!cond.vr" v-model="cond.vrOp" class="op"><option v-for="o in opts" :key="o[0]" :value="o[0]">{{ o[1] }}</option></select>
              <NumberField :model-value="+cond.vrVal || 0" :step="1" :disabled="!cond.vr" @update:model-value="cond.vrVal = $event" /></div>
            <div class="crow"><input type="checkbox" :checked="!!cond.item" @change="setOn('item', $event.target.checked)" /><span class="lb">Objeto</span>
              <select :disabled="!cond.item" v-model.number="cond.item"><option v-for="r in store.project.database.items" :key="r.id" :value="r.id">{{ r.name }}</option></select><span class="t">en inv.</span></div>
            <div class="crow"><input type="checkbox" :checked="!!cond.actor" @change="setOn('actor', $event.target.checked)" /><span class="lb">Personaje</span>
              <select :disabled="!cond.actor" v-model.number="cond.actor"><option v-for="r in store.project.database.actors" :key="r.id" :value="r.id">{{ r.name }}</option></select><span class="t">en grupo</span></div>
            <div class="crow"><input type="checkbox" :checked="!!cond.self" @change="setOn('self', $event.target.checked, 'A')" /><span class="lb">Auto-interruptor</span>
              <select :disabled="!cond.self" v-model="cond.self"><option v-for="c in ['A', 'B', 'C', 'D']" :key="c" :value="c">{{ c }}</option></select><span class="t">está ON</span></div>
            <div class="crow"><input type="checkbox" :checked="!!cond.script" @change="setOn('script', $event.target.checked, 'true')" /><span class="lb">Script</span>
              <input type="text" :disabled="!cond.script" v-model="cond.script" placeholder="game.variable(3) > 2" spellcheck="false" /></div>
          </fieldset>

          <fieldset class="img">
            <legend>Imagen</legend>
            <div class="pv"><EventPreview :graphic="page.graphic" :zone="zoneSize" :gaze="page.gaze" :show-gaze="gazeOn" :show-indicator="page.showIndicator && page.trigger === 'action'" :indicator-zones="page.indicatorZones" /></div>
            <ParamForm :params="GRAPHIC_PARAMS" :values="page.graphic" />
            <div class="model-slot" :class="{ hover: modelHover, busy: modelBusy }" aria-label="Event model slot"
              @dragover="modelDragOver" @dragleave="modelDragLeave" @drop="modelDrop">
              <span class="slot-info">{{ selectedModel && page.graphic.kind === 'model' ? selectedModel.name : 'Suelta un .glb / .obj aquí' }}</span>
              <button type="button" :disabled="modelBusy" @click="browseModel">{{ modelBusy ? 'Importando…' : 'Importar GLB / OBJ…' }}</button>
            </div>
            <p class="hint lf-help">El visor 3D muestra la página 1. Al jugar se elige la página activa según las condiciones.</p>
          </fieldset>
        </aside>

        <aside v-if="!isCommon" class="col c2">
          <fieldset>
            <legend>Movimiento autónomo</legend>
            <ParamForm :params="MOVE_PARAMS" :values="page.move" />
            <div v-if="page.move.type === 'custom'" class="route">
              <RouteEditor :route="page.move.route" compact>
                <template #step-params="{ params, values, notify }">
                  <ParamForm :params="params" :values="values" @change="notify" />
                </template>
              </RouteEditor>
            </div>
          </fieldset>
          <fieldset>
            <legend>Opciones</legend>
            <label class="chk"><input v-model="page.solid" type="checkbox" /> <span>Sólido: bloquea al jugador (necesita imagen)</span></label>
            <label class="chk"><input v-model="page.showIndicator" type="checkbox" /> <span>Mostrar indicador de interacción</span></label>
            <InteractionZonesPanel v-if="page.showIndicator && page.trigger === 'action'" :model-value="page.indicatorZones" :reach="draft.reach + 0.3" @change="page.indicatorZones = $event.value" />
            <ParamForm :params="OPTION_PARAMS" :values="page.options" />
          </fieldset>
          <fieldset>
            <legend>Disparador</legend>
            <select v-model="page.trigger" class="w100"><option v-for="t in TRIGGERS" :key="t[0]" :value="t[0]">{{ t[1] }}</option></select>
            <p class="hint">{{ trig?.[2] }}</p>
            <ParamForm v-if="page.trigger === 'input'" :params="INPUT_PARAMS" :values="page.input" />
            <ParamForm v-if="page.trigger === 'signal'" :params="SIGNAL_PARAMS" :values="page.signal" />
          </fieldset>
          <fieldset class="gz" :class="{ on: gazeOn }">
            <legend>Mirada del jugador <i class="gdot"></i></legend>
            <template v-if="page.trigger === 'look'">
              <p class="hint lf-help">«Al mirarlo» siempre usa el círculo amarillo. Ajusta dónde está y qué tamaño tiene.</p>
              <ParamForm :params="GAZE_PARAMS.filter((q) => q.key !== 'on')" :values="page.gaze" />
            </template>
            <ParamForm v-else :params="GAZE_PARAMS" :values="page.gaze" />
            <p class="hint lf-help">El círculo amarillo de la vista previa marca el punto donde el jugador debe tener la mirilla.</p>
          </fieldset>
        </aside>

        <section class="cmds">
          <div class="ttl">Comandos <span>{{ total }}</span></div>
          <div class="bar">
            <button class="primary" @click="picker = true"><Icon name="plus" :size="14" />Insertar comando…</button>
            <button :disabled="!cur" @click="openEdit">Editar</button>
            <button :disabled="!cur" data-tooltip="Subir" @click="move(-1)">↑</button>
            <button :disabled="!cur" data-tooltip="Bajar" @click="move(1)">↓</button>
            <button :disabled="!cur" @click="dup">Duplicar</button>
            <button :disabled="!cur" @click="copy">Copiar</button>
            <button :disabled="!clip.cmd" @click="paste">Pegar</button>
            <button class="danger" :disabled="!cur" @click="del">Eliminar</button>
          </div>
          <div ref="listEl" class="list" tabindex="0" @keydown="onKey" @mousedown.self="sel = null">
            <template v-for="(r, i) in rows" :key="i">
              <div v-if="r.k === 'cmd'" class="r cmd" :class="{ on: isSel(r) }" :style="{ paddingLeft: 10 + r.depth * 20 + 'px' }" @mousedown="pick(r)" @dblclick="openEdit">
                <span class="dot" :style="{ background: colorOf(r.cmd.code) }"></span>
                <b :style="{ color: colorOf(r.cmd.code) }">{{ COMMANDS[r.cmd.code]?.label || r.cmd.code }}</b>
                <span class="sum">{{ summary(summaryOf(r.cmd, R)) }}</span>
              </div>
              <div v-else-if="r.k === 'blk'" class="r blk" :style="{ paddingLeft: 10 + r.depth * 20 + 'px' }">▸ {{ r.label }}</div>
              <div v-else-if="r.k === 'end'" class="r end" :style="{ paddingLeft: 10 + r.depth * 20 + 'px' }">◂ Fin</div>
              <div v-else class="r ins" :class="{ on: isSel(r) }" :style="{ paddingLeft: 10 + r.depth * 20 + 'px' }" @mousedown="pick(r)" @dblclick="picker = true">◇ <span>{{ isSel(r) ? 'aquí se insertará (doble clic: elegir comando)' : '' }}</span></div>
            </template>
          </div>
        </section>
      </div>

      <div class="foot">
        <span class="dim grow lf-help">Sugerencia: doble clic en una línea vacía (◇) para insertar · Enter / Espacio edita · Supr borra · Ctrl+C / V / D</span>
        <button :disabled="modelBusy" @click="closeIfIdle">Cancelar</button>
        <button class="primary" :disabled="modelBusy" @click="accept">Aceptar</button>
      </div>

      <AppWindow v-if="picker" title="Insertar comando" :width="740" :height="525" :min-width="360" :min-height="260" :level="50" persist="evpick" @close="picker = false">
        <div class="dlg-body">
          <label class="command-search"><img :src="commandSearchIcon" alt="" /><input ref="commandSearchInput" v-model="commandSearch"
            type="search" placeholder="Buscar comandos…" aria-label="Buscar comandos" @keydown.enter.prevent="pickSearchResult" /></label>
          <nav v-if="!commandSearch.trim()" class="ptabs" role="tablist" aria-label="Categorías de comandos">
            <button v-for="([name], i) in PICK_TABS" :key="name" role="tab" :aria-selected="pickTab === i" :class="{ on: pickTab === i }" @click="pickTab = i">{{ name }}</button>
          </nav>
          <div class="grid">
            <div v-for="[g, list] in pickSections" :key="g" class="grp">
              <header><span class="dot" :style="{ background: COLOR[g] }"></span>{{ g }}</header>
              <button v-for="[code, d] in list" :key="code" @click="chooseCommand(code)">{{ d.label }}<Icon name="chevron-right" :size="13" /></button>
            </div>
            <p v-if="!pickSections.length" class="dim" role="status">No se encontraron comandos.</p>
          </div>
        </div>
        <template #footer><span style="flex:1"></span><button @click="picker = false">Cancelar</button></template>
      </AppWindow>

      <!-- parámetros del comando (formulario generado) -->
      <!-- Los comandos abren un formulario ancho. Su altura sigue dependiendo de los campos que tenga cada uno. -->
      <AppWindow v-if="edit" :title="COMMANDS[edit.cmd.code].label" :subtitle="COMMANDS[edit.cmd.code].group"
        :width="edit.cmd.code === 'script' ? 960 : 760" :min-width="360" :min-height="160" :level="60" @close="edit = null">
        <div class="dlg-body cmd-dlg"><ParamForm :params="COMMANDS[edit.cmd.code].params" :values="edit.copy" /></div>
        <!-- Vista previa: separada de Cancelar / Aceptar -->
        <template #footer><button v-if="COMMANDS[edit.cmd.code].preview" data-testid="cmd-preview" @click="previewOpen = true">▶ Vista previa</button><span style="flex:1"></span><button @click="edit = null">Cancelar</button><button class="primary" @click="okEdit">Aceptar</button></template>
      </AppWindow>
      <DialogPreview v-if="edit && previewOpen && COMMANDS[edit.cmd.code].preview" :code="edit.cmd.code" :params="edit.copy" @close="previewOpen = false" />
    </div>
  </FloatingEditorWindow>
</template>

<style scoped>
.edwin.ev { width: 100%; height: 100%; min-width: 0; max-width: none; max-height: none; display: flex; flex-direction: column; overflow: hidden; position: relative; outline: none; container: event-editor / inline-size; }
h2 { display: flex; align-items: center; gap: 8px; padding: 10px 14px; }
.nm { font-weight: 600; font-size: 14px; width: 260px; }
.grow { flex: 1; }
.dim { color: var(--text-3); font-weight: 400; }
.small { font-size: 11px; }
.reach { width: 70px; display: flex; }
.tabs { display: flex; align-items: center; gap: 3px; padding: 6px 10px; border-bottom: 1px solid var(--hair); background: var(--g-900); flex: none; }
.tab { width: 30px; padding: 0; background: var(--g-800); }
.tab.on { background: var(--blue); border-color: var(--blue); color: #fff; }
.sep { width: 1px; height: 16px; background: var(--hair); margin: 0 6px; }
.main { flex: 1; min-height: 0; display: flex; }
.col { flex: none; overflow: auto; border-right: 1px solid var(--hair); padding: 8px 10px 14px; background: var(--g-850); display: flex; flex-direction: column; gap: 8px; }
.c1, .c2 { width: clamp(235px, 24cqw, 294px); }
.c2 :deep(.pf .row) { grid-template-columns: 138px 1fr; }
.c2 :deep(.pf .row.t-bool) { grid-template-columns: 1fr 22px; }
.c2 :deep(.pf .row.t-bool > label) { order: 0; color: var(--text-2); white-space: normal; }
.c2 :deep(.pf .row.t-bool .ctl) { justify-content: flex-end; }
fieldset { border: 1px solid var(--hair); border-radius: 6px; margin: 0; padding: 6px 10px 10px; min-width: 0; }
legend { padding: 0 6px; font-weight: 600; color: var(--text-2); font-size: 11.5px; }
.chk { display: flex; align-items: flex-start; gap: 6px; padding: 4px 0; }
.chk input { flex: none; margin: 1px 0 0; }
.chk span { min-width: 0; }
.crow { display: grid; grid-template-columns: 18px 86px 1fr 52px; gap: 6px; align-items: center; min-height: 26px; }
.crow .lb { color: var(--text-2); font-size: 11.5px; }
.crow .t { color: var(--text-3); font-size: 11px; }
.crow > input[type='text'] { grid-column: 3 / 5; }
.crow.sub { grid-template-columns: 18px 86px 56px 1fr; }
.crow select.op { width: 100%; }
.crow input:disabled, .crow select:disabled { opacity: .45; }
.pv { height: 190px; margin-bottom: 8px; }
.gz.on { border-color: #b8962a; } .gz.on legend { color: #ffd23a; }
.gdot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; border: 2px solid var(--text-3); margin-left: 4px; vertical-align: -1px; }
.gz.on .gdot { border-color: #ffd23a; background: rgba(255, 210, 58, .3); }
.route { margin-top: 8px; }
.cmds { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.ttl { padding: 7px 12px; display: flex; align-items: center; gap: 10px; background: var(--editor-chrome); color: var(--text); font-weight: 600; }
.ttl span { color: var(--text-3); font-weight: 400; }
.bar { display: flex; gap: 4px; padding: 7px 10px; border-bottom: 1px solid var(--hair); flex-wrap: wrap; align-items: center; }
.list { flex: 1; overflow: auto; background: var(--g-900); outline: none; padding: 6px 5px 28px; font-size: 12.5px; }
.r { display: flex; align-items: center; gap: 8px; min-height: 26px; border-radius: 3px; padding-right: 10px; white-space: nowrap; border-left: 2px solid transparent; }
.r.cmd { cursor: default; } .r.cmd:hover { background: var(--g-850); }
.r.on { background: var(--editor-selection); border-left-color: var(--blue-hi); }
.dot { width: 7px; height: 7px; border-radius: 2px; flex: none; }
.sum { color: var(--text-2); overflow: hidden; text-overflow: ellipsis; }
.r.blk, .r.end { color: var(--text-3); font-size: 11.5px; min-height: 20px; }
.r.ins { color: var(--text-3); cursor: pointer; opacity: .7; } .r.ins:hover { opacity: 1; background: var(--g-850); }
.r.ins span { font-size: 11px; }
.dlg-body { padding: 14px 16px; }
/* Solo el formulario de comandos: etiquetas a la izquierda y controles con espacio para trabajar. */
.cmd-dlg :deep(.pf > .row:not(.t-code):not(.t-route):not(.t-list)) { grid-template-columns: minmax(135px, 165px) minmax(0, 1fr); }
.cmd-dlg :deep(.pf > .row.t-matchcases:not(.t-code):not(.t-route):not(.t-list)) { grid-template-columns: 1fr; }
.cmd-dlg :deep(.pf > .row > label) { white-space: normal; overflow: visible; text-overflow: clip; }
@container win (max-width: 590px) {
  .cmd-dlg :deep(.pf > .row:not(.t-code):not(.t-route):not(.t-list)) { grid-template-columns: minmax(0, 1fr); gap: 4px; }
}

.command-search { display: flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 8px; margin-bottom: 12px; border: 1px solid var(--hair); border-radius: 4px; background: var(--g-950); }
.command-search:focus-within { border-color: var(--blue-hi); }
.command-search img { width: 20px; height: 20px; }
.command-search input { width: 100%; background: transparent; border: 0; outline: none; padding: 0; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 190px), 1fr)); gap: 10px; }
.ptabs { display: flex; gap: 2px; margin: 0 0 12px; border-bottom: 1px solid var(--hair); }
.ptabs button { height: 28px; padding: 0 14px; border: 1px solid transparent; border-bottom: none; border-radius: 5px 5px 0 0; background: transparent; color: var(--text-3); }
.ptabs button:hover { color: var(--text-2); background: var(--g-850); }
.ptabs button.on { background: var(--g-800); border-color: var(--hair); color: var(--text); box-shadow: inset 0 2px 0 var(--blue); }
.grid { align-content: start; }
.grp { min-width: 0; display: flex; flex-direction: column; align-self: start; border: 1px solid var(--hair-soft); border-radius: 5px; overflow: hidden; }
.grp header { display: flex; align-items: center; gap: 7px; font-weight: 600; padding: 8px; background: var(--g-800); }
.grp button { height: auto; min-height: 30px; justify-content: space-between; text-align: left; border: 0; border-radius: 0; background: var(--g-900); }
.grp button + button { border-top: 1px solid var(--hair-soft); }
.grp button:hover, .grp button:focus-visible { background: var(--blue-wash); }
.grp button svg { flex: none; color: var(--text-3); }
@container event-editor (max-width: 880px) {
  .main { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); overflow: auto; }
  .main > .col { width: auto; max-height: 280px; }
  .main > .cmds { grid-column: 1 / -1; min-height: 260px; }
}
@container event-editor (max-width: 540px) {
  .main { display: flex; flex-direction: column; }
  .tabs { overflow: auto; }
  h2 .nm { width: 100%; min-width: 70px; }
}
.hint { margin: 6px 0 0; font-size: 11px; color: var(--text-3); line-height: 1.45; }
.model-slot { display: flex; flex-direction: column; gap: 5px; border: 1px dashed var(--g-600); border-radius: 6px; margin-top: 8px; padding: 9px; background: var(--g-900); text-align: center; overflow-wrap: anywhere; }
.model-slot.hover { border-color: var(--blue); background: var(--blue-wash); }
.model-slot.busy { opacity: .7; }
.model-slot > b { color: var(--text-2); font-size: 12px; }
.slot-info { font-size: 12px; color: var(--text-1); }
.slot-hint { font-size: 10.5px; color: var(--text-3); line-height: 1.35; }
</style>
