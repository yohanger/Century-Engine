// Fuentes de autocompletado sencillas (CodeMirror 6). El IntelliSense de JavaScript (tipos, hover, firmas, diagnósticos) está en jsintel.js;
// aquí quedan las directivas de las plantillas .ui y el GLSL de los shaders.
//   · scriptSources()    scripts de juego (cuerpo de una función async con `game`) y la pestaña Script de un .ui
//   · templateSource     plantilla de un .ui: directivas de Vue y expresiones ({{ … }}, v-*, :*, @*)
//   · glslSource         shaders de superficie (tipos, funciones, Surface, ayudas lf*, comentarios @param)
// La API de game.* sale de events/game-api.d.ts (misma fuente que VS Code); aquí no hay listas que mantener a mano.
import { snippetCompletion } from '@codemirror/autocomplete'
import { gameApi } from '../events/apiDocs.js'

const API = gameApi()
const WORD = /^[\w$]*$/

const option = (entry) => ({
  label: entry.name,
  type: entry.property ? 'property' : 'method',
  detail: entry.property ? 'propiedad' : 'método',
  info: `${entry.signature}${entry.description ? '\n\n' + entry.description : ''}`,
  boost: entry.property ? -1 : 0,
})

/** `game.` y `game.<propiedad>.` (viewModel, player, party…). `prefix` permite usar `game` bajo otro nombre. */
export function gameMembersSource(context) {
  const deep = context.matchBefore(/\bgame\.(\w+)\.[\w$]*/)
  if (deep && deep.to === context.pos) {
    const members = API.nested[/^game\.(\w+)\./.exec(deep.text)[1]]
    if (members) return { from: deep.from + deep.text.lastIndexOf('.') + 1, options: members.map(option), validFor: WORD }
  }
  const m = context.matchBefore(/\bgame\.[\w$]*/)
  if (!m || m.to !== context.pos) return null
  return { from: m.from + 5, options: API.top.map(option), validFor: WORD }
}

const JS_GLOBALS = [
  ['Math', 'Funciones matemáticas'], ['JSON', 'parse / stringify'], ['console', 'console.log(...) escribe en la consola del editor'],
  ['Array', ''], ['Object', ''], ['Number', ''], ['String', ''], ['Promise', ''], ['Date', ''], ['Map', ''], ['Set', ''],
  ['setTimeout', 'Prefiere await game.wait(segundos)'], ['parseInt', ''], ['parseFloat', ''], ['isNaN', ''],
].map(([label, info]) => ({ label, type: 'variable', detail: 'global', info: info || undefined, boost: -2 }))

function jsGlobalsSource(context) {
  const w = context.matchBefore(/(?<![.\w$])[A-Za-z_$][\w$]*/)
  if (!w || (w.from === w.to && !context.explicit)) return null
  return { from: w.from, options: JS_GLOBALS, validFor: WORD }
}

const SNIPPETS = [
  snippetCompletion('for (const ${item} of ${lista}) {\n\t${}\n}', { label: 'for…of', detail: 'bucle', type: 'keyword' }),
  snippetCompletion('for (let ${i} = 0; ${i} < ${n}; ${i}++) {\n\t${}\n}', { label: 'for', detail: 'bucle', type: 'keyword' }),
  snippetCompletion('while (${condición}) {\n\t${}\n\tawait game.wait(0)\n}', { label: 'while', detail: 'bucle con espera', type: 'keyword' }),
  snippetCompletion('if (${condición}) {\n\t${}\n}', { label: 'if', detail: 'condición', type: 'keyword' }),
  snippetCompletion('await game.wait(${1})', { label: 'wait', detail: 'esperar segundos', type: 'method' }),
  snippetCompletion('try {\n\t${}\n} catch (e) {\n\tconsole.error(e)\n}', { label: 'try', detail: 'try / catch', type: 'keyword' }),
]

/** Fuentes para scripts de juego. @deprecated Los editores usan jsintel.js (IntelliSense por tipos); se conserva por compatibilidad. */
export function scriptSources(extra = []) {
  return [gameMembersSource, jsGlobalsSource, (c) => { const w = c.matchBefore(/[\w$]+/); return w || c.explicit ? { from: w ? w.from : c.pos, options: SNIPPETS, validFor: WORD } : null }, ...extra]
}

