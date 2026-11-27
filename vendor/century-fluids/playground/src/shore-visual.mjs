import * as THREE from 'three';
import {terrainHeight} from './shore.mjs';

const wetSize=80;

export function makeShoreTerrain(field,sandTexture,rockTexture) {
  const {columns,rows,origin,cellSizeXMeters:dx,cellSizeZMeters:dz,heightsMeters}=field;
  const positions=[],colors=[],uvs=[],indices=[],rockWeights=[];
  const width=(columns-1)*dx, depth=(rows-1)*dz;
  const sand=new THREE.Color(0xd9b78a),stone=new THREE.Color(0x9a7957),darkStone=new THREE.Color(0x594b3b);
  const shade=new THREE.Color();
  for(let j=0;j<rows;j++) for(let i=0;i<columns;i++) {
    const x=origin.x+i*dx,z=origin.z+j*dz,y=origin.y+heightsMeters[j*columns+i];
    const slope=Math.hypot((terrainHeight(field,x+dx,z)-terrainHeight(field,x-dx,z))/(2*dx),
      (terrainHeight(field,x,z+dz)-terrainHeight(field,x,z-dz))/(2*dz));
    const rock=Math.max(THREE.MathUtils.smoothstep(slope,.44,1.4)*THREE.MathUtils.smoothstep(Math.abs(x),.41,.62),
      1-THREE.MathUtils.smoothstep(z,-1.40,-1.27));
    const grain=.91+.07*Math.sin(23*x+2*Math.sin(22*z))*Math.sin(29*z)+.07*Math.sin(43*x+55*z);
    shade.copy(sand).lerp(stone,rock).lerp(darkStone,rock*.36).multiplyScalar(grain);
    positions.push(x,y,z);colors.push(shade.r,shade.g,shade.b);uvs.push(i/(columns-1),j/(rows-1));rockWeights.push(rock);
    if(i<columns-1&&j<rows-1){
      const a=j*columns+i,b=a+1,c=a+columns,d=c+1;
      indices.push(a,c,b,b,c,d);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('rockWeight',new THREE.Float32BufferAttribute(rockWeights,1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const wet=new Float32Array(wetSize*wetSize),wetPixels=new Uint8Array(wet.length);
  const wetMap=new THREE.DataTexture(wetPixels,wetSize,wetSize,THREE.RedFormat);
  wetMap.magFilter=wetMap.minFilter=THREE.LinearFilter;
  wetMap.needsUpdate=true;
  const material=new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:.92,envMapIntensity:.36,
  });
  material.onBeforeCompile=shader=>{
    shader.uniforms.shoreSand={value:sandTexture};
    shader.uniforms.shoreRock={value:rockTexture};
    shader.uniforms.wetSand={value:wetMap};
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>',`#include <common>
        attribute float rockWeight;
        varying float vRock;
        varying vec2 vGroundUv;`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        vRock = rockWeight;
        vGroundUv = uv;`);
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>
        uniform sampler2D shoreSand;
        uniform sampler2D shoreRock;
        uniform sampler2D wetSand;
        varying float vRock;
        varying vec2 vGroundUv;`)
      .replace('#include <map_fragment>',`#include <map_fragment>
        vec3 sandColor = texture2D(shoreSand, vGroundUv * vec2(5.0, 6.4)).rgb;
        vec3 rockColor = texture2D(shoreRock, vGroundUv * vec2(3.4, 3.0)).rgb;
        float wetness = texture2D(wetSand, vGroundUv).r;
        diffuseColor.rgb *= mix(sandColor * 1.34, rockColor * 2.15, vRock);
        diffuseColor.rgb *= mix(1.0, .46, wetness);`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor *= mix(1.0, .74, wetness * (1.0 - vRock));`);
  };
  const mesh=new THREE.Mesh(geometry,material);
  let lastSeconds=0;
  const updateWetness=(snapshot,seconds)=>{
    const retain=Math.exp(-Math.max(0,seconds-lastSeconds)/3.2);
    lastSeconds=seconds;
    for(let i=0;i<wet.length;i++)wet[i]*=retain;
    const p=snapshot.positionsXYZ, radius=.096;
    for(let i=0;i<p.length;i+=3){
      const x=p[i],y=p[i+1],z=p[i+2];
      if(y-terrainHeight(field,x,z)>.10)continue;
      const imin=Math.max(0,Math.floor((x-origin.x-radius)/width*(wetSize-1)));
      const imax=Math.min(wetSize-1,Math.ceil((x-origin.x+radius)/width*(wetSize-1)));
      const jmin=Math.max(0,Math.floor((z-origin.z-radius)/depth*(wetSize-1)));
      const jmax=Math.min(wetSize-1,Math.ceil((z-origin.z+radius)/depth*(wetSize-1)));
      for(let j=jmin;j<=jmax;j++)for(let k=imin;k<=imax;k++){
        const weight=1-((origin.x+k*width/(wetSize-1)-x)**2+(origin.z+j*depth/(wetSize-1)-z)**2)/radius**2;
        const index=j*wetSize+k;
        wet[index]=Math.max(wet[index],Math.min(1,1.7*weight));
      }
    }
    for(let i=0;i<wet.length;i++)wetPixels[i]=Math.round(wet[i]*255);
    wetMap.needsUpdate=true;
  };
  return {mesh,updateWetness,dispose:()=>wetMap.dispose()};
}
