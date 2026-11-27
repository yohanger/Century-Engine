<script>
// Un observador compartido para todas las ondas visibles del Timeline.
let observer
const observed = new Map()
</script>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import { store } from '../core/state/state.js'
import { assetVersion } from '../core/db.js'
import { resolveAudioClip } from '../engine/runtime/audio/config.js'
import { requestTimelineAudioAnalysis } from '../core/timeline/audio-source-analysis.js'
import { audioWaveformPath } from '../core/timeline/audio-waveform.js'
import { audioWaveformPeak, MAX_WAVEFORM_COLUMNS } from '../core/timeline/audio-waveform.js'

const emit = defineEmits(['source-duration'])
const props = defineProps({
  clip: { type: String, default: '' },
  inspector: { type: Boolean, default: false },
  duration: { type: Number, default: 0 },
  offset: { type: Number, default: 0 },
  pitch: { type: Number, default: 1 },
  loop: { type: Boolean, default: false },
  clipStartPx: { type: Number, default: 0 },
  clipWidthPx: { type: Number, default: 0 },
  viewportLeftPx: { type: Number, default: 0 },
  viewportWidthPx: { type: Number, default: 0 },
})
const surface = ref(null), visible = ref(false), result = shallowRef(null)
const enabled = computed(() => props.inspector || visible.value)
const projectId = computed(() => store.project?.id)
const assetId = computed(() => enabled.value ? resolveAudioClip(store.project, props.clip) : null)
const source = computed(() => assetId.value && assetVersion(projectId.value, assetId.value))
// Solo se dibuja la ventana visible (con margen), no toda la fuente ampliada.
const drawWindow = computed(() => {
  const full = Math.max(0, props.clipWidthPx) || 128
  if (!(props.viewportWidthPx > 0) || !(props.clipWidthPx > 0)) return { left: 0, width: full }
  const relative = props.viewportLeftPx - props.clipStartPx
  const left = Math.min(full, Math.max(0, Math.floor((relative - 64) / 32) * 32))
  const right = Math.min(full, Math.max(0, Math.ceil((relative + props.viewportWidthPx + 64) / 32) * 32))
  return { left, width: Math.max(0, right - left) }
})
const drawColumns = computed(() => Math.max(1, Math.min(MAX_WAVEFORM_COLUMNS,
  result.value?.data?.low?.length || MAX_WAVEFORM_COLUMNS, Math.ceil(drawWindow.value.width))))
const sourcePeak = computed(() => audioWaveformPeak(result.value?.data, props.duration, props.offset, props.pitch, props.loop))
const waveform = computed(() => audioWaveformPath(result.value?.data,
  drawWindow.value.width > 0 ? props.duration : 0, props.offset, props.pitch, props.loop, {
    columns: drawColumns.value,
    startTime: props.duration * drawWindow.value.left / (props.clipWidthPx || drawWindow.value.width || 1),
    endTime: props.duration * (drawWindow.value.left + drawWindow.value.width) / (props.clipWidthPx || drawWindow.value.width || 1),
    peak: sourcePeak.value,
  }))
const status = computed(() => result.value?.status || 'loading')
const db = value => `${value === -Infinity ? '−∞' : value.toFixed(1)} dBFS`

watch([enabled, projectId, assetId, source], ([show, project], _, onCleanup) => {
  result.value = null
  if (!show || !project) return
  emit('source-duration', null)
  onCleanup(requestTimelineAudioAnalysis(store.project, props.clip, value => {
    result.value = value
    emit('source-duration', value.status === 'ready' ? value.data.duration : null)
  }, props.inspector))
}, { immediate: true })

onMounted(() => {
  if (props.inspector || !surface.value) return
  if (typeof IntersectionObserver === 'undefined') { visible.value = true; return }
  observer ??= new IntersectionObserver(entries => {
    for (const entry of entries) observed.get(entry.target)?.(entry.isIntersecting)
  })
  observed.set(surface.value, value => { visible.value = value })
  observer.observe(surface.value)
})
onBeforeUnmount(() => {
  if (!surface.value) return
  observer?.unobserve(surface.value)
  observed.delete(surface.value)
  if (observed.size === 0 && observer) {
    observer.disconnect()
    observer = null
  }
})
</script>

<template>
  <section v-if="inspector" class="audio-source-analysis" aria-label="Análisis del audio fuente" :data-audio-analysis="status">
    <h4>Audio fuente</h4>
    <dl v-if="status === 'ready'">
      <dt>Duración</dt><dd>{{ result.data.duration.toFixed(3) }} s</dd>
      <dt>Canales</dt><dd>{{ result.data.channels }}</dd>
      <dt>Muestreo del análisis</dt><dd>{{ result.data.sampleRate }} Hz</dd>
      <dt>Pico de muestra</dt><dd>{{ db(result.data.peakDb) }}</dd>
      <dt>RMS</dt><dd>{{ db(result.data.rmsDb) }}</dd>
    </dl>
    <p v-else role="status">{{ status === 'missing' ? (clip ? 'Audio fuente no disponible' : 'Selecciona un archivo de audio') : status === 'invalid' ? 'El audio fuente no se pudo decodificar' : 'Analizando audio…' }}</p>
  </section>
  <svg v-else ref="surface" class="timeline-waveform" :data-audio-analysis="status"
    :data-waveform-columns="drawColumns" :data-waveform-window-start="drawWindow.left"
    :style="{ left: drawWindow.left + 'px', width: drawWindow.width + 'px' }"
    :viewBox="`0 0 ${drawColumns} 32`" preserveAspectRatio="none" aria-hidden="true">
    <path v-if="waveform" :d="waveform" vector-effect="non-scaling-stroke" />
  </svg>
</template>

<style scoped>
.timeline-waveform { position:absolute; inset:10px 0 1px; width:100%; height:calc(100% - 11px); color:#a9efc9; pointer-events:none; overflow:hidden; }
.timeline-waveform path { fill:currentColor; fill-opacity:.88; stroke:currentColor; stroke-width:.7px; }
.audio-source-analysis { margin:8px 0 10px; padding:7px 0; border-block:1px solid var(--hair, #ffffff22); }
.audio-source-analysis h4 { margin:0 0 6px; font-size:12px; }
.audio-source-analysis dl { display:grid; grid-template-columns:minmax(0, 1fr) auto; gap:3px 8px; margin:0; }
.audio-source-analysis dt, .audio-source-analysis p { color:var(--text-2); }
.audio-source-analysis dd { margin:0; text-align:right; font-variant-numeric:tabular-nums; }
.audio-source-analysis p { margin:0; }
</style>
