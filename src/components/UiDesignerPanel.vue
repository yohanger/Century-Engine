<script setup>
// Panel del diseñador de interfaces: caja de herramientas, lista de controles y propiedades/eventos del control seleccionado.
// El lienzo es la vista previa de la derecha (UiDesignOverlay); aquí no hay HTML.
import { computed, ref } from 'vue'
import { store, loc, locAddEntry, openLocalization } from '../core/store.js'
import { slug as locSlug } from '../engine/runtime/i18n/localization.js'
import { CONTROLS, CONTROL_TYPES, CONTROL_GROUPS, UI_TOOL_DRAG, FORM_KINDS, ENTER_ANIMS, EXIT_ANIMS, SCALE_MODES, propsOf, childrenOf, descendantsOf, byId, handlerName, cssSelectors } from '../engine/runtime/ui/design.js'
import { PRESETS_BY_KIND } from '../engine/runtime/ui/dialog-presets.js'
import { parsePortraitMap } from '../engine/runtime/ui/components.js'
import { askConfirm } from '../core/dialogs.js'
import { AUDIO_EXT } from '../engine/runtime/audio/config.js'
import ResourceDropSlot from './ResourceDropSlot.vue'

const props = defineProps({ D: { type: Object, required: true }, section: { type: String, default: 'all' } })
const D = props.D
const dz = D.dz
// La paleta/jerarquía y el Inspector comparten el estado existente del diseñador; no duplican los datos .ui.
const emit = defineEmits(['css'])
// clave de localización de un control: sugerencias y «＋» crea ui.<interfaz>.<control> con su texto
const locEntries = computed(() => loc().entries)
const locBase = computed(() => loc().base)
function newLocKey() {
  const c = sel.value
  if (!c) return
  const doc = (store.project.uis || []).find((u) => u.id === store.uiEditId)
  const text = c.type === 'textbox' ? c.placeholder : c.text
  const base = `ui.${locSlug(String(doc?.name || 'ui').replace(/\.ui$/, ''))}.${locSlug(c.name)}`
  let key = base, i = 2
  while (loc().entries.some((e) => e.key === key)) key = `${base}_${i++}`
  if (locAddEntry(key, text || '', { note: `Interfaz ${doc?.name || ''} · ${c.name}` })) D.setProp(c.id, 'locKey', key)
}
/** Clic derecho en un selector de «Reglas en Estilo»: ir a la regla o quitar ese ID / esa clase del control (el Nombre no se quita). */
function chipMenu(e, q) {
  const c = sel.value
  if (!c) return
  const isName = q === '.' + c.name, isId = q.startsWith('#')
  const remove = () => {
    if (isId) D.setProp(c.id, 'cssId', '')
    else D.setProp(c.id, 'cssClass', String(c.cssClass || '').split(' ').filter((k) => k && '.' + k !== q).join(' '))
  }
  store.menu = { x: e.clientX, y: e.clientY, items: [
    { label: `Ir a ${q} en Estilo`, icon: 'script', run: () => emit('css', q) },
    { sep: true },
    isName ? { label: 'Eliminar (es el Nombre del control)', icon: 'trash', disabled: true } : { label: isId ? 'Eliminar el ID' : `Eliminar la clase ${q.slice(1)}`, icon: 'trash', danger: true, run: remove },
  ] }
}
const sel = computed(() => (dz.design && dz.sel ? byId(dz.design, dz.sel) : null))
// propiedades obsoletas (animación por pieza): solo en los diseños que ya las usan
const schema = computed(() => (sel.value ? propsOf(sel.value.type).filter((p) => !p.deprecated || (sel.value.fxIn && sel.value.fxIn !== 'none') || (sel.value.fxOut && sel.value.fxOut !== 'none')) : []))
const cats = computed(() => {
  const out = []
  for (const p of schema.value) { let g = out.find((x) => x[0] === p.cat); if (!g) out.push((g = [p.cat, []])); g[1].push(p) }
  const order = ['Diseño', 'Apariencia', 'Comportamiento', 'Sonido', 'Animación']
  return out.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
})
const events = computed(() => (sel.value ? CONTROLS[sel.value.type].events : []))
const textures = computed(() => (store.project.assets || []).filter((a) => a.kind === 'texture'))
const audios = computed(() => (store.project.assets || []).filter((a) => (a.kind === 'audio' || a.kind === 'file') && AUDIO_EXT.includes(String(a.ext || a.name.split('.').pop()).toLowerCase())))
const byNameFrom = (list, id) => list.find(a => a.id === id)?.name || null
const assignUiAsset = (p, id, list) => { const name = byNameFrom(list, id); if (name && sel.value) D.setProp(sel.value.id, p.key, name) }
const assignPortrait = (i, id) => { const name = byNameFrom(textures.value, id); if (name) portraitEdit(i, 'img', name) }
const kind = computed(() => dz.design?.form.kind || '')
/** Grupos de la caja de herramientas; con una pantalla de diálogo/opciones/indicación, sus controles van primero. */
const groups = computed(() => {
  const g = CONTROL_GROUPS.map(([k, label]) => ({ k, label, types: CONTROL_TYPES.filter((t) => CONTROLS[t].group === k) }))
  return kind.value ? [...g].reverse() : g
})
const presets = computed(() => PRESETS_BY_KIND[kind.value] || null)
async function applyPreset(key) {
  if (!key) return
  const p = presets.value[key]
  if (dz.design?.controls.length && !(await askConfirm(`¿Sustituir el diseño por la plantilla «${p.label}»? El Script y el Estilo se conservan.`, { title: 'Aplicar plantilla', danger: true }))) return
  D.applyPreset(kind.value, key)
}

