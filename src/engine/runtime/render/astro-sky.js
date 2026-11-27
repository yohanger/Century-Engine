// Texturas del cielo real: catálogo estelar J2000 y albedo lunar (512×512). Se decodifican (zlib) la primera vez que hace falta, con
// DataTexture: así el alfa (brillo) llega sin premultiplicar —un PNG lo estropearía en las estrellas tenues. El catálogo se reorganiza
// en un atlas de cubo del cielo (world/starcat.js) con la posición de cada estrella dentro de su texel; el shader dibuja discos.
import * as THREE from 'three'
import { unzlibSync } from 'three/examples/jsm/libs/fflate.module.js'
import { STARS_B64, MOON_B64 } from '../world/astro-data.js'
import { buildStarAtlas } from '../world/starcat.js'

const unb64 = (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u }

let cache = null, moonCache = null
/** Albedo lunar 512×512 (grises): lo usa la luna del cielo con o sin astronomía real. */
export function moonTexture() {
  if (moonCache) return moonCache
  const md = unzlibSync(unb64(MOON_B64))
  const moon = new THREE.DataTexture(md, 512, 512, THREE.RedFormat, THREE.UnsignedByteType)
  moon.wrapS = moon.wrapT = THREE.ClampToEdgeWrapping
  moon.magFilter = THREE.LinearFilter; moon.minFilter = THREE.LinearFilter; moon.generateMipmaps = false
  moon.colorSpace = THREE.NoColorSpace; moon.unpackAlignment = 1; moon.needsUpdate = true
  return (moonCache = moon)
}
/** Catálogo equirrectangular 1024×512×4 tal como se distribuye (fila 0 = declinación −90°). */
export function starCatalogData() { return unzlibSync(unb64(STARS_B64)) }
/** { stars, off, moon, atlas } (se crean una sola vez y se comparten entre viewports). */
export function astroTextures() {
  if (cache) return cache
  const atlas = buildStarAtlas(starCatalogData())
  const mk = (data, format) => {
    const t = new THREE.DataTexture(data, atlas.width, atlas.height, format, THREE.UnsignedByteType)
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.magFilter = t.minFilter = THREE.NearestFilter   // se lee con texelFetch: nada de filtrado
    t.generateMipmaps = false; t.colorSpace = THREE.NoColorSpace; t.unpackAlignment = 1; t.flipY = false; t.needsUpdate = true
    return t
  }
  return (cache = { stars: mk(atlas.color, THREE.RGBAFormat), off: mk(atlas.off, THREE.RGFormat), moon: moonTexture(), atlas })
}

const _v = new THREE.Vector3(), _u = new THREE.Vector3(0, 1, 0)
function moonFrame(u, m, illum, sun) {
  _v.set(m[0], m[1], m[2])
  // ejes del disco lunar: «arriba» hacia el cenit, «derecha» hacia la derecha de quien mira la luna
  const up = _u.clone().addScaledVector(_v, -_v.y)
  if (up.lengthSq() < 1e-6) up.set(0, 0, -1)
  up.normalize()
  u.uMoonUp.value.copy(up)
  u.uMoonRight.value.crossVectors(_v, up).normalize()
  u.uMoonIllum.value = illum; u.uMoonRad.value = (0.7 * Math.PI) / 180
  u.uAstroSun.value.set(sun[0], sun[1], sun[2])
  u.uMoonTex.value = moonTexture()
}
/** Pone en los uniformes del cielo lo que `World.frame()` calculó. `u` = skyMat.uniforms. Sin astronomía real la luna es llena y mira al espectador. */
export function applyAstro(u, f) {
  const a = f?.astro
  if (!a) {
    u.uAstro.value = 0
    if (f?.moonVis > 0.001) moonFrame(u, f.moonDir, 1, [-f.moonDir[0], -f.moonDir[1], -f.moonDir[2]])
    return
  }
  const t = astroTextures()
  u.uStarTex.value = t.stars; u.uStarOff.value = t.off
  u.uAstro.value = 1
  u.uLat.value = (a.latitude * Math.PI) / 180; u.uLst.value = (a.lst * Math.PI) / 180
  a.planets.forEach((p, i) => {
    u.uPlDir.value[i].set(p.dir[0], p.dir[1], p.dir[2])
    u.uPlCol.value[i].set(p.color[0], p.color[1], p.color[2], p.brightness)
    u.uPlRad.value[i] = (p.radius * Math.PI) / 180
  })
  moonFrame(u, a.moon.dir, a.moonIllum, a.sun.dir)
}
