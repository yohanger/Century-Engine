<script setup>
// Nether Film Maker: el editor de cine de Century. Mismo motor y mismos paneles que Century (jerarquía, assets, inspector,
// mezclador, atmósfera) + gradación de color, pasadas de actor y camarógrafo y un timeline multipista como un editor de vídeo.
// En el PC: docks a los lados y abajo. En el móvil: barra de paneles abajo que abre cada panel como hoja.
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { fitFilmFrame } from './frame.js'
import { effectsAt as filmEffectsAt } from './montage.js'
import { Editor } from '../core/editor.js'
import * as S from '../core/store.js'
import { store, setEditor, toast } from '../core/store.js'
import { pickFile } from '../engine/runtime/util.js'
import { RENDERERS, methodOf } from '../engine/runtime/render/config.js'
import { STICKS, J } from '../core/capture/format.js'
import UiRoot from '../engine/runtime/ui/UiRoot.vue'
import AskWindows from '../components/AskWindows.vue'
import ContextMenu from '../components/ContextMenu.vue'
import SceneTree from '../components/SceneTree.vue'
import Inspector from '../components/Inspector.vue'
import ProjectPanel from '../components/ProjectPanel.vue'
import AudioMixer from '../components/AudioMixer.vue'
import ScenePanel from '../components/ScenePanel.vue'
import Splitter from '../components/Splitter.vue'
import NleTimeline from './NleTimeline.vue'
import FilmGlyph from './FilmGlyph.vue'
import Icon from '../components/Icon.vue'
import { run } from '../core/commands.js'
import FilmPanel from './panels/FilmPanel.vue'
import ActorPanel from './panels/ActorPanel.vue'
import CameraPanel from './panels/CameraPanel.vue'
import ColorPanel from './panels/ColorPanel.vue'
import { saveBytes } from './files.js'
import * as F from './session.js'
import { createFilmMobileLink } from './mobile-live-bridge.js'

const { session } = F
const STICK_IDX = STICKS.map(([a, b]) => [J[a], J[b]])
const host = ref(null), stage = ref(null), workspace = ref(null), nle = ref(null), actorPanel = ref(null)
const filmInspectorHost = ref(null)
const narrow = ref(false), dropping = ref(false)
const left = ref('tree'), right = ref('insp'), bottom = ref('nle'), drawer = ref('')
const leftW = ref(250), rightW = ref(340), bottomH = ref(360)
const timelineFocus = ref(false) // Solo distribución de la interfaz; no pertenece a la película.
const screenW = ref(window.innerWidth), workH = ref(Math.max(400, window.innerHeight - 48))
const compactDesk = computed(() => !narrow.value && screenW.value < 1220)
const leftOpen = ref(false), rightOpen = ref(true)
const visibleLeft = computed(() => !compactDesk.value || leftOpen.value)
const visibleRight = computed(() => !compactDesk.value || rightOpen.value)
const bottomMaxH = computed(() => Math.max(150, workH.value - 205))
const effectiveBottomH = computed(() => timelineFocus.value ? bottomMaxH.value : Math.min(bottomH.value, bottomMaxH.value))
// El monitor siempre tiene prioridad sobre los docks, incluso después de arrastrar divisores.
const effectiveLeftW = computed(() => Math.min(leftW.value, Math.max(200, Math.floor(screenW.value * .30))))
const effectiveRightW = computed(() => Math.min(rightW.value, Math.max(260, Math.floor(screenW.value * .31))))
watch(bottom, (tab) => { if (tab !== 'nle') timelineFocus.value = false })
function toggleTimelineFocus() {
  if (!timelineFocus.value) bottom.value = 'nle'
  timelineFocus.value = !timelineFocus.value
}
let workspaceObserver = null
function toggleDock(side) {
  if (side === 'left') { leftOpen.value = !leftOpen.value; if (leftOpen.value) rightOpen.value = false }
  else { rightOpen.value = !rightOpen.value; if (rightOpen.value) leftOpen.value = false }
}

const quality = ref(1)
const stageSize = ref({ width: 1, height: 1 })
const frameSize = computed(() => fitFilmFrame(stageSize.value.width, stageSize.value.height, film.value?.frame))
const frameStyle = computed(() => film.value?.frame
  ? { width: `${frameSize.value.width}px`, height: `${frameSize.value.height}px` }
  : { width: '100%', height: '100%' })
let stageObserver = null
let editor = null, raf = 0, lastRemoteTick = 0
const mobileLink = createFilmMobileLink(() => editor)

