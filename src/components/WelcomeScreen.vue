<script setup>
import { askConfirm } from '../core/dialogs.js'
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import * as db from '../core/db.js'
import * as disk from '../core/disk.js'
import { store, createProject, openFromFolder, openRecent, duplicateProject, removeProject, isProjectOpen, openLfprojDialog, importBundle, toast } from '../core/store.js'
import { pickFile } from '../engine/runtime/util.js'
import Icon from './Icon.vue'
import { TEMPLATES, DEFAULT_TEMPLATE } from '../core/templates/index.js'
import { RENDERERS, DEFAULT_RENDERER, rendererName } from '../engine/runtime/render/config.js'

const tab = ref('projects') // projects | templates
const list = ref([])
const loading = ref(true)
const sel = ref(null)
const filter = ref('')
const sort = ref('recent') // recent | name | created
const viewMode = ref('list') // grid | list
const collapsed = ref(false)
const createDialog = ref(null)
const adding = ref(null)
const creating = ref(false)
const busy = ref(false)
const hubNotice = ref(null)
const canDisk = disk.canDisk()
const fmt = (t) => new Date(t).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })
const ago = (t) => {
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return 'hace un momento'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  if (s < 86400 * 30) return `hace ${Math.floor(s / 86400)} d`
  return fmt(t)
}

function showHubError(title, detail, action = '') {
  hubNotice.value = { title, detail: String(detail || 'Comprueba el proyecto y vuelve a intentarlo.'), action }
}
async function refresh() {
  loading.value = true
  try {
    const all = await db.listProjects()
    for (const p of all) p.loc = disk.locName(await db.getLoc('proj:' + p.id))
    list.value = all
    if (!all.some((p) => p.id === sel.value)) sel.value = all[0]?.id ?? null
    return true
  } catch (error) {
    console.error('HUB · biblioteca de proyectos:', error)
    showHubError('No se pudo cargar la biblioteca', error?.message || 'Comprueba los permisos o el almacenamiento local.', 'refresh')
    return false
  } finally { loading.value = false }
}
onMounted(() => { void refresh(); window.addEventListener('keydown', onKey) })
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const shown = computed(() => {
  const f = filter.value.trim().toLowerCase()
  const out = list.value.filter((p) => !f || p.name.toLowerCase().includes(f) || (p.loc || '').toLowerCase().includes(f))
  if (sort.value === 'name') out.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  else if (sort.value === 'created') out.sort((a, b) => b.createdAt - a.createdAt)
  else out.sort((a, b) => b.updatedAt - a.updatedAt)
  return out
})
const current = computed(() => shown.value.find((p) => p.id === sel.value) || null)

async function guard(fn, { failure = 'No se pudo completar la operación', cancelOnFalse = false } = {}) {
  if (busy.value) return
  busy.value = true
  const known = new Set(store.toasts.map((t) => t.id))
  hubNotice.value = null
  try {
    const result = await fn()
    const error = store.toasts.findLast((t) => !known.has(t.id) && (t.kind === 'error' || t.kind === 'warn'))
    if (error) showHubError(failure, error.msg)
    else if (result === false && !cancelOnFalse && !hubNotice.value) showHubError(failure, 'No se completó la operación. Comprueba los datos y vuelve a intentarlo.')
    return result
  } catch (error) {
    console.error('HUB · operación fallida:', error)
    showHubError(failure, error?.message || String(error))
    return false
  } finally { busy.value = false }
}
const edit = (p = current.value) => p && guard(() => openRecent(p.id), { failure: 'No se pudo abrir el proyecto', cancelOnFalse: true })
const dup = () => current.value && guard(async () => { const ok = await duplicateProject(current.value.id); if (ok === false) return false; return await refresh() }, { failure: 'No se pudo duplicar el proyecto' })
const del = () => current.value && guard(async () => {
  const p = current.value
  if (isProjectOpen(p.id)) return toast('Primero cambia a otro proyecto antes de eliminar el que está abierto', 'warn')
  if (!(await askConfirm(`¿Quitar «${p.name}» de la lista y borrar sus datos del navegador?\n\nLa carpeta del proyecto en tu disco no se toca.`, { title: 'Quitar proyecto', ok: 'Quitar', danger: true }))) return
  if (await removeProject(p.id)) await refresh()
  else return false
}, { failure: 'No se pudo quitar el proyecto' })
const openFolder = () => guard(async () => {
  const loc = await disk.pickDirectory({ title: 'Elige la carpeta del proyecto (la que contiene project.lfproj)' })
  if (loc) return await openFromFolder(loc)
}, { failure: 'No se pudo abrir la carpeta' })
const importFile = () => guard(async () => {
  const [f] = await pickFile('.lfproj,.zip,.json')
  if (!f) return
  if (/\.json$/i.test(f.name)) return await importBundle(f)
  return await openLfprojDialog(f)
}, { failure: 'No se pudo importar el proyecto' })
const retryRefresh = () => guard(() => refresh(), { failure: 'No se pudo cargar la biblioteca' })

