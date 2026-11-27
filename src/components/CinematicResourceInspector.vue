<script setup>
import { computed } from 'vue'
import { store } from '../core/store.js'
import { isFilmMakerTimeline } from '../core/timeline/model.js'
const props = defineProps({ resourceId: { type: String, required: true } })
const resource = computed(() => (store.project?.cinematics || []).find(c => c.id === props.resourceId) || null)
const movie = computed(() => (store.project?.timelines || []).find(t => t.id === props.resourceId && isFilmMakerTimeline(t)) || null)
</script>
<template>
  <div v-if="movie || resource" class="cinematic-info insp" data-node-type="cinematic" data-test="cinematic-inspector">
    <section class="sect"><header>{{ resource ? 'Cinematic · recurso del proyecto' : 'Cinematics · película importada' }}</header>
      <div class="body">
        <div class="item"><span>Nombre</span><b>{{ resource?.name || movie?.name }}</b></div>
        <div class="item"><span>Duración</span><b>{{ movie ? `${movie.duration.toFixed(2)} s` : 'Sin montaje' }}</b></div>
        <div class="item"><span>Origen</span><b>Nether Film Maker</b></div>
        <div class="item"><span>Película</span><b>{{ resource?.name || movie?.filmMaker.filmName }}</b></div>
        <div class="item"><span>Contenido</span><b>{{ movie ? 'Montaje' : 'Pendiente de grabación' }}</b></div>
        <div class="item"><span>Pistas</span><b>{{ movie?.tracks.length || 0 }}</b></div>
        <div class="item"><span>Escena</span><b :title="resource?.sceneId || movie?.filmMaker.sceneId">{{ resource?.sceneId || movie?.filmMaker.sceneId }}</b></div>
        <p class="lf-help">Solo lectura. La autoría de películas corresponde a Nether Film Maker.</p>
      </div>
    </section>
  </div>
</template>
<style scoped>
.cinematic-info { padding:8px;min-width:0 }.item { display:grid;grid-template-columns:minmax(70px,40%) minmax(0,1fr);gap:9px;padding:7px 0;border-bottom:1px solid var(--hair);align-items:start }.item span { color:var(--text-3) }.item b { min-width:0;overflow-wrap:anywhere;font-weight:500 }.lf-help { padding-top:7px;line-height:1.5 }
</style>
