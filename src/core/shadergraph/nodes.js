// Catálogo de nodos del Shader Graph. Cada nodo declara sus puertos y cómo genera GLSL; el compilador (compile.js) los encadena.
//
//  def = { id, label, cat, in: [{ k, label, t, def? }], out: [{ k, label, t }], params?: [{ k, label, type, def, ... }], generic?: true, gen(a, p, c) }
//  · Tipos de puerto: float · vec2 · vec3 · vec4. 't: "T"' = genérico: toma la mayor dimensión de las entradas conectadas.
//  · Una entrada sin conectar usa su valor en línea (`node.v[k]`, por defecto `def`). `def` puede ser 'uv' | 'pos' | 'normal' | 'view' (expresiones del motor).
//  · `gen(a, p, c)` recibe las expresiones de entrada ya convertidas al tipo del puerto, los parámetros y el contexto { type, prop }, y devuelve
//    { [salida]: expresión GLSL } (o una sola expresión si el nodo tiene una única salida).
export const DIM = { float: 1, vec2: 2, vec3: 3, vec4: 4 }
export const TYPE_COLORS = { float: '#7ec4ff', vec2: '#8bd68b', vec3: '#ffd166', vec4: '#ff8fab' }
export const TYPE_BY_DIM = ['', 'float', 'vec2', 'vec3', 'vec4']

const F = (k, label, def = 0) => ({ k, label, t: 'float', def })
const T = (k, label, def = 0) => ({ k, label, t: 'T', def })
const O = (t, k = 'out', label = 'Salida') => ({ k, label, t })
const ONE = (e) => ({ out: e })

const defs = []
const add = (d) => { defs.push(d); return d }
const un = (id, label, fn, cat = 'Matemáticas') => add({ id, label, cat, generic: true, in: [T('a', 'A')], out: [O('T')], gen: (a) => ONE(`${fn}(${a.a})`) })
const bin = (id, label, op, cat = 'Matemáticas', defB = 1) => add({ id, label, cat, generic: true, in: [T('a', 'A', 0), T('b', 'B', defB)], out: [O('T')], gen: (a) => ONE(op.startsWith('(') ? op.replace('A', a.a).replace('B', a.b) : `${op}(${a.a}, ${a.b})`) })

// ---- Entradas
add({ id: 'sceneColor', label: 'Color de pantalla', cat: 'Pantalla', postOnly: true, in: [{ k: 'uv', label: 'UV', t: 'vec2', def: 'uv' }], out: [O('vec4', 'rgba', 'RGBA'), O('vec3', 'rgb', 'RGB')], gen: (a) => ({ rgba: `texture2D(tDiffuse, ${a.uv})`, rgb: `texture2D(tDiffuse, ${a.uv}).rgb` }) })
add({ id: 'reroute', label: 'Redirigir', cat: 'Organización', generic: true, in: [T('a', 'Entrada')], out: [O('T')], gen: (a) => ONE(a.a) })
add({ id: 'time', label: 'Tiempo', cat: 'Entrada', in: [], out: [O('float', 'out', 'Segundos')], gen: () => ONE('s.time') })
add({ id: 'uv', label: 'UV', cat: 'Entrada', in: [], out: [O('vec2')], gen: () => ONE('s.uv') })
add({ id: 'position', label: 'Posición (m)', cat: 'Entrada', in: [], out: [O('vec3')], gen: () => ONE('s.position') })
add({ id: 'worldPosition', label: 'Posición del mundo', cat: 'Entrada', in: [], out: [O('vec3')], gen: () => ONE('s.worldPos') })
add({ id: 'normal', label: 'Normal (mapeo)', cat: 'Entrada', in: [], out: [O('vec3')], gen: () => ONE('s.mapNormal') })
add({ id: 'viewDir', fragOnly: true, label: 'Dirección de vista', cat: 'Entrada', in: [], out: [O('vec3')], gen: () => ONE('s.viewDir') })
add({ id: 'float', label: 'Número', cat: 'Entrada', in: [], out: [O('float')], params: [{ k: 'v', label: 'Valor', type: 'number', def: 1, step: 0.05 }], gen: (a, p) => ONE(lit(p.v)) })
add({ id: 'vec2', label: 'Vector 2', cat: 'Entrada', in: [], out: [O('vec2')], params: [{ k: 'v', label: 'Valor', type: 'vec', n: 2, def: [0, 0] }], gen: (a, p) => ONE(`vec2(${p.v.map(lit).join(', ')})`) })
add({ id: 'vec3', label: 'Vector 3', cat: 'Entrada', in: [], out: [O('vec3')], params: [{ k: 'v', label: 'Valor', type: 'vec', n: 3, def: [0, 0, 0] }], gen: (a, p) => ONE(`vec3(${p.v.map(lit).join(', ')})`) })
add({ id: 'color', label: 'Color', cat: 'Entrada', in: [], out: [O('vec3')], params: [{ k: 'v', label: 'Color', type: 'color', def: '#ffffff' }], gen: (a, p) => { const c = hexRgb(p.v); return ONE(`vec3(${c.map(lit).join(', ')})`) } })
add({ id: 'property', label: 'Propiedad', cat: 'Entrada', in: [], out: [O('float')], params: [{ k: 'prop', label: 'Propiedad', type: 'prop', def: '' }], dynOut: 'prop', gen: (a, p, c) => ONE(c.prop ? c.prop.expr : '0.0') })