const film = computed(() => session.film)
// Overlay de efectos del NLE sobre el visor editorial, aislado del entorno y del Player.
const editFx = computed(() => film.value && !session.playing && !session.montage.on && session.pass.state === 'idle' ? filmEffectsAt(film.value, session.montage.T) : null)
watch(() => [session.film?.id, session.film?.scene?.id], (value, previous) => {
  if (previous?.[0] && (value[0] !== previous[0] || value[1] !== previous[1])) void mobileLink.stop()
})
const frameInfo = computed(() => film.value?.frame ? `${film.value.frame.width} × ${film.value.frame.height}` : 'Encuadre libre')
const openFrameSettings = () => { if (narrow.value) openPanel('film'); else right.value = 'film' }
const bounds = ref(null)
const projectMethod = computed(() => RENDERERS.find((r) => r.id === methodOf(store.project?.render))?.name || '')
const selShotId = computed(() => (nle.value?.sel?.kind === 'shot' ? nle.value.sel.id : ''))
const selectedFilmClip = computed(() => bottom.value === 'nle' && !!nle.value?.sel && !!nle.value?.showProperties)
const filmClipInspectorTarget = computed(() => !narrow.value && visibleRight.value && !timelineFocus.value && bottom.value === 'nle' && right.value === 'insp' ? filmInspectorHost.value : null)
function inspectFilmClip() {
  if (!narrow.value && !timelineFocus.value) { right.value = 'insp'; if (compactDesk.value) rightOpen.value = true }
}
const LEFT = [['tree', 'Jerarquía'], ['actor', 'Actor'], ['cam', 'Cámara']]
const RIGHT = [['insp', 'Inspector'], ['color', 'Color'], ['atmo', 'Atmósfera'], ['film', 'Película']]
const BOTTOM = [['nle', 'Timeline'], ['assets', 'Assets'], ['mixer', 'Mezclador']]
const PANELS = [...BOTTOM.slice(0, 1), ...LEFT, ...RIGHT, ...BOTTOM.slice(1)]
const panelTitle = computed(() => PANELS.find((p) => p[0] === drawer.value)?.[1] || '')
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${String(Math.floor((s % 1) * 10))}`

function layout() {
  screenW.value = window.innerWidth
  narrow.value = screenW.value < 820
  store.ui.mode = narrow.value ? 'phone' : 'desktop'
}
function loop(now = performance.now()) { F.tickInfo(); drawPip(); F.tickRemotePreview(lastRemoteTick ? (now - lastRemoteTick) / 1000 : 0); lastRemoteTick = now; raf = requestAnimationFrame(loop) }

onMounted(async () => {
  layout(); window.addEventListener('resize', layout); window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey)
  workspaceObserver = new ResizeObserver(() => {
    if (workspace.value) workH.value = workspace.value.clientHeight
  })
  if (workspace.value) workspaceObserver.observe(workspace.value)
  // El ResizeObserver del Viewport observa el host; al ajustar el encuadre actualiza la cámara y el render.
  stageObserver = new ResizeObserver(() => {
    const el = stage.value
    if (el) stageSize.value = { width: el.clientWidth, height: el.clientHeight }
  })
  if (stage.value) {
    stageObserver.observe(stage.value)
    stageSize.value = { width: stage.value.clientWidth, height: stage.value.clientHeight }
  }
  editor = new Editor(host.value)
  editor.filmTransformCapture = { active: () => session.author.active, finish: F.finishFilmGizmo, rejectMulti: () => toast('Anima un nodo a la vez; la selección múltiple no se graba', 'error') }
  setEditor(editor)
  window.__lf = { store, editor, S, F } // depuración y pruebas automáticas
  store.filmMode = true
  store.tool = 'select'; store.gizmo = 'translate'
  store.ready = true
  raf = requestAnimationFrame(loop)
  const query = new URLSearchParams(location.search)
  const projectId = query.get('project'), cinematicId = query.get('cinematic')
  const url = query.get('open') // pruebas: ?open=<url de .nfm o .lfproj>
  if (projectId && cinematicId) {
    try {
      const result = await window.lf.cinematic('open', { projectId, cinematicId })
      await F.openNativeFilm(result, projectId, cinematicId)
      bounds.value = F.sceneBounds(); editor.frameAll?.()
    } catch (e) { session.error = e.message || String(e); toast(session.error, 'error', 6000) }
  } else if (url) { try { const r = await fetch(url); await openBytes(new Uint8Array(await r.arrayBuffer()), url) } catch (e) { session.error = e.message } }
})
onBeforeUnmount(() => { void mobileLink.stop(); F.stopNodeAuthoring(); if(editor)editor.filmTransformCapture=null; workspaceObserver?.disconnect(); stageObserver?.disconnect(); cancelAnimationFrame(raf); window.removeEventListener('resize', layout); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); editor?.dispose() })
watch(quality, (q) => { if (!editor) return; editor.vp.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75) * q); editor.vp.resize?.(); editor.vp.requestRender() })

async function openBytes(bytes, name, opts) {
  if (session.native) { toast('Esta ventana edita un Cinematic del proyecto. Para abrir otra película, usa una ventana FilmMaker independiente.', 'error', 6000); return }
  try {
    await mobileLink.stop()
    const r = await F.openFile(bytes, name, opts)
    if (r === 'ok') { bounds.value = F.sceneBounds(); editor.frameAll?.() }
  } catch (e) { console.error(e); session.error = e.message || String(e); toast(session.error, 'error', 6000) }
}
async function open() { const [f] = await pickFile('.nfm,.lfproj,.zip'); if (f) openBytes(new Uint8Array(await f.arrayBuffer()), f.name) }
async function chooseScene(id) { const p = session.pendingScenes; await openBytes(p.bytes, p.name, { sceneId: id }) }
async function exportNfm() {
  try {
    session.busy = 'Exportando…'
    const bytes = await F.buildNfm()
    const where = await saveBytes(bytes, `${(film.value.name || 'pelicula').replace(/[\\/:*?"<>|]+/g, '')}.nfm`, 'application/zip')
    toast(`Película exportada: ${where}`, 'ok', 4000)
  } catch (e) { toast(e.message, 'error', 5000) } finally { session.busy = '' }
}
async function save() {
  if (!session.native) return exportNfm()
  try {
    session.busy = 'Guardando Cinematic…'
    const filmData = JSON.parse(JSON.stringify(F.prepareFilmForSave()))
    const native = session.native
    const reply = await window.lf.cinematic('save', {
      ...native, film: filmData, assets: await F.nativeAssetChanges(),
    })
    if (session.native === native) session.native = { ...native, revision: reply.revision, sceneStamp: reply.sceneStamp }
    toast('Cinematic guardado en el proyecto de Century', 'ok', 4000)
  } catch (e) { toast(e.message, 'error', 6000) } finally { session.busy = '' }
}

function onDrop(e) {
  dropping.value = false
  const f = e.dataTransfer?.files?.[0]
  if (f && /\.(nfm|lfproj|zip)$/i.test(f.name)) f.arrayBuffer().then((b) => openBytes(new Uint8Array(b), f.name))
}
const setGizmo = (g) => { store.tool = 'select'; store.gizmo = g }
async function playMain() { await mobileLink.stop(); // ▶ de arriba: el montaje si hay planos; si no, el entorno
  if (F.montageHasContent()) { if (!session.montage.on) await F.playMontage(session.montage.T >= F.montageEnd() - 0.05 ? 0 : session.montage.T); else F.togglePause() }
  else if (!session.playing) await F.playEnvironment(); else F.togglePause()
}
function stopMain() { F.stopMontage(); F.stopEnvironment() }
const mainPlaying = computed(() => (session.montage.on || session.playing) && !session.paused)
const mainTime = computed(() => (session.montage.on || session.montage.T > 0 ? session.montage.T : session.time))
async function envToggle() { await mobileLink.stop(); if (session.playing && !session.montage.on) await F.stopEnvironment(); else { F.stopMontage(); await F.playEnvironment() } }
function openPanel(id) { drawer.value = drawer.value === id ? '' : id }
function inspectMixerSelection() {
  if (narrow.value) drawer.value = 'insp'
  else { right.value = 'insp'; rightOpen.value = true }
}

// ---------- vídeo del actor (PiP) ----------
const pip = ref(null)
function drawPip() {
  const c = pip.value, L = session.live
  if (!c || !L.on) return
  const ctx = c.getContext('2d'), w = c.width, h = c.height
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h)
  const v = L.video
  const mirror = L.kind === 'camera' && actorPanel.value?.facing === 'user'
  ctx.save(); if (mirror) { ctx.translate(w, 0); ctx.scale(-1, 1) }
  if (v && v.videoWidth) ctx.drawImage(v, 0, 0, w, h)
  const im = L.image
  if (im) { ctx.strokeStyle = '#ffb547'; ctx.lineWidth = 2; for (const [a, b] of STICK_IDX) { ctx.beginPath(); ctx.moveTo(im[a * 4] * w, im[a * 4 + 1] * h); ctx.lineTo(im[b * 4] * w, im[b * 4 + 1] * h); ctx.stroke() } }
  ctx.restore()
  if (!v) { ctx.fillStyle = '#ababab'; ctx.font = '12px sans-serif'; ctx.fillText('Actor simulado', 8, 18) }
}

