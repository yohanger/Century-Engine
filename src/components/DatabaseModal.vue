<script setup>
// Base de datos del juego (estilo RPG Maker MZ, orientada a narrativa): personajes, clases, habilidades, objetos, armas, armaduras,
// enemigos, estados, eventos comunes, misiones, documentos, sistema, términos y nombres de interruptores/variables.
// Los formularios se generan a partir de core/database/schema.js.
import { ref, computed, watch } from 'vue'
import { store, setDbName, addDbRecord, deleteDbRecord, moveDbRecord, touchDb, openEventEditor } from '../core/store.js'
import { SECTIONS, SYSTEM_PARAMS, SYS_LISTS, TERMS, PARAMS, PLAYER_PARAMS } from '../engine/runtime/database/schema.js'
import ParamForm from './ParamForm.vue'
import AppWindow from './AppWindow.vue'
import PlayerPreview from './PlayerPreview.vue'

const db = computed(() => store.project.database)
const ui = store.dbUi
const showPreview = ref(false)
const NAV = computed(() => [...SECTIONS.map((s) => ({ id: s.id, label: s.label })), ...(!db.value?.noPlayer ? [{ id: 'player', label: 'Jugador' }] : []), { id: 'system', label: 'Sistema' }, { id: 'terms', label: 'Términos' }, { id: 'vars', label: 'Interruptores y variables' }])
watch(() => db.value?.noPlayer, (v) => { if (v && ui.section === 'player') ui.section = 'system' }, { immediate: true })
const count = (id) => (Array.isArray(db.value[id]) ? db.value[id].length : null)
const LIST_ROWS = 10 // las listas del sistema muestran como mucho 10 filas; el resto con scroll interno
const sec = computed(() => SECTIONS.find((s) => s.id === ui.section))
const list = computed(() => (sec.value ? db.value[ui.section] : []))
const q = ref('')
const shown = computed(() => list.value.filter((r) => !q.value || (r.name || '').toLowerCase().includes(q.value.toLowerCase())))
const cur = computed(() => list.value.find((r) => r.id === ui.id) || null)
const params = computed(() => (sec.value ? sec.value.params.filter((p) => p.type !== 'commands') : []))
const pad = (i) => String(i).padStart(3, '0')
const extra = ref({ switches: 0, variables: 0 })
const vgroup = ref({ switches: 0, variables: 0 }) // grupo de 20 que se está editando (como RPG Maker MZ)
const PER = 20
const total = (kind) => Math.max(PER, Math.ceil((db.value[kind].length + 5) / PER) * PER) + extra.value[kind]
const groupsOf = (kind) => Array.from({ length: total(kind) / PER }, (_, g) => g)
const groupRows = (kind) => Array.from({ length: PER }, (_, k) => vgroup.value[kind] * PER + k + 1)
const pad4 = (i) => String(i).padStart(4, '0')
const rows = (kind) => Math.max(30, db.value[kind].length + 10) + extra.value[kind]
const nm = (kind, i) => db.value[kind][i - 1] || ''

