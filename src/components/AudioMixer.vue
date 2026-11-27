<script setup>
// Mezclador: árbol, snapshots, faders, medidores y estado de efectos. Las propiedades viven en Inspector.vue.
import { computed, onMounted } from 'vue'
import { store, selectAudioInspector, updateAudioGroup, addAudioGroup, removeAudioGroup, updateAudioFx, saveAudioSnapshot, loadAudioSnapshot, deleteAudioSnapshot, markDirty, toast } from '../core/store.js'
import { FX_TYPES, BASE_IDS, groupTree } from '../engine/runtime/audio/config.js'
import { getAudio } from '../engine/runtime/audio/engine.js'
import Icon from './Icon.vue'
import MixerMeter from './MixerMeter.vue'

const emit = defineEmits(['inspect'])
const sel = computed(() => store.audioInspector?.groupId || 'master')
const selFx = computed(() => store.audioInspector?.effectId || null)
const audio = computed(() => store.project.audio)
const tree = computed(() => groupTree(audio.value))
const cur = computed(() => audio.value.groups.find(g => g.id === sel.value) || audio.value.groups[0])
const isBase = g => BASE_IDS.includes(g.id)
// El Inspector general se activa también al abrir el Mixer desde una escena o recurso.
onMounted(() => { if (!store.audioInspector || !audio.value.groups.some(g=>g.id===sel.value)) selectAudioInspector(audio.value.groups[0]?.id) })
const fmtDb = (v) => (v <= -80 ? '-∞' : (v > 0 ? '+' : '') + (+v).toFixed(1))
const set = (id, patch) => updateAudioGroup(id, patch)
// Los textos inválidos no deben convertirse en 0 dB ni silenciar un grupo.
function setVolumeText(g, event) {
  const raw = String(event.target.value || '').trim().replace(',', '.')
  let volume
  if (/^(?:[-−]\s*(?:∞|inf|infinity))(?:\s*dB)?$/i.test(raw)) volume = -80
  else if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:\s*dB)?$/i.test(raw))
    volume = Math.max(-80, Math.min(20, Math.round(Number.parseFloat(raw) * 2) / 2))
  if (Number.isFinite(volume) && volume !== g.volume) set(g.id, { volume })
  event.target.value = fmtDb(Number.isFinite(volume) ? volume : g.volume)
}
const anySolo = computed(() => audio.value.groups.some((g) => g.solo))
const dimmed = (g) => g.mute || (anySolo.value && !g.solo && g.id !== 'master')
const fxLabel = (f) => FX_TYPES[f.type].label
function pick(g, f = null) {
  if (!g || !selectAudioInspector(g.id, f?.id || null)) return
  emit('inspect')
}
async function newGroup() { const id = await addAudioGroup('Grupo', sel.value); pick(audio.value.groups.find(g=>g.id===id)) }
async function newTrack(g) { const id = await addAudioGroup('Track', g.id); pick(audio.value.groups.find(v=>v.id===id)) }
async function delGroup(g) { if (isBase(g)) return; await removeAudioGroup(g.id); pick(audio.value.groups.find(v=>v.id==='master')) }
async function newSnap() { const id = await saveAudioSnapshot(''); toast('Snapshot guardado', 'ok') ; void id }
function setStart(id) { audio.value.startSnapshot = audio.value.startSnapshot === id ? '' : id; markDirty() }
async function wake() { await getAudio().ensure().catch(() => {}) }

</script>

