<script setup>
import { computed } from 'vue'
import { store } from '../core/store.js'
import Icon from './Icon.vue'

const hint = computed(() => {
  if (store.edit.on) return 'Edición: clic / rectángulo selecciona · Alt+clic bucle · G R S mover, rotar, escalar · E extruir · I inset · Ctrl B aristas · Ctrl Shift B vértices · Ctrl R corte · K cuchillo · Tab salir'
  if (store.tool === 'terrain') return 'Arrastra para esculpir · Ctrl invierte elevar/bajar · [ ] cambia el radio'
  if (store.tool === 'road') return 'Clic en el terreno añade un punto · arrastra las esferas para moverlos · Supr quita el punto elegido · Enter / Esc terminan'
  if (store.tool === 'place') return 'Clic coloca · Shift+clic coloca varios · Esc cancela'
  return store.prefs.navigation === 'trackpad'
    ? 'Dos dedos orbitan · Pellizco zoom · Shift + dos dedos desplaza · Alt + clic orbita'
    : 'Clic selecciona · Rueda zoom · Rueda pulsada orbita · Alt + clic orbita · Espacio + clic o Mayús + clic derecho desplaza'
})
const c = computed(() => store.cursor)
const f = (v) => v.toFixed(1)
// Estado real: cuenta también el archivo del disco (antes «Guardado» solo miraba la copia interna del navegador).
const saveView = computed(() => {
  const a = store.saveState
  const d = store.disk.name ? store.disk.state : 'saved'
  if (d === 'error') return 'error'
  if (store.unsavedChanges) return 'dirty'
  if (a === 'dirty' || d === 'dirty') return 'dirty'
  if (a === 'saving' || d === 'saving') return 'saving'
  return 'saved'
})
const stateLabel = { saved: 'Guardado', saving: 'Guardando…', dirty: 'Sin guardar', error: 'Error al guardar' }
</script>

<template>
  <footer class="status">
    <span class="hint lf-help">{{ hint }}</span>
    <span class="grow"></span>
    <span v-if="c" class="coord" data-tooltip="Posición bajo el puntero (x, altura, z)">
      <i>x</i>{{ f(c.x) }} <i>y</i>{{ f(c.y) }} <i>z</i>{{ f(c.z) }}
    </span>
    <span class="sep"></span>
    <span data-tooltip="Terreno">{{ store.project.terrain.size }} m · {{ store.project.terrain.segments }} seg</span>
    <span class="sep"></span>
    <span>{{ store.project.objects.length }} nodos</span>
    <span class="sep"></span>
    <span v-if="store.disk.name" class="diskpath" :class="store.disk.state" :data-tooltip="'Proyecto en ' + store.disk.name">{{ store.disk.state === 'error' ? '⚠ ' : '' }}{{ store.disk.name }}</span>
    <span class="sep"></span>
    <span class="save" :class="saveView"><i></i>{{ stateLabel[saveView] }}</span>
  </footer>
</template>

<style scoped>
.status { display: flex; align-items: center; gap: 8px; height: 24px; padding: 0 10px; background: var(--g-850); border-top: 1px solid var(--hair); color: var(--text-3); font-size: 11px; white-space: nowrap; overflow: hidden; }
.hint { overflow: hidden; text-overflow: ellipsis; }
.grow { flex: 1; }
.coord { color: var(--text-2); }
.coord i { font-style: normal; color: var(--text-3); margin: 0 2px 0 6px; }
.sep { width: 1px; height: 12px; background: var(--hair); }
.save { display: inline-flex; align-items: center; gap: 5px; }
.save i { width: 6px; height: 6px; border-radius: 50%; background: var(--ok); }
.save.dirty i { background: var(--warn); }
.save.saving i { background: var(--blue-hi); }
.save.error i { background: var(--danger, #e5484d); }
.diskpath { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: rtl; color: var(--text-3); }
.diskpath.error { color: var(--danger); }
</style>
