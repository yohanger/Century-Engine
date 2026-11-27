// Sesión temporal dentro del Viewport de autoría: reutiliza WebGL, cámara y RAF existentes.
import * as THREE from 'three'
import { VfxSimulation } from '../../engine/runtime/vfx/simulation.js'
import { VfxBillboardRenderer } from '../../engine/runtime/vfx/render.js'

export class VfxPreviewSession {
  constructor(editor, getResource, onState = () => {}) {
    if (!editor?.vp) throw new Error('VFX: viewport editorial no disponible')
    this.editor = editor
    this.vp = editor.vp
    this.getResource = getResource
    this.onState = onState
    this.playing = true
    this.disposed = false
    this.simulation = null
    this.billboard = null
    this.error = ''
    this.signature = ''
    const vp = this.vp
    this.view = vp.saveEditorView()
    this.visibility = { world: vp.world.visible, overlay: vp.overlay.visible, grid: vp.grid?.visible }
    this.group = new THREE.Group()
    this.group.name = 'Previsualización temporal de VFX'
    vp.scene.add(this.group)
    vp.world.visible = false
    vp.overlay.visible = false
    if (vp.grid) vp.grid.visible = false
    vp.persp.position.set(0, 1.4, 4)
    vp.persp.zoom = 1
    vp.persp.updateProjectionMatrix()
    vp.camera = vp.persp
    vp.controls.object = vp.persp
    vp.controls.target.set(0, 0.5, 0)
    vp.controls.update()
    this.tick = (dt) => this.frame(dt)
    this.offFrame = vp.onFrame(this.tick)
    this.reset()
  }

  _dropRenderer() {
    this.billboard?.dispose()
    this.billboard = null
    this.simulation = null
  }

  reset() {
    if (this.disposed) return
    this._dropRenderer()
    this.signature = ''
    this.error = ''
    this._ensure()
    this.onState()
    this.vp.requestRender()
  }

  _ensure() {
    const resource = this.getResource()
    if (!resource) { this.error = 'Recurso VFX no disponible'; return }
    const signature = JSON.stringify(resource)
    if (signature === this.signature && this.billboard) return
    if (signature !== this.signature) { this._dropRenderer(); this.signature = signature }
    const id = resource.appearance.textureId
    const texture = id ? this.editor.spriteTexture(id) : null
    if (id && !texture) {
      this.error = `Esperando textura: ${id}`
      return
    }
    try {
      this.simulation = new VfxSimulation(resource, { seed: 1 })
      this.billboard = new VfxBillboardRenderer(this.simulation, { texture })
      this.group.add(this.billboard.mesh)
      this.billboard.sync(this.vp.camera)
      this.error = ''
      this.vp.requestRender()
    } catch (error) {
      this._dropRenderer()
      this.error = error.message || String(error)
    }
  }

  frame(dt) {
    if (this.disposed) return false
    this._ensure()
    if (!this.simulation) { this.onState(); return false }
    if (this.playing) this.simulation.update(dt)
    this.billboard.sync(this.vp.camera)
    this.onState()
    return this.playing
  }

  step() {
    if (this.disposed) return
    this.playing = false
    this._ensure()
    this.simulation?.update(1 / 60)
    this.billboard?.sync(this.vp.camera)
    this.onState()
    this.vp.requestRender()
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.offFrame?.()
    this._dropRenderer()
    this.group.parent?.remove(this.group)
    this.vp.world.visible = this.visibility.world
    this.vp.overlay.visible = this.visibility.overlay
    if (this.vp.grid && this.visibility.grid !== undefined) this.vp.grid.visible = this.visibility.grid
    this.vp.restoreEditorView(this.view)
    this.vp.requestRender()
  }
}
