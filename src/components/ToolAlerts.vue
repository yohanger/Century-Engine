<script setup>
import { store } from '../core/store.js'
</script>

<template>
  <div class="tool-alerts" aria-live="polite">
    <div v-for="notice in store.toasts" :key="notice.id" class="tool-alert" :class="notice.kind">{{ notice.msg }}</div>
  </div>
</template>

<style scoped>
.tool-alerts {
  position: fixed; left: 50%; bottom: 48px; transform: translateX(-50%); z-index: 5000;
  display: grid; gap: 5px; max-width: calc(100% - 24px); pointer-events: none;
}
.tool-alert { padding: 7px 11px; border: 1px solid var(--hair); border-radius: 4px; background: var(--g-800); box-shadow: 0 5px 18px #0007; }
.tool-alert.error { border-color: var(--danger); }
.tool-alert.warn { border-color: var(--warn); }
</style>
