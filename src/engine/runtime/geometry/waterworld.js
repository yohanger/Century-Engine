// WaterWorld: autoridad del inventario y del muestreo físico del agua.
// CA-005: Lago/Río consultan WaterRegion (aguas someras 2.5D),
// mientras Océano/círculo mantienen sus dominios tradicionales fuera de S01-G001.
// Los parámetros de autoría describen las formas; el estado simulado manda
// sobre superficie, corriente y respuesta física en regiones nativas.
import { collectWaterBodies, riverLine } from './waterfx.js'
import { waveSet } from './water.js'
import { WaterRegion } from './water-solver.js'
const containerSpec = (...args) => WaterRegion.containerSpec(...args)
const containerOutflow = (...args) => WaterRegion.containerOutflow(...args)

const hyp = Math.hypot

/** Altura de las olas grandes en (x,z) con un `waveSet` ya resuelto (igual que rtWaves en el shader). */
export function waveHeight(set, x, z, t) {
  let h = 0
  for (const o of set.big) h += o.amp * Math.sin(o.k * (o.dx * x + o.dz * z) - o.om * t + o.ph)
  return h
}

export class WaterWorld {
  /** @param bodies salida de collectWaterBodies(project.objects) */
  constructor(bodies = []) {
    this.bodies = bodies.map((b) => this._prepare(b))
    this.regions = new Map()
    this.runoff = new Map() // película y aportes de lluvia dentro de la autoridad WaterWorld
    // S05: sólo se guardan peticiones entre regiones existentes; nunca otro estado de agua.
    this.transfers = []
    this.transferredVolume = 0
    this.completedTransferIds = [] // antirrepetición acotada, persistida con el snapshot
    this.transferHistory = [] // comprobantes de origen/destino; no almacena otro volumen físico
    this.couplings = [] // puertos explícitos, NO convierten cuerpos heredados en volúmenes finitos
    this.coupledInM3 = 0; this.coupledOutM3 = 0
    this.displacementEnabled = false
    this.containerParcels = []
    this.containers = new Map() // autoridad de volúmenes contenidos; no crea regiones paralelas
    this.containerDelivered = new Map() // transferencia interna hacia regiones (por identidad)
    this.containerExternalOut = new Map() // derrames que abandonaron el dominio simulado
    this.suspensionEnabled=false;this.suspended=[];this.suspendedLiftM3=0;this.suspendedDepositM3=0;this.suspendedExitM3=0;this.suspendedBoundaryInM3=0;this.suspendedSerial=0
  }

  static fromObjects(objects) { return new WaterWorld(collectWaterBodies(objects || [])) }

  get empty() { return this.bodies.length === 0 && this.regions.size === 0 && this.containers.size === 0 }

  /** Crea una región física. Dentro de su huella manda el solver, incluso si está seca. */
  addRegion(config) {
    const region = new WaterRegion(config)
    if (this.regions.has(region.id) || this.bodies.some((b) => b.id === region.id)) throw new Error(`Agua: id duplicado «${region.id}»`)
    for (const other of this.regions.values()) {
      if (region.x < other.x + other.width * other.dx && other.x < region.x + region.width * region.dx &&
          region.z < other.z + other.height * other.dz && other.z < region.z + region.height * region.dz)
        throw new Error(`Agua: regiones solapadas «${region.id}» y «${other.id}»`)
    }
    this.regions.set(region.id, region)
    return region
  }

  /** Configura película de escurrimiento sobre celdas de una región; no crea un segundo solver. */
  setRunoff(id, samples) {
    const region = this.regions.get(id)
    if (!region) throw new Error('Escurrimiento: región inexistente')
    const geometry = WaterRegion.runoffGeometry(region, samples)
    const old = this.runoff.get(id)
    if (!old && !geometry.cells.some(Boolean)) return
    if (old?.signature === geometry.signature) return
    const stored = new Float64Array(geometry.cells.length)
    const pending = new Float64Array(geometry.cells.length)
    const ledger = old ? { ...old.ledger } : { rain: 0, delivered: 0, exited: 0 }
    if (old) {
      for (let k = 0; k < stored.length; k++) {
        if (geometry.cells[k] && geometry.cells[k]?.owner === old.cells[k]?.owner) {
          stored[k] = old.stored[k]; pending[k] = old.pending[k]
        } else {
          // Al cambiar el relieve, buscar un receptor válido o registrar salida externa.
          const volume = old.stored[k], inflow = old.pending[k]
          let dest = k
          if (!region.valid[k]) {
            const col = k % region.width, row = Math.floor(k / region.width)
            let distance = Infinity; dest = -1
            for (let n = 0; n < region.valid.length; n++) {
              if (!region.valid[n]) continue
              const d = Math.abs(n % region.width - col) + Math.abs(Math.floor(n / region.width) - row)
              if (d < distance) { dest = n; distance = d }
            }
          }
          if (dest >= 0) {
            if (volume > 0) { region.queue(dest % region.width, Math.floor(dest / region.width), volume); ledger.delivered += volume }
            if (inflow > 0) region.queue(dest % region.width, Math.floor(dest / region.width), inflow)
          } else {
            // Desapareció todo el suelo válido: volumen fuera del dominio, explícito.
            ledger.exited += volume + inflow
            ledger.rain += inflow
          }
        }
      }
    }
    this.runoff.set(id, { id, ...geometry, stored, pending, ledger })
  }

  /** La precipitación se encola; los shaders y partículas no llaman esta API. */
  rainOnRunoff(id, col, row, volumeM3) {
    const film = this.runoff.get(id), region = this.regions.get(id)
    if (!film || !region) throw new Error('Escurrimiento: región no configurada')
    const k = region.cell(col, row)
    if (!film.cells[k] || !Number.isFinite(volumeM3) || volumeM3 < 0)
      throw new RangeError('Escurrimiento: aporte inválido')
    if (!Number.isFinite(film.pending[k] + volumeM3)) throw new RangeError('Escurrimiento: acumulación no finita')
    film.pending[k] += volumeM3
  }

  runoffCell(id, col, row) {
    const film = this.runoff.get(id), region = this.regions.get(id)
    if (!film || !region) return null
    const k = region.cell(col, row)
    return film.cells[k] ? { ...film.cells[k], volumeM3: film.stored[k], pendingM3: film.pending[k] } : null
  }

  /** Describe un dominio: los cuerpos heredados no se contabilizan como masa finita. */
  liquidDomain(id) {
    const region = this.regions.get(id)
    if (region) return { id, kind: 'region', finite: true, liquid: region.liquid, volumeM3: region.totalVolume() + (this.runoff.get(id)?.stored.reduce((a, b) => a + b, 0) || 0),
      ...(region.hydrology && { surfaceM3: region.volume(), soilM3: region.storedVolume() }) }
    const body = this.bodies.find((b) => b.id === id)
    if (body) return { id, kind: 'legacy-boundary', finite: false, liquid: WaterRegion.liquid, volumeM3: null }
    return null
  }