// ---------- entrada del camarógrafo (ratón, teclado, joystick, pellizco) ----------
const passOn = computed(() => session.pass.state !== 'idle')
let drag = null, pinch = null
function stDown(e) { if (!passOn.value) return; drag = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture?.(e.pointerId) }
function stMove(e) { const o = F.operatorRig(); if (!drag || !o) return; o.look(e.clientX - drag.x, e.clientY - drag.y); drag = { x: e.clientX, y: e.clientY } }
function stUp() { drag = null }
function stWheel(e) {
  const o = F.operatorRig()
  if (!o) return
  // En una pasada, el rig controla la cámara. No entregar el mismo gesto al visor editorial.
  e.preventDefault(); e.stopPropagation()
  if (o.input !== 'mouse') return // sensor, remoto y AR tienen su propia fuente de orientación
  if (store.prefs.navigation !== 'trackpad') { o.wheel(e.deltaY); return }
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? host.value?.clientHeight || 1 : 1
  const limit = (v) => Math.max(-80, Math.min(80, v * unit))
  o.trackpad(limit(e.deltaX), limit(e.deltaY), { pinch: e.ctrlKey, pan: e.shiftKey }, store.prefs)
}
function stTouch(e) {
  const o = F.operatorRig(); if (!o || e.touches.length !== 2) { pinch = null; return }
  const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
  if (pinch) o.zoom = Math.max(1, Math.min(6, o.zoom * (d / pinch)))
  pinch = d
}
function onKey(e) {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target?.tagName) || e.target?.isContentEditable) return
  // Shift+A pertenece al NLE de FilmMaker: nunca invocar la herramienta commands del Editor.
  if (e.type === 'keydown' && e.code === 'KeyA' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat && session.film && !F.operatorRig()) {
    e.preventDefault()
    if (narrow.value) drawer.value = 'nle'
    else bottom.value = 'nle'
    void nextTick(() => nle.value?.openAddMenu())
    return
  }
  const o = F.operatorRig()
  if (!o) return
  if (e.type === 'keydown') o.keys.add(e.code)
  else o.keys.delete(e.code)
}
const joy = ref({ x: 0, y: 0, on: false })
function joyMove(e) {
  const r = e.currentTarget.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2
  let x = (e.clientX - cx) / (r.width / 2), y = -(e.clientY - cy) / (r.height / 2); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l }
  joy.value = { x, y, on: true }; const o = F.operatorRig(); if (o) o.move = { x, y }
}
function joyEnd() { joy.value = { x: 0, y: 0, on: false }; const o = F.operatorRig(); if (o) o.move = { x: 0, y: 0 } }
function setLift(v) { const o = F.operatorRig(); if (o) o.lift = v }
function onRecording() { if (narrow.value) drawer.value = '' }
</script>

