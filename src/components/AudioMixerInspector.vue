<script>
export default { inheritAttrs: false }
</script>
<script setup>
// Propiedades de grupos y efectos del mezclador en el Inspector general.
import { computed, ref, watch, useAttrs, getCurrentInstance } from 'vue'
import { store, audioInspectorTarget, selectAudioInspector, updateAudioGroup, setGroupParent, addAudioFx, removeAudioFx, moveAudioFx, updateAudioFx } from '../core/store.js'
import { FX_TYPES, REVERB_PRESETS, BASE_IDS, descendants } from '../engine/runtime/audio/config.js'
import Icon from './Icon.vue'
import ColorInput from './ColorInput.vue'

const props = typeof useAttrs === 'function' ? useAttrs() : {}
const emit = typeof getCurrentInstance === 'function' ? getCurrentInstance().emit : () => {}
const fxMode = () => props.fxOnly === true || props['fx-only'] === true || props['fx-only'] === ''
const clipId = () => props.clipId ?? props['clip-id'] ?? ''
const clipFx = () => props.clipFx ?? props['clip-fx'] ?? []
const target = computed(() => fxMode() ? null : audioInspectorTarget())
const group = computed(() => {
  void store.temporalEditRevision // La edición de la clave invalida también los atributos no reactivos de Vue.
  return fxMode() ? { id: clipId(), fx: clipFx(), name: 'Clip Audio' } : target.value?.group
})
// Solo UI: los parámetros continúan en project.audio y pueden abrirse varios efectos.
const expanded = ref(new Set())
const isExpanded = id => expanded.value.has(id)
function toggleEffect(id) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}
watch(() => group.value?.id, () => { expanded.value = new Set() })
watch(() => group.value?.fx.map(f => f.id).join('|'), (next, previous) => {
  if (!fxMode() || !previous || !next) return
  const before = new Set(previous.split('|'))
  const added = next.split('|').find(id => !before.has(id))
  if (added) expanded.value = new Set([...expanded.value, added])
})
watch(() => store.audioInspector, selection => {
  const id = selection?.effectId
  if (id && !expanded.value.has(id)) expanded.value = new Set([...expanded.value, id])
}, { immediate: true })
const audio = computed(() => store.project?.audio)
const types = Object.entries(FX_TYPES)
const isBase = computed(() => BASE_IDS.includes(group.value?.id))
const fmtDb = v => v <= -80 ? '-∞' : `${v > 0 ? '+' : ''}${(+v).toFixed(1)}`
const fmt = (p, v) => p.unit === '%' ? `${Math.round(v * 100)} %` : `${p.step < 1 ? (+v).toFixed(p.step < 0.1 ? 2 : 1) : Math.round(v)}${p.unit ? ' ' + p.unit : ''}`
const parents = computed(() => {
  if (!group.value || !audio.value) return []
  const bad = new Set([group.value.id, ...descendants(audio.value, group.value.id)])
  return audio.value.groups.filter(g => !bad.has(g.id))
})
const update = patch => updateAudioGroup(group.value.id, patch)
async function addEffect(type) {
  if (!type || !group.value) return
  if (fxMode()) { emit('fx-add', type); return }
  const id = await addAudioFx(group.value.id, type)
  if (id) {
    selectAudioInspector(group.value.id, id)
    expanded.value = new Set([...expanded.value, id])
  }
}
function removeEffect(fxId) {
  if (!group.value) return
  if (fxMode()) emit('fx-remove', fxId)
  else removeAudioFx(group.value.id, fxId)
  if (expanded.value.has(fxId)) {
    const next = new Set(expanded.value)
    next.delete(fxId)
    expanded.value = next
  }
}
function preset(fxId, key) {
  if (fxMode()) { emit('fx-preset', fxId, key); return }
  const p = REVERB_PRESETS[key]
  if (p && group.value?.fx.some(f => f.id === fxId && f.type === 'reverb'))
    updateAudioFx(group.value.id, fxId, { on:true, time:p.time, damping:p.damping, mix:p.mix })
}
</script>

