// Shader Graph → GLSL de material (`surface`) o de postprocesado (`ShaderPass`), sin duplicar el grafo. Puro: sin DOM ni three.
//
//  graph = { props: [{ id, name, label, type, def, min, max, step, srgb }], nodes: [{ id, type, x, y, v?, params? }], edges: [{ id, from: [nodeId, outKey], to: [nodeId, inKey] }] }
//  props.type: float · color · vec3 · bool · texture
import { NODE_DEFS, MASTER_INPUTS, VERTEX_INPUTS, POST_INPUTS, DIM, TYPE_BY_DIM, lit, hexRgb } from './nodes.js'
import { uid } from '../../engine/runtime/util.js'

export const PROP_TYPES = [['float', 'Número'], ['color', 'Color'], ['vec3', 'Vector 3'], ['bool', 'Sí / No'], ['texture', 'Textura']]
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d)
const idName = (s) => String(s || '').replace(/[^A-Za-z0-9_]/g, '')

export function newProp(type = 'float', name = '') {
  const base = name || { float: 'Valor', color: 'Color', vec3: 'Vector', bool: 'Activar', texture: 'Textura' }[type]
  const def = { float: 1, color: '#ffffff', vec3: [0, 0, 0], bool: false, texture: null }[type]
  return { id: uid('p'), name: base, label: base, type, def, ...(type === 'float' ? { min: 0, max: 4, step: 0.05 } : {}), ...(type === 'texture' ? { srgb: true } : {}) }
}
export function newNode(type, x = 0, y = 0, extra = {}) {
  const d = NODE_DEFS[type]
  const params = {}
  for (const p of d?.params || []) params[p.k] = Array.isArray(p.def) ? [...p.def] : p.def
  return { id: uid('n'), type, x, y, v: {}, params, ...extra }
}
export function newGraph(target = 'material') {
  const g = { target, props: [], nodes: [], edges: [] }
  if (target === 'post') {
    const out = newNode('postOutput', 540, 120), scene = newNode('sceneColor', 120, 120)
    g.nodes.push(out, scene)
    g.edges.push({ id: uid('e'), from: [scene.id, 'rgb'], to: [out.id, 'color'] })
    return g
  }
  const out = newNode('surface', 520, 120)
  const col = newNode('color', 120, 120, { params: { v: '#c8c8c8' } })
  g.nodes.push(out, col)
  g.edges.push({ id: uid('e'), from: [col.id, 'out'], to: [out.id, 'albedo'] })
  return g
}
/** Grafo de ejemplo: agua/neón pulsante con Fresnel. */
export function sampleGraph() {
  const g = { props: [], nodes: [], edges: [] }
  const pColor = newProp('color', 'Color'); pColor.def = '#2aa8ff'
  const pSpeed = newProp('float', 'Velocidad'); pSpeed.def = 2; pSpeed.max = 10
  g.props.push(pColor, pSpeed)
  const out = newNode('surface', 760, 80)
  const pc = newNode('property', 80, 40, { params: { prop: pColor.id } })
  const ps = newNode('property', 80, 200, { params: { prop: pSpeed.id } })
  const time = newNode('time', 80, 320)
  const mul = newNode('mul', 280, 260), sin = newNode('sin', 440, 260), mad = newNode('add', 600, 260, { v: { b: 1 } })
  const half = newNode('mul', 600, 380, { v: { b: 0.5 } }), fr = newNode('fresnel', 280, 400, { v: { power: 3 } })
  const em = newNode('mul', 600, 120)
  g.nodes.push(out, pc, ps, time, mul, sin, mad, half, fr, em)
  const E = (a, ak, b, bk) => g.edges.push({ id: uid('e'), from: [a.id, ak], to: [b.id, bk] })
  E(time, 'out', mul, 'a'); E(ps, 'out', mul, 'b'); E(mul, 'out', sin, 'a'); E(sin, 'out', mad, 'a'); E(mad, 'out', half, 'a')
  E(pc, 'out', out, 'albedo'); E(pc, 'out', em, 'a'); E(half, 'out', em, 'b'); E(em, 'out', out, 'emissive'); E(fr, 'out', out, 'metallic')
  return g
}

