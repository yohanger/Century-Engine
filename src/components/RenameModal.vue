<script setup>
import AppWindow from './AppWindow.vue'
import { ref, onMounted } from 'vue'
import { store, renameProject } from '../core/store.js'

const name = ref(store.project?.name || '')
const input = ref(null)
onMounted(() => input.value?.select())

function ok() { renameProject(name.value); store.modal = null }
</script>

<template>
  <AppWindow native-tool title="Renombrar proyecto" :width="400" :height="250" :min-width="300" :resizable="false" @close="store.modal = null">
    <div class="body" style="padding: 16px 18px">
      <input ref="input" v-model="name" style="width: 100%; padding: 7px 9px" @keydown.enter="ok" />
    </div>
    <template #footer>
      <span style="flex:1"></span><button @click="store.modal = null">Cancelar</button>
      <button class="primary" @click="ok">Renombrar</button>
    </template>
  </AppWindow>
</template>
