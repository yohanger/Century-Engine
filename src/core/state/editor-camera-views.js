import { encodeCameraView } from './editor-workspace.js'
// Estado de navegación del editor por escena; la persistencia usa snapshots validados.
// La cámara Three.js sigue siendo única; este módulo solo guarda sus snapshots.
export class EditorCameraViews {
  constructor() { this.projectId = null; this.views = new Map(); this.initial = null }
  beginProject(projectId, editor, scenes = {}) {
    this.projectId = projectId
    this.views.clear()
    // Posición neutral del visor de autoría, no heredada del proyecto anterior.
    const vp = editor.vp
    vp.setOrtho(false)
    vp.persp.position.set(0, 10, 10)
    vp.persp.zoom = 1
    if (vp.ortho) { vp.ortho.zoom = 1; vp.ortho.position.set(0, 10, 10); vp.ortho.quaternion.copy(vp.persp.quaternion) }
    vp._orthoH = 10
    vp.currentView = null
    vp.controls.minPolarAngle = 0; vp.controls.maxPolarAngle = Math.PI
    vp._fitCameras?.()
    vp.controls.target.set(0, 0, 0)
    vp.controls.update()
    this.initial = vp.saveEditorView()
    for (const [id, scene] of Object.entries(scenes)) { const view = encodeCameraView(scene?.camera); if (view) this.views.set(id, view) }
  }
  capture(projectId, sceneId, editor) {
    if (this.projectId !== projectId || !sceneId) return
    this.views.set(sceneId, editor.meshLocalSavedView?.() || editor.vp.saveEditorView())
  }
  restore(projectId, sceneId, editor) {
    if (this.projectId !== projectId) return
    editor.vp.restoreEditorView(this.views.get(sceneId) || this.initial)
  }
  serialized(sceneId) { return encodeCameraView(this.views.get(sceneId)) }
  forget(projectId, sceneId) {
    if (this.projectId === projectId) this.views.delete(sceneId)
  }
}
