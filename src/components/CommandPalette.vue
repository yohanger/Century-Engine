<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { store } from '../core/store.js'
import { commands } from '../core/commands.js'
import Icon from './Icon.vue'

const q = ref('')
const idx = ref(0)
const input = ref(null)
const list = ref(null)

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const results = computed(() => {
  const t = norm(q.value.trim())
  const all = commands().filter((c) => !c.hidden && !c.disabled?.())
  if (!t) return all
  const words = t.split(/\s+/)
  return all
    .map((c) => ({ c, hay: norm(`${c.label} ${c.group}`) }))
    .filter(({ hay }) => words.every((w) => hay.includes(w)))
    .sort((a, b) => a.hay.indexOf(words[0]) - b.hay.indexOf(words[0]))
    .map((r) => r.c)
})

function close() { store.palette = false }
function exec(c) {
  close()
  nextTick(() => c.run())
}
function key(e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); idx.value = Math.min(results.value.length - 1, idx.value + 1); scroll() }
  else if (e.key === 'ArrowUp') { e.preventDefault(); idx.value = Math.max(0, idx.value - 1); scroll() }
  else if (e.key === 'Enter') { const c = results.value[idx.value]; if (c) exec(c) }
  else if (e.key === 'Escape') close()
}
function scroll() { nextTick(() => list.value?.querySelector('.sel')?.scrollIntoView({ block: 'nearest' })) }
const away = (e) => { if (!e.target.closest?.('.pal')) close() }
onMounted(() => { input.value?.focus(); setTimeout(() => window.addEventListener('pointerdown', away, true), 0) })
onBeforeUnmount(() => window.removeEventListener('pointerdown', away, true))
</script>

<template>
  <div class="pop-layer">
    <div class="pal">
      <div class="in"><Icon name="search" :size="15" /><input ref="input" v-model="q" placeholder="Buscar acción…" spellcheck="false" @input="idx = 0" @keydown="key" /></div>
      <div ref="list" class="res">
        <div v-for="(c, i) in results" :key="c.id" class="r" :class="{ sel: i === idx }" @mousemove="idx = i" @click="exec(c)">
          <span class="ico"><Icon v-if="c.icon" :name="c.icon" :size="14" /></span>
          <span class="l">{{ c.label }}</span>
          <span class="g">{{ c.group }}</span>
          <span v-if="c.keys" class="k"><kbd v-for="k in c.keys.split(' ')" :key="k">{{ k }}</kbd></span>
        </div>
        <div v-if="!results.length" class="none">Ninguna acción coincide con «{{ q }}».</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pal { width: 560px; max-width: 92vw; background: var(--g-850); border: 1px solid var(--g-600); border-radius: 8px; box-shadow: 0 30px 70px rgba(0, 0, 0, .55); overflow: hidden; }
.in { display: flex; align-items: center; gap: 8px; padding: 0 12px; border-bottom: 1px solid var(--hair); color: var(--text-3); }
.in input { flex: 1; border: none; background: transparent; height: 40px; font-size: 14px; padding: 0; }
.in input:focus { outline: none; }
.res { max-height: 46vh; overflow: auto; padding: 4px; }
.r { display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 8px; border-radius: 5px; cursor: default; }
.r.sel { background: var(--blue-wash); }
.ico { width: 18px; display: flex; justify-content: center; color: var(--text-3); }
.r.sel .ico { color: var(--blue-hi); }
.l { flex: 1; }
.g { color: var(--text-3); font-size: 11px; }
.k { display: flex; gap: 2px; margin-left: 8px; }
.none { padding: 22px; text-align: center; color: var(--text-3); }
</style>
