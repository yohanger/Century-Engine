<script setup>
import { dockPanelIsActive } from '../core/editor/docking.js'

// Git integrado: panel de control local, sin comandos de terminal accesibles al renderer.
import { ref, computed, watch, onMounted } from 'vue'
import { store, saveAll, toast, suspendVcsProjectSync, resumeVcsProjectSync, reloadVcsProjectFromDisk } from '../core/store.js'
import { projLoc } from '../core/state/project.js'
import Icon from './Icon.vue'

const api = () => window.lf?.vcs
const root = computed(() => {
  // Las rutas son variables de módulo, pero el estado del disco sí es reactivo.
  const diskName = store.disk.name
  return diskName && projLoc?.kind === 'path' ? projLoc.path : null
})
const connected = computed(() => !!api() && !!root.value)
const busy = ref(false), error = ref(''), loading = ref(false)
const health = ref(null), status = ref(null), commits = ref([])
const selected = ref([]), author = ref(''), email = ref(''), message = ref('')
const activeView = ref('changes')
const branches = ref([]), newBranchName = ref(''), chosenBranch = ref('')
const restorePlan = ref(null), confirmRestore = ref(false), lastBackup = ref(null), restoreBusy = ref(false)
// S02: inspección estrictamente de lectura. No hay checkout, reset ni restauración.
const selectedCommit = ref(''), inspected = ref(null), historyMore = ref(false)
const compareBase = ref(''), compareTarget = ref('WORKTREE')
const comparison = ref(null), selectedDiff = ref(''), diffResult = ref(null)
const historyBusy = ref(false), historyError = ref('')
const remote = ref(null), credential = ref(null), remoteUrl = ref(''), remoteToken = ref('')
const replaceRemote = ref(false), remoteBusy = ref(false), pullPlan = ref(null), confirmPull = ref(false)
const cloneUrl = ref(''), cloneToken = ref('')
async function refreshRemote() {
  if (!connected.value || !health.value?.repository) return
  try {
    const [r,c] = await Promise.all([api().execute('remoteStatus',root.value),api().execute('credentialStatus',root.value)])
    remote.value=r;credential.value=c
    if(r.url && !remoteUrl.value) remoteUrl.value=r.url
  } catch(e) { error.value=e.message || String(e) }
}
async function remoteTask(task, notification) {
  if (remoteBusy.value || !connected.value) return
  remoteBusy.value=true;error.value=''
  try {
    await task()
    remoteToken.value=''
    if(notification) toast(notification,'ok')
  } catch(e) {error.value=e.message || String(e)}
  finally {remoteToken.value='';remoteBusy.value=false; await load()}
}
function configureOrigin() {
  return remoteTask(async()=>{await api().execute('setRemote',root.value,{url:remoteUrl.value.trim(),replace:replaceRemote.value});replaceRemote.value=false},'Remoto origin actualizado')
}
function fetchOrigin() {return remoteTask(()=>api().execute('fetchRemote',root.value,{token:remoteToken.value}),'Referencias remotas consultadas')}
function pushOrigin() {return remoteTask(()=>api().execute('pushRemote',root.value,{token:remoteToken.value}),'Commits enviados')}
function storeCredential() {return remoteTask(()=>api().execute('saveCredential',root.value,{token:remoteToken.value}),'Token protegido en este dispositivo')}
function forgetCredential() {return remoteTask(()=>api().execute('forgetCredential',root.value),'Credencial local eliminada')}
function previewPull() {
  return remoteTask(async()=>{
    if (!canChange.value) throw new Error('Guarda y registra todos los cambios antes de ejecutar Pull')
    pullPlan.value=await api().execute('preparePull',root.value,{token:remoteToken.value})
    confirmPull.value=false
  })
}
async function applyPull() {
  if (!pullPlan.value || !confirmPull.value || remoteBusy.value || !canChange.value) return
  const sourceRoot=root.value
  remoteBusy.value=true;error.value=''
  try {
    await suspendVcsProjectSync(sourceRoot)
    const result=await api().execute('applyPull',sourceRoot,{token:pullPlan.value.token})
    lastBackup.value=result.backup
    try {await reloadVcsProjectFromDisk(sourceRoot)}
    catch(err) {
      await api().execute('recoverChange',sourceRoot,{id:result.backup.id})
      await reloadVcsProjectFromDisk(sourceRoot)
      throw new Error('La recarga falló; se restauró la versión anterior: '+err.message)
    }
    pullPlan.value=null;confirmPull.value=false
    toast('Pull aplicado y proyecto recargado','ok')
  } catch(e) {error.value=e.message || String(e);try{await resumeVcsProjectSync(sourceRoot)}catch{}}
  finally {remoteBusy.value=false;await load()}
}
async function cloneRemote() {
  if (!api() || remoteBusy.value) return
  remoteBusy.value=true;error.value=''
  try {
    const target=await window.lf.fs.pickDir({title:'Seleccionar carpeta VACÍA para clonar el proyecto'})
    if (!target) return
    await api().execute('cloneRemote',target,{url:cloneUrl.value.trim(),token:cloneToken.value})
    toast('Repositorio clonado. Abre el proyecto desde Archivo > Abrir.','ok')
    cloneToken.value=''
  } catch(e) {error.value=e.message || String(e)}
  finally {cloneToken.value='';remoteBusy.value=false}
}

