// Obstáculos del viento: modifica el viento local según cuerpos romo, embudos y cavidades en la escena.
// Diseño propio de Century (no es un port de Frost: Frost solo modela el audio de los obstáculos,
// no la modificación del viento local para la vegetación).
//
// TIPOS DE OBSTÁCULO (registrados por la escena vía world.registerObstacle):
//   'bluff'   → cuerpo romo: edificio, roca, muro. Reduce el viento delante (zona de presión) y
//               detrás (estela, wake). Se define con su AABB en coordenadas mundo y orientación.
//   'gap'     → embudo / apertura: hueco entre dos paredes paralelas. Acelera el viento en el canal
//               (efecto Venturi simple). Se define con posición centro, ancho, profundidad y normal.
//   'cavity'  → cavidad: nicho o patio interior. Amortigua el viento en su interior.
//               Se define con su AABB.
//
// MODELO (todo 2D en XZ; la vegetación no distingue altura dentro de la copa):
//   factorAt(ox, oz, windX, windZ) → 0..2
//   · 1.0 = viento libre (sin obstáculos)
//   · < 1  = abrigo / estela
//   · > 1  = aceleración en embudo
//
// El mundo no conoce THREE ni DOM; todo es aritmética plana.

/** @param {number} x @param {number} min @param {number} max */
function clamp(x, min, max) { return x < min ? min : x > max ? max : x }
function clamp01(x) { return clamp(x, 0, 1) }
function lerp(a, b, t) { return a + (b - a) * t }
function smooth(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t) }

// ─── Bluff body ────────────────────────────────────────────────────────────────

/**
 * Factor de viento local aportado por un cuerpo romo.
 * @param {number} ox Posición X del observador (m)
 * @param {number} oz Posición Z del observador (m)
 * @param {{minX,maxX,minZ,maxZ}} bb AABB del obstáculo en XZ
 * @param {number} windX Componente X del viento global (m/s)
 * @param {number} windZ Componente Z del viento global (m/s)
 * @returns {number} factor 0..1.5 (1 = sin efecto)
 */
function bluffFactor(ox, oz, bb, windX, windZ) {
  const sp = Math.hypot(windX, windZ)
  if (sp < 0.01) return 1
  const wdx = windX / sp, wdz = windZ / sp   // dirección del viento (unitario)

  // Dimensiones del obstáculo
  const bw = bb.maxX - bb.minX    // ancho en X
  const bd = bb.maxZ - bb.minZ    // profundidad en Z
  const cx = (bb.minX + bb.maxX) * 0.5
  const cz = (bb.minZ + bb.maxZ) * 0.5

  // Sección frontal proyectada sobre la dirección del viento (m)
  // Área perpendicular = bw·bd; proyectada en la dirección del flujo:
  const perpX = -wdz, perpZ = wdx     // perpendicular al viento
  const frontWidth = Math.abs(perpX * bw) + Math.abs(perpZ * bd)
  const frontDepth = Math.abs(wdx * bw) + Math.abs(wdz * bd)

  // Vector del obstáculo al observador
  const dx = ox - cx, dz = oz - cz

  // Componente del observador en la dirección del viento (relativo al centro)
  const along = dx * wdx + dz * wdz    // + = sotavento (downstream), - = barlovento
  const across = Math.abs(dx * perpX + dz * perpZ)  // distancia lateral

  // Radio de influencia: proporcional a la raíz del área frontal
  const R = Math.sqrt(frontWidth * Math.max(1, frontDepth)) * 0.6   // ~0.6·tamaño

  // ── Estela (downstream, sotavento) ──────────────────────────────────────────
  // Zona triangular detrás del obstáculo; ancho crece con la distancia (1:1.2 apertura)
  if (along > 0) {
    const wakeWidth = frontWidth * 0.5 + along * 0.45
    const inWake = clamp01(1 - across / Math.max(0.5, wakeWidth))
    if (inWake > 0.001) {
      // La estela tiene calma máxima justo detrás y se recupera a 4–6 R
      const wakeDecay = smooth(0, 5 * R, along)  // 0 = detrás, 1 = campo libre
      const wakeFactor = lerp(0.10, 1.0, wakeDecay)
      return lerp(1.0, wakeFactor, inWake)
    }
  }

  // ── Zona de presión (upstream, barlovento) ───────────────────────────────────
  if (along < 0) {
    const frontDist = -along   // distancia hacia barlovento
    const inFront = clamp01(1 - across / Math.max(0.5, frontWidth * 0.5 + frontDist * 0.15))
    if (inFront > 0.001) {
      const presDecay = smooth(0, 2.5 * R, frontDist)
      const presFactor = lerp(0.35, 1.0, presDecay)
      return lerp(1.0, presFactor, inFront)
    }
  }

  return 1
}

