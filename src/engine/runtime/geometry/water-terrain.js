// Terrain y clima alimentan regiones de WaterWorld; este puente no es otra autoridad del agua.
import { groundAtAll } from './terrains.js'
import { precipMm } from '../world/atmosphere.js'
import { hydrologyGrid } from './water-hydrology.js'

const MAX_ACTIVE_CELLS = 4096 // S02: límite provisional para no cargar la CPU con regiones enormes
const MAX_RAY_HEIGHT = 80

/** Regiones de autoría, adicionales o vinculadas a los dominios nativos Lago/Río. */
export function waterSceneConfig(config) {
  if (!config?.enabled) return []
  if (config.hydrology != null && (typeof config.hydrology !== 'object' || Array.isArray(config.hydrology) || typeof config.hydrology.enabled !== 'boolean'))
    throw new Error('Hidrología: configuración de escena inválida')
  if (config.runoff != null && (typeof config.runoff !== 'object' || Array.isArray(config.runoff) || typeof config.runoff.enabled !== 'boolean'))
    throw new Error('Escurrimiento: configuración de escena inválida')
  if (config.couplings != null && (!Array.isArray(config.couplings) || config.couplings.length > 64))
    throw new Error('Acoplamiento: enlaces de escena inválidos')
  if (config.displacement != null && (typeof config.displacement !== 'object' || Array.isArray(config.displacement) || typeof config.displacement.enabled !== 'boolean'))
    throw new Error('Acoplamiento: desplazamiento inválido')
  if (!Array.isArray(config.regions) || !config.regions.length) throw new Error('Agua física: falta la lista de regiones')
  let total = 0
  return config.regions.map((r, i) => {
    if (!r || !Number.isInteger(r.width) || !Number.isInteger(r.height) ||
        r.width < 2 || r.height < 2 || !Number.isFinite(r.x) || !Number.isFinite(r.z) ||
        !Number.isFinite(r.cellSize ?? 1) || (r.cellSize ?? 1) <= 0 ||
        !Number.isFinite(r.cellSizeZ ?? r.cellSize ?? 1) || (r.cellSizeZ ?? r.cellSize ?? 1) <= 0 ||
        !Number.isFinite(r.initialDepth ?? 0) || (r.initialDepth ?? 0) < 0 ||
        (r.boundaries && typeof r.boundaries !== 'object')) throw new Error(`Agua física: región ${i + 1} inválida`)
    total += r.width * r.height
    if (total > MAX_ACTIVE_CELLS) throw new Error('Agua física: límite de 4096 celdas activas por escena')
    return { ...r, id: r.id || `terrain-water-${i + 1}` }
  })
}

function signature(terrains) {
  return terrains.map((t) => `${t.id}:${t.version}:${t.ox}:${t.oy}:${t.oz}:${t.enabled}`).join('|')
}

/** Muestrea celdas y caras; las celdas sin relieve permanecen impermeables. */
export function terrainWaterGeometry(region, terrains, cast = null) {
  const { width: w, height: h, dx, dz, x, z } = region
  const bed = new Float64Array(w * h), valid = new Uint8Array(w * h)
  const cover = new Uint8Array(w * h)
  const blockX = new Uint8Array((w + 1) * h), blockZ = new Uint8Array(w * (h + 1))
  const centers = (i, j) => [x + (i + 0.5) * dx, z + (j + 0.5) * dz]
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i, [cx, cz] = centers(i, j)
    const g = groundAtAll(terrains, cx, cz)
    if (!Number.isFinite(g)) continue
    bed[k] = g; valid[k] = 1
    if (cast) cover[k] = cast([cx, g + 0.06, cz], [0, 1, 0], MAX_RAY_HEIGHT) ? 1 : 0
  }
  const surface = Float64Array.from(bed, (y, k) => y + (region.depth?.[k] ?? region.initialDepth ?? 0))
  sampleSolidFaces(region, bed, valid, surface, cast, blockX, blockZ)
  return { bed, valid, cover, blockX, blockZ }
}

