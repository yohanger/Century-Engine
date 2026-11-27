export const MODEL_MAPS = Object.freeze([
  { key:'albedo', label:'Textura Albedo', property:'map', srgb:true },
  { key:'normal', label:'Normal Map', property:'normalMap', srgb:false },
  { key:'roughness', label:'Roughness Map', property:'roughnessMap', srgb:false },
  { key:'metallic', label:'Metallic Map', property:'metalnessMap', srgb:false },
  { key:'ao', label:'Ambient Occlusion Map', property:'aoMap', srgb:false },
  { key:'emission', label:'Emission Map', property:'emissiveMap', srgb:true },
])
export function syncNativeMaps(material, maps, getMap) {
  if (!maps && !material.userData.centuryNativeMaps) return
  material.userData.centuryNativeMaps = true
  for (const f of MODEL_MAPS) {
    if (f.key === 'normal') continue // El detalle de superficie y el normal UV comparten el mismo canal PBR.
    const texture = maps?.[f.key] ? getMap?.(maps[f.key], f.srgb) || null : null
    if (material[f.property] !== texture) { material[f.property] = texture; material.needsUpdate = true }
  }
  if (maps?.emission) material.emissive?.set('#ffffff')
  else material.emissive?.set('#000000')
}