const comparisonFiles = computed(() => comparison.value?.files || [])
const diffLines = computed(() => (diffResult.value?.text || '').split('\n').slice(0,1600).map((line,i) => ({
  id:i, text:line, kind: line.startsWith('+') && !line.startsWith('+++')?'add':line.startsWith('-') && !line.startsWith('---')?'remove':line.startsWith('@@')?'hunk':line.startsWith('diff ')?'file':'context'
})))
const hashLabel = hash => hash === 'WORKTREE'?'Carpeta actual':String(hash || '').slice(0,8)
async function loadMoreHistory() {
  if (!connected.value || historyBusy.value || loading.value || !historyMore.value) return
  historyBusy.value = true; historyError.value = ''
  try {
    const page = await api().execute('log',root.value,{offset:commits.value.length,limit:40})
    const seen = new Set(commits.value.map(c=>c.hash))
    commits.value = [...commits.value, ...page.filter(c=>!seen.has(c.hash))]
    historyMore.value = page.length === 40
  } catch(e) { historyError.value=e.message || String(e) }
  finally { historyBusy.value=false }
}
async function inspectCommit(hash) {
  if (!hash || !connected.value) return
  selectedCommit.value = hash; historyError.value = ''; inspected.value = null
  historyBusy.value = true
  try { inspected.value = await api().execute('detail',root.value,{hash}) }
  catch(e) { historyError.value = e.message || String(e) }
  finally { historyBusy.value = false }
}
async function compararRevisiones() {
  if (!compareBase.value || !compareTarget.value || !connected.value) return
  historyError.value = ''; historyBusy.value = true; comparison.value = null; diffResult.value = null; selectedDiff.value = ''
  try { comparison.value = await api().execute('compare',root.value,{base:compareBase.value,target:compareTarget.value}) }
  catch(e) { historyError.value = e.message || String(e) }
  finally { historyBusy.value = false }
}
async function openDiff(file) {
  if (!comparison.value || !file || !connected.value) return
  historyError.value = ''; selectedDiff.value = file.path; diffResult.value = null; historyBusy.value = true
  try { diffResult.value = await api().execute('diff',root.value,{base:comparison.value.base,target:comparison.value.target,path:file.path}) }
  catch(e) { historyError.value = e.message || String(e) }
  finally { historyBusy.value = false }
}
function chooseRevision(hash, side) {
  if (side === 'base') compareBase.value = hash
  else compareTarget.value = hash
  comparison.value = null; selectedDiff.value = ''; diffResult.value = null
}

// Perfil de autor local al editor; nunca se transmite a una cuenta o servidor.
try { const v = JSON.parse(localStorage.getItem('lf:vcs:identity') || '{}'); author.value = String(v.name||''); email.value = String(v.email||'') } catch { /* sin preferencias anteriores */ }
watch([author,email], ([name,mail]) => { try { localStorage.setItem('lf:vcs:identity',JSON.stringify({name,email:mail})) } catch { /* almacenamiento deshabilitado */ } })
const list = computed(() => status.value?.files || [])
const selectedCount = computed(() => selected.value.length)
const stagedCount = computed(() => list.value.filter(f => ![' ', '?'].includes(f.index)).length)
const changedCount = computed(() => list.value.length)
const stateLabel = computed(() => !connected.value ? 'SIN CARPETA' : !health.value?.repository ? 'SIN REPOSITORIO' : !changedCount.value ? 'LIMPIO' : 'CAMBIOS PENDIENTES')

async function load() {
  if (!connected.value || busy.value) return
  loading.value = true; error.value = ''
  try {
    const r = root.value
    health.value = await api().execute('health',r)
    if (health.value.repository) {
      const [s, h, b] = await Promise.all([api().execute('status',r),api().execute('log',r),api().execute('branches',r)])
      branches.value = b
      if (!b.some(x=>x.name===chosenBranch.value)) chosenBranch.value=b.find(x=>!x.current)?.name || ''
      status.value = s; commits.value = h
      const hashes = new Set(h.map(c=>c.hash))
      if (!hashes.has(compareBase.value)) compareBase.value = h[0]?.hash || ''
      historyMore.value = h.length === 40
      if (compareTarget.value !== 'WORKTREE' && !hashes.has(compareTarget.value)) compareTarget.value = 'WORKTREE'
      if (selectedCommit.value && !hashes.has(selectedCommit.value)) { selectedCommit.value = ''; inspected.value = null }
      selected.value = selected.value.filter(p => s.files.some(f=>f.path===p))
      await refreshRemote()
    } else { status.value = null; commits.value = []; branches.value=[]; remote.value=null;credential.value=null; selected.value = []; comparison.value = null; inspected.value = null }
  } catch(e) { error.value = e.message || String(e) }
  finally { loading.value = false }
}
async function init() {
  if (!connected.value || busy.value) return
  busy.value = true; error.value = ''
  try {
    if (!(await saveAll())) throw new Error('Guarda el proyecto antes de inicializar Git')
    await api().execute('init',root.value)
    toast('Repositorio Git inicializado','ok')
  } catch(e) { error.value = e.message || String(e) }
  finally { busy.value = false; await load() }
}
async function createCommit() {
  if (!selectedCount.value || busy.value) return
  busy.value = true; error.value = ''
  try {
    if (!(await saveAll())) throw new Error('No se pudo guardar el proyecto. No se creará el commit.')
    // Tras guardar se revalida la selección; los archivos ya no existentes no se añaden.
    const s = await api().execute('status',root.value)
    const valid = selected.value.filter(p=>s.files.some(f=>f.path===p))
    if (!valid.length) throw new Error('Los cambios seleccionados ya no están disponibles')
    const result = await api().execute('commit',root.value,{ name:author.value, email:email.value, message:message.value, paths:valid })
    toast(`Commit creado: ${result.hash}`,'ok'); message.value = ''; selected.value = []
  } catch(e) { error.value = e.message || String(e) }
  finally { busy.value = false; await load() }
}
// Una operación destructiva exige selección explícita, revisión previa y confirmación.
const canChange = computed(() => connected.value && !busy.value && !restoreBusy.value && !store.unsavedChanges && store.saveState==='saved' && store.disk.state==='saved' && !changedCount.value)
async function createBranch() {
  if (!connected.value || busy.value) return
  busy.value=true;error.value=''
  try {
    await api().execute('createBranch',root.value,{name:newBranchName.value.trim()})
    toast('Rama creada','ok');newBranchName.value=''
  } catch(e) {error.value=e.message||String(e)}
  finally {busy.value=false;await load()}
}
async function previewRecovery(kind, details={}) {
  error.value='';restorePlan.value=null;confirmRestore.value=false
  if (!canChange.value) {error.value='Guarda y registra todos los cambios antes de cambiar o recuperar revisiones.';return}
  restoreBusy.value=true
  try {restorePlan.value=await api().execute('prepareChange',root.value,{kind,...details})}
  catch(e){error.value=e.message||String(e)}
  finally{restoreBusy.value=false}
}
async function applyRecovery() {
  if (!restorePlan.value || !confirmRestore.value || !canChange.value) return
  const sourceRoot=root.value
  restoreBusy.value=true;error.value=''
  try {
    // Congelar el sincronizador de scripts: de lo contrario puede sobrescribir el checkout.
    await suspendVcsProjectSync(sourceRoot)
    // Esta acción no llama saveAll(): guardar aquí sobrescribiría el árbol limpio de Git.
    const result=await api().execute('applyChange',sourceRoot,{token:restorePlan.value.token})
    lastBackup.value=result.backup
    try { await reloadVcsProjectFromDisk(sourceRoot) }
    catch(err) {
      try {
        await api().execute('recoverChange',sourceRoot,{id:result.backup.id})
        await reloadVcsProjectFromDisk(sourceRoot)
        throw new Error('No se pudo recargar la revisión. Se recuperó el respaldo anterior: '+err.message)
      } catch(recoverError) {
        throw new Error('Falló la recarga. Conserva este respaldo: '+result.backup.location+' · '+recoverError.message)
      }
    }
    toast('Versión aplicada y proyecto recargado','ok')
    restorePlan.value=null;confirmRestore.value=false
  } catch(e) {error.value=e.message||String(e); try { await resumeVcsProjectSync(sourceRoot) } catch (resumeError) {error.value += ' · Sincronización: '+resumeError.message}}
  finally {restoreBusy.value=false;await load()}
}
function toggle(p) { selected.value = selected.value.includes(p) ? selected.value.filter(x=>x!==p) : [...selected.value,p] }
function all(on) { selected.value = on ? list.value.map(f=>f.path) : [] }
watch(() => [store.project?.id, root.value], () => { restorePlan.value=null;pullPlan.value=null;remote.value=null;remoteUrl.value='';credential.value=null; status.value = null; health.value = null; selected.value = []; comparison.value = null; inspected.value = null; selectedCommit.value = ''; load() })
watch(() => store.ui.mode === 'desktop' ? dockPanelIsActive(store.prefs.dockLayout, store.prefs, 'vcs') : store.prefs.bottomTab === 'vcs', (visible) => { if (visible) load() })
onMounted(load)
</script>

