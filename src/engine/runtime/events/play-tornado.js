// Tornado meteorológico único: consume el World/WindField existente; Jolt y VFX3D son consumidores.
import * as THREE from 'three'

const v = new THREE.Vector3(), MAX_BODIES = 64
export const tornadoMethods = {
  _tornadoInit() {
    this._tornadoInside = new Set(); this._tornadoStarted = false; this._tornadoEnded = false
    this._tornadoPhase = null
  },
  _tornadoEmit(name,extra={}) {
    const t=this.ed.world.tornado
    if (!t) return
    this.game?.emit(name, { id:t.id,position:[t.x,t.y,t.z],radius:t.radius,height:t.height,age:t.age,...extra })
  },
  _tornadoFixed(dt) {
    const w=this.ed.world, t=w.tornado
    if (!t || this._filmJumping) return
    const before = t.phase
    w.tornadoStep(dt)
    if (t.phase === 'development' && this._tornadoEnded) {
      this._tornadoStarted=false; this._tornadoEnded=false; this._tornadoInside.clear()
    }
    if (t.phase !== 'idle' && (before !== t.phase || this._tornadoPhase !== t.phase)) {
      this._tornadoPhase = t.phase
      this._tornadoEmit('tornadoPhase',{phase:t.phase,previous:before})
    }
    if (!this._tornadoStarted && t.active) { this._tornadoStarted=true; this._tornadoEmit('tornadoStart') }
    const next=new Set()
    const bodies=(this._bodies || []).slice(0,MAX_BODIES)
    const playerOn=this.hasPlayer && this.player?.constructor?.id==='fps'
    const entities=playerOn ? [...bodies,{id:'player',position:this.player.pos}] : bodies
    for (const body of entities) {
      if (this._tlBakeOwners?.has(body.id)) continue
      const p=body.position || (this.phys?.bodies?.centerOf(body.item,v))
      if (!p) continue
      const wind=w.tornadoWindAt(p.x,p.y,p.z)
      if (t.active && wind.inside) {
        next.add(body.id)
        if (!this._tornadoInside.has(body.id)) this._tornadoEmit('tornadoEnter',{objectId:body.id})
      } else if (this._tornadoInside.has(body.id)) this._tornadoEmit('tornadoExit',{objectId:body.id})
    }
    this._tornadoInside=next
    if (this._tornadoStarted && t.phase === 'ended' && !this._tornadoEnded) { this._tornadoEnded=true; this._tornadoEmit('tornadoEnd') }
  },
  /** Antes de Jolt: fuerza meteorológica con delta temporal; jamás convierte cuerpos estáticos. */
  _tornadoBodyForces(dt) {
    const w=this.ed.world, t=w.tornado, cfg=w.cfg.weather
    if (!t?.active || !cfg.tornadoBodies || !this.phys?.bodies) return
    const B=this.phys.bodies, bodies=this._bodies || []
    for (let i=0;i<Math.min(MAX_BODIES,bodies.length);i++) {
      const body=bodies[i]
      if (this._tlBakeOwners?.has(body.id)) continue
      const item=body.item, p=B.centerOf(item,v), wind=w.tornadoWindAt(p.x,p.y,p.z)
      if (!wind.inside || wind.weight<=0 || !Number.isFinite(item.mass) || item.mass<=0) continue
      // Aceleración menor para cargas pesadas, máximo impulso por paso acotado.
      const response=Math.min(1.5,0.75/Math.sqrt(Math.max(0.5,item.mass))) * cfg.tornadoForceScale
      const impulseScale=Math.min(20*dt, Math.max(0,dt*response*1.8)) * item.mass
      B.impulse(item,[wind.x*impulseScale,wind.y*impulseScale,wind.z*impulseScale])
    }
  },
  _tornadoReset() {
    this._tornadoInside?.clear()
    this._tornadoStarted=false; this._tornadoEnded=false; this._tornadoPhase=null
  },
}
