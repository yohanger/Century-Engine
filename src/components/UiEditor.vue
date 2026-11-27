<script setup>
import { acquirePointer } from '../engine/runtime/input/pointer-capture.js'
import { askConfirm } from '../core/dialogs.js'
// Editor de interfaces del juego (Assets/UI/*.ui): plantilla Vue + script + CSS con resaltado, vista previa en vivo a cualquier resolución,
// inspector de elementos (clic → su clase y su regla CSS), datos de prueba y lista de errores con salto de línea.
import AppWindow from './AppWindow.vue'
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, markRaw, nextTick } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState, Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { html, htmlLanguage } from '@codemirror/lang-html'
import { templateSource } from '../core/editor/intellisense.js'
import { jsIntelligence, templateIntelligence, templateTypedSource, formatCode } from '../core/editor/jsintel.js'
import { editorLook } from '../core/editor/theme.js'
import { liveNames } from '../core/editor/names.js'
import { css } from '@codemirror/lang-css'
import { javascript } from '@codemirror/lang-javascript'
import { store, setUiCode, closeUiEditor, resetSystemUi, saveAll, setUiSlot, rolesOf, assetUrl, openThemeEditor, toast } from '../core/store.js'
import { UI_SNAP_STEPS } from '../engine/runtime/ui/design.js'
import { parseUi, composeUi } from '../engine/runtime/ui/sfc.js'
import { isSystemUi } from '../engine/runtime/ui/system.js'
import { ROLES } from '../engine/runtime/ui/roles.js'
import { UiManager } from '../engine/runtime/ui/manager.js'
import { Game } from '../engine/runtime/events/interpreter.js'
import { parseMessage } from '../engine/runtime/events/textcodes.js'
import { inspectSelector, inspectLabel, selectInspected } from '../core/ui/inspect-preview.js'
import { UI_GALLERY } from '../core/ui/templates.js'
import UiRoot from '../engine/runtime/ui/UiRoot.vue'
import UiDesignerPanel from './UiDesignerPanel.vue'
import UiDesignOverlay from './UiDesignOverlay.vue'
import { createDesigner } from './designer.js'

const doc = computed(() => store.project.uis.find((c) => c.id === store.uiEditId))
const parts = reactive(parseUi(doc.value?.code || ''))
const tab = ref('template')
const help = ref(false), palette = ref(false), tplMenu = ref(false), errOpen = ref(false)
const host = ref(null)
const cursor = ref({ line: 1, col: 1 })
const savedAt = ref(0)
// Anchuras de los paneles de autoría, exclusivamente de presentación (no se serializan en .ui).
const dockWidths = reactive({ library: 264, inspector: 310 })
const layoutHost = ref(null)
let resizing = null
function dockDown(which, e) {
  if (e.button !== 0) return
  if (!acquirePointer(e.currentTarget, e, "Panel UI")) return
  resizing = { which, startX: e.clientX, startWidth: dockWidths[which] }
  e.preventDefault()
}
function dockMove(e) {
  if (!resizing) return
  const direction = resizing.which === 'library' ? 1 : -1
  const requested = resizing.startWidth + direction * (e.clientX - resizing.startX)
  const other = resizing.which === 'library' ? dockWidths.inspector : dockWidths.library
  const max = Math.max(resizing.which === 'library' ? 195 : 240, (layoutHost.value?.clientWidth || 1250) - other - 330)
  dockWidths[resizing.which] = Math.max(resizing.which === 'library' ? 195 : 240, Math.min(max, requested))
}
function dockUp() { resizing = null }
function dockKey(which, e) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  const delta = (e.key === 'ArrowRight' ? 1 : -1) * (which === 'library' ? 16 : -16)
  const other = which === 'library' ? dockWidths.inspector : dockWidths.library
  const max = Math.max(which === 'library' ? 195 : 240, (layoutHost.value?.clientWidth || 1250) - other - 330)
  dockWidths[which] = Math.max(which === 'library' ? 195 : 240, Math.min(max, dockWidths[which] + delta))
  e.preventDefault()
}


// ----- CodeMirror -----
const errTheme = EditorView.theme({ '.cm-line.errline': { backgroundColor: 'rgba(224,82,74,.18)' }, '.cm-content': { paddingBottom: '24px' } })
const LANG = {
  template: () => [html({ matchClosingTags: true, autoCloseTags: true }), htmlLanguage.data.of({ autocomplete: templateTypedSource(liveNames) }), htmlLanguage.data.of({ autocomplete: templateSource }), templateIntelligence()],
  script: () => [javascript(), jsIntelligence({ context: 'ui', names: liveNames })],
  style: () => css(),
}
const states = {}
let view = null
function mkState(k) {
  return EditorState.create({
    doc: parts[k] || '',
    extensions: [
      basicSetup, LANG[k](), editorLook(), Prec.highest(errTheme), EditorView.lineWrapping,
      Prec.highest(keymap.of([{ key: 'Mod-s', run: () => { saveAll(); return true } }, { key: 'Shift-Alt-f', run: () => { void formatTab(); return true } }])),
      EditorView.updateListener.of((u) => {
        if (u.docChanged && view && u.view === view) { parts[tab.value] = u.state.doc.toString(); save(); if (tab.value === 'template') D.htmlEdited() }
        if (u.docChanged || u.selectionSet) { const h = u.state.selection.main.head, l = u.state.doc.lineAt(h); cursor.value = { line: l.number, col: h - l.from + 1 } }
      }),
    ],
  })
}
function showTab(k) {
  if (view) states[tab.value] = view.state
  tab.value = k
  states[k] ||= mkState(k)
  view?.setState(states[k])
  view?.focus()
}
/** Formatea la pestaña activa (Mayús+Alt+F) con Prettier. */
async function formatTab() {
  if (!view) return
  const k = tab.value
  try {
    const before = view.state.doc.toString()
    const out = (await formatCode(before, k === 'style' ? 'css' : k === 'template' ? 'template' : 'script')).replace(/\n$/, '')
    if (out !== before) view.dispatch({ changes: { from: 0, to: before.length, insert: out } })
  } catch (e) { toast('No se puede formatear: ' + String(e.message || e).split('\n')[0], 'error', 4000) }
}
async function restoreBuiltIn() {
  if (!isSystemUi(doc.value)) return
  if (!(await askConfirm('¿Restaurar el diseño original de esta interfaz del motor? Se perderán sus modificaciones.', { title: 'Restaurar interfaz', danger: true }))) return
  if (resetSystemUi(doc.value.id)) replaceAll(doc.value.code)
}
function save() { if (doc.value) { setUiCode(doc.value.id, composeUi(parts)); savedAt.value = Date.now() } }

