// Adaptador de agua: conserva API, snapshots e hidrología del WaterWorld existente.
import { FluidRegion } from '../fluids/shallow-water.js'
import { containerSpec, containerOutflow } from './liquid-containers.js'
import { MpmContainerFluid } from '../fluids/container-mpm.js'
import { advanceParticleContainers, validateContainerParcels } from '../fluids/container-world.js'

export class WaterRegion extends FluidRegion {
  static createContainerFluid = (spec,pose) => new MpmContainerFluid(spec,pose)
  static advanceParticleContainers = advanceParticleContainers
  static validateContainerParcels = validateContainerParcels
  static containerSpec = containerSpec
  static containerOutflow = containerOutflow
}

// Escurrimiento discreto de S07: misma autoridad y paso físico, sin un segundo solver global.
const EPS_RUNOFF = 1e-9
const finite = (v) => Number.isFinite(v) && v >= 0
const signature = (samples) => JSON.stringify(samples.map((c) => c ? [c.owner, c.height, c.retentionMm, c.runoffMps, c.materialId] : null))

/** No crea un solver global: solo describe cobertura, rutas y límites para el WaterWorld existente. */
function runoffGeometry(region, samples) {
  const n = region.width * region.height
  if (!Array.isArray(samples) || samples.length !== n) throw new RangeError('Escurrimiento: celdas incompatibles')
  const cells = samples.map((s, k) => {
    if (s == null) return null
    if (!region.valid[k] || typeof s.owner !== 'string' || !s.owner || !Number.isFinite(s.height) ||
        s.height <= region.bed[k] + 0.05 || !finite(s.retentionMm) || s.retentionMm > 1000 ||
        !finite(s.runoffMps) || s.runoffMps > 20)
      throw new RangeError('Escurrimiento: superficie inválida')
    return { owner: s.owner, height: s.height, retentionMm: s.retentionMm,
      runoffMps: s.runoffMps, materialId: s.materialId || '' }
  })
  const downstream = new Int32Array(n).fill(-1)
  // Una superficie horizontal tiene salida hacia el borde: distancia topológica al borde.
  const distances = new Int32Array(n).fill(1e9)
  const neighbors = (k) => {
    const i = k % region.width, j = Math.floor(k / region.width), out = []
    if (i > 0) out.push(k - 1)
    if (i < region.width - 1) out.push(k + 1)
    if (j > 0) out.push(k - region.width)
    if (j < region.height - 1) out.push(k + region.width)
    return out
  }
  const queue = []
  for (let k = 0; k < n; k++) {
    if (!cells[k]) continue
    const adjacent = neighbors(k)
    if (adjacent.length < 4 || adjacent.some((m) => cells[m]?.owner !== cells[k].owner)) {
      distances[k] = 0; queue.push(k)
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const k = queue[i]
    for (const m of neighbors(k)) {
      if (cells[m]?.owner !== cells[k].owner || distances[m] <= distances[k] + 1) continue
      distances[m] = distances[k] + 1; queue.push(m)
    }
  }
  for (let k = 0; k < n; k++) {
    if (!cells[k]) continue
    const adjacent = neighbors(k).filter((m) => cells[m]?.owner === cells[k].owner)
    // Pendiente negativa gana; en meseta la distancia al borde evita estancamiento arbitrario.
    const lower = adjacent.filter((m) => cells[m].height < cells[k].height - EPS_RUNOFF)
    if (lower.length) downstream[k] = lower.reduce((a, b) => cells[a].height <= cells[b].height ? a : b)
    else {
      const level = adjacent.filter((m) => Math.abs(cells[m].height - cells[k].height) <= EPS_RUNOFF && distances[m] < distances[k])
      if (level.length) downstream[k] = level.reduce((a, b) => distances[a] <= distances[b] ? a : b)
    }
  }
  const edge = Uint8Array.from(cells, (c, k) => c && distances[k] === 0 ? 1 : 0)
  return { cells, downstream, edge, signature: signature(cells) }
}

function validateRunoffSnapshot(film, snap) {
  const n = film.cells.length
  if (!snap || snap.id !== film.id || snap.signature !== film.signature || !Array.isArray(snap.stored) || snap.stored.length !== n ||
      !Array.isArray(snap.pending) || snap.pending.length !== n ||
      snap.stored.some((v, i) => !finite(v) || (!film.cells[i] && v !== 0)) ||
      snap.pending.some((v, i) => !finite(v) || (!film.cells[i] && v !== 0)) ||
      !snap.ledger || ['rain', 'delivered', 'exited'].some((k) => !finite(snap.ledger[k])))
    throw new Error('Escurrimiento: snapshot incompatible')
  const total = snap.stored.reduce((s, v) => s + v, 0)
  if (Math.abs(total - (snap.ledger.rain - snap.ledger.delivered - snap.ledger.exited)) > 1e-7 * Math.max(1, snap.ledger.rain))
    throw new Error('Escurrimiento: balance del snapshot inválido')
  return { stored: Float64Array.from(snap.stored), pending: Float64Array.from(snap.pending), ledger: { ...snap.ledger } }
}

/** Una actualización simultánea; nunca mueve una gota dos veces en un mismo paso. */
function advanceRunoff(film, region, dt) {
  const delta = new Float64Array(film.stored.length)
  const area = region.dx * region.dz
  for (let k = 0; k < film.stored.length; k++) {
    const c = film.cells[k]
    if (!c) continue
    if (film.pending[k] > 0) { film.stored[k] += film.pending[k]; film.ledger.rain += film.pending[k]; film.pending[k] = 0 }
    const retained = c.retentionMm * 0.001 * area
    const surplus = Math.max(0, film.stored[k] - retained)
    const target = film.downstream[k]
    if (target < 0 && !film.edge[k]) continue // depresión interior: no perforar la cubierta
    const portion = Math.min(surplus, surplus * Math.min(1, c.runoffMps * dt / Math.max(region.dx, region.dz)))
    if (!(portion > 0)) continue
    delta[k] -= portion
    if (target >= 0) delta[target] += portion
    else {
      // La última celda de cubierta descarga verticalmente en su celda física válida.
      const col = k % region.width, row = Math.floor(k / region.width)
      if (col === 0 || col === region.width - 1 || row === 0 || row === region.height - 1) {
        // Fuera del dominio muestreado no existe una celda física de recepción verificable.
        film.ledger.exited += portion
      } else {
        region.queue(col, row, portion)
        film.ledger.delivered += portion
      }
    }
  }
  for (let k = 0; k < film.stored.length; k++) film.stored[k] += delta[k]
}

WaterRegion.runoffGeometry = runoffGeometry
WaterRegion.validateRunoffSnapshot = validateRunoffSnapshot
WaterRegion.advanceRunoff = advanceRunoff
