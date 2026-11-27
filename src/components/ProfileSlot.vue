<script setup>
// Slot «Perfil» de un Spawn o una Cámara (como el campo Profile de un Volume de Unity): elegir un recurso .post o .profile, crear uno
// nuevo (con los valores del render actual) o abrir el elegido.
import { computed } from 'vue'
import ResourceDropSlot from './ResourceDropSlot.vue'
import { profileStem } from '../engine/runtime/render/profiles.js'
import { store, updateObject, createProfile, openProfileEditor, toast } from '../core/store.js'

const props = defineProps({ obj: { type: Object, required: true }, label: { type: String, default: 'Perfil' } })
const list = computed(() => store.project.profiles || [])
const cur = computed(() => list.value.find((p) => p.id === props.obj.props?.profile) || null)
const acceptedIds = computed(() => list.value.map((p) => p.id))
const set = (id) => updateObject(props.obj.id, { props: { profile: id || '' } })
function make() { const d = createProfile('Assets/Profiles', (props.obj.name || 'Cámara') + '.post'); set(d.id); openProfileEditor(d.id) }
</script>

<template>
  <div class="pslot">
    <div class="field"><label>{{ label }}</label>
      <ResourceDropSlot :kinds="['profile']" :accepted-ids="acceptedIds"
        @assign="set" @reject="toast('Suelta un único perfil .post válido de Assets', 'error')">
        <select :value="obj.props?.profile || ''" data-testid="profile-slot" @change="set($event.target.value)">
          <option value="">— Render del proyecto —</option>
          <option v-for="p in list" :key="p.id" :value="p.id">{{ profileStem(p.name) }}</option>
          <option v-if="obj.props?.profile && !cur" :value="obj.props.profile">(no existe)</option>
        </select>
      </ResourceDropSlot>
      <slot name="property-key" />
    </div>
    <div class="btns"><button :disabled="!cur" @click="openProfileEditor(cur.id)">Editar…</button><button data-testid="profile-new" @click="make">Nuevo…</button></div>
  </div>
</template>

<style scoped>
.btns { display: flex; gap: 6px; justify-content: flex-end; margin-top: 4px; }
</style>
