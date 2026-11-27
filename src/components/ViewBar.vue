<script setup>
// Aspecto y escala se comparten entre la vista previa y la partida.
import { computed, watch } from 'vue'
import { store } from '../core/store.js'
import { command, run } from '../core/commands.js'
import { VIEW_MODES } from '../engine/runtime/render/view-diagnostics-contract.js'
import { GIZMO_CATEGORIES } from '../core/editor/gizmo-visibility.js'
import { getAudio } from '../engine/runtime/audio/engine.js'
import Icon from './Icon.vue'

const ASPECTS = [['free', 'Libre'], ['16:9', '16:9'], ['16:10', '16:10'], ['21:9', '21:9'], ['4:3', '4:3'], ['3:2', '3:2'], ['1:1', '1:1'], ['9:16', '9:16 (vertical)']]
const tab = computed(() => store.ui.mode === 'desktop' ? store.ui.viewTab : (store.play.on ? 'game' : store.gameView.on ? 'game' : 'scene'))
const p = store.prefs

const toggles = [['view.grid', 'Rejilla'], ['view.wire', 'Malla'], ['view.lights', 'Luces del proyecto'], ['view.terrain', 'Terreno']]
const views = [['view.persp', 'Perspectiva'], ['view.top', 'Superior'], ['view.front', 'Frontal'], ['view.right', 'Lateral']]

watch(() => p.gameMute, (m) => getAudio().setMuted(m))
const modeStatus = computed(() => {
  const mode = store.view.mode || 'lit'
  if (mode === 'lit') return ''
  return store.editor?.vp?.viewDiagnostics?.capability(mode)?.reason || ''
})
function selectViewMode(e) {
  store.view.wireframe = false // el interruptor legacy no bloquea la selección de LOD real
  store.view.mode = e.target.value
}
const scaleLabel = computed(() => (+p.gameScale).toFixed(2).replace(/\.?0+$/, '') + '×')

// Reutiliza el menú contextual único de Century: no hay segundo popover ni estado paralelo.
function gizmoItems() {
  return [
    { heading: 'Gizmos de escena' },
    { label: 'Mostrar gizmos', icon: 'eye', checked: p.showGizmos !== false,
      keep: true, run: () => { p.showGizmos = p.showGizmos === false } },
    { sep: true },
    { heading: 'Visibilidad por tipo' },
    ...GIZMO_CATEGORIES.map(({ id, label, icon }) => ({
      label, icon, checked: p.gizmoCategories?.[id] !== false, keep: true,
      run: () => { (p.gizmoCategories ??= {})[id] = p.gizmoCategories[id] === false },
    })),
  ]
}
function openGizmos(e) {
  if (store.menu?.gizmos) { store.menu = null; return }
  const rect = e.currentTarget.getBoundingClientRect()
  store.addModal = null
  store.menu = { gizmos: true, x: rect.left, y: rect.bottom + 2,
    items: gizmoItems(), rebuild: gizmoItems, returnFocus: e.currentTarget }
}
</script>

