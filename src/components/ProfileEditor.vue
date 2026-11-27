<script setup>
// Controles de .post en el Inspector. Usa el visor real, sin otra cámara ni compositor.
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import ParamForm from './ParamForm.vue'
import { store, touchProfile, renameEntry, openShaderEditor } from '../core/store.js'
import { PROFILE_EFFECTS, profileStem } from '../engine/runtime/render/profiles.js'

const props = defineProps({ profileId: { type: String, required: true } })
const pr = computed(() => store.project?.profiles?.find((p) => p.id === props.profileId))
const chosen = ref('color')
const query = ref('')
const before = ref(false)
const onCount = computed(() => PROFILE_EFFECTS.filter((e) => pr.value?.fx?.[e.id]?.on).length)
const shown = computed(() => PROFILE_EFFECTS.filter((e) => e.label.toLowerCase().includes(query.value.trim().toLowerCase())))
const current = computed(() => PROFILE_EFFECTS.find((e) => e.id === chosen.value) || PROFILE_EFFECTS[0])
const postGraphs = computed(() => (store.project?.shaders || []).filter((s) => s.graph?.target === 'post'))
const selectedGraph = computed(() => postGraphs.value.find((s) => s.id === pr.value?.fx?.shader?.postShader))
function shaderParam(p, value, final = true) {
  const cfg = fx(PROFILE_EFFECTS.find((e) => e.id === 'shader'))
  cfg.postParams ||= {}
  cfg.postParams[p.name] = p.type === 'bool' ? !!value : p.type === 'float' ? Number(value) : value
  modified()
  if (final) finished()
}
/** Modifica un componente del vector sin perder los otros dos valores del perfil. */
function shaderVectorParam(p, index, raw) {
  const cfg = fx(PROFILE_EFFECTS.find((e) => e.id === 'shader'))
  const current = cfg.postParams?.[p.name]
  const v = Array.isArray(current) && current.length === 3 ? [...current] : [...p.def]
  const next = Number(raw)
  if (!Number.isFinite(next)) return
  v[index] = next
  shaderParam(p, v)
}
const preview = () => store.editor?.previewProfile?.(before.value ? null : pr.value)
const compare = () => { before.value = !before.value; preview() }
const fx = (e) => (pr.value.fx[e.id] ||= { on: false, ...Object.fromEntries(e.params.map((p) => [p.key, p.def])) })
const modified = () => { touchProfile(pr.value.id, { record: false }); if (before.value) preview() }
const finished = () => { touchProfile(pr.value.id); if (before.value) preview() }
const toggle = (e, on) => { fx(e).on = on; finished() }
const rename = (v) => {
  const name = profileStem(String(v || '').trim())
  if (!name) return
  const extension = pr.value.name.toLowerCase().endsWith('.profile') ? '.profile' : '.post'
  renameEntry('profile', pr.value.id, name + extension)
  modified()
}
onMounted(preview)
onBeforeUnmount(() => store.editor?.previewProfile?.(null))
</script>

<template>
  <div v-if="pr" class="post-root" data-testid="profile-inspector">
      <div class="post-heading">
        <div class="post-name"><label>Recurso</label><input type="text" :value="profileStem(pr.name)" data-testid="pf-name" @change="rename($event.target.value)" /><span>{{ pr.name.toLowerCase().endsWith('.profile') ? '.profile' : '.post' }}</span></div>
        <button type="button" class="compare" data-testid="pf-before-after" :aria-pressed="before" @click="compare">{{ before ? 'Mostrar después' : 'Ver antes (sin perfil)' }}</button>
      </div>
      <div class="preview-note" data-testid="pf-preview-state">
        <span class="status-dot" :class="{ inactive: before }"></span>
        <span>{{ before ? 'ANTES · Render del proyecto' : 'DESPUÉS · Perfil aplicado en el visor 3D' }}</span>
        <span class="hint">Vista previa en el viewport de la escena.</span>
      </div>
      <div class="post-columns">
        <aside class="effects">
          <div class="effects-heading"><strong>Efectos</strong><span>{{ onCount }} activos / {{ PROFILE_EFFECTS.length }}</span></div>
          <input v-model="query" type="search" placeholder="Buscar efecto…" aria-label="Buscar efecto" />
          <div class="effect-list">
            <button v-for="e in shown" :key="e.id" type="button" class="effect-choice" :class="{ selected: chosen === e.id }" @click="chosen = e.id">
              <span class="effect-name">{{ e.label }}</span><span class="effect-status" :class="{ enabled: !!pr.fx?.[e.id]?.on }">{{ pr.fx?.[e.id]?.on ? 'ON' : 'OFF' }}</span>
            </button>
            <p v-if="!shown.length" class="hint">No hay efectos con ese nombre.</p>
          </div>
        </aside>
        <section class="properties">
          <div class="properties-title"><h3>{{ current.label }}</h3><label class="switch"><input type="checkbox" :checked="!!pr.fx?.[current.id]?.on" :data-testid="'pf-fx-' + current.id" @change="toggle(current, $event.target.checked)" /> Activar override</label></div>
          <p class="hint">{{ pr.fx?.[current.id]?.on ? 'Este efecto modifica el render mientras el recurso está activo.' : 'Desactivado: conserva el valor definido en Render del proyecto.' }}</p>
          <div v-if="pr.fx?.[current.id]?.on" class="properties-fields">
            <template v-if="current.id === 'shader'">
              <label class="shader-label">Shader Graph (Post Processing)</label>
              <select v-model="fx(current).postShader" @change="finished">
                <option value="">— Sin shader —</option>
                <option v-for="s in postGraphs" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
              <button v-if="selectedGraph" type="button" class="shader-open" @click="openShaderEditor(selectedGraph.id)">Abrir Shader Graph…</button>
              <p v-if="!postGraphs.length" class="hint">Crea un Shader Graph de postprocesado desde Assets / Shaders.</p>
            </template>
            <ParamForm :params="current.params" :values="fx(current)" @change="modified" @commit="finished" />
            <div v-if="current.id === 'shader' && selectedGraph" class="shader-props">
              <label v-for="p in selectedGraph.graph.props.filter((x) => x.type !== 'texture')" :key="p.id" class="shader-property">
                {{ p.label }}
                <input v-if="p.type === 'float'" type="number" :min="p.min" :max="p.max" :step="p.step" :value="fx(current).postParams?.[p.name] ?? p.def" @change="shaderParam(p, $event.target.value)" />
                <ColorInput v-else-if="p.type === 'color'" :value="fx(current).postParams?.[p.name] ?? p.def" @input="shaderParam(p, $event.target.value, false)" @change="finished" />
                <input v-else-if="p.type === 'bool'" type="checkbox" :checked="fx(current).postParams?.[p.name] ?? p.def" @change="shaderParam(p, $event.target.checked)" />
                <span v-else-if="p.type === 'vec3'" class="shader-vector">
                  <input v-for="axis in 3" :key="axis" type="number" step="0.05"
                    :aria-label="`${p.label} · ${['X', 'Y', 'Z'][axis - 1]}`"
                    :value="(fx(current).postParams?.[p.name] ?? p.def)[axis - 1]"
                    @change="shaderVectorParam(p, axis - 1, $event.target.value)" />
                </span>
              </label>
            </div>
          </div>
          <p v-else class="empty-msg">Activa este efecto para editar sus propiedades. Los demás efectos del perfil permanecen independientes.</p>
          <div class="post-help"><strong>Asignación</strong><p>Este recurso se puede usar en GameManager o Camera3D (y se conserva en marcadores antiguos). Los eventos y scripts pueden aplicar un override temporal y devolver el control al perfil correspondiente.</p></div>
        </section>
      </div>
  </div>