<template>
  <div class="fm" :class="{ narrow }" @dragover.prevent="dropping = $event.dataTransfer?.types?.includes('Files')" @dragleave="dropping = false" @drop.prevent="onDrop">
    <header class="bar">
      <b class="brand"><FilmGlyph name="film" /> Nether <span>Film Maker</span></b>
      <span v-if="film" class="title" :title="film.scene.projectName + ' · ' + film.scene.name">{{ film.name }}</span>
      <template v-if="film && compactDesk && !timelineFocus">
        <div class="compact-docks" data-test="compact-docks" role="group" aria-label="Paneles laterales">
          <button :aria-pressed="visibleLeft" data-test="toggle-scene" title="Mostrar u ocultar Jerarquía, Actor y Cámara" @click="toggleDock('left')"><FilmGlyph name="tree" /><span>Escena</span></button>
          <button :aria-pressed="visibleRight" data-test="toggle-inspector" title="Mostrar u ocultar Inspector, Color, Atmósfera y Película" @click="toggleDock('right')"><FilmGlyph name="insp" /><span>Inspector</span></button>
        </div>
      </template>
      <span class="sp"></span>
      <template v-if="film">
        <div class="transport" data-test="env">
          <button class="play" :class="{ on: mainPlaying }" data-test="main-play" title="Reproducir la película (o el entorno si aún no hay planos)" @click="playMain"><FilmGlyph :name="mainPlaying ? 'pause' : 'play'" /></button>
          <button title="Detener" data-test="env-stop" @click="stopMain"><FilmGlyph name="stop" /></button>
          <span class="time" data-test="env-time">{{ fmtT(mainTime) }}</span>
          <button class="env" :class="{ on: session.playing && !session.montage.on }" data-test="env-play" title="Solo el entorno, como en Play (clima, hora, rayos, eventos), con la cámara libre" @click="envToggle"><FilmGlyph name="environment" /></button>
        </div>
        <span class="sp"></span>
        <button class="frame-access" data-test="film-frame-access" :title="'Configurar encuadre · ' + frameInfo" aria-label="Abrir ajustes de encuadre" @click="openFrameSettings"><FilmGlyph name="frame" /><span class="frame-text">{{ frameInfo }}</span></button>
        <label class="sel" title="Método de render de la vista (solo en esta app: elige uno ligero si el equipo va justo)">
          <select v-model="store.view.renderMethod" data-test="render-method" aria-label="Método de render">
            <option value="">Render: proyecto · {{ projectMethod }}</option>
            <option v-for="r in RENDERERS" :key="r.id" :value="r.id">Render: {{ r.name }}</option>
          </select>
        </label>
        <button class="nav-device" :class="{ on: store.prefs.navigation === 'trackpad' }"
          data-test="film-nav-device" :aria-pressed="store.prefs.navigation === 'trackpad'"
          :aria-label="store.prefs.navigation === 'trackpad' ? 'Navegación Laptop (trackpad). Cambiar a PC (ratón)' : 'Navegación PC (ratón). Cambiar a Laptop (trackpad)'"
          :title="store.prefs.navigation === 'trackpad' ? 'Laptop · trackpad: dos dedos para mirar, pellizco para zoom, Mayús + dos dedos para desplazar' : 'PC · ratón: arrastrar para mirar, rueda para zoom'"
          @click="run(store.prefs.navigation === 'trackpad' ? 'nav.mouse' : 'nav.trackpad')">
          <Icon :name="store.prefs.navigation === 'trackpad' ? 'trackpad' : 'mouse'" :size="14" />
        </button>
        <label class="sel" title="Resolución de la vista: más baja = menos memoria y más fluidez">
          <select v-model.number="quality" data-test="quality" aria-label="Calidad de la vista"><option :value="1">Vista 100 %</option><option :value="0.75">Vista 75 %</option><option :value="0.5">Vista 50 %</option><option :value="0.35">Vista 35 %</option></select>
        </label>
        <button class="primary" data-test="save" :title="session.native ? 'Guardar Cinematic en el proyecto' : 'Exportar película .nfm'" @click="save"><FilmGlyph name="save" /><span class="lbl">{{ session.native ? 'Guardar' : 'Guardar .nfm' }}</span></button>
        <button v-if="session.native" type="button" title="Exportar película .nfm para otro proyecto" @click="exportNfm"><FilmGlyph name="open" /><span class="lbl">Exportar .nfm</span></button>
      </template>
      <button data-test="open" title="Abrir película o escena" @click="open"><FilmGlyph name="open" /><span class="lbl">Abrir…</span></button>
    </header>

    <div v-if="!film" class="welcome">
      <h1>Nether <span>Film Maker</span></h1>
      <p class="lf-help">Rueda cinemáticas dentro de tus niveles de Century: el entorno corre como en el juego (clima, hora, rayos, eventos), grabas al actor y la cámara, montas en un timeline con sonido y color, y todo vuelve a Century.</p>
      <template v-if="session.pendingScenes">
        <p><b>{{ session.pendingScenes.project }}</b> tiene varias escenas. ¿En cuál ruedas?</p>
        <div class="scenes"><button v-for="s in session.pendingScenes.list" :key="s.id" data-test="scene-choice" @click="chooseScene(s.id)">{{ s.name }} <small>{{ s.count }} objetos</small></button></div>
      </template>
      <template v-else>
        <button class="primary big" @click="open">Abrir película (.nfm) o escena (.lfproj)…</button>
        <p class="muted lf-help">En Century: <i>Archivo → Nether Film Maker → Exportar escena</i>. También puedes arrastrar el archivo aquí.</p>
      </template>
      <p v-if="session.busy" class="muted">{{ session.busy }}</p>
      <p v-if="session.error" class="err">{{ session.error }}</p>
    </div>

    <div v-show="film" ref="workspace" class="work" :class="{ compactDesk }" data-test="film-workspace">
      <template v-if="film && !narrow && visibleLeft">
        <aside v-show="!timelineFocus" class="dock left" :style="{ width: effectiveLeftW + 'px' }">
          <nav class="tabs"><button v-for="[k, l] in LEFT" :key="k" :title="l" :aria-pressed="left === k" :class="{ on: left === k }" :data-test="'tab-' + k" @click="left = k"><FilmGlyph :name="k" /> {{ l }}</button></nav>
          <div class="pane">
            <SceneTree v-if="left === 'tree'" />
            <ActorPanel v-else-if="left === 'actor'" ref="actorPanel" />
            <CameraPanel v-else :narrow="narrow" :mobile-link="mobileLink" @recording="onRecording" />
          </div>
        </aside>
        <Splitter v-show="!timelineFocus" v-model="leftW" :min="200" :max="460" label="Redimensionar panel izquierdo" />
      </template>

      <div class="center">
        <main ref="stage" class="stage" data-test="film-stage">
          <div class="film-frame" data-test="film-frame" :style="frameStyle">
          <div ref="host" class="host" @pointerdown="stDown" @pointermove="stMove" @pointerup="stUp" @pointercancel="stUp" @wheel.capture="stWheel" @touchmove.passive="stTouch" @touchend="pinch = null"></div>
          <div v-if="editFx" class="film-edit-fx" data-test="film-edit-fx" aria-hidden="true">
            <div v-if="editFx.letterbox" class="film-edit-bars"><i :style="{height: editFx.letterbox + '%'}"></i><i :style="{height: editFx.letterbox + '%'}"></i></div>
            <div v-if="editFx.caption" class="film-edit-caption" :class="'at-' + editFx.captionPos">{{ editFx.caption }}</div>
            <div v-if="editFx.fade" class="film-edit-fade" :style="{backgroundColor: editFx.fadeColor, opacity: editFx.fade}"></div>
          </div>
          <UiRoot v-if="store.play.on && editor" :manager="editor.player.ui" />
          <div v-if="film && !session.playing" class="tools">
            <button :class="{ on: store.gizmo === 'none' }" title="Seleccionar" @click="setGizmo('none')"><FilmGlyph name="select" /></button>
            <button :class="{ on: store.gizmo === 'translate' }" title="Mover" data-test="tool-move" @click="setGizmo('translate')"><FilmGlyph name="move" /></button>
            <button :class="{ on: store.gizmo === 'rotate' }" title="Rotar" @click="setGizmo('rotate')"><FilmGlyph name="rotate" /></button>
            <button :class="{ on: store.gizmo === 'scale' }" title="Escalar" @click="setGizmo('scale')"><FilmGlyph name="scale" /></button>
          </div>
          <template v-if="passOn && session.pass.input !== 'ar' && (session.pass.input === 'sensors' || narrow)">
            <div class="joy" data-test="joy" @pointerdown="joyMove" @pointermove="(e) => joy.on && joyMove(e)" @pointerup="joyEnd" @pointercancel="joyEnd" @pointerleave="joyEnd"><i :style="{ transform: `translate(${joy.x * 34}px, ${-joy.y * 34}px)` }"></i></div>
            <input class="lift" type="range" min="-1" max="0" step="0.01" value="0" title="Agacharse" @input="setLift(+$event.target.value)" />
          </template>
          <canvas v-if="session.live.on" ref="pip" class="pip" width="240" height="135" data-test="pip"></canvas>
          <div v-if="session.rec.state === 'countdown'" class="count">{{ session.rec.count }}<small>Ponte de frente</small></div>
          <div v-if="session.pass.state === 'countdown'" class="count">{{ session.pass.count }}<small>Encuadra: empieza a grabar la cámara</small></div>
          <div v-if="session.rec.state === 'rec'" class="recdot">● REC {{ session.rec.t.toFixed(1) }} s</div>
          <div v-if="session.pass.state === 'rec'" class="recdot">● CÁMARA {{ session.pass.t.toFixed(1) }} s</div>
          <div v-if="session.view.index >= 0" class="recdot view">▶ {{ film.passes[session.view.index]?.name }} · {{ session.view.t.toFixed(1) }} s</div>
          <div v-if="session.playing && !session.montage.on && session.pass.state === 'idle' && session.rec.state === 'idle' && session.view.index < 0" class="badge">{{ session.paused ? 'En pausa' : 'Entorno en marcha' }}</div>
          <div v-if="dropping" class="drop">Suelta el .nfm o .lfproj</div>
          </div>
        </main>
        <template v-if="film && !narrow">
          <Splitter v-show="!timelineFocus" v-model="bottomH" dir="y" px invert :min="150" :max="bottomMaxH" label="Redimensionar altura de Timeline" />
          <section class="dock bottom" :style="{ height: effectiveBottomH + 'px' }">
            <div class="bottom-head">
              <nav class="tabs"><button v-for="[k, l] in BOTTOM" :key="k" :title="l" :aria-pressed="bottom === k" :class="{ on: bottom === k }" :data-test="'tab-' + k" @click="bottom = k"><FilmGlyph :name="k" /> {{ l }}</button></nav>
              <button class="timeline-focus" :class="{ on: timelineFocus }" data-test="film-timeline-focus" :aria-pressed="timelineFocus" :title="timelineFocus ? 'Restaurar paneles y tamaño de Timeline' : 'Ampliar Timeline sin cerrar el visor'" @click="toggleTimelineFocus"><FilmGlyph name="frame" :size="14" /><span>{{ timelineFocus ? 'Restaurar' : 'Ampliar' }}</span></button>
            </div>
            <div class="pane flush">
              <NleTimeline v-show="bottom === 'nle'" ref="nle" :inspector-target="filmClipInspectorTarget" @inspect-clip="inspectFilmClip" />
              <ProjectPanel v-if="bottom === 'assets'" />
              <AudioMixer v-if="bottom === 'mixer'" @inspect="inspectMixerSelection" />
            </div>
          </section>
        </template>
      </div>

      <template v-if="film && !narrow && visibleRight">
        <Splitter v-show="!timelineFocus" v-model="rightW" invert :min="260" :max="520" label="Redimensionar panel derecho" />
        <aside v-show="!timelineFocus" class="dock right" :style="{ width: effectiveRightW + 'px' }">
          <nav class="tabs"><button v-for="[k, l] in RIGHT" :key="k" :title="l" :aria-pressed="right === k" :class="{ on: right === k }" :data-test="'tab-' + k" @click="right = k"><FilmGlyph :name="k" /> {{ l }}</button></nav>
          <div class="pane">
            <div v-if="right === 'insp'" class="film-nle-inspector-switch">
              <div ref="filmInspectorHost" v-show="selectedFilmClip" class="film-nle-inspector-host" data-test="film-clip-inspector-host"></div>
              <Inspector v-show="!selectedFilmClip" />
            </div>
            <ColorPanel v-else-if="right === 'color'" :shot-id="selShotId" />
            <div v-else-if="right === 'atmo'" class="atmo"><ScenePanel /></div>
            <FilmPanel v-else :bounds="bounds" :quality="quality" @quality="quality = $event" @replaced="bounds = F.sceneBounds()" />
          </div>
        </aside>
      </template>
    </div>

    <!-- móvil: barra de paneles + hoja -->
    <template v-if="film && narrow">
      <div v-if="drawer" class="sheet" :class="{ tall: drawer === 'nle' || drawer === 'color' }" data-test="sheet">
        <div class="sh"><b>{{ panelTitle }}</b><button class="x" aria-label="Cerrar" @click="drawer = ''">✕</button></div>
        <div class="pane" :class="{ flush: ['nle', 'assets', 'mixer', 'tree'].includes(drawer) }">
          <NleTimeline v-show="drawer === 'nle'" ref="nle" compact />
          <SceneTree v-if="drawer === 'tree'" />
          <ActorPanel v-if="drawer === 'actor'" ref="actorPanel" />
          <CameraPanel v-if="drawer === 'cam'" narrow @recording="onRecording" />
          <Inspector v-if="drawer === 'insp'" />
          <ColorPanel v-if="drawer === 'color'" :shot-id="selShotId" compact />
          <div v-if="drawer === 'atmo'" class="atmo"><ScenePanel /></div>
          <FilmPanel v-if="drawer === 'film'" :bounds="bounds" :quality="quality" @quality="quality = $event" @replaced="bounds = F.sceneBounds()" />
          <ProjectPanel v-if="drawer === 'assets'" />
          <AudioMixer v-if="drawer === 'mixer'" @inspect="inspectMixerSelection" />
        </div>
      </div>
      <nav class="mnav" data-test="mnav"><button v-for="[k, l] in PANELS" :key="k" :aria-label="l" :aria-pressed="drawer === k" :class="{ on: drawer === k }" :data-test="'m-' + k" @click="openPanel(k)"><FilmGlyph :name="k" /><span>{{ l }}</span></button></nav>
    </template>

    <ContextMenu v-if="store.menu" />
    <AskWindows />
    <div class="toasts"><div v-for="t in store.toasts" :key="t.id" class="toast" :class="t.kind">{{ t.msg }}</div></div>
  </div>