<template>
  <div class="mixer" @pointerdown.once="wake">
    <!-- grupos y snapshots -->
    <aside class="side">
      <header><span>Grupos</span><span class="grow"></span><button class="ghost" data-tooltip="Añadir grupo hijo del seleccionado" @click="newGroup"><Icon name="plus" :size="13" /></button><button class="ghost" data-tooltip="Eliminar grupo" :disabled="isBase(cur)" @click="delGroup(cur)"><Icon name="trash" :size="13" /></button></header>
      <ul class="tree">
        <li v-for="{ g, depth } in tree" :key="g.id" :class="{ on: g.id === sel }" :style="{ paddingLeft: 8 + depth * 14 + 'px' }" @click="pick(g)">
          <i class="dot" :style="{ background: g.color }"></i>
          <span class="nm" tabindex="0" @keydown.enter="pick(g)" @keydown.space.prevent="pick(g)">{{ g.name }}</span>
          <em v-if="g.mute" class="tg m">M</em><em v-if="g.solo" class="tg s">S</em>
        </li>
      </ul>
      <header><span>Snapshots</span><span class="grow"></span><button class="ghost" data-tooltip="Guardar el estado actual como snapshot" @click="newSnap"><Icon name="plus" :size="13" /></button></header>
      <ul class="snaps">
        <li v-for="s in audio.snapshots" :key="s.id">
          <button class="ghost star" :class="{ on: audio.startSnapshot === s.id }" data-tooltip="Snapshot inicial del juego" @click="setStart(s.id)">★</button>
          <input class="sn" :value="s.name" @change="s.name = $event.target.value || s.name; markDirty()" />
          <button class="ghost" data-tooltip="Cargar en el mezclador" @click="loadAudioSnapshot(s.id)"><Icon name="import" :size="12" /></button>
          <button class="ghost" data-tooltip="Sobrescribir con el estado actual" @click="saveAudioSnapshot(s.name, s.id)"><Icon name="save" :size="12" /></button>
          <button class="ghost" data-tooltip="Eliminar" @click="deleteAudioSnapshot(s.id)"><Icon name="x" :size="12" /></button>
        </li>
        <li v-if="!audio.snapshots.length" class="empty lf-help">Un snapshot guarda volúmenes y efectos. Desde un script: <code>game.audio.snapshot("cueva", 1)</code></li>
      </ul>
    </aside>

    <!-- canales -->
    <div class="strips">
      <div v-for="{ g } in tree" :key="g.id" class="strip" :class="{ on: g.id === sel, dim: dimmed(g) }" @click="pick(g)">
        <div class="top" :style="{ background: g.color }"></div>
        <div class="nm2" tabindex="0" :data-tooltip="(g.parent && g.parent !== 'master' ? audio.groups.find((x) => x.id === g.parent)?.name + ' → ' : '') + g.name">{{ g.name }}</div>
        <div class="meterfader">
          <div class="scale"><span v-for="t in [20, 0, -20, -40, -60]" :key="t" :style="{ bottom: ((t + 80) / 100) * 100 + '%' }">{{ t }}</span></div>
          <input class="fader" type="range" :data-group-id="g.id" :aria-label="'Volumen '+g.name" min="-80" max="20" step="0.5" :value="g.volume" orient="vertical" @click.stop @input="set(g.id, { volume: +$event.target.value })" @dblclick.stop="set(g.id, { volume: 0 })" data-tooltip="Doble clic: 0 dB" />
          <MixerMeter :gid="g.id" />
        </div>
        <input class="db" type="text" :value="fmtDb(g.volume)" @click.stop @change="setVolumeText(g, $event)" />
        <div class="btns">
          <button :class="{ s: g.solo }" data-tooltip="Solo" :disabled="g.id === 'master'" @click.stop="set(g.id, { solo: !g.solo })">S</button>
          <button :class="{ m: g.mute }" data-tooltip="Silenciar" @click.stop="set(g.id, { mute: !g.mute })">M</button>
          <button :class="{ b: g.bypass }" data-tooltip="Bypass de efectos" @click.stop="set(g.id, { bypass: !g.bypass })">B</button>
        </div>
        <div class="slots" @click.stop>
          <div v-for="f in g.fx" :key="f.id" class="slot" :class="{ on: g.id === sel && f.id === selFx, off: !f.on }" @click="pick(g, f)">
            <button class="pwr" :class="{ on: f.on }" data-tooltip="Activar / desactivar" @click.stop="updateAudioFx(g.id, f.id, { on: !f.on })"></button>
            <span tabindex="0">{{ fxLabel(f) }}</span>
          </div>
        </div>
        <button class="addtrack" :data-tooltip="'Crea un track (grupo hijo) dentro de ' + g.name" @click.stop="newTrack(g)"><Icon name="plus" :size="11" /> Track</button>
      </div>
    </div>


  </div>
</template>