</template>

<style scoped>
.post-root { display:flex; flex-direction:column; gap:10px; padding:12px 10px; min-width:0; container:insp / inline-size; }
.post-heading { display:flex; flex-direction:column; align-items:stretch; gap:8px; }
.post-name { display:flex; gap:5px; align-items:center; min-width:0; }
.post-name label,.post-name span { font-size:12px; color:var(--text-3); }
.post-name input { flex:1; min-width:0; }
.compare { width:100%; white-space:nowrap; }
.preview-note { display:flex; align-items:center; flex-wrap:wrap; gap:8px; border:1px solid var(--hair); border-radius:6px; padding:8px 10px; font-size:12px; }
.status-dot { height:8px; width:8px; flex:none; border-radius:50%; background:#35b77c; }
.status-dot.inactive { background:#8795aa; }
.hint { color:var(--text-3); font-size:12px; line-height:1.5; margin:0; }
.post-columns { display:flex; flex-direction:column; min-width:0; gap:8px; }
.effects { display:flex; flex-direction:column; gap:7px; padding:9px; background:var(--g-850, rgba(255,255,255,.03)); border:1px solid var(--hair); border-radius:6px; }
.effects-heading { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:4px; font-size:12px; }
.effects-heading span { color:var(--text-3); font-size:11px; }
.effects input { min-width:0; width:100%; }
.effect-list { display:flex; flex-direction:column; gap:2px; max-height:206px; overflow-y:auto; }
.effect-choice { display:flex; align-items:center; gap:8px; width:100%; text-align:left; padding:6px 7px; border-radius:4px; border:1px solid transparent; background:transparent; font-size:12px; }
.effect-choice.selected { border-color:var(--accent, #3b82f6); background:var(--g-800, rgba(255,255,255,.06)); }
.effect-name { flex:1; min-width:0; }
.effect-status { color:var(--text-3); font-size:10px; font-weight:600; }
.effect-status.enabled { color:#47c992; }
.properties { display:flex; flex-direction:column; gap:9px; min-width:0; padding:10px; border:1px solid var(--hair); border-radius:6px; }
.properties-title { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; }
.properties-title h3 { font-size:13px; margin:0; }
.switch { display:flex; gap:6px; align-items:center; font-size:12px; }
.properties-fields { padding:8px; background:var(--g-850, rgba(255,255,255,.03)); border:1px solid var(--hair); border-radius:6px; }
.empty-msg { border:1px dashed var(--hair); border-radius:6px; padding:18px; font-size:12px; color:var(--text-3); line-height:1.5; }
.post-help { margin-top:auto; padding-top:12px; border-top:1px solid var(--hair); font-size:12px; }
.post-help p { color:var(--text-3); line-height:1.5; margin:6px 0 0; }
.shader-label { display:block; margin-bottom:5px; font-size:12px; }
.shader-open { margin-top:5px; width:100%; }
.shader-props { margin-top:10px; display:flex; flex-direction:column; gap:8px; border-top:1px solid var(--hair); padding-top:10px; }
.shader-property { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:6px; font-size:12px; }
.shader-property input { min-width:0; max-width:100%; width:105px; }
.shader-vector { display:flex; gap:5px; min-width:0; }
.shader-vector input { min-width:0; width:58px; }
.grow { flex:1; }
</style>