// ─── Gap / embudo ──────────────────────────────────────────────────────────────

/**
 * Factor de aceleración en un embudo (apertura entre paredes).
 * @param {number} ox @param {number} oz
 * @param {{cx,cz,nx,nz,width,depth}} g  normal del flujo (nx,nz), ancho del canal, profundidad
 * @param {number} windX @param {number} windZ
 */
function gapFactor(ox, oz, g, windX, windZ) {
  const sp = Math.hypot(windX, windZ)
  if (sp < 0.01) return 1
  const wdx = windX / sp, wdz = windZ / sp

  // Alineación del viento con el canal
  const align = Math.abs(wdx * g.nx + wdz * g.nz)
  if (align < 0.1) return 1    // viento paralelo al muro: sin efecto

  // Vector observador ↔ centro del embudo
  const dx = ox - g.cx, dz = oz - g.cz

  // Distancia lateral al eje del canal (eje = normal g.nx,g.nz)
  const lateral = Math.abs(dx * g.nx + dz * g.nz)
  const axial = Math.abs(dx * (-g.nz) + dz * g.nx)   // a lo largo del canal

  // Solo actúa si el observador está dentro del canal (latitud < ancho/2, profundidad < depth*1.5)
  const halfW = g.width * 0.5
  if (lateral > halfW || axial > g.depth * 1.5) return 1

  // Aceleración Venturi simple: v_canal = v_libre / (1 - blockage)
  // blockage = (ancho_canal / ancho_libre_asumido); usamos razón fija ~0.35 → factor ~1.55 máx
  const blockage = clamp01(0.35 * align)
  const venturi = clamp(1 / Math.max(0.2, 1 - blockage), 1, 2.0)

  // Suavizar en los bordes
  const tLateral = smooth(halfW, halfW * 0.6, lateral)   // 1 en centro, 0 en borde
  const tAxial = smooth(g.depth * 1.5, g.depth * 0.2, axial)

  return lerp(1.0, venturi, tLateral * tAxial)
}

// ─── Cavity ────────────────────────────────────────────────────────────────────

/**
 * Factor de amortiguación dentro de una cavidad (patio, hueco, nicho).
 */
function cavityFactor(ox, oz, bb) {
  const inX = ox >= bb.minX && ox <= bb.maxX
  const inZ = oz >= bb.minZ && oz <= bb.maxZ
  if (!inX || !inZ) return 1

  // Qué tan adentro estamos (0 = borde, 1 = centro)
  const tx = smooth(0, (bb.maxX - bb.minX) * 0.15, Math.min(ox - bb.minX, bb.maxX - ox))
  const tz = smooth(0, (bb.maxZ - bb.minZ) * 0.15, Math.min(oz - bb.minZ, bb.maxZ - oz))
  return lerp(1.0, 0.20, tx * tz)   // mínimo 0.20 en el centro
}

// ─── WindField ─────────────────────────────────────────────────────────────────

export class WindField {
  constructor() {
    /** @type {Map<string, {type:'bluff'|'gap'|'cavity', data:object}>} */
    this._obs = new Map()
  }