<style scoped>
.mixer { display: grid; grid-template-columns: 190px minmax(0,1fr); height: 100%; min-height: 0; background: var(--g-850); }
header { display: flex; align-items: center; gap: 6px; padding: 0 8px; height: 26px; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-2); background: var(--editor-chrome, var(--g-900)); border-bottom: 1px solid var(--hair-soft); flex: none; }
header b { text-transform: none; letter-spacing: 0; color: var(--text); font-size: 12px; }
.grow { flex: 1; } .dim { color: var(--text-3); font-weight: 400; text-transform: none; letter-spacing: 0; }
.ghost { width: 22px; height: 20px; padding: 0; border: none; background: transparent; color: var(--text-3); border-radius: 3px; } .ghost:hover:not(:disabled) { background: var(--g-600); color: var(--text); }
.side { display: flex; flex-direction: column; border-right: 1px solid var(--hair); min-height: 0; overflow: auto; }
.tree, .snaps { list-style: none; margin: 0; padding: 4px 0; }
.tree li { display: flex; align-items: center; gap: 6px; min-height: 24px; padding-top: 3px; padding-bottom: 3px; padding-right: 8px; cursor: pointer; color: var(--text-2); }
.tree li:hover { background: var(--g-800); } .tree li.on { background: var(--editor-selection, var(--blue-wash)); color: var(--text); box-shadow: inset 2px 0 0 var(--blue-hi); }
.dot { width: 9px; height: 9px; border-radius: 50%; flex: none; display: inline-block; }
.nm { flex: 1; min-width: 0; overflow-wrap: anywhere; white-space: normal; line-height: 1.25; }
.tg { font-style: normal; font-size: 9px; font-weight: 700; border-radius: 2px; padding: 0 3px; color: #111; } .tg.m { background: #e8574a; color: #fff; } .tg.s { background: #e8c04a; }
.snaps li { display: flex; align-items: center; gap: 2px; padding: 1px 6px; } .snaps li.empty { display: block; color: var(--text-3); font-size: 11px; padding: 6px 10px; line-height: 1.4; }
.sn { flex: 1; min-width: 0; height: 20px; font-size: 11px; background: transparent; border-color: transparent; } .sn:hover, .sn:focus { background: var(--g-950); border-color: var(--g-700); }
.star { font-size: 13px; } .star.on { color: var(--amber); }
.strips { display: flex; gap: 6px; padding: 8px; overflow: auto; align-items: flex-start; background: var(--g-900); min-width: 0; min-height: 0; }
.strip { width: 104px; flex: none; display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 0 6px 8px; background: var(--g-850); border: 1px solid var(--hair); border-radius: 6px; cursor: pointer; overflow: hidden; min-height: 330px; }
.strip.on { border-color: var(--blue-hi); background: var(--g-800); }
.strip .top { height: 4px; align-self: stretch; margin: 0 -6px; }
.strip.dim .meterfader { opacity: .45; }
.nm2 { font-weight: 600; font-size: 12px; max-width: 100%; white-space: normal; overflow-wrap: anywhere; text-align: center; line-height: 1.2; }
.meterfader { display: flex; gap: 4px; flex: none; height: 120px; align-items: stretch; width: 100%; justify-content: center; }
.scale { position: relative; width: 22px; font-size: 9px; color: var(--text-3); } .scale span { position: absolute; right: 0; transform: translateY(50%); }
input.fader[type="range"] { box-sizing: border-box; height: 100%; min-height: 120px; background: linear-gradient(var(--g-600), var(--g-600)) center / 3px calc(100% - 10px) no-repeat; writing-mode: vertical-lr; direction: rtl; width: 18px; padding: 0; margin: 0; flex: none; appearance: none; }
.db { width: 62px; text-align: center; height: 20px; font-variant-numeric: tabular-nums; font-size: 11px; }
.btns { display: flex; gap: 3px; }
.btns button { width: 24px; height: 20px; padding: 0; font-size: 10px; font-weight: 700; border-radius: 3px; }
.btns .s { background: #e8c04a; color: #1a1a1a; border-color: #e8c04a; } .btns .m { background: #e8574a; color: #fff; border-color: #e8574a; } .btns .b { background: #58b4e8; color: #0b1a24; border-color: #58b4e8; }
.slots { width: 100%; flex: none; display: flex; flex-direction: column; gap: 2px; margin-top: 2px; border-top: 1px solid var(--hair); padding-top: 5px; }
.slot { display: flex; align-items: center; gap: 5px; min-height: 21px; padding-top: 2px; padding-bottom: 2px; padding: 0 5px; font-size: 11px; background: var(--g-800); border: 1px solid var(--g-700); border-radius: 3px; cursor: pointer; min-width: 0; }
.slot span { min-width: 0; white-space: normal; overflow-wrap: anywhere; line-height: 1.2; } .slot.on { border-color: var(--blue); background: var(--blue-wash); } .slot.off span { opacity: .5; text-decoration: line-through; }
.pwr { width: 9px; height: 9px; border-radius: 50%; padding: 0; flex: none; border: 1px solid var(--text-3); background: transparent; } .pwr.on { background: var(--ok); border-color: var(--ok); }
.add { width: 100%; height: 21px; font-size: 11px; color: var(--text-3); background: transparent; border-style: dashed; }
.addtrack { width: 100%; height: 21px; flex: none; font-size: 11px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; color: var(--text-2); background: var(--g-800); border: 1px dashed var(--g-600); border-radius: 3px; } .addtrack:hover { color: var(--text); border-color: var(--blue); }

</style>
