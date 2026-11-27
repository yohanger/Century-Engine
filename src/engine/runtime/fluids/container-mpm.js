/*!
MIT License

Copyright (c) 2025 matsuoka-601

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/
// CPU port of Splash's MLS-MPM kernels (MIT, matsuoka-601, 2025).
// See vendor/splash and vendor/SOURCES.json for the exact original kernels/commit.
// The bounded CPU backend keeps small props usable with the engine's WebGL renderer.
import { Vector3, Quaternion } from 'three'
import { insideContainer, containerRadiusFactor } from './container-shape.js'

const GRID=18, CELLS=GRID**3, MAX_PARTICLES=1024
const v=new Vector3(),v2=new Vector3(),q=new Quaternion(),qi=new Quaternion(),oldQ=new Quaternion()
const finiteArray=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(Number.isFinite)
export class MpmContainerFluid {
  constructor(spec,pose) {
    this.spec={...spec,size:[...spec.size]};this.pose=structuredClone(pose)
    this.maxCount=Math.min(MAX_PARTICLES,{low:256,balanced:512,high:1024}[spec.quality]||512)
    this.count=0;this.positions=new Float64Array(MAX_PARTICLES*3);this.velocities=new Float64Array(MAX_PARTICLES*3)
    this.affine=new Float64Array(MAX_PARTICLES*9);this.volumes=new Float64Array(MAX_PARTICLES)
    this.mass=new Float64Array(CELLS);this.mx=new Float64Array(CELLS);this.my=new Float64Array(CELLS);this.mz=new Float64Array(CELLS)
    this.indices=new Int32Array(MAX_PARTICLES*27);this.weights=new Float64Array(MAX_PARTICLES*27)
    this.offsets=new Float64Array(MAX_PARTICLES*81);this.gridNormals=new Float64Array(CELLS*3)
    this.scale=(GRID-6)/Math.max(...spec.size);this.time=0;this.revision=0;this.restDensity=0
    this.referenceVolume=spec.capacityM3/this.maxCount
    this._seed(spec.initialM3??spec.volumeM3??0)
    this._prepareStencil();this._p2gMass()
    const densities=[]
    for(let i=0;i<this.count;i++){let d=0;for(let j=0;j<27;j++){const k=i*27+j;d+=this.mass[this.indices[k]]*this.weights[k]}densities.push(d)}
    densities.sort((a,b)=>a-b);// Kernel calibration for bounded low-resolution stencils; volume remains exact per particle.
    this.restDensity=Math.max(0.1,(densities[Math.floor(densities.length*0.8)]||1)*0.82)
  }
  _seed(volume) {
    if(volume<=0)return
    const step=Math.cbrt(this.spec.capacityM3/this.maxCount)*0.92, [sx,sy,sz]=this.spec.size, candidates=[]
    q.fromArray(this.pose.quaternion).normalize()
    for(let y=-sy/2+step*0.5;y<sy/2;y+=step)for(let z=-sz/2+step*0.5;z<sz/2;z+=step)for(let x=-sx/2+step*0.5;x<sx/2;x+=step){
      if(!insideContainer(this.spec,x,y,z))continue
      candidates.push([x,y,z,v.set(x,y,z).applyQuaternion(q).y])
    }
    candidates.sort((a,b)=>a[3]-b[3])
    const n=Math.min(this.maxCount,Math.max(1,Math.round(volume/this.referenceVolume)),candidates.length)
    for(let i=0;i<n;i++)this._insert(candidates[i],volume/n)
  }
  _insert(local,volume,velocity=[0,0,0]) {
    if(this.count>=MAX_PARTICLES){this.volumes[this.count-1]+=volume;return}
    const i=this.count++,o=i*3
    for(let a=0;a<3;a++){this.positions[o+a]=local[a]*this.scale+GRID/2;this.velocities[o+a]=velocity[a]*this.scale}
    this.volumes[i]=volume
  }
  volume(){let n=0;for(let i=0;i<this.count;i++)n+=this.volumes[i];return n}
  setVolume(volume) {
    if(!Number.isFinite(volume)||volume<0||volume>this.spec.capacityM3+1e-10)throw new RangeError('Recipiente: volumen de partículas inválido')
    let difference=volume-this.volume()
    if(difference>1e-14){
      const n=Math.min(this.maxCount-this.count,Math.max(1,Math.ceil(difference/this.referenceVolume)))
      if(n<=0){if(this.count)this.volumes[this.count-1]+=difference;else this._seed(difference)}
      else for(let i=0;i<n;i++)this._insert([(i%3-1)*this.spec.size[0]*0.07,this.spec.size[1]*0.38,(Math.floor(i/3)%3-1)*this.spec.size[2]*0.07],difference/n)
    } else while(difference < -1e-14 && this.count){const i=this.count-1,take=Math.min(this.volumes[i],-difference);this.volumes[i]-=take;difference+=take;if(this.volumes[i]<1e-14)this.count--}
    this.revision++
  }
  receive(volume,position,velocity=[0,0,0]){
    q.fromArray(this.pose.quaternion).normalize();qi.copy(q).invert()
    const local=v.fromArray(position).sub(v2.fromArray(this.pose.position)).applyQuaternion(qi).toArray()
    const speed=v.fromArray(velocity).applyQuaternion(qi).toArray()
    this._insert(local,volume,speed);this.revision++
  }
  setSpec(spec){
    const nextScale=(GRID-6)/Math.max(...spec.size)
    if(nextScale!==this.scale){
      const ratio=nextScale/this.scale
      for(let i=0;i<this.count*3;i++){this.positions[i]=(this.positions[i]-GRID/2)*ratio+GRID/2;this.velocities[i]*=ratio}
      this.restDensity/=ratio**3;this.scale=nextScale
    }
    this.spec={...spec,size:[...spec.size]}
  }
  impulse(velocity){for(let i=0;i<this.count;i++)for(let a=0;a<3;a++)this.velocities[i*3+a]+=velocity[a]*this.scale}
  _prepareStencil() {
    const p=this.positions
    for(let i=0;i<this.count;i++){
      const o=i*3,x=p[o],y=p[o+1],z=p[o+2],bx=Math.floor(x),by=Math.floor(y),bz=Math.floor(z)
      const dx=x-bx-0.5,dy=y-by-0.5,dz=z-bz-0.5
      const wx=[0.5*(0.5-dx)**2,0.75-dx*dx,0.5*(0.5+dx)**2]
      const wy=[0.5*(0.5-dy)**2,0.75-dy*dy,0.5*(0.5+dy)**2]
      const wz=[0.5*(0.5-dz)**2,0.75-dz*dz,0.5*(0.5+dz)**2]
      let a=0
      for(let gx=0;gx<3;gx++)for(let gy=0;gy<3;gy++)for(let gz=0;gz<3;gz++,a++){
        const xx=Math.max(0,Math.min(GRID-1,bx+gx-1)),yy=Math.max(0,Math.min(GRID-1,by+gy-1)),zz=Math.max(0,Math.min(GRID-1,bz+gz-1)),k=i*27+a,t=k*3
        this.indices[k]=(xx*GRID+yy)*GRID+zz;this.weights[k]=wx[gx]*wy[gy]*wz[gz]
        this.offsets[t]=xx+0.5-x;this.offsets[t+1]=yy+0.5-y;this.offsets[t+2]=zz+0.5-z
      }
    }
  }
  _p2gMass(){
    this.mass.fill(0);this.mx.fill(0);this.my.fill(0);this.mz.fill(0)
    for(let i=0;i<this.count;i++){
      const o=i*3,c=i*9,m=this.volumes[i]/this.referenceVolume
      for(let a=0;a<27;a++){
        const k=i*27+a,j=this.indices[k],t=k*3,w=this.weights[k]*m,x=this.offsets[t],y=this.offsets[t+1],z=this.offsets[t+2],C=this.affine
        this.mass[j]+=w
        this.mx[j]+=w*(this.velocities[o]+C[c]*x+C[c+1]*y+C[c+2]*z)
        this.my[j]+=w*(this.velocities[o+1]+C[c+3]*x+C[c+4]*y+C[c+5]*z)
        this.mz[j]+=w*(this.velocities[o+2]+C[c+6]*x+C[c+7]*y+C[c+8]*z)
      }
    }
  }
  _project(i,dt,frameVelocity,spills) {
    const o=i*3,s=this.spec,[sx,sy,sz]=s.size,eps=0.12/this.scale
    let x=(this.positions[o]-GRID/2)/this.scale,y=(this.positions[o+1]-GRID/2)/this.scale,z=(this.positions[o+2]-GRID/2)/this.scale
    if(!s.closed && y>sy/2+eps){
      q.fromArray(this.pose.quaternion).normalize();v.set(x,y,z).applyQuaternion(q).add(v2.fromArray(this.pose.position));v2.set(this.velocities[o]/this.scale,this.velocities[o+1]/this.scale,this.velocities[o+2]/this.scale).applyQuaternion(q)
      spills.push({position:v.toArray(),velocity:v2.toArray(),volumeM3:this.volumes[i]});this._remove(i);return true
    }
    const ox=x,oy=y,oz=z
    y=Math.max(y,-sy/2+eps)
    if(s.closed)y=Math.min(y,sy/2-eps)
    if(s.shape==='box'){x=Math.max(-sx/2+eps,Math.min(sx/2-eps,x));z=Math.max(-sz/2+eps,Math.min(sz/2-eps,z))}
    else {const f=containerRadiusFactor(s,y),rx=Math.max(eps,sx*f/2-eps),rz=Math.max(eps,sz*f/2-eps),r=Math.hypot(x/rx,z/rz);if(r>1){x/=r;z/=r}}
    this.positions[o]=Math.max(1.5,Math.min(GRID-2.5,x*this.scale+GRID/2));this.positions[o+1]=Math.max(1.5,Math.min(GRID-2.5,y*this.scale+GRID/2));this.positions[o+2]=Math.max(1.5,Math.min(GRID-2.5,z*this.scale+GRID/2))
    if(x!==ox||y!==oy||z!==oz){
      const nx=x-ox,ny=y-oy,nz=z-oz,n=Math.hypot(nx,ny,nz),vx=this.velocities[o]-frameVelocity[0],vy=this.velocities[o+1]-frameVelocity[1],vz=this.velocities[o+2]-frameVelocity[2]
      const dot=(vx*nx+vy*ny+vz*nz)/Math.max(n,1e-12)
      if(dot<0){this.velocities[o]-=dot*nx/n;this.velocities[o+1]-=dot*ny/n;this.velocities[o+2]-=dot*nz/n}
      for(let a=0;a<9;a++)this.affine[i*9+a]*=0.25
    }
    return false
  }
  _remove(i){const last=--this.count;if(i===last)return;this.positions.copyWithin(i*3,last*3,last*3+3);this.velocities.copyWithin(i*3,last*3,last*3+3);this.affine.copyWithin(i*9,last*9,last*9+9);this.volumes[i]=this.volumes[last]}
  step(dt,pose=this.pose) {
    if(!Number.isFinite(dt)||dt<=0||dt>0.1||!finiteArray(pose.position,3)||!finiteArray(pose.quaternion,4)||Math.hypot(...pose.quaternion)<1e-9)throw new RangeError('Recipiente: paso o pose inválida')
    const spills=[],old=this.pose
    q.fromArray(pose.quaternion).normalize();qi.copy(q).invert();oldQ.fromArray(old.quaternion).normalize()
    // Keep particles in world space while rebasing the moving/rotating vessel grid.
    for(let i=0;i<this.count;i++){
      const o=i*3
      v.set((this.positions[o]-GRID/2)/this.scale,(this.positions[o+1]-GRID/2)/this.scale,(this.positions[o+2]-GRID/2)/this.scale).applyQuaternion(oldQ).add(v2.fromArray(old.position)).sub(v2.fromArray(pose.position)).applyQuaternion(qi)
      this.positions[o]=v.x*this.scale+GRID/2;this.positions[o+1]=v.y*this.scale+GRID/2;this.positions[o+2]=v.z*this.scale+GRID/2
      v.fromArray(this.velocities,o).applyQuaternion(oldQ).applyQuaternion(qi);v.toArray(this.velocities,o)
    }
    const frame=v.fromArray(pose.position).sub(v2.fromArray(old.position)).multiplyScalar(this.scale/dt).applyQuaternion(qi).toArray()
    this.pose=structuredClone(pose)
    const gravity=v.set(0,-9.81*this.scale,0).applyQuaternion(qi).toArray()
    const stiffness=Math.max(200,40*9.81*this.scale),steps=Math.min(32,Math.max(2,Math.ceil(dt*Math.sqrt(stiffness)/0.2))),h=dt/steps
    for(let sub=0;sub<steps;sub++){
      for(let i=0;i<this.count;i++)if(this._project(i,h,frame,spills))i--
      if(!this.count)break
      this._prepareStencil();this._p2gMass()
      for(let i=0;i<this.count;i++){
        let density=0
        for(let a=0;a<27;a++){const k=i*27+a;density+=this.mass[this.indices[k]]*this.weights[k]}
        const mass=this.volumes[i]/this.referenceVolume,volume=mass/Math.max(density,1e-8)
        const pressure=Math.max(0,stiffness*(density/this.restDensity-1)),term=volume*4*h*pressure
        for(let a=0;a<27;a++){
          const k=i*27+a,j=this.indices[k],t=k*3,w=term*this.weights[k]
          this.mx[j]+=w*this.offsets[t];this.my[j]+=w*this.offsets[t+1];this.mz[j]+=w*this.offsets[t+2]
        }
      }
      for(let j=0;j<CELLS;j++)if(this.mass[j]>1e-12){const m=this.mass[j];this.mx[j]=this.mx[j]/m+gravity[0]*h;this.my[j]=this.my[j]/m+gravity[1]*h;this.mz[j]=this.mz[j]/m+gravity[2]*h
        // Grid boundary conditions are essential: stopping only particles lets the
        // grid continually advect mass through the floor and compress the free surface.
        const x=(Math.floor(j/(GRID*GRID))+0.5-GRID/2)/this.scale,y=(Math.floor(j/GRID)%GRID+0.5-GRID/2)/this.scale,z=(j%GRID+0.5-GRID/2)/this.scale
        const s=this.spec,pad=0.45/this.scale
        if(y < -s.size[1]/2+pad && this.my[j]<frame[1])this.my[j]=frame[1]
        if(s.closed && y>s.size[1]/2-pad && this.my[j]>frame[1])this.my[j]=frame[1]
        if(s.shape==='box'){
          if(x < -s.size[0]/2+pad && this.mx[j]<frame[0] || x>s.size[0]/2-pad && this.mx[j]>frame[0])this.mx[j]=frame[0]
          if(z < -s.size[2]/2+pad && this.mz[j]<frame[2] || z>s.size[2]/2-pad && this.mz[j]>frame[2])this.mz[j]=frame[2]
        }else{
          const f=containerRadiusFactor(s,y),rx=Math.max(pad,s.size[0]*f/2-pad),rz=Math.max(pad,s.size[2]*f/2-pad)
          if((x/rx)**2+(z/rz)**2>1){
            const nx=x/(rx*rx),nz=z/(rz*rz),dot=((this.mx[j]-frame[0])*nx+(this.mz[j]-frame[2])*nz)/(nx*nx+nz*nz||1)
            if(dot>0){this.mx[j]-=dot*nx;this.mz[j]-=dot*nz}
          }
        }
      }
      const attenuation=Math.exp(-Math.max(0.12,(this.spec.liquid?.viscosity??1)*0.6)*h)
      const limit=0.4/h
      for(let i=0;i<this.count;i++){
        const o=i*3,c=i*9;let vx=0,vy=0,vz=0
        for(let a=0;a<9;a++)this.affine[c+a]=0
        for(let a=0;a<27;a++){
          const k=i*27+a,j=this.indices[k],t=k*3,w=this.weights[k],x=this.offsets[t],y=this.offsets[t+1],z=this.offsets[t+2],xx=this.mx[j]*w,yy=this.my[j]*w,zz=this.mz[j]*w
          vx+=xx;vy+=yy;vz+=zz
          this.affine[c]+=xx*x*4;this.affine[c+1]+=xx*y*4;this.affine[c+2]+=xx*z*4
          this.affine[c+3]+=yy*x*4;this.affine[c+4]+=yy*y*4;this.affine[c+5]+=yy*z*4
          this.affine[c+6]+=zz*x*4;this.affine[c+7]+=zz*y*4;this.affine[c+8]+=zz*z*4
        }
        this.velocities[o]=Math.max(-limit,Math.min(limit,vx*attenuation));this.velocities[o+1]=Math.max(-limit,Math.min(limit,vy*attenuation));this.velocities[o+2]=Math.max(-limit,Math.min(limit,vz*attenuation))
        for(let a=0;a<3;a++)this.positions[o+a]+=this.velocities[o+a]*h
        if(this._project(i,h,frame,spills))i--
      }
    }
    this.time+=dt;this.revision++
    return spills
  }
  localPositions(){const out=new Float32Array(this.count*3);for(let i=0;i<out.length;i++)out[i]=(this.positions[i]-GRID/2)/this.scale;return out}
  snapshot(){return {count:this.count,positions:Array.from(this.positions.subarray(0,this.count*3)),velocities:Array.from(this.velocities.subarray(0,this.count*3)),affine:Array.from(this.affine.subarray(0,this.count*9)),volumes:Array.from(this.volumes.subarray(0,this.count)),pose:structuredClone(this.pose),time:this.time,restDensity:this.restDensity}}
  validateSnapshot(s,volume){
    if(!s||!Number.isInteger(s.count)||s.count<0||s.count>MAX_PARTICLES||!finiteArray(s.positions,s.count*3)||s.positions.some(v=>v<0||v>GRID)||!finiteArray(s.velocities,s.count*3)||!finiteArray(s.affine,s.count*9)||!finiteArray(s.volumes,s.count)||s.volumes.some(v=>v<=0)||!finiteArray(s.pose?.position,3)||!finiteArray(s.pose?.quaternion,4)||Math.hypot(...s.pose.quaternion)<1e-9||!Number.isFinite(s.time)||s.time<0||!Number.isFinite(s.restDensity)||s.restDensity<=0||Math.abs(s.volumes.reduce((a,b)=>a+b,0)-volume)>1e-9)throw new Error('Recipiente: partículas del snapshot inválidas')
    return structuredClone(s)
  }
  restore(s){this.count=s.count;this.positions.set(s.positions);this.velocities.set(s.velocities);this.affine.set(s.affine);this.volumes.set(s.volumes);this.pose=s.pose;this.time=s.time;this.restDensity=s.restDensity;this.revision++}
}
