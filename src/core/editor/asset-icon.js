const artwork = Object.freeze({
  obj: new URL('../../assets/icons/asset_obj.svg', import.meta.url).href,
  glb: new URL('../../assets/icons/asset_glb.svg', import.meta.url).href,
  gltf: new URL('../../assets/icons/asset_gltf.svg', import.meta.url).href,
  model: new URL('../../assets/icons/asset_model.svg', import.meta.url).href,
  scene: new URL('../../assets/icons/asset_scene.svg', import.meta.url).href,
  prefab: new URL('../../assets/icons/asset_prefab.svg', import.meta.url).href,
  shader: new URL('../../assets/icons/asset_shader.svg', import.meta.url).href,
  texture: new URL('../../assets/icons/asset_texture.svg', import.meta.url).href,
  vfx: new URL('../../assets/icons/asset_vfx.svg', import.meta.url).href,
  profile: new URL('../../assets/icons/asset_profile.svg', import.meta.url).href,
  liquid: new URL('../../assets/icons/asset_liquid.svg', import.meta.url).href,
  gamemanager: new URL('../../assets/icons/asset_gamemanager.svg', import.meta.url).href,
  ui: new URL('../../assets/icons/asset_ui.svg', import.meta.url).href,
  audio: new URL('../../assets/icons/asset_audio.svg', import.meta.url).href,
  font: new URL('../../assets/icons/asset_font.svg', import.meta.url).href,
  timeline: new URL('../../assets/icons/asset_timeline.svg', import.meta.url).href,
  cinematic: new URL('../../assets/icons/asset_cinematic.svg', import.meta.url).href,
  animation: new URL('../../assets/icons/asset_animation.svg', import.meta.url).href,
  hdr: new URL('../../assets/icons/asset_hdr.svg', import.meta.url).href,
  exr: new URL('../../assets/icons/asset_exr.svg', import.meta.url).href,
  mtl: new URL('../../assets/icons/asset_mtl.svg', import.meta.url).href,
  folder: new URL('../../assets/icons/icn_folder_close.png', import.meta.url).href,
  folderOpen: new URL('../../assets/icons/icn_folder_open.png', import.meta.url).href,
  file: new URL('../../assets/icons/icn_file_tiny.png', import.meta.url).href,
  script: new URL('../../assets/icons/icn_menu_script.png', import.meta.url).href,
  material: new URL('../../assets/icons/icn_material_silueta.png', import.meta.url).href,
})

/** La clasificación del recurso pertenece al catálogo del proyecto. */
export function assetIcon(entry, selected = false) {
  const kind = entry?.kind
  if (kind === 'folder') return artwork[selected ? 'folderOpen' : 'folder']
  const ext = /\.([^.]+)$/.exec(entry?.file || entry?.name || '')?.[1]?.toLowerCase() || ''
  if (kind === 'file' && ['hdr', 'exr', 'mtl'].includes(ext)) return artwork[ext]
  if (kind === 'model') {
    const format = String(entry.ref?.ext || ext).toLowerCase().replace(/^\./, '')
    return artwork[['obj', 'glb', 'gltf'].includes(format) ? format : 'model']
  }
  return Object.hasOwn(artwork, kind) ? artwork[kind] : artwork.file
}