function pick(id) { ui.id = id }
function go(id) { ui.section = id; q.value = ''; const l = db.value[id]; ui.id = Array.isArray(l) && l.length ? (l.find((r) => r.id === ui.id)?.id ?? l[0].id) : 0 }
watch(() => ui.section, () => { if (sec.value && !cur.value) ui.id = list.value[0]?.id || 0 }, { immediate: true })
async function add() { ui.id = await addDbRecord(ui.section) }
async function dup() { if (cur.value) ui.id = await addDbRecord(ui.section, cur.value.id) }
function del() {
  if (!cur.value) return
  const i = list.value.findIndex((r) => r.id === cur.value.id)
  deleteDbRecord(ui.section, cur.value.id)
  ui.id = list.value[Math.min(i, list.value.length - 1)]?.id || 0
}
// sistema: listas de texto
const sysLists = SYS_LISTS
function listSet(k, i, v) { db.value.system[k][i] = v; touchDb() }
function listAdd(k) { db.value.system[k].push(`Nuevo ${db.value.system[k].length + 1}`); touchDb() }
function listDel(k, i) { if (db.value.system[k].length > 1) { db.value.system[k].splice(i, 1); touchDb() } }
const termGroups = [
  ['General', ['currency', 'level', 'hp', 'mp', 'exp', 'items', 'skills', 'equip', 'status', 'quests', 'journal', 'party']],
  ['Parámetros', PARAMS.map(([k]) => k)],
  ['Mensajes', ['useItem', 'gainItem', 'loseItem', 'gainGold', 'levelUp', 'learnSkill', 'damage', 'recover', 'miss']],
]
const termLabel = (k) => PARAMS.find(([p]) => p === k)?.[1] || k
// curva de parámetros de una clase
const curve = computed(() => {
  const c = ui.section === 'classes' ? cur.value : null
  if (!c) return null
  return [1, 5, 10, 20, 40].map((lv) => ({ lv, v: PARAMS.map(([k]) => Math.round((+c[k + 'Base'] || 0) + (+c[k + 'Grow'] || 0) * (lv - 1))) }))
})
</script>

