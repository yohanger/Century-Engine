<script setup>
// Editor de una ruta de movimiento (Set Movement Route de MZ): lista de pasos + parámetros del paso elegido. Modifica `route` en sitio.
import { ref, computed } from 'vue'
import { ROUTE_CMDS, ROUTE_GROUPS, newRouteStep, routeSummary } from '../engine/runtime/events/route.js'

const props = defineProps({ route: { type: Object, required: true }, compact: { type: Boolean, default: false } })
const emit = defineEmits(['change'])
const sel = ref(-1)
const picking = ref(false)
const list = computed(() => props.route.list)
const cur = computed(() => list.value[sel.value] || null)
const byGroup = ROUTE_GROUPS.map((g) => [g, Object.entries(ROUTE_CMDS).filter(([, d]) => d.group === g)])

function add(code) {
  if (!code) return
  const at = sel.value >= 0 ? sel.value + 1 : list.value.length
  list.value.splice(at, 0, newRouteStep(code)); sel.value = at; emit('change')
}  // el panel se queda abierto para añadir varios pasos seguidos
function del() { if (!cur.value) return; list.value.splice(sel.value, 1); sel.value = Math.min(sel.value, list.value.length - 1); emit('change') }
function mv(d) { const i = sel.value, j = i + d; if (!cur.value || j < 0 || j >= list.value.length) return; const [c] = list.value.splice(i, 1); list.value.splice(j, 0, c); sel.value = j; emit('change') }
function dup() { if (!cur.value) return; list.value.splice(sel.value + 1, 0, newRouteStep(cur.value.c, cur.value.p)); sel.value++; emit('change') }
</script>

<template>
  <div class="rt" :class="{ compact }">
    <div class="bar">
      <button class="add" :class="{ on: picking }" :aria-expanded="picking" @click="picking = !picking">＋ Añadir paso… <span class="car">{{ picking ? '▴' : '▾' }}</span></button>
      <button class="ghost icon" :disabled="!cur" data-tooltip="Subir" @click="mv(-1)">↑</button>
      <button class="ghost icon" :disabled="!cur" data-tooltip="Bajar" @click="mv(1)">↓</button>
      <button class="ghost icon" :disabled="!cur" data-tooltip="Duplicar" @click="dup">⧉</button>
      <button class="ghost icon danger" :disabled="!cur" data-tooltip="Eliminar" @click="del">✕</button>
    </div>
    <!-- lista en línea (no un desplegable nativo): se adapta al ancho de la ventana y nunca se sale de la pantalla -->
    <div v-if="picking" class="pickp">
      <div v-for="[g, items] in byGroup" :key="g" class="pg">
        <header>{{ g }}</header>
        <div class="chips"><button v-for="[code, d] in items" :key="code" class="chip" @click="add(code)">{{ d.label }}</button></div>
      </div>
    </div>
    <div class="steps" tabindex="0" @keydown.delete.prevent="del">
      <div v-if="!list.length" class="empty lf-help">Sin pasos. Añade «Avanzar», «Girar»…</div>
      <div v-for="(s, i) in list" :key="s.id" class="st" :class="{ on: i === sel }" @mousedown="sel = i">
        <span class="n">{{ i + 1 }}</span>{{ routeSummary(s) }}
      </div>
    </div>
    <div v-if="cur && ROUTE_CMDS[cur.c]?.params.length" class="sp"><slot name="step-params" :params="ROUTE_CMDS[cur.c].params" :values="cur.p" :notify="() => emit('change')" /></div>
    <div class="opts">
      <label><input v-model="route.repeat" type="checkbox" @change="emit('change')" /> Repetir (bucle)</label>
      <label data-tooltip="Si un paso está bloqueado se salta; si no, espera a que se libere"><input v-model="route.skip" type="checkbox" @change="emit('change')" /> Saltar si está bloqueado</label>
    </div>
  </div>
</template>

<style scoped>
.rt { display: flex; flex-direction: column; gap: 6px; width: 100%; min-width: 0; }
.bar { display: flex; gap: 3px; align-items: center; }
.bar .add { flex: 1; min-width: 0; text-align: left; display: flex; justify-content: space-between; align-items: center; }
.bar .add.on { border-color: var(--blue); }
.pickp { max-height: 190px; overflow: auto; background: var(--g-950); border: 1px solid var(--hair); border-radius: 5px; padding: 6px 8px; display: flex; flex-direction: column; gap: 6px; }
.pg header { font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-3); margin-bottom: 3px; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chip { height: 24px; padding: 0 9px; font-size: 11.5px; }
.steps { height: 150px; overflow: auto; background: var(--g-950); border: 1px solid var(--hair); border-radius: 5px; padding: 3px 0; outline: none; font-size: 12px; }
.compact .steps { height: 110px; }
.st { padding: 2px 8px; display: flex; gap: 8px; white-space: nowrap; cursor: default; border-left: 3px solid transparent; }
.st:hover { background: var(--g-850); }
.st.on { background: var(--blue-wash); border-left-color: var(--blue); }
.n { color: var(--text-3); width: 16px; text-align: right; flex: none; }
.empty { color: var(--text-3); padding: 10px; text-align: center; font-size: 11.5px; }
.sp { padding: 7px 8px; background: var(--g-900); border: 1px solid var(--hair-soft); border-radius: 5px; }
.opts { display: flex; gap: 14px; flex-wrap: wrap; color: var(--text-2); font-size: 11.5px; }
.opts label { display: flex; gap: 5px; align-items: center; }
</style>
