// Camera-centred polar grid adapted from Ultra Water's OceanSurface (MIT).
// Geometric rings keep shore crests resolved near a moving observer in a large sea.
import {BufferGeometry,Float32BufferAttribute} from 'three'
export function oceanGrid(size,angular=128){
  const radii=[],ratio=1+2*Math.PI/angular
  for(let r=.035;r<Math.max(32,size)*2;r*=ratio)radii.push(r)
  const positions=[0,0,0],normals=[0,1,0],indices=[]
  for(const r of radii)for(let a=0;a<angular;a++){const t=a/angular*2*Math.PI;positions.push(Math.cos(t)*r,0,Math.sin(t)*r);normals.push(0,1,0)}
  for(let a=0;a<angular;a++)indices.push(0,1+(a+1)%angular,1+a)
  for(let k=0;k<radii.length-1;k++)for(let a=0;a<angular;a++){
    const i=1+k*angular+a,j=1+k*angular+(a+1)%angular
    indices.push(i,j,i+angular,j,j+angular,i+angular)
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('normal',new Float32BufferAttribute(normals,3));g.setIndex(indices);return g
}
