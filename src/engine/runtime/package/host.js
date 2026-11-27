// `host` del juego exportado: resuelve el contrato del Runtime (host.js) desde un paquete, sin editor, sin IndexedDB y sin store.
// Las escenas se cargan una a una, cuando el juego las pide.
import { reactive } from '@vue/reactivity'
import { createPlayState } from '../play-state.js'
import { loadNavCache } from '../nav-cache.js'
import { modelIdsInScene } from '../database/models.js'
import { validateSceneVfx } from '../vfx/scene-validation.js'
import { expandSceneInstances, readSceneSources } from '../scene/instances.js'

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2', svg: 'image/svg+xml' }
const extOf = (n) => String(n || '').split('.').pop().toLowerCase()

// La autoría de conexiones pertenece a cada escena, nunca al metadato global del juego.
function sceneSignalConnections(scene) {
  if (scene.signalConnections === undefined) return [] // Paquetes anteriores a Signals.
  if (!Array.isArray(scene.signalConnections)) throw new Error('Conexiones de señales inválidas en el paquete Player')
  return scene.signalConnections
}

/**
 * @param {object} o
 * @param o.pkg      paquete abierto (readPackage)
 * @param o.storage  almacenamiento del jugador (get/set/remove/keys, síncrono; ver host.js)
 * @param o.log      (msg, kind, context) registro de los scripts
 */
