<script setup>
import { computed } from 'vue'
import { store, getObject } from '../core/store.js'
import { command, run } from '../core/commands.js'
import { getDef } from '../engine/runtime/nodes/index.js'
import Icon from './Icon.vue'
import { activateViewportDock, activateCodeDock, revealDockPanel } from '../core/editor/view-dock-session.js'
import { startDockGesture, consumeDockClickSuppression } from '../core/editor/dock-gesture.js'
import playIcon from '../assets/icons/icn_play.png'
import pauseIcon from '../assets/icons/icn_pause.png'
import stopIcon from '../assets/icons/icn_stop.png'
import stepIcon from '../assets/icons/icn_step_forward.png'
import SnapControls from './SnapControls.vue'

const tools = [['tool.select', 'Seleccionar', 'Q'], ['tool.move', 'Mover', 'W'], ['tool.rotate', 'Rotar', 'E'], ['tool.scale', 'Escalar', 'R'], ['tool.universal', 'Universal', 'Y']]
const modes = [['vertex', 'Vértices', '1'], ['edge', 'Aristas', '2'], ['face', 'Caras', '3']]
// Los comandos de malla son operaciones sobre vértices, no gizmos del objeto.
const meshTransforms = [['mesh.grab', 'Mover', 'G'], ['mesh.rotate', 'Rotar', 'R'], ['mesh.scale', 'Escalar', 'S']]
const meshActions = {
  vertex: [['mesh.bevelVertex', 'Bisel de vértices', 'Ctrl Shift B'], ['mesh.merge.center', 'Fusionar vértices', 'M']],
  edge: [['mesh.bevel', 'Bisel de aristas', 'Ctrl B'], ['mesh.loopcut', 'Corte en bucle', 'Ctrl R']],
  face: [['mesh.extrude', 'Extruir caras', 'E'], ['mesh.inset', 'Inset de caras', 'I']],
}
const selectedGeometry = computed(() => {
  const e = store.edit
  return Number(e.mode === 'vertex' ? e.count?.sv : e.mode === 'edge' ? e.count?.se : e.count?.sf) || 0
})
function canMeshAction(id) {
  if (store.edit.hud || store.edit.paint?.active) return false
  if (id === 'mesh.loopcut') return true // Selección por posición al activar el corte.
  return selectedGeometry.value >= (id === 'mesh.merge.center' ? 2 : 1)
}
function openMeshPanel() {
  store.prefs.rightTab = 'mesh'
  if (store.ui.mode === 'desktop') revealDockPanel(store, 'mesh')
  else store.ui.drawer = 'inspector'
}

const sel = computed(() => getObject(store.selectedId))
const canPaint = computed(() => !!sel.value && ['sprite3d', 'sprite2d'].includes(sel.value.type) && store.selectedIds.length === 1)
const canEdit = computed(() => !!sel.value && getDef(sel.value.type)?.editable !== false && ['primitive', 'mesh', 'subtract'].includes(sel.value.type) && store.selectedIds.length === 1)

function chooseToolbarView(id) {
  if (consumeDockClickSuppression()) return
  if (id === 'codeView') activateCodeDock(store)
  else activateViewportDock(store, id)
}
</script>

