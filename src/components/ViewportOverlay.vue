<script setup>
import { store } from '../core/store.js'
import OrientGizmo from './OrientGizmo.vue'
import ViewportDiagnosticsHud from './ViewportDiagnosticsHud.vue'
</script>

<template>
  <!-- Los avisos temporales no alteran la barra de herramientas ni ocupan la parte superior. -->
  <div v-if="store.edit.on ? !!store.edit.hud : !!store.uniformScaleHud"
       class="hud" role="status" aria-live="polite">
    {{ store.edit.on ? store.edit.hud : store.uniformScaleHud }}
  </div>
  <div v-if="store.edit.on && store.edit.localView" class="local-view" role="status">Modo Local · /</div>
  <OrientGizmo v-if="store.prefs.orientGizmo" />
  <ViewportDiagnosticsHud v-if="!store.edit.localView" />
</template>

<style scoped>
.local-view { position: absolute; top: 12px; left: 12px; z-index: 6; color: var(--text); font-size: 12px; padding: 4px 8px; border-radius: 4px; background: rgba(13, 13, 13, .85); pointer-events: none; }
.hud { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); z-index: 6; max-width: calc(100% - 24px); padding: 6px 12px; border-radius: 6px; background: rgba(13, 13, 13, .92); border: 1px solid var(--amber-edge); color: var(--amber); font-size: 12px; pointer-events: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