  /** Presupuesto finito de agua: las transferencias internas se restan de entradas/salidas externas. */
  liquidBalance() {
    let initial = 0, volume = 0, added = 0, drained = 0, exited = 0
    for (const r of this.regions.values()) {
      initial += r.initialVolume + (r.hydrology?.initialVolume || 0); volume += r.totalVolume()
      added += r.ledger.added; drained += r.ledger.drained; exited += r.ledger.exited
    }
    const films = [...this.runoff.values()]
    const filmM3 = films.reduce((sum, f) => sum + f.stored.reduce((a, b) => a + b, 0), 0)
    const filmAdded = films.reduce((sum, f) => sum + f.ledger.rain, 0)
    const filmDelivered = films.reduce((sum, f) => sum + f.ledger.delivered, 0)
    const filmExited = films.reduce((sum, f) => sum + f.ledger.exited, 0)
    volume += filmM3
    const airborne = this.suspended.reduce((a,p)=>a+p.volumeM3,0)
    volume += airborne
    const externalIn = added - this.transferredVolume - filmDelivered + filmAdded - this.suspendedDepositM3 + this.suspendedBoundaryInM3
    const externalDrain = drained - this.transferredVolume - (this.suspendedLiftM3-this.suspendedBoundaryInM3)
    const errorM3 = volume - (initial + externalIn - externalDrain - exited - filmExited - this.suspendedExitM3)
    const soilM3 = [...this.regions.values()].reduce((sum, r) => sum + r.storedVolume(), 0)
    return { soilM3, surfaceM3: volume - soilM3, liquidId: WaterRegion.liquid.id, densityKgM3: WaterRegion.liquid.densityKgM3,
      initialM3: initial, currentM3: volume, surfaceFilmM3: filmM3, externalInM3: externalIn, externalDrainM3: externalDrain,
      openBoundaryOutM3: exited + filmExited, internalTransferredM3: this.transferredVolume + filmDelivered,
      coupledBoundaryInM3: this.coupledInM3, coupledBoundaryOutM3: this.coupledOutM3,
      suspendedM3: airborne, suspendedExitedM3: this.suspendedExitM3, suspendedBoundaryInM3: this.suspendedBoundaryInM3, massKg: volume * WaterRegion.liquid.densityKgM3, errorM3,
      errorKg: errorM3 * WaterRegion.liquid.densityKgM3 }
  }

