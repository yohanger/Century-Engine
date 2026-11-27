// Volumetric surface reconstructed from the same particles that own the volume.
import * as THREE from 'three'
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js'
const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),matrix=new THREE.Matrix4()
export class ContainerFluidView {
  constructor(scene,fluid,liquid){
    this.fluid=fluid
    const material=new THREE.MeshPhysicalMaterial({color:liquid.color,roughness:0.08,metalness:0,ior:1.333,transparent:true,opacity:Math.max(0.65,liquid.opacity),side:THREE.DoubleSide,depthWrite:false})
    this.mesh=new MarchingCubes(28,material,false,false,18000)
    this.mesh.name='Líquido · MLS-MPM';this.mesh.userData.helper=true;this.mesh.frustumCulled=false
    this.mesh.isolation=36;scene.add(this.mesh);this.revision=-1
  }
  update(){
    const f=this.fluid,m=this.mesh,L=Math.max(...f.spec.size)*1.18
    m.position.fromArray(f.pose.position);m.quaternion.fromArray(f.pose.quaternion);m.scale.setScalar(L/2)
    m.visible=f.count>0
    if(!m.visible||this.revision===f.revision)return
    this.revision=f.revision;m.reset()
    const p=f.localPositions(),radius=Math.cbrt(f.spec.capacityM3/f.maxCount)*1.3
    // addBall radius = sqrt(strength / subtract); MarchingCubes maps [0,1] to [-1,1].
    const subtract=12,strength=(radius/L)**2*(subtract+m.isolation)
    for(let i=0;i<f.count;i++)m.addBall(p[i*3]/L+0.5,p[i*3+1]/L+0.5,p[i*3+2]/L+0.5,strength,subtract)
    m.update()
  }
  dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose()}
}
export class ContainerParcelView {
  constructor(scene){
    this.mesh=new THREE.InstancedMesh(new THREE.SphereGeometry(1,6,4),new THREE.MeshPhysicalMaterial({color:'#40a5b8',roughness:0.1,metalness:0,transparent:true,opacity:0.85}),8192)
    this.mesh.name='Vertido · volumen libre';this.mesh.userData.helper=true;this.mesh.frustumCulled=false;this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.count=0;scene.add(this.mesh)
  }
  update(parcels){
    this.mesh.count=Math.min(parcels.length,8192)
    for(let i=0;i<this.mesh.count;i++){const p=parcels[i];position.fromArray(p.position);rotation.identity();scale.setScalar(Math.cbrt(3*p.volumeM3/(4*Math.PI)));matrix.compose(position,rotation,scale);this.mesh.setMatrixAt(i,matrix)}
    this.mesh.instanceMatrix.needsUpdate=true
  }
  dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose()}
}
