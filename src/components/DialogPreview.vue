<script setup>
// Vista previa de un comando de diálogo («Mostrar texto», «Mostrar opciones», «Subtítulo», «Mostrar nombre del mapa») tal como se
// verá en el juego: usa las mismas interfaces que el modo Jugar (el Canvas de la escena con ese uso o la interfaz por defecto), el
// tema del proyecto, los códigos de texto y la animación de entrada/salida elegida en el comando. No ejecuta nada del juego.
import { markRaw, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import AppWindow from './AppWindow.vue'
import UiRoot from '../engine/runtime/ui/UiRoot.vue'
import { store, assetUrl } from '../core/store.js'
import { UiManager } from '../engine/runtime/ui/manager.js'
import { Game } from '../engine/runtime/events/interpreter.js'
import { parseMessage } from '../engine/runtime/events/textcodes.js'
import { normalizeCanvas } from '../engine/runtime/nodes/canvas.js'
import { normalizeAnim } from '../engine/runtime/ui/anim.js'
import { normalizeLevel, levelName, titleAlpha } from '../engine/runtime/world/params.js'

const props = defineProps({
  code: { type: String, default: 'text' }, params: { type: Object, default: () => ({}) },
  inline: { type: Boolean, default: false },
  timelineDialog: { type: Object, default: null }, timelineTime: { type: Number, default: 0 },
})
const emit = defineEmits(['close'])

const ROLES = { text: 'dialog', choices: 'choices', caption: 'caption', levelName: 'levelname' }
const mock = reactive({ on: true, focus: true, started: true, dialog: null, choices: null, caption: null, levelTitle: null, prompt: '', fade: { color: '#000000', alpha: 0, ms: 0 }, letterbox: 0, errors: 0, party: null })
// los códigos que dependen de la base de datos (\I[armor:1], \T[item:2], \N[1], \L, \G) se resuelven con sus registros
const KINDS = { item: 'items', weapon: 'weapons', armor: 'armors', skill: 'skills', state: 'states', class: 'classes', enemy: 'enemies', actor: 'actors', quest: 'quests', lore: 'lore' }
const db = () => store.project.database || {}
function rec(arg) {
  const m = /^(\w+):(.+)$/.exec(String(arg).trim()); if (!m || !KINDS[m[1]]) return null
  const list = db()[KINDS[m[1]]] || [], v = m[2].trim()
  return list.find((r) => String(r.id) === v) || list.find((r) => String(r.name || '').toLowerCase() === v.toLowerCase()) || null
}
const sceneName = () => store.project.scenes.find((x) => x.id === store.project.activeSceneId)?.name
const textCtx = () => ({
  icon: (a) => rec(a)?.icon || '◆',
  name: (a) => rec(a)?.name || String(a),
  level: () => levelName(store.project.environment, sceneName()),
  currency: () => db().system?.currency || '',
  actor: (n) => (typeof n === 'string' ? n : (db().actors || []).find((r) => r.id === n)?.name || `Actor ${n}`),
})
const game = new Game({ database: store.project.database, host: { textCtx } })
const urls = new Map(), byId = reactive({})
const pm = markRaw(new UiManager({
  play: mock, getDocs: () => store.project.uis,
  getConfig: () => props.inline ? { slots: { dialog: store.project.ui?.slots?.dialog } } : store.project.ui,
  getGame: () => game, getTheme: () => store.project.theme,
  // solo las interfaces de diálogo de la escena (sin HUD ni menús)
  getCanvases: () => (store.project.objects || []).filter((o) => o.type === 'canvas' && (props.inline ? normalizeCanvas(o.props).role === 'dialog' : Object.values(ROLES).includes(normalizeCanvas(o.props).role))).map((o) => { const c = normalizeCanvas(o.props); return { id: o.id, name: o.name, ui: c.ui, role: c.role, layer: Number.isFinite(+o.props.layer) ? +o.props.layer : 10, interactive: false, modal: false, visible: c.visible && o.visible !== false } }),
  host: { previewReadOnly: props.inline, assetUrl: (n) => urls.get(String(n).toLowerCase()), assetUrlById: (id) => byId[id], pick: (i) => { if (mock.choices) mock.choices.index = i } }, // el clic solo marca la opción
}))
const state = ref('') // '', 'playing', 'done'
let raf = 0, timer = 0
const stop = () => { cancelAnimationFrame(raf); clearTimeout(timer) }
const anim = () => normalizeAnim({ enter: props.params.enter, exit: props.params.exit, duration: props.params.animTime })
// Modo Timeline: mismo UiManager/UiRoot que el diálogo aislado, pero sobre el viewport.
// El reloj de escritura procede del transporte del Editor; Pause no avanza el texto.
function advanceTimelineDialog() {
  const d = mock.dialog
  if (!props.inline || !d || !props.timelineDialog) return
  const age = Math.max(0, props.timelineTime - (props.timelineDialog.at || 0))
  d.age = age
  d.shown = Math.min(d.text.length, age * (store.project.theme?.speed || 48))
  d.done = d.shown >= d.text.length
}
watch(() => props.timelineDialog, message => {
  if (!props.inline) return
  if (!message) { mock.dialog = null; return }
  const msg = parseMessage(message.text || '')
  mock.dialog = {
    speaker: message.speaker || '', text: msg.plain, msg, runs: msg.runs,
    pos: message.pos || 'bottom', shown: 0, done: false, age: 0, auto: false,
    stay: msg.stay, anim: message.anim || null,
  }
  advanceTimelineDialog()
}, { immediate: true })
watch(() => props.timelineTime, advanceTimelineDialog)

async function play() {
  stop()
  mock.dialog = null; mock.choices = null; mock.caption = null; mock.levelTitle = null
  await new Promise((r) => setTimeout(r, 260)) // deja terminar la salida anterior
  state.value = 'playing'
  const p = props.params
  if (props.code === 'text') {
    const r = game.localize({ text: p.text, speaker: p.speaker, key: p.loc })
    const msg = parseMessage(game.fmt(r.text || '…', {}))
    mock.dialog = { speaker: game.plain(r.speaker, {}), text: msg.plain, msg, runs: msg.runs, pos: p.pos || 'bottom', shown: 0, done: false, age: 0, auto: false, stay: msg.stay, anim: anim() }
    let t0 = performance.now()
    const step = (now) => {
      const d = mock.dialog
      if (!d) return
      const dt = Math.min(0.1, (now - t0) / 1000); t0 = now
      d.shown = Math.min(d.text.length, d.shown + dt * (d.speed || store.project.theme?.speed || 48))
      d.age += dt
      if (d.shown < d.text.length) { raf = requestAnimationFrame(step); return }
      d.done = true
      timer = setTimeout(() => { mock.dialog = null; state.value = 'done' }, 1600)
    }
    raf = requestAnimationFrame(step)
  } else if (props.code === 'choices') {
    const opts = (p.options || []).map((o) => game.plain(o, {}))
    mock.choices = { options: opts.length ? opts : ['…'], prompt: game.plain(p.prompt || '', {}), cancel: p.cancel ?? -1, index: 0, anim: anim() }
    timer = setTimeout(() => { mock.choices = null; state.value = 'done' }, 2600)
  } else if (props.code === 'caption') {
    mock.caption = { id: 1, text: game.fmt(String(p.text || '…'), {}), pos: p.pos || 'bottom', anim: anim() }
    timer = setTimeout(() => { mock.caption = null; state.value = 'done' }, Math.max(0.5, +p.seconds || 3) * 1000)
  } else if (props.code === 'levelName') {
    const lv = normalizeLevel(store.project.environment?.level)
    const text = p.text || levelName(store.project.environment, store.project.scenes.find((x) => x.id === store.project.activeSceneId)?.name) || 'Nombre del mapa'
    const lt = { id: 1, text, pos: p.pos || lv.namePos, alpha: 0, t: 0, delay: lv.nameDelay, in: lv.nameIn, hold: lv.nameHold, out: lv.nameOut }
    mock.levelTitle = lt
    let t0 = performance.now()
    const step = (now) => {
      const cur = mock.levelTitle
      if (!cur) return
      cur.t += (now - t0) / 1000; t0 = now
      const a = titleAlpha(cur.t, cur)
      if (a < 0) { mock.levelTitle = null; state.value = 'done'; return }
      cur.alpha = a
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
  }
}

onMounted(async () => {
  for (const a of store.project.assets || []) {
    if (a.kind !== 'texture' && a.kind !== 'font') continue
    try { const u = await assetUrl(a.id); if (u) { if (a.kind === 'texture') urls.set(a.name.toLowerCase(), u); byId[a.id] = u } } catch { /* sin archivo */ }
  }
  await nextTick()
  if (!props.inline) play()
})
onBeforeUnmount(() => { stop(); pm.reset() })
</script>

<template>
  <div v-if="inline" class="timeline-dialog-stage" data-testid="timeline-preview-dialog" aria-label="Diálogo del Timeline en el viewport">
    <UiRoot :manager="pm" />
  </div>
  <AppWindow v-else title="Vista previa" :width="720" :min-width="420" :min-height="300" :level="70" @close="emit('close')">
    <div class="dpv" data-testid="dialog-preview">
      <div class="stage"><UiRoot :manager="pm" /></div>
      <p class="note lf-help">Como se verá en el juego: la interfaz de la escena para este uso (o la de por defecto), el tema del proyecto y la animación del comando.</p>
    </div>
    <template #footer>
      <button data-testid="preview-replay" @click="play">{{ state === 'playing' ? '↺ Reiniciar' : '▶ Reproducir' }}</button>
      <span style="flex:1"></span>
      <button class="primary" @click="emit('close')">Cerrar</button>
    </template>
  </AppWindow>
</template>

<style scoped>
.timeline-dialog-stage { position: absolute; inset: 0; z-index: 15; pointer-events: none; overflow: hidden; }
.timeline-dialog-stage :deep(*) { pointer-events: none !important; }
.dpv { display: flex; flex-direction: column; gap: 8px; padding: 10px; height: 100%; min-height: 0; }
.stage { position: relative; width: 100%; aspect-ratio: 16 / 9; flex: none; overflow: hidden; border-radius: 6px; border: 1px solid var(--g-600, #333);
  background: radial-gradient(ellipse at 50% 30%, #4b5a6b 0%, #2a333d 55%, #14181d 100%); }
.note { margin: 0; font-size: 11px; color: var(--text-3, #888); }
</style>