<template>
  <div class="tb" role="toolbar" aria-label="Herramientas">
    <div class="g play" role="group" aria-label="Control del juego">
      <button class="t pl" :class="{ on: store.play.on }" :data-tooltip="store.play.on ? 'Detener (F5)' : 'Jugar (F5)'" :aria-label="store.play.on ? 'Detener' : 'Jugar'" :aria-pressed="store.play.on" @click="run('play.start')"><img :src="store.play.on ? stopIcon : playIcon" alt="" /></button>
      <button class="t" :class="{ on: store.play.paused }" :disabled="!store.play.on" data-tooltip="Pausa" aria-label="Pausa" :aria-pressed="!!store.play.paused" @click="run('play.pause')"><img :src="pauseIcon" alt="" /></button>
      <button class="t" :disabled="!store.play.on" data-tooltip="Avanzar un fotograma" aria-label="Paso" @click="run('play.step')"><img :src="stepIcon" alt="" /></button>
      <i class="sep"></i>
      <button class="t" :disabled="store.play.on" data-tooltip="Jugar desde la cámara del editor (Mayús F5)" aria-label="Jugar desde la cámara" @click="run('play.here')"><Icon name="frame" :size="14" /></button>
    </div>
    <!-- Los modos de edición son excluyentes: no mostrar herramientas de objeto al modificar geometría. -->
    <div class="side left" :class="{ 'mesh-toolbar': store.edit.on }">
      <template v-if="!store.edit.on && !store.paint.on">
        <div class="g" role="group" aria-label="Transformar objetos">
          <button v-for="[id, label, key] in tools" :key="id" class="t" :class="{ on: command(id).checked() }" :data-tooltip="`${label} (${key})`" :aria-label="label" @click="run(id)">
            <Icon :name="command(id).icon" :size="16" />
          </button>
        </div>
        <div class="g" role="group" aria-label="Herramientas de entorno">
          <button class="t" :class="{ on: store.tool === 'road' }" data-tooltip="Dibujar carretera (U)" aria-label="Carretera" @click="run('tool.road')"><Icon name="road" :size="16" /></button>
          <button class="t" :class="{ on: store.tool === 'terrain' }" data-tooltip="Pincel de terreno (B)" aria-label="Pincel de terreno" @click="run('tool.terrain')"><Icon name="terrain" :size="16" /></button>
        </div>
      </template>
      <div v-if="!store.paint.on" class="g scene-space" role="group" aria-label="Espacio y Snap">
        <button class="pill" :data-tooltip="store.space === 'world' ? 'Gizmo en ejes del mundo (X)' : 'Gizmo en ejes locales (X)'" @click="run('view.space')">
          <Icon :name="store.space === 'world' ? 'globe' : 'local'" :size="13" /><span>{{ store.space === 'world' ? 'Global' : 'Local' }}</span>
        </button>
        <SnapControls />
      </div>

      <div v-if="store.paint.on" class="g edit" role="group" aria-label="Pintura">
        <span class="tag">Pintura</span>
        <button class="pill ok" @click="store.editor.exitPaint()">Salir</button>
      </div>
      <template v-else-if="store.edit.on">
        <div class="g edit mesh-selection" role="group" aria-label="Modo de selección de malla">
          <span class="tag">Malla</span>
          <button v-for="[m, label, key] in modes" :key="m" class="t" :class="{ on: store.edit.mode === m }" :aria-pressed="store.edit.mode === m" :data-tooltip="`${label} (${key})`" :aria-label="label" :disabled="!!store.edit.hud" @click="run('mesh.mode.' + m)"><Icon :name="m" :size="15" /></button>
        </div>
        <div class="g edit mesh-transform" role="group" aria-label="Transformar geometría">
          <button v-for="[id, label, key] in meshTransforms" :key="id" class="t" :data-tooltip="`${label} geometría (${key})`" :aria-label="`${label} geometría`" :disabled="!selectedGeometry || !!store.edit.hud || !!store.edit.paint?.active" @click="run(id)"><Icon :name="command(id).icon" :size="15" /></button>
        </div>
        <div class="g edit mesh-quick" role="group" :aria-label="`Operaciones de ${store.edit.mode === 'vertex' ? 'vértices' : store.edit.mode === 'edge' ? 'aristas' : 'caras'}`">
          <button v-for="[id, label, key] in meshActions[store.edit.mode] || []" :key="id" class="mesh-action" :disabled="!canMeshAction(id)" :data-tooltip="`${label} (${key})`" :aria-label="label" @click="run(id)"><Icon :name="command(id).icon" :size="14"/><span>{{ label }}</span></button>
        </div>
        <div class="g edit mesh-options" role="group" aria-label="Opciones de edición">
          <button v-for="[id, label, key] in [['mesh.xray', 'X-ray', 'Alt Z'], ['mesh.proportional', 'Proporcional', 'O'], ['mesh.mirror', 'Simetría X', '']]" :key="id" class="t" :class="{ on: command(id).checked() }" :aria-pressed="!!command(id).checked()" :aria-label="label" :data-tooltip="`${label}${key ? ' (' + key + ')' : ''}`" :disabled="!!store.edit.hud" @click="run(id)"><Icon :name="command(id).icon" :size="15" /></button>
        </div>
        <button class="pill solo mesh-panel-access" data-testid="mesh-tools-access" data-tooltip="Abrir panel Malla con todas las operaciones" @click="openMeshPanel"><Icon name="sliders" :size="13"/><span>Herramientas</span></button>
        <button class="pill ok mesh-exit" data-testid="mesh-exit" data-tooltip="Salir de Edit Mesh (Tab)" @click="run('mesh.edit')">Salir <span class="key-hint">Tab</span></button>
      </template>
      <button v-else-if="canEdit" class="pill solo" data-tooltip="Editar la malla del objeto (Tab)" @click="run('mesh.edit')"><Icon name="mesh" :size="13" /><span>Editar malla</span></button>
      <button v-else-if="canPaint" class="pill solo" data-testid="start-paint" @click="run('mesh.edit')"><Icon name="brush" :size="13" /><span>Pintar (Tab)</span></button>
    </div>

    <!-- derecha -->
    <div class="side right">
      <div class="g viewport-modes" role="group" aria-label="Vista del viewport">
        <button type="button" class="pill view-mode" :class="{ on: store.ui.viewTab === 'scene' }"
          :aria-pressed="store.ui.viewTab === 'scene'" :disabled="!store.ready"
          data-tooltip="Vista de edición" @pointerdown="startDockGesture($event, 'sceneView', store)" @click="chooseToolbarView('sceneView')">Edit Mode</button>
        <button type="button" class="pill view-mode" :class="{ on: store.ui.viewTab === 'game' }"
          :aria-pressed="store.ui.viewTab === 'game'" :disabled="!store.ready || (!store.play.on && (store.edit.on || store.paint.on))"
          data-tooltip="Vista previa desde la cámara del juego" @pointerdown="startDockGesture($event, 'gameView', store)" @click="chooseToolbarView('gameView')">Play Mode</button>
        <button type="button" class="pill view-mode" :class="{ on: store.ui.viewTab === 'code' }"
          :aria-pressed="store.ui.viewTab === 'code'" :disabled="!store.ready || !store.project"
          data-tooltip="Editor de código de Century" @pointerdown="startDockGesture($event, 'codeView', store)" @click="chooseToolbarView('codeView')">Code</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tb { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 10px; height: 36px; padding: 0 8px; background: var(--g-800); border-bottom: 1px solid var(--hair-soft); flex: none; }