// ---- Matemáticas
bin('add', 'Sumar', '(A + B)', 'Matemáticas', 0)
bin('sub', 'Restar', '(A - B)', 'Matemáticas', 0)
bin('mul', 'Multiplicar', '(A * B)', 'Matemáticas', 1)
bin('div', 'Dividir', '(A / max(B, 1e-5))', 'Matemáticas', 1)
bin('pow', 'Potencia', 'pow', 'Matemáticas', 2)
bin('min', 'Mínimo', 'min', 'Matemáticas', 0)
bin('max', 'Máximo', 'max', 'Matemáticas', 0)
bin('mod', 'Módulo', 'mod', 'Matemáticas', 1)
un('abs', 'Absoluto', 'abs'); un('sqrt', 'Raíz cuadrada', 'sqrt'); un('floor', 'Redondear abajo', 'floor'); un('ceil', 'Redondear arriba', 'ceil'); un('fract', 'Parte fraccionaria', 'fract')
un('sin', 'Seno', 'sin', 'Trigonometría'); un('cos', 'Coseno', 'cos', 'Trigonometría'); un('sign', 'Signo', 'sign')
add({ id: 'negate', label: 'Negar', cat: 'Matemáticas', generic: true, in: [T('a', 'A')], out: [O('T')], gen: (a) => ONE(`(-${a.a})`) })
add({ id: 'oneMinus', label: 'Uno menos', cat: 'Matemáticas', generic: true, in: [T('a', 'A')], out: [O('T')], gen: (a, p, c) => ONE(`(${c.type}(1.0) - ${a.a})`) })
add({ id: 'saturate', label: 'Saturar (0–1)', cat: 'Matemáticas', generic: true, in: [T('a', 'A')], out: [O('T')], gen: (a) => ONE(`clamp(${a.a}, 0.0, 1.0)`) })
add({ id: 'clamp', label: 'Limitar', cat: 'Matemáticas', generic: true, in: [T('a', 'Valor'), F('lo', 'Mín', 0), F('hi', 'Máx', 1)], out: [O('T')], gen: (a) => ONE(`clamp(${a.a}, ${a.lo}, ${a.hi})`) })
add({ id: 'lerp', label: 'Mezclar (Lerp)', cat: 'Matemáticas', generic: true, in: [T('a', 'A', 0), T('b', 'B', 1), F('t', 'T', 0.5)], out: [O('T')], gen: (a) => ONE(`mix(${a.a}, ${a.b}, ${a.t})`) })
add({ id: 'step', label: 'Escalón', cat: 'Matemáticas', generic: true, in: [F('edge', 'Borde', 0.5), T('x', 'X')], out: [O('T')], gen: (a) => ONE(`step(${a.edge}, ${a.x})`) })
add({ id: 'smoothstep', label: 'Suavizado (smoothstep)', cat: 'Matemáticas', generic: true, in: [F('e0', 'Borde 0', 0), F('e1', 'Borde 1', 1), T('x', 'X', 0.5)], out: [O('T')], gen: (a) => ONE(`smoothstep(${a.e0}, ${a.e1}, ${a.x})`) })
add({ id: 'remap', label: 'Reasignar rango', cat: 'Matemáticas', in: [F('x', 'Valor', 0), F('a0', 'Entrada mín', 0), F('a1', 'Entrada máx', 1), F('b0', 'Salida mín', 0), F('b1', 'Salida máx', 1)], out: [O('float')], gen: (a) => ONE(`(${a.b0} + (${a.x} - ${a.a0}) * (${a.b1} - ${a.b0}) / max(${a.a1} - ${a.a0}, 1e-5))`) })

