<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
const props = defineProps({ monitor: { type: Object, required: true }, playing: { type: Boolean, default: false }, redraw: { type: Function, default: null }, closeShortcut: { type: String, default: 'F3' } })
const emit = defineEmits(['close'])

const snap = ref(null)
let timer = 0
const perf = () => props.monitor

const poll = () => { const p = perf(); if (p) snap.value = { ...p.stats.snapshot(), gpuOk: p.stats.extra.renderBackend !== 'WebGPU' && p.gpuSupported } }
onMounted(() => { perf()?.enable(true); poll(); timer = setInterval(poll, 400); props.redraw?.() })
onBeforeUnmount(() => { clearInterval(timer); perf()?.enable(false); props.redraw?.() })

const reconstructionLabels = { catmull: 'Catmull-Rom', 'edge-guard': 'Protección de bordes', linear: 'Bilineal', nearest: 'Vecino más cercano' }
const f1 = (v) => (v >= 100 ? Math.round(v) : v.toFixed(1))
const useGpu = computed(() => snap.value?.gpuOk && Object.keys(snap.value.gpu).length > 0)
const rows = computed(() => {
  const s = snap.value
  if (!s || s.extra.renderBackend === 'WebGPU') return []
  const src = useGpu.value ? s.gpu : s.cpu
  const hasPhases = Object.keys(src).some(k => k.startsWith('AO · ') && k !== 'AO · total')
  const list = Object.entries(src)
    .filter(([k, v]) => v.avg > 0.005 && k !== 'Fotograma (CPU)' && (!useGpu.value || k !== 'AO · total'))
    .map(([name, v]) => ({ name: hasPhases && useGpu.value && name === 'AO' ? 'AO · resto' : name, ms: v.avg, max: v.max }))
  list.sort((a, b) => b.ms - a.ms)
  const top = Math.max(16.67, ...list.map((r) => r.ms))
  return list.map((r) => ({ ...r, w: Math.max(2, Math.round((r.ms / top) * 100)) }))
})
const detailRows = computed(() => Object.entries(snap.value?.gpuDetails || {})
  .filter(([, v]) => v.n && v.avg > 0.005)
  .map(([name, v]) => ({ name, ms: v.avg })))
const cpuTotal = computed(() => snap.value?.cpu['Fotograma (CPU)']?.avg || 0)
const gpuTotal = computed(() => (useGpu.value ? Object.entries(snap.value.gpu)
  .reduce((a, [name, v]) => a + (name === 'AO · total' ? 0 : v.avg), 0) : 0))
const playing = computed(() => props.playing)

const bars = computed(() => {
  const h = snap.value?.history || []
  const top = Math.max(33.4, ...h)
  return h.map((v) => ({ h: Math.max(1, Math.round((Math.min(v, top) / top) * 28)), bad: v > 20 }))
})
const reset = () => { perf()?.reset(); poll(); props.redraw?.() }
const visibleRows = computed(() => rows.value.slice(0, 7))
const extraRows = computed(() => rows.value.slice(7))
</script>

