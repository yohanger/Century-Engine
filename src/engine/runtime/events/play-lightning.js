// Un solo impacto de la descarga física. Reutiliza raycasts, Jolt, WaterWorld y eventos existentes.
import { groundAtAll } from '../geometry/terrains.js'
import { addRipple } from '../geometry/waterripple.js'

export const lightningMethods = {
  _lightningWorldContext() {
    const groundAt = (x,z) => groundAtAll(this.ed.terrains || [],x,z)
    return { groundAt, intersect: (start,end) => {
      const candidates=[]
      const solid=this.ed.rainImpact(start,end)
      if (solid) candidates.push({ ...solid, kind:'object' })
      const liquid=this.water?.at(end[0],end[2],0)
      // Se utiliza el agua visible más alta delante del terreno, no otra región de simulación.
      if (liquid && Number.isFinite(liquid.surface) && liquid.surface <= start[1] && liquid.surface >= end[1]-0.5)
        candidates.push({ kind:'water', point:[end[0],liquid.surface,end[2]], normal:[0,1,0],
          ownerId:liquid.id||null, surface:'water' })
      candidates.sort((a,b)=>b.point[1]-a.point[1])
      return candidates[0] || null
    } }
  },
  /** Se invoca una sola vez por id (World no repite el evento cuando el canal parpadea). */
  _lightningWorldHit(impact) {
    if (!this.on || this._filmJumping || !impact?.point) return
    const cfg=this.ed.world.cfg.weather
    if (!cfg.lightningImpacts || cfg.lightningModel!=='physical') return
    // Entregar el evento antes de la reacción no muta la geometría: el autor decide qué hacer.
    this.game?.emit('lightningImpact', impact)
    this._destructionIgniteAt?.(impact)
    if (cfg.lightningImpulse && cfg.lightningImpulseStrength>0 && this.phys) {
      this._physicsApiObj ??= this._physicsApi()
      this._physicsApiObj.explode(...impact.point,{radius:cfg.lightningImpactRadius,force:cfg.lightningImpulseStrength})
    }
    if (cfg.lightningWaterResponse && impact.kind==='water' && this.water?.at(impact.point[0],impact.point[2],0)) {
      addRipple(impact.point[0],impact.point[2],Math.min(1.1,0.2+(impact.peakKA/200)))
      // El shader usa la ondulación; no se encola volumen en WaterWorld.
    }
  },
}
