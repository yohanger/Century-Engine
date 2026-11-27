<script setup>
// Juego exportado: abre el paquete (game.rtpkg) y lo ejecuta a pantalla completa con el Runtime. No usa el editor, su store ni IndexedDB.
// Origen del paquete: puente Electron (window.lfRuntime.loadGame) o, para pruebas en navegador, ?game=<url>.
import { ref, shallowRef, onMounted, onBeforeUnmount } from 'vue'
import { openGame } from '../engine/runtime/index.js'
import { beginBrandSplash, loadingProgress, waitForLoadingPaint } from '../engine/runtime/loading-progress.js'
import UiRoot from '../engine/runtime/ui/UiRoot.vue'
import PerfPanel from '../components/PerfPanel.vue'
import LoadingScreen from '../components/LoadingScreen.vue'
import BrandingSplash from '../components/BrandingSplash.vue'
import { createStorage } from './storage.js'
import { normalizeSceneTransitions } from '../engine/runtime/events/scene-transitions.js'

const host = ref(null)
const error = ref('')
const loading = ref(true)
const branding = ref(true)
const loadingInfo = shallowRef({ title: 'Iniciando juego', version: '', image: '' })
const loadStatus = shallowRef(null)
const report = loadingProgress([
  ['package', 'Leyendo el paquete del juego…'],
  ['scene', 'Cargando la primera escena…'],
  ['models', 'Cargando modelos…'],
  ['mount', 'Montando la escena y su entorno…'],
  ['systems', 'Preparando los recursos y la física…'],
  ['scripts', 'Iniciando la partida…'],
], (status) => { loadStatus.value = status })
// fading: true mientras el overlay negro está visible (loading + transición de salida)
const fading = ref(true)
const loadingColor = ref('#000000')
const loadingSeconds = ref(0.6)
const loadingCurve = ref('ease-out')
const game = shallowRef(null) // shallow: el juego contiene objetos de three.js, no deben volverse reactivos
const statsAllowed = ref(false)
const statsOpen = ref(false)
let releaseStats = null
let splash = null

async function loadBytes() {
  if (window.lfRuntime?.loadGame) return new Uint8Array(await window.lfRuntime.loadGame())
  const url = new URLSearchParams(location.search).get('game')
  if (!url) throw new Error('No se encontró el juego (game.rtpkg)')
  const r = await fetch(url)
  if (!r.ok) throw new Error('No se pudo leer ' + url)
  return new Uint8Array(await r.arrayBuffer())
}

const quit = () => { if (window.lfRuntime?.quit) window.lfRuntime.quit(); else window.close() }

// Inicia el fade-out del overlay: opacidad 0 → espera a que acabe la transición CSS → elimina el overlay.
function startFadeOut(delay = 0) {
  // Overlay de carga existente: nunca superponerlo al fundido inicial de play.fade.
  setTimeout(() => requestAnimationFrame(() => {
    loading.value = false
    setTimeout(() => { fading.value = false }, Math.round(loadingSeconds.value * 1000) + 100)
  }), Math.round(delay * 1000))
}

onMounted(async () => {
  splash = beginBrandSplash((visible) => { branding.value = visible })
  try {
    await report('package')
    const updateInfo = window.lfRuntime?.loadingInfo?.().then((info) => {
      if (info) loadingInfo.value = info
    }).catch((error) => console.warn('Splash del juego:', error.message))
    const bridge = window.lfRuntime
    const [gameData] = await Promise.all([bridge?.gameEntry?.('game'), updateInfo])
    const entries = gameData ? {
      game: () => gameData,
      scene: id => bridge.gameEntry('scene', id),
      file: id => bridge.gameEntry('file', id),
    } : null
    const bytes = entries ? null : await loadBytes()
    const g = await openGame({ container: host.value, bytes, entries, storage: createStorage(), onQuit: quit, onProgress: report })
    game.value = g
    const diagnostics = window.lfRuntime?.diagnostics
    if (diagnostics?.permissions) {
      try {
        const permissions = await diagnostics.permissions()
        statsAllowed.value = permissions?.stats === true
        if (statsAllowed.value) releaseStats = diagnostics.onStatsToggle(() => { statsOpen.value = !statsOpen.value })
      } catch (error) { console.warn('Diagnóstico del Runtime no disponible', error) }
    }
    const scene = g.host.project.scenes.find((s) => s.id === g.host.project.activeSceneId)
    const settings = normalizeSceneTransitions(scene?.transitions)
    if (settings.enter) {
      loadingColor.value = settings.color
      loadingSeconds.value = settings.inSeconds
      loadingCurve.value = settings.curve
    }
    document.title = g.game?.title || g.host.project.name
    loadingInfo.value = { ...loadingInfo.value, title: document.title }
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('debug')) window.__rt = g // solo en desarrollo y con ?debug=1
    // Mantener la pantalla de carga hasta que start() complete (carga Jolt, audio, scripts y lanza 'start')
    await g.start()
    if (!g.player.on) throw new Error('No se pudo iniciar la partida.')
    await splash.done
    await report('scripts', 1, 1)
    loadStatus.value = { ...loadStatus.value, phase: 'Listo', done: 0, total: 0 }
    await waitForLoadingPaint()
    startFadeOut(settings.enter ? settings.delay : 0)
  } catch (e) {
    console.error(e)
    error.value = e.message || String(e)
    loading.value = false
    fading.value = false
  } finally {
    splash.finish()
  }
})
onBeforeUnmount(() => { splash?.finish(); releaseStats?.(); game.value?.dispose() })
</script>

<template>
  <div class="game">
    <div ref="host" class="host"></div>
    <UiRoot v-if="game && game.state.on" :manager="game.player.ui" />
    <PerfPanel v-if="statsAllowed && statsOpen && game?.graph?.vp?.perf" :monitor="game.graph.vp.perf" :playing="game.state.on" close-shortcut="Ctrl + Shift + F3" @close="statsOpen = false" />
    <!-- La pantalla de carga permanece cubierta hasta que la partida está lista y luego respeta el fade de entrada. -->
    <div v-if="fading" class="overlay" :class="{ out: !loading }" :style="{ background: loadingColor, transitionDuration: loadingSeconds + 's', transitionTimingFunction: loadingCurve }">
      <BrandingSplash v-if="branding" :image="loadingInfo.image" />
      <LoadingScreen v-else-if="loadStatus" :title="loadingInfo.title" :subtitle="loadingInfo.version" :status="loadStatus" />
    </div>
    <div v-if="error" class="msg err">No se pudo iniciar el juego<br /><small>{{ error }}</small></div>
  </div>
</template>

<style scoped>
.game { position: fixed; inset: 0; background: #000; overflow: hidden; }
.host { position: absolute; inset: 0; }

/* Overlay de arranque: cubre el canvas durante la carga y se desvanece al terminar */
.overlay {
  position: absolute; inset: 0;
  background: #000;
  opacity: 1;
  transition-property: opacity;
  pointer-events: none;
  z-index: 10;
}
.overlay.out { opacity: 0; }

.msg { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #ddd; font: 16px system-ui, sans-serif; pointer-events: none; text-align: center; }
.msg.err { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #ff9a92; font: 16px system-ui, sans-serif; pointer-events: none; text-align: center; z-index: 20; }
.msg.err small { color: #aaa; margin-top: 8px; }
</style>
