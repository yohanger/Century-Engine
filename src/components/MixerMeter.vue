<script setup>
// Medidor de un canal del mezclador. Tiene su propio bucle de animación: así el mezclador (que contiene campos de texto) no se redibuja
// en cada fotograma, lo que borraba lo que se escribía en los campos (Vue reasigna `value` en cada redibujado).
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { getAudio } from '../engine/runtime/audio/engine.js'
const props = defineProps({ gid: { type: String, required: true } })
const db = ref(-80), peak = ref(-80)
let raf = 0
const dbOf = (rms) => (rms > 0.00001 ? 20 * Math.log10(rms) : -80)
const pct = (v) => Math.max(0, Math.min(100, ((v + 60) / 66) * 100)) // −60 dB … +6 dB
const fmtDb = (v) => (v <= -80 ? '-∞' : (v > 0 ? '+' : '') + (+v).toFixed(1))
function loop() {
  const e = getAudio()
  if (e.ctx) {
    const d = dbOf(e.level(props.gid))
    const nd = Math.max(d, db.value - 1.2), np = Math.max(d, peak.value - 0.25)
    if (nd !== db.value) db.value = nd
    if (np !== peak.value) peak.value = np
  }
  raf = requestAnimationFrame(loop)
}
onMounted(() => { raf = requestAnimationFrame(loop) })
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <div class="meter" :data-tooltip="fmtDb(db) + ' dB'">
    <i class="bar" :style="{ height: pct(db) + '%' }"></i><i class="peak" :style="{ bottom: pct(peak) + '%' }"></i>
  </div>
</template>

<style scoped>
.meter { position: relative; width: 9px; background: var(--g-950); border-radius: 2px; overflow: hidden; }
.meter .bar { position: absolute; left: 0; right: 0; bottom: 0; background: linear-gradient(to top, #3ddc84 0%, #3ddc84 60%, #e8c04a 82%, #e8574a 100%); background-size: 100% 130px; background-position: bottom; }
.meter .peak { position: absolute; left: 0; right: 0; height: 2px; background: #fff; opacity: .85; }
</style>