// ---------- pestaña Script de un .ui ----------
const SETUP = [
  ['ref', 'ref(valor): estado reactivo simple'], ['reactive', 'reactive(objeto): estado reactivo'], ['computed', 'computed(() => …): valor derivado'],
  ['watch', 'watch(fuente, callback)'], ['watchEffect', 'watchEffect(() => …)'], ['onMounted', 'onMounted(() => …): al mostrarse la pantalla'],
  ['onUnmounted', 'onUnmounted(() => …): al cerrarse'], ['nextTick', 'nextTick(): espera al siguiente repintado'],
  ['onUpdate', 'onUpdate((dt) => …): cada fotograma'], ['props', 'Parámetros recibidos con game.ui.open(nombre, props)'],
  ['play', 'Estado del juego: dialog, choices, prompt, focus, fade…'], ['ui', 'Abrir y cerrar pantallas y Canvas'],
  ['close', 'close(resultado): cierra esta pantalla y devuelve el resultado'], ['call', 'call(nombre, ...args): equivale a game.call(nombre, ...args)'], ['asset', 'asset("nombre"): URL de un archivo del proyecto'],
  ['game', 'API completa del juego'],
].map(([label, info]) => ({ label, type: label === 'props' || label === 'game' || label === 'play' || label === 'ui' ? 'variable' : 'function', detail: 'pantalla .ui', info, boost: 1 }))
const PLAY = ['dialog', 'choices', 'prompt', 'focus', 'fade'].map((label) => ({ label, type: 'property', detail: 'play' }))
const UI_API = [
  ['open', 'ui.open(nombre, props?, { modal?, layer? }) → promesa con el resultado'], ['close', 'ui.close(nombre, resultado?)'], ['toggle', 'ui.toggle(nombre, props?)'],
  ['isOpen', 'ui.isOpen(nombre)'], ['closeAll', 'ui.closeAll()'], ['showCanvas', 'ui.showCanvas(nombre)'], ['hideCanvas', 'ui.hideCanvas(nombre)'],
  ['toggleCanvas', 'ui.toggleCanvas(nombre)'], ['isCanvasVisible', 'ui.isCanvasVisible(nombre)'], ['canvas', 'ui.canvas(nombre)'],
].map(([label, info]) => ({ label, type: 'method', detail: 'ui', info }))

function membersOf(name, list) {
  return (context) => {
    const m = context.matchBefore(new RegExp(`\\b${name}\\.[\\w$]*`))
    if (!m || m.to !== context.pos) return null
    return { from: m.from + name.length + 1, options: list, validFor: WORD }
  }
}
function setupNamesSource(context) {
  const w = context.matchBefore(/(?<![.\w$])[A-Za-z_$][\w$]*/)
  if (!w || (w.from === w.to && !context.explicit)) return null
  return { from: w.from, options: SETUP, validFor: WORD }
}
/** @deprecated Ver jsintel.js · jsIntelligence({ context: 'ui' }). */
export const uiScriptSources = () => scriptSources([setupNamesSource, membersOf('play', PLAY), membersOf('ui', UI_API)])

// ---------- plantilla de un .ui ----------
const DIRECTIVES = [
  ['v-if', 'Muestra el elemento si la expresión es verdadera'], ['v-else-if', ''], ['v-else', ''], ['v-for', 'v-for="item in lista"'], ['v-show', 'Oculta con CSS'],
  ['v-model', 'Enlace bidireccional con un campo'], ['v-html', 'HTML sin escapar'], ['v-text', ''], ['v-bind:', 'Enlaza un atributo (forma corta «:»)'],
  ['v-on:', 'Escucha un evento (forma corta «@»)'], [':class', 'Clases dinámicas'], [':style', 'Estilos dinámicos'], ['@click', 'Al hacer clic'], ['@mouseenter', ''], ['@mouseleave', ''],
  ['@keydown', ''], [':key', 'Clave única dentro de un v-for'],
].map(([label, info]) => ({ label, type: 'keyword', detail: 'directiva', info: info || undefined }))

/** Directivas al escribir dentro de una etiqueta y expresiones dentro de {{ }} o de atributos v-* / :* / @*. */
export function templateSource(context) {
  const line = context.state.doc.lineAt(context.pos)
  const before = line.text.slice(0, context.pos - line.from)
  const inMustache = /\{\{[^}]*$/.test(before)
  const inAttr = /\s(?:v-[\w:.-]+|:[\w.-]+|@[\w.-]+)="[^"]*$/.test(before)
  if (inMustache || inAttr) {
    // lo que va tras un punto (game.…, play.…, ui.…) lo resuelve el IntelliSense por tipos (jsintel.js · templateTypedSource)
    if (context.matchBefore(/\.[\w$]*$/)) return null
    const w = context.matchBefore(/(?<![.\w$])[A-Za-z_$][\w$]*/)
    if (!w || (w.from === w.to && !context.explicit)) return null
    return { from: w.from, options: [...SETUP.filter((o) => o.type === 'variable'), ...JS_GLOBALS], validFor: WORD }
  }
  const tag = context.matchBefore(/<[^<>]*\s([@:]|v-)?[\w:.-]*$/)
  if (tag) {
    const w = context.matchBefore(/(?:v-|[@:])?[\w:.-]*$/)
    if (w && (w.from < w.to || context.explicit)) return { from: w.from, options: DIRECTIVES, validFor: /^(?:v-|[@:])?[\w:.-]*$/ }
  }
  return null
}

