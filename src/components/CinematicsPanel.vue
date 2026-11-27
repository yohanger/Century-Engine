<script setup>
// Visor de películas importadas desde Nether Film Maker. Sin operaciones de autoría.
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { dockPanelIsActive } from '../core/editor/docking.js'
import * as db from '../core/db.js'
import { isFilmMakerTimeline, readonlyTimelineLanes, TRACK_KINDS } from '../core/timeline/model.js'
import { TimelinePreview } from '../core/timeline/preview.js'
import { store, toast, worldMatrix } from '../core/store.js'
import { importFilmDialog, importFilm, runFilmCinematic, openFilmmaker, openNativeCinematic } from '../core/state/film.js'
import Icon from './Icon.vue'

const films = computed(() => (store.project?.timelines || []).filter(isFilmMakerTimeline))
const selected = computed(() => films.value.find(t => t.id === store.cinematicId) || null)
const editSelected = () => selected.value?.filmMaker?.nativeResourceId ? openNativeCinematic(selected.value.filmMaker.nativeResourceId) : openFilmmaker()
const visible = computed(() => store.ui.mode === 'desktop'
  ? dockPanelIsActive(store.prefs.dockLayout, store.prefs, 'anim')
  : store.prefs.bottomTab === 'anim')
// Proyectos que importaron .nfm antes como archivo genérico: resolverlos desde Assets una vez por sesión.
// Los archivos no se eliminan ni se reinterpretan como películas sin validar el contenido.
const storedNfm = computed(() => (store.project?.assets || []).filter(a => a.ext === 'nfm' || /\.nfm$/i.test(a.name)).map(a => ({ id: a.id, projectId: store.project.id, name: a.name })))
const processedNfm = new Set()
let scanningNfm = false
async function reconcileStoredNfm() {
  if (scanningNfm || !visible.value || !store.project || store.play.on) return
  scanningNfm = true
  try {
    for (const asset of storedNfm.value) {
      const key = `${asset.projectId}:${asset.id}`
      if (processedNfm.has(key)) continue
      processedNfm.add(key)
      try {
        const saved = await db.getAsset(asset.projectId, asset.id)
        if (!saved?.bytes || store.project?.id !== asset.projectId) continue
        await importFilm(new Uint8Array(saved.bytes), { applyScene: false })
      } catch (error) {
        toast(`Cinematics: ${asset.name}: ${error.message}`, 'error', 6000)
      }
    }
  } finally { scanningNfm = false }
}
watch([storedNfm, visible, () => store.play.on], reconcileStoredNfm, { immediate: true })
const search = ref('')
const listing = computed(() => films.value.filter(t => `${t.name} ${t.filmMaker.filmName}`.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())))
const time = ref(0), playing = ref(false), importing = ref(false), runtimeId = ref(null), runtimeStarting = ref(false)
const zoom = ref(55)
const scroller = ref(null)
const shotNow = computed(() => selected.value?.filmMaker?.reel?.shots?.find(s => time.value >= s.start && time.value < s.end) || null)
const clipCount = computed(() => lanes.value.reduce((count, lane) => count + lane.segments.length, 0))
const colors = { shot: '#d3a258', actor: '#6dbca5', text: '#bb89cf', fade: '#cb876d', letterbox: '#9689bc', shake: '#d77689' }
const laneColor = lane => colors[lane.kind] || TRACK_KINDS[lane.kind]?.color || '#7d92a8'
function fitZoom() {
  if (!selected.value) return
  const width = (scroller.value?.clientWidth || 600) - 170 - 32
  zoom.value = Math.max(5, Math.min(280, width / Math.max(0.5, selected.value.duration)))
  if (scroller.value) scroller.value.scrollLeft = 0
}
function onTimelineKeydown(event) {
  if (!selected.value) return
  const moves = { ArrowLeft: -0.1, ArrowRight: 0.1, PageUp: -1, PageDown: 1 }
  if (event.key in moves) seek(time.value + moves[event.key])
  else if (event.key === 'Home') seek(0)
  else if (event.key === 'End') seek(selected.value.duration)
  else if (event.code === 'Space') toggle()
  else return
  event.preventDefault()
}
const lanes = computed(() => selected.value ? readonlyTimelineLanes(selected.value) : [])
const sequenceWidth = computed(() => Math.max(300, Math.ceil((selected.value?.duration || 1) * zoom.value) + 48))
const timelineTicks = computed(() => {
  const duration = selected.value?.duration || 0
  const step = [0.1, .2, .5, 1, 2, 5, 10, 20, 30, 60, 120, 300, 600].find(n => n * zoom.value >= 58) || 600
  const out = []
  for (let t = 0; t <= duration + 0.0001 && out.length < 250; t += step) out.push(+t.toFixed(4))
  return out
})
const zoomBy = factor => { zoom.value = Math.min(280, Math.max(5, zoom.value * factor)) }
function seekTimeline(event) {
  if (!selected.value || (store.play.on && runtimeId.value !== selected.value.id)) return
  const bounds = event.currentTarget.getBoundingClientRect()
  seek((event.clientX - bounds.left) / zoom.value)
}
let raf = 0, last = 0, runtimeRaf = 0
function runtimeTick() {
  runtimeRaf = 0
  if (!runtimeId.value) return
  if (!store.play.on) { runtimeRaf = requestAnimationFrame(runtimeTick); return }
  const info = store.editor?.player?.timelineInfo(runtimeId.value)
  if (!info && runtimeStarting.value) { runtimeRaf = requestAnimationFrame(runtimeTick); return }
  if (!info) { runtimeId.value = null; playing.value = false; return }
  time.value = Math.min(info.duration, Math.max(0, info.time))
  playing.value = !info.paused
  runtimeRaf = requestAnimationFrame(runtimeTick)
}
async function playFullMovie() {
  const current = selected.value
  if (!current || runtimeId.value) return
  stop({ rewind: false })
  try {
    // PlayMode inicia la sesión del juego antes de despachar comandos, métodos o audio.
    runtimeStarting.value = true
    const pending = runFilmCinematic(current, { from: time.value, onStart: () => { runtimeStarting.value = false } })
    // runFilmCinematic resuelve al terminar la película; el inicio del Player es asíncrono.
    // La sincronización solo se activa cuando el runner esté disponible.
    runtimeId.value = current.id
    if (!runtimeRaf) runtimeRaf = requestAnimationFrame(runtimeTick)
    await pending
  } catch (error) { toast('No se pudo reproducir la película: ' + error.message, 'error', 6000) }
  finally { runtimeStarting.value = false; if (runtimeId.value === current?.id) { runtimeId.value = null; playing.value = false } }
}
function stopPlayback() {
  if (runtimeId.value) {
    store.editor?.player?.timelineStop(runtimeId.value)
    runtimeId.value = null; runtimeStarting.value = false; cancelAnimationFrame(runtimeRaf); runtimeRaf = 0
  }
  stop()
}
const preview = new TimelinePreview({ getEditor: () => store.editor, getObjects: () => store.project?.objects || [], worldMatrix })
const formatTime = value => { const t = Math.max(0, Number(value) || 0); return `${Math.floor(t / 60).toString().padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}` }
function stop({ rewind = true } = {}) {
  playing.value = false; cancelAnimationFrame(raf); raf = 0
  if (rewind) time.value = 0
  preview.stop()
}
function choose(id) {
  if (!films.value.some(t => t.id === id)) return
  if (runtimeId.value) stopPlayback()
  else stop()
  store.cinematicId = id
  store.projSel = { kind: 'cinematic', id }
  store.temporalSelection = null
}
function step(now) {
  raf = 0
  const current = selected.value
  if (!playing.value || !current || !visible.value || store.play.on) { stop({ rewind: false }); return }
  const delta = Math.max(0, Math.min(.1, (now - last) / 1000)); last = now
  time.value = Math.min(current.duration, time.value + delta)
  if (time.value >= current.duration) { playing.value = false; return }
  raf = requestAnimationFrame(step)
}
function toggle() {
  const current = selected.value
  if (!current) return
  if (runtimeId.value === current.id && store.play.on) {
    const info = store.editor?.player?.timelineInfo(current.id)
    store.editor.player.timelineControl(current.id, info?.paused ? 'resume' : 'pause')
    return
  }
  if (store.play.on) return
  if (playing.value) { playing.value = false; cancelAnimationFrame(raf); raf = 0; return }
  if (time.value >= current.duration) time.value = 0
  playing.value = true; last = performance.now(); raf = requestAnimationFrame(step)
}
function seek(value) {
  if (!selected.value) return
  const next = Math.max(0, Math.min(selected.value.duration, Number(value) || 0))
  if (runtimeId.value === selected.value.id && store.play.on) store.editor?.player?.timelineControl(selected.value.id, 'seek', next)
  else if (!store.play.on) time.value = next
}
async function importMovie() {
  if (importing.value) return
  importing.value = true
  const before = new Set(films.value.map(t => t.id))
  try {
    const result = await importFilmDialog()
    if (!result) return
    const created = films.value.filter(t => !before.has(t.id))
    const preferred = created.find(t => t.name === result.montage) || created.at(-1) || (result.reused && films.value.find(t => t.filmMaker.filmId === result.filmId && t.name === result.montage))
    if (preferred) choose(preferred.id)
  } finally { importing.value = false }
}
watch(() => store.projSel, (selection) => {
  if (selection?.kind === 'cinematic' && selection.id !== store.cinematicId && films.value.some(t => t.id === selection.id)) {
    stop(); store.cinematicId = selection.id
  } else if (selection?.kind !== 'cinematic') stop({ rewind: false })
})
watch(() => store.project?.id, () => { stop(); store.cinematicId = null; search.value = '' })
watch(() => selected.value?.id, (id, old) => { if (id !== old) { stop(); zoom.value = 55 } })
watch(() => [visible.value, store.play.on, store.project?.activeSceneId], () => {
  if (!visible.value || store.play.on) stop({ rewind: false })
  else if (selected.value && selected.value.filmMaker.sceneId !== store.project.activeSceneId) stop({ rewind: false })
})
watch([selected, time, visible], () => {
  const current = selected.value
  preview.apply(current, time.value, { enabled: !!current && visible.value && !store.play.on && store.projSel?.kind === 'cinematic' && store.projSel.id === current.id && current.filmMaker.sceneId === store.project?.activeSceneId })
}, { flush: 'post' })
onBeforeUnmount(() => { stop(); cancelAnimationFrame(runtimeRaf); runtimeRaf = 0 })
</script>