  /** La configuración del recipiente procede del nodo o prefab; el estado dinámico pertenece solo a WaterWorld. */
  addContainer(config, pose = { position:[0,0,0], quaternion:[0,0,0,1] }) {
    const spec = containerSpec(config)
    if (this.containers.has(spec.id) || this.regions.has(spec.id) || this.bodies.some((b)=>b.id===spec.id))
      throw new Error('Recipiente: identificador duplicado')
    // Validar pose sin alterar el mundo.
    containerOutflow({ ...spec, volumeM3:spec.initialM3 }, 1/60, pose)
    const state = { ...spec, volumeM3: spec.initialM3, pose: structuredClone(pose) }
    if (spec.simulation==='particles') {
      if ([...this.containers.values()].filter(c=>c.fluid).length>=8) throw new Error('Recipiente: máximo 8 envases de partículas activos')
      Object.defineProperty(state,'fluid',{value:WaterRegion.createContainerFluid(spec,pose),enumerable:false})
    }
    this.containers.set(spec.id,state)
    return this.containerState(spec.id)
  }
  containerState(id) {
    const c=this.containers.get(id)
    return c ? { ...c, size:[...c.size], liquid:{...c.liquid}, pose:structuredClone(c.pose) } : null
  }
  /** Cambia la geometría de un recipiente activo sin crear/retirar fluido.
   * Valida primero la capacidad contra el volumen físico actual y la pose.
   * El inventario y su ledger conservan la misma identidad, masa y volumen. */
  setContainerGeometry(id, patch) {
    const c=this.containers.get(id)
    if (!c) throw new Error('Recipiente: no existe')
    const next=containerSpec({ ...c, ...patch, initialM3:0 })
    if (c.volumeM3 > next.capacityM3 + 1e-12)
      throw new RangeError('Recipiente: capacidad temporal inferior al líquido contenido')
    containerOutflow({ ...c, ...next, volumeM3:c.volumeM3 },1/60,c.pose)
    c.shape=next.shape
    c.size=[...next.size]
    c.capacityM3=next.capacityM3
    for (const key of ['vessel','mouthRadius','neckHeight','closed']) c[key]=next[key]
    c.fluid?.setSpec(c)
    return this.containerState(id)
  }
  setContainerPourRate(id, value) {
    const c=this.containers.get(id)
    if (!c) throw new Error('Recipiente: no existe')
    // Usa las mismas validaciones del constructor autoral, pero preserva el volumen dinámico.
    const next=containerSpec({...c,pourRate:value})
    c.pourRate=next.pourRate
  }
  setContainerPose(id, pose) {
    const c=this.containers.get(id)
    if (!c) throw new Error('Recipiente: no existe')
    containerOutflow(c,1/60,pose) // validación previa de orientación
    c.pose=structuredClone(pose)
  }
  /** Transferencia conservativa explícita; un destino nulo representa salida del dominio, nunca un charco ficticio. */
  pourContainer(id, volumeM3, destination = null) {
    const c=this.containers.get(id)
    if (!c) throw new Error('Recipiente: no existe')
    if (!Number.isFinite(volumeM3) || volumeM3<=0 || volumeM3>c.volumeM3+1e-12)
      throw new RangeError('Recipiente: volumen de vertido inválido')
    let region=null, col, row
    if (destination) {
      region=this.regions.get(destination.regionId)
      if (!region) throw new Error('Recipiente: región receptora inexistente')
      col=destination.col;row=destination.row
      const k=region.cell(col,row)
      if (!region.valid[k]) throw new Error('Recipiente: celda receptora inválida')
      if (region.liquid.id!==c.liquid.id || region.liquid.densityKgM3!==c.liquid.densityKgM3)
        throw new Error('Recipiente: líquidos incompatibles; no se mezclan')
    }
    const amount=Math.min(c.volumeM3,volumeM3)
    // El único commit crea el aporte pendiente de región o la salida explícita.
    if (region) region.queue(col,row,amount)
    c.volumeM3=Math.max(0,c.volumeM3-amount)
    c.fluid?.setVolume(c.volumeM3)
    const map=region?this.containerDelivered:this.containerExternalOut
    map.set(c.liquid.id,(map.get(c.liquid.id)||0)+amount)
    return amount
  }
  /** Balance de masa separado por sustancia. La región solo acepta perfiles homogéneos. */
  liquidBalances() {
    const ids=new Set([...this.containers.values()].map((c)=>c.liquid.id))
    for (const r of this.regions.values()) ids.add(r.liquid.id)
    const out={}
    for (const id of ids) {
      const regions=[...this.regions.values()].filter((r)=>r.liquid.id===id)
      const containers=[...this.containers.values()].filter((c)=>c.liquid.id===id)
      const density=(regions[0]?.liquid||containers[0]?.liquid).densityKgM3
      if ([...regions,...containers].some((v)=>v.liquid.densityKgM3!==density)) throw new Error('Líquido: densidades incompatibles')
      const sum=(items,fn)=>items.reduce((a,v)=>a+fn(v),0)
      const initialM3=sum(regions,(r)=>r.initialVolume+(r.hydrology?.initialVolume||0))+sum(containers,(c)=>c.initialM3)
      const filmM3=id==='water'?[...this.runoff.values()].reduce((a,f)=>a+f.stored.reduce((x,y)=>x+y,0),0):0
      const filmIn=id==='water'?[...this.runoff.values()].reduce((a,f)=>a+f.ledger.rain-f.ledger.delivered,0):0
      const filmOut=id==='water'?[...this.runoff.values()].reduce((a,f)=>a+f.ledger.exited,0):0
      const airborneM3=(id==='water'?this.suspended.reduce((a,p)=>a+p.volumeM3,0):0)+this.containerParcels.filter(p=>p.liquidId===id).reduce((a,p)=>a+p.volumeM3,0)
      const regionM3=sum(regions,(r)=>r.totalVolume())+filmM3+airborneM3
      const containedM3=sum(containers,(c)=>c.volumeM3)
      const externalInM3=sum(regions,(r)=>r.ledger.added)-(this.containerDelivered.get(id)||0)-(id==='water'?this.transferredVolume:0)+filmIn+(id==='water'?this.suspendedBoundaryInM3-this.suspendedDepositM3:0)
      const externalOutM3=sum(regions,(r)=>r.ledger.drained+r.ledger.exited)+(this.containerExternalOut.get(id)||0)-(id==='water'?this.transferredVolume:0)+filmOut+(id==='water'?this.suspendedExitM3-this.suspendedLiftM3+this.suspendedBoundaryInM3:0)
      const currentM3=regionM3+containedM3
      out[id]={ liquidId:id,densityKgM3:density,initialM3,currentM3,containedM3,regionM3,
        externalInM3,externalOutM3,massKg:currentM3*density,
        errorM3:currentM3-(initialM3+externalInM3-externalOutM3) }
    }
    return out
  }
  /** Verter A → B sin usar colas externas; el receptor lleno rechaza el excedente sin perderlo. */
  transferContainer(fromId, toId, volumeM3) {
    const from=this.containers.get(fromId),to=this.containers.get(toId)
    if (!from || !to || from===to) throw new Error('Recipiente: origen y destino inválidos')
    if (from.liquid.id!==to.liquid.id || from.liquid.densityKgM3!==to.liquid.densityKgM3)
      throw new Error('Recipiente: líquidos incompatibles')
    if (!Number.isFinite(volumeM3) || volumeM3<=0) throw new RangeError('Recipiente: volumen inválido')
    const moved=Math.min(volumeM3,from.volumeM3,to.capacityM3-to.volumeM3)
    if (moved<=1e-15) return 0
    from.volumeM3=Math.max(0,from.volumeM3-moved);to.volumeM3=Math.min(to.capacityM3,to.volumeM3+moved)
    from.fluid?.setVolume(from.volumeM3);to.fluid?.setVolume(to.volumeM3)
    return moved
  }
  /** Calcula vertido desde la pose mundial; el destino es una región física compatible o una salida contabilizada. */
  _advanceContainers(dt) {
    WaterRegion.advanceParticleContainers(this,dt)
    for (const c of this.containers.values()) {
      if(c.fluid)continue
      const { surface, volumeM3 }=containerOutflow(c,dt,c.pose)
      if (volumeM3<=0) continue
      const [x,edgeY,z]=surface.edge
      // Un recipiente abierto y horizontal bajo la salida recibe el líquido primero.
      // No crea otra cola ni mezcla sustancias; el excedente continúa hacia la región.
      let remaining=volumeM3
      const receiver=[...this.containers.values()].find((target)=>{
        if(target.id===c.id || target.liquid.id!==c.liquid.id ||
            target.liquid.densityKgM3!==c.liquid.densityKgM3 || target.capacityM3-target.volumeM3<=1e-15) return false
        const q=target.pose.quaternion
        const upright=1-2*(q[0]*q[0]+q[2]*q[2])
        return upright>0.97 && edgeY>target.pose.position[1]+target.size[1]/2 &&
          Math.abs(x-target.pose.position[0])<target.size[0]*0.45 &&
          Math.abs(z-target.pose.position[2])<target.size[2]*0.45
      })
      if(receiver) remaining-=this.transferContainer(c.id,receiver.id,remaining)
      if(remaining<=1e-15) continue
      const region=[...this.regions.values()].find((r)=>r.contains(x,z))
      const col=region?Math.floor((x-region.x)/region.dx):null
      const row=region?Math.floor((z-region.z)/region.dz):null
      if (region && region.valid[region.cell(col,row)]) {
        // Identidades diferentes: no vierte ni destruye líquido.
        if (region.liquid.id!==c.liquid.id || region.liquid.densityKgM3!==c.liquid.densityKgM3) continue
        this.pourContainer(c.id,remaining,{regionId:region.id,col,row})
      } else this.pourContainer(c.id,remaining) // dominio sin receptor: salida explícita
    }
  }