// Las barreras se muestrean dentro de la columna mojada, nunca encima de la superficie.
// Varios niveles detectan sólidos sumergidos y permiten agua debajo de puentes altos.
function sampleSolidFaces(region, bed, valid, surface, cast, blockX, blockZ, previousStage = null, nextStage = null) {
  if (!cast) return
  const { width: w, height: h, x, z, dx, dz } = region
  const blocked = (a, b, cx, cz, axis, distance) => {
    if (!valid[a] || !valid[b]) return 0
    const bottom = Math.max(bed[a], bed[b])
    let top = Math.max(surface[a],surface[b])
    // Una región seca también necesita barreras antes de recibir su primer aporte.
    if (top <= bottom + 0.002) top = bottom + 0.9
    for (const fraction of [0.1, 0.5, 0.9]) {
      const y = bottom + (top-bottom)*fraction
      if (cast([cx,y,cz],axis,distance)) return 1
      // Captura paredes cuya orientación o malla solo responde por la otra cara.
      if (cast([cx+axis[0]*distance,y,cz+axis[2]*distance],axis.map(v=>-v),distance)) return 1
    }
    return 0
  }
  for (let j=0; j<h; j++) for (let i=1; i<w; i++) {
    const a = j*w+i-1
    if (previousStage && previousStage[a] === nextStage[a] && previousStage[a+1] === nextStage[a+1]) continue
    blockX[j*(w+1)+i] = blocked(a,a+1,x+(i-0.5)*dx,z+(j+0.5)*dz,[1,0,0],dx)
  }
  for (let j=1; j<h; j++) for (let i=0; i<w; i++) {
    const a = (j-1)*w+i
    if (previousStage && previousStage[a] === nextStage[a] && previousStage[a+w] === nextStage[a+w]) continue
    blockZ[j*w+i] = blocked(a,a+w,x+(i+0.5)*dx,z+(j-0.5)*dz,[0,0,1],dz)
  }
}

// Resolución vertical de 10 cm para invalidación de obstáculos. Incluye cambios
// seco/mojado; el solver conserva su precisión completa y no cuantiza el agua.
function obstacleStage(region) {
  return Int32Array.from(region.depth, (d,k) => region.valid[k] && d>0.002
    ? Math.floor((region.effectiveBed[k]+d)*10) : -2147483648)
}

function bodyBounds(b) {
  if (b.shape === 'river') return b.box
  const hx = Math.max(0.25,b.p.width/2), hz = Math.max(0.25,b.p.length/2)
  const rx = Math.abs(b.c)*hx+Math.abs(b.s)*hz, rz = Math.abs(b.s)*hx+Math.abs(b.c)*hz
  return [b.x-rx,b.z-rz,b.x+rx,b.z+rz]
}

/** Fracción líquida: el clima publica mm/h equivalentes de lluvia + nieve. */
export function liquidPrecipitation(world, x, z, elevation = 0) {
  if (!world?.weatherOn) return 0
  const total = world.precipitationAt(x, z, elevation)
  if (!Number.isFinite(total) || total <= 0) return 0
  const rain = precipMm(Math.max(0, world.cur?.rain || 0), 0)
  const snow = precipMm(0, Math.max(0, world.cur?.snow || 0))
  return total * (rain + snow > 0 ? rain / (rain + snow) : 0)
}

/**
 * CA-005: Lago y Río son dominios físicos nativos. La geometría de autoría y
 * sus parámetros siguen en el nodo; WaterWorld es el único dueño del líquido.
 * Los controles manuales de región se respetan y nunca se duplican.
 */
