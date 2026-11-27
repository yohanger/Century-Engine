import * as THREE from 'three'
import { buildMeshGLB, objToGlb } from './godot/glb.js'
import { getDef } from '../engine/runtime/nodes/index.js'
import { godotNode } from './godot/nodes.js'
import { num, flt, col, q, transformStr, safeName } from './godot/format.js'
import { DEG, slug, bytesToB64 } from '../engine/runtime/util.js'
import { bakeWaterMap, normalizeWaterFx } from '../engine/runtime/geometry/waterfx.js'
import { godotFxVec4 } from './godot/shaders.js'

/**
 * Genera todos los archivos del nivel para Godot 4 respetando el árbol de nodos del editor.
 * @param project  datos del proyecto (objects con parentId, environment, settings, models)
 * @param terrain  instancia de Terrain
 * @param models   Map(id -> { name, bytes })
 * @returns { files: Map<string, string|Uint8Array>, summary, levelSlug, resDir }
 */
export function buildExport(project, terrain, models = new Map(), options = {}) {
  if ((project.objects || []).some(o => (Array.isArray(o.scriptIds) && o.scriptIds.length) || o.scriptId)) throw new Error('Exportación Godot bloqueada: los Scripts de Nodo JavaScript no tienen conversión GDScript soportada.')
  if (project.signalConnections?.length) throw new Error('Exportación Godot bloqueada: las conexiones visuales de señales no tienen conversión soportada. Conservar en .lfproj o Player LevelForge.')
  if ((project.objects || []).some((o) => o.type === 'vfx')) throw new Error('Exportación Godot bloqueada: contiene nodos VFX3D que Godot no puede representar sin pérdida de datos.')
  const levelSlug = options.levelSlug || slug(project.name)
  let resBase = options.resPath ?? project.settings?.exportPath ?? 'res://levels/'
  if (!resBase.endsWith('/')) resBase += '/'
  const resDir = `${resBase}${levelSlug}/`
  const files = new Map()

  const ext = []
  const subs = []
  const nodes = []
  const counters = {}
  const nextId = (t) => `${t}_${(counters[t] = (counters[t] || 0) + 1)}`
  const addExt = (type, path) => {
    const id = `${ext.length + 1}_${slug(path).slice(-6)}`
    ext.push({ type, path, id })
    return id
  }
  const addSub = (type, props) => {
    const id = nextId(type)
    subs.push(`[sub_resource type="${type}" id="${id}"]\n${props.join('\n')}\n`)
    return id
  }
  const addNode = (name, type, parent, props = [], extra = '') => {
    const head = `[node name=${q(name)}${type ? ` type="${type}"` : ''}${parent !== null ? ` parent=${q(parent)}` : ''}${extra}]`
    nodes.push(`${head}\n${props.length ? props.join('\n') + '\n' : ''}`)
  }

  // ---- materiales compartidos ----
  const matCache = new Map()
  const material = (o) => {
    const key = [o.color, o.roughness, o.metallic, o.opacity].join('|')
    if (matCache.has(key)) return matCache.get(key)
    const props = [`albedo_color = ${col(o.color, o.opacity)}`, `roughness = ${flt(o.roughness)}`]
    if (o.metallic > 0) props.push(`metallic = ${flt(o.metallic)}`)
    if (o.opacity < 1) props.push('transparency = 1')
    const id = addSub('StandardMaterial3D', props)
    matCache.set(key, id)
    return id
  }

  // ---- modelos importados (un archivo por modelo, deduplicado; los .obj se convierten a .glb) ----
  const modelExt = new Map()
  const usedFiles = new Set()
  const modelRel = new Map()
  const modelFile = (modelId) => {
    const m = models.get(modelId)
    if (!m) return null
    if (!modelRel.has(modelId)) {
      const base = slug((m.name || 'modelo').replace(/\.[^.]+$/, ''), 'modelo')
      let f = base, i = 2
      while (usedFiles.has(f)) f = `${base}_${i++}`
      usedFiles.add(f)
      const isObj = /\.obj$/i.test(m.name || '')
      const e = isObj ? 'glb' : /\.gltf$/i.test(m.name || '') ? 'gltf' : 'glb'
      const bytes = m.bytes instanceof Uint8Array ? m.bytes : new Uint8Array(m.bytes)
      files.set(`assets/${f}.${e}`, isObj ? objToGlb(bytes, base) : bytes)
      modelRel.set(modelId, `assets/${f}.${e}`)
    }
    return modelRel.get(modelId)
  }
  const modelResource = (modelId) => {
    const rel = modelFile(modelId)
    if (!rel) return null
    if (!modelExt.has(modelId)) modelExt.set(modelId, addExt('PackedScene', `${resDir}${rel}`))
    return modelExt.get(modelId)
  }

  // ---- mallas editables (un .glb por malla, con la escala ya aplicada) ----
  const meshUsed = new Set()
  const meshResource = (o, bytes) => {
    const base = slug(o.name || 'malla', 'malla')
    let f = base, i = 2
    while (meshUsed.has(f)) f = `${base}_${i++}`
    meshUsed.add(f)
    files.set(`assets/meshes/${f}.glb`, bytes)
    return addExt('PackedScene', `${resDir}assets/meshes/${f}.glb`)
  }

  // ---- terreno ----
  const hasTerrain = terrain.enabled !== false
  let terrainExt = null, hm = null
  if (hasTerrain) files.set('terrain/terrain.glb', buildMeshGLB({
    name: 'Terrain',
    positions: terrain.mesh.geometry.attributes.position.array,
    normals: terrain.mesh.geometry.attributes.normal.array,
    colors: terrain.bakeColors(),
    indices: terrain.mesh.geometry.index.array,
  }))
  const n1 = terrain.segments + 1
  let terrainProps = []
  let waterMap = null // { tex, size, maxD } si hay agua sobre un terreno
  if (hasTerrain) {
    terrainExt = addExt('PackedScene', `${resDir}terrain/terrain.glb`)
    files.set('terrain/terrain_loader.gd', TERRAIN_LOADER)
    const scriptExt = addExt('Script', `${resDir}terrain/terrain_loader.gd`)
    // material con la mezcla de capas (splat) igual que en el editor
    const tex = options.foliageTextures || new Map()
    const layers = terrain.layers.slice(0, 8)
    const texExt = layers.map((l, i) => {
      const img = l.texture ? tex.get(l.texture) : null
      if (!img) return null
      files.set(`terrain/layer_${i}.png`, img.bytes)
      return addExt('Texture2D', `${resDir}terrain/layer_${i}.png`)
    })
    const splatTex = (off, label) => {
      const px = new Uint8Array(n1 * n1 * 4)
      for (let v = 0; v < n1 * n1; v++) for (let k = 0; k < 4; k++) px[v * 4 + k] = terrain.splat[v * 8 + off + k]
      const im = addSub('Image', [`data = {\n"data": PackedByteArray("${bytesToB64(px)}"),\n"format": "RGBA8",\n"height": ${n1},\n"mipmaps": false,\n"width": ${n1}\n}`])
      return addSub('ImageTexture', [`image = SubResource("${im}")`])
    }
    const sa = splatTex(0), sb = splatTex(4)
    // mapa de agua (profundidad + cobertura): el terreno se moja y se tiñe bajo el agua, y el agua lo lee para su color y su espuma
    const fx = normalizeWaterFx(project.environment)
    const wm = fx.wfOn ? bakeWaterMap(project.objects, terrain) : null
    if (wm) {
      const im = addSub('Image', [`data = {\n"data": PackedByteArray("${bytesToB64(wm.data)}"),\n"format": "RGBA8",\n"height": ${wm.res},\n"mipmaps": false,\n"width": ${wm.res}\n}`])
      waterMap = { tex: addSub('ImageTexture', [`image = SubResource("${im}")`]), size: wm.size, maxD: wm.maxD }
    }
    const shader = addSub('Shader', [`code = ${JSON.stringify(terrainShader(layers.map((l, i) => !!texExt[i]), !!wm))}`])
    const mp = [`shader = SubResource("${shader}")`, `shader_parameter/splat_a = SubResource("${sa}")`, `shader_parameter/splat_b = SubResource("${sb}")`,
      `shader_parameter/terrain_size = ${num(terrain.size)}`, `shader_parameter/grid = ${num(n1)}`]
    if (wm) mp.push(`shader_parameter/water_map = SubResource("${waterMap.tex}")`, `shader_parameter/wm_size = ${num(wm.size)}`, `shader_parameter/wm_maxd = ${num(wm.maxD)}`, `shader_parameter/fx_a = ${godotFxVec4(fx)}`, `shader_parameter/fx_tint = ${col(fx.wfTint)}`)
    layers.forEach((l, i) => {
      mp.push(`shader_parameter/color_${i} = ${col(l.color)}`, `shader_parameter/tile_${i} = ${num(Math.max(0.1, l.tile || 4))}`)
      if (texExt[i]) mp.push(`shader_parameter/tex_${i} = ExtResource("${texExt[i]}")`)
    })
    const mat = addSub('ShaderMaterial', mp)
    terrainProps = [`script = ExtResource("${scriptExt}")`, `scene = ExtResource("${terrainExt}")`, `material = SubResource("${mat}")`]
  }
  if (hasTerrain) hm = addSub('HeightMapShape3D', [`map_width = ${n1}`, `map_depth = ${n1}`, `map_data = PackedFloat32Array(${Array.from(terrain.heights, (h) => num(h / terrain.step)).join(', ')})`])

  // ---- entorno ----
  const env = project.environment
  const skyMat = addSub('ProceduralSkyMaterial', [
    `sky_top_color = ${col(env.skyTop)}`, `sky_horizon_color = ${col(env.skyHorizon)}`,
    `ground_bottom_color = ${col(env.ground)}`, `ground_horizon_color = ${col(env.skyHorizon)}`,
    'sun_angle_max = 1.0', // sin halo solar: el editor no dibuja disco
  ])
  const sky = addSub('Sky', [`sky_material = SubResource("${skyMat}")`])
  const envProps = ['background_mode = 2', `sky = SubResource("${sky}")`, 'ambient_light_source = 2', `ambient_light_color = ${col(env.ambientColor || env.skyHorizon)}`, `ambient_light_energy = ${flt(env.ambient)}`, 'tonemap_mode = 0']
  if (env.fog) envProps.push('fog_enabled = true', 'fog_sky_affect = 0.0', `fog_light_color = ${col(env.fogColor)}`, `fog_density = ${flt(env.fogDensity)}`)
  const envId = addSub('Environment', envProps)

  // ---- raíz y nodos fijos ----
  const rootName = safeName(project.name, new Set(), 'Level').replace(/\s+/g, '_')
  addNode(rootName, 'Node3D', null)
  addNode('WorldEnvironment', 'WorldEnvironment', '.', [`environment = SubResource("${envId}")`])
  if (hasTerrain) addNode('Terrain', 'Node3D', '.', terrainProps)
  if (hasTerrain) addNode('TerrainBody', 'StaticBody3D', '.')
  const sc = terrain.step // escala UNIFORME (Godot avisa si no lo es): las alturas se dividen por la celda
  if (hasTerrain) addNode('CollisionShape3D', 'CollisionShape3D', 'TerrainBody', [
    `shape = SubResource("${hm}")`,
    ...(Math.abs(sc - 1) > 1e-6 ? [`transform = Transform3D(${num(sc)}, 0, 0, 0, ${num(sc)}, 0, 0, 0, ${num(sc)}, 0, 0, 0)`] : []),
  ])
  const reserved = new Set(['WorldEnvironment', 'Terrain', 'TerrainBody'])

  // ---- árbol de objetos ----
  const ids = new Set(project.objects.map((o) => o.id))
  const kids = new Map()
  for (const o of project.objects) {
    const p = o.parentId && ids.has(o.parentId) ? o.parentId : null
    if (!kids.has(p)) kids.set(p, [])
    kids.get(p).push(o)
  }

  // ---- vegetación (MultiMesh): un GLB por tipo + foliage.json + script cargador ----
  const foliageInfo = exportFoliage({ terrain, models, modelFile, files, resDir, textures: options.foliageTextures || new Map() })
  if (foliageInfo.types.length) {
    const sc = addExt('Script', `${resDir}foliage/foliage_loader.gd`)
    addNode('Foliage', 'Node3D', '.', [`script = ExtResource("${sc}")`, `data_path = ${q(`${resDir}foliage/foliage.json`)}`])
    reserved.add('Foliage')
  }

  const usedNames = new Map([['.', reserved]])
  const usedFor = (path) => { if (!usedNames.has(path)) usedNames.set(path, new Set()); return usedNames.get(path) }

  const scriptExt = new Map()
  const exScript = (name, code) => {
    if (!scriptExt.has(name)) { files.set(`scripts/${name}`, code); scriptExt.set(name, addExt('Script', `${resDir}scripts/${name}`)) }
    return scriptExt.get(name)
  }
  const fileRes = (rel, bytes) => {
    let r = rel, i = 2
    while (files.has(r)) r = rel.replace(/(\.[^.]+)$/, `_${i++}$1`)
    files.set(r, bytes)
    return `${resDir}${r}`
  }
  const ex = { waterMap, texture: (id) => (options.foliageTextures || new Map()).get(id), terrain, world: null, script: exScript, loaderCode: TERRAIN_LOADER, slug, fileRes, project, material, sub: addSub, ext: addExt, modelResource, meshResource }
  const summary = { primitives: 0, lights: 0, spawns: 0, cameras: 0, triggers: 0, models: 0, groups: 0, meshes: 0, texts: 0, roads: 0, waters: 0, foliage: foliageInfo.total }
  const SUM_KEY = { primitive: 'primitives', light: 'lights', spawn: 'spawns', camera: 'cameras', trigger: 'triggers', atmovolume: 'atmovolumes', event: 'events', model: 'models', group: 'groups', mesh: 'meshes', text: 'texts', road: 'roads', water: 'waters', navigation: 'navigations' }
  const meta = { spawns: [], triggers: [], cameras: [], events: [] }

  function emitDesc(d, name, parentPath, transform) {
    const props = [...(transform ? [`transform = ${transform}`] : []), ...(d.props || [])]
    const extra = (d.instance ? ` instance=ExtResource("${d.instance}")` : '') + (d.extra || '')
    addNode(name, d.type, parentPath, props, extra)
    const path = parentPath === '.' ? name : `${parentPath}/${name}`
    const used = usedFor(path)
    for (const k of d.kids || []) {
      used.add(k.name)
      emitDesc(k, k.name, path, null)
    }
    return path
  }

  function worldInfo(o, parentM) {
    const e = new THREE.Euler(o.rotation[0] * DEG, o.rotation[1] * DEG, o.rotation[2] * DEG, 'YXZ')
    const local = new THREE.Matrix4().compose(new THREE.Vector3(...o.position), new THREE.Quaternion().setFromEuler(e), new THREE.Vector3(1, 1, 1))
    const world = parentM.clone().multiply(local)
    const p = new THREE.Vector3(), qn = new THREE.Quaternion(), s = new THREE.Vector3()
    world.decompose(p, qn, s)
    const r = new THREE.Euler().setFromQuaternion(qn, 'YXZ')
    return { world, position: p.toArray().map((v) => +v.toFixed(4)), rotation: [r.x / DEG, r.y / DEG, r.z / DEG].map((v) => +v.toFixed(3)) }
  }

  function emitObject(o, parentPath, parentM) {
    const def = getDef(o.type)
    if (!def) return
    summary[SUM_KEY[o.type]] = (summary[SUM_KEY[o.type]] || 0) + 1
    const w = worldInfo(o, parentM)
    ex.world = w.world
    const hook = godotNode(o.type)
    const d = hook ? hook(o, ex) : { type: 'Node3D' } // los nodos nuevos no tienen exportación propia
    const name = safeName(o.name, usedFor(parentPath))
    const path = emitDesc(d, name, parentPath, transformStr(o))
    if (o.type === 'spawn') meta.spawns.push({ name, path, tag: o.props.tag || 'player', position: w.position, rotation: w.rotation })
    if (o.type === 'camera') meta.cameras.push({ name, path, fov: o.props.fov || 70, position: w.position, rotation: w.rotation })
    if (o.type === 'event') meta.events.push({ name, path, position: w.position, rotation: w.rotation, size: o.scale, reach: o.props?.reach ?? 1.2, pages: o.props?.pages || [] })
    if (o.type === 'trigger') meta.triggers.push({ name, path, tag: o.props.tag || 'zona', position: w.position, rotation: w.rotation, size: o.scale })
    for (const c of kids.get(o.id) || []) emitObject(c, path, w.world)
  }

  for (const o of kids.get(null) || []) emitObject(o, '.', new THREE.Matrix4())

  // ---- ensamblar .tscn ----
  const loadSteps = 1 + ext.length + subs.length
  const out = [`[gd_scene load_steps=${loadSteps} format=3]`, '']
  for (const e of ext) out.push(`[ext_resource type="${e.type}" path=${q(e.path)} id="${e.id}"]`)
  if (ext.length) out.push('')
  out.push(...subs, ...nodes)
  if (project.animations?.length) files.set('animations.json', JSON.stringify({ generator: 'LevelForge', animations: JSON.parse(JSON.stringify(project.animations)) }, null, 1)) // clips de animación por claves
  if (project.timelines?.length) files.set('timelines.json', JSON.stringify({ generator: 'LevelForge', timelines: JSON.parse(JSON.stringify(project.timelines)) }, null, 1)) // cinemáticas (pistas de cámara, nodos, audio y comandos)
  if (project.database && (project.database.actors?.length || project.database.items?.length)) files.set('database.json', JSON.stringify({ generator: 'LevelForge', ...JSON.parse(JSON.stringify(project.database)) }, null, 1)) // personajes, objetos, habilidades…
  files.set(`${levelSlug}.tscn`, out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n')

  files.set('level.json', JSON.stringify({
    name: project.name, generator: 'LevelForge',
    terrain: hasTerrain ? { size: terrain.size, segments: terrain.segments } : null,
    foliage: foliageInfo.types.map((t) => ({ name: t.name, scene: t.scene, count: t.count })),
    ...meta,
  }, null, 2))
  files.set('LEEME_IMPORTAR.md', readme(project.name, levelSlug, resDir, summary, summary.waters > 0, foliageInfo))
  return { files, summary, levelSlug, resDir }
}

function readme(name, s, resDir, sum, water, fol = { types: [], total: 0 }) {
  return `# ${name} — exportado desde LevelForge

## Cómo usarlo en Godot 4
1. Copia esta carpeta dentro de tu proyecto, de modo que quede en \`${resDir}\`.
   (Si usas otra ruta, cambia el prefijo en LevelForge → Exportar → «Ruta res://» y vuelve a exportar.)
2. Abre Godot: importará \`terrain/terrain.glb\` y los modelos de \`assets/\`.
3. Abre \`${s}.tscn\` y ejecútalo (F6), o instáncialo desde tu escena principal.

## Qué contiene
- **Terrain**: malla del terreno (GLB con colores por vértice de la pintura) + **TerrainBody** con \`HeightMapShape3D\` para colisión.
- **Árbol de nodos** igual al del editor: ${sum.groups} grupo(s) (Node3D), ${sum.primitives} primitiva(s) con su StaticBody3D y colisión exactos, ${sum.lights} luz(es), ${sum.spawns} spawn(s), ${sum.cameras} cámara(s), ${sum.triggers} trigger(s), ${sum.models} modelo(s), ${sum.texts || 0} texto(s) 3D, ${sum.meshes || 0} malla(s) editable(s) (en \`assets/meshes/\`, con colisión trimesh/convexa). Los hijos heredan posición y rotación de su padre, como en Godot.
- **WorldEnvironment** con cielo procedural, ambiente y niebla.${water ? '\n- **Agua** (objetos «Agua»): malla con shader de olas (viento, ondulación, espuma) en la posición del nodo, sin colisión; los parámetros del shader se ven en el inspector del material. El agua y el terreno comparten una textura de profundidad (`water_map` en los materiales): el terreno se moja y se tiñe bajo el agua, y el agua cambia de color, opacidad y espuma según la profundidad real. Si mueves o editas el terreno o el agua en Godot, vuelve a exportar desde LevelForge para regenerar esa textura.' : ''}
${fol.types.length ? `- **Foliage**: ${fol.total.toLocaleString('es')} instancias de ${fol.types.length} tipo(s) (${fol.types.map((t) => t.name).join(', ')}). Cada tipo es un \`MultiMeshInstance3D\` (un solo draw call por malla) que crea \`foliage/foliage_loader.gd\` al abrir la escena a partir de \`foliage/foliage.json\`. En el nodo **Foliage** puedes ajustar \`draw_distance\` (0 = sin límite) y \`cast_shadows\`. Las instancias van ya colocadas sobre el terreno.\n` : ''}- \`level.json\`: spawns, cámaras y triggers con su ruta de nodo y su transformación en el mundo, para leerlos desde tus scripts.

## Convenciones útiles
- Los spawns están en el grupo \`spawn_points\` y llevan \`metadata/tag\` (p. ej. \`player\`).
- Los triggers son \`Area3D\` en el grupo \`triggers\` con \`metadata/tag\`.
- El tamaño de cada nodo va dentro de su malla y su forma de colisión (nunca como escala), así que los hijos no heredan tamaño.
- Si el terreno se ve blanco, abre el material del mesh importado y activa **Vertex Color → Use as Albedo**.
- Los GLB importados con colisión «caja» se envuelven en un StaticBody3D con un BoxShape3D del tamaño del modelo.
`
}

