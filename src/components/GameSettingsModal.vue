<script setup>
// Ajustes del juego (project.game): jugador y datos del juego exportado. El formulario se genera de la lista de parámetros declarada.
import AppWindow from './AppWindow.vue'
import { store, markDirty, openExportGame, updateAudioGroup, openPlayerSettings } from '../core/store.js'
import { BUILD_PARAMS, PHYSICS_PARAMS } from '../engine/runtime/templates/gameParams.js'
import { getTemplate } from '../core/templates/index.js'
import ParamForm from './ParamForm.vue'
import InputMapPanel from './InputMapPanel.vue'
import { ref } from 'vue'

const tab = ref('game')

const reset = () => { Object.assign(store.project.game, getTemplate(store.project.template).game); markDirty() }
</script>

<template>
  <AppWindow title="Ajustes del juego" :subtitle="'plantilla ' + getTemplate(store.project.template).name" :width="860" :min-width="360" :min-height="260" persist="gamesettings" @close="store.modal = null">
      <div class="tabs"><button :class="{ on: tab === 'game' }" @click="tab = 'game'">Juego</button><button :class="{ on: tab === 'audio' }" @click="tab = 'audio'">Audio</button><button :class="{ on: tab === 'input' }" @click="tab = 'input'">Input Map</button></div>
      <InputMapPanel v-if="tab === 'input'" />
      <div v-else-if="tab === 'audio'" class="cols">
        <section>
          <h3>Volumen por grupo</h3>
          <p class="dim lf-help">Valor inicial de cada grupo del mezclador (también en el panel Audio Mixer). Los scripts pueden cambiarlo con <code>game.audio.setVolume("music", 0.5)</code>.</p>
          <div v-for="g in store.project.audio.groups" :key="g.id" class="arow"><span>{{ g.name }}</span><input type="range" min="-80" max="20" step="0.5" :value="g.volume" @input="updateAudioGroup(g.id, { volume: +$event.target.value })" /><em>{{ g.volume <= -80 ? '-∞' : g.volume.toFixed(1) }} dB</em><input type="checkbox" :checked="g.mute" data-tooltip="Silenciar" @change="updateAudioGroup(g.id, { mute: $event.target.checked })" /></div>
        </section>
        <section>
          <h3>Jugador</h3>
          <label class="arow2"><input type="checkbox" :checked="store.project.audio.remember" @change="store.project.audio.remember = $event.target.checked; markDirty()" /> Recordar el volumen que el jugador elija (game.audio.setVolume)</label>
          <p class="dim lf-help">Abre Audio Mixer (dock inferior) para efectos: reverb, paso bajo/alto y compresor por grupo.</p>
        </section>
      </div>
      <div v-else class="cols">
        <section>
          <h3>Jugador (primera persona)</h3>
          <p class="dim lf-help">Tamaño, velocidad, FOV, ojos y las manos (view model) están en la base de datos.</p>
          <button class="primary" @click="openPlayerSettings()">Abrir Base de datos ▸ Jugador</button>
          <h3>Física</h3>
          <ParamForm :params="PHYSICS_PARAMS" :values="store.project.game" @change="markDirty()" />
          <p class="dim lf-help">El movimiento del jugador y Jolt avanzan a esta tasa fija, no a la de la pantalla; la cámara se interpola entre pasos. Para scripts: <code>game.on('fixedUpdate', dt)</code> corre una vez por paso.</p>
        </section>
        <section><h3>Juego exportado</h3><ParamForm :params="BUILD_PARAMS" :values="store.project.game" @change="markDirty()" /></section>
      </div>
    <template #footer>
      <button v-if="tab === 'game'" @click="reset">Restaurar valores de la plantilla</button><span class="grow"></span><button @click="openExportGame()">Exportar juego…</button><button class="primary" @click="store.modal = null">Cerrar</button>
    </template>
  </AppWindow>
</template>

<style scoped>
.dim { color: var(--text-2); font-weight: 400; font-size: 12px; }
.grow { flex: 1; }
.arow { display: grid; grid-template-columns: 90px 1fr 70px 22px; gap: 8px; align-items: center; min-height: 26px; } .arow em { font-style: normal; color: var(--text-3); font-size: 11px; text-align: right; } .arow2 { display: flex; gap: 8px; align-items: center; }
.tabs { display: flex; gap: 2px; padding: 8px 16px 0; border-bottom: 1px solid var(--g-600); flex: none; overflow-x: auto; position: sticky; top: 0; z-index: 2; background: var(--g-850); }
.tabs button { border: 0; border-radius: 4px 4px 0 0; background: transparent; padding: 6px 14px; color: var(--text-2); }
.tabs button.on { background: var(--g-700, #2a2a2a); color: var(--text-1, #fff); }
.cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 22px; padding: 12px 16px; }
@container win (max-width: 640px) { .cols { grid-template-columns: 1fr; padding: 10px 12px; } }
h3 { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--text-2); }
</style>
