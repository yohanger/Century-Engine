// Shaders y scripts de Godot que genera el exportador (.tscn). OBSOLETO: se conserva sin novedades.
// Viven fuera del Runtime: el Runtime no sabe de esta exportación. Misma matemática que el Runtime (waveSet, WMAP_MAXD…).
import { waveSet, srgb } from '../../engine/runtime/geometry/water.js'
import { WMAP_MAXD } from '../../engine/runtime/geometry/waterfx.js'

// ---------------------------------------------------------------------------------------------
// Shader de Godot (misma matemática)
// ---------------------------------------------------------------------------------------------
export function godotWaterShader(w, hasTex, wm = null) {
  const s = waveSet(w)
  const f = (n) => Number(n.toFixed(6))
  const arr = (list, pick) => `{ ${list.map(pick).join(', ')} }`
  const big = s.big, fine = s.fine
  return `shader_type spatial;
// Agua generada por Century: misma matemática que el editor. Todos los parámetros se pueden tocar en el inspector de Godot.

uniform vec3 shallow_color : source_color = vec3(${srgb(w.color).map(f).join(', ')});
uniform vec3 deep_color : source_color = vec3(${srgb(w.deepColor).map(f).join(', ')});
uniform float opacity : hint_range(0.0, 1.0) = ${f(w.opacity)};
uniform float roughness_value : hint_range(0.0, 1.0) = ${f(w.roughness)};
uniform float foam : hint_range(0.0, 1.0) = ${f(w.foam)};
uniform float faceted : hint_range(0.0, 1.0) = ${w.faceted ? 1 : 0};
uniform float wave_speed_scale = 1.0;
uniform float total_amp = ${f(big.reduce((a, o) => a + o.amp, 0) || 1)};
${wm ? `uniform sampler2D water_map : filter_linear, repeat_disable;
uniform float wm_size = ${f(wm.size)};
uniform float wm_maxd = ${f(wm.maxD)};
uniform float clarity = ${f(w.clarity)};
uniform float shore_foam : hint_range(0.0, 1.0) = ${f(w.shoreFoam)};
uniform float shore_width = ${f(w.shoreWidth)};` : ''}
uniform vec2 wind_dir = vec2(${f(Math.cos((w.windDir * Math.PI) / 180))}, ${f(Math.sin((w.windDir * Math.PI) / 180))});
${hasTex ? `uniform sampler2D water_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform float tex_mode = ${w.textureMode === 'normal' ? 2 : 1};
uniform float tex_scale = ${f(Math.max(0.1, w.textureScale))};
uniform float tex_speed = ${f(w.textureSpeed)};
uniform float tex_strength = ${f(w.textureStrength)};` : ''}

// dx, dz, k, amp  /  omega, fase
const vec4 BIG[3] = vec4[3](${big.map((o) => `vec4(${f(o.dx)}, ${f(o.dz)}, ${f(o.k)}, ${f(o.amp)})`).join(', ')});
const vec2 BIG_P[3] = vec2[3](${big.map((o) => `vec2(${f(o.om)}, ${f(o.ph)})`).join(', ')});
const vec4 FINE[3] = vec4[3](${fine.map((o) => `vec4(${f(o.dx)}, ${f(o.dz)}, ${f(o.k)}, ${f(o.amp)})`).join(', ')});
const vec2 FINE_P[3] = vec2[3](${fine.map((o) => `vec2(${f(o.om)}, ${f(o.ph)})`).join(', ')});

varying vec3 wpos;

vec3 waves(vec2 p, bool is_fine, out float h) {
	float hh = 0.0;
	vec2 g = vec2(0.0);
	for (int i = 0; i < 3; i++) {
		vec4 w = is_fine ? FINE[i] : BIG[i];
		vec2 q = is_fine ? FINE_P[i] : BIG_P[i];
		float ph = w.z * dot(w.xy, p) - q.x * wave_speed_scale * TIME + q.y;
		hh += w.w * sin(ph);
		g += w.w * w.z * cos(ph) * w.xy;
	}
	h = hh;
	return vec3(g.x, 0.0, g.y);
}

void vertex() {
	vec3 w0 = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float d = distance(w0, INV_VIEW_MATRIX[3].xyz);
	float h;
	waves(w0.xz, false, h);
	VERTEX.y += h * (1.0 - smoothstep(120.0, 400.0, d));
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	float hb;
	waves(wpos.xz, false, hb);
	float hn = clamp(hb / max(total_amp, 0.0001) * 0.5 + 0.5, 0.0, 1.0);
	vec3 alb = mix(deep_color, shallow_color, hn);
	float f = foam > 0.001 ? smoothstep(1.0 - 0.5 * foam, 1.0, hn) : 0.0;
	alb = mix(alb, vec3(1.0), f);
	float dist = distance(wpos, INV_VIEW_MATRIX[3].xyz);
	float a;
	vec3 g = waves(wpos.xz, false, a);
	float b;
	vec3 r = waves(wpos.xz, true, b);
	vec3 gg = g * (1.0 - 0.6 * smoothstep(200.0, 800.0, dist)) + r * (1.0 - smoothstep(60.0, 220.0, dist));
${hasTex ? `	vec2 uv = wpos.xz / tex_scale + wind_dir * TIME * tex_speed * wave_speed_scale;
	vec4 t = texture(water_tex, uv);
	if (tex_mode < 1.5) {
		alb = mix(alb, t.rgb, tex_strength);
	} else {
		vec3 tn = texture(water_tex, uv).xyz * 2.0 - 1.0;
		gg.xz += -tn.xy * tex_strength * (1.0 - smoothstep(60.0, 220.0, dist));
	}` : ''}
${wm ? `	float depth = 1000.0;
	{
		vec2 muv = wpos.xz / wm_size + 0.5;
		if (muv.x > 0.0 && muv.x < 1.0 && muv.y > 0.0 && muv.y < 1.0) {
			float ms = (texture(water_map, muv).r - 0.5) * 2.0;
			depth = max(sign(ms) * ms * ms * wm_maxd, 0.0);
		}
	}
	float dt = smoothstep(0.0, max(clarity, 0.05), depth);
	alb = mix(alb, mix(shallow_color, deep_color, dt), 0.75);
	float a0 = opacity * mix(0.55, 1.0, dt) * smoothstep(0.0, 0.25, depth);
	float sw = max(shore_width, 0.05);
	float sf = shore_foam * (1.0 - smoothstep(0.0, sw, depth)) * (0.6 + 0.4 * sin(depth / sw * 9.0 - TIME * 1.3 + hb / max(total_amp, 0.0001) * 3.0));
	alb = mix(alb, vec3(1.0), sf);
	float alpha_v = max(max(a0, f), sf * 0.85 * smoothstep(0.0, 0.03, depth));` : `	float alpha_v = max(opacity, f);`}
	vec3 n = normalize(vec3(-gg.x, 1.0, -gg.z));
	if (faceted > 0.5) {
		n = normalize(cross(dFdx(wpos), dFdy(wpos)));
		if (n.y < 0.0) n = -n;
	}
	NORMAL = normalize((VIEW_MATRIX * vec4(n, 0.0)).xyz);
	ALBEDO = alb;
	ALPHA = alpha_v;
	ROUGHNESS = roughness_value;
	METALLIC = 0.0;
}
`
}