<template>
  <div class="vb" role="toolbar" :aria-label="tab === 'scene' ? 'Herramientas de la vista de edición' : 'Herramientas de la vista de juego'">

    <template v-if="tab === 'scene'">
      <div class="grp">
        <button v-for="[id, t] in toggles" :key="id" class="ib" :class="{ on: command(id).checked() }" :data-tooltip="t" :aria-label="t" @click="run(id)"><Icon :name="command(id).icon" :size="14" /></button>
      </div>
      <div class="grp">
        <button v-for="[id, t] in views" :key="id" class="ib" :data-tooltip="`Vista ${t.toLowerCase()}`" :aria-label="`Vista ${t.toLowerCase()}`" @click="run(id)"><Icon :name="command(id).icon" :size="14" /></button>
        <button class="ib" data-tooltip="Encuadrar todo (F)" aria-label="Encuadrar todo" @click="run('view.frame')"><Icon name="frame" :size="14" /></button>
      </div>
      <label class="sel mode-sel" :data-tooltip="VIEW_MODES.find(m => m.id === (store.view.mode || 'lit'))?.label">
        <span class="lb">Vista</span>
        <select :value="store.view.mode || 'lit'" @change="selectViewMode" aria-label="Modo de visualización del renderer">
          <option v-for="mode in VIEW_MODES" :key="mode.id" :value="mode.id">{{ mode.label }}</option>
        </select>
      </label>
      <span v-if="modeStatus" class="mode-unavailable" :title="modeStatus">No disponible</span>
      <button class="ib" :class="{ on: store.view.perf }" data-tooltip="GPU Profiler · F3 (mediciones reales por pasada)" aria-label="GPU Profiler" @click="store.view.perf = !store.view.perf"><Icon name="chart" :size="14" /></button>
      <span class="grow"></span>
      <div class="grp" aria-label="Opciones de gizmos">
        <button class="gizmo-trigger" :class="{ on: store.menu?.gizmos, muted: p.showGizmos === false }"
          aria-label="Configurar gizmos" aria-haspopup="menu" :aria-expanded="!!store.menu?.gizmos"
          data-tooltip="Mostrar y configurar gizmos de escena" @click="openGizmos">
          <Icon name="eye" :size="14" /><span>Gizmos</span><Icon name="chevd" :size="12" />
        </button>
      </div>
      <div class="grp" aria-label="Dispositivo de navegación">
        <button class="ib" :class="{ on: p.navigation === 'trackpad' }"
          :aria-label="`Navegación: ${p.navigation === 'trackpad' ? 'trackpad' : 'ratón'}. Cambiar a ${p.navigation === 'trackpad' ? 'ratón' : 'trackpad'}`"
          :aria-pressed="p.navigation === 'trackpad'"
          :data-tooltip="`Navegación: ${p.navigation === 'trackpad' ? 'trackpad' : 'ratón'}. Pulsar para alternar`"
          @click="run(p.navigation === 'trackpad' ? 'nav.mouse' : 'nav.trackpad')">
          <Icon :name="p.navigation === 'trackpad' ? 'trackpad' : 'mouse'" :size="14" />
        </button>
      </div>
    </template>

    <template v-else>
      <label class="sel" data-tooltip="Relación de aspecto de la pantalla del juego">
        <span class="lb">Aspecto</span>
        <select v-model="p.gameAspect" aria-label="Relación de aspecto">
          <option v-for="[v, l] in ASPECTS" :key="v" :value="v">{{ l }}</option>
        </select>
      </label>
      <label class="sel scale" data-tooltip="Escala de la pantalla del juego dentro de la vista">
        <span class="lb">Escala</span>
        <input v-model.number="p.gameScale" type="range" min="0.25" max="1" step="0.05" aria-label="Escala" />
        <span class="val">{{ scaleLabel }}</span>
      </label>
      <button v-if="store.play.on" class="tg" :class="{ on: p.gameMaximize }" :aria-pressed="p.gameMaximize" data-tooltip="Oculta los paneles mientras juegas" @click="p.gameMaximize = !p.gameMaximize">Maximizar al jugar</button>
      <button v-if="store.play.on" class="tg" :class="{ on: p.gameMute }" :aria-pressed="p.gameMute" data-tooltip="Silencia el audio del editor mientras juegas (no cambia el mezclador del proyecto)" @click="p.gameMute = !p.gameMute"><Icon :name="p.gameMute ? 'mute' : 'volume'" :size="13" />Silenciar</button>
      <button class="tg" :class="{ on: store.view.perf }" :aria-pressed="store.view.perf" data-tooltip="Estadísticas de rendimiento" @click="store.view.perf = !store.view.perf"><Icon name="chart" :size="13" />Stats</button>
      <span class="grow"></span>
      <span v-if="store.play.on && store.play.paused" class="chip warn">En pausa</span>
      <span v-if="store.play.on && !store.play.player" class="chip" data-tooltip="La escena no tiene un CharacterBody3D controlado">Sin jugador</span>
    </template>
  </div>
</template>

<style scoped>
.vb { display: flex; align-items: center; gap: 6px; height: 28px; padding: 0 6px; background: var(--g-850); border-bottom: 1px solid var(--hair); flex: none; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
.vb::-webkit-scrollbar { display: none; }
.grp { display: flex; gap: 1px; padding: 1px; background: var(--g-900); border: 1px solid var(--hair); border-radius: 5px; flex: none; }
.ib { width: 24px; height: 20px; padding: 0; border-color: transparent; background: transparent; color: var(--text-3); }
.ib:hover { color: var(--text); background: var(--g-700); }
.ib.on { color: var(--blue-hi); background: var(--blue-wash); }
.gizmo-trigger { display: inline-flex; align-items: center; justify-content: center; gap: 5px; height: 20px; padding: 0 6px; border: 0; background: transparent; color: var(--text-2); white-space: nowrap; font-size: 11px; }
.gizmo-trigger:hover, .gizmo-trigger.on { background: var(--g-700); color: var(--text); }
.gizmo-trigger.muted { color: var(--text-3); }
.gizmo-trigger:focus-visible { outline: 2px solid var(--blue-hi); outline-offset: -2px; }
.grow { flex: 1; }
.sel { display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 6px; background: var(--g-900); border: 1px solid var(--hair); border-radius: 5px; color: var(--text-2); flex: none; }
.sel.on { color: var(--amber); }
.mode-sel select { max-width: 190px; }
.mode-unavailable { font-size: 10px; color: var(--warn); white-space: nowrap; }
.sel select { background: transparent; border: 0; height: 20px; padding: 0 2px; color: var(--text); font-size: 12px; cursor: pointer; }
.sel .lb { color: var(--text-3); }
.sel .val { min-width: 34px; color: var(--text-2); }
.scale input[type='range'] { width: 90px; }
.tg { height: 22px; padding: 0 9px; background: var(--g-900); flex: none; color: var(--text-2); }
.chip { font-size: 11px; padding: 1px 8px; border-radius: 10px; border: 1px solid var(--hair); color: var(--text-3); flex: none; }
.chip.warn { color: var(--warn); border-color: rgba(227, 179, 65, .5); }
</style>
