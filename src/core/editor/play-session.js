// «Jugar» dentro del editor: lo que el editor guarda, esconde y restaura al entrar y salir. El Runtime (events/play.js) no sabe de
// selección, herramientas ni cuadrícula: solo llama a estos ganchos si el host le da una sesión (`new PlayMode(ed, session)`).
import { store, saveNow, persistEditorWorkspace } from '../store.js'

export class EditorPlaySession {
  constructor(editor) { this.ed = editor; this.saved = null }
  /** Antes de jugar: cierra edición y pintura; guarda selección, cámara, herramienta y luces; deja la selección vacía (como Unity). */
  async begin() {
    persistEditorWorkspace()
    const ed = this.ed
    ed.cancelEditorPointer?.('play-transition')
    ed.setGameView(false)
    ed.vp._stopContinuousNavigation?.(true)
    ed.stopCameraPilot?.()
    ed.exitEditMode?.({ silent: true })
    if (ed.paint) await ed.exitPaint() // lo pintado se guarda antes de jugar
    // Las escenas fuente se leen desde la base de datos al entrar en su radio de precarga.
    if (ed.streamingPreview?.pending.has(store.project?.id) && !(await saveNow({ thumb: false }))) {
      throw new Error('No se pudieron guardar las escenas vinculadas antes de iniciar Play')
    }
    const view = ed.vp.saveEditorView() // IMPORTANTE: antes de salir de ortográfica
    const sel = { id: store.selectedId, ids: [...store.selectedIds], scene: store.sceneSel, terrain: store.terrainSel }
    this.saved = { view, lights: store.view.lights, tool: store.tool, sceneId: store.project?.activeSceneId, sel }
    store.view.lights = true // antes de esconder la cuadrícula: el cambio de luces vuelve a aplicar la vista
  }
  /** ¿Se ven las luces de los objetos? (opción «Luces» de la vista). */
  get lightsShown() { return store.view.lights }
  /** Esconde lo del editor que no es del juego (superposición, cuadrícula, anillos, órbita) y enciende las luces. */
  showPlayView() {
    const ed = this.ed, vp = ed.vp
    vp.look.setEditorOutline([], false)
    vp.overlay.visible = vp.grid.visible = vp.controls.enabled = false
    if (ed.ringOuter) ed.ringOuter.visible = ed.ringInner.visible = false
    store.view.lights = true
  }
  /** Al detener: vuelve a la escena que se editaba (el juego pudo cambiar de escena). */
  async returnToScene(switchScene) {
    const s = this.saved
    if (s && store.project && store.project.activeSceneId !== s.sceneId) await switchScene(s.sceneId)
  }
  /** Al detener, con la cámara del visor ya devuelta al editor: restaura vista, herramienta, luces y selección. */
  end() {
    const ed = this.ed, vp = ed.vp, s = this.saved
    vp.overlay.visible = vp.controls.enabled = true
    if (s) {
      vp.restoreEditorView(s.view)
      store.view.lights = s.lights; store.tool = s.tool
    }
    ed.applyView(); ed.syncAll()
    this._restoreSelection({ id: store.selectedId, ids: [...store.selectedIds], scene: store.sceneSel, terrain: store.terrainSel })
    this.saved = null
  }
  /** Vuelve a seleccionar lo que había antes de Jugar (solo los nodos que siguen existiendo en la escena). */
  _restoreSelection(sel) {
    const exists = new Set((store.project?.objects || []).map((o) => o.id))
    const ids = (sel?.ids || []).filter((id) => exists.has(id))
    if (ids.length) {
      store.selectedIds = ids; store.selectedId = exists.has(sel.id) ? sel.id : ids.at(-1)
      store.sceneSel = false
      store.terrainSel = ids.length === 1 && store.project.objects.some(o => o.id === store.selectedId && o.type === 'terrain')
      if (store.terrainSel) {
        store.activePieceId = store.selectedId
        this.ed.setActivePiece(store.selectedId)
        this.ed.setSelection(null, [])
        this.ed._syncTerrainGizmo()
      } else this.ed.setSelection(store.selectedId, store.selectedIds)
      return
    }
    // Compatibilidad con selecciones Terrain anteriores, que no rellenaban selectedId.
    const oldTerrainId = sel?.terrain && exists.has(store.activePieceId) ? store.activePieceId : null
    store.selectedIds = oldTerrainId ? [oldTerrainId] : []
    store.selectedId = oldTerrainId
    store.sceneSel = !!sel?.scene && !oldTerrainId
    store.terrainSel = !!oldTerrainId
    this.ed.setSelection(null, [])
    if (oldTerrainId) { this.ed.setActivePiece(oldTerrainId); this.ed._syncTerrainGizmo() }
  }
}
