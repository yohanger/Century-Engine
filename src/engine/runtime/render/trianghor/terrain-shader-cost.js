// Estimación por FRAGMENTO del coste de pintura Terrain (ramas efectivas del shader
// de producción). No es una consulta de tiempo GPU ni recuenta overdraw.
export function terrainFragmentCost(weights, textureSlots, threshold=0.003) {
  let layers=0, textured=0
  for(let k=0;k<8;k++) if((weights[k]||0)>=threshold) {
    layers++
    if((textureSlots[k]??-1)>=0) textured++
  }
  return { layers,textured,score:layers*0.35+textured }
}
export const TERRAIN_COMPLEXITY_VERTEX = `
attribute vec4 splatA;
attribute vec4 splatB;
varying vec4 vSpA;
varying vec4 vSpB;
void main() {
  vSpA=splatA;vSpB=splatB;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`
export const TERRAIN_COMPLEXITY_FRAGMENT = `
precision highp float;
varying vec4 vSpA;
varying vec4 vSpB;
uniform float uLTex[8];
void main() {
  float layers=0.0, textures=0.0;
  for (int k=0;k<8;k++) {
    float w=k<4 ? vSpA[k] : vSpB[k-4];
    if(w<0.003) continue;
    layers+=1.0;
    if(uLTex[k]>-0.5) textures+=1.0;
  }
  float score=layers*0.35+textures;
  vec3 color=vec3(0.16,0.75,0.50);
  if(score>1.0) color=vec3(0.57,0.79,0.29);
  if(score>2.0) color=vec3(0.90,0.73,0.25);
  if(score>3.0) color=vec3(0.91,0.52,0.22);
  if(score>4.0) color=vec3(0.84,0.30,0.31);
  if(score>5.0) color=vec3(0.60,0.17,0.48);
  gl_FragColor=vec4(color,1.0);
}`