export async function exportZip(project, terrain, models, options) {
  const { default: JSZip } = await import('jszip')
  const res = buildExport(project, terrain, models, options)
  const zip = new JSZip()
  const root = zip.folder(res.levelSlug)
  for (const [path, data] of res.files) root.file(path, data)
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  return { blob, ...res }
}

/**
 * Exporta varias escenas de un proyecto en un solo zip: una carpeta por escena dentro de la carpeta del proyecto.
 * @param items [{ project, terrain }]  proyecto «aplanado» con los datos de cada escena (name = nombre de la escena)
 */
export async function exportScenesZip(items, models, { projectName = 'proyecto', resPath, foliageTextures } = {}) {
  if (items.some(({project}) => project.objects?.some(o => (Array.isArray(o.scriptIds) && o.scriptIds.length) || o.scriptId))) throw new Error('Exportación Godot bloqueada: los Scripts de Nodo JavaScript no tienen conversión GDScript soportada.')
  if (items.some(({project}) => project.objects?.some(o => (Array.isArray(o.scriptIds) && o.scriptIds.length) || o.scriptId))) throw new Error('Exportación Godot bloqueada: los Scripts de Nodo JavaScript no tienen conversión GDScript soportada.')
  if (items.some(({project}) => project.signalConnections?.length)) throw new Error('Exportación Godot bloqueada: hay conexiones visuales en una o más escenas.')
  if (items.length === 1) return exportZip(items[0].project, items[0].terrain, models, { resPath, foliageTextures })
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const root = zip.folder(slug(projectName, 'proyecto'))
  const used = new Set()
  const summary = { primitives: 0, lights: 0, spawns: 0, cameras: 0, triggers: 0, models: 0, groups: 0, meshes: 0, texts: 0, foliage: 0 }
  const levels = []
  for (const { project, terrain } of items) {
    let levelSlug = slug(project.name), n = 2
    while (used.has(levelSlug)) levelSlug = `${slug(project.name)}_${n++}`
    used.add(levelSlug)
    const res = buildExport(project, terrain, models, { resPath, levelSlug, foliageTextures })
    const dir = root.folder(levelSlug)
    for (const [path, data] of res.files) dir.file(path, data)
    for (const k of Object.keys(summary)) summary[k] += res.summary[k] || 0
    levels.push({ name: project.name, slug: levelSlug, scene: `${resPath || project.settings?.exportPath || 'res://levels/'}${levelSlug}/${levelSlug}.tscn` })
  }
  root.file('escenas.json', JSON.stringify({ project: projectName, generator: 'LevelForge', scenes: levels }, null, 2))
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  return { blob, summary, levelSlug: slug(projectName, 'proyecto'), levels }
}