  /** CA-004: toma una cantidad del solver; su inventario pasa a agua suspendida, no desaparece. */
  liftWater(regionId,col,row,volumeM3,position) {
    if(!this.suspensionEnabled)throw new Error('Tornado: suspensión desactivada')
    const r=this.regions.get(regionId)
    if(!r||r.liquid.id!=='water')throw new Error('Tornado: región de agua incompatible')
    const k=r.cell(col,row)
    if(!Array.isArray(position)||position.length!==3||position.some(v=>!Number.isFinite(v))||!Number.isFinite(volumeM3)||volumeM3<=0)throw new RangeError('Tornado: extracción inválida')
    if(this.suspended.length>=64)return 0
    let available=r.depth[k]*r.dx*r.dz
    for(const [idx,v] of r.pending)if(idx===k)available+=v
    const take=Math.min(volumeM3,Math.max(0,available))
    if(take<=1e-12)return 0
    r.queue(col,row,-take)
    this.suspended.push({id:`s-${++this.suspendedSerial}`,position:[...position],origin:regionId,volumeM3:take,age:0})
    this.suspendedLiftM3+=take
    return take
  }
  /** Frontera oceánica heredada: entrada externa explícita, sin inventar un depósito finito. */
  liftLegacyWater(bodyId,x,z,volumeM3) {
    if(!this.suspensionEnabled)throw new Error('Tornado: suspensión desactivada')
    if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(volumeM3)||volumeM3<=0)throw new RangeError('Tornado: extracción de frontera inválida')
    if(this.suspended.length>=64)return 0
    const body=this.legacyAt(x,z,0,bodyId)
    if(!body)throw new Error('Tornado: fuera de frontera oceánica')
    const amount=Math.min(volumeM3,0.1)
    this.suspended.push({id:`s-${++this.suspendedSerial}`,origin:bodyId,position:[x,body.surface+0.3,z],volumeM3:amount,age:0})
    this.suspendedLiftM3+=amount;this.suspendedBoundaryInM3+=amount
    return amount
  }

  /** Advección acotada. Si no existe receptor, el agua sale explícitamente del dominio. */
  advanceSuspended(dt,windAt,groundAt=()=>0) {
    if(!this.suspensionEnabled)return
    if(!Number.isFinite(dt)||dt<=0||dt>0.1)throw new RangeError('Tornado: paso suspendido inválido')
    const keep=[], landed=[]
    for(const p of this.suspended) {
      const [x,y,z]=p.position,w=windAt(x,y,z)||{x:0,y:0,z:0}
      p.position=[x+Math.max(-90,Math.min(90,w.x||0))*dt*0.3,
        y+Math.max(-30,Math.min(45,w.y||0))*dt*0.25-2*dt*p.age,
        z+Math.max(-90,Math.min(90,w.z||0))*dt*0.3]
      p.age+=dt
      if(p.position[1]>groundAt(p.position[0],p.position[2])+0.1 && p.age<15){keep.push(p);continue}
      const r=[...this.regions.values()].find(r=>r.liquid.id==='water'&&r.contains(p.position[0],p.position[2]))
      landed.push({position:[...p.position],volumeM3:p.volumeM3})
      if(r){const col=Math.floor((p.position[0]-r.x)/r.dx),row=Math.floor((p.position[2]-r.z)/r.dz)
        const k=row*r.width+col
        if(r.valid[k]){r.queue(col,row,p.volumeM3);this.suspendedDepositM3+=p.volumeM3;continue}}
      this.suspendedExitM3+=p.volumeM3
    }
    this.suspended=keep
    return landed // puntos de contacto para enfriamiento; no altera la contabilidad
  }

  /** Captura el estado real de las regiones y transacciones diferidas; compatible con v1 al restaurar. */
  snapshot() {
    return { version: ([...this.containers.values()].some(c=>c.fluid)||this.containerParcels.length) ? 8 : this.suspensionEnabled ? 7 : (this.containers.size ? 6 : (this.couplings.length || this.displacementEnabled ? 5 : (this.runoff.size ? 4 : ([...this.regions.values()].some((r) => r.hydrology) ? 3 : 2)))),
      ...(this.couplings.length || this.displacementEnabled || this.containers.size || this.suspensionEnabled ? { couplingSignature: JSON.stringify(this.couplings),
        coupledInM3: this.coupledInM3, coupledOutM3: this.coupledOutM3, displacementEnabled: this.displacementEnabled } : {}),
      ...((this.runoff.size || this.couplings.length || this.displacementEnabled || this.containers.size || this.suspensionEnabled) && { runoff: [...this.runoff.values()].map((f) => ({ id: f.id, signature: f.signature,
        stored: Array.from(f.stored), pending: Array.from(f.pending), ledger: { ...f.ledger } })) }), regions: [...this.regions.values()].map((r) => r.snapshot()),
      ...(this.containers.size && { containers:[...this.containers.values()].map((c)=>({ id:c.id, liquidId:c.liquid.id,
        volumeM3:c.volumeM3,pose:structuredClone(c.pose),...(c.fluid&&{particles:c.fluid.snapshot()}) })),
        containerDelivered:Object.fromEntries(this.containerDelivered),
        containerExternalOut:Object.fromEntries(this.containerExternalOut) }),
      ...(([...this.containers.values()].some(c=>c.fluid)||this.containerParcels.length)&&{
        containerParcels:structuredClone(this.containerParcels),spillRegions:[...this.regions.values()].filter(r=>r._spillConfig).map(r=>structuredClone(r._spillConfig))}),
      ...(this.suspensionEnabled && {suspension:{active:true,liftM3:this.suspendedLiftM3,
        depositM3:this.suspendedDepositM3,exitM3:this.suspendedExitM3,boundaryInM3:this.suspendedBoundaryInM3,serial:this.suspendedSerial,
        parcels:this.suspended.map(p=>({...p,position:[...p.position]}))}}),
      transfers: this.transfers.map((t) => ({ from: { ...t.from }, to: { ...t.to }, volumeM3: t.volumeM3, requestId: t.requestId })),
      transferredVolume: this.transferredVolume, completedTransferIds: [...this.completedTransferIds],
      transferHistory: this.transferHistory.map((t) => ({ from: { ...t.from }, to: { ...t.to }, volumeM3: t.volumeM3, requestId: t.requestId })) }
  }

  restore(snapshot) {
    if (!snapshot || ![1,2,3,4,5,6,7,8].includes(snapshot.version) || !Array.isArray(snapshot.regions))
      throw new Error('Agua: snapshot incompatible')
    const restoreRegions=new Map(this.regions)
    if(snapshot.version===8){
      if(!Array.isArray(snapshot.spillRegions)||snapshot.spillRegions.length>32)throw new Error('Recipiente: dominios de derrame inválidos')
      for(const [id,r] of restoreRegions)if(r._spillConfig)restoreRegions.delete(id)
      for(const config of snapshot.spillRegions){
        if(!config?.id?.startsWith('spill:')||restoreRegions.has(config.id)||config.width!==6||config.height!==6)throw new Error('Recipiente: región de derrame inválida')
        const r=new WaterRegion(config);r._spillConfig=structuredClone(config);restoreRegions.set(r.id,r)
      }
    }
    if(snapshot.version===8){
      const domains=[...restoreRegions.values()]
      if(domains.length>32||domains.reduce((sum,r)=>sum+r.width*r.height,0)>4096)throw new Error('Recipiente: presupuesto de derrames inválido')
      for(let i=0;i<domains.length;i++)for(let j=i+1;j<domains.length;j++){
        const a=domains[i],b=domains[j]
        if(a.x<b.x+b.width*b.dx&&b.x<a.x+a.width*a.dx&&a.z<b.z+b.height*b.dz&&b.z<a.z+a.height*a.dz)throw new Error('Recipiente: derrames solapados')
      }
    }
    if(snapshot.regions.length!==restoreRegions.size)throw new Error('Agua: snapshot incompatible')
    const seen = new Set(), checked = []
    for (const saved of snapshot.regions) {
      if (!saved || seen.has(saved.id)) throw new Error('Agua: región duplicada en snapshot')
      seen.add(saved.id)
      const region = restoreRegions.get(saved.id)
      if (!region) throw new Error(`Agua: región desconocida «${saved.id}»`)
      checked.push([region, region.validateSnapshot(saved)])
    }
    let transfers = [], transferredVolume = 0, completed = [], history = []
    if (snapshot.version >= 2) {
      if (!Array.isArray(snapshot.transfers) || snapshot.transfers.length > 4096 ||
          !Number.isFinite(snapshot.transferredVolume) || snapshot.transferredVolume < 0 ||
          !Array.isArray(snapshot.completedTransferIds) || snapshot.completedTransferIds.length > 256)
        throw new Error('Agua: transferencias del snapshot inválidas')
      transferredVolume = snapshot.transferredVolume
      completed = [...snapshot.completedTransferIds]
      if (completed.some((x) => typeof x !== 'string' || !x.trim()) || new Set(completed).size !== completed.length)
        throw new Error('Agua: identificadores de transferencia inválidos')
      const seenTransfer = new Set(completed)
      transfers = snapshot.transfers.map((t) => {
        const transfer = this._checkedTransfer(t?.from, t?.to, t?.volumeM3, t?.requestId)
        if (transfer.requestId) {
          if (seenTransfer.has(transfer.requestId)) throw new Error('Agua: transferencia duplicada en snapshot')
          seenTransfer.add(transfer.requestId)
        }
        return transfer
      })
      // La contabilidad acumulada interna no puede superar ningún lado de los ledgers existentes.
      const totalIn = checked.reduce((s, [r, v]) => s + v.ledger.added, 0)
      const totalOut = checked.reduce((s, [r, v]) => s + v.ledger.drained, 0)
      if (transferredVolume > Math.min(totalIn, totalOut) + 1e-7)
        throw new Error('Agua: contabilidad de transferencias incompatible')
      if (snapshot.transferHistory != null) {
        if (!Array.isArray(snapshot.transferHistory) || snapshot.transferHistory.length > 256)
          throw new Error('Agua: historial de transferencias inválido')
        history = snapshot.transferHistory.map((t) => this._checkedTransfer(t?.from, t?.to, t?.volumeM3, t?.requestId))
        if (history.reduce((sum, t) => sum + t.volumeM3, 0) > transferredVolume + 1e-7)
          throw new Error('Agua: historial supera la contabilidad de transferencias')
      }
      this._validateTransferBudget(transfers, checked)
    }
    let films = []
    if (snapshot.version >= 4) {
      if (!Array.isArray(snapshot.runoff) || snapshot.runoff.length !== this.runoff.size ||
          new Set(snapshot.runoff.map((f) => f?.id)).size !== snapshot.runoff.length)
        throw new Error('Escurrimiento: dominios del snapshot incompatibles')
      films = snapshot.runoff.map((s) => {
        const film = this.runoff.get(s?.id)
        if (!film) throw new Error('Escurrimiento: superficie ausente en snapshot')
        return [film, WaterRegion.validateRunoffSnapshot(film, s)]
      })
    } else if (this.runoff.size) {
      // Snapshots anteriores a S07 son válidos sobre la misma escena: la película empieza seca.
      films = [...this.runoff.values()].map((f) => [f, { stored: new Float64Array(f.cells.length),
        pending: new Float64Array(f.cells.length), ledger: { rain: 0, delivered: 0, exited: 0 } }])
    }
    if (snapshot.version >= 5 && (snapshot.couplingSignature !== JSON.stringify(this.couplings) ||
        snapshot.displacementEnabled !== this.displacementEnabled ||
        !Number.isFinite(snapshot.coupledInM3) || snapshot.coupledInM3 < 0 ||
        !Number.isFinite(snapshot.coupledOutM3) || snapshot.coupledOutM3 < 0))
      throw new Error('Agua: acoplamiento del snapshot incompatible')
    // La validación completa de recipientes ocurre antes del primer commit a regiones.
    let checkedContainers=[], delivered=new Map(), outside=new Map()
    const containerParcels=snapshot.version===8 ? WaterRegion.validateContainerParcels(this,snapshot.containerParcels) : []
    if (snapshot.version>=6 && this.containers.size) {
      if (!Array.isArray(snapshot.containers) || snapshot.containers.length!==this.containers.size ||
          new Set(snapshot.containers.map((c)=>c?.id)).size!==snapshot.containers.length)
        throw new Error('Recipiente: snapshot incompatible')
      checkedContainers=snapshot.containers.map((v)=>{
        const c=this.containers.get(v?.id)
        if (!c || v.liquidId!==c.liquid.id || !Number.isFinite(v.volumeM3) ||
            v.volumeM3<0 || v.volumeM3>c.capacityM3+1e-10) throw new Error('Recipiente: snapshot inválido')
        containerOutflow({ ...c, volumeM3:v.volumeM3 },1/60,v.pose)
        if(c.fluid){if(!v.particles)throw new Error('Recipiente: snapshot sin partículas');v={...v,particles:c.fluid.validateSnapshot(v.particles,v.volumeM3)}}
        else if(v.particles)throw new Error('Recipiente: simulación de snapshot incompatible')
        return [c,v]
      })
      const mapOf=(data)=>{
        if (!data || typeof data!=='object' || Array.isArray(data)) throw new Error('Recipiente: balance de snapshot inválido')
        const map=new Map(Object.entries(data))
        for (const [key,v] of map) if (![...this.containers.values()].some((c)=>c.liquid.id===key) ||
            !Number.isFinite(v) || v<0) throw new Error('Recipiente: contabilidad de snapshot inválida')
        return map
      }
      delivered=mapOf(snapshot.containerDelivered);outside=mapOf(snapshot.containerExternalOut)
      // Balance completo previo al commit: no aceptar una instantánea que fabrique masa.
      for (const id of new Set(checkedContainers.map(([,v])=>v.liquidId))) {
        const rc=checked.filter(([r])=>r.liquid.id===id)
        const initial=checkedContainers.filter(([,v])=>v.liquidId===id).reduce((a,[c])=>a+c.initialM3,0)+rc.reduce((a,[r,v])=>a+v.initialVolume+(v.initialSoil||0),0)
        const actual=checkedContainers.filter(([,v])=>v.liquidId===id).reduce((a,[,v])=>a+v.volumeM3,0)+rc.reduce((a,[r,v])=>a+v.depth.reduce((x,y)=>x+y,0)*r.dx*r.dz+(v.soil?.reduce((x,y)=>x+y,0)||0)*r.dx*r.dz,0)+(id==='water'&&snapshot.version>=7?snapshot.suspension?.parcels?.reduce((a,p)=>a+p.volumeM3,0)||0:0)
        const filmM3=id==='water'?films.reduce((a,[,f])=>a+f.stored.reduce((x,y)=>x+y,0),0):0
        const filmIn=id==='water'?films.reduce((a,[,f])=>a+f.ledger.rain-f.ledger.delivered,0):0
        const filmOut=id==='water'?films.reduce((a,[,f])=>a+f.ledger.exited,0):0
        const inserted=rc.reduce((a,[,v])=>a+v.ledger.added,0)-(delivered.get(id)||0)-(id==='water'?transferredVolume:0)+filmIn+(id==='water'&&snapshot.version>=7?(snapshot.suspension?.boundaryInM3||0)-(snapshot.suspension?.depositM3||0):0)
        const removed=rc.reduce((a,[,v])=>a+v.ledger.drained+v.ledger.exited,0)+(outside.get(id)||0)-(id==='water'?transferredVolume:0)+filmOut+(id==='water'&&snapshot.version>=7?(snapshot.suspension?.exitM3||0)-(snapshot.suspension?.liftM3||0)+(snapshot.suspension?.boundaryInM3||0):0)
        if(Math.abs(actual+filmM3+containerParcels.filter(p=>p.liquidId===id).reduce((a,p)=>a+p.volumeM3,0)-(initial+inserted-removed))>1e-9*Math.max(1,initial))
          throw new Error('Recipiente: snapshot viola conservación de masa')
      }
    } else if (this.containers.size) throw new Error('Recipiente: snapshot antiguo carece de inventario líquido')
    let suspension=null
    if(this.suspensionEnabled){
      const a=snapshot.suspension
      if(![7,8].includes(snapshot.version)||!a?.active||!Array.isArray(a.parcels)||a.parcels.length>64||
        !['liftM3','depositM3','exitM3','boundaryInM3'].every(k=>Number.isFinite(a[k])&&a[k]>=0)||!Number.isInteger(a.serial)||a.serial<0)throw new Error('Tornado: snapshot de agua incompatible')
      if(a.parcels.some(p=>typeof p.id!=='string'||!Number.isFinite(p.volumeM3)||p.volumeM3<=0||!Number.isFinite(p.age)||p.age<0||!Array.isArray(p.position)||p.position.length!==3||p.position.some(v=>!Number.isFinite(v))))throw new Error('Tornado: volumen suspendido inválido')
      const current=a.parcels.reduce((a,p)=>a+p.volumeM3,0)
      if(Math.abs(a.liftM3-a.depositM3-a.exitM3-current)>1e-6*Math.max(1,a.liftM3))throw new Error('Tornado: balance suspendido incompatible')
      suspension=a
    }else if(snapshot.suspension?.active)throw new Error('Tornado: snapshot requiere suspensión habilitada')
    // Commit final: ninguna región se toca hasta validar todas y la cola.
    this.regions=restoreRegions
    this.containerParcels=containerParcels
    for (const [region, state] of checked) region.restoreValidated(state)
    this.transfers = transfers
    this.transferredVolume = transferredVolume
    this.completedTransferIds = completed
    this.transferHistory = history
    this.coupledInM3 = snapshot.version >= 5 ? snapshot.coupledInM3 : 0
    this.coupledOutM3 = snapshot.version >= 5 ? snapshot.coupledOutM3 : 0
    for (const [c,v] of checkedContainers) { c.volumeM3=v.volumeM3;c.pose=structuredClone(v.pose);if(c.fluid)c.fluid.restore(v.particles) }
    this.containerDelivered=delivered;this.containerExternalOut=outside
    if(suspension){this.suspended=suspension.parcels.map(p=>({...p,position:[...p.position]}))
      this.suspendedLiftM3=suspension.liftM3;this.suspendedDepositM3=suspension.depositM3;this.suspendedExitM3=suspension.exitM3;this.suspendedBoundaryInM3=suspension.boundaryInM3;this.suspendedSerial=suspension.serial}
    for (const [film, state] of films) { film.stored = state.stored; film.pending = state.pending; film.ledger = state.ledger }
  }

  removeRegion(id) {
    if (this.suspended.some(p=>p.origin===id))throw new Error('Tornado: región con agua suspendida')
    if (this.couplings.some((t) => t.from.id === id || t.to.id === id))
      throw new Error('Agua: región asociada a puertos hidráulicos')
    if (this.transfers.some((t) => t.from.id === id || t.to.id === id))
      throw new Error('Agua: región con transferencias pendientes')
    this.runoff.delete(id)
    return this.regions.delete(id)
  }

  /** Entradas y drenajes externos en m³: la lluvia se encola una vez y no es una gota visual. */
  changeVolume(id, col, row, volume) {
    const region = this.regions.get(id)
    if (!region) throw new Error(`Agua: región inexistente «${id}»`)
    region.queue(col, row, volume)
  }

  _checkedTransfer(from, to, volumeM3, requestId) {
    if (!from || !to || typeof from.id !== 'string' || typeof to.id !== 'string')
      throw new Error('Agua: origen y destino obligatorios')
    const source = this.regions.get(from.id), destination = this.regions.get(to.id)
    if (!source || !destination) throw new Error('Agua: solo se transfieren volúmenes entre regiones finitas')
    const srcIndex = source.cell(from.col, from.row), dstIndex = destination.cell(to.col, to.row)
    if (source === destination && srcIndex === dstIndex) throw new Error('Agua: origen y destino idénticos')
    if (source.liquid.id !== destination.liquid.id || source.liquid.densityKgM3 !== destination.liquid.densityKgM3)
      throw new Error('Agua: líquidos incompatibles')
    if (source.liquid.id !== 'water') throw new Error('Agua: transferencias entre regiones de líquidos alternativos aún no soportadas')
    if (!Number.isFinite(volumeM3) || volumeM3 <= 0) throw new RangeError('Agua: transferencia positiva y finita obligatoria')
    if (requestId != null && (typeof requestId !== 'string' || !requestId.trim() || requestId.length > 128))
      throw new Error('Agua: identificador de transferencia inválido')
    return { from: { id: from.id, col: from.col, row: from.row }, to: { id: to.id, col: to.col, row: to.row },
      volumeM3, requestId: requestId ?? null }
  }

  /** Reserva de fuentes: drenes ya encolados se aplican en orden, sin crear liquidez ficticia. */
  _validateTransferBudget(transfers, checked = null) {
    const states = new Map(checked || [...this.regions.values()].map((r) => [r, { depth: r.depth, pending: r.pending }]))
    const available = new Map()
    const get = (region, k) => {
      let map = available.get(region)
      if (!map) { map = new Map(); available.set(region, map) }
      if (!map.has(k)) {
        const state = states.get(region)
        let amount = state.depth[k] * region.dx * region.dz
        for (const [p, v] of state.pending) if (p === k) amount = Math.max(0, amount + v)
        map.set(k, amount)
      }
      return map
    }
    for (const t of transfers) {
      const source = this.regions.get(t.from.id), k = source.cell(t.from.col, t.from.row)
      const map = get(source, k), left = map.get(k) - t.volumeM3
      if (!Number.isFinite(left) || left < -1e-10 * Math.max(1, t.volumeM3))
        throw new RangeError('Agua: origen sin volumen suficiente para transferencia')
      map.set(k, Math.max(0, left))
    }
  }

  /** Autoriza la transferencia explícita entre celdas; nunca conecta regiones automáticamente. */
  transferVolume(from, to, volumeM3, requestId = null) {
    const t = this._checkedTransfer(from, to, volumeM3, requestId)
    if (t.requestId && (this.completedTransferIds.includes(t.requestId) || this.transfers.some((p) => p.requestId === t.requestId)))
      throw new Error('Agua: identificador de transferencia duplicado')
    if (this.transfers.length >= 4096) throw new RangeError('Agua: demasiadas transferencias pendientes')
    this._validateTransferBudget([...this.transfers, t])
    this.transfers.push(t)
    return { ...t, from: { ...t.from }, to: { ...t.to } }
  }

  /** Un puerto une dos celdas finitas o una celda con una frontera heredada explícita. */
  configureCouplings(links = []) {
    if (!Array.isArray(links) || links.length > 64) throw new Error('Agua: máximo 64 enlaces hidráulicos')
    const seen = new Set()
    const checked = links.map((link, i) => {
      if (!link || typeof link.id !== 'string' || !link.id.trim() || link.id.length > 128 || seen.has(link.id))
        throw new Error('Agua: enlace hidráulico duplicado o inválido')
      seen.add(link.id)
      const checkEnd = (end) => {
        if (!end || typeof end.id !== 'string') throw new Error('Agua: extremo de enlace inválido')
        const region = this.regions.get(end.id), body = this.bodies.find((b) => b.id === end.id)
        if (!region && !body) throw new Error(`Agua: dominio desconocido «${end.id}»`)
        if (region) { region.cell(end.col, end.row); return { id: end.id, col: end.col, row: end.row } }
        if (end.col != null || end.row != null) throw new Error('Agua: frontera heredada no tiene celdas')
        return { id: end.id }
      }
      const from = checkEnd(link.from), to = checkEnd(link.to)
      if (from.id === to.id && from.col === to.col && from.row === to.row)
        throw new Error('Agua: enlace al mismo punto')
      if (!this.regions.has(from.id) && !this.regions.has(to.id)) throw new Error('Agua: dos reservas heredadas no son una conexión física')
      const fromLiquid=this.liquidDomain(from.id)?.liquid, toLiquid=this.liquidDomain(to.id)?.liquid
      if (fromLiquid.id!==toLiquid.id || fromLiquid.densityKgM3!==toLiquid.densityKgM3) throw new Error('Agua: conexión entre líquidos incompatibles')
      if (!Number.isFinite(link.apertureM2) || link.apertureM2 <= 0 || link.apertureM2 > 100 ||
          !Number.isFinite(link.coefficient ?? 0.6) || (link.coefficient ?? 0.6) <= 0 || (link.coefficient ?? 0.6) > 1 ||
          !Number.isFinite(link.maxFlowM3s ?? 10) || (link.maxFlowM3s ?? 10) <= 0 || (link.maxFlowM3s ?? 10) > 1000 ||
          !['both', 'from-to'].includes(link.direction ?? 'from-to')) throw new RangeError('Agua: sección, caudal o dirección inválidos')
      return { id: link.id, from, to, apertureM2: link.apertureM2, coefficient: link.coefficient ?? 0.6,
        maxFlowM3s: link.maxFlowM3s ?? 10, direction: link.direction ?? 'from-to' }
    })
    // No cambiar conexiones mientras se esperan transferencias; el snapshot queda vinculado al contrato.
    if (this.transfers.length) throw new Error('Agua: transferencias pendientes; no se pueden cambiar enlaces')
    this.couplings = checked
    this.coupledInM3 = 0; this.coupledOutM3 = 0
  }

  _endpointHead(end, counterpart) {
    const r = this.regions.get(end.id)
    if (r) {
      const k = r.cell(end.col, end.row)
      return r.effectiveBed[k] + r.depth[k]
    }
    const rr = this.regions.get(counterpart.id)
    if (!rr) throw new Error('Agua: el puerto necesita un extremo finito')
    const x = rr.x + (counterpart.col + 0.5) * rr.dx, z = rr.z + (counterpart.row + 0.5) * rr.dz
    // Se consulta el cuerpo concreto; at() puede dar prioridad a una región superpuesta.
    const sample = this.legacyAt(x, z, 0, end.id)
    if (!sample) throw new Error(`Agua: puerto fuera de la huella de «${end.id}»`)
    return sample.surface
  }

  _planCouplings(dt) {
    if (!this.couplings.length) return
    const available = new Map()
    const reserve = (end, desired) => {
      const r = this.regions.get(end.id)
      if (!r) return desired
      const k = r.cell(end.col, end.row), key = `${r.id}:${k}`
      if (!available.has(key)) {
        let budget = r.depth[k] * r.dx * r.dz
        for (const [p, v] of r.pending) if (p === k) budget += v
        for (const t of this.transfers) if (t.from.id === r.id && r.cell(t.from.col, t.from.row) === k) budget -= t.volumeM3
        available.set(key, Math.max(0, budget))
      }
      const take = Math.min(desired, available.get(key))
      available.set(key, available.get(key) - take)
      return take
    }
    for (const link of this.couplings) {
      const a = this._endpointHead(link.from, link.to), b = this._endpointHead(link.to, link.from)
      if (Math.abs(a-b) < 1e-6) continue
      const forward = a > b
      if (!forward && link.direction !== 'both') continue
      const from = forward ? link.from : link.to, to = forward ? link.to : link.from
      const desired = Math.min(link.maxFlowM3s, link.coefficient * link.apertureM2 * Math.sqrt(2 * 9.81 * Math.abs(a-b))) * dt
      const volume = reserve(from, desired)
      if (volume <= 1e-12) continue
      const fr = this.regions.get(from.id), tr = this.regions.get(to.id)
      if (fr && tr) this.transferVolume(from, to, volume)
      else if (fr) { fr.queue(from.col, from.row, -volume); this.coupledOutM3 += volume }
      else if (tr) { tr.queue(to.col, to.row, volume); this.coupledInM3 += volume }
    }
  }

  /** Ocupación macroscópica de sólidos compatibles; no cambia depth ni los ledgers. */
  setDisplacements(objects = []) {
    const heights = WaterRegion.displacementHeights([...this.regions.values()], objects)
    for (const [id, arr] of heights) this.regions.get(id)._setOccupancy(arr)
    this.displacementEnabled = true
  }

  /** Paso físico único: película, aportes de lluvia, transferencias y solver comparten commit. */
  step(dt) {
    if (!Number.isFinite(dt) || dt <= 0) throw new RangeError('Paso de agua inválido')
    if (!this.runoff.size && !this.transfers.length && !this.couplings.length && !this.containers.size && !this.suspensionEnabled)
      return [...this.regions.values()].map((r) => ({ id: r.id, ...r.step(dt) }))
    if (this.transfers.length) this._validateTransferBudget(this.transfers)
    const saved = this.snapshot()
    try {
      this._advanceContainers(dt)
      this._planCouplings(dt)
      for (const t of this.transfers) {
        this.regions.get(t.from.id).queue(t.from.col, t.from.row, -t.volumeM3)
        this.regions.get(t.to.id).queue(t.to.col, t.to.row, t.volumeM3)
      }
      for (const film of this.runoff.values()) WaterRegion.advanceRunoff(film, this.regions.get(film.id), dt)
      const report = [...this.regions.values()].map((r) => ({ id: r.id, ...r.step(dt) }))
      for (const t of this.transfers) {
        if (t.requestId) this.completedTransferIds.push(t.requestId)
        this.transferHistory.push({ from: { ...t.from }, to: { ...t.to }, volumeM3: t.volumeM3, requestId: t.requestId })
      }
      if (this.transferHistory.length > 256) this.transferHistory.splice(0, this.transferHistory.length - 256)
      if (this.completedTransferIds.length > 256) this.completedTransferIds.splice(0, this.completedTransferIds.length - 256)
      this.transferredVolume += this.transfers.reduce((s, t) => s + t.volumeM3, 0)
      this.transfers.length = 0
      return report
    } catch (err) {
      this.restore(saved)
      throw err
    }
  }

  _prepare(b) {
    const p = b.p, c = Math.cos(b.yaw), s = Math.sin(b.yaw)
    const o = { id: b.id, name: b.name, x: b.x, y: b.y, z: b.z, c, s, p, coupledRegion: p.physicalRegionId || '', shape: p.shape, set: waveSet(p), flow: p.flowSpeed || 0, flowDir: ((p.flowDir || 0) * Math.PI) / 180 }
    if (p.shape === 'river') {
      const line = riverLine(p, 0.5)
      // local → mundo: x = c·lx + s·lz ; z = −s·lx + c·lz
      o.line = line.map(([lx, ly, lz]) => [b.x + c * lx + s * lz, ly, b.z - s * lx + c * lz])
      o.half = Math.max(0.1, p.riverWidth) / 2
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9
      for (const [x, , z] of o.line) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z) }
      o.box = [x0 - o.half - 1, z0 - o.half - 1, x1 + o.half + 1, z1 + o.half + 1]
    }
    return o
  }

  /**
   * Muestra el agua en (x, z) en el instante `t` (s; por defecto el reloj del shader).
   * Devuelve null si ahí no hay agua, o { surface, flowX, flowZ, edge, body, id, name, color, deepColor, clarity }:
   * `surface` = altura del agua (con olas), `edge` = distancia (m) hacia dentro desde la orilla de la forma (≥ 0 dentro),
   * `flowX/flowZ` = corriente (m/s). Si varios cuerpos se solapan gana el que tiene la superficie más alta.
   */
  at(x, z, t = performance.now() / 1000) {
    for (const region of this.regions.values()) {
      if (!region.contains(x, z)) continue
      // El rectángulo del solver puede contener tierra fuera del contorno de un río.
      // Esa tierra no debe suprimir otros cuerpos de agua próximos.
      const col = Math.floor((x - region.x) / region.dx)
      const row = Math.floor((z - region.z) / region.dz)
      if (region.bodyId && !region.valid[row * region.width + col]) {
        if (this.legacyAt(x,z,0,region.bodyId)) return null // tierra alta o celda seca
        continue
      }
      const physical=region.sample(x,z)
      if(physical)return physical
      if(!region.bodyId){const legacy=this.legacyAt(x,z,t);if(legacy&&this.bodies[legacy.body].shape==='ocean')continue}
      return null
    }
    const legacy=this.legacyAt(x,z,t)
    if(legacy && this.spectralAt){
      const result=this.spectralAt(x,z,this.bodies[legacy.body])
      if(result!==undefined)return result
    }
    return legacy
  }

  /** Nivel de reposo y corriente de un nodo autoral; sin las ondas cosméticas. */
  restAt(x, z, bodyId) {
    const sampled = this.legacyAt(x, z, 0, bodyId)
    if (!sampled) return null
    const body = this.bodies.find((b) => b.id === sampled.id)
    return { ...sampled, surface: sampled.surface - waveHeight(body.set, x, z, 0) }
  }

  /** Una sola perturbación física de superficie, sin cambiar el inventario. */
  disturb(x, z, power = 0.5, radius = 1) {
    if (![x, z, power, radius].every(Number.isFinite) || power < 0 || radius <= 0)
      throw new RangeError('Agua: perturbación inválida')
    for (const region of this.regions.values()) if (region.contains(x,z))
      return region.disturb(x,z,power,radius)
    return false
  }

  /** Consulta solamente cuerpos tradicionales, con filtro opcional de dominio externo. */
  legacyAt(x, z, t = 0, bodyId = null) {
    let best = null
    for (let i = 0; i < this.bodies.length; i++) {
      if (bodyId && this.bodies[i].id !== bodyId) continue
      const b = this.bodies[i]
      let edge, level = b.y, fx = 0, fz = 0
      if (b.shape === 'river') {
        const bx = b.box
        if (x < bx[0] || x > bx[2] || z < bx[1] || z > bx[3]) continue
        let md = 1e9, mt = 0, ms = -1
        const L = b.line
        for (let k = 0; k < L.length - 1; k++) {
          const ax = L[k][0], az = L[k][2], ex = L[k + 1][0] - ax, ez = L[k + 1][2] - az
          const l2 = ex * ex + ez * ez || 1e-9
          const u = Math.min(1, Math.max(0, ((x - ax) * ex + (z - az) * ez) / l2))
          const d = hyp(x - (ax + ex * u), z - (az + ez * u))
          if (d < md) { md = d; mt = u; ms = k }
        }
        edge = b.half - md
        if (edge < 0 || ms < 0) continue
        level = b.y + L[ms][1] + (L[ms + 1][1] - L[ms][1]) * mt
        if (b.flow) { const ex = L[ms + 1][0] - L[ms][0], ez = L[ms + 1][2] - L[ms][2], l = hyp(ex, ez) || 1; fx = (ex / l) * b.flow; fz = (ez / l) * b.flow }
      } else {
        const dx = x - b.x, dz = z - b.z
        const lx = b.c * dx - b.s * dz, lz = b.s * dx + b.c * dz
        if (b.shape === 'rect') edge = Math.min(Math.max(0.5, b.p.width) / 2 - Math.abs(lx), Math.max(0.5, b.p.length) / 2 - Math.abs(lz))
        else if (b.shape === 'circle') edge = Math.max(0.5, b.p.radius) - hyp(lx, lz)
        else edge = Math.min(b.p.size / 2 - Math.abs(dx), b.p.size / 2 - Math.abs(dz)) // océano
        if (edge < 0) continue
        if (b.flow) { fx = Math.cos(b.flowDir) * b.flow; fz = Math.sin(b.flowDir) * b.flow }
      }
      const surface = level + waveHeight(b.set, x, z, t)
      if (!best || surface > best.surface) {
        best = { surface, flowX: fx, flowZ: fz, edge, body: i, id: b.id, name: b.name, color: b.p.color, deepColor: b.p.deepColor, clarity: b.p.clarity }
      }
    }
    return best
  }
}