// ---- editor de retratos: filas personaje / expresión / imagen ↔ «Ana=ana.png; Ana:triste=ana_triste.png; *=nadie.png»
const portraitRows = (s) => [...parsePortraitMap(s)].map(([k, img]) => { const [who, face = ''] = k.split(':'); return { who: who === '*' ? '*' : who, face, img } })
function setPortraits(rows) {
  const txt = rows.filter((r) => r.who && r.img).map((r) => `${r.who}${r.face ? ':' + r.face : ''}=${r.img}`).join('; ')
  D.setProp(sel.value.id, 'map', txt)
}
function portraitEdit(i, k, v) { const rows = portraitRows(sel.value.map); rows[i][k] = String(v).trim(); setPortraits(rows) }
function portraitAdd() { const rows = portraitRows(sel.value.map); rows.push({ who: 'Personaje' + (rows.length + 1), face: '', img: textures.value[0]?.name || '' }); setPortraits(rows) }
function portraitDel(i) { const rows = portraitRows(sel.value.map); rows.splice(i, 1); setPortraits(rows) }

// lista de controles (árbol)
const rows = computed(() => {
  const out = []
  if (!dz.design) return out
  const walk = (pid, depth) => { for (const c of childrenOf(dz.design, pid)) { out.push({ c, depth }); walk(c.id, depth + 1) } }
  walk(null, 0)
  return out
})
const filter = ref('')
// Búsqueda visual de herramientas; el catálogo y las operaciones siguen siendo los originales.
const toolFilter = ref('')
const normalizeSearch = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
const visibleGroups = computed(() => {
  const q = normalizeSearch(toolFilter.value.trim())
  return groups.value.map(g => ({ ...g, types: q
    ? g.types.filter(t => normalizeSearch(CONTROLS[t].label + ' ' + g.label).includes(q))
    : g.types })).filter(g => g.types.length)
})
const visibleRows = computed(() => {
  const q = filter.value.trim().toLocaleLowerCase()
  if (!q) return rows.value
  return rows.value.filter(({ c }) => (c.name + ' ' + CONTROLS[c.type].label).toLocaleLowerCase().includes(q))
})
const parentChoices = computed(() => {
  if (!sel.value || !dz.design) return []
  const forbidden = new Set([sel.value.id, ...descendantsOf(dz.design, sel.value.id).map(c => c.id)])
  return dz.design.controls.filter(c => CONTROLS[c.type].container && !forbidden.has(c.id))
})
const dragging = ref(null)
const dropTarget = ref(null)
const UI_DRAG = 'application/x-lf-ui-control'
function startToolDrag(event, type) {
  const transfer = event.dataTransfer
  if (!transfer) return
  transfer.effectAllowed = 'copy'
  transfer.setData(UI_TOOL_DRAG, type)
}
function onStart(e, c) {
  if (!e.dataTransfer) return
  dragging.value = c.id
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData(UI_DRAG, c.id)
}
function mayDrop(id, parentId) {
  const d = dz.design
  const c = d && byId(d, id)
  const p = parentId && byId(d, parentId)
  return !!c && c.id !== parentId && (c.parent || null) !== parentId &&
    (!parentId || (p && CONTROLS[p.type].container)) &&
    !descendantsOf(d, c.id).some(x => x.id === parentId)
}
function onDragOver(e, parentId) {
  const id = dragging.value
  if (!id) return
  e.stopPropagation()
  if (!mayDrop(id, parentId)) { dropTarget.value = null; return }
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  dropTarget.value = parentId || 'root'
}
function onDrop(e, parentId) {
  const id = e.dataTransfer?.getData(UI_DRAG)
  if (!id) return
  e.preventDefault()
  e.stopPropagation()
  if (mayDrop(id, parentId)) D.moveToParent(id, parentId)
  dragging.value = null
  dropTarget.value = null
}
function onEnd() { dragging.value = null; dropTarget.value = null }

