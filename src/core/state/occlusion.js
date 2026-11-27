import { reactive } from 'vue'
import { commit, markDirty } from './history.js'
import { store, toast } from './state.js'

export const occlusionBake = reactive({ running: false, progress: 0 })
let pending = null

export function setStaticOcclusion(enabled) {
  if (store.locked || !store.project?.render) return
  store.project.render.staticOcclusion = enabled
  store.editor?.vp.requestRender()
  markDirty()
}

export function cancelOcclusionBake() { pending?.abort() }

export async function bakeSceneOcclusion() {
  const project = store.project
  const editor = store.editor
  if (!project?.environment || !editor || store.locked || store.play.on || store.edit.on || pending) return
  const sceneId = project.activeSceneId
  const environment = project.environment
  const originalRevision = store.pendingRevision
  const controller = new AbortController()
  pending = controller
  occlusionBake.running = true
  occlusionBake.progress = 0
  try {
    const { bakeStaticOcclusion } = await import('../../engine/runtime/render/occlusion-bake.js')
    const result = await bakeStaticOcclusion(editor, {
      signal: controller.signal,
      onProgress: (fraction) => { occlusionBake.progress = fraction },
    })
    if (controller.signal.aborted || store.project !== project || project.activeSceneId !== sceneId ||
        project.environment !== environment || store.pendingRevision !== originalRevision || store.editor !== editor || store.play.on || store.locked) return
    environment.occlusionBake = result
    editor.vp.requestRender()
    commit('Hornear oclusión estática')
    toast(result.covered ? 'Horneado de oclusión guardado en la escena' : 'Horneado completado sin descartes', result.covered ? 'ok' : 'info')
  } catch (error) {
    if (!controller.signal.aborted) toast(error.message || 'No se pudo hornear la oclusión', 'error', 6000)
  } finally {
    pending = null
    occlusionBake.running = false
  }
}
