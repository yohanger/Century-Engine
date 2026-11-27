<script setup>
// Marcas del EDITOR mientras se prueba el juego (no forman parte de la interfaz del juego, que son los documentos .ui).
import { computed } from 'vue'
import { store } from '../core/store.js'
const p = computed(() => store.play)
</script>

<template>
  <div class="chrome">
    <div class="badge">▶ Jugando <span>· F5 detiene</span></div>
    <div v-if="p.errors" class="errs" data-tooltip="Hay errores en eventos, scripts o interfaces: mira la Consola">⚠ {{ p.errors }}</div>
  </div>
</template>

<style scoped>
.chrome { position: absolute; inset: 0; pointer-events: none; z-index: 2000; }
.badge { position: absolute; top: 10px; left: 12px; background: rgba(8, 8, 8, .6); border: 1px solid rgba(255, 255, 255, .15); padding: 3px 9px; border-radius: 5px; font-size: 12px; color: var(--ok); }
.badge span { color: #98a0ad; }
.errs { position: absolute; top: 10px; right: 12px; background: rgba(60, 20, 18, .85); border: 1px solid var(--danger); color: #ff9a92; padding: 3px 9px; border-radius: 5px; font-size: 12px; }
</style>
