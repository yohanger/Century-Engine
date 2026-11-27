// Recipientes de escena: WaterWorld simula partículas/volumen; el visor reconstruye su superficie.
import * as THREE from 'three'
import { WATER_LIQUID, containerSpec, freeSurface } from '../geometry/liquid-containers.js'
import { ContainerFluidView, ContainerParcelView } from '../fluids/container-view.js'
const point = new THREE.Vector3(), quat = new THREE.Quaternion()

export const liquidMethods = {
  _liquidInit() {
    this._liquidViews = []
    const profiles = new Map((this.project.liquids || []).map((l)=>[l.id,l]))
    for (const obj of this.project.objects || []) {
      const cfg = obj.props?.liquidContainer
      if (!cfg?.enabled || !['node3d','rigidbody3d','fluidcontainer3d'].includes(obj.type) || !this._nodeEnabled(obj)) continue
      const node = this.ed.nodes.get(obj.id)
      if (!node) throw new Error(`Recipiente: nodo sin representación (${obj.id})`)
      const liquid = !cfg.liquidId || cfg.liquidId==='water' ? WATER_LIQUID : profiles.get(cfg.liquidId)
      if (!liquid) throw new Error(`Recipiente: recurso .liquid inexistente (${cfg.liquidId})`)
      const pose = this._liquidPose(node)
      const overrides = node.userData.timelineLiquid || {}
      const spec = containerSpec({ ...cfg, id: obj.id, shape: overrides.shape ?? cfg.shape ?? 'cylinder',size:overrides.size ?? cfg.size ?? [0.09,0.12,0.09],
        initialM3:cfg.initialM3??0,liquid,pourRate:cfg.pourRate??0.5 })
      this.water.addContainer(spec,pose)
      node.userData.liquidRuntime = {world:this.water, id:obj.id}
      if(node.userData.containerPreview)node.userData.containerPreview.visible=false
      if(spec.simulation==='particles'){
        const fluid=this.water.containers.get(obj.id).fluid
        const view=new ContainerFluidView(this.ed.vp.scene,fluid,spec.liquid)
        this._liquidViews.push({id:obj.id,node,view})
        continue
      }
      const initialRate = node.userData.timelineLiquid?.pourRate
      if (initialRate !== undefined) this.water.setContainerPourRate(obj.id,initialRate)
      const geometry=spec.shape==='cylinder' ? new THREE.CircleGeometry(Math.min(spec.size[0],spec.size[2])/2,32)
        : new THREE.PlaneGeometry(spec.size[0],spec.size[2])
      const material=new THREE.MeshPhysicalMaterial({color:spec.liquid.color,roughness:0.15,metalness:0,
        transparent:true,opacity:spec.liquid.opacity,side:THREE.DoubleSide,depthWrite:false})
      const surface=new THREE.Mesh(geometry,material)
      surface.name=`LiquidSurface:${obj.id}`;surface.userData.helper=true;surface.rotation.x=-Math.PI/2
      // No colisiona, no entra en el inventario ni altera la geometría artística.
      this.ed.vp.scene.add(surface)
      const stream=new THREE.Mesh(new THREE.CylinderGeometry(0.0025,0.0025,1,6),material.clone())
      stream.name=`LiquidStream:${obj.id}`;stream.userData.helper=true;stream.visible=false
      this.ed.vp.scene.add(stream)
      this._liquidViews.push({id:obj.id,node,surface,stream,geometrySignature:JSON.stringify([spec.shape,spec.size])})
    }
    if(this._liquidViews.some(v=>v.view)){
      this._liquidParcels=new ContainerParcelView(this.ed.vp.scene)
      this.water.fluidGroundAt=(x,z,fromY=10)=>{
        const terrain=this.ed.groundAt(x,z),floor=this.ed.rainImpact([x,fromY,z],[x,Number.isFinite(terrain)?terrain-0.01:fromY-100,z])
        return floor?.normal?.[1]>0.4 ? Math.max(Number.isFinite(terrain)?terrain:-Infinity,floor.point[1]) : terrain
      }
      this.water.fluidImpact=(a,b)=>this.ed.rainImpact(a,b)
      this.water.fluidOnImpact=p=>this.ed.rainWaterRipple({point:p.position,normal:[0,1,0]})
    }
    this._liquidRender()
  },
  _liquidPose(node) {
    node.updateWorldMatrix(true,false)
    node.getWorldPosition(point);node.getWorldQuaternion(quat)
    return {position:point.toArray(),quaternion:quat.toArray()}
  },
  _liquidPoseSync() {
    for (const v of this._liquidViews || []) this.water.setContainerPose(v.id,this._liquidPose(v.node))
  },
  _liquidRender() {
    this._liquidParcels?.update(this.water.containerParcels)
    if(this._liquidParcels && !this._waterConnection){
      if(!this.ed._physicalWaterView)this.ed.showPhysicalWater(this.water)
      this.ed.updatePhysicalWater(this.water)
    }
    for (const v of this._liquidViews || []) {
      if(v.view){v.view.update();continue}
      const c=this.water.containerState(v.id)
      if (!c) continue
      const signature=JSON.stringify([c.shape,c.size])
      if (v.geometrySignature!==signature) {
        const next=c.shape==='cylinder' ? new THREE.CircleGeometry(Math.min(c.size[0],c.size[2])/2,32)
          : new THREE.PlaneGeometry(c.size[0],c.size[2])
        const former=v.surface.geometry
        v.surface.geometry=next
        v.geometrySignature=signature
        former.dispose()
      }
      v.surface.visible=c.volumeM3>1e-10
      v.stream.visible=false
      if (!v.surface.visible) continue
      const s=freeSurface(c,c.pose)
      v.surface.position.set(c.pose.position[0],s.levelY,c.pose.position[2])
      v.surface.rotation.set(-Math.PI/2,0,0)
      // Chorro visual limitado; la masa pertenece solo al volumen WaterWorld.
      if (s.headM>0.001 && c.pourRate>0) {
        const length=0.24
        v.stream.visible=true
        v.stream.position.set(s.edge[0],s.edge[1]-length/2,s.edge[2])
        v.stream.scale.set(1,length,1)
      }
      // Plano horizontal en el mundo (la taza puede inclinarse).
    }
  },
  _liquidReset() {
    for (const v of this._liquidViews || []) {
      delete v.node.userData.liquidRuntime
      if(v.node.userData.containerPreview)v.node.userData.containerPreview.visible=(this.project.objects.find(o=>o.id===v.id)?.props?.liquidContainer?.initialM3||0)>0
      if(v.view){v.view.dispose();continue}
      v.surface.removeFromParent();v.surface.geometry.dispose();v.surface.material.dispose()
      v.stream.removeFromParent();v.stream.geometry.dispose();v.stream.material.dispose()
    }
    this._liquidParcels?.dispose();this._liquidParcels=null
    this._liquidViews=[]
  },
}