<template>
  <section class="vcs-shell" aria-label="Control de versiones Git">
    <header class="vcs-toolbar">
      <div class="vcs-heading"><Icon name="git-branch" :size="16" /><span>CONTROL DE VERSIONES</span><span class="vcs-divider"></span><span class="vcs-branch" v-if="status"><Icon name="git-branch" :size="13" />{{ status.branch }}</span></div>
      <span class="vcs-state" :class="{'is-clean':connected && health?.repository && !changedCount}"><span class="vcs-status-dot"></span>{{stateLabel}}</span>
      <button type="button" class="vcs-icon-btn" :disabled="busy || loading || !connected" title="Actualizar estado Git" aria-label="Actualizar" @click="load"><Icon name="rotate" :size="14" /></button>
    </header>
    <div v-if="!api()" class="vcs-empty"><Icon name="lock" :size="27" /><strong>Git disponible en la aplicación de escritorio</strong><p>El navegador no puede ejecutar el Git embebido. Abre Century con Electron.</p></div>
    <div v-else-if="!root" class="vcs-empty"><Icon name="folder" :size="27" /><strong>Abre un proyecto o clona uno nuevo</strong><p>Para usar Git local guarda el proyecto en una carpeta. Para clonar, selecciona una carpeta vacía y abre después el proyecto desde Archivo.</p><div class="vcs-clone-form"><input v-model.trim="cloneUrl" placeholder="https://servidor/grupo/proyecto.git" aria-label="URL para clonar"/><input v-model="cloneToken" type="password" autocomplete="off" placeholder="Token temporal (opcional)" aria-label="Token temporal para clonar"/><button class="vcs-primary" :disabled="remoteBusy || !cloneUrl" @click="cloneRemote">{{remoteBusy?'Clonando…':'Clonar repositorio…'}}</button></div><p v-if="error" role="alert" class="vcs-review-alert">{{error}}</p></div>
    <div v-else-if="error && !health" class="vcs-empty vcs-error"><Icon name="help" :size="24" /><strong>No se pudo iniciar Git</strong><p>{{ error }}</p><button type="button" @click="load">Reintentar</button></div>
    <div v-else-if="!health?.repository" class="vcs-empty"><Icon name="git-branch" :size="27" /><strong>Este proyecto aún no utiliza control de versiones</strong><p>Crea un repositorio local o clona otro proyecto en una carpeta vacía.</p><button type="button" class="vcs-primary" :disabled="busy" @click="init">Inicializar repositorio</button><span class="vcs-note">La inicialización no modifica ni elimina tus archivos.</span><div class="vcs-remote-divider"></div><div class="vcs-clone-form"><input v-model.trim="cloneUrl" aria-label="URL HTTPS para clonar" placeholder="https://servidor/grupo/proyecto.git"/><input v-model="cloneToken" type="password" autocomplete="off" aria-label="Token temporal para clonar" placeholder="Token temporal (opcional)"/><button type="button" class="vcs-secondary" :disabled="remoteBusy || !cloneUrl" @click="cloneRemote">Clonar en otra carpeta…</button></div></div>
    <template v-else>
      <div v-if="error" class="vcs-alert" role="alert">{{error}} <button aria-label="Cerrar aviso" @click="error=''">×</button></div>
      <div class="vcs-body">
        <aside class="vcs-changes">
          <div class="vcs-subhead"><div class="vcs-navigation"><button :class="{active:activeView==='changes'}" @click="activeView='changes'">Cambios <span>{{changedCount}}</span></button><button :class="{active:activeView==='history'}" @click="activeView='history'">Historial</button><button :class="{active:activeView==='branches'}" @click="activeView='branches'">Ramas</button><button :class="{active:activeView==='remote'}" @click="activeView='remote';refreshRemote()">Remoto</button></div></div>
          <template v-if="activeView==='changes'">
            <div class="vcs-selection"><label><input type="checkbox" :checked="!!changedCount && selectedCount===changedCount" :disabled="!changedCount || busy" @change="all($event.target.checked)" /> Seleccionar todo</label><span>{{selectedCount}} / {{changedCount}}</span></div>
            <div v-if="!changedCount" class="vcs-list-empty"><Icon name="check" :size="17" />Sin cambios pendientes</div>
            <div v-else class="vcs-filelist" role="list">
              <label v-for="f in list" :key="f.path" class="vcs-file" role="listitem" :title="f.path">
                <input type="checkbox" :checked="selected.includes(f.path)" :disabled="busy" @change="toggle(f.path)" />
                <Icon name="file" :size="13" /><span class="vcs-filepath">{{f.path}}</span>
                <span class="vcs-change-kind" :class="{added:f.untracked || f.index==='A',deleted:f.worktree==='D'}">{{f.untracked?'U':f.worktree==='D'?'D':f.index==='A'?'A':'M'}}</span>
              </label>
            </div>
          </template>
          <div v-else-if="activeView==='remote'" class="vcs-remote-list" aria-label="Estado del remoto"><div class="vcs-selection">REPOSITORIO REMOTO</div><div class="vcs-remote-metric"><span>Rama local</span><strong>{{remote?.branch || status?.branch || '—'}}</strong></div><div class="vcs-remote-metric"><span>Por enviar</span><strong>{{remote?.ahead ?? '—'}}</strong></div><div class="vcs-remote-metric"><span>Por recibir</span><strong>{{remote?.behind ?? '—'}}</strong></div><p class="vcs-remote-note">Los conteos reflejan el último Fetch, no el servidor en tiempo real.</p></div>
          <div v-else-if="activeView==='branches'" class="vcs-history" aria-label="Ramas locales">
            <div class="vcs-selection">RAMAS LOCALES <span>{{branches.length}}</span></div>
            <button v-for="branch in branches" :key="branch.name" type="button" class="vcs-branch-row" :class="{on:branch.current}" @click="chosenBranch=branch.name">
              <Icon name="git-branch" :size="13"/><span>{{branch.name}}</span><small v-if="branch.current">ACTUAL</small>
            </button>
          </div>
          <div v-else class="vcs-history" aria-label="Historial de revisiones">
            <div v-if="!commits.length" class="vcs-list-empty">No hay commits registrados</div>
            <article v-for="c in commits" :key="c.hash" class="vcs-commit" :class="{'is-selected':selectedCommit===c.hash}">
                <Icon name="git-commit" :size="15"/>
                <button type="button" class="vcs-history-button" @click="inspectCommit(c.hash)" :aria-label="`Inspeccionar ${c.subject}`"><strong :title="c.subject">{{c.subject}}</strong><small>{{hashLabel(c.hash)}} · {{c.author}} · {{new Date(c.date).toLocaleDateString('es')}}</small></button>
                <div class="vcs-commit-actions"><button type="button" :disabled="historyBusy" :title="'Usar como revisión base'" @click="chooseRevision(c.hash,'base')">A</button><button type="button" :disabled="historyBusy" title="Usar como destino" @click="chooseRevision(c.hash,'target')">B</button></div>
              </article>
              <button v-if="historyMore" class="vcs-history-more" :disabled="historyBusy" @click="loadMoreHistory">{{ historyBusy ? 'Cargando…' : 'Cargar más revisiones' }}</button>
          </div>
        </aside>
        <section v-if="activeView==='changes'" class="vcs-commit-pane">
          <div class="vcs-panel-title"><Icon name="git-commit" :size="15" /> CREAR COMMIT <span class="vcs-help" title="Los cambios se guardan en disco antes de crear el commit."><Icon name="help" :size="13" /></span></div>
          <label class="vcs-field-label">Resumen de los cambios</label>
          <textarea v-model="message" :disabled="busy" placeholder="Describe qué cambió en este proyecto…" rows="2" maxlength="2000" />
          <div class="vcs-identity"><label><span>Autor</span><input v-model.trim="author" :disabled="busy" autocomplete="name" placeholder="Nombre" maxlength="100" /></label><label><span>Correo</span><input v-model.trim="email" :disabled="busy" type="email" placeholder="autor@ejemplo.com" maxlength="180" /></label></div>
          <div class="vcs-commit-footer"><span>{{selectedCount}} archivo(s) seleccionado(s)</span><button type="button" class="vcs-primary" :disabled="busy || !selectedCount || !message.trim() || !author.trim() || !email.trim()" @click="createCommit"><Icon name="check" :size="14" /> {{busy?'Guardando…':'Crear commit'}}</button></div>
              <div class="vcs-bottomnote"><Icon name="lock" :size="12"/> Repositorio local · sin conexión remota</div>
            </section>
            <section v-else-if="activeView==='remote'" class="vcs-remote-pane" aria-label="Sincronización remota Git">
              <div class="vcs-panel-title"><Icon name="cloud" :size="15" /> REPOSITORIO REMOTO <span class="vcs-readonly">HTTPS</span></div>
              <label class="vcs-field-label" for="vcs-origin">URL de origin</label>
              <div class="vcs-inline"><input id="vcs-origin" v-model.trim="remoteUrl" :disabled="remoteBusy" placeholder="https://servidor/grupo/proyecto.git" autocomplete="off"/><button class="vcs-secondary" :disabled="remoteBusy || !remoteUrl" @click="configureOrigin">Guardar</button></div>
              <label v-if="remote?.configured" class="vcs-remote-check"><input type="checkbox" v-model="replaceRemote"/> Confirmar sustitución de origin existente</label>
              <div v-if="remote?.invalid" class="vcs-branch-warning">El remoto actual no es una URL HTTPS válida para este módulo.</div>
              <div class="vcs-remote-divider"></div>
              <label class="vcs-field-label" for="vcs-token">Token HTTPS — nunca se guarda dentro del proyecto</label>
              <input id="vcs-token" v-model="remoteToken" type="password" autocomplete="off" :disabled="remoteBusy" placeholder="Token opcional para esta operación"/>
              <div class="vcs-inline" v-if="credential?.available"><button class="vcs-secondary" :disabled="remoteBusy || !remoteToken || !remote?.configured" @click="storeCredential">Guardar cifrado</button><button class="vcs-secondary" v-if="credential?.saved" :disabled="remoteBusy" @click="forgetCredential">Olvidar credencial</button><span class="vcs-remote-note">{{credential?.saved?'Token cifrado guardado':'Sin token guardado'}}</span></div>
              <p v-else class="vcs-remote-note">El sistema no dispone de almacenamiento cifrado seguro. El token se utiliza solo en esta operación.</p>
              <div class="vcs-remote-divider"></div>
              <div class="vcs-remote-actions"><button class="vcs-secondary" :disabled="remoteBusy || !remote?.configured" @click="fetchOrigin"><Icon name="refresh" :size="13"/> Fetch</button><button class="vcs-secondary" :disabled="remoteBusy || !remote?.configured" @click="pushOrigin"><Icon name="upload" :size="13"/> Push</button><button class="vcs-primary" :disabled="remoteBusy || !remote?.configured || !canChange" @click="previewPull"><Icon name="download" :size="13"/> Preparar Pull</button></div>
              <p class="vcs-remote-note">Pull solo admite avance rápido y exige un árbol limpio. No se realizan fusiones automáticas.</p>
              <div v-if="pullPlan" class="vcs-confirm"><strong>Confirmar Pull · {{pullPlan.affected}} archivos</strong><div class="vcs-affected"><span v-for="file in pullPlan.files" :key="file">{{file}}</span></div><label><input type="checkbox" v-model="confirmPull"/> Confirmo que deseo actualizar el proyecto y recargarlo.</label><div class="vcs-inline"><button class="vcs-secondary" @click="pullPlan=null">Cancelar</button><button class="vcs-primary" :disabled="!confirmPull || remoteBusy || !canChange" @click="applyPull">Aplicar Pull</button></div></div>
              <div class="vcs-remote-divider"></div>
              <div class="vcs-panel-title"><Icon name="folder" :size="14"/> CLONAR OTRO PROYECTO</div>
              <input v-model.trim="cloneUrl" placeholder="https://servidor/grupo/proyecto.git" aria-label="URL del repositorio a clonar"/><input v-model="cloneToken" type="password" autocomplete="off" placeholder="Token temporal opcional" aria-label="Token del repositorio a clonar"/><button class="vcs-secondary" :disabled="remoteBusy || !cloneUrl" @click="cloneRemote">Seleccionar carpeta vacía y clonar…</button>
              <span v-if="remoteBusy" class="vcs-remote-note" role="status">Operación Git en curso…</span>
            </section>
            <section v-else-if="activeView==='branches'" class="vcs-branch-workspace" aria-label="Administrar ramas y restaurar revisiones">
              <div class="vcs-panel-title"><Icon name="git-branch" :size="15"/> RAMAS Y RECUPERACIÓN</div>
              <p class="vcs-branch-help">Las operaciones se preparan y confirman antes de cambiar archivos. Se guarda un respaldo dentro del repositorio.</p>
              <div class="vcs-branch-tool"><label>Nueva rama</label><div class="vcs-inline"><input v-model.trim="newBranchName" maxlength="120" placeholder="feature/nueva-escena" :disabled="busy || restoreBusy"/><button class="vcs-secondary" :disabled="!newBranchName || busy || restoreBusy" @click="createBranch">Crear</button></div></div>
              <div class="vcs-branch-tool"><label>Cambiar a rama</label><div class="vcs-inline"><select v-model="chosenBranch" :disabled="restoreBusy"><option value="" disabled>Elegir rama</option><option v-for="branch in branches.filter(b=>!b.current)" :key="branch.name" :value="branch.name">{{branch.name}}</option></select><button class="vcs-secondary" :disabled="!chosenBranch || !canChange" @click="previewRecovery('switch',{branch:chosenBranch})">Preparar cambio</button></div></div>
              <div class="vcs-branch-tool"><label>Recuperar una revisión del historial</label><div class="vcs-inline"><select v-model="selectedCommit" :disabled="restoreBusy"><option value="" disabled>Seleccionar commit</option><option v-for="c in commits" :key="c.hash" :value="c.hash">{{hashLabel(c.hash)}} · {{c.subject}}</option></select><button class="vcs-secondary" :disabled="!selectedCommit || !canChange" @click="previewRecovery('restoreProject',{hash:selectedCommit})">Restaurar proyecto</button></div></div>
              <div class="vcs-branch-tool"><label>Recuperar archivo de un commit</label><div class="vcs-inline"><select v-model="selectedDiff" :disabled="restoreBusy"><option value="" disabled>Archivo seleccionado</option><option v-for="f in inspected?.files || []" :key="f.path" :value="f.path">{{f.path}}</option></select><button class="vcs-secondary" :disabled="!selectedCommit || !selectedDiff || !canChange" @click="previewRecovery('restoreFile',{hash:selectedCommit,path:selectedDiff})">Preparar archivo</button></div><small>Inspecciona un commit en Historial para seleccionar un archivo.</small></div>
              <div v-if="!canChange" class="vcs-branch-warning">Antes de restaurar o cambiar de rama, registra todos los cambios, incluidos los archivos nuevos y los preparados en Git.</div>
              <div v-if="restorePlan" class="vcs-confirm" role="group" aria-label="Confirmación de recuperación">
                <strong>Confirmar {{restorePlan.kind==='switch'?'cambio de rama':'restauración'}}</strong>
                <p>{{restorePlan.affected}} archivos afectados · revisión {{hashLabel(restorePlan.target)}}</p>
                <div class="vcs-affected"><span v-for="f in restorePlan.files.slice(0,40)" :key="f">{{f}}</span><small v-if="restorePlan.files.length>40">Y {{restorePlan.files.length-40}} más</small></div>
                <label><input v-model="confirmRestore" type="checkbox"/> He revisado los archivos y acepto aplicar la revisión.</label>
                <div class="vcs-inline"><button class="vcs-secondary" @click="restorePlan=null">Cancelar</button><button class="vcs-primary" :disabled="!confirmRestore || !canChange" @click="applyRecovery">Aplicar y recargar proyecto</button></div>
              </div>
              <div v-if="lastBackup" class="vcs-backup-note">Último respaldo: {{lastBackup.location}}</div>
            </section>
            <section v-else class="vcs-review" aria-label="Inspector y comparador de revisiones">
              <div class="vcs-review-head"><Icon name="git-commit" :size="15" /><span>EXPLORAR REVISIONES</span><span class="vcs-readonly">SOLO LECTURA</span></div>
              <div class="vcs-review-selector">
                <label>Base
                  <select v-model="compareBase" :disabled="historyBusy || !commits.length" aria-label="Revisión base">
                    <option value="" disabled>Seleccionar</option>
                    <option v-for="c in commits" :key="c.hash" :value="c.hash">{{hashLabel(c.hash)}} · {{c.subject}}</option>
                  </select>
                </label>
                <label>Destino
                  <select v-model="compareTarget" :disabled="historyBusy || !commits.length" aria-label="Revisión destino">
                    <option value="WORKTREE">Carpeta actual (HEAD + cambios)</option>
                    <option v-for="c in commits" :key="c.hash" :value="c.hash">{{hashLabel(c.hash)}} · {{c.subject}}</option>
                  </select>
                </label>
                <button class="vcs-secondary" :disabled="historyBusy || !compareBase" @click="compararRevisiones"><Icon name="git-branch" :size="13" /> Comparar</button>
              </div>
              <div v-if="historyError" role="alert" class="vcs-review-alert">{{historyError}}</div>
              <div v-if="inspected" class="vcs-review-info"><strong>{{inspected.subject}}</strong><span>{{hashLabel(inspected.hash)}} · {{inspected.author}} · {{new Date(inspected.date).toLocaleString('es')}}</span><small>{{inspected.files.length}} archivos en el commit</small></div>
              <div v-if="inspected && !comparison" class="vcs-commit-files"><span class="vcs-field-label">ARCHIVOS DEL COMMIT</span><div v-for="f in inspected.files" :key="f.path" class="vcs-commit-file"><span class="vcs-review-kind" :class="f.status">{{f.status}}</span><span :title="f.path">{{f.path}}</span></div></div>
              <div v-if="historyBusy" class="vcs-review-placeholder">Consultando Git embebido…</div>
              <template v-else-if="comparison">
                <div class="vcs-review-summary">{{comparisonFiles.length}} archivos · {{hashLabel(comparison.base)}} → {{hashLabel(comparison.target)}}</div>
                <div class="vcs-review-results">
                  <nav class="vcs-review-files" aria-label="Archivos entre revisiones">
                    <div v-if="!comparisonFiles.length" class="vcs-list-empty">Sin diferencias entre las revisiones seleccionadas</div>
                    <button v-for="f in comparisonFiles" :key="f.path" type="button" class="vcs-review-file" :class="{'on':selectedDiff===f.path}" :title="f.path" @click="openDiff(f)"><span class="vcs-review-kind" :class="f.status">{{f.status}}</span><span>{{f.path}}</span></button>
                  </nav>
                  <div class="vcs-diff-view" aria-label="Diferencias del archivo">
                    <div v-if="!selectedDiff" class="vcs-review-placeholder">Selecciona un archivo para ver sus diferencias.</div>
                    <template v-else-if="diffResult">
                      <div class="vcs-diff-title"><Icon name="file" :size="13"/>{{diffResult.path}}</div>
                      <div v-if="diffResult.kind!=='text'" class="vcs-review-placeholder"><Icon name="file" :size="20" />{{diffResult.reason || 'Archivo binario o grande: sin vista de texto'}}</div>
                      <pre v-else class="vcs-diff-code"><span v-for="line in diffLines" :key="line.id" class="vcs-diff-line" :class="line.kind">{{line.text}}
