<script setup>
// Formulario GENERADO a partir de una lista de parámetros declarados (events/commandDefs.js · events/model.js).
// Los comandos, las condiciones y el gráfico de un evento usan este mismo componente: no hay formularios hechos a mano.
import IconField from './IconField.vue'
import ResourceDropSlot from './ResourceDropSlot.vue'
import ImageField from './ImageField.vue'
import { computed } from 'vue'
import { store, pickOnMap } from '../core/store.js'
import Icon from './Icon.vue'
import VarPicker from './VarPicker.vue'
import { whenOk, defaults, clone, NATIVE_SIGNALS } from '../engine/runtime/events/model.js'
import { refOptions, slotOptions, MODEL_PRIMS } from '../engine/runtime/database/schema.js'
import NumberField from './NumberField.vue'
import PropertyKey from './PropertyKey.vue'
import TextField from './TextField.vue'
import { AUDIO_EXT, resolveAudioGroup } from '../engine/runtime/audio/config.js'
import { allEntries } from '../core/project.js'
import { newMatchCase, moveMatchCase } from '../engine/runtime/events/match.js'
import Vec3Field from './Vec3Field.vue'
import RouteEditor from './RouteEditor.vue'
import InputRefField from './InputRefField.vue'
import CodeField from './CodeField.vue'
import LocKeyField from './LocKeyField.vue'

const props = defineProps({
  params: { type: Array, required: true },
  values: { type: Object, required: true }, // se modifica en sitio
  timelinePrefix: { type: String, default: '' },
  timelineKeyable: { type: Function, default: null },
  timelineMarked: { type: Function, default: null },
})
const emit = defineEmits(['change', 'commit', 'insert-key'])

const shown = computed(() => props.params.filter((p) => whenOk(p.when, props.values)))
const set = (p, v) => {
  props.values[p.key] = v
  emit('change', p.key)
  // Los controles continuos confirman al terminar el gesto; los selectores lo hacen aquí.
  if (!['number', 'text', 'color'].includes(p.type)) emit('commit')
}

const pad = (i) => String(i).padStart(3, '0')
const db = computed(() => store.project.database)
const idCount = (kind) => Math.max(20, (db.value[kind] || []).length + 5)
const ids = (kind) => Array.from({ length: idCount(kind) }, (_, i) => i + 1)
const dbName = (kind, i) => ((db.value[kind] || [])[i - 1] || '')
const audioAssets = computed(() => allEntries(store.project).filter(a => (a.kind === 'audio' || a.kind === 'file') && AUDIO_EXT.includes(String(a.ref?.ext || a.name.split('.').pop() || '').toLowerCase())))
const modelIds = computed(() => (store.project.models || []).map(m => m.id))
const profileIds = computed(() => (store.project.profiles || []).map(p => p.id))
const prefabIds = computed(() => (store.project.prefabs || []).map(f => f.id))
const textureIds = computed(() => (store.project.assets || []).filter(a => a.kind === 'texture').map(a => a.id))
const audioKinds = ['audio', 'file']
const setAudio = (p, id) => { const asset = audioAssets.value.find(a => a.id === id); if (asset) set(p, asset.name) }
const nodes = (p) => store.project.objects.filter((o) => !p.only || p.only.includes(o.type))
const optIndex = (p) => Math.max(0, p.options.findIndex(([v]) => v === props.values[p.key]))

async function pickPoint(p) {
  const r = await pickOnMap({ title: p.label, point: props.values[p.key] })
  if (r) set(p, r)
}
const ptSet = (p, i, v) => { const a = [...(props.values[p.key] || [0, null, 0])]; a[i] = v; set(p, a) }
const ptAuto = (p) => { const y = (props.values[p.key] || [])[1]; return y === null || y === undefined || y === '' }

function matchAdd(p) { set(p, [...(props.values[p.key] || []), newMatchCase()]) }
function matchRemove(p, i) { const a = [...(props.values[p.key] || [])]; a.splice(i, 1); set(p, a) }
function matchMove(p, i, by) { const a = [...(props.values[p.key] || [])]; if (moveMatchCase({ cases: a }, i, by)) set(p, a) }
function listSet(p, i, v) { const a = [...(props.values[p.key] || [])]; a[i] = v; set(p, a) }
function listAdd(p) { set(p, [...(props.values[p.key] || []), `Opción ${(props.values[p.key] || []).length + 1}`]) }
function listDel(p, i) { const a = [...(props.values[p.key] || [])]; a.splice(i, 1); set(p, a) }