export function createPackageHost({ pkg, storage, log = (msg, kind = 'log') => (console[kind] || console.log)(msg) }) {
  const project = reactive({ ...pkg.game, objects: [], environment: null, terrain: null, signalConnections: [], activeSceneId: null })
  const urls = new Map(), names = new Map()
  for (const f of [...(project.models || []), ...(project.assets || [])]) names.set(f.id, f.name)
  const view = reactive({ lights: true, wireframe: false, terrain: true, foliage: true })
  const play = createPlayState()
  let graph = null // SceneGraph: lo asigna el reproductor con attach()
  const pendingModels = new Map(), chunkModelRefs = new Map(), sceneModels = new Set()
  const modelRecords = new Map((project.models || []).map(model => [model.id, model]))
  // Misma expansión que usa el Editor: el paquete sólo serializa nodos autorales.
  async function loadResolvedScene(id) {
    const scene = await pkg.scene(id)
    if (!scene) return null
    const sources = await readSceneSources([
      ...(scene.objects || []),
      ...(project.prefabs || []).flatMap(p => p.objects || []),
    ], sourceId => pkg.scene(sourceId))
    return expandSceneInstances({ ...scene, signalConnections: sceneSignalConnections(scene) }, id, sources)
  }

  async function prepareStreamModels(ids, signal) {
    for (const id of ids) {
      if (!graph || signal?.aborted) return
      const model = modelRecords.get(id)
      if (!model || graph.models.has(id)) continue
      if (!pendingModels.has(id)) {
        const target = graph
        const pending = (async () => {
          const bytes = await pkg.file(id)
          if (!bytes || graph !== target) return
          await target.registerModel(id, bytes, model.name)
        })().finally(() => pendingModels.delete(id))
        pendingModels.set(id, pending)
      }
      await pendingModels.get(id)
    }
  }
  async function retainStreamModels(ids, signal) {
    const target = graph
    for (const id of ids) chunkModelRefs.set(id, (chunkModelRefs.get(id) || 0) + 1)
    const release = () => {
      for (const id of ids) {
        const remaining = (chunkModelRefs.get(id) || 1) - 1
        if (remaining) chunkModelRefs.set(id, remaining)
        else {
          chunkModelRefs.delete(id)
          if (!sceneModels.has(id)) target?.unregisterStreamModel(id)
        }
      }
    }
    try {
      await prepareStreamModels(ids, signal)
      return release
    } catch (error) { release(); throw error }
  }
  async function validateVfxScene(objects) {
    validateSceneVfx(objects, project.vfx || [], project.assets || [])
    const byId = new Map((project.vfx || []).map((fx) => [fx.id, fx]))
    const textures = new Set()
    for (const obj of objects) if (obj.type === 'vfx' && obj.props?.vfxId) {
      const textureId = byId.get(obj.props.vfxId)?.appearance?.textureId
      if (textureId) textures.add(textureId)
    }
    for (const id of textures) if (!(await pkg.file(id))) throw new Error(`VFX3D: falta el archivo de textura ${id} en el paquete Player`)
  }

  const host = {
    get project() { return project },
    view,
    playState: play,
    muted: false, locked: false,
    storage,
    readStreamScene: id => pkg.scene(id),
    retainStreamModels,
    getObject: (id) => project.objects.find((o) => o.id === id),
    async assetData(id) { const b = await pkg.file(id); return b ? { name: names.get(id) || id, bytes: b } : null },
    async assetUrl(id) {
      if (urls.has(id)) return urls.get(id)
      const b = await pkg.file(id); if (!b) return null
      const u = URL.createObjectURL(new Blob([b], { type: MIME[extOf(names.get(id))] || 'application/octet-stream' }))
      urls.set(id, u); return u
    },
    async assetImage(id) {
      const u = await host.assetUrl(id); if (!u) return null
      const img = new Image(); img.src = u; await img.decode(); return img
    },
    toast: (msg, kind) => { if (kind === 'error') console.error(msg); else console.info(msg) },
    log,
    foliageCounts() {}, bakeState() {},
    /** Carga otra escena del paquete y la monta (streaming: carga bajo demanda los modelos nuevos). */
    async switchScene(id) {
      if (!graph || project.activeSceneId === id) return false
      const s = await loadResolvedScene(id); if (!s) return false
      await validateVfxScene(s.objects || [])
      const signalConnections = sceneSignalConnections(s)
      project.objects = s.objects || []
      project.signalConnections = signalConnections
      project.environment = s.environment
      project.terrain = s.terrain
      project.activeSceneId = id
      // Streaming: cargar los modelos de la nueva escena que aún no están registrados
      const usedIds = modelIdsInScene(s.objects || [], project.database, project.prefabs)
      for (const modelId of usedIds) {
        sceneModels.add(modelId)
        try { await prepareStreamModels([modelId]) } catch (error) { console.warn('Modelo no legible', error) }
      }
      await graph.loadScene({ terrain: s.terrain, settings: project.settings })
      graph.syncAll(); graph.syncEnvironment(); await loadNavCache(graph)
      return true
    },
    /** Une el host con el SceneGraph y monta la primera escena.
     *  Solo carga los modelos referenciados en la escena inicial (streaming: el resto se carga al cambiar de escena). */
    async attach(sg, onProgress) {
      graph = sg
      const id = project.game?.startScene || pkg.sceneIds[0]
      await onProgress?.('scene')
      const s = await loadResolvedScene(id); if (!s) throw new Error('No se pudo leer la escena inicial')
      await validateVfxScene(s.objects || [])
      project.signalConnections = sceneSignalConnections(s)
      project.objects = s.objects || []; project.environment = s.environment; project.terrain = s.terrain; project.activeSceneId = id
      // Streaming: solo los modelos usados en la escena inicial (los demás se cargan al cambiar de escena)
      const usedIds = modelIdsInScene(s.objects || [], project.database, project.prefabs)
      for (const modelId of usedIds) sceneModels.add(modelId)
      const assets = []
      for (const m of project.models || []) {
        if (!usedIds.has(m.id)) continue
        const bytes = await pkg.file(m.id); if (bytes) assets.push({ assetId: m.id, name: m.name, bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) })
      }
      await sg.loadProject({ terrain: s.terrain, settings: project.settings }, assets, project.models,
        onProgress && ((done, total) => onProgress('models', done, total)))
      await onProgress?.('mount')
      const desc = sg.setCaptureClips(project.captures || [])
      for (const m of project.models || []) if (desc[m.id]) m.clips = desc[m.id]
      sg.syncAll(); sg.syncEnvironment(); await loadNavCache(sg)
    },
    dispose() { for (const u of urls.values()) URL.revokeObjectURL(u); urls.clear(); graph = null },
  }
  return host
}