</span></pre>
                    </template>
                  </div>
                </div>
              </template>
              <div v-else class="vcs-review-placeholder">Selecciona una revisión del historial para inspeccionarla. Elige A y B o usa los selectores para comparar dos versiones.</div>
            </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.vcs-shell {display:flex;flex-direction:column;min-height:0;height:100%;font-size:12px;color:var(--text,#e2e6e9);background:var(--g-850,#20252b)}
.vcs-toolbar {min-height:35px;display:flex;align-items:center;gap:11px;padding:0 12px;border-bottom:1px solid var(--hair,#343b45);background:var(--g-900,#171b20)}
.vcs-heading,.vcs-branch {display:flex;align-items:center;gap:8px;min-width:0}
.vcs-heading {font-weight:650;letter-spacing:.06em;font-size:11px}.vcs-heading :deep(svg){color:#8ea3b8}.vcs-branch{color:var(--text-2,#b2bac5);font-size:11px;font-weight:450;letter-spacing:0}
.vcs-divider{width:1px;height:16px;background:var(--hair,#343b45);margin:0 2px}.vcs-state{display:flex;align-items:center;gap:7px;font-size:10px;letter-spacing:.04em;color:#d7ba80;margin-left:auto;white-space:nowrap}.vcs-state.is-clean{color:#98c7ae}.vcs-status-dot{height:6px;width:6px;border-radius:50%;background:currentColor}.vcs-icon-btn{display:grid;place-items:center;width:26px;height:24px;background:transparent;border:1px solid transparent;border-radius:4px;color:var(--text-2,#bcc5cf)}.vcs-icon-btn:hover{background:var(--g-700,#333c47)}.vcs-icon-btn:disabled{opacity:.4}
.vcs-body{display:grid;grid-template-columns:minmax(210px,1.3fr) minmax(225px,1fr);flex:1;min-height:0;overflow:hidden}.vcs-changes{display:flex;flex-direction:column;min-width:0;border-right:1px solid var(--hair,#343b45)}.vcs-subhead{padding:0 12px;height:32px;flex:none;display:flex;align-items:center;border-bottom:1px solid var(--hair,#343b45)}.vcs-navigation{display:flex;gap:17px;height:100%}.vcs-navigation button{height:100%;border:none;border-bottom:2px solid transparent;background:transparent;color:var(--text-3,#959fab);font-weight:550;font-size:11px;padding:0 1px}.vcs-navigation button.active{color:var(--text,#f0f3f7);border-color:#6ea7d8}.vcs-navigation span{font-size:10px;background:#35404d;padding:1px 5px;border-radius:3px;margin-left:3px}.vcs-selection{padding:7px 12px;display:flex;justify-content:space-between;color:var(--text-3,#9eaab8);font-size:11px}.vcs-selection label,.vcs-file{display:flex;gap:8px;align-items:center}.vcs-filelist,.vcs-history{min-height:0;overflow:auto}.vcs-file{padding:6px 12px;cursor:pointer;border-top:1px solid transparent;border-bottom:1px solid transparent}.vcs-file:hover{background:var(--g-750,#29313a)}.vcs-file input,.vcs-selection input{accent-color:#679ed5;margin:0}.vcs-file :deep(svg){color:var(--text-3,#97a4af);flex-shrink:0}.vcs-filepath{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vcs-change-kind{color:#d5bb77;font-size:10px;min-width:12px;text-align:center;font-weight:700}.vcs-change-kind.added{color:#7cc2a0}.vcs-change-kind.deleted{color:#df8c8c}.vcs-list-empty{display:flex;align-items:center;gap:8px;color:var(--text-3,#8e99a5);padding:24px 16px;font-size:12px}.vcs-commit{display:flex;align-items:flex-start;gap:9px;padding:8px 12px;border-bottom:1px solid var(--hair,#343b45)}.vcs-commit :deep(svg){color:#7eaccd}.vcs-commit div{min-width:0}.vcs-commit strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:550}.vcs-commit small{display:block;color:var(--text-3,#8e99a5);margin-top:4px;font-size:10px}
.vcs-commit-pane{display:flex;flex-direction:column;gap:8px;padding:11px 13px;overflow:auto;min-width:0}.vcs-panel-title{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:650;letter-spacing:.05em;color:var(--text-2,#d2d9e1)}.vcs-panel-title :deep(svg){color:#7f9ab5}.vcs-help{margin-left:auto}.vcs-field-label{font-size:11px;color:var(--text-3,#99a5b2)}.vcs-commit-pane textarea,.vcs-commit-pane input{background:var(--g-900,#171c22);border:1px solid var(--hair,#3a4350);color:var(--text,#e8eef6);border-radius:4px;outline:none;width:100%;box-sizing:border-box;font:inherit;padding:6px 8px}.vcs-commit-pane textarea{resize:vertical;min-height:49px}.vcs-commit-pane :is(textarea,input):focus{border-color:#629acc;box-shadow:0 0 0 1px #629acc44}.vcs-identity{display:grid;grid-template-columns:1fr 1.2fr;gap:8px}.vcs-identity label{display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--text-3,#99a5b2);min-width:0}.vcs-commit-footer{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:2px;color:var(--text-3,#9ba5b0);font-size:11px}.vcs-primary{display:flex;align-items:center;justify-content:center;gap:7px;background:#416e98;border:1px solid #6295c4;border-radius:4px;color:#f5faff;padding:7px 12px;font-size:11px;font-weight:620;white-space:nowrap;cursor:pointer}.vcs-primary:hover{background:#5181ae}.vcs-primary:disabled{opacity:.45;cursor:default}.vcs-bottomnote{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--text-3,#8d98a5)}.vcs-empty{flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:9px;text-align:center;padding:24px}.vcs-empty :deep(svg){color:#809bb1}.vcs-empty strong{font-size:13px;font-weight:600}.vcs-empty p{margin:0;max-width:430px;color:var(--text-3,#98a3b0);line-height:1.5}.vcs-empty .vcs-primary{margin-top:8px}.vcs-note{font-size:10px;color:var(--text-3,#91a0ad)}.vcs-error :deep(svg){color:#d19999}.vcs-alert{color:#eac7aa;background:#4d342a;padding:7px 12px;display:flex;justify-content:space-between;gap:7px}.vcs-alert button{background:transparent;border:none;color:inherit;cursor:pointer}
@media(max-width:760px){.vcs-body{grid-template-columns:1fr}.vcs-changes{min-height:130px;border-right:0;border-bottom:1px solid var(--hair,#343b45)}.vcs-commit-pane{max-height:260px}.vcs-identity{grid-template-columns:1fr 1fr}.vcs-heading{font-size:10px}}

/* Visor de revisiones: integrado en el dock existente, sin modales simulados. */
.vcs-commit-files{padding:4px 12px 8px;overflow:auto;max-height:35%;border-bottom:1px solid var(--hair,#374454)}.vcs-commit-file{display:flex;align-items:center;gap:6px;padding:3px 0;font-size:10px;color:var(--text-2,#cfd9e4)}.vcs-commit-file span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vcs-history-more{width:100%;padding:10px 8px;background:transparent;color:#a4c7e7;border:0;border-top:1px solid var(--hair,#384655);cursor:pointer;font-size:11px}.vcs-history-more:hover{background:var(--g-750,#293643)}.vcs-history-button {min-width:0;flex:1;text-align:left;background:none;border:0;color:inherit;padding:0;cursor:pointer}
.vcs-commit.is-selected {background:var(--g-750,#2b3845);box-shadow:inset 2px 0 #6ba5d5}
.vcs-commit-actions{display:flex;gap:3px;flex:none;margin-left:auto}
.vcs-commit-actions button{background:var(--g-800,#232a33);border:1px solid var(--hair,#3b4553);color:var(--text-2,#bdc9d5);border-radius:3px;font-size:10px;font-weight:600;cursor:pointer;width:22px;height:21px}
.vcs-commit-actions button:hover,.vcs-secondary:hover{border-color:#77a6d0}
.vcs-review{display:flex;flex-direction:column;min-height:0;min-width:0;overflow:hidden}
.vcs-review-head{display:flex;align-items:center;gap:7px;padding:9px 12px 5px;font-weight:650;font-size:11px;letter-spacing:.04em}
.vcs-readonly{margin-left:auto;color:#a4b3c1;border:1px solid #455361;padding:2px 5px;border-radius:3px;font-size:9px;letter-spacing:.035em}
.vcs-review-selector{display:flex;align-items:end;gap:6px;padding:6px 12px 9px;flex-wrap:wrap}
.vcs-review-selector label{flex:1 1 150px;min-width:95px;font-size:10px;color:var(--text-3,#a5b0bd);display:flex;flex-direction:column;gap:3px}
.vcs-review-selector select{width:100%;min-width:0;background:var(--g-900,#171c22);border:1px solid var(--hair,#46525f);color:var(--text,#ecf0f5);border-radius:4px;padding:5px;font-size:11px}
.vcs-secondary{display:flex;align-items:center;gap:5px;background:var(--g-750,#344252);border:1px solid var(--hair,#526376);border-radius:4px;padding:6px 10px;color:var(--text,#ecf0f5);font-size:11px;cursor:pointer;white-space:nowrap}
.vcs-secondary:disabled{opacity:.4;cursor:default}
.vcs-review-info{margin:0 12px 7px;padding:7px 9px;border:1px solid var(--hair,#45515f);border-radius:4px;display:flex;flex-direction:column;gap:3px;font-size:11px}
.vcs-review-info span,.vcs-review-info small{color:var(--text-3,#9eabb9);font-size:10px}
.vcs-review-summary{padding:7px 12px;background:var(--g-900,#171c22);border-top:1px solid var(--hair,#36414d);font-size:10px;color:var(--text-3,#9aa8b9)}
.vcs-review-results{display:grid;grid-template-columns:minmax(115px,34%) minmax(0,1fr);flex:1;min-height:90px;overflow:hidden}
.vcs-review-files{overflow:auto;border-right:1px solid var(--hair,#3b4450);min-height:0}
.vcs-review-file{display:flex;align-items:center;gap:7px;width:100%;background:transparent;color:var(--text-2,#d3dce5);border:0;border-bottom:1px solid var(--hair,#353f4c);padding:7px 9px;text-align:left;font-size:11px;cursor:pointer}
.vcs-review-file span:last-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.vcs-review-file:hover,.vcs-review-file.on{background:var(--g-750,#2d3845)}
.vcs-review-kind{display:grid;place-items:center;flex:none;width:16px;color:#dfc287;font-size:10px;font-weight:700}
.vcs-review-kind.A{color:#86c9a5}.vcs-review-kind.D{color:#e49a9a}.vcs-review-kind.R{color:#92bce8}
.vcs-diff-view{min-height:0;overflow:auto;background:#151b22;color:#cdd8e3}
.vcs-diff-title{position:sticky;top:0;background:#202a35;display:flex;align-items:center;gap:8px;font-size:11px;border-bottom:1px solid #354454;padding:7px 10px}
.vcs-diff-code{margin:0;padding:6px 0;font-size:11px;line-height:1.55;white-space:pre;tab-size:2;font-family:ui-monospace,Consolas,monospace;overflow:auto}
.vcs-diff-line{display:block;padding:0 10px;min-height:16px}.vcs-diff-line.add{background:#193a30;color:#a6e7bb}.vcs-diff-line.remove{background:#482c34;color:#ffbac0}.vcs-diff-line.hunk{color:#9fcaf2;background:#23374b}.vcs-diff-line.file{font-weight:650;color:#c2d0dc}
.vcs-review-placeholder{display:flex;align-items:center;justify-content:center;gap:8px;flex:1;padding:16px;text-align:center;color:var(--text-3,#a5b2c0);font-size:11px;line-height:1.5}
.vcs-review-alert{padding:7px 11px;background:#49322e;color:#ffccb9;font-size:11px}
@container (max-width:600px){.vcs-review-results{grid-template-columns:1fr;grid-template-rows:minmax(66px,35%) minmax(70px,1fr)}.vcs-review-files{border-right:0;border-bottom:1px solid var(--hair,#3b4450)}}
.vcs-shell{container-type:inline-size}
</style>

<style scoped>
/* S03: espacio de trabajo compacto y adaptación progresiva, sin diálogos del navegador. */
.vcs-branch-row{display:flex;align-items:center;gap:8px;width:100%;padding:9px 12px;background:none;border:0;border-bottom:1px solid var(--hair,#3e4751);color:var(--text,#e4eaf2);font-size:11px;text-align:left;cursor:pointer}
.vcs-branch-row:hover,.vcs-branch-row.on{background:var(--g-750,#2a3744)}.vcs-branch-row span{flex:1;overflow:hidden;text-overflow:ellipsis}.vcs-branch-row small{font-size:9px;color:#a9c9e9}
.vcs-branch-workspace{padding:12px;display:flex;flex-direction:column;gap:10px;overflow:auto;min-width:0;font-size:11px}
.vcs-branch-help{color:var(--text-3,#a7b3bf);margin:0;line-height:1.4}.vcs-branch-tool{display:flex;flex-direction:column;gap:5px}
.vcs-inline{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.vcs-inline select,.vcs-inline input{flex:1 1 140px;min-width:0;border:1px solid var(--hair,#4e5d6e);border-radius:4px;background:var(--g-900,#171e27);color:var(--text,#e8eff8);padding:6px;font:inherit}
.vcs-branch-tool small{color:var(--text-3,#9baaba)}.vcs-branch-warning{border-left:2px solid #d4a96d;background:#3c332b;padding:8px;color:#f3d6ae}
.vcs-confirm{display:flex;flex-direction:column;gap:8px;border:1px solid #778b9b;background:var(--g-850,#242e39);padding:12px;border-radius:5px}
.vcs-confirm p{margin:0;color:var(--text-3,#b0bfce)}.vcs-confirm label{display:flex;align-items:center;gap:7px}.vcs-confirm input[type=checkbox]{accent-color:#739ed2}
.vcs-affected{display:flex;flex-direction:column;max-height:85px;overflow:auto;gap:2px;font-family:ui-monospace,monospace;font-size:10px;color:#b6c6d5}
.vcs-backup-note{font-size:10px;color:var(--text-3,#a2b4c3);overflow-wrap:anywhere}
@container (max-width:570px){.vcs-branch-workspace{padding:8px}.vcs-inline>*{width:100%}}
</style>

<style scoped>
/* S04: área de sincronización integrada, diseño sobrio y responsive. */
.vcs-remote-pane{padding:12px;display:flex;flex-direction:column;gap:9px;overflow:auto;min-width:0}
.vcs-remote-pane input,.vcs-clone-form input{min-width:0;width:100%;box-sizing:border-box;background:var(--g-900,#161d25);border:1px solid var(--hair,#465463);border-radius:4px;padding:7px 9px;color:var(--text,#edf2f7);font:inherit;font-size:11px}
.vcs-remote-pane input:focus,.vcs-clone-form input:focus{outline:1px solid #73a9d8}
.vcs-remote-actions{display:flex;flex-wrap:wrap;gap:7px}
.vcs-remote-divider{border-top:1px solid var(--hair,#3c4551);margin:3px 0}
.vcs-remote-check{display:flex;gap:7px;align-items:center;font-size:10px;color:var(--text-3,#a8b5c1)}
.vcs-remote-note{margin:0;color:var(--text-3,#a0adba);font-size:10px;line-height:1.45}
.vcs-remote-list{overflow:auto;min-height:0}.vcs-remote-metric{display:flex;justify-content:space-between;padding:11px 12px;border-bottom:1px solid var(--hair,#37424e);font-size:11px;color:var(--text-3,#a5b2c0)}.vcs-remote-metric strong{color:var(--text,#edf1f4);font-variant-numeric:tabular-nums}
.vcs-remote-list .vcs-remote-note{padding:12px}.vcs-clone-form{display:flex;flex-direction:column;gap:8px;width:min(100%,420px)}
@container (max-width:550px){.vcs-remote-pane{padding:8px}.vcs-remote-actions button{flex:1}}
</style>

<style scoped>
/* S04: cuarta pestaña navegable sin desbordar el dock en resoluciones pequeñas. */
.vcs-subhead{min-width:0}
.vcs-navigation{min-width:0;max-width:100%;overflow-x:auto;scrollbar-width:thin;white-space:nowrap;gap:10px}
.vcs-navigation button{flex-shrink:0}
@container (max-width:550px){.vcs-navigation{gap:7px}.vcs-navigation button{font-size:10px}}
</style>
