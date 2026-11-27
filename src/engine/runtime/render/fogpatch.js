// Niebla exponencial simple con distancia de inicio: parchea el chunk `fog_fragment` de three (global, una vez).
import * as THREE from 'three'

// La niebla es exponencial simple: 1 - exp(-d·densidad) (three usa exp(-(d·densidad)²)).
// Distancia de inicio (`fogStart`): la niebla empieza a contar a partir de esos metros. Es un número dentro del shader, así que cambiarlo
// recompila los materiales una vez (se hace en pasos de 1 m para no recompilar mientras se arrastra el control).
const FOG_CHUNK = THREE.ShaderChunk.fog_fragment
let _fogStart = 0
const fogChunk = (s) => FOG_CHUNK.replace(/float fogFactor = 1\.0 - exp\([^;]*\);/, `float fogFactor = 1.0 - exp( - fogDensity * max( vFogDepth - ${s.toFixed(1)}, 0.0 ) );`)
THREE.ShaderChunk.fog_fragment = fogChunk(0)
/** Devuelve true si cambió (hay que recompilar). */
export function setFogStart(m) {
  const s = Math.round(Math.max(0, Math.min(2000, +m || 0)))
  if (s === _fogStart) return false
  _fogStart = s; THREE.ShaderChunk.fog_fragment = fogChunk(s)
  return true
}