export function nativeWaterConfiguration(water, authored = null, terrains = []) {
  const manual = authored?.enabled ? waterSceneConfig(authored) : []
  const mapped = new Map()
  const nativeBodies = water.bodies.filter((b) => b.shape === 'rect' || b.shape === 'river')
  for (const cfg of manual) {
    const overlaps = new Set()
    const dx = cfg.cellSize ?? 1, dz = cfg.cellSizeZ ?? dx
    for (let j = 0; j < cfg.height; j++) for (let i = 0; i < cfg.width; i++) {
      const x = cfg.x + (i + 0.5) * dx, z = cfg.z + (j + 0.5) * dz
      for (const body of nativeBodies) if (water.legacyAt(x, z, 0, body.id)) overlaps.add(body.id)
    }
    const explicit = nativeBodies.filter((b) => b.coupledRegion === cfg.id)
    if (explicit.length > 1 || overlaps.size > 1 || (explicit.length && overlaps.size && !overlaps.has(explicit[0].id)))
      throw new Error(`Agua nativa: región «${cfg.id}» corresponde a varios nodos; asociación ambigua`)
    const body = explicit[0] || (overlaps.size === 1 ? nativeBodies.find((b) => b.id === [...overlaps][0]) : null)
    if (body) {
      if (mapped.has(body.id) || (body.coupledRegion && body.coupledRegion !== cfg.id && manual.some((r) => r.id === body.coupledRegion)))
        throw new Error(`Agua nativa: el nodo «${body.name}» tiene más de una región`)
      mapped.set(body.id, cfg.id)
      cfg.visualBodyId = body.id // misma identidad y parámetros visuales
      // Un dominio vacío de terreno es espacio receptor, no una orden implícita
      // de borrar el lago que se acaba de añadir. Solo la asociación automática
      // hereda el agua inicial del nodo; un enlace explícito conserva su inventario.
      if (!explicit.length && (cfg.initialDepth ?? 0) === 0 && (!cfg.liquidId || cfg.liquidId === 'water')) {
        cfg.nativeBodyId = body.id
        cfg.nativeDepth = Math.min(8, Math.max(0.15, Number.isFinite(body.p.nativeDepth) ? body.p.nativeDepth : 1.2))
      }
    }
  }
  // El presupuesto se comparte con las regiones explícitas (no se ocultan límites).
  let cells = manual.reduce((n, r) => n + r.width * r.height, 0)
  const regions = [...manual]
  for (const b of nativeBodies) {
    if (mapped.has(b.id)) continue
    // No reemplazar una región autoral explícitamente asociada por otra sintética.
    const id = `native-water:${b.id}`
    if (manual.some((r) => r.id === id) || water.bodies.some((other) => other.id === id))
      throw new Error(`Agua nativa: identidad duplicada «${id}»`)
    if (b.shape === 'river' && (!b.line || b.line.length < 2)) continue
    let [minX,minZ,maxX,maxZ] = bodyBounds(b)
    // Separar huella inicial del líquido y dominio de transporte. El suelo seco
    // vecino puede recibir agua; reducir margen ante dominios vecinos evita solaparlos.
    if (terrains.some(t => t.enabled !== false)) {
      const margin = Math.max(0.8, 2*(Number.isFinite(b.p.res) ? b.p.res : 1.5))
      let west=margin, east=margin, north=margin, south=margin
      const others = nativeBodies.filter(other=>other!==b).map(bodyBounds)
      for (const cfg of manual) if (cfg.visualBodyId !== b.id) others.push([
        cfg.x,cfg.z,cfg.x+cfg.width*(cfg.cellSize??1),cfg.z+cfg.height*(cfg.cellSizeZ??cfg.cellSize??1)])
      for (const [x0,z0,x1,z1] of others) {
        if (x1 <= minX) west=Math.min(west,(minX-x1)/2)
        if (x0 >= maxX) east=Math.min(east,(x0-maxX)/2)
        if (z1 <= minZ) north=Math.min(north,(minZ-z1)/2)
        if (z0 >= maxZ) south=Math.min(south,(z0-maxZ)/2)
      }
      minX-=west; maxX+=east; minZ-=north; maxZ+=south
    }
    // Por lo menos 2x2 celdas; subir paso si la huella excede la cuota física.
    let step = Math.max(0.4, Number.isFinite(b.p.res) ? b.p.res : 1.5)
    const remainingBodies = nativeBodies.filter(other=>other!==b && !mapped.has(other.id)).length
    const available = MAX_ACTIVE_CELLS - cells - 4*remainingBodies
    if (available < 4) throw new Error('Agua nativa: presupuesto de 4096 celdas agotado')
    let width, height
    for (let attempt = 0; attempt < 64; attempt++) {
      width = Math.max(2, Math.ceil((maxX - minX) / step))
      height = Math.max(2, Math.ceil((maxZ - minZ) / step))
      if (width * height <= available) break
      step *= 1.2
    }
    if (width * height > available) throw new Error('Agua nativa: no se pudo ajustar la región al presupuesto')
    const cellSize = (maxX - minX) / width || step
    const cellSizeZ = (maxZ - minZ) / height || step
    // Evitar extensiones gigantes sin celdas útiles y rechazar datos malformados.
    if (![minX, minZ, cellSize, cellSizeZ].every(Number.isFinite) || cellSize <= 0 || cellSizeZ <= 0)
      throw new Error(`Agua nativa: geometría inválida «${b.name}»`)
    cells += width * height
    regions.push({ id, name: b.name, x: minX, z: minZ, width, height, cellSize, cellSizeZ,
      nativeBodyId: b.id, nativeDepth: Math.min(8, Math.max(0.15, Number.isFinite(b.p.nativeDepth) ? b.p.nativeDepth : 1.2)),
      color: b.p.color, deepColor: b.p.deepColor, clarity: b.p.clarity })
    mapped.set(b.id, id)
  }
  if (!regions.length) return null
  if (regions.length > 32) throw new Error('Agua nativa: máximo 32 regiones por escena')
  for (const b of nativeBodies) if (mapped.has(b.id)) b.coupledRegion = mapped.get(b.id)
  return { ...(authored?.enabled ? authored : {}), enabled: true, regions,
    displacement: { ...(authored?.enabled ? authored.displacement : {}), enabled: true } }
}

