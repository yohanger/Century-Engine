<script setup>
// Película: datos de la escena, semilla del clima, sustituir escena y lo que la película ha cambiado de la escena (vuelve a Century).
import { computed } from 'vue'
import { FILM_FRAME_PRESETS, filmFramePreset, normalizeFilmFrame } from '../frame.js'
import { store, toast } from '../../core/store.js'
import { pickFile } from '../../engine/runtime/util.js'
import * as F from '../session.js'
import { RENDERERS, methodOf } from '../../engine/runtime/render/config.js'

const props = defineProps({ bounds: Object, quality: { type: Number, default: 1 } })
const emit = defineEmits(['replaced', 'quality'])
const projectMethod = computed(() => RENDERERS.find((r) => r.id === methodOf(store.project?.render))?.name || '')
const { session } = F
const film = computed(() => session.film)
const chosenFrame = computed(() => filmFramePreset(film.value?.frame))
function setFrame(frame) {
  try {
    const next = normalizeFilmFrame(frame)
    session.film = { ...session.film, frame: next }
  } catch (e) { toast(e.message, 'error', 5000) }
}
function usePreset(id) {
  if (id === 'custom') return
  const p = FILM_FRAME_PRESETS.find((x) => x.id === id)
  if (p) setFrame({ width: p.width, height: p.height })
}
function setDimension(key, event) {
  const raw = event.target.value.trim(), n = Number(raw)
  if (!raw || !Number.isInteger(n) || n < 64 || n > 8192) {
    event.target.value = film.value.frame?.[key] ?? ''
    toast('Indica un número entero entre 64 y 8192 píxeles', 'error', 5000)
    return
  }
  setFrame({ ...(film.value.frame || { width: 1920, height: 1080 }), [key]: n })
}

const changes = computed(() => { void store.project?.objects; void store.project?.environment; void store.project?.render; void store.project?.audio; return F.sceneChanges() })
const changed = computed(() => (film.value && store.project ? F.changedObjects() : []))
const nameOf = (id) => store.project?.objects.find((o) => o.id === id)?.name || id
const setFilm = (patch) => { session.film = { ...session.film, ...patch } }
async function replace() {
  const [f] = await pickFile('.lfproj,.nfm,.zip'); if (!f) return
  try { await F.replaceScene(new Uint8Array(await f.arrayBuffer()), f.name); emit('replaced') } catch (e) { toast(e.message, 'error', 6000) }
}
</script>

<template>
  <section class="pn">
    <label class="f">Nombre <input :value="film.name" data-test="film-name" @change="setFilm({ name: $event.target.value })" /></label>
    <dl>
      <dt>Proyecto</dt><dd>{{ film.scene.projectName }}</dd>
      <dt>Escena</dt><dd data-test="scene-name">{{ film.scene.name }}</dd>
      <dt>Objetos</dt><dd>{{ store.project?.objects.length }}</dd>
      <dt>Tamaño</dt><dd data-test="bounds">{{ bounds ? `${bounds.size[0]} × ${bounds.size[1]} × ${bounds.size[2]} m` : '—' }}</dd>
    </dl>
    <label class="f">Semilla del clima <span class="row"><input type="number" :value="film.seed" @change="setFilm({ seed: Math.max(1, Math.floor(+$event.target.value || 1)) })" /><button title="Otra semilla: los rayos caerán en otros momentos" @click="setFilm({ seed: Math.floor(Math.random() * 1e9) })">🎲</button></span></label>
    <p class="hint lf-help">Con la misma semilla, el clima y los rayos se repiten igual cada vez que reproduces.</p>
    <h4>Encuadre de la película</h4>
    <label class="f">Formato de encuadre
      <select data-test="frame-preset" :value="chosenFrame" @change="usePreset($event.target.value)">
        <option v-for="p in FILM_FRAME_PRESETS" :key="p.id" :value="p.id">{{ p.label }} · {{ p.width }} × {{ p.height }}</option>
        <option value="custom">Personalizado</option>
      </select>
    </label>
    <div class="frame-dimensions">
      <label class="f">Ancho (px)<input data-test="frame-width" type="number" min="64" max="8192" step="1" :value="film.frame?.width ?? ''" placeholder="Automático" @change="setDimension('width', $event)" /></label>
      <label class="f">Alto (px)<input data-test="frame-height" type="number" min="64" max="8192" step="1" :value="film.frame?.height ?? ''" placeholder="Automático" @change="setDimension('height', $event)" /></label>
    </div>
    <p class="hint lf-help" data-test="frame-hint">{{ film.frame ? 'Formato de imagen: ' + (film.frame.width / film.frame.height).toFixed(3) + ':1. Se guarda en .nfm.' : 'Película antigua: encuadre adaptable al panel hasta elegir un formato.' }}</p>
    <h4>Vista (solo en esta app)</h4>
    <label class="f">Método de render <select v-model="store.view.renderMethod" data-test="render-method-panel"><option value="">El del proyecto · {{ projectMethod }}</option><option v-for="r in RENDERERS" :key="r.id" :value="r.id">{{ r.name }} — {{ r.tag }}</option></select></label>
    <label class="f">Resolución de la vista <select :value="quality" @change="emit('quality', +$event.target.value)"><option :value="1">100 %</option><option :value="0.75">75 %</option><option :value="0.5">50 % (menos memoria)</option><option :value="0.35">35 % (móvil modesto)</option></select></label>
    <p class="hint lf-help">Elige un render ligero si el equipo va justo: no cambia el proyecto ni lo que se exporta.</p>
    <button data-test="replace" @click="replace">Sustituir escena…</button>
    <p class="hint lf-help">Si cambias el nivel en Century, expórtalo y sustitúyelo aquí: solo cambia el entorno; tomas, cámaras, montaje y ajustes se conservan.</p>

    <h4>Cambios que vuelven a la escena</h4>
    <ul class="list" data-test="scene-changes">
      <li><span>Objetos ajustados</span><b>{{ changes.objects }}</b></li>
      <li><span>Atmósfera</span><b>{{ changes.env ? 'cambiada' : '—' }}</b><button v-if="changes.env" title="Volver a la de la escena" @click="F.resetSetting('env')">↺</button></li>
      <li><span>Color</span><b>{{ changes.render ? 'cambiado' : '—' }}</b><button v-if="changes.render" title="Volver al de la escena" @click="F.resetSetting('render')">↺</button></li>
      <li><span>Mezclador</span><b>{{ changes.audio ? 'cambiado' : '—' }}</b><button v-if="changes.audio" title="Volver al de la escena" @click="F.resetSetting('audio')">↺</button></li>
      <li><span>Archivos añadidos</span><b>{{ changes.assets }}</b></li>
    </ul>
    <h4 v-if="changed.length">Objetos ajustados</h4>
    <ul class="list" data-test="changed"><li v-for="id in changed" :key="id"><span class="lnk" @click="store.editor && (store.selectedId = id, store.editor.setSelection(id, [id]))">{{ nameOf(id) }}</span><button title="Restaurar como en la escena" @click="F.resetObject(id)">↺</button></li></ul>
    <p class="hint lf-help">Al importar la película en Century (Archivo → Nether Film Maker → Importar película) estos cambios se aplican a la escena, para que el juego y la cinemática se vean igual.</p>
  </section>
</template>

<style scoped>
.frame-dimensions { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
.frame-dimensions input { width: 100%; min-width: 0; box-sizing: border-box; }
</style>
