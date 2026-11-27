<script setup>
// Campo «Localización» del comando «Mostrar texto»: enlaza el comando con una clave de la tabla de Localización.
// Sin clave: «Localizar este texto» crea una (escena.evento.N) con el texto y la voz del comando. Con clave: estado de cada idioma,
// abrir la ventana en esa clave o desenlazar. El texto base de la tabla manda: al abrir el comando se copia al campo «Texto», y lo
// que se escriba en «Texto» o «Voz» se guarda también en la tabla.
import { computed, onMounted, watch } from 'vue'
import { store, loc, locAddEntry, locSetText, locSetVoice, openLocalization } from '../core/store.js'
import { findEntry, newKey, slug } from '../engine/runtime/i18n/localization.js'

const props = defineProps({ modelValue: { type: String, default: '' }, values: { type: Object, required: true } })
const emit = defineEmits(['update:modelValue', 'sync'])
const L = computed(() => loc())
const entry = computed(() => (props.modelValue ? findEntry(L.value, props.modelValue) : null))
const keys = computed(() => L.value.entries.filter((e) => !e.key.startsWith('speaker.')).map((e) => e.key))

function create() {
  const ev = store.project.objects.find((o) => o.id === store.eventEditId)
  const scene = store.project.scenes?.find((x) => x.id === store.project.activeSceneId)?.name || ''
  const prefix = [slug(scene), slug(ev?.name || (String(store.eventEditId || '').startsWith('db:') ? 'comun' : ''))].filter(Boolean).join('.') || 'texto'
  const e = locAddEntry(newKey(L.value, prefix), props.values.text || '', { note: props.values.speaker ? `Habla: ${props.values.speaker}` : '', voice: props.values.voice || '' })
  if (e) emit('update:modelValue', e.key)
}
function link(k) { emit('update:modelValue', String(k || '').trim()) }
// la tabla manda: al enlazar/abrir, el texto del comando toma el texto base de la clave
function pull() {
  const e = entry.value
  if (!e) return
  const base = e.text[L.value.base]
  if (base != null && base !== props.values.text) { props.values.text = base; emit('sync', 'text') }
  if (!props.values.voice && e.voice[L.value.base]) { props.values.voice = e.voice[L.value.base]; emit('sync', 'voice') }
}
onMounted(pull)
watch(() => props.modelValue, pull)
watch(() => props.values.text, (t) => { const e = entry.value; if (e && e.text[L.value.base] !== t) locSetText(e.key, L.value.base, t) })
watch(() => props.values.voice, (v) => { const e = entry.value; if (e && (e.voice[L.value.base] || '') !== (v || '')) locSetVoice(e.key, L.value.base, v || '') })
</script>

<template>
  <div class="lockey">
    <template v-if="!modelValue">
      <button type="button" class="mk" data-testid="loc-create" @click="create">🌐 Localizar este texto</button>
      <select v-if="keys.length" data-tooltip="Enlazar con una clave que ya existe" @change="link($event.target.value)">
        <option value="">o enlazar con…</option>
        <option v-for="k in keys" :key="k" :value="k">{{ k }}</option>
      </select>
    </template>
    <template v-else>
      <div class="chip" :class="{ broken: !entry }">
        <code>{{ modelValue }}</code>
        <span v-if="!entry" class="warn">no existe en la tabla</span>
      </div>
      <div v-if="entry" class="langs">
        <span v-for="l in L.languages" :key="l.code" class="lg" :class="{ ok: entry.text[l.code], miss: !entry.text[l.code] }" :data-tooltip="l.name + (entry.text[l.code] ? ': ' + entry.text[l.code] : ': falta traducir') + (entry.voice[l.code] ? ' · con voz' : '')">{{ l.code }}{{ entry.voice[l.code] ? ' 🔊' : '' }}</span>
      </div>
      <div class="acts">
        <button type="button" data-testid="loc-open" @click="openLocalization(modelValue)">Abrir en Localización</button>
        <button v-if="!entry" type="button" @click="create">Crear clave</button>
        <button type="button" data-tooltip="Quitar el enlace (el comando conserva su texto)" @click="link('')">Desenlazar</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.lockey { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.mk { height: 24px; padding: 0 10px; }
.lockey select { height: 24px; max-width: 200px; }
.chip { display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; border-radius: 4px; background: var(--g-800); border: 1px solid var(--hair); }
.chip code { color: #9cdcfe; font-size: 11.5px; }
.chip.broken { border-color: var(--danger); }
.warn { color: var(--danger); font-size: 11px; }
.langs { display: flex; gap: 4px; }
.lg { padding: 1px 6px; border-radius: 8px; font: 600 10px/1.6 ui-monospace, monospace; text-transform: uppercase; }
.lg.ok { background: rgba(95, 200, 143, .15); color: var(--ok); }
.lg.miss { background: var(--amber-wash); color: var(--amber); }
.acts { display: flex; gap: 6px; width: 100%; }
.acts button { height: 22px; padding: 0 8px; font-size: 11.5px; }
</style>