export function normalizeGraph(raw) {
  const g = { target: raw?.target === 'post' ? 'post' : 'material', props: [], nodes: [], edges: [] }
  const used = new Set()
  for (const p of Array.isArray(raw?.props) ? raw.props : []) {
    const type = PROP_TYPES.some((t) => t[0] === p?.type) ? p.type : 'float'
    const base = newProp(type, String(p?.name || 'Propiedad'))
    const o = { ...base, id: p?.id || base.id, label: String(p?.label || base.name) }
    if (type === 'float') { o.def = num(p?.def, 1); o.min = num(p?.min, 0); o.max = num(p?.max, 4); o.step = num(p?.step, 0.05) }
    else if (type === 'color') o.def = /^#[0-9a-f]{6}$/i.test(p?.def) ? p.def : '#ffffff'
    else if (type === 'vec3') o.def = Array.isArray(p?.def) && p.def.length === 3 ? p.def.map((x) => num(x)) : [0, 0, 0]
    else if (type === 'bool') o.def = !!p?.def
    else { o.def = null; o.srgb = p?.srgb !== false }
    o.name = idName(o.name) || 'Propiedad'
    let nm = o.name, i = 2; while (used.has(nm)) nm = o.name + i++
    o.name = nm; used.add(nm)
    g.props.push(o)
  }
  const ids = new Set()
  for (const n of Array.isArray(raw?.nodes) ? raw.nodes : []) {
    if (!NODE_DEFS[n?.type] || !n.id || ids.has(n.id)) continue
    ids.add(n.id)
    const base = newNode(n.type, num(n.x), num(n.y), { id: n.id })
    g.nodes.push({ ...base, v: { ...(n.v && typeof n.v === 'object' ? n.v : {}) }, params: { ...base.params, ...(n.params && typeof n.params === 'object' ? n.params : {}) } })
  }
  const masterType = g.target === 'post' ? 'postOutput' : 'surface'
  if (!g.nodes.some((n) => n.type === masterType)) { const master = newNode(masterType, 520, 120); g.nodes.push(master); ids.add(master.id) }
  const taken = new Set()
  for (const e of Array.isArray(raw?.edges) ? raw.edges : []) {
    if (!Array.isArray(e?.from) || !Array.isArray(e?.to) || !ids.has(e.from[0]) || !ids.has(e.to[0])) continue
    const key = e.to.join('>')
    if (taken.has(key)) continue
    const a = g.nodes.find((n) => n.id === e.from[0]), b = g.nodes.find((n) => n.id === e.to[0])
    if (!NODE_DEFS[a.type].out.some((o) => o.k === e.from[1]) || !NODE_DEFS[b.type].in.some((i) => i.k === e.to[1])) continue
    taken.add(key); g.edges.push({ id: e.id || uid('e'), from: [e.from[0], e.from[1]], to: [e.to[0], e.to[1]] })
  }
  return g
}

/** Convierte una expresión de un tipo a otro (ensancha con relleno o recorta). */
export function convert(expr, from, to) {
  if (from === to) return expr
  const a = DIM[from], b = DIM[to]
  if (a === 1) return `${to}(${expr})`
  if (b === 1) return `${expr}.x`
  if (b < a) return `${expr}.${'xyzw'.slice(0, b)}`
  const pad = b === 3 ? ['0.0'] : a === 2 ? ['0.0', '1.0'] : ['1.0']
  return `${to}(${expr}, ${pad.join(', ')})`
}

const uniformOf = (p) => 'u' + p.name
function propInfo(p) {
  if (!p) return null
  const u = uniformOf(p)
  const type = { float: 'float', color: 'vec3', vec3: 'vec3', bool: 'float', texture: 'tex' }[p.type]
  return { uniform: u, type, set: u + '_set', expr: p.type === 'bool' ? `(${u} ? 1.0 : 0.0)` : u }
}
function paramLine(p) {
  const u = uniformOf(p), lab = `label="${String(p.label || p.name).replace(/"/g, "'")}"`
  if (p.type === 'float') return `uniform float ${u}; // @param ${lab} min=${p.min} max=${p.max} step=${p.step} default=${p.def}`
  if (p.type === 'color') return `uniform vec3 ${u}; // @param ${lab} color default=${p.def}`
  if (p.type === 'vec3') return `uniform vec3 ${u}; // @param ${lab} default=${p.def.join(',')}`
  if (p.type === 'bool') return `uniform bool ${u}; // @param ${lab} default=${p.def}`
  return `uniform sampler2D ${u}; // @param ${lab}${p.srgb ? ' srgb' : ''}`
}