  /**
   * Registra un obstáculo.
   * @param {string} id Identificador único (suele ser el id del nodo de la escena)
   * @param {'bluff'|'gap'|'cavity'} type
   * @param {object} data
   *   bluff:   { minX, maxX, minZ, maxZ }
   *   gap:     { cx, cz, nx, nz, width, depth }
   *   cavity:  { minX, maxX, minZ, maxZ }
   */
  register(id, type, data) {
    this._obs.set(String(id), { type, data })
  }

  /** Elimina un obstáculo registrado. */
  remove(id) {
    this._obs.delete(String(id))
  }

  /** Elimina todos los obstáculos (p.ej. al resetear la escena). */
  clear() {
    this._obs.clear()
  }

  /** Número de obstáculos registrados. */
  get size() { return this._obs.size }

  /**
   * Factor de viento local en el punto (ox, oz).
   * @param {number} ox @param {number} oz
   * @param {number} windX @param {number} windZ  Viento global en m/s
   * @returns {number} factor 0..2 (1 = libre)
   */
  factorAt(ox, oz, windX, windZ) {
    if (this._obs.size === 0) return 1
    // Combinamos los factores de todos los obstáculos como el mínimo de los reductores
    // y el máximo de los aceleradores; los embudos solo suman si el observador está en el canal.
    let shelter = 1   // el factor más reducido (≤ 1) que aplica
    let boost = 1     // el factor más alto por embudos (≥ 1)

    for (const { type, data } of this._obs.values()) {
      let f
      if (type === 'bluff') f = bluffFactor(ox, oz, data, windX, windZ)
      else if (type === 'gap') f = gapFactor(ox, oz, data, windX, windZ)
      else if (type === 'cavity') f = cavityFactor(ox, oz, data)
      else continue

      if (f < shelter) shelter = f
      if (f > boost) boost = f
    }

    // Si el observador está en abrigo Y en embudo a la vez, el abrigo gana
    if (shelter < 1) return shelter
    return boost
  }

  /**
   * Aplica el factor al vector de viento global → viento local escalado.
   * @param {number} ox @param {number} oz
   * @param {{x:number,z:number,speed:number,dir:number}} wind frame.wind global
   * @returns {{x:number,z:number,speed:number,dir:number,factor:number}}
   */
  localWind(ox, oz, wind) {
    const f = this.factorAt(ox, oz, wind.x, wind.z)
    return { x: wind.x * f, z: wind.z * f, speed: wind.speed * f, dir: wind.dir, factor: f }
  }
}


/** Velocidad tridimensional del vórtice. Modelo macroscópico acotado; cero fuera del dominio. */
export function vortexVelocityAt(v, x, y, z) {
  if (!v?.active || ![x,y,z,v.x,v.y,v.z,v.radius,v.height,v.intensity].every(Number.isFinite) || v.radius<=0 || v.height<=0)
    return {x:0,y:0,z:0,inside:false,weight:0}
  const dx=x-v.x, dz=z-v.z, r=Math.hypot(dx,dz), h=y-v.y
  if (r>=v.radius || h<0 || h>=v.height) return {x:0,y:0,z:0,inside:false,weight:0}
  const radial=r/v.radius, vertical=h/v.height
  const edge=(1-radial)**2*(3-2*(1-radial)) // suave hacia el borde
  const core=Math.min(1,r/Math.max(0.5,v.radius*0.16))
  const fadeY=Math.min(1,h/Math.max(0.5,v.height*0.1))*Math.min(1,(v.height-h)/Math.max(0.5,v.height*0.1))
  const weight=edge*fadeY, inv=r>1e-9 ? 1/r : 0, tangent=v.intensity*core*weight
  const radialV=-v.intensity*0.25*weight, upward=v.intensity*0.32*weight
  const vx=(-dz*inv)*tangent+dx*inv*radialV, vz=dx*inv*tangent+dz*inv*radialV
  return {x:vx,y:upward,z:vz,inside:true,weight}
}