// ------------------------------------------------------------------ Godot
/** Fragmento del shader del terreno de Godot. `rough` = rugosidad base. Mismo cálculo que arriba. */
export const godotTerrainFx = {
  uniforms: `uniform sampler2D water_map : filter_linear, repeat_disable;
uniform float wm_size = 64.0;
uniform float wm_maxd = ${WMAP_MAXD}.0;
uniform vec4 fx_a = vec4(0.6, 0.4, 0.5, 0.45); // banda mojada, oscurecer, brillo, absorción
uniform vec3 fx_tint : source_color = vec3(0.0);`,
  frag: `\tfloat wet_v = 0.0;
\t{
\t\tvec4 m = texture(water_map, lp.xz / wm_size + 0.5);
\t\tfloat s = (m.r - 0.5) * 2.0;
\t\tfloat d = sign(s) * s * s * wm_maxd;
\t\tfloat wet = m.g * (1.0 - smoothstep(0.0, fx_a.x, -d));
\t\tfloat under = m.g * smoothstep(0.0, 0.12, d);
\t\tcol *= 1.0 - fx_a.y * wet;
\t\tvec3 uw = mix(fx_tint, col, exp(-fx_a.w * max(d, 0.0)));
\t\tcol = mix(col, uw, under);
\t\twet_v = wet;
\t}`,
  rough: 'mix(0.95, 0.95 * (1.0 - 0.7 * fx_a.z), wet_v)',
}

/** Parámetro `fx_a` del shader de Godot (el color de fondo va aparte, como Color). */
export const godotFxVec4 = (fx) => `Vector4(${[fx.wfWetBand, fx.wfWetDarken, fx.wfWetGloss, fx.wfAbsorb].map((n) => Number(n.toFixed(4))).join(', ')})`

export const LIGHT_FX_GD = `@tool
extends Light3D
## Generado por Century: animación de la luz (vela, antorcha, pulso, neón, estrobo).
## Misma fórmula que el editor. Cambia style/speed/amount desde el inspector si quieres.
@export_enum("Fija","Vela","Antorcha","Pulso","Neón","Estrobo") var style: int = 1
@export var speed: float = 1.0
@export var amount: float = 0.5
@export var base_energy: float = 1.0
@export var phase: float = 0.0
@export var animate_in_editor: bool = false

func _fract(x: float) -> float:
	return x - floorf(x)

func _mult(t: float) -> float:
	var s := t * speed + phase
	match style:
		1:
			var n := 0.5 * sin(s * 7.1) + 0.3 * sin(s * 11.3 + 1.7) + 0.2 * sin(s * 23.7 + 0.4)
			return maxf(0.0, 1.0 + amount * 0.6 * n)
		2:
			var n := 0.4 * sin(s * 9.3) + 0.3 * sin(s * 17.1 + 2.1) + 0.2 * sin(s * 31.7 + 0.9) + 0.1 * sin(s * 53.3 + 4.0)
			return maxf(0.0, 1.0 + amount * 0.9 * n)
		3:
			return 1.0 - amount * (0.5 + 0.5 * sin(s * 6.2831853 * 0.5))
		4:
			var n := sin(s * 13.0) * sin(s * 7.3 + 1.0) * sin(s * 3.1 + 2.0)
			var hum := 0.03 * sin(s * 120.0)
			return maxf(0.0, (1.0 - amount if n > 0.45 else 1.0) + hum)
		5:
			return 1.0 if _fract(s) < 0.15 else 1.0 - amount
	return 1.0

func _process(_d: float) -> void:
	if Engine.is_editor_hint() and not animate_in_editor:
		light_energy = base_energy
		return
	light_energy = base_energy * _mult(Time.get_ticks_msec() / 1000.0)
`
