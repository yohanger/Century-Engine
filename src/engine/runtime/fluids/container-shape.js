// Interior parametrizado en metros. Compartido por autoría, solver y render.
export function containerCapacity(shape, size, vessel = 'cup', mouthRadius = null, neckHeight = null) {
  const [x,y,z]=size
  if(shape==='box')return x*y*z
  const area=Math.PI*x*z/4
  if(vessel!=='bottle')return area*y
  const r=Math.min(x,z)/2, mouth=Math.min(r,mouthRadius??r*0.38), neck=Math.min(y*0.45,neckHeight??y*0.18)
  const shoulder=y*0.18, ratio=mouth/r
  return area*(y-neck-shoulder+shoulder*(1+ratio+ratio*ratio)/3+neck*ratio*ratio)
}
export function containerRadiusFactor(spec, y) {
  if(spec.vessel!=='bottle')return 1
  const h=spec.size[1],r=Math.min(spec.size[0],spec.size[2])/2
  const ratio=Math.min(1,(spec.mouthRadius??r*0.38)/r),neck=Math.min(h*0.45,spec.neckHeight??h*0.18)
  const shoulder=h*0.18, start=h/2-neck-shoulder
  return y<=start ? 1 : y>=h/2-neck ? ratio : 1-(1-ratio)*(y-start)/shoulder
}
export function insideContainer(spec,x,y,z,margin=0) {
  const [sx,sy,sz]=spec.size
  if(y < -sy/2+margin || y > sy/2-margin)return false
  if(spec.shape==='box')return Math.abs(x)<=sx/2-margin && Math.abs(z)<=sz/2-margin
  const f=containerRadiusFactor(spec,y),rx=Math.max(1e-7,sx/2*f-margin),rz=Math.max(1e-7,sz/2*f-margin)
  return (x/rx)**2+(z/rz)**2<=1
}
export function containerLocalPoint(point,pose) {
  const [qx,qy,qz,qw]=pose.quaternion,n=qx*qx+qy*qy+qz*qz+qw*qw
  const x=point[0]-pose.position[0],y=point[1]-pose.position[1],z=point[2]-pose.position[2]
  const tx=2*(-qy*z+qz*y)/n,ty=2*(-qz*x+qx*z)/n,tz=2*(-qx*y+qy*x)/n
  return [x+qw*tx-qy*tz+qz*ty,y+qw*ty-qz*tx+qx*tz,z+qw*tz-qx*ty+qy*tx]
}
