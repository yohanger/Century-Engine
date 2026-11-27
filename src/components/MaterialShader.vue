<script setup>
// Shader del material de un objeto: elección de shader, mapeo de texturas y propiedades declaradas por el shader (formulario generado).
import { computed } from 'vue'
import { store, updateObject, openShaderEditor } from '../core/store.js'
import { findShader, infoOf } from '../engine/runtime/render/pbr.js'
import { DEFAULT_SHADER_ID } from '../engine/runtime/render/shaderlib.js'
import { shaderOptions } from '../core/templates/renderParams.js'
import ParamForm from './ParamForm.vue'
import ResourceDropSlot from './ResourceDropSlot.vue'

const props = defineProps({ obj: { type: Object, required: true }, edit: { type: Function, default: null } })
const patchMaterial = (patch, label) => props.edit ? props.edit(patch, label) : updateObject(props.obj.id, patch, { label })
const mat = computed(() => props.obj.mat || {})
const options = computed(() => shaderOptions(store.project.shaders, true))
const effectiveId = computed(() => mat.value.shader || store.project.render?.shader || DEFAULT_SHADER_ID)
const doc = computed(() => findShader(effectiveId.value, store.project.shaders))
const classic = computed(() => store.project.render?.look === 'clasico' && !mat.value.shader)
const info = computed(() => (doc.value ? infoOf(doc.value.code) : { params: [], description: '' }))
const detailParams = new Set(['uNormal','uNormalStrength','uMicro','uMicroScale','uHeight','uBumpStrength'])
const params = computed(() => info.value.params.filter((p) => !(doc.value?.id === 'builtin:realista' && detailParams.has(p.key))).map((p) => ({ key: p.key, label: p.label, type: p.type, hint: p.hint, min: p.min, max: p.max, step: p.step })))
const values = computed(() => {
  const v = {}
  for (const p of info.value.params) v[p.key] = mat.value.params?.[p.key] ?? (p.type === 'color' ? p.defHex : p.def)
  return v
})
const projectDoc = computed(() => store.project.shaders.find((s) => s.id === mat.value.shader))
const materialShaderIds = computed(() => (store.project.shaders || []).filter(s => s.graph?.target !== 'post').map(s => s.id))
const setShader = (id) => patchMaterial({ mat: { ...mat.value, shader: id, params: {} } }, 'Cambiar shader')
const setMapping = (m) => patchMaterial({ mat: { ...mat.value, mapping: m } }, 'Mapeo de texturas')
function change(key) {
  patchMaterial({ mat: { ...mat.value, params: { ...(mat.value.params || {}), [key]: values.value[key] } } }, 'Propiedad del shader')
}
// ParamForm modifica `values` en sitio; usamos un objeto proxy que escribe directamente en el material del objeto
const proxy = computed(() => new Proxy({}, {
  get: (_, k) => values.value[k],
  set: (_, k, v) => { patchMaterial({ mat: { ...mat.value, params: { ...(mat.value.params || {}), [k]: v } } }, 'Propiedad del shader'); return true },
}))
void change
</script>

<template>
  <div class="ms">
    <div class="field"><label>Shader</label>
      <ResourceDropSlot :kinds="['shader']" :accepted-ids="materialShaderIds" @assign="setShader">
        <select :value="mat.shader || ''" @change="setShader($event.target.value)">
          <option value="">Heredar de Render</option>
          <option v-for="o in options.filter(x => x[0] && (x[0].startsWith('builtin:') || store.project.shaders.some(s => s.id === x[0] && s.graph?.target !== 'post')))" :key="o[0]" :value="o[0]">{{ o[1] }}</option>
        </select>
      </ResourceDropSlot>
    </div>
    <p v-if="classic" class="hint">El aspecto del proyecto es «Clásico»: este objeto usa un material estándar sin shader.</p>
    <template v-else>
      <div class="field"><label>Mapeo</label>
        <select :value="mat.mapping === 'object' ? 'object' : 'world'" @change="setMapping($event.target.value)">
          <option value="world">Mundo (continuo entre objetos)</option>
          <option value="object">Objeto (se mueve con él)</option>
        </select>
      </div>
      <ParamForm v-if="params.length" :params="params" :values="proxy" />
      <p v-if="info.description" class="hint">{{ info.description }}</p>
      <button v-if="projectDoc" class="mini" @click="openShaderEditor(projectDoc.id)">Editar shader…</button>
    </template>
  </div>
</template>

<style scoped>
.ms { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; padding-top: 8px; border-top: 1px solid var(--g-600); }
.field { display: flex; align-items: center; gap: 8px; }
.field label { flex: 0 0 78px; color: var(--text-2); font-size: 12px; }
.field select { flex: 1; min-width: 0; }
.hint { margin: 0; font-size: 11px; color: var(--text-2); }
.mini { align-self: flex-start; }
</style>