function onKey(e) {
  if (creating.value || tab.value !== 'projects' || e.target.closest?.('input, select, textarea, button, summary')) return
  const i = shown.value.findIndex((p) => p.id === sel.value)
  if (e.key === 'ArrowDown') { sel.value = shown.value[Math.min(shown.value.length - 1, i + 1)]?.id ?? sel.value; e.preventDefault() }
  else if (e.key === 'ArrowUp') { sel.value = shown.value[Math.max(0, i - 1)]?.id ?? sel.value; e.preventDefault() }
  else if (e.key === 'Enter') edit()
  else if (e.key === 'Delete') del()
}

// ---------- crear proyecto ----------
const name = ref('')
const template = ref(DEFAULT_TEMPLATE)
const renderer = ref(DEFAULT_RENDERER)
const parent = ref(null)
const parentName = computed(() => (parent.value ? disk.locName(parent.value) : ''))
const tpl = computed(() => TEMPLATES.find((t) => t.id === template.value) || TEMPLATES[0])
const featured = computed(() => TEMPLATES.filter((t) => t.category !== 'Legado'))
const legacy = computed(() => TEMPLATES.filter((t) => t.category === 'Legado'))
const rend = computed(() => RENDERERS.find((r) => r.id === renderer.value))
const nameErr = computed(() => (!name.value.trim() ? 'Escribe un nombre' : /[\\/:*?"<>|]/.test(name.value) ? 'El nombre no puede tener \\ / : * ? " < > |' : ''))
function openCreate(tplId) {
  if (tplId) template.value = tplId
  name.value = name.value || `Proyecto ${list.value.length + 1}`
  hubNotice.value = null
  createDialog.value.showModal()
  creating.value = true
}
function finishCreate() {
  creating.value = false
  hubNotice.value = null
}
function chooseAdd(action) {
  adding.value.open = false
  action()
}
async function pickParent() {
  const loc = await disk.pickDirectory({ title: 'Elige la carpeta donde se creará el proyecto' })
  if (loc) parent.value = loc
}
const create = () => guard(async () => {
  if (nameErr.value) return toast(nameErr.value, 'error')
  if (canDisk && !parent.value) await pickParent()
  if (canDisk && !parent.value) return
  await createProject(name.value, parent.value, template.value, { renderer: renderer.value })
}, { failure: 'No se pudo crear el proyecto' })
</script>

<template>
  <div class="hub" :class="{ collapsed }">
    <header class="titlebar">
      <button class="ghost icon" type="button" :aria-label="collapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'"
        :aria-expanded="!collapsed" @click="collapsed = !collapsed"><Icon name="panel-left" :size="15" /></button>
    </header>
    <div class="workspace">
      <aside class="rail">
        <div class="brand" title="Century Hub"><Icon name="box" :size="17" /><strong>Hub</strong></div>
        <nav aria-label="Navegación del Hub">
          <button class="rail-link" :class="{ on: tab === 'projects' }" :aria-current="tab === 'projects' ? 'page' : undefined"
            aria-label="Proyectos" title="Proyectos" @click="tab = 'projects'"><Icon name="folder" :size="15" /><span>Proyectos</span></button>
          <button class="rail-link" :class="{ on: tab === 'templates' }" :aria-current="tab === 'templates' ? 'page' : undefined"
            aria-label="Plantillas" title="Plantillas" @click="tab = 'templates'"><Icon name="grid" :size="15" /><span>Plantillas</span></button>
          <button class="rail-link settings-link" :class="{ on: tab === 'settings' }" :aria-current="tab === 'settings' ? 'page' : undefined"
            aria-label="Ajustes" title="Ajustes" @click="tab = 'settings'"><Icon name="sliders" :size="15" /><span>Ajustes</span></button>
        </nav>
        <div class="rail-footer"><span>Century</span></div>
      </aside>

      <main class="workspace-main">
        <section v-if="hubNotice && !creating" class="hub-notice" role="alert" aria-live="assertive" data-testid="hub-error">
          <div><strong>{{ hubNotice.title }}</strong><p>{{ hubNotice.detail }}</p></div>
          <button v-if="hubNotice.action === 'refresh'" type="button" :disabled="busy" @click="retryRefresh">Actualizar lista</button>
          <button type="button" class="ghost icon" aria-label="Descartar aviso" @click="hubNotice = null"><Icon name="x" :size="15" /></button>
        </section>

        <template v-if="tab === 'projects'">
          <header class="page-head project-head">
            <h1>Proyectos</h1>
            <div class="project-tools">
              <label class="search"><Icon name="search" :size="15" /><input v-model="filter" aria-label="Buscar proyectos" placeholder="Buscar" spellcheck="false" /></label>
              <details ref="adding" class="add-menu"
                @focusout="!$event.currentTarget.contains($event.relatedTarget) && ($event.currentTarget.open = false)"
                @keydown.escape.stop="adding.open = false; adding.querySelector('summary').focus()">
                <summary>Añadir <Icon name="chevron-down" :size="13" /></summary>
                <div class="add-options">
                  <button v-if="canDisk" :disabled="busy" @click="chooseAdd(openFolder)"><Icon name="folder-open" :size="15" />Abrir carpeta…</button>
                  <button :disabled="busy" @click="chooseAdd(importFile)"><Icon name="import" :size="15" />Importar proyecto…</button>
                </div>
              </details>
              <button class="primary" :disabled="busy" @click="openCreate()"><Icon name="plus" :size="15" />Nuevo proyecto</button>
            </div>
          </header>

          <div class="table-head project-columns" :class="{ 'grid-head': viewMode === 'grid' }">
            <template v-if="viewMode === 'list'">
              <span>Nombre</span><span class="date-column">Modificado</span><span class="renderer-column">Renderizador</span>
            </template>
            <button class="ghost icon" type="button" aria-label="Ajustes de la lista" title="Ajustes de la lista" @click="tab = 'settings'"><Icon name="sliders" :size="15" /></button>
          </div>
          <div class="list" :class="{ listview: viewMode === 'list', gridview: viewMode === 'grid' }" role="listbox" aria-label="Proyectos">
            <p v-if="loading" class="empty" role="status">Cargando…</p>
            <p v-else-if="!list.length" class="empty">Aún no hay proyectos</p>
            <p v-else-if="!shown.length" class="empty">No se encontraron proyectos</p>
            <div v-for="p in shown" :key="p.id" class="item project-columns" :class="{ on: sel === p.id }"
              role="option" :aria-selected="sel === p.id" tabindex="0" :aria-label="p.name + ', ' + rendererName(p.renderer)"
              @click="sel = p.id" @dblclick="edit(p)" @keydown.enter.stop="edit(p)" @keydown.space.prevent="sel = p.id">
              <div class="project-name">
                <div class="thumb" :style="viewMode === 'grid' && p.thumb ? { backgroundImage: `url(${p.thumb})` } : null">
                  <Icon v-if="viewMode === 'list' || !p.thumb" name="folder" :size="17" />
                </div>
                <div class="project-label"><b :title="p.name">{{ p.name }}</b><small :title="p.loc">{{ p.loc || 'Sin carpeta asociada' }}</small></div>
              </div>
              <span class="date-column" :title="fmt(p.updatedAt)">{{ ago(p.updatedAt) }}</span>
              <span class="renderer-column">{{ rendererName(p.renderer) }}</span>
            </div>
          </div>

          <footer v-if="current" class="project-footer">
            <div class="project-summary">
              <strong :title="current.name">{{ current.name }}</strong>
              <span>{{ current.scenes }} {{ current.scenes === 1 ? 'escena' : 'escenas' }} · {{ current.objects }} {{ current.objects === 1 ? 'nodo' : 'nodos' }}</span>
            </div>
            <div class="footer-actions">
              <button type="button" :disabled="busy" @click="dup"><Icon name="copy" :size="14" />Duplicar</button>
              <button type="button" class="danger" :disabled="busy || !current || isProjectOpen(current.id)" title="Quitar de recientes" @click="del"><Icon name="trash" :size="14" />Quitar</button>
              <button type="button" class="primary" :disabled="busy" @click="edit()"><Icon name="play" :size="14" />Abrir editor</button>
            </div>
          </footer>
        </template>

        <template v-else-if="tab === 'templates'">
          <header class="page-head"><h1>Plantillas</h1></header>
          <section class="template-area" aria-label="Catálogo de plantillas">
            <div class="template-grid" role="radiogroup" aria-label="Plantilla de proyecto">
              <button v-for="t in featured" :key="t.id" class="template-card" type="button" :class="{ selected: template === t.id }"
                role="radio" :aria-checked="template === t.id" @click="template = t.id">
                <Icon :name="t.game.player === 'none' ? 'box' : 'camera'" :size="19" />
                {{ t.name }}
                <Icon v-if="template === t.id" class="template-check" name="check" :size="15" />
              </button>
            </div>
            <details v-if="legacy.length" class="legacy-templates">
              <summary>Plantillas anteriores</summary>
              <div class="template-grid" role="radiogroup" aria-label="Plantillas anteriores">
                <button v-for="t in legacy" :key="t.id" type="button" class="template-card" :class="{ selected: template === t.id }"
                  role="radio" :aria-checked="template === t.id" @click="template = t.id">
                  <Icon name="box" :size="17" />{{ t.name }}
                  <Icon v-if="template === t.id" class="template-check" name="check" :size="15" />
                </button>
              </div>
            </details>
            <div class="template-detail">
              <h2>{{ tpl.name }}</h2><p>{{ tpl.description }}</p>
              <p>{{ tpl.scene.length }} objetos iniciales · {{ tpl.emptyDatabase ? 'Database sin jugador' : 'Database con jugador' }}</p>
              <button class="primary" :disabled="busy" @click="openCreate(tpl.id)"><Icon name="plus" :size="15" />Usar plantilla</button>
            </div>
          </section>
        </template>

        <template v-else>
          <header class="page-head"><h1>Ajustes</h1></header>
          <section class="view-settings" aria-label="Lista de proyectos">
            <label for="hub-sort">Ordenar proyectos por</label>
            <select id="hub-sort" v-model="sort"><option value="recent">Última edición</option><option value="name">Nombre</option><option value="created">Fecha de creación</option></select>
            <span>Presentación</span>
            <div class="view-switch" role="group" aria-label="Presentación de proyectos">
              <button type="button" :aria-pressed="viewMode === 'list'" @click="viewMode = 'list'"><Icon name="list" :size="15" />Lista</button>
              <button type="button" :aria-pressed="viewMode === 'grid'" @click="viewMode = 'grid'"><Icon name="grid" :size="15" />Cuadrícula</button>
            </div>
          </section>
        </template>
      </main>
    </div>

    <dialog ref="createDialog" class="create-dialog" aria-labelledby="hub-create-title" @close="finishCreate" @cancel="busy && $event.preventDefault()">
      <form class="project-settings" data-testid="hub-create" @submit.prevent="create">
        <header class="dialog-head">
          <h2 id="hub-create-title">Nuevo proyecto</h2>
          <button type="button" class="ghost icon" :disabled="busy" aria-label="Cerrar" @click="createDialog.close()"><Icon name="x" :size="16" /></button>
        </header>
        <div class="dialog-body">
          <div class="settings-field">
            <label for="hub-project-name">Nombre del proyecto</label>
            <input id="hub-project-name" v-model="name" spellcheck="false" placeholder="Mi proyecto" :aria-invalid="!!nameErr" autofocus />
            <small v-if="nameErr" class="err">{{ nameErr }}</small>
          </div>
          <div class="settings-field">
            <label for="hub-project-template">Plantilla</label>
            <select id="hub-project-template" v-model="template">
              <option v-for="t in featured" :key="t.id" :value="t.id">{{ t.name }}</option>
              <optgroup v-if="legacy.length" label="Plantillas anteriores">
                <option v-for="t in legacy" :key="t.id" :value="t.id">{{ t.name }}</option>
              </optgroup>
            </select>
            <small>{{ tpl.description }}</small>
          </div>
          <div v-if="canDisk" class="settings-field">
            <label for="hub-project-path">Ruta de guardado</label>
            <div class="path-field">
              <input id="hub-project-path" :value="parentName" :title="parentName" placeholder="Selecciona una carpeta" readonly />
              <button type="button" :disabled="busy" aria-label="Examinar carpetas" title="Examinar carpetas"
                @click="guard(() => pickParent(), { failure: 'No se pudo seleccionar la ubicación' })"><Icon name="folder-open" :size="16" /></button>
            </div>
          </div>
          <div class="settings-field">
            <label for="hub-project-renderer">Renderizador</label>
            <select id="hub-project-renderer" v-model="renderer">
              <option v-for="r in RENDERERS" :key="r.id" :value="r.id">{{ r.name }}</option>
            </select>
            <small>{{ rend?.desc }}</small>
          </div>
          <div v-if="creating && hubNotice" class="hub-notice" role="alert" data-testid="hub-error">
            <div><strong>{{ hubNotice.title }}</strong><p>{{ hubNotice.detail }}</p></div>
            <button type="button" class="ghost icon" aria-label="Descartar aviso" @click="hubNotice = null"><Icon name="x" :size="15" /></button>
          </div>
        </div>
        <footer class="dialog-footer">
          <button type="button" :disabled="busy" @click="createDialog.close()">Cancelar</button>
          <button type="submit" class="primary" :disabled="busy || !!nameErr">{{ busy ? 'Procesando…' : 'Crear' }}</button>
        </footer>
      </form>
    </dialog>
  </div>
</template>

<style scoped>
.hub {
  --row-alt: color-mix(in srgb, var(--g-850) 60%, var(--g-900));
  --titlebar: var(--editor-chrome);
  --row-select: var(--blue-wash);
  position: fixed; inset: 0; z-index: 2000; display: flex; flex-direction: column;
  color-scheme: var(--editor-color-scheme, dark); background: var(--g-900); color: var(--text);
  font: var(--editor-font-size, 12px)/1.35 var(--font);
}
.titlebar {
  display: flex; flex: none; align-items: center; justify-content: flex-end; gap: 6px;
  height: var(--bar-h); padding: 0 max(14px, calc(100% - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100%) + 14px)) 0 14px;
  background: var(--titlebar); border-bottom: 1px solid var(--hair);
  -webkit-app-region: drag;
}
.titlebar button { -webkit-app-region: no-drag; }
.workspace { display: flex; flex: 1; min-height: 0; }
.rail { width: 216px; flex: none; display: flex; flex-direction: column; background: var(--g-850); border-right: 1px solid var(--hair); }
.brand { display: flex; align-items: center; min-height: 48px; gap: 8px; padding: 0 16px; font-size: 19px; }
.rail nav { display: flex; flex: 1; flex-direction: column; gap: 6px; padding: 7px 8px 20px; }
.rail-link {
  justify-content: flex-start; gap: 9px; padding: 0 9px; border: 0;
  background: transparent; font-size: 12px; white-space: nowrap;
}
.rail-link.on { color: var(--text); background: var(--g-600); }
.settings-link { margin-top: auto; }
.rail-footer { min-height: 34px; display: flex; align-items: center; padding: 0 14px; border-top: 1px solid var(--hair); color: var(--text-2); font-weight: 600; }
.collapsed .rail { width: 52px; }
.collapsed :is(.brand, .rail-link) { justify-content: center; padding: 0; }
.collapsed :is(.brand strong, .rail-link span, .rail-footer) { display: none; }

.workspace-main { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.page-head { display: flex; align-items: center; min-height: 82px; gap: 16px; padding: 16px 29px; }
.page-head h1, .dialog-head h2 { margin: 0; font-size: 22px; font-weight: 600; line-height: 1.2; }
.project-head { justify-content: space-between; }
.project-tools { display: flex; align-items: center; gap: 8px; }
.search {
  width: clamp(110px, 19vw, 192px); height: var(--h); display: flex; align-items: center; gap: 7px;
  padding: 0 8px; background: var(--g-700); border: 1px solid var(--hair); border-radius: 5px; color: var(--text-3);
}
.search input { padding: 0; width: 100%; height: 100%; background: transparent; border: 0; outline: 0; }
.search input::placeholder { color: var(--text-3); }
.search:focus-within { border-color: var(--blue); }
.add-menu { position: relative; }
.add-menu summary {
  display: flex; align-items: center; gap: 8px; height: var(--h); padding: 0 9px;
  border: 1px solid var(--hair); border-radius: var(--r); list-style: none; cursor: pointer; white-space: nowrap;
}
.add-menu summary::-webkit-details-marker { display: none; }
.add-menu summary:hover, .add-menu[open] summary { background: var(--g-700); }
.add-options {
  position: absolute; top: calc(100% + 4px); right: 0; z-index: 2; padding: 4px; width: max-content;
  background: var(--g-900); border: 1px solid var(--hair); border-radius: 5px; box-shadow: 0 5px 15px #1114;
}
.add-options button { display: flex; width: 100%; justify-content: flex-start; border: 0; background: transparent; }
.add-options button:hover { background: var(--g-700); }
.hub button.primary:hover { background: var(--blue-hi); border-color: var(--blue-hi); }
.hub button.danger:hover { color: var(--danger); background: var(--g-700); border-color: var(--danger); }

.project-columns { display: grid; grid-template-columns: minmax(0, 1fr) minmax(96px, .44fr) minmax(100px, .39fr) 46px; align-items: center; }
.table-head { flex: none; min-height: 47px; background: var(--g-800); border-block: 1px solid var(--hair); padding: 0 16px 0 26px; font-weight: 600; }
.table-head > span { padding-left: 13px; line-height: 25px; }
.table-head > :is(.date-column, .renderer-column, button) { border-left: 1px solid var(--hair); }
.table-head > button { justify-self: stretch; width: auto; border-radius: 0; }
.grid-head > button { grid-column: -2 / -1; }
.list { flex: 1; min-height: 0; overflow: auto; }
.item { cursor: default; border-bottom: 1px solid var(--hair); }
.listview .item { min-height: 43px; padding: 3px 16px 3px 26px; }
.listview .item:nth-child(odd) { background: var(--row-alt); }
.list .item:hover { background: var(--g-700); }
.list .item.on { background: var(--row-select); }
.item:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; }
.item > :is(.date-column, .renderer-column) { padding-left: 13px; color: var(--text-2); }
.project-name { display: flex; align-items: center; gap: 10px; min-width: 0; padding-right: 10px; }
.thumb { flex: none; display: grid; place-items: center; width: 22px; height: 24px; color: var(--text-2); }
.project-label { display: grid; min-width: 0; }
.project-label > *, .project-summary strong { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.project-label small { color: var(--text-3); }
.empty { grid-column: 1 / -1; text-align: center; margin: 22px 8px; color: var(--text-3); }
.gridview { display: grid; align-content: start; grid-template-columns: repeat(auto-fill, minmax(min(100%, 170px), 1fr)); gap: 10px; padding: 15px; }
.gridview .item { display: flex; flex-direction: column; align-items: stretch; gap: 8px; padding: 9px; border: 1px solid var(--hair); border-radius: 5px; }
.gridview .project-name { display: grid; padding: 0; }
.gridview .thumb { width: 100%; height: auto; aspect-ratio: 16 / 8; background: var(--g-800) center/cover no-repeat; }
.gridview .item > :is(.date-column, .renderer-column) { padding: 0; }
.project-footer { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 16px; border-top: 1px solid var(--hair); }
.project-summary { min-width: 0; display: grid; color: var(--text-2); }
.project-summary strong { color: var(--text); }
.footer-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }

.template-area, .view-settings { padding: 0 29px 22px; overflow: auto; }
.template-grid { display: grid; gap: 4px; max-width: 500px; }
.template-card { justify-content: flex-start; gap: 10px; min-height: 39px; height: auto; padding: 7px 10px; background: var(--g-900); }
.template-card.selected { background: var(--row-select); border-color: var(--blue); }
.template-check { margin-left: auto; color: var(--blue-hi); }
.template-detail { margin-top: 20px; padding-top: 13px; border-top: 1px solid var(--hair); }
.template-detail h2 { margin: 0; font-size: 16px; }
.template-detail p { color: var(--text-2); }
.legacy-templates { margin-top: 10px; color: var(--text-2); }
.legacy-templates summary { cursor: pointer; padding: 5px 0; }
.view-settings { display: grid; grid-template-columns: max-content minmax(0, 220px); align-items: center; gap: 12px; }
.view-switch { display: flex; flex-wrap: wrap; gap: 5px; }
.view-switch button[aria-pressed="true"] { background: var(--row-select); border-color: var(--blue); }

.create-dialog {
  width: min(484px, calc(100% - 24px)); max-height: calc(100% - 24px); padding: 0;
  background: var(--g-900); color: var(--text); border: 1px solid var(--hair);
  border-radius: 8px; box-shadow: 0 6px 18px #1112; overflow: auto;
}
.create-dialog::backdrop { background: #121a232c; }
.dialog-head, .dialog-footer { display: flex; align-items: center; padding: 10px 22px; min-height: 53px; }
.dialog-head { justify-content: space-between; border-bottom: 1px solid var(--hair); }
.dialog-footer { justify-content: flex-end; gap: 8px; border-top: 1px solid var(--hair); }
.dialog-footer button { min-width: 76px; }
.dialog-body { display: grid; gap: 13px; padding: 15px 22px; }
.settings-field { display: grid; gap: 5px; }
.settings-field label { font-weight: 600; }
.settings-field :is(input, select) { width: 100%; min-height: 34px; }
.settings-field small { color: var(--text-2); }
.settings-field .err { color: var(--danger); }
.path-field { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; }
.path-field button { height: 34px; }

.hub-notice {
  display: flex; align-items: flex-start; gap: 8px; margin: 10px 15px 0; padding: 8px 10px;
  border: 1px solid var(--hair); border-left: 3px solid var(--danger); border-radius: 4px; background: var(--g-850);
}
.dialog-body .hub-notice { margin: 0; }
.hub-notice div { flex: 1; min-width: 0; }
.hub-notice strong { color: var(--danger); }
.hub-notice p { margin: 3px 0 0; overflow-wrap: anywhere; }

@media (max-width:1000px) {
  .rail { width: 180px; }
}
@media (max-width:760px) {
  .rail { width: 52px; }
  :is(.brand, .rail-link) { justify-content: center; padding: 0; }
  :is(.brand strong, .rail-link span, .rail-footer, .titlebar button:first-child) { display: none; }
  .page-head { min-height: 68px; padding: 12px 15px; }
  .project-head { flex-wrap: wrap; gap: 10px; }
  .template-area, .view-settings { padding-inline: 15px; }
  .project-columns { grid-template-columns: minmax(0, 1fr) minmax(92px, .45fr) 34px; }
  .project-columns .renderer-column { display: none; }
  .listview .item, .table-head { padding-inline: 12px; }
}
@media (max-width:480px) {
  .project-tools { width: 100%; flex-wrap: wrap; }
  .project-tools .search { width: auto; flex: 1 0 100%; }
  .project-columns { grid-template-columns: minmax(0, 1fr) 34px; }
  .project-columns .date-column { display: none; }
  .project-footer { align-items: stretch; flex-direction: column; }
  .view-settings { grid-template-columns: minmax(0, 1fr); }
  .hub-notice { flex-wrap: wrap; }
}
@media (prefers-reduced-motion: reduce) {
  .hub button { transition: none; }
}
</style>