// ---------- GLSL (shaders de superficie) ----------
const GLSL_TYPES = ['float', 'int', 'bool', 'void', 'vec2', 'vec3', 'vec4', 'ivec2', 'ivec3', 'ivec4', 'bvec2', 'bvec3', 'bvec4', 'mat2', 'mat3', 'mat4', 'sampler2D', 'Surface', 'Vertex']
const GLSL_KW = ['uniform', 'varying', 'const', 'in', 'out', 'inout', 'if', 'else', 'for', 'while', 'return', 'break', 'continue', 'discard', 'struct', 'true', 'false', 'precision', 'highp', 'mediump', 'lowp']
const GLSL_FN = [
  'radians', 'degrees', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'pow', 'exp', 'log', 'exp2', 'log2', 'sqrt', 'inversesqrt', 'abs', 'sign', 'floor', 'ceil', 'fract', 'mod', 'min', 'max', 'clamp', 'mix',
  'step', 'smoothstep', 'length', 'distance', 'dot', 'cross', 'normalize', 'reflect', 'refract', 'texture2D', 'texture', 'dFdx', 'dFdy', 'fwidth',
]
const LF_HELPERS = [
  ['rtTriplanar', 'vec4 rtTriplanar(sampler2D tex, vec3 p, vec3 n, float escala): proyección triplanar (escala = 1.0 / metros)'],
  ['rtTriplanarNormal', 'vec3 rtTriplanarNormal(sampler2D tex, vec3 p, vec3 n, float escala, float fuerza)'],
  ['rtToView', 'vec3 rtToView(vec3 n): normal a espacio de vista'], ['rtNoise', 'float rtNoise(vec3 p): ruido de valor 3D'], ['rtFbm', 'float rtFbm(vec3 p): ruido fractal (4 octavas)'], ['rtHash', 'float rtHash(vec3 p): hash 3D'],
]
const SURFACE = [
  ['albedo', 'vec3 · color base'], ['alpha', 'float · opacidad'], ['roughness', 'float · rugosidad'], ['metallic', 'float · metalicidad'], ['emissive', 'vec3 · emisión'], ['ao', 'float · oclusión ambiental'],
  ['normal', 'vec3 · normal en espacio de vista'], ['position', 'vec3 · posición de mapeo en metros'], ['mapNormal', 'vec3 · normal en el espacio de position'],
  ['worldPos', 'vec3 · posición en el mundo'], ['viewDir', 'vec3 · dirección hacia la cámara'], ['uv', 'vec2 · coordenadas de textura'], ['time', 'float · segundos'],
].map(([label, info]) => ({ label, type: 'property', detail: 'Surface', info }))
const VERTEX = [['position', 'vec3'], ['normal', 'vec3'], ['uv', 'vec2'], ['worldPos', 'vec3'], ['time', 'float']].map(([label, info]) => ({ label, type: 'property', detail: 'Vertex', info }))
const GLSL_OPTS = [
  ...GLSL_TYPES.map((label) => ({ label, type: 'type', boost: 1 })),
  ...GLSL_KW.map((label) => ({ label, type: 'keyword' })),
  ...GLSL_FN.map((label) => ({ label, type: 'function', detail: 'GLSL' })),
  ...LF_HELPERS.map(([label, info]) => ({ label, type: 'function', detail: 'Century', info, boost: 2 })),
  snippetCompletion('void surface(inout Surface s) {\n\t${}\n}', { label: 'surface', detail: 'función principal', type: 'function', boost: 3 }),
  snippetCompletion('uniform float ${uValor}; // @param label="${Valor}" min=0 max=1 step=0.01 default=0.5', { label: 'uniform float @param', detail: 'propiedad numérica', type: 'keyword', boost: 3 }),
  snippetCompletion('uniform vec3 ${uColor}; // @param label="${Color}" color default=#ffffff', { label: 'uniform color @param', detail: 'propiedad de color', type: 'keyword', boost: 3 }),
  snippetCompletion('uniform sampler2D ${uMapa}; // @param label="${Mapa}" srgb', { label: 'uniform sampler2D @param', detail: 'propiedad de textura', type: 'keyword', boost: 3 }),
  snippetCompletion('// @vertex begin\nvoid vertex(inout Vertex v) {\n\t${}\n}\n// @vertex end', { label: 'vertex', detail: 'etapa de vértices', type: 'function', boost: 3 }),
]
export function glslSource(context) {
  const mem = context.matchBefore(/\b([sv])\.[\w$]*/)
  if (mem && mem.to === context.pos) {
    const isV = mem.text[0] === 'v'
    return { from: mem.from + 2, options: isV ? VERTEX : SURFACE, validFor: WORD }
  }
  const dir = context.matchBefore(/\/\/\s*@[\w]*$/)
  if (dir) return { from: dir.from + dir.text.indexOf('@'), options: ['@name', '@description', '@param', '@vertex begin', '@vertex end'].map((label) => ({ label, type: 'keyword' })), validFor: /^@[\w ]*$/ }
  const w = context.matchBefore(/[\w$]+/)
  if (!w || (w.from === w.to && !context.explicit)) return null
  return { from: w.from, options: GLSL_OPTS, validFor: WORD }
}