// ----- diseñador visual (pestaña Plantilla) -----
/** Escribe bloques generados por el diseñador y refresca el editor de código si lo mostraba. */
function refreshCm(k) {
  delete states[k]
  if (tab.value === k && view && !(k === 'template' && D.dz.mode === 'designer')) { states[k] = mkState(k); view.setState(states[k]) }
}
const D = createDesigner({
  getParts: () => parts,
  patch: (o) => { for (const k of ['template', 'script', 'design']) if (o[k] !== undefined && o[k] !== parts[k]) { parts[k] = o[k]; if (k !== 'design') refreshCm(k) } save() },
  jump: (k, line) => goto(k, line),
})
const designing = computed(() => tab.value === 'template' && D.dz.mode === 'designer' && !D.dz.legacy && !D.dz.stale)
/** «.nombre { }» en Propiedades: crea la regla en Estilo si no existe y salta a ella. */
function cssRule(sel) {
  const css = parts.style || ''
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rule = new RegExp(`(?:^|[{}])\\s*(${esc})\\s*\\{`).exec(css)
  const prefix = css.trimEnd()
  const line = rule
    ? css.slice(0, rule.index + rule[0].lastIndexOf('{')).split('\n').length
    : (prefix ? prefix.split('\n').length + 2 : 1)
  if (!rule) {
    parts.style = (prefix ? prefix + '\n\n' : '') + `${sel} {\n  \n}\n`
    refreshCm('style')
    save()
  }
  goto('style', line + 1)
}
function setView(m) {
  D.setMode(m)
  if (m === 'html') { states.template = mkState('template'); if (tab.value === 'template' && view) view.setState(states.template) }
}
const setAttr = (k, v) => { const a = { ...parts.attrs }; if (v === false || v === '' || v == null) delete a[k]; else a[k] = v; parts.attrs = a; save() }
function insert(s) {
  if (!view) return
  const sel = view.state.selection.main
  view.dispatch({ changes: { from: sel.from, to: sel.to, insert: s }, selection: { anchor: sel.from + s.length }, scrollIntoView: true })
  view.focus()
}
function goto(k, line) {
  showTab(k)
  nextTick(() => {
    if (!view) return
    const l = view.state.doc.line(Math.max(1, Math.min(line, view.state.doc.lines)))
    view.dispatch({ selection: { anchor: l.from, head: l.to }, effects: EditorView.scrollIntoView(l.from, { y: 'center' }) })
    view.focus()
  })
}
function replaceAll(code) {
  Object.assign(parts, parseUi(code))
  for (const k of ['template', 'script', 'style']) delete states[k]
  states[tab.value] = mkState(tab.value); view.setState(states[tab.value])
  D.load()
  save()
}
async function applyTemplate(g) {
  tplMenu.value = false
  if (!(await askConfirm(`Reemplazar el contenido de ${doc.value.name} por la plantilla «${g.label}»?`, { title: 'Aplicar plantilla', danger: true }))) return
  replaceAll(g.code)
}

const SNIP = {
  template: [
    ['Estructura', [['Panel', '<div class="panel">\n  \n</div>'], ['Fila', '<div class="row">\n  \n</div>'], ['Título', '<h2>Título</h2>'], ['Texto', '<p>Texto</p>'], ['Imagen', '<img :src="asset(\'icono.png\')" />']]],
    ['Datos del juego', [['Variable', "{{ game.variable('Oro') }}"], ['Si interruptor', "<div v-if=\"game.switch('Llave')\">🔑</div>"], ['Barra', "<rt-bar :value=\"game.variable('Vida')\" :max=\"100\" color=\"#e0524a\" style=\"width:200px;height:14px\" />"], ['Repetir lista', '<div v-for="(it, i) in items" :key="i">{{ it }}</div>'], ['Objeto del grupo', '<div v-for="it in play.party?.items" :key="it.id"><rt-icon :icon="it.icon" /> {{ it.name }} ×{{ it.n }}</div>']]],
    ['Interacción', [['Botón cerrar', '<button @click="close()">Cerrar</button>'], ['Botón abrir', '<button @click="ui.open(\'otra\')">Abrir</button>'], ['Tecla', '<rt-key>E</rt-key>'], ['Llamar función', '<button @click="call(\'miFuncion\')">Hacer</button>']]],
  ],
  script: [
    ['Vue', [['ref', 'const valor = ref(0)'], ['computed', 'const doble = computed(() => valor.value * 2)'], ['onUpdate', 'onUpdate((dt) => {\n  \n})'], ['return', 'return { }']]],
    ['Juego', [['Esperar', 'setTimeout(() => close(), 2000)'], ['Leer props', 'const titulo = computed(() => props.title || \'Sin título\')'], ['Abrir y esperar', 'const ok = await ui.open(\'confirmar\', { text: \'¿Seguro?\' })']]],
  ],
  style: [
    ['Tema (heredan del proyecto)', [['Ventana', 'background: var(--rt-win-bg); border: var(--rt-bw) solid var(--rt-win-border); border-radius: var(--rt-radius); padding: var(--rt-pad); box-shadow: var(--rt-shadow);'], ['Texto', 'color: var(--rt-text); font: var(--rt-weight) var(--rt-fs)/var(--rt-lh) var(--rt-font); text-shadow: var(--rt-text-shadow);'], ['Acento', 'background: var(--rt-accent); color: var(--rt-accent-text);']]],
    ['Diseño', [['Centrar pantalla', ':root { display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.45); }'], ['Esquina', 'position: absolute; right: 24px; top: 20px;'], ['Animación', '@keyframes pulso { 50% { opacity: .4; } }']]],
  ],
}
const snips = computed(() => SNIP[tab.value])

