<script setup>
// Sonido de pasos de una layer (Tags y Layers ▸ Layers ▸ ♪): varios clips por acción (caminar, correr, aterrizar, saltar), que el
// juego elige al azar sin repetir el último; volumen, variación de tono y grupo del mezclador. Sin clips, silencio.
import { computed } from 'vue'
import { store, editTagLayers, previewClip } from '../core/store.js'
import { STEP_KINDS, STEPS_DEFAULT, normalizeSteps, setLayerSteps, pickClip, stepClips, SURFACES } from '../engine/runtime/layers.js'
import { AUDIO_EXT } from '../engine/runtime/audio/config.js'

const props = defineProps({ index: { type: Number, required: true } })
const layer = computed(() => store.project.tagLayers.layers[props.index])
const steps = computed(() => normalizeSteps(layer.value?.steps) || { ...STEPS_DEFAULT, walk: [], run: [], land: [], jump: [] })
const clips = computed(() => (store.project.assets || []).filter((a) => AUDIO_EXT.includes(String(a.ext || a.name.split('.').pop()).toLowerCase())))
const groups = computed(() => store.project.audio?.groups || [])
const nameOf = (id) => clips.value.find((a) => a.id === id)?.name || 'clip que ya no existe'
const FALLBACK = { run: 'usa Caminar si tiene clips', land: 'usa Caminar si tiene clips', jump: 'sin sonido', walk: '' }

function save(patch) { editTagLayers((tl) => setLayerSteps(tl, props.index, { ...steps.value, ...patch })) }
function add(kind, id) { if (!id) return; const list = [...steps.value[kind]]; if (!list.includes(id)) list.push(id); save({ [kind]: list }) }
function remove(kind, id) { save({ [kind]: steps.value[kind].filter((x) => x !== id) }) }
const play = (id) => previewClip(id, { group: steps.value.group, volume: steps.value.volume, pitch: 1 + (Math.random() * 2 - 1) * steps.value.pitch })
let last = null
function test(kind) { const c = pickClip(stepClips(steps.value, kind), last); if (c) { last = c; play(c) } }
</script>

<template>
  <div class="sse" :data-testid="'steps-' + index">
    <div v-for="[k, label] in STEP_KINDS" :key="k" class="kind">
      <span class="kl">{{ label }}</span>
      <div class="chips">
        <span v-for="id in steps[k]" :key="id" class="chip"><button class="pl" aria-label="Escuchar" @click="play(id)">▶</button>{{ nameOf(id) }}<button class="rm" aria-label="Quitar" @click="remove(k, id)">✕</button></span>
        <select :data-testid="`steps-add-${index}-${k}`" value="" @change="add(k, $event.target.value); $event.target.value = ''">
          <option value="">＋ clip…</option>
          <option v-for="a in clips" :key="a.id" :value="a.id" :disabled="steps[k].includes(a.id)">{{ a.name }}</option>
        </select>
        <span v-if="!steps[k].length && FALLBACK[k]" class="dim">{{ FALLBACK[k] }}</span>
        <button v-if="stepClips(steps, k).length" class="ghost test" @click="test(k)">Probar</button>
      </div>
    </div>
    <div class="opts">
      <label>Volumen <input type="range" min="0" max="2" step="0.05" :value="steps.volume" @change="save({ volume: +$event.target.value })" /><b>{{ Math.round(steps.volume * 100) }}%</b></label>
      <label>Variación de tono <input type="range" min="0" max="0.5" step="0.01" :value="steps.pitch" @change="save({ pitch: +$event.target.value })" /><b>±{{ Math.round(steps.pitch * 100) }}%</b></label>
      <label>Grupo <select :value="steps.group" @change="save({ group: $event.target.value })"><option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option></select></label>
    </div>
    <p v-if="!clips.length" class="dim lf-help">Importa audio (wav, ogg, mp3…) al panel Proyecto para añadirlo aquí.</p>
    <p v-else-if="layer?.surface" class="dim lf-help">Sin clips, los pasos sobre «{{ SURFACES[layer.surface]?.label }}» quedan en silencio. Las capas del terreno con esa superficie usan esta layer.</p>
  </div>
</template>

<style scoped>
.sse { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px 10px 36px; background: var(--g-900, rgba(0,0,0,.2)); border-radius: 0 0 6px 6px; }
.kind { display: grid; grid-template-columns: 74px minmax(0, 1fr); gap: 8px; align-items: start; }
.kl { font-size: 11.5px; color: var(--text-2); padding-top: 4px; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; min-width: 0; }
.chip { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 2px 0 2px; border: 1px solid var(--hair); border-radius: 11px; font-size: 11.5px; background: var(--g-800); max-width: 100%; overflow: hidden; white-space: nowrap; }
.chip button { border: 0; background: transparent; width: 18px; height: 18px; padding: 0; font-size: 10px; color: var(--text-2); border-radius: 50%; }
.chip button:hover { background: var(--g-600); color: var(--text); } .chip .rm:hover { color: #ff6b5e; }
.chips select { height: 22px; font-size: 11.5px; max-width: 150px; }
.test { height: 22px; padding: 0 8px; font-size: 11px; }
.opts { display: flex; flex-wrap: wrap; gap: 6px 16px; padding-top: 4px; border-top: 1px solid var(--hair); }
.opts label { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--text-2); }
.opts input[type=range] { width: 90px; } .opts b { font-weight: 500; font-variant-numeric: tabular-nums; min-width: 38px; color: var(--text); }
.opts select { height: 22px; font-size: 11.5px; }
.dim { margin: 0; font-size: 11px; color: var(--text-3); }
@container win (max-width: 460px) { .sse { padding-left: 10px; } .kind { grid-template-columns: 1fr; gap: 2px; } }
</style>
