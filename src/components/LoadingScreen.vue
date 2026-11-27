<script setup>
import loadingArtwork from '../../electron/assets/levelforge-splash.webp'

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  status: { type: Object, required: true },
  showArtwork: { type: Boolean, default: true },
})
</script>

<template>
  <div class="loading-screen">
    <section class="loading-panel" :aria-label="title">
      <img v-if="showArtwork" :src="loadingArtwork" alt="" />
      <div class="details">
        <h1>{{ title }}</h1>
        <p v-if="subtitle" class="subtitle">{{ subtitle }}</p>
        <div class="progress-heading">
          <span role="status">{{ status.phase }}<template v-if="status.total > 0"> ({{ status.done }}/{{ status.total }})</template></span>
          <span class="percent">{{ status.percent }}%</span>
        </div>
        <progress :value="status.percent" max="100" aria-label="Progreso de carga"></progress>
        <span class="steps">Paso {{ status.step }} de {{ status.steps }}</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.loading-screen { position: absolute; inset: 0; background: #080c12; color: #f5f6f7; font: 14px system-ui, sans-serif; }
.loading-panel { position: absolute; inset: 0; overflow: hidden; isolation: isolate; background: #10151d; }
.loading-panel img, .loading-panel::after { position: absolute; inset: 0; width: 100%; height: 100%; }
.loading-panel img { object-fit: cover; }
.loading-panel::after { content: ''; background: linear-gradient(90deg, #090e16cc 5%, transparent 98%), linear-gradient(0deg, #080b11 0%, #080b1110 80%); }
.details { position: absolute; z-index: 1; inset: auto clamp(16px, 4vw, 56px) clamp(16px, 4vh, 44px); min-width: 0; }
h1 { margin: 0; font-size: clamp(27px, 6vw, 48px); line-height: 1.07; font-weight: 650; overflow-wrap: anywhere; }
.subtitle { margin: 6px 0 0; color: #d0dce9; overflow-wrap: anywhere; }
.progress-heading { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-top: clamp(12px, 4vw, 30px); }
.percent, .steps { font-variant-numeric: tabular-nums; }
.steps { color: #c5d4e3; font-size: 12px; }
progress { appearance: none; display: block; width: 100%; height: 4px; margin: 10px 0 6px; overflow: hidden; border: 0; border-radius: 2px; background: #ffffff30; }
progress::-webkit-progress-bar { background: #ffffff30; }
progress::-webkit-progress-value { background: #83cfff; }
progress::-moz-progress-bar { background: #83cfff; }
</style>
