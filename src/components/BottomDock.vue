<script setup>
// Dock inferior (como Unity): pestañas Proyecto / Consola.
import { store } from '../core/store.js'
import ProjectPanel from './ProjectPanel.vue'
import ConsolePanel from './ConsolePanel.vue'
import AudioMixer from './AudioMixer.vue'
import TimelinePanel from './TimelinePanel.vue'
import CinematicsPanel from './CinematicsPanel.vue'
import VersionControlPanel from './VersionControlPanel.vue'
import Icon from './Icon.vue'

function openVersions() {
  store.prefs.bottomTab = 'vcs'
  // El editor de versiones necesita espacio para el listado y el formulario.
  if (store.prefs.bottomH < 300) store.prefs.bottomH = 300
}
const props = defineProps({ closable: { type: Boolean, default: true }, pane: { type: String, default: '' } })
const active = () => props.pane || store.prefs.bottomTab
</script>

<template>
  <div class="bdock">
    <nav v-if="!pane" class="tabs" role="tablist">
      <button role="tab" :aria-selected="active() === 'project'" :class="{ on: active() === 'project' }" @click="store.prefs.bottomTab = 'project'"><Icon name="folder" :size="13" />Proyecto</button>
      <button role="tab" :aria-selected="active() === 'console'" :class="{ on: active() === 'console' }" @click="store.prefs.bottomTab = 'console'">
        <Icon name="terminal" :size="13" />Consola<span v-if="store.log.length" class="n">{{ store.log.length }}</span>
      </button>
      <button role="tab" :aria-selected="active() === 'mixer'" :class="{ on: active() === 'mixer' }" @click="store.prefs.bottomTab = 'mixer'"><Icon name="audio" :size="13" />Audio Mixer</button>
      <button role="tab" :aria-selected="active() === 'timeline'" :class="{ on: active() === 'timeline' }" @click="store.prefs.bottomTab = 'timeline'"><Icon name="play" :size="13" />Timeline</button>
      <button role="tab" :aria-selected="active() === 'anim'" :class="{ on: active() === 'anim' }" @click="store.prefs.bottomTab = 'anim'"><Icon name="play" :size="13" />Cinematics</button>
      <button role="tab" :aria-selected="active() === 'vcs'" :class="{ on: active() === 'vcs' }" @click="openVersions"><Icon name="git-branch" :size="13" />Versiones</button>
      <span class="grow"></span>
      <button v-if="closable" class="x ghost icon" data-tooltip="Ocultar panel" aria-label="Ocultar panel" @click="store.prefs.bottomOpen = false"><Icon name="x" :size="13" /></button>
    </nav>
    <div class="content">
      <ProjectPanel v-if="active() === 'project'" />
      <AudioMixer v-else-if="active() === 'mixer'" />
      <TimelinePanel v-else-if="active() === 'timeline'" />
      <CinematicsPanel v-else-if="active() === 'anim'" />
      <VersionControlPanel v-else-if="active() === 'vcs'" />
      <ConsolePanel v-else />
    </div>
  </div>
</template>

<style scoped>
.bdock { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.tabs { display: flex; align-items: flex-end; gap: 2px; height: 28px; padding: 0 6px; background: var(--g-900); border-bottom: 1px solid var(--hair); flex: none; }
.tabs button { height: 25px; padding: 0 12px; border: 1px solid transparent; border-bottom: none; border-radius: 5px 5px 0 0; background: transparent; color: var(--text-3); }
.tabs button:hover { background: var(--g-850); color: var(--text-2); }
.tabs button.on { background: var(--g-850); border-color: var(--hair); color: var(--text); box-shadow: inset 0 2px 0 var(--blue); }
.n { font-size: 10px; background: var(--g-950); border-radius: 8px; padding: 0 5px; color: var(--text-3); }
.grow { flex: 1; }
.x { align-self: center; width: 22px; height: 22px; border-radius: 4px; }
.content { flex: 1; min-height: 0; background: var(--g-850); }
</style>