/** Deriva la ocupación hidráulica y la malla del fondo de la forma REAL del nodo. */
function nativeWaterGeometry(region, terrains, cast, water, body) {
  const { width: w, height: h, dx, dz, x, z } = region
  const n = w * h, bed = new Float64Array(n), valid = new Uint8Array(n)
  const depth = new Float64Array(n), velocityX = new Float64Array(n), velocityZ = new Float64Array(n)
  const cover = new Uint8Array(n)
  const blockX = new Uint8Array((w + 1) * h), blockZ = new Uint8Array(w * (h + 1))
  const surface = new Float64Array(n)
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i, cx = x + (i + 0.5) * dx, cz = z + (j + 0.5) * dz
    const legacy = water.restAt(cx, cz, body.id)
    const ground = groundAtAll(terrains, cx, cz)
    // La tierra seca sigue siendo una celda física, no una pared. La forma del
    // nodo solo determina dónde comienza el agua. Sin suelo se conserva el fondo autoral.
    if (!legacy && !Number.isFinite(ground)) continue
    const bottom = Number.isFinite(ground) ? ground : legacy.surface-region.nativeDepth
    const level = legacy ? legacy.surface : bottom
    bed[k]=bottom; surface[k]=Math.max(bottom,level); valid[k]=1
    depth[k]=Math.max(0,level-bottom)
    velocityX[k]=depth[k]>0 ? legacy.flowX : 0
    velocityZ[k]=depth[k]>0 ? legacy.flowZ : 0
    if (cast) cover[k]=cast([cx,bottom+0.06,cz],[0,1,0],MAX_RAY_HEIGHT) ? 1 : 0
  }
  sampleSolidFaces(region,bed,valid,surface,cast,blockX,blockZ)
  return { bed, valid, depth, velocityX, velocityZ, cover, blockX, blockZ }
}