<template>
  <section class="cinematics" data-test="cinematics-viewer" aria-label="Cinematics — reproductor de FilmMaker">
    <header class="top">
      <div class="heading"><Icon name="play" :size="16" /><div><strong>Cinematics</strong><small>Nether FilmMaker</small></div></div>
      <div class="actions">
        <button class="ghost" type="button" :disabled="importing" @click="importMovie"><Icon name="import" :size="14" /> Importar .nfm</button>
        <button class="ghost" type="button" @click="editSelected"><Icon name="play" :size="14" /> Abrir FilmMaker</button>
      </div>
    </header>
    <div class="workspace">
      <aside class="library" aria-label="Biblioteca de películas FilmMaker">
        <label class="find"><Icon name="search" :size="13" /><input v-model="search" type="search" placeholder="Buscar película…" aria-label="Buscar película" /></label>
        <div class="library-caption"><span>PELÍCULAS</span><span class="counter">{{ films.length }}</span></div>
        <button v-for="film in listing" :key="film.id" type="button" class="movie" :class="{active: selected?.id === film.id}" :aria-pressed="selected?.id === film.id" @click="choose(film.id)">
          <span class="movie-symbol"><Icon name="play" :size="14" /></span>
          <span class="movie-name"><b :title="film.name">{{ film.name }}</b><small>{{ film.filmMaker.kind === 'montage' ? 'Montaje' : 'Toma' }} · {{ formatTime(film.duration) }}</small></span>
        </button>
        <p v-if="!films.length" class="empty-library">No hay películas con montaje reproducible.</p>
        <p v-else-if="!listing.length" class="empty-library">Sin coincidencias.</p>
      </aside>
      <main class="player">
        <template v-if="selected">
          <div class="movie-summary">
            <div class="movie-identity">
              <span class="eyebrow">{{ selected.filmMaker.kind === 'montage' ? 'MONTAJE DE PELÍCULA' : 'PASE DE CÁMARA' }}</span>
              <strong :title="selected.name">{{ selected.name }}</strong>
              <span class="source-name" :title="selected.filmMaker.filmName">{{ selected.filmMaker.filmName }}</span>
            </div>
            <div class="summary-metrics">
              <div><span>DURACIÓN</span><strong>{{ formatTime(selected.duration) }}</strong></div>
              <div><span>PISTAS</span><strong>{{ lanes.length }}</strong></div>
              <div><span>SEGMENTOS</span><strong>{{ clipCount }}</strong></div>
            </div>
          </div>
          <div v-if="selected.filmMaker.sceneId !== store.project.activeSceneId" class="notice" role="status">Activa la escena de esta película para previsualizarla.</div>
          <div class="timeline-panel">
            <div class="timeline-toolbar">
              <div class="transport" role="group" aria-label="Transporte de película">
                <button type="button" class="icon-button" aria-label="Ir al inicio" data-tooltip="Ir al inicio" @click="seek(0)"><Icon name="undo" :size="15" /></button>
                <button type="button" class="icon-button primary-control" :disabled="store.play.on && runtimeId !== selected.id" :aria-label="playing ? 'Pausar' : 'Reproducir vista previa'" @click="toggle"><Icon :name="playing ? 'pause' : 'play'" :size="16" /></button>
                <button type="button" class="icon-button" aria-label="Detener" @click="stopPlayback"><Icon name="stop" :size="14" /></button>
                <span class="time">{{ formatTime(time) }} <i>/</i> {{ formatTime(selected.duration) }}</span>
              </div>
              <div class="sequence-zoom" role="group" aria-label="Escala temporal">
                <button type="button" aria-label="Alejar Timeline" @click="zoomBy(1 / 1.4)"><Icon name="minus" :size="14" /></button>
                <button type="button" aria-label="Ajustar duración a ventana" @click="fitZoom"><Icon name="frame" :size="14" /></button>
                <button type="button" aria-label="Acercar Timeline" @click="zoomBy(1.4)"><Icon name="plus" :size="14" /></button>
              </div>
              <button type="button" class="play-full" :disabled="!!runtimeId || selected.filmMaker.sceneId !== store.project.activeSceneId" @click="playFullMovie"><Icon name="play" :size="13" /> Reproducir en Juego</button>
            </div>
            <div class="sequence" ref="scroller" role="region" aria-label="Timeline cinematográfica de solo lectura" tabindex="0" @keydown="onTimelineKeydown">
              <div class="sequence-content" :style="{ width: `${sequenceWidth + 164}px` }">
                <div class="sequence-line ruler-line"><span class="sequence-label ruler-caption">PISTAS <small>{{ lanes.length }}</small></span>
                  <div class="sequence-canvas" :style="{ width: `${sequenceWidth}px` }" @click="seekTimeline">
                    <span v-for="tick in timelineTicks" :key="tick" class="tick" :style="{ left: `${tick * zoom}px` }">{{ formatTime(tick) }}</span>
                    <span class="playhead" :style="{ left: `${time * zoom}px` }"></span>
                  </div>
                </div>
                <div v-for="lane in lanes" :key="lane.id" class="sequence-line" :class="{ 'is-muted': lane.muted }">
                  <span class="sequence-label" :title="lane.name"><small>{{ lane.group }}</small><b>{{ lane.name }}</b></span>
                  <div class="sequence-canvas lane-canvas" :style="{ width: `${sequenceWidth}px`, backgroundSize: `${Math.max(12, zoom)}px 100%` }" @click="seekTimeline">
                    <span v-for="(clip, idx) in lane.segments" :key="idx" class="sequence-segment" :class="{ event: clip.kind === 'event', muted: lane.muted }"
                      :style="{ left: `${clip.start * zoom}px`, width: `${Math.max(4, (clip.end - clip.start) * zoom)}px`, '--clip-color': laneColor(lane) }"
                      :title="`${clip.label} · ${formatTime(clip.start)}–${formatTime(clip.end)}`"><span>{{ clip.label }}</span></span>
                    <span v-for="key in lane.keys" :key="key.id" class="key-marker" :style="{ left: `${key.t * zoom}px`, '--clip-color': laneColor(lane) }" :title="`Clave · ${formatTime(key.t)}`"></span>
                    <span class="playhead" :style="{ left: `${time * zoom}px` }"></span>
                  </div>
                </div>
                <div v-if="!lanes.length" class="sequence-empty">La película no contiene pistas temporales representables.</div>
              </div>
            </div>
            <div class="timeline-footer">
              <span v-if="shotNow" class="current-shot" :title="shotNow.name"><Icon name="camera" :size="12" /> {{ shotNow.name }} <span v-if="shotNow.camera">· {{ shotNow.camera }}</span></span>
              <span v-else class="current-shot">{{ selected.filmMaker.kind === 'montage' ? 'Montaje importado' : 'Toma importada' }}</span>
              <span class="scale-label">{{ Math.round(zoom) }} px/s</span>
            </div>
          </div>
        </template>
        <div v-else class="player-empty"><Icon name="play" :size="26"/><strong>Selecciona una película</strong><p>Importa un montaje desde FilmMaker para consultar sus tomas, pistas y duración.</p></div>
      </main>
    </div>
  </section>
