// Parches globales a los shaders de three.js.
//  · «Clásico»: el ambiente difuso es una luz plana (color constante); el mapa de entorno solo da reflejos.
//  · «Realista»: el cielo también ilumina de forma difusa (IBL completo), que es lo que da el aspecto fotográfico.
// three guarda los programas ya compilados con una clave que incluye `customProgramCacheKey()`; le añadimos el modo, así que al
// cambiar de modo (y marcar los materiales con needsUpdate) se recompilan con el shader correcto.
import * as THREE from 'three'

// Iluminación horneada: con lightmap (USE_LIGHTMAP) o sondas (LF_PROBES) el cielo y el ambiente ya vienen en el bake,
// así que se anulan el ambiente plano y el IBL difuso para no contarlos dos veces. Las sondas aportan su irradiancia SH.
const BAKED_PRE = `#if defined( RE_IndirectDiffuse ) && ( defined( USE_LIGHTMAP ) || defined( LF_PROBES ) )
	irradiance = vec3( 0.0 );
#endif
#if defined( RE_IndirectDiffuse ) && defined( LF_PROBES )
	irradiance += rtShIrradiance( inverseTransformDirection( geometryNormal, viewMatrix ) );
#endif
`
const IBL_LINE = 'iblIrradiance += getIBLIrradiance( geometryNormal );'
const BASE = THREE.ShaderChunk.lights_fragment_maps
const ORIGINAL = BAKED_PRE + BASE.replace(IBL_LINE, `#if !defined( USE_LIGHTMAP ) && !defined( LF_PROBES )\n\t\t${IBL_LINE}\n\t#endif`)
const CLASSIC = BAKED_PRE + BASE.replace(IBL_LINE, '')
let mode = 'classic'

if (!THREE.Material.prototype.__rtKey) {
  const base = THREE.Material.prototype.customProgramCacheKey
  THREE.Material.prototype.customProgramCacheKey = function () { return base.call(this) + '|lf:' + mode }
  THREE.Material.prototype.__rtKey = true
}

/** `true` = IBL difuso (modo realista). Devuelve si cambió algo (hay que recompilar los materiales). */
export function setIblDiffuse(on) {
  const next = on ? 'ibl' : 'classic'
  if (next === mode) return false
  mode = next
  THREE.ShaderChunk.lights_fragment_maps = on ? ORIGINAL : CLASSIC
  return true
}
export const iblDiffuse = () => mode === 'ibl'
THREE.ShaderChunk.lights_fragment_maps = CLASSIC // arranque en clásico: igual que antes de existir el PBR


// El atlas de luz tiene un atributo propio. UV0–UV3 continúan disponibles para el material.
THREE.ShaderChunk.uv_pars_vertex += `
#if defined( USE_LIGHTMAP ) && defined( LF_BAKE_UV )
  attribute vec2 lfLightmapUv;
#endif
`
THREE.ShaderChunk.uv_vertex = THREE.ShaderChunk.uv_vertex.replace(
  'vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;',
  `#ifdef LF_BAKE_UV
    vLightMapUv = lfLightmapUv;
  #else
    vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
  #endif`,
)

// Con una sola cuadrícula Three extiende el borde del volumen al resto de la escena.
THREE.ShaderChunk.lightprobes_pars_fragment = THREE.ShaderChunk.lightprobes_pars_fragment.replace(
  'return max( result, vec3( 0.0 ) );',
  `vec3 local = ( worldPos - probesMin ) / gridRange;
  vec3 edge = min( local, 1.0 - local ) * gridRange;
  float volumeFade = smoothstep( 0.0, 0.75, min( edge.x, min( edge.y, edge.z ) ) );
  return max( result, vec3( 0.0 ) ) * volumeFade;`,
)
