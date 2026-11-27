<script setup>
import emblem from '../../electron/assets/ngm-engine-emblem.webp'

defineProps({
  image: { type: String, default: '' },
  title: { type: String, default: '' },
  version: { type: String, default: '' },
})
</script>

<template>
  <div class="brand-splash">
    <figure>
      <img :src="image || emblem" :alt="image && title ? title : 'Narrative Game Maker Engine'" />
      <figcaption v-if="title || version">{{ [title, version].filter(Boolean).join(' · ') }}</figcaption>
    </figure>
  </div>
</template>

<style scoped>
.brand-splash { position: absolute; inset: 0; display: grid; place-items: center; background: #000; color: #eaf0f8; }
figure { margin: 0; text-align: center; }
img { display: block; width: min(80vw, 660px); height: min(68vh, 440px); object-fit: contain; }
figcaption { margin-top: 8px; font: 13px system-ui, sans-serif; color: #bfcbd9; }
</style>
