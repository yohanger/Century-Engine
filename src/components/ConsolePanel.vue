<script setup>
import { ref, watch, nextTick } from 'vue'
import { store } from '../core/store.js'
import Icon from './Icon.vue'

const el = ref(null)
const fmt = (t) => new Date(t).toLocaleTimeString('es', { hour12: false })
watch(() => store.log.at(-1)?.id, async () => {
  await nextTick()
  if (el.value) el.value.scrollTop = el.value.scrollHeight
}, { immediate: true, flush: 'post' })
</script>

<template>
  <div class="con">
    <div class="bar">
      <span class="dim">{{ store.log.length }} mensaje(s)</span>
      <span class="grow"></span>
      <button class="ghost" :disabled="!store.log.length" @click="store.log.splice(0)"><Icon name="trash" :size="13" />Limpiar</button>
    </div>
    <div ref="el" class="lines" role="log" aria-live="off">
      <div v-for="l in store.log" :key="l.id" class="ln" :class="l.kind" :data-level="l.kind"><time>{{ fmt(l.time) }}</time><span class="message"><small v-if="l.context" class="context">{{ l.context }}</small>{{ l.msg }}</span></div>
      <div v-if="!store.log.length" class="empty lf-help">Aquí aparecen las salidas y los errores de los scripts del proyecto.</div>
    </div>
  </div>
</template>

<style scoped>
.con { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.bar { display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 8px; border-bottom: 1px solid var(--hair); flex: none; }
.grow { flex: 1; }
.lines { flex: 1; overflow: auto; padding: 4px 0; font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace; font-size: 11px; user-select: text; }
.ln { display: flex; gap: 10px; padding: 2px 10px; border-left: 2px solid transparent; }
.ln:nth-child(odd) { background: rgba(255, 255, 255, .02); }
.ln time { color: var(--text-3); flex: none; }
.ln.error { color: #ff9a92; border-left-color: var(--danger); }
.ln.warn { color: #e8c578; border-left-color: #c39542; }
.ln.debug { color: var(--text-3); }
.message { min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.context { display: block; color: var(--text-3); font-size: 10px; }
.ln.ok { border-left-color: var(--ok); }
.empty { padding: 18px 14px; color: var(--text-3); font-family: var(--font); line-height: 1.5; }
</style>
