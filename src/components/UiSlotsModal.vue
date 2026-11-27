<script setup>
// «Interfaz del juego»: qué pantalla (.ui) usa cada rol del sistema. El resto de pantallas las abre el juego con game.ui.open.
import AppWindow from './AppWindow.vue'
import { store, setUiSlot, openUiEditor, createUi, restoreDefaultUi, openThemeEditor } from '../core/store.js'
import { ROLES } from '../engine/runtime/ui/roles.js'

const name = (u) => u.name.replace(/\.ui$/, '')
const slots = () => store.project.ui.slots
const edit = (id) => id && openUiEditor(id)
const add = (r) => { const d = createUi('Assets/UI', r.key + '.ui'); setUiSlot(r.key, d.id, true); openUiEditor(d.id) }
</script>

<template>
  <AppWindow data-win="us" title="Roles de interfaz (obsoleto)" :width="760" :min-width="340" :min-height="240" persist="uislots" @close="store.modal = null">
      <p class="hint dep"><b>OBSOLETO.</b> Los roles del sistema (HUD, diálogo, opciones…) se conservan solo para proyectos antiguos. Las interfaces del motor se editan ahora desde <code>Assets/UI/Sistema</code> y aparecen automáticamente. Estos roles solo sirven para proyectos antiguos.</p>
      <p class="hint lf-help">Cada rol decide <b>cuándo</b> aparece una pantalla; <b>cómo se ve</b> lo defines tú en el documento <code>.ui</code> (plantilla Vue + script + CSS). Las demás pantallas (inventario, menús…) las abres con <code>game.ui.open("nombre")</code> o el comando «Mostrar interfaz».</p>
      <table>
        <tr v-for="r in ROLES" :key="r.key">
          <td class="lab"><b>{{ r.label }}</b><br /><span class="dim lf-help">{{ r.desc }}</span></td>
          <td class="sel">
            <template v-if="r.multi">
              <label v-for="u in store.project.uis" :key="u.id" class="chk"><input type="checkbox" :checked="slots()[r.key].includes(u.id)" @change="setUiSlot(r.key, u.id, $event.target.checked)" /> {{ name(u) }}</label>
            </template>
            <select v-else :value="slots()[r.key] || ''" @change="setUiSlot(r.key, $event.target.value, !!$event.target.value)">
              <option value="">— ninguna —</option>
              <option v-for="u in store.project.uis" :key="u.id" :value="u.id">{{ name(u) }}</option>
            </select>
          </td>
          <td class="act">
            <button v-if="!r.multi && slots()[r.key]" @click="edit(slots()[r.key])">Editar</button>
            <button v-else-if="!r.multi" @click="add(r)">Crear</button>
          </td>
        </tr>
      </table>
    <template #footer>
      <button @click="openThemeEditor()">Tema (fuente, colores)…</button>
      <span class="grow"></span><button class="primary" @click="store.modal = null">Cerrar</button>
    </template>
  </AppWindow>
</template>

<style scoped>
.hint.dep { background: #4a3a14; border: 1px solid #8a6a1c; color: #f3d79a; padding: 8px 10px; border-radius: 6px; }
.grow { flex: 1; }
.hint { margin: 10px 14px; font-size: 12px; color: var(--text-2); line-height: 1.5; }
table { width: calc(100% - 28px); margin: 0 14px 10px; border-collapse: collapse; }
td { padding: 6px 4px; border-top: 1px solid var(--g-700); vertical-align: middle; font-size: 12px; }
.dim { color: var(--text-2); font-size: 11px; }
.sel { width: 40%; } .sel select { width: 100%; }
.chk { display: inline-flex; gap: 4px; margin-right: 10px; }
.act { width: 64px; text-align: right; }
@container win (max-width: 560px) {
  table, tbody, tr { display: block; width: auto; }
  table { margin: 0 14px; }
  tr { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 8px; padding: 8px 0; border-top: 1px solid var(--g-700); }
  td { display: block; border: 0; padding: 0; } .lab { grid-column: 1 / -1; } .sel { width: auto; }
}
code { color: var(--amber); font-family: ui-monospace, monospace; }
</style>