/** Enlaza una sola vez las regiones de escena; los cambios de terreno actualizan geometría sin borrar volumen. */
export class TerrainWaterConnection {
  constructor(water, config, terrains, world, cast = null, sampleSurface = null, objectSignature = null, liquids = []) {
    this.water = water; this.terrains = terrains; this.world = world; this.cast = cast
    this.sampleSurface = sampleSurface; this.objectSignature = objectSignature
    this.runoffOn = config?.runoff?.enabled === true
    this.hydrologyOn = config?.hydrology?.enabled === true
    this.entries = []; this.terrainSignature = null; this.surfaceSignature = null
    const configs = waterSceneConfig(config)
    const profiles = new Map((liquids || []).map((l)=>[l.id,l]))
    try {
      for (const cfg of configs) {
        const placeholder = { width: cfg.width, height: cfg.height, dx: cfg.cellSize ?? 1,
          dz: cfg.cellSizeZ ?? cfg.cellSize ?? 1, x: cfg.x, z: cfg.z, initialDepth: cfg.initialDepth ?? 0 }
        const body = cfg.nativeBodyId ? water.bodies.find((b) => b.id === cfg.nativeBodyId) : null
        const visualBody = cfg.visualBodyId ? water.bodies.find((b) => b.id === cfg.visualBodyId) : body
        if (cfg.nativeBodyId && !body) throw new Error(`Agua nativa: nodo ausente «${cfg.nativeBodyId}»`)
        if (cfg.visualBodyId && !visualBody) throw new Error(`Agua nativa: nodo ausente «${cfg.visualBodyId}»`)
        const geo = body ? nativeWaterGeometry({ ...placeholder, nativeDepth: cfg.nativeDepth }, terrains, cast, water, body)
          : terrainWaterGeometry(placeholder, terrains, cast)
        // La integración visual no puede dibujar agua simulada encima de cuerpos heredados.
        for (let j = 0; j < cfg.height; j++) for (let i = 0; i < cfg.width; i++) {
          const x = cfg.x + (i + 0.5) * placeholder.dx, z = cfg.z + (j + 0.5) * placeholder.dz
          const legacy = water.legacyAt(x, z, 0)
          const other=legacy&&water.bodies.find(b=>b.id===legacy.id)
          if(other?.shape==='ocean' && !body && !visualBody && placeholder.initialDepth===0){
            if(geo.bed[j*cfg.width+i]<=other.y)geo.valid[j*cfg.width+i]=0
            continue
          }
          if (legacy && other?.coupledRegion !== cfg.id)
            throw new Error(`Agua física: región «${cfg.id}» se solapa con agua heredada no acoplada`)
        }
        const depth = geo.depth || Array.from(geo.valid, (v) => v ? cfg.initialDepth ?? 0 : 0)
        const profile = cfg.liquidId && cfg.liquidId !== 'water' ? profiles.get(cfg.liquidId) : null
        if (cfg.liquidId && cfg.liquidId !== 'water' && !profile) throw new Error(`Agua física: líquido no encontrado (${cfg.liquidId})`)
        const region = water.addRegion({ ...cfg,  ...(profile && { liquid: profile, color: profile.color }), cellSize: placeholder.dx, cellSizeZ: placeholder.dz,
          bed: geo.bed, valid: geo.valid, depth, blockX: geo.blockX, blockZ: geo.blockZ,
          ...(body && { velocityX: geo.velocityX, velocityZ: geo.velocityZ }),
          ...(this.hydrologyOn && !profile && { hydrology: hydrologyGrid(placeholder, terrains, geo.valid) }) })
        if (visualBody) region.bodyId = visualBody.id
        this.entries.push({ region, obstacleStage: obstacleStage(region), cover: geo.cover, nativeBodyId: body?.id || '', nativeDepth: cfg.nativeDepth })
      }
      if (config?.couplings?.length) water.configureCouplings(config.couplings)
      this.displacementOn = config?.displacement?.enabled === true
      water.displacementEnabled = this.displacementOn
    } catch (err) {
      for (const { region } of this.entries) water.removeRegion(region.id)
      throw err
    }
    this.terrainSignature = signature(terrains)
    if (this.runoffOn) this._updateSurfaces()
    this.surfaceSignature = this.objectSignature?.() ?? null
  }

  /** Un muestreo espacial al iniciar y cuando cambian objetos/terreno; no hay raycast por gota física. */
  _updateSurfaces() {
    for (const entry of this.entries) {
      const { region } = entry
      const body = entry.nativeBodyId && this.water.bodies.find((b) => b.id === entry.nativeBodyId)
      const geoCover = body ? nativeWaterGeometry({ ...region, nativeDepth: entry.nativeDepth }, this.terrains, this.cast, this.water, body).cover
        : terrainWaterGeometry(region, this.terrains, this.cast).cover
      const samples = Array.from({ length: region.width * region.height }, (_, k) => {
        if (!region.valid[k] || !this.sampleSurface) return null
        const i = k % region.width, j = Math.floor(k / region.width)
        const x = region.x + (i + 0.5) * region.dx, z = region.z + (j + 0.5) * region.dz
        const g = region.bed[k]
        const hit = this.sampleSurface([x, g + MAX_RAY_HEIGHT, z], [x, g + 0.06, z])
        if (hit?.ownerId) geoCover[k] = 1 // cualquier geometría superior tapa el terreno, incluso sin Jolt
        if (!hit?.ownerId || !hit.runoff?.enabled || hit.normal?.[1] < 0.4 ||
            !Number.isFinite(hit.point?.[1]) || hit.point[1] <= g + 0.05) return null
        return { owner: hit.ownerId, height: hit.point[1], materialId: hit.materialId || '',
          retentionMm: hit.runoff.retentionMm, runoffMps: hit.runoff.runoffMps }
      })
      this.water.setRunoff(region.id, samples)
      entry.cover = geoCover
    }
  }

