<script setup>
import { askConfirm } from '../core/dialogs.js'
import AppWindow from './AppWindow.vue'
import { ref, onMounted } from 'vue'
import * as db from '../core/db.js'
import * as disk from '../core/disk.js'
import { store, createProject, openRecent, openFromFolder, duplicateProject, removeProject, isProjectOpen, importBundle, saveLfproj, openLfprojDialog, toast } from '../core/store.js'
import { pickFile } from '../engine/runtime/util.js'

const list = ref([])
const name = ref('')
const loading = ref(true)

async function refresh() {
  list.value = await db.listProjects()
  loading.value = false
}
onMounted(refresh)

const fmt = (t) => new Date(t).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })

async function create() {
  try {
    let parent = null
    if (disk.canDisk()) {
      parent = await disk.pickDirectory({ title: 'Elige la carpeta donde se creará el proyecto' })
      if (!parent) return
    }
    await createProject(name.value.trim() || `Proyecto ${list.value.length + 1}`, parent)
    store.modal = null
  } catch (e) { toast(e.message, 'error', 5000) }
}
async function open(p) {
  if (await openRecent(p.id)) store.modal = null
}
async function openFolder() {
  try {
    const loc = await disk.pickDirectory({ title: 'Elige la carpeta del proyecto (la que contiene project.lfproj)' })
    if (loc && (await openFromFolder(loc))) store.modal = null
  } catch (e) { toast(e.message, 'error', 5000) }
}
async function dup(p) { await duplicateProject(p.id); await refresh() }
async function del(p) {
  if (isProjectOpen(p.id)) return toast('Primero cambia a otro proyecto antes de eliminar el que está abierto', 'warn')
  if (!(await askConfirm(`¿Eliminar «${p.name}» con todas sus escenas? Esta acción no se puede deshacer.`, { title: 'Eliminar proyecto', ok: 'Eliminar', danger: true }))) return
  if (await removeProject(p.id)) await refresh()
}
async function importFile() {
  const [f] = await pickFile('.lfproj,.zip,.json')
  if (!f) return
  try {
    if (/\.json$/i.test(f.name)) await importBundle(f)
    else if (!(await openLfprojDialog(f))) return
    store.modal = null
  } catch (e) { toast('Importación fallida: ' + e.message, 'error', 5000) }
}
</script>

<template>
  <AppWindow title="Proyectos" subtitle="cada proyecto reúne varias escenas y sus archivos" :width="760" :height="560" :min-width="340" :min-height="300" persist="projects" @close="store.modal = null">
      <div class="body" style="padding: 16px 18px">
        <div class="create">
          <input v-model="name" placeholder="Nombre del nuevo proyecto…" @keydown.enter="create" />
          <button class="primary" @click="create">Crear proyecto…</button>
          <button v-if="disk.canDisk()" @click="openFolder">Abrir carpeta…</button>
          <button data-tooltip="Abrir un archivo .lfproj (o una copia antigua .levelforge.json)" @click="importFile">Abrir archivo…</button>
          <button v-if="store.project" data-tooltip="Descargar una copia del proyecto como .lfproj" @click="saveLfproj">Descargar copia</button>
        </div>

        <div v-if="!loading && !list.length" class="dim empty">Aún no hay proyectos guardados.</div>
        <div class="grid">
          <div v-for="p in list" :key="p.id" class="card" :class="{ cur: store.project?.id === p.id }" @dblclick="open(p)">
            <div class="thumb" :style="p.thumb ? { backgroundImage: `url(${p.thumb})` } : null">
              <span v-if="!p.thumb" class="dim">sin vista previa</span>
              <span v-if="store.project?.id === p.id" class="badge">Abierto</span>
            </div>
            <div class="meta">
              <b>{{ p.name }}</b>
              <small class="dim">{{ p.scenes }} escena(s) · {{ p.objects }} nodos · {{ fmt(p.updatedAt) }}</small>
            </div>
            <div class="btns">
              <button class="primary" @click="open(p)">Abrir</button>
              <button data-tooltip="Duplicar" @click="dup(p)">⎘</button>
              <button class="danger" :disabled="isProjectOpen(p.id)" :data-tooltip="isProjectOpen(p.id) ? 'Primero cambia a otro proyecto' : 'Eliminar'" :aria-label="isProjectOpen(p.id) ? 'No se puede eliminar el proyecto abierto' : 'Eliminar proyecto'" @click="del(p)">🗑</button>
            </div>
            <small v-if="isProjectOpen(p.id)" class="dim safe-hint">Cambia de proyecto para poder eliminarlo.</small>
          </div>
        </div>
      </div>
    <template #footer><span style="flex:1"></span><button class="primary" @click="store.modal = null">Cerrar</button></template>
  </AppWindow>
</template>

<style scoped>
.create { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.create input { flex: 1; min-width: 160px; padding: 7px 9px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr)); gap: 12px; }
.card { background: var(--g-800); border: 1px solid var(--hair); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; }
.card.cur { border-color: var(--blue); }
.thumb { height: 108px; background: #0e1014 center/cover no-repeat; display: flex; align-items: center; justify-content: center; position: relative; font-size: 11px; }
.badge { position: absolute; top: 6px; left: 6px; background: var(--blue); color: #fff; font-size: 10px; padding: 2px 7px; border-radius: 10px; }
.meta { padding: 8px 10px 2px; display: flex; flex-direction: column; gap: 2px; min-height: 46px; }
.meta b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.btns { display: flex; gap: 6px; padding: 8px 10px 10px; }
.btns .primary { flex: 1; }
.empty { text-align: center; padding: 30px; }
.safe-hint { padding: 0 10px 10px; font-size: 10px; }
</style>
