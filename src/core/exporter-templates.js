// Exportación de nivel · plantillas de script de los cargadores (vegetación y terreno) y shader del terreno, como texto.

// ---------------------------------------------------------------------------------------------
// Vegetación
// ---------------------------------------------------------------------------------------------
export const FOLIAGE_LOADER = (dataPath) => `@tool
extends Node3D
## Crea un MultiMeshInstance3D por cada malla de cada tipo de vegetación descrito en foliage.json.
## Generado por Century: vuelve a exportar para actualizarlo (puedes editar este script con libertad).

@export_file("*.json") var data_path := "${dataPath}"
## Distancia máxima a la que se dibuja (0 = sin límite). Útil para hierba densa.
@export var draw_distance := 0.0
@export var cast_shadows := true
@export var rebuild := false:
	set(v):
		rebuild = false
		if is_inside_tree(): build()

func _ready() -> void:
	build()

func build() -> void:
	for c in get_children():
		remove_child(c)
		c.queue_free()
	var f := FileAccess.open(data_path, FileAccess.READ)
	if f == null:
		push_warning("Foliage: no se pudo abrir " + data_path)
		return
	var data = JSON.parse_string(f.get_as_text())
	if typeof(data) != TYPE_DICTIONARY:
		return
	for t in data.get("types", []):
		var scene := load(t.scene) as PackedScene
		if scene == null:
			push_warning("Foliage: falta " + str(t.scene))
			continue
		var tr := PackedFloat32Array(t.transforms)
		var n := tr.size() / 12
		var inst := scene.instantiate()
		var parts: Array = []
		_collect(inst, Transform3D.IDENTITY, parts)
		var k := 0
		for p in parts:
			var mm := MultiMesh.new()
			mm.transform_format = MultiMesh.TRANSFORM_3D
			mm.mesh = p.mesh
			if t.get("vertex_colors", false):
				var m := ShaderMaterial.new()
				m.shader = _color_shader()
				m.set_shader_parameter("tint", Color(str(t.get("tint", "#ffffff"))))
				mm.mesh = (p.mesh as Mesh).duplicate()
				mm.mesh.surface_set_material(0, m)
			mm.instance_count = n
			for i in n:
				var o := i * 12
				var b := Basis(Vector3(tr[o], tr[o + 1], tr[o + 2]), Vector3(tr[o + 3], tr[o + 4], tr[o + 5]), Vector3(tr[o + 6], tr[o + 7], tr[o + 8]))
				mm.set_instance_transform(i, Transform3D(b, Vector3(tr[o + 9], tr[o + 10], tr[o + 11])) * p.xf)
			var mi := MultiMeshInstance3D.new()
			mi.name = "%s_%d" % [str(t.name).validate_node_name(), k]
			mi.multimesh = mm
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if (cast_shadows and t.get("shadows", true)) else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			if draw_distance > 0.0:
				mi.visibility_range_end = draw_distance
			add_child(mi)
			k += 1
		inst.free()

var _shader: Shader
func _color_shader() -> Shader:
	if _shader == null:
		_shader = Shader.new()
		_shader.code = "shader_type spatial;\\nrender_mode cull_disabled;\\nuniform vec4 tint : source_color = vec4(1.0);\\nvoid fragment() {\\n\\tALBEDO = COLOR.rgb * tint.rgb;\\n\\tROUGHNESS = 0.9;\\n}\\n"
	return _shader

func _collect(n: Node, acc: Transform3D, out: Array) -> void:
	var xf := acc
	if n is Node3D:
		xf = acc * (n as Node3D).transform
	if n is MeshInstance3D and (n as MeshInstance3D).mesh != null:
		out.append({"mesh": (n as MeshInstance3D).mesh, "xf": xf})
	for c in n.get_children():
		_collect(c, xf, out)
`

export const TERRAIN_LOADER = `@tool
extends Node3D
## Muestra terrain.glb con el material de capas (splat) generado por Century.
## Generado por Century: vuelve a exportar para actualizarlo.

@export var scene: PackedScene
@export var material: Material

func _ready() -> void:
	build()

func build() -> void:
	for c in get_children():
		remove_child(c)
		c.queue_free()
	if scene == null:
		return
	var inst := scene.instantiate()
	_apply(inst)
	add_child(inst)

func _apply(n: Node) -> void:
	if n is MeshInstance3D:
		(n as MeshInstance3D).material_override = material
	for c in n.get_children():
		_apply(c)
`

/** Shader del terreno: mezcla hasta 8 capas (color o textura) según los pesos de dos texturas «splat». */
export function terrainShader(hasTex) {
  const n = hasTex.length
  const u = []
  for (let i = 0; i < n; i++) {
    u.push(`uniform vec4 color_${i} : source_color = vec4(1.0);`, `uniform float tile_${i} = 4.0;`)
    if (hasTex[i]) u.push(`uniform sampler2D tex_${i} : source_color, filter_linear_mipmap_anisotropic, repeat_enable;`)
  }
  const wl = ['a.r', 'a.g', 'a.b', 'a.a', 'b.r', 'b.g', 'b.b', 'b.a']
  const body = []
  for (let i = 0; i < n; i++) {
    const c = hasTex[i] ? `texture(tex_${i}, lp.xz / tile_${i}).rgb` : `color_${i}.rgb`
    body.push(`\tsum += ${wl[i]}; col += ${wl[i]} * ${c};`)
  }
  return `shader_type spatial;
uniform sampler2D splat_a : filter_linear, repeat_disable;
uniform sampler2D splat_b : filter_linear, repeat_disable;
uniform float terrain_size = 64.0;
uniform float grid = 129.0;
${u.join('\n')}
varying vec3 lp;

void vertex() {
\tlp = VERTEX;
}

void fragment() {
\tvec2 uv = (lp.xz / terrain_size + 0.5) * (grid - 1.0) / grid + 0.5 / grid;
\tvec4 a = texture(splat_a, uv);
\tvec4 b = texture(splat_b, uv);
\tfloat sum = 0.0;
\tvec3 col = vec3(0.0);
${body.join('\n')}
\tcol = col / max(sum, 0.001);
\tALBEDO = col;
\tROUGHNESS = 0.95;
}
`
}
