import * as THREE from 'three';
import {terrainHeight} from './shore.mjs';

const declaration = /* glsl */`
  varying vec3 waterPosition;
  varying float waterDepth;
  varying float waterAir;
  uniform float waterSeconds;
  uniform float waterFoam;
`;

const bubbleFunctions = /* glsl */`
  vec3 foamRandom(vec2 p) {
    vec3 h = fract(p.xyx * vec3(.1031, .1173, .0921));
    h += dot(h, h.yzx + 19.19);
    return fract((h.xxy + h.yzz) * h.zyx);
  }

  float foamNoise(vec2 p) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    f *= f * (3.0 - 2.0 * f);
    return mix(
      mix(foamRandom(cell).x, foamRandom(cell + vec2(1.0, 0.0)).x, f.x),
      mix(foamRandom(cell + vec2(0.0, 1.0)).x, foamRandom(cell + 1.0).x, f.x), f.y
    );
  }

  vec3 bubbleFoam(vec2 p, float pixelSize, float air, float time) {
    vec2 flow = p - vec2(.012, -.009) * time;
    float clusterNoise = foamNoise(flow * 12.0);
    vec2 warp = vec2(clusterNoise, foamNoise(flow * 15.0 + vec2(22.1, 9.6))) - .5;
    vec2 uv = (flow + .035 * warp) * 42.0;
    vec2 cell = floor(uv);
    vec2 withinCell = fract(uv);
    float best = 2.0;
    float bubbleRadius = 1.0;
    float phase = 0.0;
    vec2 offset = vec2(0.0);
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 neighbor = vec2(float(x), float(y));
        vec3 seed = foamRandom(cell + neighbor);
        vec2 center = neighbor + mix(vec2(.12), vec2(.88), seed.xy);
        float radius = mix(.16, .47, seed.z * seed.z);
        vec2 delta = withinCell - center;
        float edge = length(delta) - radius;
        if (edge < best) {
          best = edge;
          bubbleRadius = radius;
          phase = seed.y;
          offset = delta;
        }
      }
    }

    best -= .06 * bubbleRadius * sin(2.3 * time + 6.283 * phase);
    float aa = clamp(pixelSize * 21.0, .009, .14);
    float film = 1.0 - smoothstep(-aa, aa, best);
    float rim = 1.0 - smoothstep(.027, .060 + aa, abs(best));
    vec2 highlight = offset + vec2(.29, -.35) * bubbleRadius;
    float glint = 1.0 - smoothstep(.012, .051 + aa, length(highlight));
    float detail = 1.0 - smoothstep(.32, .80, pixelSize * 42.0);
    float clump = smoothstep(.28, .78, clusterNoise * .68 + air * .58);
    return vec3(clump, clump * detail * (.15 * film + .76 * rim), clump * detail * glint * film);
  }
`;