.side { display: flex; align-items: center; gap: 8px; min-width: 0; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
.side::-webkit-scrollbar { display: none; }
.side.right { justify-content: flex-end; }
.g { display: flex; align-items: center; gap: 2px; padding: 2px; background: var(--g-900); border: 1px solid var(--hair); border-radius: 6px; flex: none; }
.t { width: 30px; height: 24px; padding: 0; background: transparent; border-color: transparent; color: var(--text-2); }
.t:hover { background: var(--g-700); color: var(--text); }
.t.on { background: var(--blue-wash); border-color: rgba(71, 140, 191, .5); color: var(--blue-hi); }
.play { gap: 3px; padding: 0; border: 0; background: transparent; }
.play .t { width: 30px; background: var(--editor-frame); border-color: var(--hair); }
.play .t:hover { background: var(--g-700); }
.play img { width: 16px; height: 16px; object-fit: contain; }
.play .pl.on { background: var(--blue); border-color: var(--blue); color: #fff; }
.play .pl:not(.on):hover { color: var(--ok); }
.pill { height: 24px; padding: 0 9px; background: transparent; border-color: transparent; color: var(--text-2); gap: 5px; white-space: nowrap; }
.pill:hover { background: var(--g-700); color: var(--text); }
.view-mode.on { background: var(--blue-wash); border-color: rgba(71, 140, 191, .5); color: var(--blue-hi); }
.pill.solo { border-color: var(--hair); background: var(--g-900); flex: none; }
.pill.acc { color: var(--blue-hi); }
.pill.ok { color: var(--ok); }
.edit { border-color: rgba(255, 181, 71, .45); background: rgba(255, 181, 71, .06); }
.edit .t.on { background: var(--amber-wash); border-color: var(--amber-edge); color: var(--amber); }
.tag { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: var(--amber); padding: 0 6px; }
.sep { width: 1px; height: 16px; background: var(--hair); margin: 0 3px; }
@media (max-width: 1180px) { .pill span { display: none; } .pill { padding: 0 7px; } }
@media (max-width: 760px) { .tb { display: flex; overflow-x: auto; scrollbar-width: none; } .tb .side { overflow: visible; flex: none; } }

/* Contexto de malla: acciones frecuentes sin reproducir el panel de modelado completo. */
.mesh-toolbar { gap: 5px; }
.mesh-toolbar .mesh-selection { order: 1; }
.mesh-toolbar .mesh-transform { order: 2; }
.mesh-toolbar .mesh-quick { order: 3; }
.mesh-toolbar .mesh-options { order: 4; }
.mesh-toolbar .scene-space { order: 5; }
.mesh-toolbar .mesh-panel-access { order: 6; }
.mesh-toolbar .mesh-exit { order: 7; }
.mesh-selection { border-color: var(--amber-edge); }
.mesh-toolbar .tag { padding: 0 4px; }
.mesh-quick { gap: 2px; }
.mesh-action { height: 24px; padding: 0 7px; min-width: 0; font-size: 11px; white-space: nowrap; color: var(--text-2); background: transparent; border-color: transparent; gap: 5px; }
.mesh-action:hover:not(:disabled) { background: var(--g-700); color: var(--text); }
.mesh-action:focus-visible, .mesh-toolbar .t:focus-visible { outline: 2px solid var(--blue-hi); outline-offset: -2px; }
.mesh-action:disabled { opacity: .35; }
.mesh-panel-access { height: 28px; align-self: center; }
.mesh-exit { height: 27px; flex: none; border: 1px solid var(--amber-edge); background: var(--amber-wash); align-self: center; }
.mesh-exit .key-hint { font-size: 10px; color: var(--text-3); padding-left: 4px; }
@media (max-width: 1450px) { .mesh-action span { display: none; } .mesh-action { width: 28px; justify-content: center; padding: 0; } }
@media (max-width: 1180px) { .mesh-exit .key-hint { display: none; } }
</style>