<template>
  <div class="perf" @pointerdown.stop @wheel.stop>
    <header>
      <b>Rendimiento</b>
      <span v-if="playing && snap" class="fps" :class="{ low: snap.fps < 30, mid: snap.fps >= 30 && snap.fps < 55 }">{{ Math.round(snap.fps) }} FPS</span>
      <span v-else class="dim">Editor</span>
      <button type="button" data-tooltip="Reiniciar medias" aria-label="Reiniciar medias" @click="reset">⟲</button>
      <button type="button" :data-tooltip="`Cerrar (${props.closeShortcut})`" aria-label="Cerrar Rendimiento" @click="emit('close')">✕</button>
    </header>
    <template v-if="snap">
      <div v-if="playing" class="graph" data-tooltip="Historial de fotogramas">
        <i v-for="(b, i) in bars" :key="i" :class="{ bad: b.bad }" :style="{ height: b.h + 'px' }"></i><u></u>
      </div>
      <div v-if="playing" class="line"><span>Fotograma</span><b>{{ f1(snap.frameMs) }} ms</b></div>
      <div class="line"><span>CPU</span><b>{{ f1(cpuTotal) }} ms</b></div>
      <div v-if="useGpu" class="line"><span>GPU · pasadas</span><b>{{ f1(gpuTotal) }} ms</b></div>
      <div class="sub">Pasadas · {{ useGpu ? 'GPU' : 'CPU' }}</div>
      <p v-if="!useGpu" class="dim">CPU: duración de envío; incluye subpasadas. Para localizar el costo gráfico se necesita temporización GPU.</p>
      <div v-for="r in visibleRows" :key="r.name" class="row" :data-tooltip="'máx ' + f1(r.max) + ' ms'">
        <span class="bar" :style="{ width: r.w + '%' }"></span><span class="n">{{ r.name === 'Escena' && snap.gpu['Escena · dibujo'] ? 'Escena · resto' : r.name }}</span><span class="v">{{ f1(r.ms) }} ms</span>
      </div>
      <details v-if="extraRows.length || (useGpu && detailRows.length)" class="perf-more">
        <summary>Más pasadas</summary>
        <div v-for="r in extraRows" :key="r.name" class="row"><span class="n">{{ r.name }}</span><span class="v">{{ f1(r.ms) }} ms</span></div>
        <div v-for="r in (useGpu ? detailRows : [])" :key="r.name" class="row"><span class="n">{{ r.name }}</span><span class="v">{{ f1(r.ms) }} ms</span></div>
      </details>
      <div class="sub">Escena</div>
      <div class="grid">
        <span>Draw calls</span><b>{{ snap.info.calls ?? '–' }}</b>
        <span>Triángulos</span><b>{{ snap.info.triangles != null ? snap.info.triangles.toLocaleString('es') : '–' }}</b>
        <template v-if="snap.extra.terrainSourceTriangles != null">
          <span>Terrain · fuente</span><b>{{ snap.extra.terrainSourceTriangles.toLocaleString('es') }}</b>
          <span>Terrain · horneado</span><b>{{ snap.extra.terrainBakedTriangles?.toLocaleString('es') ?? '–' }}</b>
          <span>Terrain · cámara</span><b>{{ snap.extra.terrainEffectiveTriangles?.toLocaleString('es') ?? '–' }}</b>
        </template>
        <template v-if="snap.extra.clusterTerrainPages != null"><span>Clústeres Terrain</span><b>{{ snap.extra.clusterTerrainPages }}</b></template>
        <template v-if="snap.extra.triangHorPagesTotal != null"><span>TriangHor · páginas</span><b>{{ snap.extra.clusterTerrainPages }} / {{ snap.extra.triangHorPagesTotal }}</b></template>
        <template v-if="snap.extra.cloudStepsBudget != null"><span>Nubes · pasos</span><b>{{ snap.extra.cloudStepsBudget }}</b></template>
        <template v-if="snap.extra.cloudPrimitives != null"><span>Nubes · activas</span><b>{{ snap.extra.cloudPrimitives }}</b></template>
      </div>
      <details class="perf-more">
        <summary>Más métricas</summary>
        <div class="grid">
          <template v-if="snap.extra.performanceController?.active">
            <span>Optimizador · objetivo</span><b>{{ snap.extra.performanceController.target }} FPS</b>
            <span>Optimizador · estado</span><b>{{ ({ warming: 'Calentando', stable: 'Estable', pressure: 'Fuera de presupuesto', adapting: 'Ajustando', limited: 'Límite alcanzado' })[snap.extra.performanceController.state] }}</b>
            <span>Cuello de botella</span><b>{{ ({ unknown: 'Sin confirmar', logic: 'Lógica CPU', gpu: 'GPU', submission: 'CPU / envío de dibujos', pacing: 'Ritmo de presentación', balanced: 'Equilibrado' })[snap.extra.performanceController.bottleneck] }}</b>
            <span>Presupuesto · p95</span><b>{{ snap.extra.performanceController.p95 == null ? '–' : f1(snap.extra.performanceController.p95) + ' ms' }}</b>
            <span>Presupuesto · lógica CPU</span><b>{{ snap.extra.performanceController.logicMs == null ? '–' : f1(snap.extra.performanceController.logicMs) + ' ms' }}</b>
            <span>Presupuesto · GPU</span><b>{{ snap.extra.performanceController.gpuMs == null ? 'Sin medir' : f1(snap.extra.performanceController.gpuMs) + ' ms' }}</b>
            <span>Ajustes · LOD / efectos</span><b>{{ snap.extra.performanceController.geometry ?? 0 }} / {{ snap.extra.performanceController.effects ?? 0 }}</b>
          </template>
          <span>Geometrías</span><b>{{ snap.info.geometries ?? '–' }}</b>
          <span>Texturas</span><b>{{ snap.info.textures ?? '–' }}</b>
          <template v-if="snap.extra.skyVariant"><span>Cielo · programa</span><b>{{ ({ generic: 'Original', compiling: 'Preparando', specialized: 'Especializado', unavailable: 'Original · sin soporte', failed: 'Original · respaldo' })[snap.extra.skyVariant.status] }}</b></template>
          <template v-if="playing"><span>p50 / p95</span><b>{{ f1(snap.medianMs) }} / {{ f1(snap.p95) }} ms</b></template>
          <template v-if="snap.extra.sceneBuffer"><span>Buffer escena</span><b>{{ snap.extra.sceneBuffer }}</b></template>
          <template v-if="snap.extra.aoWorking"><span>Buffer GTAO</span><b>{{ snap.extra.aoWorking }}</b></template>
          <template v-if="snap.extra.aoCompositing"><span>Composición AO</span><b>{{ snap.extra.aoCompositing }}</b></template>
          <template v-if="snap.extra.renderBackend !== 'WebGPU' && snap.extra.gpuLatencyFrames != null"><span>Latencia GPU</span><b>{{ snap.extra.gpuLatencyFrames }} frames</b></template>
          <template v-if="snap.extra.scale != null"><span>Resolución</span><b>{{ Math.round(snap.extra.scale * 100) }} %</b></template>
          <template v-if="snap.extra.taa != null || snap.extra.spatialReconstruction"><span>Reconstrucción</span><b>{{ snap.extra.taa ? 'TAA' : (reconstructionLabels[snap.extra.spatialReconstruction] || 'No') }}</b></template>
          <template v-if="snap.extra.occlusionHidden != null"><span>Ocultos por cámara</span><b>{{ snap.extra.occlusionHidden }}</b></template>
          <template v-if="snap.extra.occlusionCpuMs != null"><span>Oclusión CPU</span><b>{{ f1(snap.extra.occlusionCpuMs) }} ms</b></template>
          <template v-if="snap.extra.occlusionReason"><span>Oclusión</span><b>{{ snap.extra.occlusionReason }}</b></template>
          <template v-if="snap.extra.culled != null"><span>Ocultos por distancia</span><b>{{ snap.extra.culled }}</b></template>
          <template v-if="snap.extra.clusterBatches != null"><span>Lotes</span><b>{{ snap.extra.clusterBatches }} · {{ snap.extra.clusterMiB.toFixed(1) }} MiB</b></template>
          <template v-if="snap.extra.terrainBakeBlocked"><span>Sin reducir</span><b>{{ snap.extra.terrainBakeBlocked }}</b></template>
          <template v-if="snap.extra.triangHorNodes != null"><span>TriangHor · nodos</span><b>{{ snap.extra.triangHorNodes }}</b></template>
          <template v-if="snap.extra.triangHorPagesTested != null"><span>TriangHor · pruebas</span><b>{{ snap.extra.triangHorPagesTested }}</b></template>
          <template v-if="snap.extra.triangHorBakeMs"><span>TriangHor · último bake</span><b>{{ f1(snap.extra.triangHorBakeMs) }} ms CPU Worker</b></template>
          <template v-if="snap.extra.triangHorShadowConservative"><span>Sombras conservadoras</span><b>{{ snap.extra.triangHorShadowConservative }} terrenos</b></template>
          <template v-if="snap.extra.clusterDirect != null"><span>Mallas directas</span><b>{{ snap.extra.clusterDirect }}</b></template>
          <template v-if="snap.extra.cloudGrid"><span>Volumen nubes</span><b>{{ snap.extra.cloudGrid }}</b></template>
          <template v-if="snap.extra.cloudSolarTransmission != null"><span>Transmisión solar</span><b>{{ Math.round(snap.extra.cloudSolarTransmission * 100) }} %</b></template>
          <template v-if="snap.extra.cloudEmptySkip"><span>Raymarch nubes</span><b>Omitido</b></template>
          <template v-if="snap.extra.renderBackend"><span>Backend</span><b>{{ snap.extra.renderBackend }}</b></template>
          <template v-if="snap.extra.webgpuReason && snap.extra.renderBackend === 'WebGL'"><span>WebGPU</span><b class="backend-reason">{{ snap.extra.webgpuReason }}</b></template>
          <template v-if="snap.extra.gpuIndirectMeshes != null"><span>Mallas indirectas</span><b>{{ snap.extra.gpuIndirectMeshes }}</b></template>
          <template v-if="snap.extra.worldRayTriangles"><span>Ray triangles</span><b>{{ snap.extra.worldRayTriangles.toLocaleString('es') }}</b></template>
          <template v-if="snap.extra.irradianceProbes"><span>Sondas</span><b>{{ snap.extra.irradianceProbes }}</b></template>
          <template v-if="snap.extra.lodSwaps != null"><span>Objetos en LOD</span><b>{{ snap.extra.lodSwaps }}</b></template>
        </div>
      </details>
    </template>
  </div>