// ---- Vectores
add({ id: 'dot', label: 'Producto escalar', cat: 'Vectores', generic: true, in: [T('a', 'A', 0), T('b', 'B', 0)], out: [O('float')], gen: (a) => ONE(`dot(${a.a}, ${a.b})`) })
add({ id: 'length', label: 'Longitud', cat: 'Vectores', generic: true, in: [T('a', 'A', 0)], out: [O('float')], gen: (a) => ONE(`length(${a.a})`) })
add({ id: 'distance', label: 'Distancia', cat: 'Vectores', generic: true, in: [T('a', 'A', 0), T('b', 'B', 0)], out: [O('float')], gen: (a) => ONE(`distance(${a.a}, ${a.b})`) })
add({ id: 'normalize', label: 'Normalizar', cat: 'Vectores', generic: true, in: [T('a', 'A', 1)], out: [O('T')], gen: (a) => ONE(`normalize(${a.a})`) })
add({ id: 'cross', label: 'Producto vectorial', cat: 'Vectores', in: [{ k: 'a', label: 'A', t: 'vec3', def: [1, 0, 0] }, { k: 'b', label: 'B', t: 'vec3', def: [0, 1, 0] }], out: [O('vec3')], gen: (a) => ONE(`cross(${a.a}, ${a.b})`) })
add({ id: 'combine3', label: 'Combinar (Vec3)', cat: 'Vectores', in: [F('x', 'X'), F('y', 'Y'), F('z', 'Z')], out: [O('vec3')], gen: (a) => ONE(`vec3(${a.x}, ${a.y}, ${a.z})`) })
add({ id: 'combine2', label: 'Combinar (Vec2)', cat: 'Vectores', in: [F('x', 'X'), F('y', 'Y')], out: [O('vec2')], gen: (a) => ONE(`vec2(${a.x}, ${a.y})`) })
add({ id: 'split', label: 'Separar', cat: 'Vectores', in: [{ k: 'a', label: 'Vector', t: 'vec4', def: [0, 0, 0, 0] }], out: [O('float', 'x', 'X'), O('float', 'y', 'Y'), O('float', 'z', 'Z'), O('float', 'w', 'W')], gen: (a) => ({ x: `${a.a}.x`, y: `${a.a}.y`, z: `${a.a}.z`, w: `${a.a}.w` }) })

// ---- Procedurales
add({ id: 'noise', label: 'Ruido', cat: 'Procedural', in: [{ k: 'p', label: 'Posición', t: 'vec3', def: 'pos' }, F('scale', 'Escala (1/m)', 1)], out: [O('float')], gen: (a) => ONE(`rtNoise(${a.p} * ${a.scale})`) })
add({ id: 'fbm', label: 'Ruido fractal (FBM)', cat: 'Procedural', in: [{ k: 'p', label: 'Posición', t: 'vec3', def: 'pos' }, F('scale', 'Escala (1/m)', 1)], out: [O('float')], gen: (a) => ONE(`rtFbm(${a.p} * ${a.scale})`) })
add({ id: 'checker', label: 'Damero', cat: 'Procedural', in: [{ k: 'uv', label: 'UV', t: 'vec2', def: 'uv' }, F('scale', 'Casillas', 8)], out: [O('float')], gen: (a) => ONE(`mod(floor(${a.uv}.x * ${a.scale}) + floor(${a.uv}.y * ${a.scale}), 2.0)`) })
add({ id: 'fresnel', fragOnly: true, label: 'Fresnel', cat: 'Procedural', in: [F('power', 'Potencia', 2)], out: [O('float')], gen: (a) => ONE(`pow(1.0 - clamp(dot(s.normal, s.viewDir), 0.0, 1.0), max(${a.power}, 0.001))`) })
add({ id: 'tilingOffset', label: 'UV: repetir y desplazar', cat: 'Procedural', in: [{ k: 'uv', label: 'UV', t: 'vec2', def: 'uv' }, { k: 'tile', label: 'Repetición', t: 'vec2', def: [1, 1] }, { k: 'off', label: 'Desplazamiento', t: 'vec2', def: [0, 0] }], out: [O('vec2')], gen: (a) => ONE(`(${a.uv} * ${a.tile} + ${a.off})`) })

// ---- Texturas
add({ id: 'texture', fragOnly: true, label: 'Textura 2D', cat: 'Textura', in: [{ k: 'uv', label: 'UV', t: 'vec2', def: 'uv' }], out: [O('vec4', 'rgba', 'RGBA'), O('vec3', 'rgb', 'RGB'), O('float', 'a', 'A')], params: [{ k: 'prop', label: 'Textura', type: 'prop', only: 'texture', def: '' }],
  gen: (a, p, c) => { if (!c.prop) return { rgba: 'vec4(1.0)', rgb: 'vec3(1.0)', a: '1.0' }; const t = `(${c.prop.set} ? texture2D(${c.prop.uniform}, ${a.uv}) : vec4(1.0))`; return { rgba: t, rgb: `${t}.rgb`, a: `${t}.a` } } })
