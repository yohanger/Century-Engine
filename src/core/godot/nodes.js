// Exportación a Godot (.tscn) de cada tipo de nodo. OBSOLETO: se conserva sin novedades. Vive aquí, fuera del Runtime, que no sabe de esta exportación.
// El exportador (core/exporter.js) pide la función de cada tipo con godotNode(tipo).
import { LIGHT_STYLES } from '../../engine/runtime/render/lightfx.js'
import { LIGHT_FX_GD, godotWaterShader } from './shaders.js'
import { buildMeshGLB } from './glb.js'
import { convexPoints, stairSteps } from '../../engine/runtime/geometry/primitives.js'
import { stairs, effectiveStairTurn, stairSideOptions } from '../../engine/runtime/mesh/generators.js'
import { ROAD_SLOTS, buildRoad, normalizeRoad } from '../../engine/runtime/geometry/road.js'
import { roadSlotMaterial } from '../../engine/runtime/render/road-material.js'
import { textBuffers, textGeometry } from '../../engine/runtime/geometry/text3d.js'
import { normalizeWaterNode, waterShapeBuffers } from '../../engine/runtime/geometry/watershape.js'
import { normalizeSource } from '../../engine/runtime/audio/config.js'
import { normalizeEvent } from '../../engine/runtime/events/model.js'
import { convexPoints as polyConvexPoints, polyBuffers, trimeshPoints } from '../../engine/runtime/mesh/buffers.js'
import { normalizeCanvas } from '../../engine/runtime/nodes/canvas.js'
import { polyOf } from '../../engine/runtime/nodes/mesh.js'
import { neonLights } from '../../engine/runtime/nodes/text.js'
import { col, flt, localT, q, scaleStr, vec3 } from './format.js'
import * as THREE from 'three'

const PART_NAMES = { asphalt: 'Asfalto', center: 'LineaCentral', lanes: 'Lineas', side: 'Acera' }

