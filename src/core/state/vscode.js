// VS Code: scripts como archivos reales + tipos de la API (solo editor). Se carga bajo demanda desde state/project.js, así el juego exportado no lo lleva.
import * as disk from '../disk.js'
import { uid } from '../../engine/runtime/util.js'
import { addFolderChain } from '../project.js'
import { projectDts, scriptOwnerTypes, JSCONFIG, FOLDER as LF_FOLDER } from '../vscode/files.js'
import { scriptPath, splitPath } from '../vscode/plan.js'
import { createScriptSync } from '../vscode/sync.js'
import { GAME_API_DTS } from '../events/apiDocs.js'
import { host } from '../desktop.js'
import { nodeReference } from '../editor/node-reference.js'
import { store, toast } from './state.js'
import { markDirty } from './history.js'
import { closeScriptEditor } from './database.js'

// ---------- VS Code: scripts como archivos reales + tipos de la API ----------
// Los scripts del proyecto se reflejan en <carpeta del proyecto>/Assets/Scripts/*.js y se sincronizan en los dos sentidos
// (core/vscode/plan.js explica quién gana en cada caso). Junto a ellos van jsconfig.json y .levelforge/*.d.ts para que
// VS Code conozca game.* y los nombres del proyecto. La extensión «Century» (vscode-extension/) completa la experiencia.
/** ctx = { getLoc, serializeProject, collectScenes }: lo que necesita de project.js (inyectado para no crear un ciclo). */
export function createVscode(ctx) {
  const findScript = (path) => store.project?.scripts.find((c) => scriptPath(c) === path)
  const scriptSync = createScriptSync({
    disk,
    getLoc: () => ctx.getLoc(),
    getScripts: () => (store.project && !store.locked ? store.project.scripts : null),
    notify: (msg, kind) => toast(msg, kind || 'info', 4500),
    apply: {
      updateScript(path, code) { const c = findScript(path); if (c && c.code !== code) { c.code = code; markDirty() } },
      importScript(path, code) {
        const p = store.project, { folder, name } = splitPath(path)
        p.scripts.push({ id: uid('sc'), name, folder, code })
        addFolderChain(p, folder)
        markDirty()
        toast('Script nuevo desde la carpeta del proyecto: ' + name, 'info', 3000)
      },
      deleteScript(path) {
        const c = findScript(path); if (!c) return
        store.project.scripts = store.project.scripts.filter((x) => x !== c)
        if (store.scriptEditId === c.id) closeScriptEditor()
        markDirty()
        toast('Script eliminado desde la carpeta del proyecto: ' + c.name, 'info', 3500)
      },
    },
  })
  const pendingOpens = new Map(), pendingNotices = new Map()
  let openGeneration = 0
  let syncedLoc = null
  function stopSync() {
    const previous = syncedLoc; syncedLoc = null; scriptSync.stop(); openGeneration++
    pendingOpens.clear()
    for (const cleanup of [...pendingNotices.values()]) cleanup()
    if (previous?.kind === 'path') host()?.releaseVSCode?.(previous.path)?.catch(() => {})
  }
  let cacheLoc = null
  let editorFilesCache = new Map() // ruta → último texto escrito (para no reescribir lo que no cambia)

  /** api.d.ts + project.d.ts (+ jsconfig.json si falta) en la carpeta del proyecto. `scenes` = todas las escenas guardadas. */
  async function writeEditorFiles(loc, meta, scenes, { verify = false } = {}) {
    if (cacheLoc !== loc) { cacheLoc = loc; editorFilesCache = new Map() }
    const cache = editorFilesCache
    const files = new Map([[`${LF_FOLDER}/api.d.ts`, GAME_API_DTS], [`${LF_FOLDER}/project.d.ts`, projectDts(meta, scenes)], [`${LF_FOLDER}/script-owners.json`, scriptOwnerTypes(meta, scenes)]])
    const out = new Map([...files].filter(([path, text]) => cache.get(path) !== text))
    if (verify) {
      for (const [path, text] of files) {
        if (!out.has(path) && !await disk.exists(loc, path)) out.set(path, text)
      }
    }
    if (verify || !cache.has('jsconfig.json')) {
      if (!(await disk.exists(loc, 'jsconfig.json'))) out.set('jsconfig.json', JSON.stringify(JSCONFIG, null, 2) + '\n') // si existe es del usuario: no se toca
    }
    if (out.size) await disk.writeFiles(loc, out)
    for (const [path, text] of out) cache.set(path, text)
    cache.set('jsconfig.json', 'ok')
  }

  async function refreshEditorFiles(options) {
    const loc = ctx.getLoc()
    if (!loc || !store.project || store.locked) return
    const { meta, scene } = ctx.serializeProject()
    const scenes = await ctx.collectScenes(meta, scene)
    if (loc === ctx.getLoc() && !store.locked) await writeEditorFiles(loc, meta, scenes, options)
  }

  async function startSync(loc) {
    if (syncedLoc && syncedLoc !== loc) stopSync()
    syncedLoc = loc
    cacheLoc = null
    await scriptSync.start(loc)
    if (loc === ctx.getLoc()) await refreshEditorFiles()
  }

  /** Abre la carpeta del proyecto (y el script indicado) en VS Code. Solo en la aplicación de escritorio. */
  async function openInVSCode(scriptId = null) {
    const loc = ctx.getLoc()
    const project = store.project
    const generation = openGeneration
    const bridge = host()
    if (loc?.kind !== 'path' || !bridge?.openVSCode || !project || store.locked) {
      throw new Error('Abre y guarda el proyecto en una carpeta desde la aplicación de escritorio.')
    }
    const assertCurrent = () => {
      if (generation !== openGeneration || loc !== ctx.getLoc() || project !== store.project || store.locked) {
        throw new Error('El proyecto activo cambió durante la apertura.')
      }
    }
    if (!await disk.exists(loc, 'project.lfproj')) throw new Error('Guarda el proyecto en su carpeta antes de abrirlo.')
    assertCurrent()
    const result = await scriptSync.flush({ force: true })
    assertCurrent()
    if (!result) throw new Error(scriptSync.status.lastError || 'La sincronización de scripts no está disponible.')
    const script = scriptId === null ? null : project.scripts.find(c => c.id === scriptId)
    if (scriptId !== null && !script) throw new Error('El script seleccionado ya no existe en el proyecto.')
    await refreshEditorFiles({ verify: true })
    assertCurrent()
    const file = script ? scriptPath(script) : null
    const notice = { id: uid('vscode'), msg: 'Conectando con VS Code…', kind: 'info' }
    const labels = { connecting: 'Conectando con VS Code…', starting: 'Iniciando VS Code y comprobando su extensión…', opening: 'Abriendo archivo en VS Code…', connected: 'Conectado con VS Code', failed: 'No se pudo completar la apertura de VS Code' }
    store.toasts.push(notice)
    const off = bridge.onVSCodeStatus?.(status => {
      if (status.root === loc.path && status.file === file && labels[status.phase]) {
        const visible = store.toasts.find(t => t.id === notice.id)
        if (visible) { visible.msg = labels[status.phase]; visible.kind = status.phase === 'failed' ? 'error' : 'info' }
      }
    })
    const cleanup = () => {
      off?.()
      const index = store.toasts.findIndex(t => t.id === notice.id)
      if (index >= 0) store.toasts.splice(index, 1)
      pendingNotices.delete(notice.id)
    }
    pendingNotices.set(notice.id, cleanup)
    let response
    try { response = await bridge.openVSCode(loc.path, file) }
    finally { cleanup() }
    assertCurrent()
    if (response?.canceled) return false
    if (!response?.ok) throw new Error(response?.error || 'El editor externo no respondió.')
    if (['installed', 'updated'].includes(response.extension?.status)) {
      toast(`Extensión de Century ${response.extension.version} instalada. Si VS Code ya estaba abierto, recarga su ventana para activarla.`, 'info', 7000)
    }
    return true
  }
  function open(scriptId = null) {
    const key = JSON.stringify([ctx.getLoc()?.path, store.project?.id, scriptId])
    if (!pendingOpens.has(key)) {
      const task = openInVSCode(scriptId).finally(() => { if (pendingOpens.get(key) === task) pendingOpens.delete(key) })
      pendingOpens.set(key, task)
    }
    return pendingOpens.get(key)
  }
  async function insertNode(id) {
    const loc = ctx.getLoc(), project = store.project
    const bridge = host()
    nodeReference(id) // valida el identificador usando el contrato compartido
    if (!project || store.locked || !project.objects.some(o => o.id === id)) throw new Error('El nodo no está disponible en esta escena.')
    if (loc?.kind !== 'path' || !bridge?.insertNodeVSCode) throw new Error('Abre y guarda el proyecto desde Electron para insertar referencias en VS Code.')
    const result = await bridge.insertNodeVSCode(loc.path, id)
    if (loc !== ctx.getLoc() || project !== store.project || store.locked) throw new Error('El proyecto cambió durante la inserción.')
    if (!result?.ok) throw new Error(result?.error || 'VS Code no confirmó la inserción.')
    return true
  }
  return {
    get active() { return scriptSync.active },
    stop: stopSync,
    flush: (opts) => scriptSync.flush(opts),
    writeEditorFiles,
    startSync,
    open,
    insertNode,
  }
}