/** Read optical inputs from the liquid mesh and its optional air state. */
export function installWaterOptics(material,coastal=false) {
  const seconds={value:0};
  const foam={value:1};
  const bed={sand:{value:null},uv:{value:new THREE.Vector4()}};
  material.customProgramCacheKey=()=>coastal?'water-coastal-bubbles':'water-contained-bubbles';
  material.onBeforeCompile=shader=>{
    shader.uniforms.waterSeconds=seconds;
    shader.uniforms.waterFoam=foam;
    if(coastal){
      shader.uniforms.waterBedSand=bed.sand;
      shader.uniforms.waterBedUv=bed.uv;
    }
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>',`#include <common>
        attribute float liquidDepth;
        attribute float entrainedAir;
        ${declaration}`)
      .replace('#include <morphtarget_vertex>',`#include <morphtarget_vertex>
        waterPosition = transformed;
        waterDepth = liquidDepth;
        waterAir = entrainedAir;`);
    // The screen-space refraction sample is kept near the silhouette. The
    // optical absorption below still integrates over the full water depth.
    if(coastal)shader.fragmentShader=shader.fragmentShader.replace('#include <transmission_pars_fragment>',
      THREE.ShaderChunk.transmission_pars_fragment
        .replace('vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );',
          'vec3 transmissionRay = getVolumeTransmissionRay( n, v, min(.065, thickness * .38), ior, modelMatrix );')
        .replace('volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );',
          'volumeAttenuation( thickness, attenuationColor, attenuationDistance );'));
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>
        ${declaration}
        ${bubbleFunctions}
        ${coastal?'uniform sampler2D waterBedSand; uniform vec4 waterBedUv;':''}`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        vec3 worldUp = normalize(mat3(viewMatrix) * vec3(0.0, 1.0, 0.0));
        float upward = smoothstep(0.14, 0.85, dot(normal, worldUp));
        vec2 waveUV = waterPosition.xz;
        vec2 q = waveUV;
        float w1 = dot(q, vec2(13.0, 22.0)) - 3.4 * waterSeconds;
        float w2 = dot(q, vec2(-27.0, 18.0)) - 4.6 * waterSeconds;
        float w3 = dot(q, vec2(65.0, 38.0)) + 6.7 * waterSeconds;
        float crest1 = exp(sin(w1) - 1.0) * cos(w1);
        float crest2 = exp(sin(w2) - 1.0) * cos(w2);
        vec2 gradient = .0060 * vec2(13.0, 22.0) * crest1 + .0023 * vec2(-27.0, 18.0) * crest2;
        gradient += .00048 * vec2(65.0, 38.0) * cos(w3);
        float rippleFade = 1.0 - smoothstep(.25, .9, max(length(dFdx(waveUV)), length(dFdy(waveUV))) * 76.0);
        float shoreFade = smoothstep(.012, .095, waterDepth);
        vec3 waterRipple = vec3(-gradient.x, 0.0, -gradient.y);
        normal = normalize(mix(normal, worldUp, ${coastal?'.18':'.0'} * upward) +
          (mat3(viewMatrix) * waterRipple) * upward * rippleFade * shoreFade);
        float airCoverage = (1.0 - exp(-23500.0 * max(0.0, waterAir))) * upward * waterFoam;
        float foamPixel = max(length(dFdx(waveUV)), length(dFdy(waveUV)));
        float foamCoverage = 0.0;
        float foamGlint = 0.0;
        if (airCoverage > .002) {
          vec3 bubbles = bubbleFoam(waveUV, foamPixel, airCoverage, waterSeconds);
          foamCoverage = airCoverage * (.25 * bubbles.x + .75 * bubbles.y);
          foamGlint = .16 * airCoverage * bubbles.z;
        }
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.91, .955, .98), clamp(foamCoverage + foamGlint, 0.0, 1.0));
        roughnessFactor = mix(roughnessFactor, .46, foamCoverage);`)
      .replace('#include <transmission_fragment>',THREE.ShaderChunk.transmission_fragment
        .replace('material.thickness = thickness;',coastal?
          'material.thickness = clamp(waterDepth, .009, .56) * 1.14;':'material.thickness = clamp(waterDepth, .012, .65);')
        .replace('material.transmission = transmission;', 'material.transmission = transmission * (1.0 - foamCoverage * .98);')
        .replace('material.transmissionAlpha = mix(',coastal?`
          // Refract the known textured bed in shallow water. The sampled
          // screen color remains available for higher relief and deeper water.
          vec3 bent = refract(-v, normalize(n), 1.0 / material.ior);
          vec2 bedPoint = pos.xz + bent.xz * min(.15, material.thickness / max(.40, -bent.y));
          vec2 bedUv = (bedPoint - waterBedUv.xy) * waterBedUv.zw;
          vec3 sandLight = texture2D(waterBedSand, bedUv * vec2(5.0, 6.4)).rgb;
          const vec3 wetSandTint = vec3(.84, .65, .42);
          vec3 transmittedBed = sandLight * wetSandTint *
            volumeAttenuation(material.thickness, max(material.attenuationColor, vec3(.01)), material.attenuationDistance);
          float shallowBed = .92 * (1.0 - smoothstep(.06, .23, waterDepth));
          shallowBed *= 1.0 - smoothstep(.33, .49, abs(bedPoint.x));
          transmitted.rgb = mix(transmitted.rgb, transmittedBed, shallowBed);
          material.transmissionAlpha = mix(`:'material.transmissionAlpha = mix('));
  };
  return {seconds,bed,foam};
}

export function addWaterOpticsAttributes(geometry,field,mesh) {
  const positions=geometry.getAttribute('position').array;
  const depth=field?new Float32Array(positions.length/3):mesh?.depthMeters??new Float32Array(positions.length/3);
  if(field)for(let i=0;i<depth.length;i++) {
    const j=3*i;
    depth[i]=Math.max(0,positions[j+1]-terrainHeight(field,positions[j],positions[j+2]));
  }
  geometry.computeBoundingBox();
  geometry.setAttribute('liquidDepth',new THREE.BufferAttribute(depth,1));
  geometry.setAttribute('entrainedAir',new THREE.BufferAttribute(mesh?.agitation?.map(value=>value*.000055)??new Float32Array(depth.length),1)
    .setUsage(THREE.DynamicDrawUsage));
}

export function surfaceAirParcels(state) {
  const parcels=[];
  if(!state)return parcels;
  const radius=.11;
  const p=state.particles.positionsXYZ;
  for(let i=0;i<state.airVolumeM3.length;i++) {
    const volume=state.airVolumeM3[i];
    if(volume<1e-11)continue;
    parcels.push({
      x:p[3*i], y:p[3*i+1]+.025, z:p[3*i+2], radiusSquared:radius*radius,
      column:3*volume/(Math.PI*radius*radius),
    });
  }
  return parcels;
}

export function projectSurfaceAir(geometry,parcels) {
  const attribute=geometry.getAttribute('entrainedAir');
  const positions=geometry.getAttribute('position').array;
  const air=attribute.array;
  const {min,max}=geometry.boundingBox;
  air.fill(0);
  for(const {x,y,z,radiusSquared,column} of parcels) {
    const radius=Math.sqrt(radiusSquared);
    if(x<min.x-radius||x>max.x+radius||y<min.y-radius||y>max.y+radius||z<min.z-radius||z>max.z+radius)continue;
    for(let i=0;i<air.length;i++) {
      const j=3*i;
      const distanceSquared=(positions[j]-x)**2+2.8*(positions[j+1]-y)**2+(positions[j+2]-z)**2;
      if(distanceSquared>=radiusSquared)continue;
      air[i]+=column*(1-distanceSquared/radiusSquared)**2;
    }
  }
  attribute.needsUpdate=true;
}

