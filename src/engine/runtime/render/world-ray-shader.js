import { BVHShaderGLSL } from 'three-mesh-bvh'

export const RAY_LIGHTS = 4

export const WORLD_RAY_GLSL = /* glsl */`
#ifdef LF_WORLD_TRACE
precision highp usampler2D;
${BVHShaderGLSL.common_functions}
${BVHShaderGLSL.bvh_struct_definitions}
${BVHShaderGLSL.bvh_ray_functions}

uniform BVH uWorldBvh;
uniform sampler2D tWorldAlbedo, tWorldEmission, tWorldSurface;
uniform mat4 uCameraWorld;
uniform vec3 uWorldAmbient;
uniform int uWorldLightCount;
uniform vec4 uWorldLightPos[${RAY_LIGHTS}], uWorldLightDir[${RAY_LIGHTS}], uWorldLightColor[${RAY_LIGHTS}];
uniform vec3 uWorldLightCone[${RAY_LIGHTS}];

bool worldShadow(vec3 p, vec3 dir, float limit) {
  uvec4 face;
  vec3 normal, bary;
  float side, depth;
  return bvhIntersectFirstHit(uWorldBvh, p, dir, face, normal, bary, side, depth) && depth < limit;
}

vec3 worldDirect(vec3 p, vec3 normal) {
  vec3 irradiance = uWorldAmbient;
  for (int i = 0; i < ${RAY_LIGHTS}; i++) {
    if (i >= uWorldLightCount) break;
    float kind = uWorldLightPos[i].w;
    vec3 dir;
    float distance = 1e6, attenuation = 1.0;
    if (kind == 0.0) {
      dir = uWorldLightDir[i].xyz;
    } else {
      vec3 toLight = uWorldLightPos[i].xyz - p;
      distance = length(toLight);
      dir = toLight / max(1e-4, distance);
      float range = uWorldLightDir[i].w;
      float cutoff = range > 0.0 ? clamp(1.0 - pow(distance / range, 4.0), 0.0, 1.0) : 1.0;
      attenuation = cutoff * cutoff / max(pow(distance, uWorldLightColor[i].w), 0.01);
      if (kind == 2.0) {
        vec2 cone = uWorldLightCone[i].xy;
        float angle = dot(dir, uWorldLightDir[i].xyz);
        attenuation *= cone.x < cone.y ? smoothstep(cone.x, cone.y, angle) : step(cone.x, angle);
      }
    }
    float cosine = max(0.0, dot(normal, dir));
    if (cosine * attenuation > 1e-4 && (uWorldLightCone[i].z < 0.5 || !worldShadow(p + normal * 0.012, dir, distance - 0.02))) {
      irradiance += uWorldLightColor[i].rgb * (cosine * attenuation);
    }
  }
  return irradiance;
}

vec3 worldDirection(vec3 direction) {
  return normalize((uCameraWorld * vec4(direction, 0.0)).xyz);
}

vec3 diffuseDirection(vec3 n, float seed) {
  vec3 tangent = normalize(cross(n, abs(n.y) < 0.9 ? vec3(0,1,0) : vec3(1,0,0)));
  float phase = seed * 6.2831853;
  return normalize(0.72 * n + 0.69 * (tangent * cos(phase) + cross(n, tangent) * sin(phase)));
}

vec3 traceWorld(vec3 origin, vec3 direction, float range, int bounces, float seed, bool glossy) {
  vec3 p = (uCameraWorld * vec4(origin, 1.0)).xyz;
  vec3 dir = worldDirection(direction);
  vec3 light = vec3(0.0), throughput = vec3(1.0);
  float left = range;
  for (int bounce = 0; bounce < 3; bounce++) {
    if (bounce >= bounces) break;
    uvec4 face;
    vec3 n, bary;
    float side, distance;
    if (!bvhIntersectFirstHit(uWorldBvh, p, dir, face, n, bary, side, distance) || distance >= left) break;
    vec4 emission = textureSampleBarycoord(tWorldEmission, bary, face.xyz);
    if (side < 0.0 && emission.a < 0.5) break;
    vec3 albedo = textureSampleBarycoord(tWorldAlbedo, bary, face.xyz).rgb;
    p += dir * distance;
    left -= distance;
    float fade = glossy ? smoothstep(0.0, range * 0.2, left) : left / range;
    vec3 radiance = emission.rgb + albedo * worldDirect(p, n) * 0.31830989;
    light += throughput * min(radiance, vec3(8.0)) * fade * fade;
    throughput *= albedo;
    if (max(max(throughput.r, throughput.g), throughput.b) < 0.01) break;
    p += n * 0.015;
    dir = diffuseDirection(n, fract(seed + float(bounce) * 0.61803399));
  }
  return light;
}

// Se comprueba que el material BVH corresponde al píxel de profundidad visible.
vec4 receiverSurface(vec3 p, vec3 incident) {
  float tolerance = clamp(abs(p.z) * 0.012, 0.025, 0.25);
  vec3 origin = (uCameraWorld * vec4(p - incident * tolerance, 1.0)).xyz;
  uvec4 face;
  vec3 normal, bary;
  float side, distance;
  if (!bvhIntersectFirstHit(uWorldBvh, origin, worldDirection(incident), face, normal, bary, side, distance) ||
      abs(distance - tolerance) > tolerance * 0.85) return vec4(0.0, 0.0, 0.0, 1.0);
  return textureSampleBarycoord(tWorldSurface, bary, face.xyz);
}
#endif
`
