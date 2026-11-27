// Recipientes de líquido finito. Sin Three.js, Jolt ni estado gráfico duplicado.
export const WATER_LIQUID = Object.freeze({ id: 'water', densityKgM3: 1000, viscosity: 1, color: '#3a78a8', opacity: 0.72 })
const finite = (v, min, max, name) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new RangeError(`Líquido: ${name} inválido`)
  return v
}
export function normalizeLiquid(data, { resource = false } = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Líquido: perfil inválido')
  const id = data.id ?? 'water'
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new Error('Líquido: identidad inválida')
  const densityKgM3 = finite(data.densityKgM3 ?? 1000, 1, 30000, 'densidad')
  const viscosity = finite(data.viscosity ?? 1, 0.01, 100, 'viscosidad relativa')
  const color = data.color ?? '#3a78a8'
  if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Líquido: color inválido')
  const opacity = finite(data.opacity ?? 0.72, 0.05, 1, 'opacidad')
  if (!resource) return { id, densityKgM3, viscosity, color, opacity }
  if (typeof data.name !== 'string' || !data.name.endsWith('.liquid') || typeof data.folder !== 'string' || !data.folder.startsWith('Assets'))
    throw new Error('Líquido: ruta de recurso inválida')
  return { id, name: data.name, folder: data.folder, densityKgM3, viscosity, color, opacity }
}

