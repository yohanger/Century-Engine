// Extiende el MeshPhysicalMaterial existente; Terrain sigue siendo dueño de su shader.
// Solo se añade GLSL a objetos mesh que activaron explícitamente Vertex Paint.
import * as THREE from 'three'
import { MAX_LAYERS } from '../geometry/terrain-splat.js'
import { layerPixels } from '../geometry/terrain.js'
import { meshPaintConfig } from './vertex-paint.js'

const RES = 256 // 2 MiB máximo de texels para ocho capas por material.
const declV = `attribute vec4 lfWeights0; attribute vec4 lfWeights1; attribute vec2 lfPaintUV;
varying vec4 vLfPaintA; varying vec4 vLfPaintB;
varying vec2 vLfPaintUv;`
const declF = `varying vec4 vLfPaintA; varying vec4 vLfPaintB;
varying vec2 vLfPaintUv;
uniform vec3 uLfPaintColor[${MAX_LAYERS}];
uniform float uLfPaintTile[${MAX_LAYERS}];
uniform float uLfPaintTex[${MAX_LAYERS}];
uniform highp sampler2DArray uLfPaintArray;`
const colorShader = `{
  vec3 paintAcc = vec3(0.0); float paintSum = 0.0;
  for (int k=0; k<${MAX_LAYERS}; ++k) {
    float w = k < 4 ? vLfPaintA[k] : vLfPaintB[k-4];
    if (w < 0.0001) continue;
    vec3 col = uLfPaintColor[k];
    if (uLfPaintTex[k] >= 0.0) {
      vec2 u = vLfPaintUv / max(0.001, uLfPaintTile[k]);
      col = textureGrad(uLfPaintArray, vec3(u, uLfPaintTex[k]),
          dFdx(u), dFdy(u)).rgb;
    }
    paintAcc += col * w; paintSum += w;
  }
  // Pintar sustituye Blockout solo cuando se activa esta opción.
  diffuseColor.rgb = paintAcc / max(1e-5, paintSum);
}`
const dummyArray = () => {
  const t = new THREE.DataArrayTexture(new Uint8Array([255,255,255,255]), 1, 1, 1)
  t.needsUpdate = true
  return t
}
function uniforms() { return {
  uLfPaintColor: { value: Array.from({length: MAX_LAYERS}, () => new THREE.Color('#ffffff')) },
  uLfPaintTile: { value: new Array(MAX_LAYERS).fill(1) },
  uLfPaintTex: { value: new Array(MAX_LAYERS).fill(-1) },
  uLfPaintArray: { value: dummyArray() },
} }

async function loadLayers(state, layers) {
  const token = ++state.token
  const loaded = []
  for (let i=0; i<layers.length; i++) {
    if (!layers[i].texture) continue
    try { const px = await layerPixels(layers[i].texture); if (px) loaded.push({i, px:px.px}) }
    catch (e) { console.warn('Vertex Paint: textura no legible', e) }
  }
  if (state.token !== token || !state.active) return
  const u = state.uniforms
  u.uLfPaintTex.value.fill(-1)
  const previous = u.uLfPaintArray.value
  if (loaded.length) {
    const bytes = new Uint8Array(RES*RES*4*loaded.length)
    for (let k=0; k<loaded.length; k++) {
      const src = loaded[k].px, off = k*RES*RES*4
      for (let y=0; y<RES; y++) for (let x=0; x<RES; x++) {
        const s = ((y*2)*512+x*2)*4, d = off+(y*RES+x)*4
        bytes[d]=src[s]; bytes[d+1]=src[s+1]; bytes[d+2]=src[s+2]; bytes[d+3]=src[s+3]
      }
      u.uLfPaintTex.value[loaded[k].i]=k
    }
    const t=new THREE.DataArrayTexture(bytes,RES,RES,loaded.length)
    t.colorSpace=THREE.SRGBColorSpace
    t.wrapS=t.wrapT=THREE.RepeatWrapping
    t.minFilter=THREE.LinearMipmapLinearFilter
    t.magFilter=THREE.LinearFilter
    t.generateMipmaps=true; t.anisotropy=2; t.needsUpdate=true
    u.uLfPaintArray.value=t
  } else u.uLfPaintArray.value=dummyArray()
  previous.dispose()
  state.material.needsUpdate = true // aplica uniformes y textura cargada en el siguiente render
}

/** Se llama DESPUÉS de syncPbrMaterial para conservar las extensiones PBR y sus sombras. */
export function syncMeshPaintMaterial(mat, config) {
  const paint = meshPaintConfig(config)
  let state = mat.userData.lfMeshPaint
  if (!paint) {
    if (state?.active) {
      state.active=false; state.token++
      if (mat.onBeforeCompile === state.wrapper) {
        mat.onBeforeCompile=state.baseCompile
        mat.customProgramCacheKey=state.baseKey
      }
      state.uniforms.uLfPaintArray.value.dispose()
      state.uniforms.uLfPaintArray.value=dummyArray()
      state.textureSig=''
      mat.needsUpdate=true
    }
    return
  }
  if (!state) {
    state={active:false,token:0,material:mat,uniforms:uniforms(),baseCompile:null,baseKey:null,wrapper:null,textureSig:''}
    mat.userData.lfMeshPaint=state
    mat.addEventListener('dispose', () => { state.token++; state.active=false; state.uniforms.uLfPaintArray.value.dispose() })
  }
  if (mat.onBeforeCompile !== state.wrapper) {
    state.baseCompile=mat.onBeforeCompile; state.baseKey=mat.customProgramCacheKey
    state.wrapper=function(shader,renderer) {
      state.baseCompile.call(this,shader,renderer)
      Object.assign(shader.uniforms,state.uniforms)
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+declV)
        .replace('#include <begin_vertex>','#include <begin_vertex>\nvLfPaintA=lfWeights0; vLfPaintB=lfWeights1; vLfPaintUv=lfPaintUV;')
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+declF)
        .replace('#include <color_fragment>',colorShader)
    }
    mat.onBeforeCompile=state.wrapper
    mat.customProgramCacheKey=function(){return state.baseKey.call(this)+'|lf-mesh-paint-uv-v1'}
    mat.needsUpdate=true
  }
  state.active=true
  paint.layers.forEach((l,i)=>{state.uniforms.uLfPaintColor.value[i].set(l.color);state.uniforms.uLfPaintTile.value[i]=l.tile})
  const sig=JSON.stringify(paint.layers.map((l)=>l.texture || null))
  if (state.textureSig!==sig) {state.textureSig=sig;void loadLayers(state,paint.layers)}
}