// --- base de datos: referencias, listas anidadas y equipo ---
const opts = (kind) => refOptions(db.value, kind)
const slotChoices = computed(() => slotOptions(db.value)) // Base de datos ▸ Jugador ▸ slots del view model
const equipKind = (slot) => (slot === 1 ? 'weapons' : 'armors')
const equipChoices = (slot) => (db.value[equipKind(slot)] || []).filter((r) => +r.etype === slot).map((r) => [r.id, r.name || '#' + r.id])
const slots = computed(() => db.value.system?.equipTypes || [])
function equipSet(p, i, v) { const a = [...(props.values[p.key] || [])]; while (a.length < slots.value.length) a.push(0); a[i] = v; set(p, a) }
function itemAdd(p) { set(p, [...(props.values[p.key] || []), defaults(p.item)]) }
function itemDel(p, i) { const a = [...(props.values[p.key] || [])]; a.splice(i, 1); set(p, a) }
function itemMove(p, i, d) { const a = [...(props.values[p.key] || [])], j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set(p, a) }

</script>

<template>
  <div class="pf">
    <template v-for="p in shown" :key="p.key">
    <div v-if="p.type === 'header'" class="hd">{{ p.label }}</div>
    <div v-else class="row" :class="['t-' + p.type]">
      <label :data-tooltip="p.hint || ''">{{ p.label }}</label>
      <div class="ctl">
        <div v-if="p.type === 'matchcases'" class="match-cases" data-testid="match-cases">
          <div v-for="(item, i) in values[p.key] || []" :key="item.id" class="match-case">
            <span class="match-case-name">Case {{ i + 1 }}</span>
            <select v-model="item.src" aria-label="Tipo de caso">
              <option value="number">Número</option><option value="text">Texto</option><option value="bool">Sí / No</option><option value="variable">Variable</option>
            </select>
            <input v-if="item.src === 'number'" v-model.number="item.value" type="number" aria-label="Número del caso" />
            <input v-else-if="item.src === 'text'" v-model="item.text" type="text" aria-label="Texto del caso" />
            <select v-else-if="item.src === 'bool'" v-model="item.flag" aria-label="Booleano del caso"><option :value="true">Sí</option><option :value="false">No</option></select>
            <VarPicker v-else-if="item.src === 'variable'" v-model="item.variable" kind="variables" />
            <div class="match-case-actions">
              <button type="button" :disabled="i === 0" data-tooltip="Subir caso" @click="matchMove(p, i, -1)">↑</button>
              <button type="button" :disabled="i === values[p.key].length - 1" data-tooltip="Bajar caso" @click="matchMove(p, i, 1)">↓</button>
              <button type="button" data-tooltip="Eliminar caso" @click="matchRemove(p, i)">×</button>
            </div>
          </div>
          <button type="button" @click="matchAdd(p)">+ Añadir Case</button>
          <small>Se ejecuta únicamente el primer caso que coincida. Los comandos de cada rama se editan después, en la lista del evento.</small>
        </div>
        <CodeField v-else-if="p.type === 'text' && p.js" inline :model-value="String(values[p.key] ?? '')" :placeholder="p.hint || ''" @update:model-value="set(p, $event)" />
        <TextField v-else-if="p.type === 'text'" :model-value="String(values[p.key] ?? '')" :placeholder="p.hint || ''" @update:model-value="set(p, $event)" @commit="emit('commit')" />
        <div v-else-if="p.type === 'signal'" class="signal-name">
          <select :value="NATIVE_SIGNALS.some(([name]) => name === values[p.key]) ? values[p.key] : '__custom__'" @change="set(p, $event.target.value === '__custom__' ? '' : $event.target.value)">
            <option value="__custom__">Personalizada…</option>
            <option v-for="[name, label] in NATIVE_SIGNALS" :key="name" :value="name">{{ label }} ({{ name }})</option>
          </select>
          <input v-if="!NATIVE_SIGNALS.some(([name]) => name === values[p.key])" type="text" :value="values[p.key] || ''" placeholder="Nombre de la señal" @input="set(p, $event.target.value)" />
        </div>
        <textarea v-else-if="p.type === 'textarea'" rows="4" :value="values[p.key]" @input="set(p, $event.target.value)"></textarea>
        <LocKeyField v-else-if="p.type === 'lockey'" :model-value="String(values[p.key] || '')" :values="values" @update:model-value="set(p, $event)" @sync="(k) => emit('change', k)" />
        <CodeField v-else-if="p.type === 'code'" :model-value="String(values[p.key] ?? '')" @update:model-value="set(p, $event)" />
        <NumberField v-else-if="p.type === 'number'" :model-value="+values[p.key] || 0" :step="p.step ?? 1" :min="p.min ?? -Infinity" :max="p.max ?? Infinity" @update:model-value="set(p, $event)" @commit="emit('commit')" />
        <input v-else-if="p.type === 'bool'" type="checkbox" :checked="!!values[p.key]" @change="set(p, $event.target.checked)" />
        <select v-else-if="p.type === 'select'" :value="optIndex(p)" @change="set(p, p.options[+$event.target.value][0])">
          <template v-for="(o, i) in p.options" :key="i"><option v-if="!(p.deprecated || []).includes(o[0]) || values[p.key] === o[0]" :value="i">{{ o[1] }}{{ (p.deprecated || []).includes(o[0]) ? ' (obsoleto)' : '' }}</option></template>
        </select>
        <InputRefField v-else-if="p.type === 'action' || p.type === 'key'" :mode="p.type" :model-value="String(values[p.key] ?? '')" @update:model-value="set(p, $event)" />
        <VarPicker v-else-if="p.type === 'switch'" kind="switches" :model-value="+values[p.key] || 0" :optional="p.optional" :none="p.none || ''" @update:model-value="set(p, $event)" />
        <VarPicker v-else-if="p.type === 'variable'" kind="variables" :model-value="+values[p.key] || 0" :optional="p.optional" :none="p.none || ''" @update:model-value="set(p, $event)" />
        <select v-else-if="p.type === 'selfswitch'" :value="values[p.key]" @change="set(p, $event.target.value)">
          <option v-for="c in ['A', 'B', 'C', 'D']" :key="c" :value="c">{{ c }}</option>
        </select>
        <select v-else-if="p.type === 'scene'" :value="values[p.key]" @change="set(p, $event.target.value)">
          <option value="">— elegir escena —</option>
          <option v-for="s in store.project.scenes" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <ResourceDropSlot v-else-if="p.type === 'texture'" :kinds="['texture']" :accepted-ids="textureIds" @assign="set(p, $event)">
          <select :value="values[p.key] || ''" @change="set(p, $event.target.value)">
            <option value="">— por defecto —</option>
            <option v-for="a in store.project.assets.filter((x) => x.kind === 'texture')" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </ResourceDropSlot>
        <select v-else-if="p.type === 'ui'" :value="values[p.key]" @change="set(p, $event.target.value)">
          <option value="">— elegir interfaz —</option>
          <option v-for="u in store.project.uis" :key="u.id" :value="u.id">{{ u.name.replace(/\.ui$/, '') }}</option>
        </select>
        <ResourceDropSlot v-else-if="p.type === 'audio'" :kinds="audioKinds" :accepted-ids="audioAssets.map(a => a.id)" @assign="setAudio(p, $event)">
          <select :value="values[p.key] || ''" @change="set(p, $event.target.value)">
            <option value="">— elegir clip —</option>
            <option v-for="a in audioAssets" :key="a.id" :value="a.name">{{ a.name }}</option>
          </select>
        </ResourceDropSlot>
        <ResourceDropSlot v-else-if="p.type === 'prefab'" :kinds="['prefab']" :accepted-ids="prefabIds" @assign="set(p, $event)">
          <select :value="values[p.key] || ''" @change="set(p, $event.target.value || null)">
            <option value="">— elegir prefab —</option>
            <option v-for="f in store.project.prefabs || []" :key="f.id" :value="f.id">{{ f.name }}</option>
          </select>
        </ResourceDropSlot>
        <select v-else-if="p.type === 'cameranode' || p.type === 'cameraid'" :value="p.type === 'cameraid' && values.sceneId !== store.project.activeSceneId ? '' : values[p.key] || ''" @change="set(p, $event.target.value)">
          <option value="">— elegir cámara —</option>
          <option v-if="p.type === 'cameraid' && values.sceneId === store.project.activeSceneId && values[p.key] && !store.project.objects.some(o => o.type === 'camera' && o.id === values[p.key])" :value="values[p.key]" disabled>Camera3D ausente · {{ values[p.key] }}</option>
          <option v-for="o in store.project.objects.filter((x) => x.type === 'camera')" :key="o.id" :value="p.type === 'cameraid' ? o.id : o.name">{{ o.name }}{{ p.type === 'cameraid' ? ' · ' + o.id : '' }}</option>
        </select>
        <select v-else-if="p.type === 'timeline'" :value="values[p.key] || ''" @change="set(p, $event.target.value)">
          <option value="">— elegir timeline —</option>
          <option v-for="t in store.project.timelines" :key="t.id" :value="t.name">{{ t.name }}</option>
        </select>
        <select v-else-if="p.type === 'audiogroup'" :value="values[p.key] || ''" @change="set(p, $event.target.value)">
          <option v-if="p.optional" value="">— todos —</option>
          <option v-if="resolveAudioGroup(store.project.audio, values[p.key]).missing" :value="values[p.key]" disabled>Bus ausente · {{ values[p.key] }} (se reproduce en SFX)</option>
          <option v-else-if="resolveAudioGroup(store.project.audio, values[p.key]).legacy" :value="values[p.key]" disabled>Referencia antigua · {{ values[p.key] }} → {{ resolveAudioGroup(store.project.audio, values[p.key]).id }}</option>
          <option v-for="g in store.project.audio.groups" :key="g.id" :value="g.id">{{ g.name }}</option>
        </select>
        <select v-else-if="p.type === 'node'" :value="values[p.key]" @change="set(p, $event.target.value)">
          <option value="">{{ p.optional ? p.none || '— ninguno —' : '— elegir nodo —' }}</option>
          <option v-for="o in nodes(p)" :key="o.id" :value="o.id">{{ o.name }} · {{ o.type }}</option>
        </select>
        <ResourceDropSlot v-else-if="p.type === 'model'" :kinds="p.prims ? ['model', 'prefab'] : ['model']" :accepted-ids="p.prims ? [...modelIds, ...prefabIds] : modelIds" @assign="set(p, prefabIds.includes($event) ? 'prefab:' + $event : $event)">
        <select :value="values[p.key] || ''" @change="set(p, $event.target.value || null)">
          <option value="">{{ p.prims ? '— Sin modelo —' : '— Select model —' }}</option>
          <option v-if="values[p.key] && !String(values[p.key]).startsWith('prim:') && !String(values[p.key]).startsWith('prefab:') && !store.project.models.some((m) => m.id === values[p.key])" :value="values[p.key]">Missing model ({{ values[p.key] }})</option>
          <option v-if="String(values[p.key] || '').startsWith('prefab:') && !(store.project.prefabs || []).some((f) => 'prefab:' + f.id === values[p.key])" :value="values[p.key]">Prefab que ya no existe</option>
          <template v-if="p.prims">
            <optgroup label="Primitivas"><option v-for="[k, l] in MODEL_PRIMS" :key="k" :value="'prim:' + k">{{ l }}</option></optgroup>
            <optgroup v-if="store.project.models.length" label="Modelos del proyecto"><option v-for="m in store.project.models" :key="m.id" :value="m.id">{{ m.name }}</option></optgroup>
            <optgroup v-if="(store.project.prefabs || []).length" label="Prefabs"><option v-for="f in store.project.prefabs" :key="f.id" :value="'prefab:' + f.id">{{ f.name }}</option></optgroup>
          </template>
          <template v-else><option v-for="m in store.project.models" :key="m.id" :value="m.id">{{ m.name }}</option></template>
        </select>
        </ResourceDropSlot>
        <div v-else-if="p.type === 'point'" class="pt">
          <NumberField :model-value="+(values[p.key] || [])[0] || 0" label="X" color="#c0504d" :step="0.5" @update:model-value="ptSet(p, 0, $event)" />
          <NumberField v-if="!ptAuto(p)" :model-value="+(values[p.key] || [])[1] || 0" label="Y" color="#6aa84f" :step="0.5" @update:model-value="ptSet(p, 1, $event)" />
          <label v-else class="auto" data-tooltip="La altura sale del mapa de navegación"><span>Y</span>auto</label>
          <NumberField :model-value="+(values[p.key] || [])[2] || 0" label="Z" color="#4a7fc1" :step="0.5" @update:model-value="ptSet(p, 2, $event)" />
          <button class="ic" :data-tooltip="ptAuto(p) ? 'Fijar la altura Y a mano' : 'Y automática'" @click="ptSet(p, 1, ptAuto(p) ? 0 : null)">Y</button>
          <button class="ic map" data-tooltip="Elegir en el mapa" data-testid="pick-map" @click="pickPoint(p)"><Icon name="pin" :size="13" /> Mapa</button>
        </div>
        <Vec3Field v-else-if="p.type === 'vec3'" :model-value="values[p.key] || [0, 0, 0]" :step="0.1" @change="set(p, $event.value)" />
        <ColorInput v-else-if="p.type === 'color'" :value="values[p.key]" @input="set(p, $event.target.value)" @change="emit('commit')" />
        <ResourceDropSlot v-else-if="p.type === 'profile'" :kinds="['profile']" :accepted-ids="profileIds" @assign="set(p, $event)">
          <select :value="values[p.key] || ''" @change="set(p, $event.target.value)">
            <option value="">— Render del proyecto —</option>
            <option v-for="pr in store.project.profiles || []" :key="pr.id" :value="pr.id">{{ pr.name.replace(/\.(post|profile)$/i, '') }}</option>
          </select>
        </ResourceDropSlot>
        <select v-else-if="p.type === 'animation'" :value="values[p.key] || ''" @change="set(p, $event.target.value)">
          <option value="">{{ p.optional ? '— cualquiera —' : '— elegir animación —' }}</option>
          <option v-for="c in store.project.animations || []" :key="c.id" :value="c.name">{{ c.name }}</option>
          <optgroup v-for="m in store.project.models.filter((x) => x.clips?.length)" :key="m.id" :label="'Modelo: ' + m.name">
            <option v-for="c in m.clips" :key="m.id + c.name" :value="c.name">{{ c.name }} ({{ c.duration }} s)</option>
          </optgroup>
          <option v-if="values[p.key] && !(store.project.animations || []).some((c) => c.name === values[p.key]) && !store.project.models.some((m) => m.clips?.some((c) => c.name === values[p.key]))" :value="values[p.key]">{{ values[p.key] }} (no existe)</option>
        </select>
        <select v-else-if="p.type === 'slot'" :value="values[p.key] || ''" @change="set(p, $event.target.value)">
          <option v-for="o in slotChoices" :key="o[0]" :value="o[0]">{{ o[1] }}</option>
          <option v-if="values[p.key] && !slotChoices.some((o) => o[0] === values[p.key])" :value="values[p.key]">{{ values[p.key] }} (no existe)</option>
        </select>
        <select v-else-if="p.type === 'ref'" :value="values[p.key] || 0" @change="set(p, +$event.target.value)">
          <option v-if="p.optional" :value="0">— ninguno —</option>
          <option v-else-if="p.all" :value="0">— Todo el grupo —</option>
          <option v-for="o in opts(p.kind)" :key="o[0]" :value="o[0]">{{ String(o[0]).padStart(3, '0') }} · {{ o[1] }}</option>
        </select>
        <ImageField v-else-if="p.type === 'image'" :model-value="String(values[p.key] || '')" @update:model-value="set(p, $event)" />
        <IconField v-else-if="p.type === 'icon'" :model-value="String(values[p.key] || '')" @update:model-value="set(p, $event)" />
        <input v-else-if="p.type === 'formula'" type="text" class="fml" spellcheck="false" :value="values[p.key]" :placeholder="p.hint || ''" :data-tooltip="p.hint || ''" @input="set(p, $event.target.value)" />
        <div v-else-if="p.type === 'equips'" class="eqs">
          <div v-for="(n, i) in slots" :key="i" class="eq"><span>{{ n }}</span>
            <select :value="(values[p.key] || [])[i] || 0" @change="equipSet(p, i, +$event.target.value)"><option :value="0">— vacío —</option><option v-for="o in equipChoices(i + 1)" :key="o[0]" :value="o[0]">{{ o[1] }}</option></select></div>
        </div>
        <select v-else-if="p.type === 'equipitem'" :value="values[p.key] || 0" @change="set(p, +$event.target.value)">
          <option :value="0">— quitar el equipo —</option>
          <option v-for="o in equipChoices(+values.slot || 1)" :key="o[0]" :value="o[0]">{{ o[1] }}</option>
        </select>
        <div v-else-if="p.type === 'list'" class="sub">
          <div v-for="(it, i) in values[p.key] || []" :key="i" class="card">
            <div class="ch"><b>{{ i + 1 }}</b><span v-if="p.summary" class="sum">{{ p.summary(it) }}</span><span class="grow"></span>
              <button class="ghost icon" data-tooltip="Subir" @click="itemMove(p, i, -1)">↑</button><button class="ghost icon" data-tooltip="Bajar" @click="itemMove(p, i, 1)">↓</button><button class="ghost icon danger" data-tooltip="Quitar" @click="itemDel(p, i)">✕</button></div>
            <ParamForm :params="p.item" :values="it" @change="emit('change', p.key)" />
          </div>
          <button v-if="!p.max || (values[p.key] || []).length < p.max" @click="itemAdd(p)">+ Añadir</button>
        </div>
        <RouteEditor v-else-if="p.type === 'route'" :route="values[p.key]" compact @change="emit('change', p.key)">
          <template #step-params="{ params, values: stepValues, notify }">
            <ParamForm :params="params" :values="stepValues" @change="notify" />
          </template>
        </RouteEditor>
        <div v-else-if="p.type === 'stringlist'" class="list">
          <div v-for="(s, i) in values[p.key] || []" :key="i" class="li">
            <span class="dim">{{ i + 1 }}</span>
            <input type="text" :value="s" @input="listSet(p, i, $event.target.value)" />
            <button class="ghost icon" data-tooltip="Quitar" :disabled="(values[p.key] || []).length <= 1" @click="listDel(p, i)">✕</button>
          </div>
          <button v-if="(values[p.key] || []).length < 8" @click="listAdd(p)">+ Añadir opción</button>
        </div>
      </div>
      <PropertyKey v-if="timelinePrefix && timelineKeyable?.(`${timelinePrefix}.${p.key}`)"
        :label="p.label" :available="true"
        :marked="!!timelineMarked?.(`${timelinePrefix}.${p.key}`)"
        @insert="emit('insert-key', `${timelinePrefix}.${p.key}`)" />
    </div>
    </template>
  </div>
