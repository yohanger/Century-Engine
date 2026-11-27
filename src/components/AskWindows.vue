<script setup>
// Ventanas de pregunta (sustituyen a confirm()/prompt()). No son modales: se pueden mover y el editor sigue usable.
import { dialogs } from '../core/dialogs.js'
import AppWindow from './AppWindow.vue'
const finish = (d, ok) => d.done(d.kind === 'confirm' && d.allowSkip ? { confirmed: ok === true, skipFuture: ok === true && d.skipFuture === true } : d.kind === 'text' ? (ok ? d.value : null) : d.kind === 'close' ? (ok === true ? 'save' : ok === 'discard' ? 'discard' : 'cancel') : d.kind === 'recovery' ? (ok === true ? 'restore' : ok === 'discard' ? 'discard' : 'cancel') : ok)
const vFocusFirst = { mounted: (el) => setTimeout(() => el.querySelector('input')?.select(), 30) }
</script>
<template>
  <AppWindow
    v-for="d in dialogs.list" :key="d.id" :title="d.title" :width="440" :min-width="300" :min-height="120" :level="9000"
    :resizable="false" data-ask @close="finish(d, false)"
  >
    <div v-focus-first class="ask" @keydown.esc.stop="finish(d, false)">
      <p v-for="(l, i) in String(d.message).split('\n')" :key="i" class="ask-l">{{ l || ' ' }}</p>
      <label v-if="d.kind === 'confirm' && d.allowSkip" class="skip-crop"><input v-model="d.skipFuture" type="checkbox" /> No volver a mostrar este aviso</label>
      <input v-if="d.kind === 'text'" v-model="d.value" class="ask-in" spellcheck="false" @keydown.enter="finish(d, true)" />
    </div>
    <template #footer>
      <button @click="finish(d, false)">{{ d.cancel }}</button>
      <button v-if="d.kind === 'close' || d.kind === 'recovery'" class="danger" @click="finish(d, 'discard')">{{ d.discard }}</button>
      <button v-if="d.ok" class="ok" :class="{ primary: !d.danger, danger: d.danger }" @click="finish(d, true)">{{ d.ok }}</button>
    </template>
  </AppWindow>
</template>
<style scoped>
.ask { padding: 14px 16px; }
.ask-l { margin: 0 0 4px; line-height: 1.45; }
.ask-in { width: 100%; margin-top: 8px; }
.skip-crop { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 12px; cursor: pointer; }
</style>