add({ id: 'triplanar', fragOnly: true, label: 'Textura triplanar', cat: 'Textura', in: [F('size', 'Tamaño (m)', 2)], out: [O('vec4', 'rgba', 'RGBA'), O('vec3', 'rgb', 'RGB')], params: [{ k: 'prop', label: 'Textura', type: 'prop', only: 'texture', def: '' }],
  gen: (a, p, c) => { if (!c.prop) return { rgba: 'vec4(1.0)', rgb: 'vec3(1.0)' }; const t = `(${c.prop.set} ? rtTriplanar(${c.prop.uniform}, s.position, s.mapNormal, 1.0 / max(${a.size}, 0.001)) : vec4(1.0))`; return { rgba: t, rgb: `${t}.rgb` } } })

add({ id: 'packedOrm', fragOnly: true, label: 'Textura ORM', cat: 'Textura',
  in: [{ k: 'uv', label: 'UV', t: 'vec2', def: 'uv' }],
  out: [O('float', 'ao', 'Oclusión · R'), O('float', 'roughness', 'Rugosidad · G'), O('float', 'metallic', 'Metálico · B')],
  params: [{ k: 'prop', label: 'Textura lineal', type: 'prop', only: 'texture', def: '' }],
  gen: (a, p, c) => {
    const sample = c.prop ? `(${c.prop.set} ? texture2D(${c.prop.uniform}, ${a.uv}).rgb : vec3(1.0, 1.0, 0.0))` : 'vec3(1.0, 1.0, 0.0)'
    return { ao: `${sample}.r`, roughness: `${sample}.g`, metallic: `${sample}.b` }
  },
})
add({ id: 'triplanarNormal', fragOnly: true, label: 'Mapa normal triplanar', cat: 'Textura',
  in: [F('size', 'Tamaño (m)', 2), F('strength', 'Intensidad', 1)], out: [O('vec3')],
  params: [{ k: 'prop', label: 'Mapa normal lineal', type: 'prop', only: 'texture', def: '' }],
  gen: (a, p, c) => ONE(c.prop
    ? `(${c.prop.set} ? rtToView(rtTriplanarNormal(${c.prop.uniform}, s.position, s.mapNormal, 1.0 / max(${a.size}, 0.001), max(${a.strength}, 0.0))) : s.normal)`
    : 's.normal'),
})

// ---- Salida (maestro)
export const MASTER_INPUTS = [
  { k: 'albedo', label: 'Albedo', t: 'vec3', target: 's.albedo' },
  { k: 'alpha', label: 'Alfa', t: 'float', target: 's.alpha' },
  { k: 'roughness', label: 'Rugosidad', t: 'float', target: 's.roughness' },
  { k: 'metallic', label: 'Metálico', t: 'float', target: 's.metallic' },
  { k: 'emissive', label: 'Emisión', t: 'vec3', target: 's.emissive' },
  { k: 'ao', label: 'Oclusión (AO)', t: 'float', target: 's.ao' },
  { k: 'normal', label: 'Normal (espacio de vista)', t: 'vec3', target: 's.normal' },
]
add({ id: 'surface', label: 'Superficie (salida)', cat: 'Salida', master: true, in: MASTER_INPUTS.map(({ k, label, t }) => ({ k, label, t, def: null })), out: [], gen: () => ({}) })

export const POST_INPUTS = [{ k: 'color', label: 'Color final', t: 'vec3', target: 'result.rgb' }, { k: 'alpha', label: 'Alfa', t: 'float', target: 'result.a' }]
add({ id: 'postOutput', label: 'Post Processing (salida)', cat: 'Salida', postOnly: true, master: true, in: POST_INPUTS.map(({ k, label, t }) => ({ k, label, t, def: null })), out: [], gen: () => ({}) })

export const VERTEX_INPUTS = [{ k: 'offset', label: 'Desplazamiento (m)', t: 'vec3', target: 'v.position', add: true }]
add({ id: 'vertex', label: 'Vértices (salida)', cat: 'Salida', master: true, optional: true, in: VERTEX_INPUTS.map(({ k, label, t }) => ({ k, label, t, def: [0, 0, 0] })), out: [], gen: () => ({}) })

export const NODE_DEFS = Object.fromEntries(defs.map((d) => [d.id, d]))
export const NODE_LIST = defs.filter((d) => !d.master)
export const VERTEX_NODE = defs.find((d) => d.id === 'vertex')
export const CATEGORIES = [...new Set(NODE_LIST.map((d) => d.cat))]

function lit(v) { const n = Number.isFinite(+v) ? +v : 0; const s = String(+n.toFixed(6)); return /[.e]/.test(s) ? s : s + '.0' }
function hexRgb(h) { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); const v = m ? parseInt(m[1], 16) : 0xffffff; return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255] }
export { lit, hexRgb }
