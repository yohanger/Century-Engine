// Modelo macroscópico de vegetación y combustión del tornado. No crea mallas ni partículas.
const bounded = (v, lo, hi, name) => {
  if (!Number.isFinite(v) || v < lo || v > hi) throw new RangeError(`Tornado: ${name} fuera de rango`)
  return v
}
export function vegetationResistance(type = {}) {
  const rootN = bounded(type.rootResistanceN ?? 2400, 20, 100000, 'resistencia de raíz')
  const trunkN = bounded(type.trunkResistanceN ?? 4200, 20, 100000, 'resistencia del tronco')
  return { rootN, trunkN, combustible:type.combustible === true,
    moisture:bounded(type.moisture ?? 0.25, 0, 1, 'humedad'),
    heightM:bounded(type.heightM ?? 4, 0.1, 50, 'altura') }
}
export function vegetationResponse(type, wind, scale = 1, seconds = 1 / 60) {
  const c = vegetationResistance(type)
  if (!wind?.inside || !Number.isFinite(wind.weight) || wind.weight <= 0) return { uproot:false, breakTrunk:false, forceN:0 }
  bounded(scale, 0.01, 50, 'escala');bounded(seconds, 0, 1, 'paso')
  // Carga aerodinámica aproximada sobre área proyectada, sin fatiga invisible acumulada.
  const speed = Math.hypot(wind.x || 0, wind.y || 0, wind.z || 0)
  const projected = c.heightM * scale * Math.max(0.15, c.heightM * 0.15 * scale)
  const forceN = Math.min(3e6, 0.5 * 1.225 * 1.05 * projected * speed * speed)
  return { uproot:forceN >= c.rootN * (1 + c.moisture * 0.35),
    breakTrunk:forceN >= c.trunkN * (1 + c.moisture * 0.2), forceN }
}

// Ignición homogénea y brasas discretas; presupuesto finito y sin reacciones químicas arbitrarias.
export class TornadoCombustion {
  constructor({ maxSources = 64, maxEmbers = 96 } = {}) {
    this.maxSources=bounded(maxSources, 1, 256, 'fuentes máximas')
    this.maxEmbers=bounded(maxEmbers, 1, 512, 'brasas máximas')
    this.sources=new Map();this.embers=[];this.serial=0
  }
  add(id,{x=0,y=0,z=0,fuel=1,moisture=0.25,ignitionK=570,temperatureK=293,combustible=true}={}) {
    if (typeof id !== 'string' || !id || this.sources.has(id) || this.sources.size>=this.maxSources) throw new Error('Fuego: fuente duplicada o capacidad agotada')
    for (const [v,a,b,n] of [[x,-1e5,1e5,'x'],[y,-1e5,1e5,'y'],[z,-1e5,1e5,'z'],[fuel,0,100,'combustible'],[moisture,0,1,'humedad'],[ignitionK,300,2000,'ignición'],[temperatureK,0,2500,'temperatura']]) bounded(v,a,b,n)
    this.sources.set(id,{id,x,y,z,fuel,moisture,ignitionK,temperatureK,combustible:combustible===true,burning:false})
  }
  /** Ajuste de entorno en fuente existente; no reenciende por bajar umbral. */
  configure(id, params) {
    const s=this.sources.get(id)
    if (!s) throw new Error(`Fuego: fuente no disponible «${id}»`)
    const moisture=bounded(params.moisture ?? s.moisture,0,1,'humedad')
    const ignitionK=bounded(params.ignitionK ?? s.ignitionK,300,2000,'ignición')
    s.moisture=moisture;s.ignitionK=ignitionK
    if (s.burning && s.temperatureK < s.ignitionK + 180*s.moisture) s.burning=false
    return s
  }
  ignite(id, heatK) {
    const s=this.sources.get(id)
    if(!s)return false
    bounded(heatK,0,2500,'calor')
    s.temperatureK=Math.max(s.temperatureK,heatK)
    s.burning=s.combustible && s.fuel>0 && s.temperatureK>=s.ignitionK + 180*s.moisture
    return s.burning
  }
  wet(id,waterM3) {
    const s=this.sources.get(id)
    if(!s)return false
    bounded(waterM3,0,10,'volumen de agua')
    s.moisture=Math.min(1,s.moisture+waterM3*8)
    s.temperatureK=Math.max(273,s.temperatureK-waterM3*4000)
    if(s.temperatureK<s.ignitionK+180*s.moisture)s.burning=false
    return true
  }
  step(dt,windAt, groundAt=()=>0) {
    bounded(dt,0.00001,0.1,'paso')
    for(const s of this.sources.values()) {
      if (!s.burning) continue
      s.fuel=Math.max(0,s.fuel-dt*0.012)
      s.temperatureK=Math.min(1400,s.temperatureK+dt*12)
      if (s.fuel<=0) {s.burning=false;continue}
      if(this.embers.length<this.maxEmbers && this.serial % 4===0) this.embers.push({id:++this.serial,x:s.x,y:s.y+0.5,z:s.z,age:0,heatK:Math.min(1200,s.temperatureK)})
      else this.serial++
    }
    const next=[]
    for(const e of this.embers) {
      const w=windAt(e.x,e.y,e.z) || {x:0,y:0,z:0}
      e.x+=Math.max(-80,Math.min(80,w.x||0))*dt*0.12
      e.y+=(Math.max(-20,Math.min(30,w.y||0))*0.12-2*e.age)*dt
      e.z+=Math.max(-80,Math.min(80,w.z||0))*dt*0.12
      e.age+=dt;e.heatK=Math.max(293,e.heatK-25*dt)
      if(e.y<=groundAt(e.x,e.z)+0.4 || e.age>8) {
        for(const s of this.sources.values()) if(Math.hypot(s.x-e.x,s.z-e.z)<0.8 && Math.abs(s.y-e.y)<1.5) this.ignite(s.id,e.heatK)
      } else next.push(e)
    }
    this.embers=next
  }
  snapshot(){return {sources:[...this.sources.values()].map(s=>({...s})),embers:this.embers.map(e=>({...e})),serial:this.serial}}
  restore(v){if(!v||!Array.isArray(v.sources)||v.sources.length!==this.sources.size||!Array.isArray(v.embers)||v.embers.length>this.maxEmbers||!Number.isInteger(v.serial)||v.serial<0)throw new Error('Fuego: snapshot incompatible')
    const map=new Map();for(const s of v.sources){const old=this.sources.get(s.id);if(!old||!['x','y','z','fuel','moisture','ignitionK','temperatureK'].every(k=>Number.isFinite(s[k]))||typeof s.burning!=='boolean'||map.has(s.id))throw new Error('Fuego: fuente de snapshot inválida');map.set(s.id,{...s})}
    for(const e of v.embers)if(!['x','y','z','age','heatK'].every(k=>Number.isFinite(e[k]))||!Number.isInteger(e.id))throw new Error('Fuego: brasa inválida')
    this.sources=map;this.embers=v.embers.map(e=>({...e}));this.serial=v.serial
  }
}