</template>

<style scoped>
.cinematics { container-type:inline-size;display:flex;flex-direction:column;min-width:0;min-height:0;height:100%;color:var(--text);background:var(--g-850);font-size:12px }
.top { display:flex;align-items:center;justify-content:space-between;flex:none;gap:12px;min-width:0;padding:8px 12px;background:var(--g-900);border-bottom:1px solid var(--hair) }
.heading { display:flex;align-items:center;gap:9px;min-width:0;color:var(--text-2) }
.heading > div { display:flex;align-items:baseline;gap:9px;min-width:0 }
.heading strong { color:var(--text);font-size:13px }
.heading small { color:var(--text-3);font-size:11px }
.actions { display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end }
.actions button { display:inline-flex;align-items:center;gap:6px;min-height:27px;white-space:nowrap }
.workspace { display:grid;grid-template-columns: minmax(162px, 225px) minmax(0,1fr);flex:1;min-width:0;min-height:0 }
.library { min-width:0;min-height:0;overflow:auto;background:var(--g-900);border-right:1px solid var(--hair);padding:10px 8px }
.find { display:flex;align-items:center;gap:7px;padding:0 8px;border:1px solid var(--hair);border-radius:5px;background:var(--g-850);color:var(--text-3) }
.find:focus-within { border-color:var(--blue) }
.find input { width:100%;min-width:0;border:0;background:transparent;padding:7px 0;color:var(--text);outline:0 }
.library-caption { display:flex;align-items:center;justify-content:space-between;margin:15px 5px 8px;color:var(--text-3);font-size:10px;font-weight:700;letter-spacing:.065em }
.counter { padding:2px 6px;background:var(--g-800);border:1px solid var(--hair);border-radius:4px;letter-spacing:0 }
.movie { display:flex;align-items:center;gap:9px;width:100%;min-width:0;text-align:left;padding:9px 7px;margin-bottom:3px;background:transparent;color:var(--text-2);border:1px solid transparent;border-radius:5px }
.movie:hover { background:var(--g-800) }.movie.active { color:var(--text);background:var(--g-800);border-color:var(--hair);box-shadow:inset 2px 0 0 var(--blue) }
.movie-symbol { display:flex;align-items:center;justify-content:center;flex:0 0 28px;height:28px;border-radius:5px;background:var(--g-850);border:1px solid var(--hair) }
.movie.active .movie-symbol { color:var(--blue) }
.movie-name { display:grid;gap:3px;flex:1;min-width:0 }.movie-name b { overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:11px;font-weight:600 }
.movie-name small,.empty-library { color:var(--text-3);font-size:10px }.empty-library { margin:12px 6px;line-height:1.6 }
.player { display:flex;flex-direction:column;gap:0;min-height:0;min-width:0;overflow:hidden;background:var(--g-850) }
.movie-summary { display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 15px;flex:none;min-width:0;border-bottom:1px solid var(--hair) }
.movie-identity { display:flex;flex-direction:column;gap:2px;min-width:0 }
.movie-identity strong { font-size:15px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-weight:650 }
.eyebrow { color:var(--blue);font-size:9px;font-weight:700;letter-spacing:.08em }
.source-name { font-size:10px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis }
.summary-metrics { display:flex;gap:15px;flex:none }
.summary-metrics > div { display:grid;gap:3px }.summary-metrics span { color:var(--text-3);font-size:9px;letter-spacing:.04em }
.summary-metrics strong { font:600 11px ui-monospace,monospace;color:var(--text-2) }
.notice { padding:8px 12px;border-bottom:1px solid var(--hair);color:var(--text-2);font-size:11px }
.timeline-panel { flex:1;display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden }
.timeline-toolbar { display:flex;align-items:center;gap:10px;padding:6px 10px;flex:none;border-bottom:1px solid var(--hair);background:var(--g-900);flex-wrap:wrap }
.transport,.sequence-zoom { display:flex;align-items:center;gap:4px }
.icon-button,.sequence-zoom button { display:inline-flex;align-items:center;justify-content:center;width:27px;height:26px;padding:0;flex:none }
.primary-control { color:#fff;background:var(--blue);border-color:var(--blue) }
.time { margin-left:5px;white-space:nowrap;font:600 11px ui-monospace,monospace;font-variant-numeric:tabular-nums;color:var(--text-2) }
.time i { color:var(--text-3);font-style:normal }
.sequence-zoom { margin-left:auto }
.play-full { display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:26px;padding:0 10px;white-space:nowrap;color:var(--text-2) }
.sequence { flex:1;min-height:120px;overflow:auto;overscroll-behavior:contain;background:var(--g-900);outline-offset:-2px }
.sequence:focus-visible { outline:2px solid var(--blue) }
.sequence-content { position:relative;min-width:100% }
.sequence-line { display:flex;align-items:stretch;min-height:40px;border-bottom:1px solid var(--hair) }
.sequence-line:nth-child(2n+1) .lane-canvas { background-color:rgba(130,160,190,.025) }
.sequence-label { z-index:3;position:sticky;left:0;flex:0 0 164px;width:164px;min-width:164px;overflow:hidden;display:flex;flex-direction:column;justify-content:center;gap:2px;padding:4px 10px;background:var(--g-850);border-right:1px solid var(--hair) }
.sequence-label small { font-size:9px;font-weight:700;letter-spacing:.05em;color:var(--text-3) }
.sequence-label b { overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:11px;font-weight:500;color:var(--text-2) }
.ruler-line,.ruler-line .sequence-canvas { min-height:31px }
.ruler-caption { flex-direction:row;align-items:center;justify-content:space-between;color:var(--text-3);font-size:10px;font-weight:700 }
.sequence-canvas { position:relative;flex:none;cursor:crosshair;min-height:40px }
.lane-canvas { background-image:linear-gradient(to right,rgba(135,155,185,.095) 1px,transparent 1px) }
.tick { position:absolute;top:3px;left:0;height:28px;padding-left:5px;border-left:1px solid rgba(155,165,185,.25);color:var(--text-3);font:10px ui-monospace,monospace;white-space:nowrap;pointer-events:none }
.sequence-segment { position:absolute;top:7px;height:26px;border:1px solid var(--clip-color);border-left-width:3px;border-radius:4px;background:color-mix(in srgb,var(--clip-color) 35%,var(--g-900));overflow:hidden;white-space:nowrap;line-height:24px;font-size:10px;color:var(--text);pointer-events:none }
.sequence-segment span { padding:0 7px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap }
.sequence-segment.event { height:22px;top:9px }
.sequence-segment.muted { opacity:.3 }
.key-marker { position:absolute;top:14px;left:0;width:6px;height:6px;background:var(--clip-color);border:1px solid var(--g-900);transform:rotate(45deg);pointer-events:none }
.playhead { position:absolute;top:0;bottom:0;width:2px;background:#ef6265;z-index:2;pointer-events:none;box-shadow:0 0 4px rgba(239,98,101,.35) }
.ruler-line .playhead:before { content:'';position:absolute;left:-4px;top:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid #ef6265 }
.sequence-empty { padding:16px;color:var(--text-3) }
.is-muted { opacity:.6 }
.timeline-footer { display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;min-height:28px;padding:4px 12px;border-top:1px solid var(--hair);background:var(--g-900);font-size:10px;color:var(--text-3) }
.current-shot { display:inline-flex;gap:5px;align-items:center;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis }
.scale-label { flex:none;font:10px ui-monospace,monospace }
.player-empty { flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:9px;text-align:center;color:var(--text-3);padding:20px }
.player-empty strong { color:var(--text-2);font-size:13px }.player-empty p { max-width:280px;margin:0;font-size:11px;line-height:1.5 }
@container (max-width:590px) { .workspace { grid-template-columns:minmax(0,1fr) } .library { display:flex;align-items:center;gap:6px;min-height:0;max-height:106px;padding:5px 8px;border-right:0;border-bottom:1px solid var(--hair);overflow:auto } .library-caption,.empty-library { display:none } .find { flex:0 0 115px } .movie { flex:0 0 165px;margin:0;padding:5px } .movie-summary { padding:8px 10px }.summary-metrics { gap:9px }.summary-metrics > div:nth-child(3) { display:none } .top { align-items:flex-start;flex-direction:column;gap:5px }.sequence-label { width:130px;min-width:130px;flex-basis:130px } }
@container (max-width:390px) { .summary-metrics > div:nth-child(2) { display:none } .timeline-toolbar { gap:5px }.play-full { width:100% }.actions { justify-content:flex-start } }
</style>