<template>
  <AppWindow dock-panel-id="database" title="Base de datos" subtitle="personajes, objetos y reglas de tu juego narrativo" :width="1180" :height="720" :min-width="360" :min-height="320" :scroll="false" persist="database" @close="store.modal = null">
    <div class="dbx">
      <!-- ventana estrecha: secciones y registros se eligen en listas desplegables -->
      <div class="narrow-bar">
        <select aria-label="Sección" :value="ui.section" @change="go($event.target.value)">
          <option v-for="n in NAV" :key="n.id" :value="n.id">{{ n.label }}{{ count(n.id) !== null ? ` (${count(n.id)})` : '' }}</option>
        </select>
        <template v-if="sec">
          <select aria-label="Registro" :value="ui.id" @change="pick(+$event.target.value)">
            <option v-for="r in list" :key="r.id" :value="r.id">{{ pad(r.id) }} · {{ r.name || '(sin nombre)' }}</option>
            <option v-if="!list.length" value="0" disabled>— vacío —</option>
          </select>
          <button class="primary" :data-tooltip="'Nuevo: ' + sec.single" @click="add">＋</button>
          <button :disabled="!cur" data-tooltip="Duplicar" @click="dup">⧉</button>
          <button class="danger" :disabled="!cur" data-tooltip="Eliminar" @click="del">✕</button>
        </template>
      </div>

      <div class="cols">
        <nav class="nav" aria-label="Secciones">
          <button v-for="n in NAV" :key="n.id" class="ni" :class="{ on: ui.section === n.id }" @click="go(n.id)"><span class="nl">{{ n.label }}</span><b v-if="count(n.id) !== null" class="cnt">{{ count(n.id) }}</b></button>
        </nav>

        <!-- registros -->
        <template v-if="sec">
          <aside class="recs">
            <input v-model="q" type="text" class="flt" placeholder="Filtrar…" />
            <div class="rl">
              <div v-for="r in shown" :key="r.id" class="rr" :class="{ on: r.id === ui.id }" @mousedown="pick(r.id)">
                <span class="id">{{ pad(r.id) }}</span><span class="nmx">{{ r.name || '(sin nombre)' }}</span>
              </div>
              <div v-if="!shown.length" class="none">Nada aquí todavía.</div>
            </div>
            <div class="rb"><button class="primary add" @click="add">＋ {{ sec.single }}</button><button :disabled="!cur" data-tooltip="Duplicar" @click="dup">⧉</button>
              <button :disabled="!cur" data-tooltip="Subir" @click="moveDbRecord(ui.section, ui.id, -1)">↑</button><button :disabled="!cur" data-tooltip="Bajar" @click="moveDbRecord(ui.section, ui.id, 1)">↓</button>
              <button class="danger" :disabled="!cur" data-tooltip="Eliminar" @click="del">✕</button></div>
          </aside>
          <section class="form">
            <div v-if="!cur" class="none big">Crea un registro con «＋ {{ sec.single }}».</div>
            <template v-else>
              <h3>{{ sec.single }} {{ pad(cur.id) }}</h3>
              <ParamForm :key="ui.section + ':' + cur.id" :params="params" :values="cur" @change="touchDb" />
              <div v-if="ui.section === 'commonEvents'" class="ce">
                <button class="primary" @click="openEventEditor('db:commonEvents:' + cur.id)">Editar comandos… ({{ (cur.list || []).length }})</button>
                <span class="dim lf-help">Se llaman con el comando «Llamar evento común», con <code>game.common("nombre")</code> o desde efectos de objetos y habilidades.</span>
              </div>
              <div v-if="curve" class="tw"><table class="curve"><thead><tr><th>Nivel</th><th v-for="p in PARAMS" :key="p[0]">{{ p[1] }}</th></tr></thead>
                <tbody><tr v-for="r in curve" :key="r.lv"><td>{{ r.lv }}</td><td v-for="(v, i) in r.v" :key="i">{{ v }}</td></tr></tbody></table></div>
            </template>
          </section>
        </template>

        <!-- jugador: cuerpo, movimiento, cámara y view model (slots de las manos) -->
        <!-- como el gráfico de los eventos: la vista previa está siempre al lado del formulario (cuerpo, medidas, ojos, slots) -->
        <section v-else-if="ui.section === 'player' && !db.noPlayer" class="form wide player-sec">
          <h3>Jugador <span class="dim">· personaje, cuerpo, velocidad, ojos y view model</span>
            <button class="ghost" data-testid="player-preview" @click="showPreview = true">Abrir en ventana</button></h3>
          <div class="pgrid">
            <div class="pform">
              <ParamForm :params="PLAYER_PARAMS" :values="db.player" @change="touchDb" />
              <p class="dim hintp lf-help">Un <b>slot</b> es un punto de anclaje colgado de la cámara (mano derecha, mano izquierda, ojos…). Desde un evento: comando <b>Mover al view model</b>. Desde código: <code>game.viewModel.attach()</code>.</p>
            </div>
            <div class="pview"><PlayerPreview v-if="!showPreview" embedded /></div>
          </div>
        </section>

        <!-- sistema: cada lista enseña como mucho 10 filas y el resto se desplaza dentro de ella -->
        <section v-else-if="ui.section === 'system'" class="form wide">
          <h3>Sistema</h3>
          <ParamForm :params="SYSTEM_PARAMS" :values="db.system" @change="touchDb" />
          <div class="lists">
            <div v-for="[k, label] in sysLists" :key="k" class="tl">
              <header>{{ label }} <span class="dim">· {{ db.system[k].length }}</span></header>
              <div class="tls" :style="{ maxHeight: `calc(${LIST_ROWS} * 30px)` }">
                <div v-for="(n, i) in db.system[k]" :key="i" class="tli"><span class="id">{{ i + 1 }}</span><input type="text" :value="n" @input="listSet(k, i, $event.target.value)" /><button class="ghost icon danger" :disabled="db.system[k].length <= 1" data-tooltip="Quitar" @click="listDel(k, i)">✕</button></div>
              </div>
              <button @click="listAdd(k)">＋ Añadir</button>
            </div>
          </div>
        </section>

        <!-- términos -->
        <section v-else-if="ui.section === 'terms'" class="form wide">
          <h3>Términos <span class="dim">· textos que usa el juego; admiten {a} {b} {name} {n} {currency}</span></h3>
          <div v-for="[g, keys] in termGroups" :key="g" class="tg"><header>{{ g }}</header>
            <div v-for="k in keys" :key="k" class="trm"><label>{{ termLabel(k) }}</label><input type="text" :value="db.system.terms[k]" @input="db.system.terms[k] = $event.target.value; touchDb()" /></div></div>
          <button @click="Object.assign(db.system.terms, TERMS); touchDb()">Restaurar términos por defecto</button>
        </section>

        <!-- interruptores / variables: cada columna se desplaza por separado -->
        <section v-else class="form wide two">
          <div v-for="[kind, title, sub] in [['switches', 'Interruptores', 'ON / OFF'], ['variables', 'Variables', 'número, texto, sí/no, lista']]" :key="kind" class="vcol">
            <header>{{ title }} <span class="dim">{{ sub }}</span></header>
            <div class="vgrp">
              <div class="vg"><button v-for="g in groupsOf(kind)" :key="g" :class="{ on: g === vgroup[kind] }" @click="vgroup[kind] = g">{{ pad4(g * PER + 1) }}-{{ pad4(g * PER + PER) }}</button><button class="more" @click="extra[kind] += PER" data-tooltip="Añade otro grupo de 20 (como «Cambiar máximo» de RPG Maker)">＋ 20</button></div>
              <div class="vl">
                <div v-for="i in groupRows(kind)" :key="i" class="vr"><span class="id">{{ pad4(i) }}</span><input type="text" :value="nm(kind, i)" placeholder="sin nombre" spellcheck="false" @input="setDbName(kind, i, $event.target.value)" /></div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
    <template #footer>
      <span class="dim grow hintf lf-help">Desde scripts: <code>game.party.gain("items", "Poción")</code> · <code>game.party.useSkill("Golpe", "Protagonista", {enemy: 1})</code> · <code>game.db.items</code> · texto: <code>\N[1]</code> <code>\T[item:1]</code> <code>\I[item:1]</code> <code>\G</code></span>
      <button class="primary" @click="store.modal = null">Cerrar</button>
    </template>
  </AppWindow>
  <PlayerPreview v-if="showPreview" @close="showPreview = false" />
