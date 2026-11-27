// Contrato VFX v1. La definición es un recurso del proyecto; nunca contiene partículas activas.
export const VFX_SCHEMA_VERSION = 1
export const VFX_EXT = '.vfx'
export const VFX_FOLDER = 'Assets'

const defaults = () => ({
  emission: { mode: 'continuous', rate: 12, burstCount: 12, duration: 0, loop: true, capacity: 64 },
  birth: { shape: 'point', box: [1, 1, 1], radius: 0.25, lifetime: [1.5, 3] },
  movement: { speed: 0.3, spread: 0.12, acceleration: [0, 0, 0], space: 'local' },
  appearance: { textureId: '', color: '#ffffff', size: 0.15, opacity: 0.6, rotation: 0, blend: 'alpha' },
  evolution: {
    size: [{ t: 0, value: 0.5 }, { t: 1, value: 1.5 }],
    opacity: [{ t: 0, value: 0 }, { t: 0.2, value: 1 }, { t: 1, value: 0 }],
    color: [{ t: 0, color: '#ffffff' }, { t: 1, color: '#ffffff' }],
  },
})
const object = (v, label) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`${label}: se esperaba un objeto`)
  return v
}
const keys = (v, allowed, label) => {
  for (const key of Object.keys(v)) if (!allowed.includes(key)) throw new Error(`${label}: propiedad desconocida «${key}»`)
}
const num = (v, label, min, max, integer = false) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) {
    throw new Error(`${label}: número ${integer ? 'entero ' : ''}finito entre ${min} y ${max}`)
  }
  return v
}
const choice = (v, label, allowed) => {
  if (!allowed.includes(v)) throw new Error(`${label}: valor no admitido`)
  return v
}
const color = (v, label) => {
  if (typeof v !== 'string' || !/^#[\da-f]{6}$/i.test(v)) throw new Error(`${label}: color hexadecimal #RRGGBB inválido`)
  return v
}
const vector = (v, label, min, max, length = 3) => {
  if (!Array.isArray(v) || v.length !== length) throw new Error(`${label}: vector de ${length} valores requerido`)
  return v.map((x, i) => num(x, `${label}[${i}]`, min, max))
}
const curve = (v, label, field) => {
  if (!Array.isArray(v) || v.length < 2 || v.length > 32) throw new Error(`${label}: se necesitan entre 2 y 32 puntos`)
  let previous = -1
  return v.map((entry, i) => {
    const p = object(entry, `${label}[${i}]`)
    keys(p, ['t', field], label)
    const t = num(p.t, `${label}[${i}].t`, 0, 1)
    if (i === 0 && t !== 0 || i === v.length - 1 && t !== 1 || t <= previous) throw new Error(`${label}: tiempos estrictamente crecientes de 0 a 1`)
    previous = t
    return { t, [field]: field === 'color' ? color(p.color, label) : num(p.value, `${label}[${i}].value`, 0, 100) }
  })
}

/** Valida exclusivamente la entrada del índice project.json (sin cuerpo duplicado). */
export function validateVfxIndex(raw) {
  const v = object(raw, 'VFX')
  keys(v, ['id', 'name', 'folder', 'schemaVersion'], 'Índice VFX')
  if (typeof v.id !== 'string' || !/^[\w-]{1,100}$/.test(v.id)) throw new Error('VFX: ID inválido')
  if (typeof v.name !== 'string' || !v.name.endsWith(VFX_EXT) || v.name.length > 180 ||
      /[\\/:*?"<>|\x00-\x1f]/.test(v.name) || v.name.startsWith('.')) throw new Error('VFX: nombre .vfx inválido')
  if (typeof v.folder !== 'string' || !(v.folder === 'Assets' || v.folder.startsWith('Assets/')) ||
      v.folder.split('/').some((part) => !part || part === '.' || part === '..' || /[\\:*?"<>|\x00-\x1f]/.test(part))) throw new Error('VFX: carpeta inválida')
  if (v.schemaVersion !== VFX_SCHEMA_VERSION) throw new Error(`VFX: versión no soportada (${String(v.schemaVersion)})`)
  return { id: v.id, name: v.name, folder: v.folder, schemaVersion: v.schemaVersion }
}

/** Migración explícita del legado S12. Los VFX no conservan responsabilidades meteorológicas. */
export function migrateLegacyVfxResource(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !raw.movement ||
      !Object.prototype.hasOwnProperty.call(raw.movement,'tornadoFlow'))
    return {resource:raw,migrated:false,warnings:[]}
  if (typeof raw.movement.tornadoFlow !== 'boolean') throw new Error('VFX: legado tornadoFlow inválido')
  if (raw.movement.tornadoFlow && raw.movement.space !== 'world')
    throw new Error('VFX: el legado meteorológico requiere Espacio Mundo')
  const {tornadoFlow,...movement}=raw.movement
  return {resource:{...raw,movement},migrated:true,
    warnings:['movement.tornadoFlow migrado: la meteorología pertenece a World/Weather']}
}

/** Rechaza valores inválidos; admite únicamente la migración explícita S12. */
export function validateVfxResource(raw) {
  const v = object(migrateLegacyVfxResource(raw).resource, 'VFX')
  keys(v, ['id', 'name', 'folder', 'schemaVersion', 'emission', 'birth', 'movement', 'appearance', 'evolution'], 'VFX')
  const index = validateVfxIndex({ id: v.id, name: v.name, folder: v.folder, schemaVersion: v.schemaVersion })
  const d = defaults()
  const e = { ...d.emission, ...object(v.emission === undefined ? {} : v.emission, 'Emisión') }
  const b = { ...d.birth, ...object(v.birth === undefined ? {} : v.birth, 'Nacimiento') }
  const m = { ...d.movement, ...object(v.movement === undefined ? {} : v.movement, 'Movimiento') }
  const a = { ...d.appearance, ...object(v.appearance === undefined ? {} : v.appearance, 'Apariencia') }
  const x = { ...d.evolution, ...object(v.evolution === undefined ? {} : v.evolution, 'Evolución') }
  keys(e, Object.keys(d.emission), 'Emisión'); keys(b, Object.keys(d.birth), 'Nacimiento')
  keys(m, Object.keys(d.movement), 'Movimiento'); keys(a, Object.keys(d.appearance), 'Apariencia')
  keys(x, Object.keys(d.evolution), 'Evolución')
  if (typeof e.loop !== 'boolean') throw new Error('Emisión.loop: booleano requerido')
  if (typeof a.textureId !== 'string' || a.textureId.length > 100) throw new Error('Apariencia.textureId: referencia inválida')
  const emission = {
    mode: choice(e.mode, 'Emisión', ['continuous', 'burst']),
    rate: num(e.rate, 'Emisión.rate', 0, 10000), burstCount: num(e.burstCount, 'Emisión.burstCount', 0, 1024, true),
    duration: num(e.duration, 'Emisión.duration', 0, 86400),
    loop: e.loop,
    capacity: num(e.capacity, 'Emisión.capacity', 1, 1024, true),
  }
  const birth = {
    shape: choice(b.shape, 'Nacimiento.shape', ['point', 'box', 'sphere']),
    box: vector(b.box, 'Nacimiento.box', 0, 10000), radius: num(b.radius, 'Nacimiento.radius', 0, 10000),
    lifetime: vector(b.lifetime, 'Nacimiento.lifetime', 0.001, 86400, 2),
  }
  if (birth.lifetime[0] > birth.lifetime[1]) throw new Error('Nacimiento: vida mínima superior a la máxima')
  const movement = {
    speed: num(m.speed, 'Movimiento.speed', 0, 10000), spread: num(m.spread, 'Movimiento.spread', 0, 10000),
    acceleration: vector(m.acceleration, 'Movimiento.acceleration', -10000, 10000),
    space: choice(m.space, 'Movimiento.space', ['local', 'world']),
  }
  const appearance = {
    textureId: a.textureId,
    color: color(a.color, 'Apariencia.color'), size: num(a.size, 'Apariencia.size', 0.001, 10000),
    opacity: num(a.opacity, 'Apariencia.opacity', 0, 1), rotation: num(a.rotation, 'Apariencia.rotation', -36000, 36000),
    blend: choice(a.blend, 'Apariencia.blend', ['alpha', 'additive']),
  }
  return { ...index, emission, birth, movement, appearance, evolution: {
    size: curve(x.size, 'Evolución.size', 'value'), opacity: curve(x.opacity, 'Evolución.opacity', 'value'),
    color: curve(x.color, 'Evolución.color', 'color'),
  } }
}

/** El índice se usa durante la hidratación; una definición con cuerpo se valida completa. */
export function normalizeVfxCollection(list) {
  if (list === undefined) return []
  if (!Array.isArray(list)) throw new Error('VFX: colección inválida')
  const ids = new Set(), paths = new Set()
  return list.map((v) => {
    const indexed = !['emission', 'birth', 'movement', 'appearance', 'evolution'].some((key) => Object.hasOwn(object(v, 'VFX'), key))
    const r = indexed ? validateVfxIndex(v) : validateVfxResource(v)
    const path = `${r.folder}/${r.name}`.toLowerCase()
    if (ids.has(r.id) || paths.has(path)) throw new Error(`VFX: ID o ruta duplicada (${r.id})`)
    ids.add(r.id); paths.add(path)
    return r
  })
}

export function newVfxResource(id, name = 'Efecto.vfx', folder = VFX_FOLDER) {
  return validateVfxResource({ id, name, folder, schemaVersion: VFX_SCHEMA_VERSION })
}

export const vfxIndexOf = (v) => validateVfxIndex({ id: v.id, name: v.name, folder: v.folder, schemaVersion: v.schemaVersion })
