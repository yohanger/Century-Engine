<script setup>
import { askConfirm } from '../core/dialogs.js'
import { ref, nextTick } from 'vue'
import { computed } from 'vue'
import { store, switchScene, addScene, renameScene, duplicateScene, deleteScene, openSceneIds, closeSceneTab, selectScene } from '../core/store.js'
import Icon from './Icon.vue'
import { closeShaderEditor } from '../core/state/shaders.js'

const editing = ref(null)
const draft = ref('')
const list = ref(null)
const tabs = computed(() => openSceneIds().map((id) => store.project.scenes.find((s) => s.id === id)).filter(Boolean))
const graphTab = computed(() => store.prefs.shaderGraphDocked && store.project.shaders.find((s) => s.id === store.shaderEditId && s.graph))
const graphActive = computed(() => !!graphTab.value && store.ui.shaderWorkspace && !store.play.on)
async function closeOthers(id) { for (const t of tabs.value) if (t.id !== id) await closeSceneTab(t.id) }

async function startRename(s) {
  editing.value = s.id
  draft.value = s.name
  await nextTick()
  const i = list.value?.querySelector('input.rn')
  i?.focus(); i?.select()
}
function finish(save) {
  const id = editing.value
  editing.value = null
  if (save && id) renameScene(id, draft.value)
}

function menu(e, s) {
  e.preventDefault()
  store.menu = {
    x: e.clientX, y: e.clientY,
    items: [
      { label: 'Abrir', icon: 'scene', run: () => switchScene(s.id), disabled: s.id === store.project.activeSceneId },
      { label: 'Renombrar', run: () => startRename(s) },
      { label: 'Cerrar pestaña', icon: 'x', disabled: tabs.value.length < 2, run: () => closeSceneTab(s.id) },
      { label: 'Cerrar las demás', disabled: tabs.value.length < 2, run: () => closeOthers(s.id) },
      { label: 'Duplicar', icon: 'copy', run: () => duplicateScene(s.id) },
      { sep: true },
      { label: 'Eliminar', icon: 'trash', danger: true, disabled: store.project.scenes.length < 2, run: async () => { if (await askConfirm(`¿Eliminar la escena «${s.name}»?`, { title: 'Eliminar escena', ok: 'Eliminar', danger: true })) deleteScene(s.id) } },
    ],
  }
}
</script>

<template>
  <div ref="list" class="tabs" role="tablist" aria-label="Escenas del proyecto">
    <div
      v-for="s in tabs" :key="s.id" class="tab" :class="{ on: !graphActive && s.id === store.project.activeSceneId }" role="tab"
      :aria-selected="!graphActive && s.id === store.project.activeSceneId" :data-tooltip="`${s.name} · doble clic para renombrar · clic central para cerrar`"
      @click="store.ui.shaderWorkspace = false; switchScene(s.id).then(() => selectScene())" @auxclick.middle.prevent="closeSceneTab(s.id)" @dblclick="startRename(s)" @contextmenu="menu($event, s)"
    >
      <Icon name="scene" :size="13" />
      <input v-if="editing === s.id" v-model="draft" class="rn" @click.stop @keydown.enter="finish(true)" @keydown.esc="finish(false)" @blur="finish(true)" />
      <span v-else class="n">{{ s.name }}</span>
      <button v-if="editing !== s.id" class="x" type="button" :data-tooltip="tabs.length < 2 ? 'Debe quedar una escena abierta' : 'Cerrar pestaña'" :aria-label="`Cerrar ${s.name}`" :disabled="tabs.length < 2" @click.stop="closeSceneTab(s.id)"><Icon name="x" :size="11" /></button>
    </div>
    <div v-if="graphTab" class="tab" :class="{ on: graphActive }" role="tab" :aria-selected="graphActive"
      :aria-label="`Shader Graph · ${graphTab.name}`" @click="store.ui.shaderWorkspace = true" @auxclick.middle.prevent="closeShaderEditor()">
      <Icon name="shader" :size="13" /><span class="n">{{ graphTab.name }}</span>
      <button class="x" aria-label="Cerrar Shader Graph" @click.stop="closeShaderEditor()"><Icon name="x" :size="11" /></button>
    </div>
    <button class="add ghost icon" data-tooltip="Nueva escena" aria-label="Nueva escena" @click="addScene('Escena')"><Icon name="plus" :size="14" /></button>
  </div>
</template>

<style scoped>
.tabs { display: flex; align-items: flex-end; gap: 2px; height: 28px; padding: 0 6px; background: var(--g-900); border-bottom: 1px solid var(--hair); overflow-x: auto; overflow-y: hidden; scrollbar-width: none; flex: none; }
.tabs::-webkit-scrollbar { display: none; }
.tab { display: flex; align-items: center; gap: 6px; height: 25px; padding: 0 12px; border: 1px solid transparent; border-bottom: none; border-radius: 5px 5px 0 0; color: var(--text-3); cursor: default; white-space: nowrap; flex: none; max-width: 200px; }
.tab:hover { background: var(--g-850); color: var(--text-2); }
.tab.on { background: var(--g-800); border-color: var(--hair); color: var(--text); box-shadow: inset 0 2px 0 var(--blue); }
.n { overflow: hidden; text-overflow: ellipsis; }
.x { width: 17px; height: 17px; padding: 0; margin: 0 -6px 0 0; border-color: transparent; background: transparent; color: var(--text-3); border-radius: 4px; flex: none; opacity: .55; }
.tab:hover .x, .tab.on .x { opacity: 1; }
.x:hover:not(:disabled) { background: var(--g-700); color: var(--text); }
.x:disabled { opacity: .25; cursor: default; }
.rn { width: 110px; height: 19px; padding: 0 4px; }
.add { align-self: center; width: 22px; height: 22px; margin-left: 2px; flex: none; }
</style>
