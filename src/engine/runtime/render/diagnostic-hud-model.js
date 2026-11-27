import { VIEW_MODES, DIAGNOSTIC_HEAT_COLORS, DIAGNOSTIC_LOD_COLORS } from './view-diagnostics-contract.js'

const CLOUD_HEAT_COLORS = Object.freeze(['#127a36', '#f2c226', '#d91c29'])
const finite = (n) => Number.isFinite(n) ? Math.max(0, Math.round(n)).toLocaleString('es') : '–'
const entry = (label, value) => ({ label, value: finite(value) })

// Solo datos publicados por ViewDiagnostics; no interpreta colores como tiempos GPU.
export function diagnosticHudModel(mode, last) {
  if (!mode || mode === 'lit' || !last || last.mode !== mode) return null
  const title = VIEW_MODES.find(x => x.id === mode)?.label.split(' · ')[0] || mode
  if (!last.supported) return { title, unavailable: last.reason || 'No disponible', facts: [], scales: [] }
  const facts = []
  const scales = []
  if (mode === 'shader') {
    facts.push(entry('Materiales', last.shaderKnown), entry('Pico GLSL', last.shaderKnown ? last.maxTextureCalls : undefined))
    if (Number.isFinite(last.skyGpuMs)) facts.push({label:'Cielo GPU',value:last.skyGpuMs.toFixed(1)+' ms'})
    scales.push({ label: 'Lecturas GLSL · estático', colors: DIAGNOSTIC_HEAT_COLORS, min: '0–1', max: '>31' })
    if (last.cloudVisible) scales.push({ label: 'Nubes · pasos/rayo', colors: CLOUD_HEAT_COLORS, min: '0', max: finite(last.cloudStepsBudget) })
    if (last.terrainDynamic) scales.push({label:'Terrain · capas/texturas activas',colors:DIAGNOSTIC_HEAT_COLORS,min:'1 capa',max:'5+ coste'})
  } else if (mode === 'lights') {
    facts.push(entry('Luces máx.', last.maxLights), entry('Mallas', last.inspected))
    scales.push({ label: 'Luces candidatas · CPU', colors: DIAGNOSTIC_HEAT_COLORS, min: '0', max: '>8' })
  } else if (mode === 'lod') {
    facts.push(entry('Triángulos', last.triangles), entry('Sin LOD', last.noLod))
    for (const [level, triangles] of Object.entries(last.lodHistogram || {}))
      facts.push(entry(`LOD ${level} · caras`, triangles))
    scales.push({ label: 'Nivel efectivo', colors: DIAGNOSTIC_LOD_COLORS, min: '0', max: '5+' })
  } else if (mode === 'clusters' || mode === 'triangles') {
    facts.push(entry('Triángulos', last.triangles), entry(mode === 'clusters' ? 'Lotes' : 'Mallas', mode === 'clusters' ? last.gpuClusters : last.inspected))
    if (mode === 'clusters') scales.push({ label: 'Nivel / clúster', colors: DIAGNOSTIC_LOD_COLORS, min: '0', max: '5+' })
  } else if (mode === 'overdraw') {
    facts.push(entry('Mallas',last.inspected))
    scales.push({label:'Overdraw · fragmentos aditivos',colors:DIAGNOSTIC_HEAT_COLORS,min:'poco',max:'mucho'})
  } else if (mode === 'wireframe') {
    facts.push(entry('Triángulos', last.triangles))
  } else if (mode === 'depth' || mode === 'normals' || mode === 'lighting' || mode === 'unlit' || mode === 'indirect') {
    facts.push(entry('Mallas', last.inspected))
  }
  return { title, unavailable: '', facts, scales }
}