// ----- vista previa -----
const mock = reactive({ on: true, focus: true, dialog: null, choices: null, prompt: '', fade: { color: '#000000', alpha: 0, ms: 0 }, errors: 0, started: true, party: null })
const pgame = new Game({ database: store.project.database, host: {} })
const previewUrls = new Map(), idUrls = reactive({})
const pm = markRaw(new UiManager({
  play: mock, getDocs: () => store.project.uis, getConfig: () => store.project.ui, getGame: () => pgame, getTheme: () => store.project.theme,
  host: { assetUrl: (n) => previewUrls.get(String(n).toLowerCase()), assetUrlById: (id) => idUrls[id] },
}))
const propsText = ref('{}')
const propsErr = ref('')
function applyPreview() {
  let p = {}
  try { p = JSON.parse(propsText.value || '{}'); propsErr.value = '' } catch { propsErr.value = 'JSON no válido' }
  pm.state.preview = { docId: store.uiEditId, props: p }
}
watch(propsText, applyPreview)
// otra parte del editor cambió este .ui (p. ej. Localización ▸ Interfaz ▸ Recoger textos): se vuelve a leer
watch(() => store.uiReloadAt, () => {
  if (!doc.value) return
  Object.assign(parts, parseUi(doc.value.code))
  for (const k of ['template', 'script', 'style']) delete states[k]
  if (view) { states[tab.value] = mkState(tab.value); view.setState(states[tab.value]) }
  D.load()
})
const compiled = computed(() => pm.compiled(store.uiEditId))
const errors = computed(() => [
  ...(compiled.value?.errors || []).map((e) => ({ text: `${e.where}${e.line ? ' (línea ' + e.line + ')' : ''}: ${e.message}`, tab: e.where === 'script' ? 'script' : 'template', line: e.line || 0 })),
  ...pm.state.errors.map((m) => ({ text: m, tab: null, line: 0 })),
])

const toggleMock = (k, v) => { mock[k] = mock[k] ? null : (typeof v === 'function' ? v() : v) }
// diálogo de ejemplo con códigos reales (color, expresión del retrato) para ver cómo se representa
const MOCK_TEXT = '\\F[normal]Hola, viajero. \\C[2]Hace tiempo\\C[0] que no veía a nadie por aquí.\\F[triste] El camino del norte \\FX[temblor]ya no es seguro\\FX[0].'
function mockDialog(pos = mock.dialog?.pos || 'bottom', speaker = mock.dialog ? mock.dialog.speaker : 'Ana') {
  const msg = parseMessage(MOCK_TEXT)
  return { speaker, text: msg.plain, msg, runs: msg.runs, pos, shown: msg.plain.length, done: true, age: 1, auto: false, stay: undefined }
}
const MOCKS = {
  dialog: () => mockDialog('bottom', 'Ana'),
  choices: () => ({ options: ['Sí, claro', 'Quizá más tarde', 'No'], prompt: '¿Me ayudas?', cancel: -1, index: 0 }),
}
/** ▶ Reproducir: escribe el diálogo de ejemplo letra a letra a la velocidad del diseño (o la del tema), como en el juego. */
let typing = 0
function playDialog() {
  cancelAnimationFrame(typing)
  const d = mock.dialog || (mock.dialog = mockDialog())
  d.shown = 0; d.done = false
  let t0 = performance.now()
  const step = (now) => {
    const dt = Math.min(0.1, (now - t0) / 1000); t0 = now
    const cur = mock.dialog
    if (!cur) return
    cur.shown = Math.min(cur.text.length, cur.shown + dt * (cur.speed || store.project.theme?.speed || 48))
    if (cur.shown >= cur.text.length) { cur.done = true; return }
    typing = requestAnimationFrame(step)
  }
  typing = requestAnimationFrame(step)
}
const setMockPos = (pos) => { if (!mock.dialog) mock.dialog = mockDialog(pos); else mock.dialog.pos = pos }
const toggleSpeaker = () => { if (mock.dialog) mock.dialog.speaker = mock.dialog.speaker ? '' : 'Ana' }
// al abrir (o cambiar el tipo de) una pantalla de diálogo/opciones/indicación, la vista previa simula ese estado
watch(() => D.dz.design?.form.kind, (k) => {
  if (k === 'dialog' && !mock.dialog) mock.dialog = mockDialog()
  if (k === 'choices' && !mock.choices) mock.choices = MOCKS.choices()
  if (k === 'prompt' && !mock.prompt) mock.prompt = 'E · Hablar'
}, { immediate: true })
const dbSw = computed(() => store.project.database.switches.map((n, i) => ({ id: i + 1, name: n })).filter((x) => x.name))
const dbVr = computed(() => store.project.database.variables.map((n, i) => ({ id: i + 1, name: n })).filter((x) => x.name))
const tick = ref(0)
const swVal = (id) => (tick.value, !!pgame.sw[id])
const vrVal = (id) => (tick.value, pgame.vr[id] || 0)
function setSw(id, v) { pgame.setSw(id, v); pm.sync(pgame.rev, 0); tick.value++ }
function setVr(id, v) { pgame.setVar(id, v); pm.sync(pgame.rev, 0); tick.value++ }