// Subconjunto GLSL de pantalla completa: no lee geometría, normales, texturas PBR ni ruido del motor.
export const POST_NODES = new Set(['sceneColor', 'reroute', 'time', 'uv', 'float', 'vec2', 'vec3', 'color', 'property',
  'add', 'sub', 'mul', 'div', 'pow', 'min', 'max', 'mod', 'abs', 'sqrt', 'floor', 'ceil', 'fract', 'sin', 'cos', 'sign',
  'negate', 'oneMinus', 'saturate', 'clamp', 'lerp', 'step', 'smoothstep', 'remap', 'dot', 'length', 'distance',
  'normalize', 'cross', 'combine2', 'combine3', 'split', 'checker', 'tilingOffset'])

/** → { code, errors: [{ node?, message }], order } */
export function compileGraph(graphIn, name = 'Shader Graph') {
  const g = normalizeGraph(graphIn)
  const errors = []
  const byId = new Map(g.nodes.map((n) => [n.id, n]))
  const edgeTo = new Map(g.edges.map((e) => [e.to.join('>'), e]))
  const props = new Map(g.props.map((p) => [p.id, p]))
  const usedProps = new Set()
  const runStage = (master, inputsDef, vertex) => {
    // orden topológico desde la salida (solo lo alcanzable); detecta ciclos
    const order = [], state = new Map()
    const visit = (n, path) => {
      const st = state.get(n.id)
      if (st === 2) return
      if (st === 1) { errors.push({ node: n.id, message: `Ciclo en el grafo (${[...path, n.type].join(' → ')})` }); return }
      state.set(n.id, 1)
      for (const i of NODE_DEFS[n.type].in) { const e = edgeTo.get(`${n.id}>${i.k}`); if (e) visit(byId.get(e.from[0]), [...path, n.type]) }
      state.set(n.id, 2); order.push(n)
    }
    visit(master, [])

    // tipos de salida y expresiones
    const outType = new Map(), lines = [], expr = new Map()
    const vname = (n, k) => `${vertex ? 'v' : 'n'}${order.indexOf(n)}_${k}`
    const inputExpr = (n, i, want) => {
      const e = edgeTo.get(`${n.id}>${i.k}`)
      if (e) { const src = byId.get(e.from[0]); const t = outType.get(`${src.id}>${e.from[1]}`); return { expr: convert(expr.get(`${src.id}>${e.from[1]}`), t, want || t), type: t, linked: true } }
      const d = n.v?.[i.k] ?? i.def
      const tt = want || (i.t === 'T' ? 'float' : i.t)
      if (d === 'uv') return { expr: convert('s.uv', 'vec2', tt), type: tt }
      if (d === 'pos') return { expr: convert('s.position', 'vec3', tt), type: tt }
      if (d === 'normal') return { expr: convert('s.mapNormal', 'vec3', tt), type: tt }
      if (d === 'view') return { expr: convert('s.viewDir', 'vec3', tt), type: tt }
      if (Array.isArray(d)) return { expr: convert(`${TYPE_BY_DIM[d.length]}(${d.map(lit).join(', ')})`, TYPE_BY_DIM[d.length], tt), type: tt }
      return { expr: tt === 'float' ? lit(d) : `${tt}(${lit(d)})`, type: tt }
    }
    for (const n of order) {
      const d = NODE_DEFS[n.type]
      if (d.master) continue
      if (g.target === 'post' && (d.master || d.postOnly ? false : !POST_NODES.has(n.type))) { errors.push({ node: n.id, message: `«${d.label}» no está disponible para postprocesado` }); continue }
      if (vertex && d.fragOnly) { errors.push({ node: n.id, message: `«${d.label}» solo funciona en la salida Superficie (no en Vértices)` }); continue }
      let gt = 'float'
      if (d.generic) { let dim = 1; for (const i of d.in) if (i.t === 'T') { const e = edgeTo.get(`${n.id}>${i.k}`); if (e) dim = Math.max(dim, DIM[outType.get(`${e.from[0]}>${e.from[1]}`)] || 1) } gt = TYPE_BY_DIM[dim] }
      const prop = d.params?.some((p) => p.type === 'prop') ? props.get(n.params.prop) : null
      let pi = propInfo(prop)
      if (d.params?.some((p) => p.type === 'prop')) {
        const want = d.params.find((p) => p.type === 'prop').only
        if (!prop) errors.push({ node: n.id, message: `«${d.label}»: elige una propiedad` })
        else if (want && pi.type !== 'tex') { errors.push({ node: n.id, message: `«${d.label}»: la propiedad debe ser una textura` }); pi = null }
        else if (!want && pi.type === 'tex') { errors.push({ node: n.id, message: `«${d.label}»: usa el nodo Textura 2D para texturas` }); pi = null }
        if (pi) usedProps.add(prop.id)
      }
      const a = {}
      for (const i of d.in) a[i.k] = inputExpr(n, i, i.t === 'T' ? gt : i.t).expr
      const res = d.gen(a, n.params || {}, { type: gt, prop: pi })
      const outs = d.out
      for (const o of outs) {
        const t = o.t === 'T' ? gt : d.dynOut ? (pi && pi.type !== 'tex' ? pi.type : 'float') : o.t
        outType.set(`${n.id}>${o.k}`, t)
        const name = vname(n, o.k)
        lines.push(`  ${t} ${name} = ${res[o.k]};`)
        expr.set(`${n.id}>${o.k}`, name)
      }
    }

    const assigns = []
    for (const mi of inputsDef) {
      const e = edgeTo.get(`${master.id}>${mi.k}`)
      if (!e) continue
      const src = byId.get(e.from[0]); const t = outType.get(`${src.id}>${e.from[1]}`)
      if (!t) continue
      assigns.push(`  ${mi.target} ${mi.add ? '+=' : '='} ${convert(expr.get(`${src.id}>${e.from[1]}`), t, mi.t)};`)
    }
      if (!assigns.length && !vertex) errors.push({ node: master.id, message: g.target === 'post' ? 'Conecta el color a Post Processing (salida)' : 'Conecta algo a la salida «Superficie»' }) // la salida de vértices vacía simplemente no hace nada
    return { lines, assigns, usedAny: assigns.length > 0 }
  }

  const master = g.nodes.find((n) => n.type === (g.target === 'post' ? 'postOutput' : 'surface'))
  if (g.target === 'post') {
    const stage = runStage(master, POST_INPUTS, false)
    const lines = [
      `// @name ${name}`, '// @post Shader Graph',
      'uniform sampler2D tDiffuse;', 'uniform float uTime;', 'uniform float uIntensity;',
      'varying vec2 vUv;', ...g.props.filter((p) => p.type !== 'texture').map(paramLine),
      'struct PostSurface { vec2 uv; float time; };', 'void main() {',
      '  PostSurface s; s.uv = vUv; s.time = uTime;',
      '  vec4 result = texture2D(tDiffuse, vUv);', ...stage.lines, ...stage.assigns,
      '  gl_FragColor = mix(texture2D(tDiffuse, vUv), result, clamp(uIntensity, 0.0, 1.0));', '}', '',
    ]
    return { code: lines.join('\n'), errors, graph: g, used: [...usedProps] }
  }
  const surf = runStage(master, MASTER_INPUTS, false)
  const vmaster = g.nodes.find((n) => n.type === 'vertex')
  const vert = vmaster ? runStage(vmaster, VERTEX_INPUTS, true) : null

  const propLines = g.props.map(paramLine)
  const vertexBlock = vert && vert.usedAny
    ? ['// @vertex begin', 'void vertex(inout Vertex v) {', '  Surface s; s.position = v.position; s.mapNormal = v.normal; s.normal = v.normal; s.worldPos = v.worldPos; s.uv = v.uv; s.time = v.time; s.viewDir = vec3(0.0, 0.0, 1.0);', ...vert.lines, ...vert.assigns, '}', '// @vertex end', '']
    : []
  const code = [`// @name ${name}`, '// @description Shader Graph (generado): edítalo con el editor de grafos; los cambios a mano se pierden.', ...propLines, '', ...vertexBlock, 'void surface(inout Surface s) {', ...surf.lines, ...surf.assigns, '}', ''].join('\n')
  return { code, errors, graph: g, used: [...usedProps] }
}
