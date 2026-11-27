// Desprendimientos, agua suspendida y fuentes térmicas del tornado; autoridad física existente.
import * as THREE from 'three'
import { vegetationResponse, TornadoCombustion } from '../world/tornado-destruction.js'
import { BUILTIN_FOLIAGE } from '../geometry/foliage-shapes.js'

const v = new THREE.Vector3(), center = new THREE.Vector3()
export const destructiveTornadoMethods = {
  _destructionInit() {
    this._destructiveTrees=[];this._treeKeys=new Set();this._destructionCandidates=[]
    this._combustion=null;this._destructionFireVisual=null;this._destructionWaterVisual=null;this._destructionManualFoliages=[]
    const cfg=this.ed.world.cfg.weather
    if(!this.ed.world.tornado)return
    if(cfg.tornadoDestruction) for(const terrain of this.ed.terrains || []) {
      if(!terrain.foliage.play){terrain.foliage.enterPlay();this._destructionManualFoliages.push(terrain.foliage)}
    }
    this.water.suspensionEnabled=cfg.tornadoWaterLift===true
    if(cfg.tornadoWaterLift && cfg.tornadoWaterVfxNodeId){
      const id=cfg.tornadoWaterVfxNodeId,o=this.project.objects.find(o=>o.id===id && o.type==='vfx'),node=this.ed.nodes.get(id)
      const fx=this.project.vfx?.find(f=>f.id===o?.props?.vfxId)
      if(!o||!node||!fx||fx.movement?.space!=='world')
        throw new Error('Tornado: el VFX3D personalizado de agua requiere Espacio Mundo')
      this._destructionWaterVisual={node,original:node.position.clone(),oldActive:node.userData.tornadoConditionalActive,oldFlow:node.userData.tornadoFlowActive}
      node.userData.tornadoConditionalActive=false
      node.userData.tornadoFlowActive=true // World administra la influencia meteorológica, no el recurso .vfx
    }
    if(cfg.tornadoFire){
      this._combustion=new TornadoCombustion()
      // Los árboles se registran cerca del vórtice, no los primeros 64 del Terrain.
      // Al desplazarse el tornado, el paso fijo incorporará fuentes próximas disponibles.
      for(const o of this.project.objects || []){
        if(!o.props?.combustion?.enabled || this._combustion.sources.size>=64)continue
        const node=this.ed.nodes.get(o.id)
        if(!node)continue
        node.getWorldPosition(v)
        this._combustion.add(o.id,{x:v.x,y:v.y,z:v.z,moisture:o.props.combustion.moisture ?? 0.25,
          ignitionK:o.props.combustion.ignitionK ?? 570})
        if(o.props.combustion.ignited===true)this._combustion.ignite(o.id,850)
        node.userData.combustionRuntime={owner:this,id:o.id}
        if (node.userData.timelineCombustion) this._combustion.configure(o.id,node.userData.timelineCombustion)
      }
      // Solo nodos VFX3D explícitos; no construir un emisor global de fuego.
      const id=cfg.tornadoFireVfxNodeId
      if(id) {
        const o=this.project.objects.find(o=>o.id===id && o.type==='vfx'),node=this.ed.nodes.get(id)
        if(!o || !node || !this.project.vfx?.some(f=>f.id===o.props?.vfxId))throw new Error('Tornado: VFX3D de brasas inválido')
        this._destructionFireVisual={node,original:node.position.clone(),oldActive:node.userData.tornadoConditionalActive}
        node.userData.tornadoConditionalActive=false
      }
    }
    if(cfg.tornadoDestruction)for(const t of this.ed.terrains || [])for(const s of t.foliage.types.values()){
      if(!s.cfg.destructible || !s.count || !['tree','pine'].includes(s.cfg.builtin) && s.cfg.source!=='model')continue
      this._destructionCandidates.push({terrain:t,type:s})
    }
  },
  _destructionTreeSpawn(terrain,type,index,kind='roots',forceN=0,silent=false){
    if(!this.phys)return null
    const id=`${terrain.id}:${type.cfg.id}:${index}`
    if(this._treeKeys.has(id))return null
    const detached=terrain.foliage.detachPlayInstance(type.cfg.id,index)
    if(!detached)return null
    const d=type.data,j=index*4,obj=detached.group,scale=d[j+3]
    const mass=Math.max(2,Math.min(2000,15*scale**3))
    const fragments=[]
    const split=kind==='trunk' && type.cfg.source==='builtin' && BUILTIN_FOLIAGE[type.cfg.builtin]
    const geometries=split?BUILTIN_FOLIAGE[type.cfg.builtin].build():null
    if(geometries?.length>=2){
      const groups=[new THREE.Group(),new THREE.Group()]
      for(const group of groups){group.position.copy(obj.position);group.quaternion.copy(obj.quaternion);group.scale.copy(obj.scale);this.ed.vp.scene.add(group)}
      groups[0].add(new THREE.Mesh(geometries[0],detached.parts[0].material))
      for(const geo of geometries.slice(1))groups[1].add(new THREE.Mesh(geo,detached.parts[0].material))
      fragments.push(...groups.map(group=>({node:group,mass:mass/2,owned:group.children.map(m=>m.geometry)})))
    } else {
      geometries?.forEach(g=>g.dispose())
      this.ed.vp.scene.add(obj)
      fragments.push({node:obj,mass,owned:[]})
    }
    const spawned=[]
    try {
      for(const frag of fragments){
        const bb=new THREE.Box3()
        for(const mesh of frag.node.children){const geo=mesh.geometry;if(!geo.boundingBox)geo.computeBoundingBox();bb.union(geo.boundingBox)}
        const localCenter=bb.getCenter(new THREE.Vector3()).multiplyScalar(scale)
        const localSize=bb.getSize(new THREE.Vector3()).multiplyScalar(scale)
        const item=this.phys.dynamics().add({pos:frag.node.position.clone(),quat:frag.node.quaternion.clone(),center:localCenter,size:localSize},{shape:'box',mass:frag.mass,graphic:frag.node})
        spawned.push({...frag,item})
      }
    }catch(error){
      for(const b of spawned)this.phys.bodies.remove(b.item)
      for(const f of fragments){f.node.removeFromParent();f.owned.forEach(g=>g.dispose())}
      throw error
    }
    const created={id,parts:spawned,item:spawned[0].item,node:spawned[0].node,terrain,typeId:type.cfg.id,index,kind}
    this._destructiveTrees.push(created);this._treeKeys.add(id)
    if(!silent)this.game?.emit('treeUprooted',{id,forceN,kind,position:obj.position.toArray()})
    return created
  },
  _destructionSnapshot(){
    if(!this._combustion && !this.water?.suspensionEnabled && !this._destructionCandidates?.length)return null
    const B=this.phys?.bodies
    return {trees:(this._destructiveTrees||[]).map(b=>{
      const parts=b.parts.map(f=>{
        const pose=B?.pose(f.item,new THREE.Vector3(),new THREE.Quaternion())
        return {pos:pose?.pos.toArray()||f.node.position.toArray(),quat:pose?.quat.toArray()||f.node.quaternion.toArray(),vel:B?.velocityOf(f.item)||[0,0,0]}
      })
      return {id:b.id,kind:b.kind,parts}
    }),...(this._combustion && {fire:this._combustion.snapshot()})}
  },
  _destructionRestore(data){
    if(!data)return
    if(!Array.isArray(data.trees)||data.trees.length>(this.ed.world.cfg.weather.tornadoTreeBudget||24))throw new Error('Tornado: árboles del snapshot incompatibles')
    // Validación de entradas antes de modificar Jolt o las matrices de Play.
    const checked=data.trees.map(v=>{
      const [tid,typeId,index]=typeof v.id==='string'?v.id.split(':'):[]
      const terrain=(this.ed.terrains||[]).find(t=>t.id===tid),type=terrain?.foliage.types.get(typeId)
      if(!terrain||!type?.cfg.destructible||!Number.isInteger(+index)||+index<0||+index>=type.count||
        !['trunk','roots'].includes(v.kind)||!Array.isArray(v.parts)||v.parts.length<1||v.parts.length>2||
        v.parts.some(f=>!Array.isArray(f.pos)||f.pos.length!==3||!Array.isArray(f.quat)||f.quat.length!==4||!Array.isArray(f.vel)||f.vel.length!==3||[...f.pos,...f.quat,...f.vel].some(k=>!Number.isFinite(k))))throw new Error('Tornado: árbol de snapshot inválido')
      return {terrain,type,index:+index,v}
    })
    if(new Set(checked.map(c=>c.v.id)).size!==checked.length)throw new Error('Tornado: árboles duplicados')
    let validatedFire=null
    if(data.fire){if(!this._combustion)throw new Error('Tornado: estado térmico no configurado')
      // La validación se hace en un clon del modelo para evitar un cambio parcial.
      const model=new TornadoCombustion({maxSources:this._combustion.maxSources,maxEmbers:this._combustion.maxEmbers})
      // La vegetación cercana se registra durante Play, no necesariamente antes de cargar la partida.
      const knownTrees=new Map()
      for(const terrain of this.ed.terrains||[])for(const type of terrain.foliage.types.values()){
        if(!type.cfg.combustible||!type.cfg.destructible)continue
        knownTrees.set(`${terrain.id}:${type.cfg.id}`,{terrain,type})
      }
      for(const snapshotSource of data.fire.sources || []){
        if(typeof snapshotSource?.id!=='string')throw new Error('Fuego: fuente de snapshot inválida')
        const treeId=snapshotSource.id.split(':')
        if(treeId.length===3){
          const ref=knownTrees.get(`${treeId[0]}:${treeId[1]}`),idx=Number(treeId[2])
          if(!ref||!Number.isInteger(idx)||idx<0||idx>=ref.type.count)
            throw new Error('Fuego: fuente de vegetación del snapshot desconocida')
        } else if(!this.project.objects.some(o=>o.id===snapshotSource.id && o.props?.combustion?.enabled))
          throw new Error('Fuego: fuente del snapshot desconocida')
        model.add(snapshotSource.id,snapshotSource)
      }
      model.restore(data.fire)
      validatedFire=model
    }
    for(const b of this._destructiveTrees||[])for(const f of b.parts){this.phys?.bodies?.remove(f.item);f.node.removeFromParent();f.owned.forEach(g=>g.dispose())}
    this._destructiveTrees=[];this._treeKeys.clear()
    for(const terrain of this.ed.terrains||[])terrain.foliage.restoreDetachedInstances()
    for(const {terrain,type,index,v:stored} of checked){
      const b=this._destructionTreeSpawn(terrain,type,index,stored.kind,0,true)
      if(!b)throw new Error('Tornado: no se pudo restituir árbol desprendido')
      if(b.parts.length!==stored.parts.length)throw new Error('Tornado: partes de árbol incompatibles')
      for(let k=0;k<b.parts.length;k++){
        const f=b.parts[k],v=stored.parts[k]
        this.phys.bodies.teleport(f.item,new THREE.Vector3(...v.pos),new THREE.Quaternion(...v.quat))
        this.phys.bodies.setVelocity(f.item,v.vel)
      }
    }
    if(validatedFire)this._combustion=validatedFire
  },
  _destructionFixed(dt) {
    const w=this.ed.world,t=w.tornado,cfg=w.cfg.weather
    if(!t||!Number.isFinite(dt)||dt<=0)return
    if(t.active && cfg.tornadoDestruction && this._destructiveTrees.length<cfg.tornadoTreeBudget && this.phys) {
      let budget=256
      for(const {terrain,type} of this._destructionCandidates){
        const d=type.data
        const near=terrain.foliage.nearbyPlayInstances(type.cfg.id,t.x-terrain.ox,t.z-terrain.oz,t.radius,256)
        for(const i of near){
          if(budget--<=0 || this._destructiveTrees.length>=cfg.tornadoTreeBudget)break
          const j=i*4,x=terrain.ox+d[j],z=terrain.oz+d[j+1],id=`${terrain.id}:${type.cfg.id}:${i}`
          if(this._treeKeys.has(id) || (x-t.x)**2+(z-t.z)**2>t.radius**2)continue
          const y=(terrain.oy ?? 0)+terrain.heightAt(d[j],d[j+1]),flow=w.windAt3D(x,y+2,z)
          const effect=vegetationResponse(type.cfg,flow,d[j+3],dt)
          if(!effect.uproot && !effect.breakTrunk)continue
          this._destructionTreeSpawn(terrain,type,i,effect.breakTrunk?'trunk':'roots',effect.forceN)

        }
      }
    }
    if(cfg.tornadoFire && t.active && this._combustion?.sources.size<64) {
      // Búsqueda por índice espacial de vegetación (misma autoridad que el LOD de Play).
      for(const terrain of this.ed.terrains || [])for(const type of terrain.foliage.types.values()){
        if(!type.cfg.combustible || !type.cfg.destructible)continue
        const near=terrain.foliage.nearbyPlayInstances(type.cfg.id,t.x-terrain.ox,t.z-terrain.oz,t.radius,64)
        for(const i of near){
          if(this._combustion.sources.size>=64)break
          const id=`${terrain.id}:${type.cfg.id}:${i}`
          if(this._combustion.sources.has(id))continue
          const j=i*4, x=terrain.ox+type.data[j],z=terrain.oz+type.data[j+1]
          this._combustion.add(id,{x,y:(terrain.oy ?? 0)+terrain.heightAt(type.data[j],type.data[j+1]),z,
            moisture:type.cfg.moisture??0.25})
        }
      }
    }
    if(cfg.tornadoWaterLift && (this.water.regions.size || this.water.bodies.length)){
      const contacts=this.water.advanceSuspended(dt,(x,y,z)=>w.windAt3D(x,y,z),(x,z)=>this.ed.groundAt(x,z)) || []
      if(this._combustion)for(const contact of contacts)for(const fire of this._combustion.sources.values())
        if(Math.hypot(fire.x-contact.position[0],fire.z-contact.position[2])<1.5)
          this._combustion.wet(fire.id,Math.min(10,contact.volumeM3))
      const rate=cfg.tornadoWaterRateM3s*dt
      if(t.active && rate>0 && this.water.suspended.length<64){
        // Una celda de agua cercana al centro, con inventario comprobado por WaterWorld.
        let lifted=false
        for(const r of this.water.regions.values()){
          const c=Math.floor((t.x-r.x)/r.dx),q=Math.floor((t.z-r.z)/r.dz)
          if(c<0||q<0||c>=r.width||q>=r.height||r.liquid.id!=='water')continue
          const k=q*r.width+c
          if(!r.valid[k] || r.depth[k]<=0)continue
          this.water.liftWater(r.id,c,q,rate,[t.x,r.effectiveBed[k]+r.depth[k]+0.2,t.z]);lifted=true;break
        }
        if(!lifted && this.water.bodies.length){
          const legacy=this.water.legacyAt(t.x,t.z)
          if(legacy)this.water.liftLegacyWater(legacy.id,t.x,t.z,rate)
        }
      }
    }
    if(this._destructionWaterVisual && this.water.suspended.length){
      const view=this._destructionWaterVisual, p=this.water.suspended[0].position
      v.set(p[0],p[1],p[2]);if(view.node.parent)view.node.parent.worldToLocal(v);view.node.position.copy(v)
    }
    if(this._destructionWaterVisual)this._destructionWaterVisual.node.userData.tornadoConditionalActive=this.water.suspended.length>0
    if(this._combustion){
      const before=new Set([...this._combustion.sources.values()].filter(s=>s.burning).map(s=>s.id))
      const rainAt=(x,y,z)=>Math.max(0,w.weatherOn && w.precipitationAt ? w.precipitationAt(x,z,y) : w._f?.precipMm || 0)
      for(const s of this._combustion.sources.values())if(s.burning){
        const near=this.water.at(s.x,s.z)
        if(near && near.surface>=s.y-0.1)this._combustion.wet(s.id,dt*0.02)
        else { const rain=rainAt(s.x,s.y,s.z); if(rain>0.5)this._combustion.wet(s.id,dt*rain*0.00002) }
      }
      this._combustion.step(dt,(x,y,z)=>w.windAt3D(x,y,z),(x,z)=>this.ed.groundAt(x,z))
      for(const s of this._combustion.sources.values())if(s.burning&&!before.has(s.id))this.game?.emit('tornadoIgnition',{id:s.id,position:[s.x,s.y,s.z]})
      const view=this._destructionFireVisual
      if(view){const burning=[...this._combustion.sources.values()].find(s=>s.burning)
        view.node.userData.tornadoConditionalActive=!!burning
        if(burning){v.set(burning.x,burning.y,burning.z);if(view.node.parent)view.node.parent.worldToLocal(v);view.node.position.copy(v)} }
    }
  },
  _destructionIgniteAt(impact){
    if(!this._combustion||!Array.isArray(impact?.point))return
    for(const s of this._combustion.sources.values()){
      if(Math.hypot(s.x-impact.point[0],s.z-impact.point[2])>Math.min(12,this.ed.world.cfg.weather.lightningImpactRadius||6))continue
      if(this._combustion.ignite(s.id,Math.min(1800,650+(impact.peakKA||30)*10)))
        this.game?.emit('tornadoIgnition',{id:s.id,source:'lightning',position:[s.x,s.y,s.z]})
    }
  },
  _destructionBodyForces(dt){
    const B=this.phys?.bodies,w=this.ed.world
    if(!B || !w.tornado?.active)return
    for(const b of this._destructiveTrees)for(const f of b.parts){
      const pos=B.centerOf(f.item,center),flow=w.tornadoWindAt(pos.x,pos.y,pos.z)
      if(flow.inside)B.impulse(f.item,[flow.x*f.item.mass*dt*0.65,flow.y*f.item.mass*dt*0.65,flow.z*f.item.mass*dt*0.65])
    }
  },
  _destructionRender(){
    const B=this.phys?.bodies
    if(!B)return
    for(const tree of this._destructiveTrees||[]){
      const target=this._combustion?.sources.get(tree.id)
      if(target){const p=B.centerOf(tree.parts[0].item,center);target.x=p.x;target.y=p.y;target.z=p.z}
    }
    for(const source of this._combustion?.sources.values() || []){
      if(source.id.includes(':'))continue // vegetación desprendida se actualiza desde Jolt
      const node=this.ed.nodes.get(source.id)
      if(node){node.getWorldPosition(v);source.x=v.x;source.y=v.y;source.z=v.z}
    }
    for(const b of this._destructiveTrees)for(const f of b.parts){const pose=B.pose(f.item,v,new THREE.Quaternion());f.node.position.copy(pose.pos);f.node.quaternion.copy(pose.quat)}
  },
  _destructionReset(){
    for (const obj of this.project?.objects || []) {
      const node=this.ed?.nodes?.get(obj.id)
      if (node?.userData?.combustionRuntime?.owner===this) delete node.userData.combustionRuntime
    }
    for(const b of this._destructiveTrees||[])for(const f of b.parts){this.phys?.bodies?.remove(f.item);f.node.removeFromParent();f.owned.forEach(g=>g.dispose())}
    this._destructiveTrees=[];this._treeKeys?.clear();this._destructionCandidates=[]
    for(const view of [this._destructionFireVisual,this._destructionWaterVisual])if(view){
      view.node.position.copy(view.original)
      if(view.oldActive === undefined)delete view.node.userData.tornadoConditionalActive
      else view.node.userData.tornadoConditionalActive=view.oldActive
      if (Object.hasOwn(view,'oldFlow')) {
        if (view.oldFlow === undefined) delete view.node.userData.tornadoFlowActive
        else view.node.userData.tornadoFlowActive=view.oldFlow
      }
      view.node.updateWorldMatrix(true,true)
    }
    this._destructionFireVisual=null;this._destructionWaterVisual=null;this._combustion=null
    for(const f of this._destructionManualFoliages||[])f.exitPlay()
    this._destructionManualFoliages=[]
  },
}