// resolución, zoom y ajuste al espacio disponible
const RES = reactive([['1920×1080 (16:9)', 1920, 1080], ['1280×720 (16:9)', 1280, 720], ['1366×768', 1366, 768], ['1024×768 (4:3)', 1024, 768], ['2560×1080 (21:9)', 2560, 1080], ['844×390 (móvil horizontal)', 844, 390], ['390×844 (móvil vertical)', 390, 844]])
const resIdx = ref(1), zoom = ref('fit')
const size = computed(() => ({ w: RES[resIdx.value][1], h: RES[resIdx.value][2] }))
/** Con el diseñador activo, la vista previa usa la resolución de diseño del formulario (salvo que el usuario elija otra para probar el anclaje). */
function syncDesignRes() {
  const f = D.dz.design?.form
  if (!f) return
  let i = RES.findIndex((r) => r[1] === f.w && r[2] === f.h)
  if (i < 0) { const row = [`Diseño (${f.w}×${f.h})`, f.w, f.h]; if (String(RES[0][0]).startsWith('Diseño (')) RES[0] = row; else RES.unshift(row); i = 0 }
  resIdx.value = i
}
watch(() => [designing.value, D.dz.design?.form.w, D.dz.design?.form.h], ([on]) => { if (on) { syncDesignRes(); inspect.value = false; hover.value = null } })
const box = ref(null), avail = ref({ w: 600, h: 340 })
// «Ajustar» deja margen para el marco negro y el rótulo de la resolución
const scale = computed(() => (zoom.value === 'fit' ? Math.max(0.1, Math.min(2, (avail.value.w - 24) / size.value.w, (avail.value.h - 44) / size.value.h)) : +zoom.value))
let ro
onMounted(() => {
  D.load()
  applyPreview()
  view = new EditorView({ parent: host.value, state: (states.template = mkState('template')) })
  ro = new ResizeObserver(() => { if (box.value) avail.value = { w: box.value.clientWidth, h: box.value.clientHeight } })
  if (box.value) ro.observe(box.value) // la ventana pudo cerrarse antes de montarse
  loadUrls()
})
onBeforeUnmount(() => { cancelAnimationFrame(typing); ro?.disconnect(); view?.destroy(); view = null; pm.state.preview = null; pm.reset() })
async function loadUrls() {
  for (const a of store.project.assets || []) {
    if (a.kind !== 'texture' && a.kind !== 'font') continue
    try { const u = await assetUrl(a.id); if (u) { if (a.kind === 'texture') previewUrls.set(a.name.toLowerCase(), u); idUrls[a.id] = u; pm.state.themeRev++ } } catch { /* sin archivo */ }
  }
}

// inspector: clic en la vista previa → elemento, tamaño y regla CSS
const inspect = ref(false), outline = ref(false)
const picked = ref(null)
const stage = ref(null)
function describe(el) {
  const r = el.getBoundingClientRect(), s = stage.value.getBoundingClientRect(), k = scale.value
  return { x: Math.round((r.left - s.left) / k), y: Math.round((r.top - s.top) / k), w: Math.round(r.width / k), h: Math.round(r.height / k) }
}
const hover = ref(null)
const screenOf = el => el instanceof Element ? el.closest('.rt-screen') : null
const inspectEntry = (el, screen) => ({ selector: inspectSelector(el, screen), label: inspectLabel(el) })
function onOver(e) {
  const screen = screenOf(e.target)
  hover.value = inspect.value && screen ? describe(e.target) : null
}
function inspectElement(element, screen) {
  const path = []
  for (let current = element; current; current = current.parentElement) {
    path.unshift(inspectEntry(current, screen))
    if (current === screen) break
  }
  const slot = element.closest('[data-inventory-slot]')
  const grid = slot?.parentElement
  const gridSelector = grid && inspectSelector(grid, screen)
  picked.value = {
    ...describe(element), path, ...path.at(-1),
    children: Array.from(element.children).map(child => inspectEntry(child, screen)),
    slotGroup: element === slot && gridSelector ? gridSelector + ' > .rt-inventory-slot' : null,
  }
  hover.value = describe(element)
}
function onPick(e) {
  if (!inspect.value) return
  const screen = screenOf(e.target)
  if (!screen) return
  e.preventDefault(); e.stopPropagation()
  inspectElement(e.target, screen)
}
function chooseInspected(selector) {
  if (!selector) return
  for (const screen of stage.value.querySelectorAll('.rt-screen')) {
    const element = selectInspected(screen, selector)
    if (element) { inspectElement(element, screen); return }
  }
}
const roleOn = (r) => rolesOf(doc.value.id).includes(r.key)
const toggleRole = (r) => setUiSlot(r.key, doc.value.id, !roleOn(r))

const REF = [
  ['play', 'Estado del juego: dialog {speaker,text,pos,shown,done} · choices {options,prompt,index} · prompt · fade {color,alpha,ms} · focus · party.'],
  ['game.switch(x) · game.variable(x)', 'Interruptores y variables por nombre (Base de datos) o número. La pantalla se redibuja sola al cambiar.'],
  ['game.player · game.state · game.time', 'Datos del jugador y estado libre del juego (usa onUpdate para refrescarlos).'],
  ['props', 'Datos recibidos en game.ui.open("nombre", { … }) o en el comando «Mostrar interfaz».'],
  ['close(resultado?)', 'Cierra esta pantalla; el valor llega a quien hizo await game.ui.open(…).'],
  ['ui.open(n, props?, {modal?}) · ui.close(n?) · ui.toggle(n)', 'Abre / cierra otras pantallas. Una pantalla «modal» libera el ratón y pausa el juego (Esc la cierra).'],
  ['ui.next() · ui.pick(i) · ui.resume() · ui.quit()', 'Acciones del sistema: avanzar texto, elegir opción, continuar, salir.'],
  ['call(nombre, …args)', 'Llama a una función definida en un script con game.define.'],
  ['asset("imagen.png")', 'URL de una textura del proyecto, para <img :src> o CSS inline.'],
  ['var(--rt-font) · var(--rt-accent) · var(--rt-win-bg) …', 'Variables del tema del proyecto (botón «Tema»): fuente, colores, ventana, radio, relleno, sombra, indicador.'],
  ['ref · reactive · computed · watch · onMounted · onUnmounted', 'Vue: el <script> es el cuerpo de setup(); devuelve lo que use la plantilla con return { … }.'],
  ['onUpdate(dt => …)', 'Se ejecuta cada fotograma mientras la pantalla está abierta.'],
  ['<rt-bar :value :max color> · <rt-key>', 'Componentes incluidos: barra de progreso y tecla.'],
  ['<template modal layer="50">', 'Atributos de la plantilla: modal (libera ratón y pausa) y layer (orden: HUD 10 · diálogo 30 · pausa 100).'],
]
const saved = computed(() => (savedAt.value ? 'Guardado' : 'Sin cambios'))
</script>

