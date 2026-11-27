import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { registerNode } from './registry.js'
import { makeRoot, applyBase, hitSphere } from './three-helpers.js'
import { liquidGeometryAnimation } from './base.js'
import { containerSpec, WATER_LIQUID, freeSurface } from '../geometry/liquid-containers.js'
import { FLUID_CONTAINER_KINDS, fluidContainerDefaults } from '../fluids/container-props.js'
import { containerRadiusFactor } from '../fluids/container-shape.js'

export default registerNode({
  type:'fluidcontainer3d',base:'Node3D',label:'Recipiente de fluido',icon:'water',category:'Utilería',scalable:false,
  kinds:Object.fromEntries(Object.entries(FLUID_CONTAINER_KINDS).map(([k,p])=>[k,{label:p.label,icon:'water'}])),
  animation:liquidGeometryAnimation('fluidcontainer3d'),
  create(kind){return {name:FLUID_CONTAINER_KINDS[kind]?.label||'Recipiente',props:{liquidContainer:fluidContainerDefaults(kind)}}},
  build(obj){
    const {root,visual}=makeRoot(obj)
    const picker=hitSphere(0.06);root.add(picker)
    const shell=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshPhysicalMaterial({color:'#d2e3e8',transparent:true,opacity:0.22,roughness:0.12,metalness:0,side:THREE.DoubleSide,depthWrite:false}))
    shell.name='Envase de referencia';visual.add(shell)
    const lid=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshStandardMaterial({color:'#394c5b',roughness:0.65}))
    visual.add(lid)
    const preview=new THREE.Mesh(new THREE.CircleGeometry(1,32),new THREE.MeshPhysicalMaterial({color:WATER_LIQUID.color,transparent:true,opacity:0.8,roughness:0.12,side:THREE.DoubleSide,depthWrite:false}))
    preview.rotation.x=-Math.PI/2;visual.add(preview)
    root.userData.containerShell=shell;root.userData.containerLid=lid;root.userData.containerPreview=preview
    return root
  },
  update(root,obj){
    applyBase(root,obj,false)
    const cfg={...fluidContainerDefaults(obj.kind),...obj.props.liquidContainer},spec=containerSpec({id:obj.id,...cfg,liquid:WATER_LIQUID})
    const u=root.userData,shell=u.containerShell,[sx,sy,sz]=spec.size
    const key=JSON.stringify([spec.shape,spec.vessel,spec.size,spec.mouthRadius,spec.neckHeight])
    if(u.containerGeometryKey!==key){
      shell.geometry.dispose();u.containerLid.geometry.dispose();u.containerPreview.geometry.dispose()
      if(spec.shape==='box'){
        const shape=new THREE.Shape();shape.moveTo(-sx/2,-sz/2);shape.lineTo(sx/2,-sz/2);shape.lineTo(sx/2,sz/2);shape.lineTo(-sx/2,sz/2);shape.closePath()
        const hole=new THREE.Path();hole.moveTo(-sx/2+0.002,-sz/2+0.002);hole.lineTo(-sx/2+0.002,sz/2-0.002);hole.lineTo(sx/2-0.002,sz/2-0.002);hole.lineTo(sx/2-0.002,-sz/2+0.002);hole.closePath();shape.holes.push(hole)
        shell.geometry=new THREE.ExtrudeGeometry(shape,{depth:sy,bevelEnabled:false,steps:1});shell.geometry.rotateX(Math.PI/2);shell.geometry.translate(0,sy/2,0)
        const walls=shell.geometry,bottom=new THREE.BoxGeometry(sx,0.002,sz);bottom.translate(0,-sy/2-0.001,0)
        shell.geometry=mergeGeometries([walls,bottom]);walls.dispose();bottom.dispose()
        u.containerLid.geometry=new THREE.BoxGeometry(sx,0.003,sz);u.containerPreview.geometry=new THREE.PlaneGeometry(sx,sz)
      }else{
        const points=[new THREE.Vector2(0,-sy/2-0.002),new THREE.Vector2(sx/2+0.002,-sy/2-0.002)]
        for(let i=0;i<=20;i++){const y=-sy/2+sy*i/20;points.push(new THREE.Vector2(sx/2*containerRadiusFactor(spec,y)+0.002,y))}
        for(let i=20;i>=0;i--){const y=-sy/2+sy*i/20;points.push(new THREE.Vector2(Math.max(0.001,sx/2*containerRadiusFactor(spec,y)),y))}
        points.push(new THREE.Vector2(0,-sy/2))
        shell.geometry=new THREE.LatheGeometry(points,40);shell.geometry.scale(1,1,sz/sx)
        u.containerLid.geometry=new THREE.CylinderGeometry(spec.mouthRadius+0.002,spec.mouthRadius+0.002,0.004,32)
        u.containerPreview.geometry=new THREE.CircleGeometry(1,40)
      }
      u.containerGeometryKey=key
    }
    shell.visible=cfg.showVessel!==false;u.containerLid.visible=shell.visible&&spec.closed;u.containerLid.position.y=sy/2+0.002
    u.containerPreview.visible=!u.liquidRuntime && spec.initialM3>0
    if(u.containerPreview.visible){
      const level=freeSurface({...spec,volumeM3:spec.initialM3},{position:[0,0,0],quaternion:[0,0,0,1]}).levelY
      u.containerPreview.position.y=level
      if(spec.shape!=='box'){const f=containerRadiusFactor(spec,level);u.containerPreview.scale.set(sx/2*f,sz/2*f,1)}else u.containerPreview.scale.set(1,1,1)
    }
    u.updateFluidContainer?.(spec)
  },
})