import { TERRAIN_LOADER, terrainShader } from './exporter-templates.js'
import { exportFoliage } from './exporter-foliage.js'
/**
 * Igual que exportScenesZip pero devuelve los archivos sueltos: Map(rutaRelativa → datos) con una carpeta por escena
 * (`<escena>/<escena>.tscn`, …) (sin archivos sueltos fuera de ellas). Pensado para escribirlos directamente en la carpeta del proyecto Godot.
 */
export function exportScenesFiles(items, models, { projectName = 'proyecto', resPath, foliageTextures } = {}) {
  if (items.some(({project}) => project.signalConnections?.length)) throw new Error('Exportación Godot bloqueada: hay conexiones visuales en una o más escenas.')
  const files = new Map()
  const used = new Set()
  const summary = { primitives: 0, lights: 0, spawns: 0, cameras: 0, triggers: 0, models: 0, groups: 0, meshes: 0, texts: 0, foliage: 0 }
  const levels = []
  for (const { project, terrain } of items) {
    let levelSlug = slug(project.name), n = 2
    while (used.has(levelSlug)) levelSlug = `${slug(project.name)}_${n++}`
    used.add(levelSlug)
    const res = buildExport(project, terrain, models, { resPath, levelSlug, foliageTextures })
    for (const [path, data] of res.files) files.set(`${levelSlug}/${path}`, data)
    for (const k of Object.keys(summary)) summary[k] += res.summary[k] || 0
    levels.push({ name: project.name, slug: levelSlug, scene: `${resPath || project.settings?.exportPath || 'res://levels/'}${levelSlug}/${levelSlug}.tscn` })
  }
  return { files, summary, levels }
}
