<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { store } from '../core/store.js'
import { diagnosticHudModel } from '../engine/runtime/render/diagnostic-hud-model.js'

const mode = computed(() => store.view.mode || 'lit')
const active = computed(() => mode.value !== 'lit' && !store.play.on && !store.gameView?.on)
const last = ref(null)
let poller = 0
const poll = () => {
  const vp=store.editor?.vp
  const report=vp?.viewDiagnostics?.last
  if (!report || report.mode !== mode.value) { last.value=null; return }
  // El valor GPU existe SOLO si PerfMonitor está midiendo y el driver admite timer queries.
  const skyGpu=vp?.perf?.enabled && vp?.perf?.gpuSupported
    ? vp.perf.stats.snapshot().gpu['Cielo atmosférico']?.avg : undefined
  last.value={...report,skyGpuMs:Number.isFinite(skyGpu)?skyGpu:undefined}
}
const stop = () => { if (poller) clearInterval(poller); poller = 0; last.value = null }
const sync = () => {
  stop()
  if (!active.value) return
  poll()
  poller = setInterval(poll, 400)
}
watch([mode, active], sync)
onMounted(sync)
onBeforeUnmount(stop)
const hud = computed(() => active.value ? diagnosticHudModel(mode.value, last.value) : null)
</script>

<template>
  <aside v-if="hud" class="diagnostics-hud" :aria-label="`Diagnóstico: ${hud.title}`">
    <div class="diagnostics-title">{{ hud.title }}</div>
    <div v-if="hud.unavailable" class="diagnostics-status">{{ hud.unavailable }}</div>
    <template v-else>
      <div v-if="hud.facts.length" class="diagnostics-facts">
        <span v-for="(fact, i) in hud.facts" :key="i"><small>{{ fact.label }}</small><b>{{ fact.value }}</b></span>
      </div>
      <div v-for="scale in hud.scales" :key="scale.label" class="diagnostics-scale">
        <div class="diagnostics-scale-title">{{ scale.label }}</div>
        <div class="diagnostics-heat" aria-hidden="true"><i v-for="color in scale.colors" :key="color" :style="{ background: color }"></i></div>
        <div class="diagnostics-scale-ends"><small>{{ scale.min }}</small><small>{{ scale.max }}</small></div>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.diagnostics-hud { position:absolute; left:12px; bottom:12px; z-index:7; pointer-events:none; width:min(285px, calc(100% - 24px)); padding:9px 11px; border:1px solid rgba(255,255,255,.15); border-radius:7px; background:rgba(11,15,21,.87); color:#e6edf4; box-shadow:0 6px 22px rgba(0,0,0,.25); font-size:11px; font-variant-numeric:tabular-nums; }
.diagnostics-title { font-size:12px; font-weight:650; margin-bottom:5px; }
.diagnostics-facts { display:flex; flex-wrap:wrap; gap:5px 16px; margin:3px 0 6px; }
.diagnostics-facts span { display:flex; gap:6px; align-items:baseline; }
.diagnostics-facts small, .diagnostics-scale-ends, .diagnostics-status { color:#a6b2c1; font-size:10px; }
.diagnostics-facts b { color:#fff; font-size:11px; }
.diagnostics-scale { margin-top:6px; }
.diagnostics-scale-title { font-size:10px; color:#cbd4df; margin-bottom:4px; }
.diagnostics-heat { display:flex; gap:2px; height:9px; overflow:hidden; border-radius:3px; }
.diagnostics-heat i { flex:1; }
.diagnostics-scale-ends { display:flex; justify-content:space-between; margin-top:3px; }
@media (max-width: 400px) { .diagnostics-hud { left:7px; bottom:7px; width:min(230px, calc(100% - 14px)); padding:7px 9px; } }
</style>