</template>

<style scoped>
.fm { position: fixed; inset: 0; display: flex; flex-direction: column; background: var(--g-900); color: var(--text); font: 12px/1.4 'IBM Plex Sans', system-ui, sans-serif; overflow: hidden; }
.bar { height: 42px; flex: none; display: flex; align-items: center; gap: 6px; padding: 0 10px; background: var(--g-850); border-bottom: 1px solid var(--hair); min-width: 0; }
.brand { font-size: 14px; letter-spacing: .02em; white-space: nowrap; } .brand span { color: var(--amber); font-weight: 600; }
.title { color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; max-width: 260px; }
.sp { flex: 1; }
.bar button { white-space: nowrap; }
.nav-device { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 28px; height: 26px; padding: 0; background: var(--g-800); color: var(--text-3); border: 1px solid var(--hair); border-radius: 5px; }
.nav-device:hover { color: var(--text); background: var(--g-700); }
.nav-device.on { color: var(--blue-hi); background: var(--blue-wash); }
.transport { display: flex; align-items: center; gap: 3px; background: var(--g-800); border-radius: 6px; padding: 2px; }
.transport button { min-width: 32px; } .transport .play.on, .transport .env.on { background: var(--blue); color: #fff; border-color: var(--blue); }
.time { font-variant-numeric: tabular-nums; padding: 0 6px; color: var(--text-2); }
.sel select { height: 26px; background: var(--g-800); border: 1px solid var(--hair); border-radius: 5px; color: var(--text); font-size: 12px; max-width: 190px; }
.work { flex: 1; min-height: 0; display: flex; }
.center { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.dock { background: var(--g-850); display: flex; flex-direction: column; min-height: 0; flex: none; overflow: hidden; }
.dock.left { border-right: 1px solid var(--hair); } .dock.right { border-left: 1px solid var(--hair); } .dock.bottom { border-top: 1px solid var(--hair); }
.bottom-head { display: flex; align-items: stretch; min-width: 0; flex: none; border-bottom: 1px solid var(--hair); background: var(--g-900); }
.bottom-head .tabs { flex: 1; min-width: 0; border-bottom: 0; }
.timeline-focus { display: inline-flex; align-items: center; justify-content: center; gap: 5px; flex: none; margin: 3px 6px; padding: 0 9px; border: 1px solid var(--hair); border-radius: 4px; background: var(--g-850); color: var(--text-2); font-size: 11px; white-space: nowrap; }
.timeline-focus:hover, .timeline-focus.on { color: var(--text); border-color: var(--g-600); background: var(--g-700); }
.tabs { display: flex; gap: 2px; padding: 4px 6px 0; background: var(--g-900); border-bottom: 1px solid var(--hair); flex: none; overflow-x: auto; scrollbar-width: none; }
.tabs button { height: 26px; padding: 0 10px; border: 1px solid transparent; border-bottom: none; border-radius: 5px 5px 0 0; background: transparent; color: var(--text-3); white-space: nowrap; }
.tabs button.on { background: var(--g-850); border-color: var(--hair); color: var(--text); box-shadow: inset 0 2px 0 var(--blue); }
.pane { flex: 1; min-height: 0; overflow: auto; } .pane.flush { overflow: hidden; display: flex; flex-direction: column; } .pane.flush > * { flex: 1; min-height: 0; }
.atmo { padding: 0; }
.stage { position: relative; flex: 1; min-height: 0; min-width: 0; background: #07090b; overflow: hidden; }
.film-frame { position: absolute; inset: 0; margin: auto; overflow: hidden; }
.host { position: absolute; inset: 0; touch-action: none; }
.film-edit-fx { position: absolute; inset: 0; z-index: 2; pointer-events: none; overflow: hidden; }
.film-edit-bars { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: space-between; }
.film-edit-bars i { background: #000; display: block; width: 100%; }
.film-edit-caption { position: absolute; left: 7%; right: 7%; text-align: center; color: #fff; font-weight: 600; font-size: clamp(13px, 1.5vw, 25px); text-shadow: 0 2px 5px #000, 0 0 6px #000; white-space: pre-wrap; }
.film-edit-caption.at-bottom { bottom: 9%; }.film-edit-caption.at-top { top: 9%; }.film-edit-caption.at-center { top: 50%; transform: translateY(-50%); }
.film-edit-fade { position: absolute; inset: 0; }
.tools { position: absolute; left: 10px; top: 10px; display: flex; flex-direction: column; gap: 4px; z-index: 5; }
.tools button { width: 36px; height: 36px; font-size: 16px; background: #0d0d0dcc; } .tools button.on { background: var(--blue); color: #fff; }
.badge { position: absolute; left: 50%; top: 10px; transform: translateX(-50%); background: #000a; padding: 4px 10px; border-radius: 12px; z-index: 5; white-space: nowrap; }
.welcome { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 10px; padding: 24px; background: radial-gradient(ellipse at center, #1b1b1b, #0a0a0a); }
.welcome h1 { margin: 0; font-size: 30px; } .welcome h1 span { color: var(--amber); }
.welcome p { max-width: 600px; color: var(--text-2); margin: 0; font-size: 13px; }
.big { padding: 10px 18px; font-size: 14px; }
.scenes { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; } .scenes small { color: var(--text-3); margin-left: 4px; }
.err { color: #ff9a92; } .muted { color: var(--text-3); }
.drop { position: absolute; inset: 12px; border: 2px dashed var(--amber); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px; background: #0008; z-index: 10; }
.joy { position: absolute; left: 24px; bottom: 24px; width: 110px; height: 110px; border-radius: 50%; background: #0007; border: 1px solid var(--g-600); z-index: 8; touch-action: none; display: flex; align-items: center; justify-content: center; }
.joy i { width: 42px; height: 42px; border-radius: 50%; background: var(--blue); opacity: .85; pointer-events: none; }
.lift { position: absolute; right: 18px; bottom: 30px; height: 120px; writing-mode: vertical-lr; direction: rtl; z-index: 8; }
.pip { position: absolute; left: 10px; bottom: 10px; width: 240px; height: 135px; border-radius: 6px; border: 1px solid var(--g-600); z-index: 5; background: #000; }
.count { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 96px; font-weight: 700; text-shadow: 0 2px 12px #000; z-index: 7; pointer-events: none; }
.count small { font-size: 16px; font-weight: 500; }
.recdot { position: absolute; right: 10px; top: 10px; background: #000a; color: #ff6b6b; padding: 4px 10px; border-radius: 12px; font-weight: 600; z-index: 6; } .recdot.view { color: var(--blue-hi); }
.toasts { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 6px; z-index: 200; pointer-events: none; max-width: 92vw; }
.toast { background: var(--g-700); border: 1px solid var(--g-600); padding: 7px 13px; border-radius: 6px; } .toast.ok { border-color: rgba(95, 200, 143, .5); } .toast.error { border-color: rgba(229, 88, 79, .6); color: #ff9a92; }

/* paneles propios (Película, Actor, Cámara, Color) */
:deep(.pn) { display: flex; flex-direction: column; gap: 10px; padding: 12px; }
:deep(.pn .f) { display: flex; flex-direction: column; gap: 4px; color: var(--text-2); font-size: 12px; }
:deep(.pn .row) { display: flex; gap: 6px; align-items: center; } :deep(.pn .row input[type=range]) { flex: 1; } :deep(.pn .row b) { min-width: 52px; text-align: right; color: var(--text); font-weight: 500; }
:deep(.pn dl) { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0; } :deep(.pn dt) { color: var(--text-3); } :deep(.pn dd) { margin: 0; }
:deep(.pn .hint) { color: var(--text-3); font-size: 12px; margin: 0; } :deep(.pn .hint.warn) { color: var(--warn); } :deep(.pn .hint.ok) { color: var(--ok); }
:deep(.pn .seg) { display: flex; gap: 4px; } :deep(.pn .seg button) { flex: 1; } :deep(.pn .seg button.on) { background: var(--blue); color: #fff; border-color: var(--blue); }
:deep(.pn h4) { margin: 6px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-3); }
:deep(.pn .list) { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
:deep(.pn .list li) { display: flex; align-items: center; gap: 6px; justify-content: space-between; padding: 4px 6px; background: var(--g-800); border-radius: 4px; }
:deep(.pn .list li span) { flex: 1; } :deep(.pn .lnk) { cursor: pointer; text-decoration: underline dotted; }
:deep(.film-direct-cameras) { display: flex; flex-direction: column; gap: 4px; }
:deep(.film-direct-camera) { border: 1px solid var(--hair); border-radius: 4px; padding: 7px 9px; background: var(--g-800); color: var(--text-2); cursor: grab; font-size: 12px; }
:deep(.film-direct-camera:hover) { background: var(--g-700); color: var(--text); border-color: var(--g-600); }
:deep(.film-direct-camera[draggable="false"]) { opacity: .55; cursor: not-allowed; }
:deep(.film-direct-camera span) { margin-right: 7px; color: var(--blue-hi); }

:deep(.pn .takes input) { flex: 1; min-width: 0; background: transparent; border: 0; color: var(--text); } :deep(.pn .takes small) { color: var(--text-3); }
:deep(.pn .chk) { display: flex; gap: 6px; align-items: flex-start; font-size: 12px; color: var(--text-2); }
:deep(.pn .rec) { background: #8e2a26; border-color: #b8403a; color: #fff; } :deep(.pn .rec.on) { background: #e5584f; }

/* móvil */
.narrow .bar { height: 46px; padding: 0 6px; gap: 4px; }
.narrow .brand span, .narrow .title, .narrow .bar .sel, .narrow .bar .nav-device, .narrow .lbl { display: none; }
.bar .ic { display: none; } .bar .nav-device :deep(.ic) { display: block; } .narrow .bar .ic { display: inline; }
.narrow .work { padding-bottom: 54px; }
.mnav { position: fixed; left: 0; right: 0; bottom: 0; height: 54px; display: flex; overflow-x: auto; background: var(--g-850); border-top: 1px solid var(--hair); z-index: 30; padding-bottom: env(safe-area-inset-bottom); scrollbar-width: none; }
.mnav button { flex: 0 0 auto; min-width: 64px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; background: none; border: 0; border-radius: 0; color: var(--text-3); font-size: 10px; padding: 0 6px; }
.mnav button i { font-style: normal; font-size: 17px; } .mnav button.on { color: var(--text); box-shadow: inset 0 2px 0 var(--blue); }
.sheet { position: fixed; left: 0; right: 0; bottom: 54px; height: 48vh; background: var(--g-850); border-top: 1px solid var(--g-600); border-radius: 12px 12px 0 0; z-index: 25; display: flex; flex-direction: column; box-shadow: 0 -8px 24px #0009; }
.sheet.tall { height: 62vh; }
.sh { display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-bottom: 1px solid var(--hair); }
.sh .x { background: none; border: 0; font-size: 15px; color: var(--text-2); }
.narrow .joy { bottom: 18px; } .narrow .lift { bottom: 24px; }
.narrow .pip { width: 144px; height: 81px; top: 10px; left: auto; right: 10px; bottom: auto; }
.narrow .toasts { bottom: 66px; }
</style>