</template>

<style scoped>
.signal-name { display: grid; gap: 5px; min-width: 0; }
.signal-name select, .signal-name input { width: 100%; min-width: 0; }
.pf { display: flex; flex-direction: column; gap: 6px; }
.row { display: grid; grid-template-columns: minmax(0, var(--lf-property-label-width, 112px)) minmax(0, 1fr); gap: 8px; align-items: center; min-height: 26px; min-width:0; }
.row:has(> .property-key) { grid-template-columns: minmax(0, var(--lf-property-label-width, 112px)) minmax(0, 1fr) 22px; gap: 5px; }
.row > label { color: var(--text-3); white-space: normal; overflow-wrap: anywhere; line-height: 1.3; min-width: 0; }
.row.t-textarea, .row.t-code, .row.t-stringlist, .row.t-list, .row.t-equips { align-items: start; }
.row.t-list, .row.t-matchcases { grid-template-columns: 1fr; align-items: start; } .row.t-list > label, .row.t-matchcases > label { font-weight: 600; color: var(--text-2); }
.row.t-code, .row.t-route { grid-template-columns: 1fr; }
.row.t-code > label, .row.t-route > label { display: none; }
.pt { display: flex; gap: 4px; align-items: center; width: 100%; }
.pt .auto { display: flex; align-items: center; gap: 4px; color: var(--text-3); padding: 0 6px; font-size: 11px; }
.pt .auto span { color: #6aa84f; font-weight: 600; }
.pt .ic { padding: 2px 6px; font-size: 11px; display: inline-flex; gap: 3px; align-items: center; }
.ctl { min-width: 0; max-width:100%; display: flex; }
.ctl > input[type='text'], .ctl > select, .ctl > textarea { width: 100%; min-width:0; max-width:100%; box-sizing:border-box; }
.ctl > select { text-overflow:ellipsis; white-space:nowrap; overflow:hidden; }
.ctl > input[type='checkbox'] { margin: 4px 0; }
textarea { height: auto; padding: 5px 7px; resize: vertical; line-height: 1.4; }
textarea.code { font: 12px/1.45 ui-monospace, 'JetBrains Mono', Consolas, monospace; min-height: 220px; white-space: pre; tab-size: 2; }
.list { display: flex; flex-direction: column; gap: 4px; width: 100%; }
.li { display: grid; grid-template-columns: 16px 1fr 24px; gap: 5px; align-items: center; }
.dim { color: var(--text-3); text-align: right; }
.hd { margin-top: 8px; padding-bottom: 3px; border-bottom: 1px solid var(--hair-soft); font-weight: 600; color: var(--text-2); font-size: 11.5px; }
.icn { display: flex; gap: 6px; align-items: center; width: 100%; } .icn input { flex: 1; } .icn .pv { width: 28px; height: 26px; display: flex; align-items: center; justify-content: center; background: var(--g-950); border: 1px solid var(--hair); border-radius: 4px; font-size: 15px; }
.fml { font: 12px ui-monospace, 'JetBrains Mono', Consolas, monospace; }
.eqs { display: flex; flex-direction: column; gap: 4px; width: 100%; } .eq { display: grid; grid-template-columns: 90px 1fr; gap: 6px; align-items: center; } .eq span { color: var(--text-3); font-size: 11.5px; }
.sub { display: flex; flex-direction: column; gap: 6px; width: 100%; max-height: 560px; overflow-y: auto; overscroll-behavior: contain; }
.card { border: 1px solid var(--hair); border-radius: 6px; padding: 6px 8px 8px; background: var(--g-900); }
.ch { display: flex; align-items: center; gap: 2px; margin-bottom: 4px; color: var(--text-3); font-size: 11px; } .ch .grow { flex: 1; } .ch .sum { margin-left: 8px; color: var(--text-2); }
/* ventana estrecha: la etiqueta pasa encima del control */
@container insp (max-width: 260px) { .row { grid-template-columns: minmax(0, 1fr); gap: 3px; } .row:has(> .property-key) { grid-template-columns: minmax(0, 1fr) 22px; } .row:has(> .property-key) > label { grid-column: 1 / -1; } .row > label { white-space: normal; } }
@container win (max-width: 520px) { .row { grid-template-columns: minmax(0, 1fr); gap: 3px; } .row:has(> .property-key) { grid-template-columns: minmax(0, 1fr) 22px; } .row:has(> .property-key) > label { grid-column: 1 / -1; } .row > label { white-space: normal; } .eq { grid-template-columns: 1fr; gap: 2px; } }
.match-cases { display: flex; flex-direction: column; gap: 8px; min-width: 0; width: 100%; }
.match-case { display: grid; grid-template-columns: 65px 92px minmax(90px, 1fr) auto; align-items: center; gap: 6px; }
.match-case-name { color: var(--text-2); white-space: nowrap; font-size: 11px; }
.match-case input, .match-case select { width: 100%; min-width: 0; }
.match-case-actions { display: flex; gap: 3px; }
.match-case-actions button { min-width: 27px; padding: 2px 4px; }
.match-cases > small { color: var(--text-3); line-height: 1.4; }
@container win (max-width: 560px) { .match-case { grid-template-columns: 1fr 1fr; } .match-case-actions { grid-column: 2; } }
</style>