<template>
  <AppWindow dock-panel-id="uiEditor" data-win="ue" v-if="doc" :title="doc.name" :subtitle="doc.folder + (saved ? ' · ' + saved : '')" :width="1380" :height="800" :min-width="360" :min-height="360" :scroll="false" persist="uieditor" @close="closeUiEditor()">
    <template #actions>
      <!-- DEPRECATED: las plantillas por defecto (menú «Plantilla») se quitaron; el .ui se escribe desde cero. -->
      <button v-if="isSystemUi(doc)" class="ghost" data-testid="restore-system-ui" @click="restoreBuiltIn">Restaurar original</button>
      <button class="ghost" data-tooltip="Fuente, colores y ventanas de todo el juego" @click="openThemeEditor()">Tema…</button>
      <button class="ghost" :class="{ on: help }" @click="help = !help">Referencia</button>
    </template>
    <div class="uex">
      <div class="roles">
        <span v-if="ROLES.some(roleOn)" class="dim" data-tooltip="Obsoleto: usa un nodo Canvas con este .ui adjunto">Rol (obsoleto):</span>
        <button v-for="r in ROLES.filter(roleOn)" :key="r.key" class="chip" :class="{ on: roleOn(r) }" :data-tooltip="r.desc" @click="toggleRole(r)">{{ r.label }}</button>
        <span class="grow"></span>
        <label class="chk" data-tooltip="Libera el ratón y pausa el juego mientras está abierta"><input type="checkbox" :checked="!!parts.attrs.modal" @change="setAttr('modal', $event.target.checked)" /> Modal</label>
        <label class="chk" data-tooltip="Orden de apilado (mayor = delante)">Capa <input class="n" type="number" :value="parts.attrs.layer || ''" placeholder="50" @input="setAttr('layer', $event.target.value)" /></label>
      </div>

      <div class="tabs" role="toolbar" aria-label="Vistas del editor de interfaces">
        <button v-for="[k, l] in [['template', 'Plantilla'], ['script', 'Script'], ['style', 'Estilo']]" :key="k" :class="{ on: tab === k }" @click="showTab(k)">{{ l }}<i v-if="k !== 'style' && errors.some((e) => e.tab === k)" class="dot"></i></button>
        <div v-if="tab === 'template'" class="seg" role="group" aria-label="Modo de plantilla">
          <button :class="{ on: D.dz.mode === 'designer' }" data-testid="ui-mode-designer" @click="setView('designer')">Diseño</button>
          <button :class="{ on: D.dz.mode === 'html' }" data-testid="ui-mode-html" @click="setView('html')">HTML</button>
        </div>
        <span v-if="designing" class="ui-context">{{ D.dz.sel ? D.cur()?.name : 'Formulario' }} · {{ D.dz.design?.controls.length || 0 }} controles</span>
        <span class="grow"></span>
        <div v-if="!designing && !(tab === 'template' && D.dz.mode === 'designer')" class="menu">
              <button class="ghost" :class="{ on: palette }" @click="palette = !palette">＋ Insertar</button>
              <div v-if="palette" class="pop wide" @mouseleave="palette = false">
                <template v-for="[cat, list] in snips" :key="cat">
                  <div class="cat">{{ cat }}</div>
                  <button v-for="[l, s] in list" :key="l" :data-tooltip="s" @click="insert(s); palette = false">{{ l }}</button>
                </template>
              </div>
            </div>
      </div>
      <div ref="layoutHost" class="body" :class="{ 'design-layout': designing }" :style="designing ? { '--ui-tools-width': dockWidths.library + 'px', '--ui-inspector-width': dockWidths.inspector + 'px' } : {}">
        <div class="left">
          <UiDesignerPanel v-if="tab === 'template' && D.dz.mode === 'designer'" :D="D" section="library" @css="cssRule" />
          <div ref="host" v-show="!(tab === 'template' && D.dz.mode === 'designer')" class="ed"></div>
          <div v-if="designing" class="dock-splitter" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Redimensionar panel de herramientas" :aria-valuenow="dockWidths.library" aria-valuemin="195" aria-valuemax="410" @pointerdown="dockDown('library', $event)" @pointermove="dockMove" @pointerup="dockUp" @pointercancel="dockUp" @lostpointercapture="dockUp" @keydown="dockKey('library', $event)"></div>
          <div v-if="errOpen && errors.length" class="errs">
            <button v-for="(e, i) in errors" :key="i" :disabled="!e.tab" @click="e.tab && goto(e.tab, e.line || 1)">{{ e.text }}</button>
          </div>
          <div v-if="!designing" class="foot">
            <span v-if="!errors.length" class="st ok">✓ Compila sin errores</span>
            <span v-else class="st bad" :data-tooltip="errors.map((e) => e.text).join('\n')" @click="errOpen = !errOpen">✕ {{ errors[0].text }}<template v-if="errors.length > 1"> (+{{ errors.length - 1 }})</template></span>
            <span class="dim grow">Ln {{ cursor.line }}, Col {{ cursor.col }} · Se guarda solo · Ctrl+S guarda el proyecto</span>
          </div>
        </div>

        <div class="right">
          <div class="pvbar" role="toolbar" aria-label="Herramientas del Canvas">
            <div class="pv-heading"><strong>{{ designing ? 'Canvas' : 'Vista previa' }}</strong><small>{{ designing ? 'Diseño de interfaz' : 'Resultado en ejecución' }}</small></div>
            <div class="pv-controls">
              <label class="pv-field">Pantalla <select v-model.number="resIdx" aria-label="Resolución de la vista previa" data-tooltip="Resolución de la vista previa"><option v-for="(r, i) in RES" :key="i" :value="i">{{ r[0] }}</option></select></label>
              <label class="pv-field">Zoom <select v-model="zoom" aria-label="Zoom de la vista previa" data-tooltip="Zoom"><option value="fit">Ajustar</option><option value="0.5">50%</option><option value="0.75">75%</option><option value="1">100%</option></select></label>
              <label v-if="designing" class="pv-snap" data-testid="ui-canvas-snap" data-tooltip="Ajusta al arrastrar. Alt permite mover sin snap."><input type="checkbox" v-model="D.dz.snap" /> Snap</label>
              <select v-if="designing && D.dz.snap" v-model.number="D.dz.grid" aria-label="Paso de snap"><option v-for="step in UI_SNAP_STEPS" :key="step" :value="step">{{ step }}px</option></select>
            </div>
            <div class="pv-actions">
              <button :class="{ on: inspect }" :aria-pressed="inspect" data-tooltip="Haz clic en un elemento de la vista previa para ver su clase y saltar a su CSS" @click="inspect = !inspect; hover = null">⌖ Inspeccionar</button>
              <button :class="{ on: outline }" :aria-pressed="outline" data-tooltip="Dibuja el contorno de todos los elementos" @click="outline = !outline">▢ Contornos</button>
            </div>
          </div>
          <div class="pvbox" ref="box" data-testid="ui-canvas" :class="{ scroll: zoom !== 'fit', 'design-canvas': designing }">
            <div class="sizer" data-testid="res-frame" :style="{ width: size.w * scale + 'px', height: size.h * scale + 'px' }">
              <span class="reslbl">{{ size.w }}×{{ size.h }}</span>
              <div ref="stage" class="stage" :class="{ inspect, outline }" :style="{ transform: `scale(${scale})`, width: size.w + 'px', height: size.h + 'px' }" @mouseover="onOver" @pointerdown.capture="inspect && $event.stopPropagation()" @click.capture="onPick" @dragstart.capture="inspect && $event.preventDefault()" @mouseleave="hover = null">
                <UiRoot :manager="pm" />
                <UiDesignOverlay v-if="designing" v-show="!inspect" :D="D" :stage="stage" :scale="scale" :size="size" />
                <div v-if="hover" class="hov" :style="{ left: hover.x + 'px', top: hover.y + 'px', width: hover.w + 'px', height: hover.h + 'px' }"></div>
              </div>
            </div>
          </div>
          <div v-if="designing" class="canvas-status" aria-live="polite"><span>{{ D.dz.sel ? D.cur()?.name : 'Formulario' }} · {{ D.dz.design?.controls.length || 0 }} controles</span><span>{{ size.w }} × {{ size.h }} · {{ zoom === 'fit' ? 'Ajustar' : Math.round(scale * 100) + '%' }}</span></div>
          <div v-if="picked" class="insp">
            <nav class="insp-path" aria-label="Jerarquía del elemento">
              <button v-for="item in picked.path" :key="item.selector" :aria-current="item.selector === picked.selector ? 'true' : undefined"
                @click="chooseInspected(item.selector)">{{ item.label }}</button>
            </nav>
            <select v-if="picked.children.length" aria-label="Inspeccionar hijo" value="" @change="chooseInspected($event.target.value)">
              <option value="" disabled>Seleccionar hijo…</option>
              <option v-for="item in picked.children" :key="item.selector" :value="item.selector">{{ item.label }}</option>
            </select>
            <code class="insp-selector">{{ picked.selector }}</code>
            <span>{{ picked.w }}×{{ picked.h }} en ({{ picked.x }}, {{ picked.y }})</span>
            <span class="grow"></span>
            <button @click="cssRule(picked.selector)">Regla CSS</button>
            <button v-if="picked.slotGroup" @click="cssRule(picked.slotGroup)">CSS de las casillas</button>
            <button aria-label="Cerrar inspector" @click="picked = null; hover = null">✕</button>
          </div>
          <details class="simulation">
            <summary>Simulación de juego <span class="dim">Estados y datos de prueba; no se guardan</span></summary>
          <div class="mocks">
            <span class="dim" data-tooltip="Solo afectan a esta vista previa; no se guardan en el juego">Simular en la vista previa:</span>
            <button :class="{ on: mock.dialog }" data-tooltip="Muestra un diálogo de ejemplo (variable play.dialog)" @click="toggleMock('dialog', MOCKS.dialog)">Diálogo</button>
            <template v-if="mock.dialog">
              <button class="play" data-testid="mock-play" data-tooltip="Escribe el texto de ejemplo letra a letra, como en el juego" @click="playDialog">▶ Reproducir</button>
              <button v-for="[p, l] in [['top', 'Arriba'], ['center', 'Centro'], ['bottom', 'Abajo']]" :key="p" :class="{ on: mock.dialog.pos === p }" data-tooltip="Posición del comando «Mostrar texto»" @click="setMockPos(p)">{{ l }}</button>
              <button :class="{ on: !mock.dialog.speaker }" data-tooltip="Diálogo sin nombre (narrador)" @click="toggleSpeaker">Sin nombre</button>
            </template>
            <button :class="{ on: mock.choices }" data-tooltip="Muestra opciones de ejemplo (variable play.choices)" @click="toggleMock('choices', MOCKS.choices)">Opciones</button>
            <button :class="{ on: mock.prompt }" data-tooltip="Muestra una indicación de ejemplo (variable play.prompt)" @click="mock.prompt = mock.prompt ? '' : 'E · Hablar'">Indicación</button>
            <button :class="{ on: !mock.focus }" data-tooltip="Simula que el juego no tiene el foco (ventana en segundo plano)" @click="mock.focus = !mock.focus">Sin foco</button>
            <label class="chk" data-tooltip="Opacidad del fundido a negro de ejemplo (play.fade.alpha)">Fundido <input type="range" min="0" max="1" step="0.05" v-model.number="mock.fade.alpha" /></label>
          </div>
          <div class="mocks">
            <label class="chk grow" data-tooltip="Valores que recibe esta pantalla al abrirla con game.ui.open('nombre', { ... }). Escríbelos como JSON, p. ej. {&quot;titulo&quot;: &quot;Hola&quot;}; dentro de la plantilla se leen como props.titulo.">Props de ejemplo (JSON) <input class="pj" :class="{ bad: propsErr }" v-model="propsText" spellcheck="false" placeholder='{"titulo": "Hola"}' :data-tooltip="propsErr || 'JSON con los parámetros que recibe la pantalla'" /></label>
          </div>
          <div v-if="dbSw.length || dbVr.length" class="mocks">
            <span class="dim">Base de datos</span>
            <label v-for="s in dbSw" :key="'s' + s.id" class="chk"><input type="checkbox" :checked="swVal(s.id)" @change="setSw(s.id, $event.target.checked)" /> {{ s.name }}</label>
            <label v-for="v in dbVr" :key="'v' + v.id" class="chk">{{ v.name }} <input class="n" type="number" :value="vrVal(v.id)" @input="setVr(v.id, +$event.target.value)" /></label>
          </div>
          </details>
          <aside v-if="help" class="ref">
            <dl><template v-for="[a, b] in REF" :key="a"><dt><code>{{ a }}</code></dt><dd>{{ b }}</dd></template></dl>
          </aside>
        </div>
        <aside v-if="designing" class="design-inspector" data-testid="ui-design-inspector">
          <div class="dock-splitter inspector-handle" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Redimensionar Inspector" :aria-valuenow="dockWidths.inspector" aria-valuemin="240" aria-valuemax="420" @pointerdown="dockDown('inspector', $event)" @pointermove="dockMove" @pointerup="dockUp" @pointercancel="dockUp" @lostpointercapture="dockUp" @keydown="dockKey('inspector', $event)"></div>
          <UiDesignerPanel :D="D" section="inspector" @css="cssRule" />
        </aside>
      </div>
    </div>
    <template #footer><span style="flex:1"></span><button class="primary" @click="closeUiEditor()">Cerrar</button></template>
  </AppWindow>