const GODOT_NODES = {
  'audio'(o) {
    const p = normalizeSource(o.props)
    const common = [`metadata/clip = ${q(p.clip)}`, `volume_db = ${flt(p.volume > 0 ? 20 * Math.log10(p.volume) : -80)}`, `pitch_scale = ${flt(p.pitch)}`, `autoplay = ${p.playOnStart}`, `bus = &${q(p.group === 'master' ? 'Master' : p.group)}`]
    if (p.mode === 'ui') return { type: 'AudioStreamPlayer', props: common }
    return { type: 'AudioStreamPlayer3D', props: [...common, `unit_size = ${flt(p.minDistance)}`, `max_distance = ${flt(p.maxDistance)}`] }
  },
  'camera': (o) => ({ type: 'Camera3D', props: [`fov = ${flt(o.props.fov || 70)}`] }),
  'canvas'(o) {
    const p = normalizeCanvas(o.props)
    return { type: 'CanvasLayer', props: [`layer = ${Math.round(p.layer)}`, `visible = ${p.visible}`, `metadata/ui = ${q(p.ui)}`] }
  },
  'critters': (o) => ({ type: 'Node3D', props: [`metadata/species = ${q(o.props?.species || 'firefly')}`, `metadata/count = ${Math.round(+o.props?.count || 0)}`, `metadata/radius = ${+o.props?.radius || 0}`], extra: ' groups=["critters"]' }),
  'event'(o, ex) {
    const props = normalizeEvent(JSON.parse(JSON.stringify(o.props || {})))
    const sh = ex.sub('BoxShape3D', [`size = ${vec3(o.scale)}`])
    return {
      type: 'Area3D',
      props: [`metadata/event = ${q(JSON.stringify(props))}`],
      extra: ' groups=["events"]',
      kids: [{ name: 'CollisionShape3D', type: 'CollisionShape3D', props: [`shape = SubResource("${sh}")`] }],
    }
  },
  'group': () => ({ type: 'Node3D', props: [] }),
  'light'(o, ex) {
    const L = o.light
    const props = [`light_color = ${col(o.color)}`, `light_energy = ${flt(L.energy)}`]
    if (L.shadow) props.push('shadow_enabled = true')
    const sid = LIGHT_STYLES[L.style]?.id || 0
    if (sid && ex) {
      const sc = ex.script('light_fx.gd', LIGHT_FX_GD)
      props.push(`script = ExtResource("${sc}")`, `style = ${sid}`, `speed = ${flt(L.speed ?? 1)}`, `amount = ${flt(L.amount ?? 0.5)}`, `base_energy = ${flt(L.energy)}`, `phase = ${flt(L.phase || 0)}`)
    }
    if (L.type === 'omni') return { type: 'OmniLight3D', props: [...props, `omni_range = ${flt(L.range)}`] }
    if (L.type === 'spot') return { type: 'SpotLight3D', props: [...props, `spot_range = ${flt(L.range)}`, `spot_angle = ${flt(L.spotAngle)}`] }
    return { type: 'DirectionalLight3D', props }
  },
  'mesh'(o, ex) {
    const poly = polyOf(o)
    const mat = ex.material(o)
    void mat
    const b = polyBuffers(poly, { scale: o.scale })
    const rgba = (() => { // glTF espera el color en lineal
       const c = new THREE.Color(o.color); return [c.r, c.g, c.b, o.opacity] })()
    const eid = ex.meshResource(o, buildMeshGLB({
      name: o.name, positions: b.positions, normals: b.normals, indices: b.indices,
      material: { name: 'Material', color: rgba, roughness: o.roughness, metallic: o.metallic, doubleSided: false },
    }))
    const kids = [{ name: 'Mesh', type: null, props: o.castShadow ? [] : ['cast_shadow = 0'], instance: eid }]
    const kind = o.props.collider || 'trimesh'
    if (!o.collision || kind === 'none' || !poly.f.length) return { type: 'Node3D', props: [], kids }
    let shape
    if (kind === 'convex') shape = ex.sub('ConvexPolygonShape3D', [`points = PackedVector3Array(${polyConvexPoints(poly, o.scale).map((v) => Number(v.toFixed(5))).join(', ')})`])
    else shape = ex.sub('ConcavePolygonShape3D', [`data = PackedVector3Array(${trimeshPoints(poly, o.scale).map((v) => Number(v.toFixed(5))).join(', ')})`])
    kids.push({ name: 'Collision', type: 'CollisionShape3D', props: [`shape = SubResource("${shape}")`] })
    return { type: 'StaticBody3D', props: [], kids }
  },
  'model'(o, ex) {
    const eid = ex.modelResource(o.modelId)
    if (!eid) return { type: 'Node3D', props: [] }
    const info = ex.project.models?.find((m) => m.id === o.modelId)
    const st = scaleStr(o.scale)
    const kids = [{ name: 'Model', type: null, props: st ? [`transform = ${st}`] : [], instance: eid }]
    const box = o.props.collider === 'box' && o.collision && info
    if (box) {
      const size = info.size.map((v, i) => v * o.scale[i])
      const c = info.center.map((v, i) => v * o.scale[i])
      const sh = ex.sub('BoxShape3D', [`size = ${vec3(size)}`])
      const ct = localT(...c)
      kids.push({ name: 'Collision', type: 'CollisionShape3D', props: [...(ct ? [`transform = ${ct}`] : []), `shape = SubResource("${sh}")`] })
    }
    return { type: box ? 'StaticBody3D' : 'Node3D', props: [], kids }
  },
  'navigation'(o, ex) {
    const p = o.props
    return {
      type: 'NavigationRegion3D',
      props: [`metadata/cell_size = ${p.cell}`, `metadata/agent_radius = ${p.agentRadius}`, `metadata/agent_height = ${p.agentHeight}`, `metadata/agent_max_slope = ${p.maxSlope}`, `metadata/agent_max_climb = ${p.stepHeight}`, `metadata/size = ${q(vec3(o.scale))}`],
      extra: ' groups=["navigation"]',
      kids: [],
    }
  },
  'primitive'(o, ex) {
    const mat = ex.material(o)
    const [sx, sy, sz] = o.scale
    const cast = o.castShadow ? [] : ['cast_shadow = 0']
    const kind = o.kind

    if (kind === 'stairs') {
      const turn = effectiveStairTurn(o.props?.turn ?? 0, sx, sz)
      if (turn !== 0 || stairSideOptions(o.props).sides !== 'none') {
        const poly = stairs(sx, sy, sz, o.props?.steps ?? 8, turn, o.props)
        const b = polyBuffers(poly)
        const c = new THREE.Color(o.color)
        const eid = ex.meshResource(o, buildMeshGLB({
          name: o.name, positions: b.positions, normals: b.normals, indices: b.indices, uvs: b.uvs,
          material: { name: 'Escalera', color: [c.r, c.g, c.b, o.opacity ?? 1], roughness: o.roughness ?? 0.95, metallic: o.metallic ?? 0, doubleSided: false },
        }))
        const kids = [{ name: 'Mesh', type: null, props: cast, instance: eid }]
        if (o.collision) {
          const shape = ex.sub('ConcavePolygonShape3D', [`data = PackedVector3Array(${trimeshPoints(poly).map((v) => Number(v.toFixed(5))).join(', ')})`])
          kids.push({ name: 'Collision', type: 'CollisionShape3D', props: [`shape = SubResource("${shape}")`] })
        }
        return { type: o.collision ? 'StaticBody3D' : 'Node3D', props: [], kids }
      }
      const kids = []
      stairSteps(o.props?.steps ?? 8).forEach((s, i) => {
        const size = [s.size[0] * sx, s.size[1] * sy, s.size[2] * sz]
        const pos = localT(s.center[0] * sx, s.center[1] * sy, s.center[2] * sz)
        const mesh = ex.sub('BoxMesh', [`material = SubResource("${mat}")`, `size = ${vec3(size)}`])
        kids.push({ name: `Step_${i + 1}`, type: 'MeshInstance3D', props: [...(pos ? [`transform = ${pos}`] : []), `mesh = SubResource("${mesh}")`, ...cast] })
        if (o.collision) {
          const sh = ex.sub('BoxShape3D', [`size = ${vec3(size)}`])
          kids.push({ name: `Col_${i + 1}`, type: 'CollisionShape3D', props: [...(pos ? [`transform = ${pos}`] : []), `shape = SubResource("${sh}")`] })
        }
      })
      return { type: o.collision ? 'StaticBody3D' : 'Node3D', props: [], kids }
    }

    let mesh
    switch (kind) {
      case 'box': case 'plane': mesh = ex.sub('BoxMesh', [`material = SubResource("${mat}")`, `size = ${vec3([sx, sy, sz])}`]); break
      case 'cylinder': mesh = ex.sub('CylinderMesh', [`material = SubResource("${mat}")`, `top_radius = ${flt(sx / 2)}`, `bottom_radius = ${flt(sx / 2)}`, `height = ${flt(sy)}`]); break
      case 'cone': mesh = ex.sub('CylinderMesh', [`material = SubResource("${mat}")`, 'top_radius = 0.0', `bottom_radius = ${flt(sx / 2)}`, `height = ${flt(sy)}`]); break
      case 'sphere': mesh = ex.sub('SphereMesh', [`material = SubResource("${mat}")`, `radius = ${flt(sx / 2)}`, `height = ${flt(sx)}`]); break
      case 'ramp': mesh = ex.sub('PrismMesh', [`material = SubResource("${mat}")`, 'left_to_right = 0.0', `size = ${vec3([sx, sy, sz])}`]); break
    }
    if (!o.collision) return { type: 'MeshInstance3D', props: [`mesh = SubResource("${mesh}")`, ...cast] }

    let shape
    switch (kind) {
      case 'box': case 'plane': shape = ex.sub('BoxShape3D', [`size = ${vec3([sx, sy, sz])}`]); break
      case 'cylinder': shape = ex.sub('CylinderShape3D', [`radius = ${flt(sx / 2)}`, `height = ${flt(sy)}`]); break
      case 'sphere': shape = ex.sub('SphereShape3D', [`radius = ${flt(sx / 2)}`]); break
      case 'ramp': case 'cone': shape = ex.sub('ConvexPolygonShape3D', [`points = PackedVector3Array(${convexPoints(kind, sx, sy, sz).flat().map((v) => Number(v.toFixed(5))).join(', ')})`]); break
    }
    return {
      type: 'StaticBody3D',
      props: [],
      kids: [
        { name: 'Mesh', type: 'MeshInstance3D', props: [`mesh = SubResource("${mesh}")`, ...cast] },
        { name: 'Collision', type: 'CollisionShape3D', props: [`shape = SubResource("${shape}")`] },
      ],
    }
  },
  'road'(o, ex) {
    const p = normalizeRoad(o.props)
    const world = ex.world || new THREE.Matrix4()
    const r = buildRoad(p, { heightAt: ex.terrain && ex.terrain.enabled !== false ? (x, z) => (ex.terrain.groundFn ? ex.terrain.groundFn(x, z) : ex.terrain.heightAt(x, z)) : (x, z) => 0, world })
    const kids = []
    for (const [k] of ROAD_SLOTS) {
      const b = r[k]
      if (!b) continue
      const s = p.slots[k]
      // Exportación GLB estática: toma color/PBR y texturas del recurso .material;
      // los shaders GLSL propios de LevelForge no se exportan a Godot sin un bake específico.
      const effective = roadSlotMaterial(s, k, ex.project?.materials || [], o.opacity ?? 1)
      const c = new THREE.Color(effective.color)
      const material = { name: PART_NAMES[k], color: [c.r, c.g, c.b, effective.opacity], roughness: effective.roughness, metallic: effective.metallic, doubleSided: false }
      if ((s.emissive || 0) > 0) {
        const glow = new THREE.Color(s.color), e = Math.max(1, s.emissive)
        material.emissive = [glow.r * s.emissive / e, glow.g * s.emissive / e, glow.b * s.emissive / e]
        material.emissiveStrength = e
      }
      const textureId = effective.mat?.params?.uAlbedo || effective.directTexture
      const img = textureId && ex.texture ? ex.texture(textureId) : null
      const bytes = buildMeshGLB({ name: PART_NAMES[k], positions: b.positions, normals: b.normals, indices: b.indices, uvs: b.uvs, imagePng: img?.bytes, material })
      const eid = ex.meshResource({ ...o, name: `${o.name}_${PART_NAMES[k].toLowerCase()}` }, bytes)
      kids.push({ name: PART_NAMES[k], type: null, props: o.castShadow === false ? ['cast_shadow = 0'] : [], instance: eid })
    }
    if (o.collision && r.collision.length) {
      const sh = ex.sub('ConcavePolygonShape3D', [`data = PackedVector3Array(${r.collision.map((v) => Number(v.toFixed(4))).join(', ')})`])
      kids.push({ name: 'Collision', type: 'CollisionShape3D', props: [`shape = SubResource("${sh}")`] })
      return { type: 'StaticBody3D', props: [], kids }
    }
    return { type: 'Node3D', props: [], kids }
  },
  'spawn': (o) => ({
    type: 'Marker3D',
    props: [`metadata/tag = ${q(o.props.tag || 'player')}`],
    extra: ' groups=["spawn_points"]',
  }),
  'text'(o, ex) {
    const p = o.props
    const geo = textGeometry(p)
    const b = textBuffers(geo, o.scale)
    const c = new THREE.Color(o.color)
    const e = new THREE.Color(p.neonColor)
    const E = Math.max(0, +p.neonEnergy || 0), strength = Math.max(1, E)
    const material = { name: 'Letras', color: [c.r, c.g, c.b, o.opacity ?? 1], roughness: o.roughness ?? 0.95, metallic: o.metallic ?? 0, doubleSided: false }
    if (p.neon) { material.emissive = [e.r * E / strength, e.g * E / strength, e.b * E / strength]; material.emissiveStrength = strength }
    const eid = ex.meshResource(o, buildMeshGLB({ name: o.name, positions: b.positions, normals: b.normals, indices: b.indices, material }))
    const kids = [{ name: 'Letras', type: null, props: o.castShadow ? [] : ['cast_shadow = 0'], instance: eid }]
    neonLights(o, geo.userData.box).forEach((w, i) => {
      if (w.type === 'spot') {
        kids.push({ name: `Neon_${i + 1}`, type: 'SpotLight3D', props: [`transform = Transform3D(-1, 0, 0, 0, 1, 0, 0, 0, -1, ${vec3(w.pos).slice(8, -1)})`, `light_color = ${col(p.neonColor)}`, `light_energy = ${flt(w.energy)}`, `spot_range = ${flt(w.range)}`, `spot_angle = ${flt(w.angle)}`] })
      } else {
        kids.push({ name: `Neon_${i + 1}`, type: 'OmniLight3D', props: [`transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, ${vec3(w.pos).slice(8, -1)})`, `light_color = ${col(p.neonColor)}`, `light_energy = ${flt(w.energy)}`, `omni_range = ${flt(w.range)}`] })
      }
    })
    if (o.collision && geo.userData.box) {
      const [bx, by, bz] = geo.userData.box
      const sh = ex.sub('BoxShape3D', [`size = ${vec3([bx * o.scale[0], by * o.scale[1], bz * o.scale[2]])}`])
      kids.push({ name: 'Collision', type: 'CollisionShape3D', props: [`shape = SubResource("${sh}")`] })
      return { type: 'StaticBody3D', props: [], kids }
    }
    return { type: 'Node3D', props: [], kids }
  },
  'trigger'(o, ex) {
    const sh = ex.sub('BoxShape3D', [`size = ${vec3(o.scale)}`])
    return {
      type: 'Area3D',
      props: [`metadata/tag = ${q(o.props.tag || 'zona')}`],
      extra: ' groups=["triggers"]',
      kids: [{ name: 'CollisionShape3D', type: 'CollisionShape3D', props: [`shape = SubResource("${sh}")`] }],
    }
  },
  'water'(o, ex) {
    const p = normalizeWaterNode(o.props)
    const b = waterShapeBuffers(p)
    if (!b.indices.length) return { type: 'Node3D', props: [] }
    const bytes = buildMeshGLB({ name: 'Water', positions: b.positions, normals: b.normals, indices: b.indices })
    const scene = ex.meshResource({ ...o, name: `${o.name}_agua` }, bytes)
    const loader = ex.script('material_loader.gd', ex.loaderCode)
    const img = p.texture && ex.texture ? ex.texture(p.texture) : null
    let tex = null
    if (img) tex = ex.ext('Texture2D', ex.fileRes(`assets/textures/${ex.slug(o.name)}_agua.png`, img.bytes))
    const custom = o.shaderCode // .gdshader propio del usuario (reemplaza al generado)
    const sh = ex.sub('Shader', [`code = ${JSON.stringify(custom || godotWaterShader(p, !!tex, ex.waterMap))}`])
    const mp = [`shader = SubResource("${sh}")`]
    if (tex && !custom) mp.push(`shader_parameter/water_tex = ExtResource("${tex}")`)
    if (ex.waterMap && !custom) mp.push(`shader_parameter/water_map = SubResource("${ex.waterMap.tex}")`)
    const mat = ex.sub('ShaderMaterial', mp)
    return { type: 'Node3D', props: [`script = ExtResource("${loader}")`, `scene = ExtResource("${scene}")`, `material = SubResource("${mat}")`] }
  },
}

/** Función de exportación de un tipo de nodo (o undefined si no tiene). */
export const godotNode = (type) => GODOT_NODES[type]