  /** Un paso físico: primero geometría, después lluvia y finalmente el solver. */
  step(dt) {
    let rebuild = false
    if (signature(this.terrains) !== this.terrainSignature) {
      // Calcular primero todas las geometrías para no dejar una escena parcialmente actualizada.
      const next = this.entries.map(({ region, nativeBodyId, nativeDepth }) => {
        const body = nativeBodyId && this.water.bodies.find((b) => b.id === nativeBodyId)
        const geo = body ? nativeWaterGeometry({ ...region, nativeDepth }, this.terrains, this.cast, this.water, body)
          : terrainWaterGeometry(region, this.terrains, this.cast)
        if(!body && !region.bodyId)for(let k=0;k<geo.valid.length;k++){
          const x=region.x+(k%region.width+0.5)*region.dx,z=region.z+(Math.floor(k/region.width)+0.5)*region.dz
          const sample=this.water.legacyAt(x,z,0),ocean=sample&&this.water.bodies.find(b=>b.id===sample.id&&b.shape==='ocean')
          if(ocean && geo.bed[k]<=ocean.y)geo.valid[k]=0
        }
        return { ...geo, ...(this.hydrologyOn && { hydrology: hydrologyGrid(region, this.terrains, geo.valid) }) }
      })
      this.entries.forEach(({ region, ...entry }, i) => {
        region.replaceTerrain(next[i])
        if (this.hydrologyOn) region.updateHydrology(next[i].hydrology)
        this.entries[i].cover = next[i].cover
        this.entries[i].obstacleStage = obstacleStage(region)
      })
      this.terrainSignature = signature(this.terrains)
      rebuild = true
    }
    // Refrescar nodos y niveles a 2 Hz. Los cambios de nivel solo remuestrean
    // caras adyacentes a celdas que cambian de franja vertical o seco/mojado.
    this._surfaceTick = (this._surfaceTick || 0) + dt
    if (this._surfaceTick >= 0.5) {
      this._surfaceTick %= 0.5
      const sig = this.objectSignature?.() ?? null
      const objectsChanged = sig !== this.surfaceSignature
      for (const entry of this.entries) {
        const r=entry.region, stage=obstacleStage(r)
        if (this.cast && (objectsChanged || stage.some((v,k)=>v!==entry.obstacleStage[k]))) {
          const bx=r.blockX.slice(), bz=r.blockZ.slice()
          const surface=Float64Array.from(r.depth,(d,k)=>r.effectiveBed[k]+d)
          sampleSolidFaces(r,r.bed,r.valid,surface,this.cast,bx,bz,
            objectsChanged ? null : entry.obstacleStage,stage)
          r.blockX.set(bx); r.blockZ.set(bz); r.revision++
        }
        entry.obstacleStage=stage
        if (objectsChanged) for (let k=0; k<r.valid.length; k++) {
          if (!r.valid[k]) { entry.cover[k]=0; continue }
          const x=r.x+(k%r.width+0.5)*r.dx, z=r.z+(Math.floor(k/r.width)+0.5)*r.dz
          entry.cover[k]=this.cast?.([x,r.bed[k]+0.06,z],[0,1,0],MAX_RAY_HEIGHT) ? 1 : 0
        }
      }
      if (objectsChanged) { this.surfaceSignature=sig; rebuild=true }
    }
    if (this.runoffOn && rebuild) this._updateSurfaces()
    const hasLiquid = this.world?.weatherOn &&
      (this.world?.cur?.rain > 0 || this.world?.cur?.snow > 0)
    for (const { region, cover } of this.entries) {
      if (!hasLiquid || region.liquid.id !== 'water') continue
      for (let j = 0; j < region.height; j++) for (let i = 0; i < region.width; i++) {
        const k = j * region.width + i
        if (!region.valid[k]) continue
        const film = this.runoffOn ? this.water.runoff.get(region.id) : null
        if (cover[k] && !film?.cells[k]) continue
        const x = region.x + (i + 0.5) * region.dx, z = region.z + (j + 0.5) * region.dz
        const rate = liquidPrecipitation(this.world, x, z, region.bed[k])
        if (rate > 0) {
          const volume = rate * dt * region.dx * region.dz / 3600000
          if (film?.cells[k]) this.water.rainOnRunoff(region.id, i, j, volume)
          else this.water.changeVolume(region.id, i, j, volume)
        }
      }
    }
    return this.water.step(dt)
  }
}