</template>

<style scoped>
.uex { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.grow { flex: 1; }
.dim { color: var(--text-2); font-weight: 400; font-size: 12px; }
.savedtag { font-size: 11px; opacity: .7; }
.chk { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 400; color: var(--text-2); }
.chk .n { width: 56px; height: 22px; }
.roles { display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-bottom: 1px solid var(--g-700); flex-wrap: wrap; font-size: 12px; }
.chip { height: 22px; padding: 0 9px; border-radius: 11px; font-size: 11px; }
.roles .chip.on { background: var(--blue); border-color: var(--blue); color: #fff; }
.body { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); }
.body.design-layout { grid-template-columns: var(--ui-tools-width) minmax(0, 1fr) var(--ui-inspector-width); }
.design-layout .left { background: var(--g-850); }
.design-inspector { min-width: 0; min-height: 0; position: relative; display: flex; flex-direction: column; background: var(--g-850); border-left: 1px solid var(--g-600); }
.ui-context { font-size: 11px; color: var(--text-2); padding: 0 8px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dock-splitter { position: absolute; z-index: 6; top: 0; bottom: 0; right: -4px; width: 8px; cursor: col-resize; background: transparent; touch-action: none; }
.dock-splitter:hover, .dock-splitter:focus-visible { background: var(--blue); opacity: .6; outline: none; }
.inspector-handle { right: auto; left: -4px; }
.simulation { flex: none; border-top: 1px solid var(--g-700); background: var(--g-850); max-height: 45%; overflow: auto; }
.simulation summary { cursor: pointer; user-select: none; padding: 7px 12px; font-size: 11px; font-weight: 600; }
.simulation summary .dim { font-size: 10px; margin-left: 8px; }
.simulation .mocks { padding-top: 6px; }
@container win (max-width: 930px) {
  .body.design-layout { display: flex; flex-direction: column; overflow: auto; }
  .body.design-layout .left { flex: none; height: 260px; border-right: 0; border-bottom: 1px solid var(--g-600); }
  .body.design-layout .right { flex: none; min-height: 360px; }
  .body.design-layout .design-inspector { flex: none; height: 270px; border-left: 0; border-top: 1px solid var(--g-600); }
  .body.design-layout .dock-splitter { display: none; }
}
@container win (max-width: 760px) { .body:not(.design-layout) { grid-template-columns: 1fr; grid-auto-rows: minmax(360px, 1fr); overflow: auto; } .body:not(.design-layout) .left { border-right: 0; border-bottom: 1px solid var(--g-600); } }
.left, .right { display: flex; flex-direction: column; min-height: 0; min-width: 0; position: relative; }
.left { border-right: 1px solid var(--g-600); }
.tabs { display: flex; flex: none; gap: 2px; padding: 6px 8px; align-items: center; border-bottom: 1px solid var(--g-700); background: var(--g-850); min-width: 0; flex-wrap: wrap; }
.tabs button { height: 26px; padding: 0 12px; font-size: 12px; position: relative; }
.seg { display: inline-flex; margin-left: 10px; border: 1px solid var(--g-600); border-radius: 5px; overflow: hidden; }
.seg button { height: 22px; padding: 0 10px; border: none; border-radius: 0; background: transparent; font-size: 11px; }
.seg button.on { background: var(--blue); color: #fff; }
.tabs button.on { background: var(--g-600); color: #fff; }
.dot { position: absolute; right: 3px; top: 3px; width: 6px; height: 6px; border-radius: 50%; background: var(--danger); }
.menu { position: relative; }
.pop { position: absolute; right: 0; top: 100%; margin-top: 4px; z-index: 20; display: grid; min-width: 190px; padding: 4px; background: var(--g-800, #262626); border: 1px solid var(--g-600); border-radius: 6px; box-shadow: 0 10px 30px #0009; max-height: 340px; overflow: auto; }
.pop.wide { min-width: 220px; }
.pop button { text-align: left; border: 0; background: transparent; height: 26px; font-size: 12px; }
.pop button:hover { background: var(--g-600); }
.cat { padding: 6px 8px 2px; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--text-2); }
.ed { flex: 1; min-height: 0; background: #1e1e1e; overflow: hidden; }
.ed :deep(.cm-editor) { height: 100%; }
.errs { max-height: 120px; overflow: auto; border-top: 1px solid var(--g-700); background: var(--g-850); display: grid; }
.errs button { text-align: left; border: 0; background: transparent; color: var(--danger); font-size: 11px; height: auto; padding: 4px 10px; white-space: normal; }
.errs button:not(:disabled):hover { background: var(--g-700); }
.foot { display: flex; gap: 10px; align-items: center; padding: 5px 10px; border-top: 1px solid var(--g-700); font-size: 11px; }
.st.ok { color: var(--ok); } .st.bad { color: var(--danger); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60%; cursor: pointer; }
.pvbar { display: flex; gap: 6px; align-items: center; padding: 6px 10px; border-bottom: 1px solid var(--g-700); flex-wrap: wrap; }
.pvbar select { height: 24px; font-size: 12px; } .pvbar button { height: 24px; font-size: 11px; padding: 0 9px; }
.pvbar button.on, .mocks button.on { background: var(--blue); border-color: var(--blue); color: #fff; }
.pvbox { flex: 1; min-height: 160px; margin: 10px; border: 1px solid var(--g-600); border-radius: 6px; background: #15171b; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.pvbox.scroll { overflow: auto; display: block; }
.sizer { position: relative; flex: none; }
.stage { position: absolute; left: 0; top: 0; transform-origin: 0 0; overflow: hidden; }
/* marco negro: los límites de la resolución elegida */
.sizer { background: repeating-conic-gradient(#3a3f47 0 25%, #2e3238 0 50%) 0 0 / 24px 24px; outline: 2px solid #000; box-shadow: 0 0 0 3px rgba(255, 255, 255, .14), 0 8px 30px rgba(0, 0, 0, .55); }
.reslbl { position: absolute; left: 0; top: -18px; font: 600 10.5px var(--mono, ui-monospace, monospace); color: var(--text-2); white-space: nowrap; pointer-events: none; }
.seg .cnt { margin-left: 4px; font-size: 10px; opacity: .65; }
.stage.inspect { cursor: crosshair; }
.stage.inspect :deep(.rt-screen), .stage.inspect :deep(.rt-screen *) { pointer-events: auto !important; }
.stage.outline :deep(.rt-screen *) { outline: 1px dashed rgba(80, 170, 255, .55); outline-offset: -1px; }
.insp-path { display: flex; align-items: center; gap: 4px; max-width: 100%; overflow: auto; }
.insp-path button { flex: none; }
.insp-path button[aria-current] { color: var(--blue-hi); }
.insp-selector { overflow-wrap: anywhere; }
.hov { position: absolute; pointer-events: none !important; background: rgba(80, 170, 255, .25); outline: 1px solid #4aa3ff; z-index: 99999; }
.insp { display: flex; align-items: center; gap: 10px; margin: 0 10px 8px; padding: 5px 10px; background: var(--g-850); border: 1px solid var(--g-700); border-radius: 6px; font-size: 11.5px; flex-wrap: wrap; }
.insp b { color: var(--amber); font-family: ui-monospace, monospace; }
.insp button { height: 22px; font-size: 11px; padding: 0 8px; }
.sw { width: 14px; height: 14px; border-radius: 3px; border: 1px solid #fff4; display: inline-block; }
.mocks { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; padding: 0 10px 8px; font-size: 12px; }
.mocks button { height: 22px; padding: 0 8px; font-size: 11px; }
.pj { flex: 1; min-width: 150px; height: 22px; font-family: ui-monospace, monospace; font-size: 11px; }
.pj.bad { border-color: var(--danger); }
.ref { position: absolute; inset: 40px 10px 10px; z-index: 15; overflow: auto; padding: 8px 12px; background: var(--g-850); border: 1px solid var(--g-600); border-radius: 6px; font-size: 11.5px; box-shadow: 0 10px 40px #000a; }
.ref dt { margin-top: 6px; } .ref dd { margin: 1px 0 0; color: var(--text-2); }
code { font-family: ui-monospace, monospace; color: var(--amber); }

/* Barra de Canvas contextual. Los controles siguen enlazados al diseñador original. */
.uex { background: var(--g-900, #141414); }
.tabs { background: var(--g-850); padding: 6px 10px; gap: 5px; }
.tabs > button { border: 1px solid transparent; }
.tabs > button.on { border-color: var(--g-600); box-shadow: inset 0 -2px var(--amber); background: var(--g-700); }
.tabs .seg button.on { background: var(--g-700); color: var(--text); box-shadow: inset 0 -2px var(--amber); }
.pvbar { flex: none; padding: 7px 10px; gap: 9px; background: var(--g-850); }
.pv-heading { display: flex; flex-direction: column; min-width: 108px; gap: 2px; padding-right: 9px; border-right: 1px solid var(--g-600); }
.pv-heading strong { font-size: 11.5px; }
.pv-heading small { font-size: 10px; color: var(--text-3); }
.pv-controls, .pv-actions { display: flex; gap: 7px; align-items: center; flex-wrap: wrap; }
.pv-controls { flex: 1; }
.pv-field { display: flex; align-items: center; gap: 5px; font-size: 10px; color: var(--text-2); }
.pv-field select { min-width: 75px; height: 27px; }
.pv-snap { display: inline-flex; gap: 5px; align-items: center; padding: 4px 7px; border: 1px solid var(--g-700); border-radius: 4px; font-size: 11px; cursor: pointer; }
.pv-snap span { color: var(--text-3); font-size: 10px; font-variant-numeric: tabular-nums; }
.pv-actions { margin-left: auto; padding-left: 8px; border-left: 1px solid var(--g-700); }
.pvbar button.on { background: var(--g-700); border-color: var(--amber); color: var(--text); }
.pvbar :is(select, button, input):focus-visible, .tabs button:focus-visible { outline: 2px solid var(--amber); outline-offset: -2px; }
.pvbox { margin: 9px; border-radius: 4px; border-color: var(--g-600); background: var(--g-900, #141414); }
.pvbox.design-canvas { background-color: var(--g-900, #141414); background-image: linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px); background-size: 24px 24px; }
.canvas-status { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 5px 12px; border-top: 1px solid var(--g-700); background: var(--g-850); color: var(--text-2); font-size: 10.5px; }
.canvas-status span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@container win (max-width: 930px) { .pv-heading { min-width: 0; } .pv-actions { margin-left: 0; } }
</style>
