// Pintura del objeto bajo el cursor. El trazo modifica los pesos y se confirma una sola vez.
import * as THREE from 'three'
import { store } from '../store.js'
import { paintWeights, ensurePaintWeights } from '../../engine/runtime/mesh/vertex-paint.js'

export const paintInputMethods = {
  _paintHit(e) {
    const r = this.dom.getBoundingClientRect()
    if (!r.width || !r.height) return null
    this.rc.setFromCamera(new THREE.Vector2(
      ((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1), this.vp.camera)
    const hits = this.rc.intersectObject(this.body, false)
    return hits[0]?.point?.toArray() || null
  },
  _paintDab(e) {
    if (!this.paintStroke || !this.paintConfig()) return
    const center = this._paintHit(e)
    if (!center) return
    const last = this.paintStroke.last
    if (last && Math.hypot(...center.map((v,i)=>v-last[i])) < store.edit.paint.radius*0.12) return
    this.paintStroke.last=center
    this.visual.updateWorldMatrix(true,false)
    const t=new THREE.Vector3()
    const positions=this.poly.v.map((p)=>t.set(...p).applyMatrix4(this.visual.matrixWorld).toArray())
    const cfg=store.edit.paint, layer=Math.min(cfg.layer,this.paintConfig().layers.length-1)
    const changed=paintWeights(this.poly,center,positions,{
      layer,radius:cfg.radius,strength:cfg.strength,hardness:cfg.hardness,
      erase:!!e.ctrlKey,
    })
    if (changed) {this.paintStroke.changed=true;this.refresh()}
  },
  _paintCursor(e) {
    if (!store.edit.paint.active) { if (this.svg) this.svg.innerHTML = ''; return }
    const center = this._paintHit(e)
    if (!center) { this.svg.innerHTML = ''; return }
    const local = this._clientToLocal(e)
    const pixels = store.edit.paint.radius / Math.max(1e-6, this._worldPerPx(new THREE.Vector3(...center)))
    const r = Math.min(1000, Math.max(2, pixels))
    this.svg.innerHTML = `<circle cx="${local.x}" cy="${local.y}" r="${r}" fill="none" stroke="#ffc365" stroke-width="1.5" stroke-dasharray="4 3" />`
  },
  _startPaintStroke(e) {
    if (!store.edit.paint.active || this.modal || e.button!==0 || this.vp.isFlying || this.vp.wantsNav(e)) return false
    this.paintStroke={base:this.poly.clone(),changed:false,last:null}
    this._paintDab(e)
    if (e.pointerType === 'mouse') {
      this._continuousGrab?.begin(this.lastClient, (point, move) => {
        const rect = this.dom.getBoundingClientRect()
        const cursor = { clientX: rect.left + point.screen.x, clientY: rect.top + point.screen.y, ctrlKey: move.ctrlKey }
        if (move.buttons & 1) this._paintDab(cursor)
        this._paintCursor(cursor)
      }, reason => { if (reason !== 'denied') this._cancelPaintStroke() }, { operation: 'mesh:paint', pointerId: e.pointerId })
    }
    e.preventDefault();e.stopImmediatePropagation()
    return true
  },
  _finishPaintStroke() {
    if (!this.paintStroke) return false
    const stroke=this.paintStroke;this.paintStroke=null
    this._continuousGrab?.end()
    this._clearSvg()
    if (stroke.changed) {this.dirty=true;this.commit('Pintar malla');this.refresh({geometry:false})}
    return true
  },
  _cancelPaintStroke() {
    if (!this.paintStroke) return false
    const base=this.paintStroke.base;this.paintStroke=null
    this._continuousGrab?.end()
    this._clearSvg()
    this.poly=base;this.refresh()
    return true
  },
}