<template>
  <section v-if="group" class="audio-props" :data-group-id="group.id" :data-effect-id="target?.effect?.id || ''">
    <div v-if="!fxMode()" class="head">
      <i class="dot" :style="{background:group.color}"></i>
      <div class="hname"><b>{{ group.name }}</b><small>Grupo de audio</small></div>
    </div>
    <div v-if="!fxMode()" class="sect">
      <header>Propiedades</header>
      <label class="field"><span>Nombre</span><input type="text" maxlength="32" :value="group.name" :disabled="isBase" @change="update({name:$event.target.value.trim()||group.name})" /></label>
      <div class="field"><span>Color</span><ColorInput :value="group.color" @input="update({color:$event.target.value})" /></div>
      <label class="field"><span>Volumen</span><input type="range" min="-80" max="20" step="0.5" :value="group.volume" @input="update({volume:+$event.target.value})" /></label>
      <p class="value">{{ fmtDb(group.volume) }} dB</p>
      <label class="field"><span>Silencio</span><input type="checkbox" :checked="group.mute" @change="update({mute:$event.target.checked})" /></label>
      <label class="field"><span>Bypass de efectos</span><input type="checkbox" :checked="group.bypass" @change="update({bypass:$event.target.checked})" /></label>
      <label v-if="group.id!=='master'" class="field"><span>Salida</span><select :value="group.parent" @change="setGroupParent(group.id,$event.target.value)"><option v-for="g in parents" :key="g.id" :value="g.id">{{ g.name }}</option></select></label>
    </div>
    <div class="sect">
      <header><span v-if="fxMode()">Efectos de este clip ({{ group.fx.length }})</span><span v-show="!fxMode()">Cadena de efectos ({{ group.fx.length }})</span></header>
      <div class="chain" v-for="(f, index) in group.fx" :key="f.id" :data-effect-id="f.id">
        <div class="chain-head">
          <button class="effect" :aria-expanded="isExpanded(f.id)" :aria-controls="'fx-controls-'+f.id" @click="toggleEffect(f.id)">
            <Icon :name="isExpanded(f.id) ? 'chevron-down' : 'chevron-right'" :size="12" />
            <span>{{ FX_TYPES[f.type]?.label || f.type }}</span>
          </button>
          <input type="checkbox" :aria-label="'Activar '+(FX_TYPES[f.type]?.label || f.type)" :checked="f.on" :disabled="props.disabled" @change="fxMode() ? emit('fx-update',f.id,{on:$event.target.checked}) : updateAudioFx(group.id,f.id,{on:$event.target.checked})" />
          <button aria-label="Subir efecto" :disabled="props.disabled || index===0" @click="fxMode() ? emit('fx-move',f.id,-1) : moveAudioFx(group.id,f.id,-1)">▲</button>
          <button aria-label="Bajar efecto" :disabled="props.disabled || index===group.fx.length-1" @click="fxMode() ? emit('fx-move',f.id,1) : moveAudioFx(group.id,f.id,1)">▼</button>
          <button aria-label="Eliminar efecto" :disabled="props.disabled" @click="removeEffect(f.id)"><Icon name="trash" :size="12" /></button>
        </div>
        <div v-if="isExpanded(f.id)" :id="'fx-controls-'+f.id" class="chain-body">
          <label v-for="param in FX_TYPES[f.type]?.params || []" :key="param.k" class="param">
            <span>{{ param.label }}</span>
            <input type="range" :min="param.min" :max="param.max" :step="param.step" :value="f[param.k]" :aria-label="param.label" :disabled="props.disabled" @input="fxMode() ? emit('fx-update',f.id,{[param.k]:+$event.target.value}) : updateAudioFx(group.id,f.id,{[param.k]:+$event.target.value})" />
            <output>{{ fmt(param,f[param.k]) }}</output>
          </label>
          <div v-if="f.type==='reverb'" class="presets">
            <button v-for="(value,key) in REVERB_PRESETS" :key="key" :disabled="props.disabled" @click="preset(f.id,key)">{{ value.label }}</button>
          </div>
        </div>
      </div>
      <label class="field"><span>Añadir efecto</span><select aria-label="Añadir efecto" :disabled="props.disabled || fxMode() && group.fx.length >= 16" :value="''" @change="addEffect($event.target.value);$event.target.value=''">
        <option value="">Seleccionar efecto…</option><option v-for="[k,v] in types" :key="k" :value="k">{{ v.label }}</option>
      </select></label>
    </div>
  </section>
</template>

<style scoped>
.audio-props{font-size:12px;min-width:0}
.head{display:flex;align-items:center;gap:9px;padding:12px;border-bottom:1px solid var(--hair);min-width:0}
.dot{width:13px;height:13px;border-radius:50%;flex:none}
.hname{display:flex;flex-direction:column;gap:3px;flex:1;min-width:0;overflow-wrap:anywhere}.hname small{color:var(--text-3)}
.sect{padding:4px 10px 10px;border-bottom:1px solid var(--hair);min-width:0}
.sect>header{display:flex;align-items:center;gap:4px;font-weight:600;min-height:30px;flex-wrap:wrap}
.sect>header .grow{flex:1}
.sect>header button{min-width:25px}
.field,.param{display:grid;grid-template-columns:minmax(84px,var(--lf-property-label-width,112px)) minmax(0,1fr);align-items:center;gap:8px;min-height:34px;padding:4px 0;min-width:0}
.field>span,.param>span{overflow-wrap:anywhere;white-space:normal}
.field input:not([type=checkbox]),.field select{width:100%;min-width:0}
.field input[type=checkbox]{justify-self:start}
.param{grid-template-columns:minmax(70px,1fr) minmax(40px,1fr) auto;gap:5px}
.param input{width:100%;min-width:30px}.param output,.value{font-variant-numeric:tabular-nums;color:var(--text-2);font-size:11px;text-align:right}
.presets{display:flex;gap:4px;flex-wrap:wrap;padding:6px 0}
.presets button{font-size:11px}
.chain{border:1px solid var(--hair);border-radius:4px;margin:5px 0;min-width:0}
.chain-head{display:flex;align-items:center;gap:4px;padding:4px;min-width:0}
.chain-head>button:not(.effect){flex:none;min-width:22px;height:23px;padding:2px}
.chain-head>input{flex:none}
.chain .effect{display:flex;align-items:center;gap:5px;flex:1;min-width:0;text-align:left;white-space:normal}
.chain .effect>span{overflow-wrap:anywhere;min-width:0}
.chain-body{border-top:1px solid var(--hair);padding:5px 8px 8px;min-width:0}
.chain-body .param{min-height:34px}
@container insp (max-width:330px){.chain-head{gap:2px}.chain-head>button:not(.effect){min-width:20px;padding:1px}}
@container insp (max-width:260px){.field{grid-template-columns:minmax(0,1fr)}.param{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.param>span{grid-column:1/-1}}
</style>