</template>

<style scoped>
.perf { position:absolute; top:40px; right:10px; width:min(268px,calc(100% - 20px)); max-height:calc(100% - 50px); overflow-y:auto; z-index:2100; box-sizing:border-box; background:rgba(10,10,12,.9); border:1px solid rgba(255,255,255,.14); border-radius:7px; padding:8px 10px; font-size:11px; color:#cfd5de; backdrop-filter:blur(6px); }
header { display:flex; align-items:center; gap:6px; margin-bottom:7px; }
header b { flex:1; font-size:12px; color:#fff; }
header button { display:grid; place-items:center; min-width:25px; min-height:25px; background:transparent; border:1px solid transparent; border-radius:4px; color:#a9b3bf; cursor:pointer; transition:background-color 120ms ease,border-color 120ms ease; }
header button:hover { background:rgba(255,255,255,.10); border-color:rgba(255,255,255,.16); color:#fff; }
header button:active { background:rgba(255,255,255,.19); }
header button:focus-visible { outline:2px solid #6da8ff; outline-offset:1px; }
.fps { color:var(--ok); font-weight:650; } .fps.mid { color:#e5c35a; } .fps.low { color:#ff7a70; }
.dim { color:#8b96a7; }
.graph { position:relative; height:30px; display:flex; align-items:flex-end; gap:1px; margin:2px 0 7px; border-bottom:1px solid rgba(255,255,255,.12); }
.graph i { flex:1; min-width:1px; background:#5b8def; } .graph i.bad { background:#e5806a; }
.graph u { position:absolute; left:0; right:0; bottom:14px; border-top:1px dashed rgba(255,255,255,.25); }
.line { display:flex; gap:6px; align-items:baseline; margin-bottom:3px; } .line span { flex:1; color:#a7afbe; } .line b { color:#fff; font-variant-numeric:tabular-nums; }
.sub { margin:10px 0 4px; padding-top:6px; border-top:1px solid rgba(255,255,255,.1); color:#8e9baa; text-transform:uppercase; font-size:10px; letter-spacing:.03em; }
.row { position:relative; display:flex; align-items:center; min-height:19px; padding:1px 4px; gap:8px; }
.row .bar { position:absolute; inset:1px auto 1px 0; background:rgba(91,141,239,.25); border-radius:2px; }
.row .n { position:relative; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .row .v { position:relative; font-variant-numeric:tabular-nums; color:#fff; white-space:nowrap; }
.grid { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:4px 8px; } .grid span { color:#a7afbe; min-width:0; } .grid b { color:#fff; text-align:right; font-variant-numeric:tabular-nums; max-width:140px; overflow-wrap:anywhere; }
.backend-reason { overflow-wrap:anywhere; }
.perf-more { margin-top:8px; padding-top:5px; border-top:1px solid rgba(255,255,255,.09); }
.perf-more summary { color:#aebccc; cursor:pointer; font-size:11px; padding:4px 0; user-select:none; }
.perf-more summary:hover { color:#fff; } .perf-more summary:focus-visible { outline:2px solid #6da8ff; }
.perf-more[open] > .grid, .perf-more[open] > .row { margin-top:4px; }
</style>