</template>

<style scoped>
.vgrp { display: flex; min-height: 0; flex: 1; gap: 8px } .vg { width: 108px; flex: none; overflow: auto; display: flex; flex-direction: column; gap: 2px } .vg button { min-height: 24px; height: 24px; font-size: 11px; font-variant-numeric: tabular-nums; text-align: left; background: transparent; border-color: transparent } .vg button.on { background: var(--blue-wash); border-color: var(--blue) } .vg .more { color: var(--text-3) } .vgrp .vl { flex: 1; min-width: 0 }
.dbx { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.dim { color: var(--text-3); } .grow { flex: 1; min-width: 0; }
.cols { flex: 1; min-height: 0; display: flex; }
.narrow-bar { display: none; gap: 6px; padding: 8px; border-bottom: 1px solid var(--hair); background: var(--g-850); }
.narrow-bar select { flex: 1 1 0; min-width: 0; }
.nav { width: 188px; flex: none; border-right: 1px solid var(--hair); background: var(--g-850); padding: 8px; display: flex; flex-direction: column; gap: 2px; overflow: auto; }
.ni { justify-content: flex-start; gap: 8px; background: transparent; border-color: transparent; min-height: 30px; height: auto; text-align: left; padding-top: 4px; padding-bottom: 4px; }
.ni .nl { min-width: 0; white-space: normal; line-height: 1.2; }
.ni.on { background: var(--blue-wash); border-color: var(--blue); color: var(--text-1); }
.cnt { margin-left: auto; font-weight: 400; font-size: 10.5px; color: var(--text-3); flex: none; }
.recs { width: 240px; flex: none; border-right: 1px solid var(--hair); display: flex; flex-direction: column; background: var(--g-900); min-height: 0; }
.flt { margin: 8px; width: calc(100% - 16px); }
.rl { flex: 1; min-height: 0; overflow: auto; }
.rr { display: grid; grid-template-columns: 30px 1fr; gap: 8px; align-items: center; padding: 4px 10px; cursor: default; border-left: 3px solid transparent; }
.rr:hover { background: var(--g-850); } .rr.on { background: var(--blue-wash); border-left-color: var(--blue); }
.id { color: var(--text-3); font-size: 11px; text-align: right; }
.nmx { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rb { display: flex; gap: 4px; padding: 8px; border-top: 1px solid var(--hair); flex-wrap: wrap; } .rb .add { flex: 1 1 100%; }
.rb button:not(.add) { flex: 1 1 0; min-width: 0; padding: 0 4px; }
.none { color: var(--text-3); padding: 14px; text-align: center; font-size: 12px; } .none.big { padding: 60px 14px; }
.form { flex: 1; min-width: 0; min-height: 0; overflow: auto; padding: 12px 18px 24px; }
.form.two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; align-content: stretch; overflow: hidden; padding-bottom: 12px; }
.form h3 { margin: 0 0 10px; font-size: 14px; } .form h3 .dim { font-weight: 400; font-size: 11.5px; }
.form :deep(.pf .row) { grid-template-columns: minmax(110px, 170px) minmax(0, 1fr); }
.form :deep(.pf .row.t-list) { grid-template-columns: 1fr; }
.form :deep(.pf) { max-width: 760px; }
header { font-weight: 600; color: var(--text-2); margin: 0 0 6px; }
.hintp { margin-top: 14px; max-width: 760px; line-height: 1.5; }
.ce { margin-top: 14px; display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
.tw { overflow-x: auto; max-width: 100%; margin-top: 18px; }
.curve { border-collapse: collapse; font-size: 11.5px; } .curve th, .curve td { padding: 3px 10px; border-bottom: 1px solid var(--hair-soft); text-align: right; } .curve th { color: var(--text-3); font-weight: 500; }
.lists { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr)); gap: 16px; margin-top: 18px; max-width: 900px; }
.tl { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.tls { display: flex; flex-direction: column; gap: 4px; overflow-y: auto; overscroll-behavior: contain; padding-right: 2px; }
.tli { display: grid; grid-template-columns: 18px minmax(0, 1fr) 24px; gap: 5px; align-items: center; min-height: 26px; }
.tg { margin-bottom: 14px; max-width: 720px; } .trm { display: grid; grid-template-columns: minmax(90px, 150px) minmax(0, 1fr); gap: 8px; align-items: center; margin-bottom: 4px; } .trm label { color: var(--text-3); }
.vcol { display: flex; flex-direction: column; min-height: 0; min-width: 0; }
.vl { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 3px; padding-right: 4px; } .vr { display: grid; grid-template-columns: 38px minmax(0, 1fr); gap: 6px; align-items: center; }
.hintf { font-size: 11.5px; line-height: 1.6; }
code { background: var(--g-950); padding: 1px 4px; border-radius: 3px; color: var(--text-2); }

/* ---- adaptación al ANCHO DE LA VENTANA (no al de la pantalla) ---- */
@container win (max-width: 900px) {
  .nav { width: 150px; } .recs { width: 200px; }
  .form { padding: 12px 14px 20px; }
}
@container win (max-width: 640px) {
  .narrow-bar { display: flex; }
  .cols { flex-direction: column; }
  .nav, .recs { display: none; }
  .form { padding: 10px 12px 18px; }
  .form :deep(.pf .row) { grid-template-columns: 1fr; gap: 3px; }
  .form.two { grid-template-columns: 1fr; grid-auto-rows: minmax(0, 1fr); }
  .hintf { display: none; }
}
.player-sec { max-width: none; }
.pgrid { display: grid; grid-template-columns: minmax(320px, 1fr) minmax(280px, 0.9fr); gap: 14px; align-items: start; }
.pview { position: sticky; top: 0; height: min(560px, calc(100vh - 220px)); }
@container (max-width: 760px) { .pgrid { grid-template-columns: 1fr; } .pview { position: static; height: 360px; } }
@media (max-width: 1000px) { .pgrid { grid-template-columns: 1fr; } .pview { position: static; height: 360px; } }
</style>
