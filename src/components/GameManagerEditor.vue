<script setup>
// El GameManager se edita en el Inspector y conserva sus referencias originales por ID.
import { computed } from 'vue'
import { store, touchGameManager, createProfile, openProfileEditor, renameEntry } from '../core/store.js'
import { playerTypes } from '../engine/runtime/player/index.js'
const props = defineProps({ managerId: { type: String, required: true } })
const gm = computed(() => store.project?.gameManagers?.find((g) => g.id === props.managerId))
const profiles = computed(() => store.project?.profiles || [])
const cameras = computed(() => (store.project?.objects || []).filter((o) => o.type === 'camera'))
const patch = (key, value) => { if (gm.value) touchGameManager(gm.value.id, { [key]: value }) }
const changeName = (name) => { if (gm.value) renameEntry('gamemanager', gm.value.id, name.trim() || gm.value.name) }
const addPost = () => { const pr = createProfile(); patch('profile', pr.id); openProfileEditor(pr.id) }
const editPost = () => { if (gm.value?.profile) openProfileEditor(gm.value.profile) }
</script>
<template>
  <div v-if="gm" class="gm-form" data-testid="gamemanager-inspector">
    <div class="gm-heading"><strong>GameManager</strong><small>{{ gm.folder }}/{{ gm.name }}</small></div>
    <label for="gm-resource-name">Nombre del recurso</label>
    <input id="gm-resource-name" :value="gm.name" @change="changeName($event.target.value)" />
    <p class="hint">Recurso compartido. Las escenas que lo utilizan tendrán esta configuración al jugar. No crea objetos ni añade un Player a la Database.</p>
    <label for="gm-player">Tipo de Player</label>
    <select id="gm-player" :value="gm.player === 'fps' ? 'native' : gm.player" @change="patch('player', $event.target.value)">
      <option value="inherit">Heredar del proyecto</option>
      <option v-for="t in playerTypes()" :key="t.id" :value="t.id">{{ t.label }}</option>
    </select>
    <label for="gm-camera">Cámara inicial</label>
    <select id="gm-camera" :value="gm.camera" @change="patch('camera', $event.target.value)">
      <option value="">Automática (Cámara principal o Player)</option>
      <option v-for="o in cameras" :key="o.id" :value="o.id">{{ o.name }}</option>
    </select>
    <p class="hint">La cámara debe existir en cada escena que use este recurso; de lo contrario se usa la Cámara principal habitual.</p>
    <label for="gm-post">Perfil de post-proceso predeterminado</label>
    <select id="gm-post" :value="gm.profile" @change="patch('profile', $event.target.value)">
      <option value="">Render del proyecto</option>
      <option v-for="p in profiles" :key="p.id" :value="p.id">{{ p.name }}</option>
    </select>
    <div class="actions"><button type="button" :disabled="!gm.profile" @click="editPost">Editar perfil…</button><button type="button" @click="addPost">Nuevo .post…</button></div>
    <p class="hint">El perfil de Camera3D tiene prioridad; los marcadores Spawn antiguos conservan su perfil cuando se usan como destino.</p>
  </div>
</template>
<style scoped>
.gm-form { display:flex; flex-direction:column; gap:10px; padding:12px 10px; min-width:0; }
.gm-heading { display:flex; flex-direction:column; min-width:0; gap:3px; }
.gm-heading strong { font-size:13px; }
.gm-heading small { font-size:11px; color:var(--text-3); overflow-wrap:anywhere; }
.gm-form select,.gm-form input { min-width:0; width:100%; }
.gm-form label { font-size:12px; font-weight:600; }
.gm-form .actions { display:flex; flex-wrap:wrap; gap:8px; }
.gm-form .hint { margin:3px 0; font-size:12px; opacity:.72; line-height:1.5; }
</style>