const RES = [[1920, 1080], [1280, 720], [1366, 768], [1024, 768], [2560, 1080], [844, 390]]
const resKey = computed(() => `${dz.design?.form.w}x${dz.design?.form.h}`)
const setRes = (v) => { const [w, h] = v.split('x').map(Number); D.setForm('w', w); D.setForm('h', h) }

const PRESETS = [['', '— acción —'], ['close()', 'Cerrar pantalla'], ['close(true)', 'Cerrar y devolver true'], ["ui.open('nombre')", 'Abrir otra pantalla'], ["game.variable('Variable', 1)", 'Poner una variable']]
const anchorOn = (i) => !!sel.value?.anchor[i]
const toggleAnchor = (i) => { const a = [...sel.value.anchor]; a[i] = !a[i]; D.setProp(sel.value.id, 'anchor', a) }
const isCol = (v) => /^#[0-9a-f]{6}$/i.test(v || '')
const val = (p) => sel.value[p.key]
const evHandler = (c, k) => handlerName(c, k)
</script>

<template>
  <div class="dsg">
    <div v-if="section !== 'inspector' && dz.legacy" class="note">
      <b>Esta plantilla está escrita en HTML.</b>
      <p>El diseñador trabaja con controles (como Windows Forms). Si empiezas un diseño nuevo, <u>se reemplaza</u> el HTML de la plantilla; el Script y el Estilo se conservan. Puedes seguir editando el HTML en la vista «HTML».</p>
      <button class="primary" @click="D.startNew()">Empezar un diseño nuevo</button>
    </div>
    <div v-else-if="section !== 'inspector' && dz.stale" class="note warn">
      <b>La plantilla se editó a mano.</b>
      <p class="lf-help">El diseñador la volvería a generar y perdería esos cambios.</p>
      <div class="two"><button class="primary" @click="D.regenerate()">Regenerar desde el diseño</button><button @click="D.detach()">Quedarme con el HTML</button></div>
    </div>

    <template v-else>
      <section v-if="section !== 'inspector'" class="box tools-pane" data-pane="tools">
        <header>Caja de herramientas <span class="dim lf-help">Arrastra al Canvas</span></header>
        <div class="tool-search"><input v-model="toolFilter" type="search" placeholder="Buscar herramienta…" aria-label="Buscar herramienta de interfaz" /><span class="dim">{{ CONTROL_TYPES.length }}</span></div>
        <details v-for="g in visibleGroups" :key="g.k + (toolFilter ? '-filter' : '')" class="tool-group" open>
          <summary>{{ g.label }} <span class="dim">{{ g.types.length }}</span></summary>
          <div class="tools">
            <button v-for="t in g.types" :key="t" :class="{ on: dz.tool === t, dlg: g.k === 'dialog' }" :aria-pressed="dz.tool === t" :aria-label="'Herramienta ' + CONTROLS[t].label" :data-tool="t" :data-tooltip="CONTROLS[t].label + ' — arrastra al lienzo o selecciona para dibujar'" draggable="true" @dragstart="startToolDrag($event, t)" @click="D.setTool(t)" @dblclick="D.addDefault(t)">
              <i aria-hidden="true">{{ CONTROLS[t].icon }}</i><span>{{ CONTROLS[t].label }}</span>
            </button>
          </div>
        </details>
        <p v-if="!visibleGroups.length" class="tool-empty">No hay herramientas con ese nombre.</p>
        <div class="tool-note">Arrastra para colocar · Doble clic para añadir</div>
      </section>

      <div v-if="section !== 'inspector'" class="pane">
      <section class="win list" data-dock="controls" data-pane="list">
        <header>Jerarquía <span class="dim">{{ dz.design?.controls.length || 0 }}</span></header>
        <div class="filter"><input v-model="filter" type="search" placeholder="Buscar control…" aria-label="Buscar controles en la jerarquía" /></div>
        <div class="wtools"><span class="dim">{{ dz.design?.controls.length || 0 }} controles</span><span class="grow"></span>
          <button class="ic" :disabled="!sel" data-tooltip="Traer al frente" @click="D.front()">⤒</button>
          <button class="ic" :disabled="!sel" data-tooltip="Enviar al fondo" @click="D.back()">⤓</button>
          <button class="ic" :disabled="!sel" data-tooltip="Duplicar (Ctrl+D)" @click="D.duplicate()">⧉</button>
          <button class="ic danger" :disabled="!sel" data-tooltip="Eliminar (Supr)" @click="D.remove()">✕</button>
        </div>
        <ul role="tree" aria-label="Controles del formulario">
          <li role="treeitem" tabindex="0" :aria-selected="!sel" @keydown.enter.prevent="D.select(null)" @keydown.space.prevent="D.select(null)" :class="{ on: !sel, 'drop-target': dropTarget === 'root' }" @click="D.select(null)" @dragover="onDragOver($event, null)" @drop="onDrop($event, null)"><span class="ty">▭</span> Formulario <span class="dim">{{ dz.design?.form.w }}×{{ dz.design?.form.h }}</span></li>
          <li v-for="{ c, depth } in visibleRows" :key="c.id" role="treeitem" tabindex="0" :aria-level="depth + 2" :aria-selected="dz.sel === c.id" @keydown.enter.prevent="D.select(c.id)" @keydown.space.prevent="D.select(c.id)" :class="{ on: dz.sel === c.id, 'drop-target': dropTarget === c.id }" :style="{ paddingLeft: 8 + (depth + 1) * 14 + 'px' }" :draggable="true" @click="D.select(c.id)" @dragstart="onStart($event, c)" @dragend="onEnd" @dragover="onDragOver($event, c.id)" @dragleave="dropTarget = null" @drop="onDrop($event, c.id)">
            <span class="ty" aria-hidden="true">{{ CONTROLS[c.type].icon }}</span><span class="tree-name">{{ c.name }}</span><span class="tree-kind">{{ CONTROLS[c.type].label }}</span>
          </li>
          <li v-if="!rows.length" class="empty lf-help">Aún no hay controles. Elige uno arriba y dibújalo en la vista previa.</li>
          <li v-else-if="!visibleRows.length" class="empty lf-help">No hay controles con ese nombre.</li>
        </ul>
      </section>
      </div>
      <section v-if="section === 'inspector' || section === 'all'" class="win props" data-dock="props" data-pane="props">
        <header class="ph">Inspector <span class="dim">Propiedades</span></header>
        <div class="selection-summary" data-testid="ui-inspector-selection">
          <span class="selection-icon" aria-hidden="true">{{ sel ? CONTROLS[sel.type].icon : '▭' }}</span>
          <span class="selection-info"><strong>{{ sel ? sel.name : 'Formulario' }}</strong><small>{{ sel ? CONTROLS[sel.type].label : 'Propiedades de la pantalla' }}</small></span>
        </div>
        <div v-if="!sel" class="grid">
          <div class="cat">Pantalla</div>
          <label data-tooltip="La vista previa simula ese estado y la caja de herramientas pone sus controles primero">Tipo</label>
          <div class="ctl"><select :value="kind" data-testid="form-kind" @change="D.setForm('kind', $event.target.value)"><option v-for="[k, l] in FORM_KINDS" :key="k" :value="k">{{ l }}</option></select></div>
          <template v-if="presets">
            <label data-tooltip="Sustituye el diseño por una plantilla lista para usar">Plantilla</label>
            <div class="ctl"><select value="" data-testid="form-preset" @change="applyPreset($event.target.value); $event.target.value = ''"><option value="">— aplicar plantilla —</option><option v-for="(p, k) in presets" :key="k" :value="k" :data-tooltip="p.desc">{{ p.label }}</option></select></div>
          </template>
          <label data-tooltip="Cómo aparece la pantalla">Animación de entrada</label>
          <div class="ctl"><select :value="dz.design?.form.enter || 'none'" @change="D.setForm('enter', $event.target.value)"><option v-for="[k, l] in ENTER_ANIMS" :key="k" :value="k">{{ l }}</option></select></div>
          <template v-if="dz.design?.form.enter && dz.design.form.enter !== 'none'"><label>Duración (ms)</label><div class="ctl"><input type="number" :value="dz.design.form.enterMs" min="0" max="3000" step="10" @change="D.setForm('enterMs', $event.target.value)" /></div></template>
          <label data-tooltip="Cómo desaparece. En un diálogo solo al terminar la conversación (entre frases el cuadro se queda)">Animación de salida</label>
          <div class="ctl"><select :value="dz.design?.form.exit || 'none'" data-testid="form-exit" @change="D.setForm('exit', $event.target.value)"><option v-for="[k, l] in EXIT_ANIMS" :key="k" :value="k">{{ l }}</option></select></div>
          <template v-if="dz.design?.form.exit && dz.design.form.exit !== 'none'"><label>Duración (ms)</label><div class="ctl"><input type="number" :value="dz.design.form.exitMs" min="0" max="3000" step="10" @change="D.setForm('exitMs', $event.target.value)" /></div></template>
          <div class="cat">Formulario</div>
          <label data-tooltip="Escalar con la pantalla: se diseña a esta resolución y en el juego se escala al tamaño de la ventana (el anclaje decide qué se estira)">Escalado</label>
          <div class="ctl"><select :value="dz.design?.form.scale || 'none'" @change="D.setForm('scale', $event.target.value)"><option v-for="[k, l] in SCALE_MODES" :key="k" :value="k">{{ l }}</option></select></div>
          <label>Resolución de diseño</label>
          <div class="ctl"><select :value="resKey" @change="setRes($event.target.value)"><option v-for="[w, h] in RES" :key="w + 'x' + h" :value="w + 'x' + h">{{ w }}×{{ h }}</option><option v-if="!RES.some(([w, h]) => w + 'x' + h === resKey)" :value="resKey">{{ resKey }}</option></select></div>
          <label>Ancho</label><div class="ctl"><input type="number" :value="dz.design?.form.w" min="100" @change="D.setForm('w', $event.target.value)" /></div>
          <label>Alto</label><div class="ctl"><input type="number" :value="dz.design?.form.h" min="100" @change="D.setForm('h', $event.target.value)" /></div>
          <label>Fondo</label>
          <div class="ctl"><ColorInput :value="isCol(dz.design?.form.back) ? dz.design.form.back : '#000000'" @input="D.setForm('back', $event.target.value)" /><button class="mini" :disabled="!dz.design?.form.back" data-tooltip="Sin fondo" @click="D.setForm('back', '')">×</button></div>
          <div class="cat">Cuadrícula</div>
          <label>Ajustar a la cuadrícula</label><div class="ctl"><input type="checkbox" v-model="dz.snap" /></div>
          <label>Tamaño (px)</label><div class="ctl"><input type="number" v-model.number="dz.grid" min="1" max="64" /></div>
          <p class="hint lf-help">Selecciona un control en la lista o en la vista previa para ver sus propiedades. Cambia la resolución de la vista previa para comprobar el <b>Anclaje</b>.</p>
        </div>

        <div v-else class="grid">
          <div class="cat">Jerarquía</div>
          <label data-tooltip="Mover el control a otro contenedor sin cambiar su posición en pantalla">Contenedor</label>
          <div class="ctl"><select :value="sel.parent || ''" data-testid="ui-parent" @change="D.moveToParent(sel.id, $event.target.value || null)"><option value="">Formulario</option><option v-for="c in parentChoices" :key="c.id" :value="c.id">{{ c.name }}</option></select></div>
          <template v-for="[cat, list] in cats" :key="cat">
            <div class="cat">{{ cat }}</div>
            <template v-for="p in list" :key="p.key">
              <label :data-tooltip="p.hint || ''">{{ p.label }}</label>
              <div class="ctl">
                <template v-if="p.type === 'anchor'">
                  <div class="anc" data-tooltip="Anclaje: bordes a los que se pega el control">
                    <button class="t" :class="{ on: anchorOn(1) }" @click="toggleAnchor(1)">▲</button>
                    <button class="l" :class="{ on: anchorOn(0) }" @click="toggleAnchor(0)">◀</button>
                    <span class="m"></span>
                    <button class="r" :class="{ on: anchorOn(2) }" @click="toggleAnchor(2)">▶</button>
                    <button class="b" :class="{ on: anchorOn(3) }" @click="toggleAnchor(3)">▼</button>
                  </div>
                </template>
                <input v-else-if="p.type === 'number'" type="number" :value="val(p)" :step="p.step || 1" :min="p.min" :max="p.max" @change="D.setProp(sel.id, p.key, $event.target.value)" />
                <input v-else-if="p.type === 'bool'" type="checkbox" :checked="val(p)" @change="D.setProp(sel.id, p.key, $event.target.checked)" />
                <template v-else-if="p.type === 'color'">
                  <ColorInput :value="isCol(val(p)) ? val(p) : '#808080'" @input="D.setProp(sel.id, p.key, $event.target.value)" />
                  <span v-if="!isCol(val(p))" class="dim">tema</span><button v-else class="mini" data-tooltip="Volver al color del tema" @click="D.setProp(sel.id, p.key, '')">×</button>
                </template>
                <select v-else-if="p.type === 'select'" :value="val(p)" @change="D.setProp(sel.id, p.key, $event.target.value)"><option v-for="[v, l] in p.options" :key="v" :value="v">{{ l }}</option></select>
                <ResourceDropSlot v-else-if="p.type === 'audio'" :kinds="['audio', 'file']" :accepted-ids="audios.map(a => a.id)" @assign="assignUiAsset(p, $event, audios)">
                  <select :value="val(p)" @change="D.setProp(sel.id, p.key, $event.target.value)"><option value="">— ninguno —</option><option v-for="a in audios" :key="a.id" :value="a.name">{{ a.name }}</option><option v-if="val(p) && !audios.some((a) => a.name === val(p))" :value="val(p)">{{ val(p) }} (falta)</option></select>
                </ResourceDropSlot>
                <div v-else-if="p.type === 'portraits'" class="pmap">
                  <div v-for="(r, i) in portraitRows(val(p))" :key="i" class="prow">
                    <input :value="r.who" placeholder="Personaje (* = resto)" data-tooltip="Nombre de quien habla (como en «Quién habla»); * = cualquier otro" @change="portraitEdit(i, 'who', $event.target.value)" />
                    <input :value="r.face" placeholder="expresión" data-tooltip="Opcional: \F[expresión] en el texto la elige" @change="portraitEdit(i, 'face', $event.target.value)" />
                    <ResourceDropSlot :kinds="['texture']" :accepted-ids="textures.map(a => a.id)" @assign="assignPortrait(i, $event)">
                      <select :value="r.img" @change="portraitEdit(i, 'img', $event.target.value)"><option v-for="a in textures" :key="a.id" :value="a.name">{{ a.name }}</option><option v-if="r.img && !textures.some((a) => a.name === r.img)" :value="r.img">{{ r.img }} (falta)</option></select>
                    </ResourceDropSlot>
                    <button class="mini" data-tooltip="Quitar" @click="portraitDel(i)">×</button>
                  </div>
                  <button class="add" :disabled="!textures.length" :data-tooltip="textures.length ? '' : 'Importa imágenes en Assets/Textures'" @click="portraitAdd">＋ Retrato</button>
                  <p class="phint lf-help">Sin filas, se usa el retrato del personaje en la Base de datos.</p>
                </div>
                <ResourceDropSlot v-else-if="p.type === 'asset'" :kinds="['texture']" :accepted-ids="textures.map(a => a.id)" @assign="assignUiAsset(p, $event, textures)">
                  <select :value="val(p)" @change="D.setProp(sel.id, p.key, $event.target.value)"><option value="">— ninguna —</option><option v-for="a in textures" :key="a.id" :value="a.name">{{ a.name }}</option><option v-if="val(p) && !textures.some((a) => a.name === val(p))" :value="val(p)">{{ val(p) }} (falta)</option></select>
                </ResourceDropSlot>
                <template v-else-if="p.type === 'lockey'">
                  <input type="text" :value="val(p)" list="lf-lockeys" :placeholder="p.placeholder" spellcheck="false" data-testid="ctl-lockey" @change="D.setProp(sel.id, p.key, $event.target.value.trim())" @keydown.enter="$event.target.blur()" />
                  <datalist id="lf-lockeys"><option v-for="e in locEntries" :key="e.key" :value="e.key">{{ e.text[locBase] }}</option></datalist>
                  <button v-if="!val(p)" class="mini" data-testid="ctl-lockey-new" aria-label="Crear la clave con este texto" @click="newLocKey">＋</button>
                  <button v-else class="mini" aria-label="Abrir en Localización" @click="openLocalization(val(p))">🌐</button>
                </template>
                <div v-else-if="p.type === 'cssref'" class="cssref" data-testid="css-selectors">
                  <button v-for="q in cssSelectors(sel)" :key="q" :data-sel="q" @click="emit('css', q)" @contextmenu.prevent="chipMenu($event, q)">{{ q }} { }</button>
                </div>
                <input v-else :type="'text'" :value="val(p)" :placeholder="p.placeholder || (p.type === 'expr' ? 'expresión' : p.type === 'bind' ? 'nombre de variable' : '')" spellcheck="false" @change="D.setProp(sel.id, p.key, $event.target.value)" @keydown.enter="$event.target.blur()" />
              </div>
            </template>
          </template>

          <template v-if="events.length">
            <div class="cat">Eventos</div>
            <template v-for="[k, label] in events" :key="k">
              <label :data-tooltip="'Se ejecuta en ' + label">{{ label }}</label>
              <div class="ctl ev">
                <input type="text" :value="sel.events[k] || ''" placeholder="close() · función · expresión" spellcheck="false" @change="D.setEvent(sel.id, k, $event.target.value)" @keydown.enter="$event.target.blur()" />
                <select class="pre" value="" data-tooltip="Acciones frecuentes" @change="D.setEvent(sel.id, k, $event.target.value); $event.target.value = ''"><option v-for="[v, l] in PRESETS" :key="v" :value="v">{{ l }}</option></select>
                <button class="mini fn" :data-tooltip="'Crea la función ' + evHandler(sel, k) + ' en el Script y salta a ella'" @click="D.createHandler(sel.id, k)">ƒ</button>
              </div>
            </template>
          </template>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dsg { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; background: var(--g-850); }
