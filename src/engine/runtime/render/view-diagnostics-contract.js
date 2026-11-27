// Contrato puro de vistas y capacidades; sin GPU, DOM ni Three.js.
export const DIAGNOSTIC_HEAT_COLORS = Object.freeze(['#29bf80','#93c94b','#e5bb40','#e7853a','#d64d50','#992c7a'])
export const DIAGNOSTIC_LOD_COLORS = Object.freeze(['#36bf92','#50a8db','#d7bf60','#df865e','#c35b87','#a17fcb'])
export const VIEW_MODES = Object.freeze([
  { id: 'lit', label: 'Lit', description: 'Render normal del proyecto' },
  { id: 'unlit', label: 'Unlit', description: 'Color base y texturas, sin contribución de luces' },
  { id: 'lighting', label: 'Lighting Only', description: 'Luces y normales con albedo neutro; conserva las luces efectivas' },
  { id: 'wireframe', label: 'Wireframe', description: 'Triángulos de la geometría realmente seleccionada' },
  { id: 'triangles', label: 'Triangles · geometría real', description: 'Un color por triángulo efectivamente dibujado, con topología exacta' },
  { id: 'lod', label: 'LOD · geometría real', description: 'Nivel de detalle realmente aplicado por LodManager durante la inspección' },
  { id: 'lights', label: 'Light Complexity · candidatos', description: 'Conteo CPU conservador de luces que pueden afectar cada objeto, NO coste por píxel' },
  { id: 'depth', label: 'Depth · diagnóstico', description: 'Profundidad real mediante pase editorial; no implica un G-buffer existente' },
  { id: 'normals', label: 'Normals · diagnóstico', description: 'Normales de la geometría efectiva en espacio de vista' },
  { id: 'overdraw', label: 'Overdraw · geometría', description: 'Acumulación de fragmentos geométricos sin depth test; estimación visual, NO tiempo GPU' },
  { id: 'shader', label: 'Shader Complexity · lecturas GLSL', description: 'Mapa térmico de lecturas estáticas GLSL por material y raymarch real de nubes; NO coste GPU ni tiempo por fragmento' },
  { id: 'clusters', label: 'Clusters · geometría nativa', description: 'Identidad de los clústeres de geometría residentes; respaldo directo explícito' },
  { id: 'indirect', label: 'Indirect Lighting', description: 'Requiere salida diagnóstica verificable del subsistema de luz indirecta' },
])

const UNSUPPORTED = {} // sin mapas de complejidad fabricados
export function modeCapability(mode, { lodManager = null, renderer = null, renderConfig = null } = {}) {
  if (!VIEW_MODES.some(v => v.id === mode)) return { supported: false, reason: 'Modo desconocido' }
  if (UNSUPPORTED[mode]) return { supported: false, reason: UNSUPPORTED[mode] }
  if (mode === 'clusters' && !lodManager?.clusters)
    return { supported: false, reason: 'Cargando autoridad geométrica nativa del editor' }
  if (mode === 'lod' && !lodManager)
    return { supported: false, reason: 'Cargando selección geométrica del editor' }
  return { supported: true, reason: '' }
}

export function geometryTriangles(mesh) {
  const g = mesh?.geometry
  if (!g) return 0
  const indexed = g.index?.count ?? g.attributes?.position?.count ?? 0
  const draw = g.drawRange?.count
  const remaining = Math.max(0, indexed - (g.drawRange?.start || 0))
  const count = Number.isFinite(draw) ? Math.min(remaining, Math.max(0, draw)) : remaining
  return Math.floor(count / 3) * (mesh.isInstancedMesh ? mesh.count : 1)
}