.filter { padding: 5px 8px; border-bottom: 1px solid var(--g-700); }
.filter input { width: 100%; min-width: 0; height: 26px; font-size: 11px; }
.win.props header { position: static; }
.dim { color: var(--text-3); font-weight: 400; font-size: 11px; }
.grow { flex: 1; }
.note { margin: 12px; padding: 12px 14px; background: var(--g-800); border: 1px solid var(--g-600); border-radius: 6px; line-height: 1.5; font-size: 12px; }
.note p { margin: 6px 0 10px; color: var(--text-2); } .note.warn { border-color: #b8873a; } .two { display: flex; gap: 8px; flex-wrap: wrap; }
.box { border-bottom: 1px solid #000; flex: none; }
.box.props { flex: 1; min-height: 0; overflow: auto; }
.pane { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.tools-pane { flex: 0 1 auto; min-height: 0; max-height: 49%; overflow: auto; }
.win { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.win.props { overflow: auto; }
.win.list ul { max-height: none; flex: 1; min-height: 0; }
.wtools { display: flex; align-items: center; gap: 4px; height: 26px; padding: 0 8px; border-bottom: 1px solid var(--g-700); flex: none; }
.ph { display: flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--text-2); background: var(--g-800); position: sticky; top: 0; z-index: 2; flex: none; }
.cssref { display: flex; flex-wrap: wrap; gap: 4px; }
.cssref button { height: 20px; padding: 0 7px; font: 11px var(--mono, ui-monospace, monospace); color: var(--blue-hi); }
.note { overflow: auto; }
.box header { display: flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--text-2); background: var(--g-800); position: sticky; top: 0; z-index: 2; }
.box.list header, .box:first-child header { position: static; }
.tgroup { padding: 6px 10px 0; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--text-3); }
.tools button.dlg i { color: #e0a43a; }
.pmap { display: flex; flex-direction: column; gap: 4px; width: 100%; }
.prow { display: grid; grid-template-columns: 1fr .8fr 1fr 20px; gap: 3px; }
.prow input, .prow select { min-width: 0; height: 22px; font-size: 11.5px; }
.pmap .add { height: 22px; font-size: 11.5px; align-self: flex-start; padding: 0 8px; }
.phint { margin: 0; font-size: 10.5px; color: var(--text-3); }
.tools { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 8px; }
.tools button { height: 46px; flex-direction: column; gap: 1px; padding: 2px; font-size: 10px; line-height: 1.1; white-space: normal; }
.tools button i { font-style: normal; font-size: 16px; line-height: 1; } .tools button.on { background: var(--blue); border-color: var(--blue); color: #fff; }
.list ul { list-style: none; margin: 0; padding: 4px 0; max-height: none; overflow: auto; }
.list li { display: flex; align-items: center; gap: 6px; height: 22px; padding-right: 8px; cursor: pointer; color: var(--text-2); white-space: nowrap; }
.list li.drop-target { background: var(--blue-wash); outline: 1px solid var(--blue); } .list li:hover { background: var(--g-800); } .list li.on { background: var(--blue-wash); color: var(--text); box-shadow: inset 2px 0 0 var(--blue); }
.list li.empty { height: auto; padding: 8px 12px; white-space: normal; color: var(--text-3); cursor: default; line-height: 1.4; }
.ty { width: 16px; text-align: center; color: var(--text-3); flex: none; }
.ic { width: 22px; height: 20px; padding: 0; border: none; background: transparent; color: var(--text-2); font-size: 13px; } .ic:hover:not(:disabled) { background: var(--g-600); color: var(--text); } .ic.danger:hover:not(:disabled) { color: #ff6b5e; }
.grid { display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 4px 8px; padding: 6px 10px 12px; align-items: center; }
.grid label { font-size: 11px; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cat { grid-column: 1 / -1; margin-top: 8px; padding-bottom: 2px; border-bottom: 1px solid var(--g-700); font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--text-3); }
.ctl { display: flex; align-items: center; gap: 4px; min-width: 0; }
.ctl input[type=text], .ctl input[type=number], .ctl select { flex: 1; min-width: 0; height: 22px; font-size: 12px; }
.ctl  :deep(.lf-color-input) { width: 34px; height: 22px; padding: 1px; flex: none; }
.mini { width: 20px; height: 20px; padding: 0; flex: none; font-size: 12px; } .mini.fn { font-style: italic; font-family: serif; font-weight: 700; color: var(--blue-hi); }
.ev .pre { flex: none; width: 24px; padding: 0; color: transparent; } .ev .pre option { color: #ddd; background: #222; }
.anc { display: grid; grid-template-columns: repeat(3, 22px); grid-template-rows: repeat(3, 20px); gap: 2px; }
.anc button { width: 22px; height: 20px; padding: 0; font-size: 9px; color: var(--text-3); } .anc button.on { background: var(--blue); border-color: var(--blue); color: #fff; }
.anc .t { grid-column: 2; grid-row: 1; } .anc .l { grid-column: 1; grid-row: 2; } .anc .m { grid-column: 2; grid-row: 2; border: 1px solid var(--g-600); border-radius: 3px; } .anc .r { grid-column: 3; grid-row: 2; } .anc .b { grid-column: 2; grid-row: 3; }
.hint { grid-column: 1 / -1; margin: 8px 0 0; font-size: 11px; color: var(--text-3); line-height: 1.45; }

/* Lenguaje visual del Editor: grupos legibles, sin catálogo paralelo ni estados de proyecto. */
.dsg { background: var(--g-900, #141414); color: var(--text); }
.tool-search { display: flex; align-items: center; gap: 8px; padding: 8px; border-bottom: 1px solid var(--g-700); background: var(--g-850); }
.tool-search input { flex: 1; min-width: 0; height: 28px; font-size: 11.5px; }
.tool-search .dim { font-variant-numeric: tabular-nums; }
.tool-group { border-bottom: 1px solid var(--g-700); }
.tool-group summary { display: flex; align-items: center; gap: 7px; padding: 8px 11px; cursor: pointer; user-select: none; font-size: 11px; font-weight: 650; color: var(--text-2); background: var(--g-850); }
.tool-group summary::before { content: '▾'; font-size: 10px; color: var(--text-3); }
.tool-group:not([open]) summary::before { content: '▸'; }
.tool-group summary .dim { margin-left: auto; }
.tool-group summary:hover, .tool-group summary:focus-visible { background: var(--g-800); color: var(--text); }
.tool-group .tools { padding: 8px; gap: 5px; }
.tool-group .tools button { height: 51px; border: 1px solid var(--g-700); background: var(--g-850); border-radius: 4px; }
.tool-group .tools button:hover { background: var(--g-750, #292929); border-color: var(--g-600); }
.tool-group .tools button.on { background: var(--g-700); color: var(--text); border-color: var(--amber); box-shadow: inset 0 -2px var(--amber); }
.tool-group .tools button:focus-visible, .list li:focus-visible, .grid :is(input, select, button):focus-visible { outline: 2px solid var(--amber); outline-offset: -2px; }
.tool-note { padding: 8px 10px; border-top: 1px solid var(--g-700); font-size: 10.5px; color: var(--text-3); line-height: 1.4; }
.tool-empty { margin: 12px; color: var(--text-2); font-size: 11px; }
.win.list header, .win.props .ph { min-height: 32px; height: auto; color: var(--text); background: var(--g-800); border-bottom: 1px solid var(--g-700); }
.list li { min-height: 28px; height: auto; gap: 7px; padding-top: 3px; padding-bottom: 3px; }
.list li.on { background: var(--g-700); box-shadow: inset 2px 0 var(--amber); }
.list li.drop-target { background: var(--g-700); outline: 1px solid var(--amber); }
.list li:hover:not(.empty) { background: var(--g-750, #292929); }
.tree-name { flex: 1; overflow: hidden; text-overflow: ellipsis; }
.tree-kind { flex: none; max-width: 35%; color: var(--text-3); font-size: 10px; overflow: hidden; text-overflow: ellipsis; }
.selection-summary { display: flex; align-items: center; gap: 10px; padding: 11px 12px; background: var(--g-850); border-bottom: 1px solid var(--g-700); }
.selection-icon { display: grid; place-items: center; width: 30px; height: 30px; flex: none; background: var(--g-750, #292929); border: 1px solid var(--g-600); border-radius: 5px; color: var(--text-2); font-size: 15px; }
.selection-info { display: flex; flex-direction: column; min-width: 0; gap: 3px; }
.selection-info strong { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.selection-info small { font-size: 10.5px; color: var(--text-3); }
.win.props .grid { gap: 7px 9px; padding: 0 10px 14px; grid-template-columns: minmax(82px, 37%) minmax(0, 1fr); }
.win.props .grid .cat { margin: 12px -10px 3px; padding: 8px 11px; border-top: 1px solid var(--g-700); border-bottom: 1px solid var(--g-700); background: var(--g-800); color: var(--text-2); font-size: 10.5px; letter-spacing: .035em; }
.win.props .grid label { line-height: 1.3; white-space: normal; overflow-wrap: anywhere; }
.win.props .grid .ctl :is(input[type=text], input[type=number], select) { min-height: 27px; height: 27px; font-size: 11.5px; }
.win.props .grid .hint { line-height: 1.55; }
@container win (max-width: 760px) {
  .tool-group .tools { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .win.props .grid { grid-template-columns: minmax(76px, 35%) minmax(0, 1fr); }
}
</style>
