// Capas y ciclos de importación de src/. Mantiene la arquitectura sana mientras el motor crece.
//
//  1. CICLOS: ningún ciclo de importación (estáticos ni dinámicos) que incluya algún .js. Sin excepciones. Los ciclos solo entre
//     componentes .vue son recursión legítima (un formulario dentro de otro) y solo se informan.
//  2. CAPAS: el motor (src/core, y src/engine cuando exista) no importa de la interfaz ni de las apps:
//       core → components/ · App.vue · filmmaker/ · runtime-app/       engine → editor/ · runtime-app/ · filmmaker/ · components/
//     RUNTIME ESTRICTO (B6): src/engine/runtime solo importa de src/engine/runtime y de terceros; sin lista base ni excepciones.
//  3. VUE en el motor: solo los archivos de la lista base (scripts/layers-baseline.json); igual con las capas de la regla 2.
//  4. DOM en el motor (document/window): solo los archivos de la lista base.
//  5. RUNTIME EXPORTADO (src/runtime-app/main.js): no alcanza, por imports estáticos, las herramientas del editor (edición de mallas, comandos,
//     captura, Film Maker, componentes) y su tamaño alcanzable (líneas) no crece respecto a la lista base. Las herramientas del editor
//     se registran en src/main.js (core/tools.js), no se importan desde el motor.
// Las reglas 3 y 4 son una LISTA BASE: lo que ya existía se tolera, lo NUEVO falla. Al arreglar un archivo, sácalo de la lista
// (el informe avisa de las entradas ya obsoletas). Objetivo de la fase F5: la lista vacía.
//
// Uso: node scripts/check-layers.mjs            informe
//      node scripts/check-layers.mjs --check    falla (código 1) si hay ciclos o violaciones nuevas
//      node scripts/check-layers.mjs --update   reescribe la lista base con lo que hay ahora (solo para registrar una excepción consciente)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')
const BASE_FILE = path.join(ROOT, 'scripts', 'layers-baseline.json')
const rel = (f) => path.relative(SRC, f).split(path.sep).join('/')

function* walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) yield* walk(p)
    else if (/\.(js|mjs|vue)$/.test(p)) yield p
  }
}
const files = [...walk(SRC)]
const exists = (p) => { try { return fs.statSync(p).isFile() } catch { return false } }
function resolveImport(from, spec) {
  if (!spec.startsWith('.')) return null // paquetes (three, vue…): no son del proyecto
  const base = path.resolve(path.dirname(from), spec)
  for (const c of [base, base + '.js', base + '.vue', base + '.mjs', path.join(base, 'index.js')]) if (exists(c)) return c
  return null
}
const scriptOf = (f, src) => (f.endsWith('.vue') ? (/<script[^>]*>([\s\S]*?)<\/script>/.exec(src)?.[1] ?? '') : src)
// primero los `//` (un comentario de línea puede contener «/*», p. ej. «Scripts/*.js») y después los bloques
const stripComments = (s) => s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '')

const graph = new Map(), vueUsers = new Set(), domUsers = new Set()
for (const f of files) {
  const raw = fs.readFileSync(f, 'utf8')
  const code = stripComments(scriptOf(f, raw))
  const deps = new Set()
  for (const m of code.matchAll(/(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g)) { const r = resolveImport(f, m[1]); if (r) deps.add(r) }
  for (const m of code.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) { const r = resolveImport(f, m[1]); if (r) deps.add(r) }
  graph.set(f, deps)
  if (/(?:from|import)\s*['"]vue['"]|import\(\s*['"]vue['"]\s*\)/.test(code)) vueUsers.add(rel(f))
  if (/\b(document|window)\./.test(code)) domUsers.add(rel(f))
}

// ---- 1. ciclos (Tarjan) ----
function cycles() {
  let idx = 0
  const st = [], on = new Set(), ix = new Map(), low = new Map(), out = []
  const visit = (v) => {
    ix.set(v, idx); low.set(v, idx); idx++; st.push(v); on.add(v)
    for (const w of graph.get(v) || []) {
      if (!graph.has(w)) continue
      if (!ix.has(w)) { visit(w); low.set(v, Math.min(low.get(v), low.get(w))) } else if (on.has(w)) low.set(v, Math.min(low.get(v), ix.get(w)))
    }
    if (low.get(v) === ix.get(v)) {
      const comp = []
      let w
      do { w = st.pop(); on.delete(w); comp.push(w) } while (w !== v)
      if (comp.length > 1 || graph.get(v)?.has(v)) out.push(comp.map(rel).sort())
    }
  }
  for (const v of graph.keys()) if (!ix.has(v)) visit(v)
  return out
}
const allCyc = cycles()
const cyc = allCyc.filter((c) => c.some((f) => !f.endsWith('.vue')))
const vueCyc = allCyc.filter((c) => c.every((f) => f.endsWith('.vue')))

// ---- 2. capas ----
const FORBIDDEN = [
  { from: /^(core|engine)\//, to: /^(components\/|App\.vue$|filmmaker\/|runtime-app\/)/, why: 'el motor no importa interfaz ni apps' },
  { from: /^engine\//, to: /^editor\//, why: 'engine no importa editor' },
  // Runtime autónomo (fase B): la escena y el juego no conocen el editor ni su estado; reciben el proyecto por `host`.
  // Regla estricta (B6): el Runtime solo importa del propio Runtime y de terceros (three, vue…). Sin excepciones ni lista base.
  { from: /^engine\/runtime\//, to: /^(?!engine\/runtime\/)/, why: 'engine/runtime solo importa de engine/runtime y terceros' },
]
const layerAll = []
for (const [f, deps] of graph) for (const d of deps) for (const r of FORBIDDEN) if (r.from.test(rel(f)) && r.to.test(rel(d))) layerAll.push(`${rel(f)} → ${rel(d)}`)

// ---- 3 y 4: lista base ----
const inEngine = (r) => /^(core|engine)\//.test(r)
// ---- 5. lo que alcanza el Runtime exportado ----
function reachFrom(entry) {
  const seen = new Set([entry]), q = [entry]
  while (q.length) {
    const f = q.pop()
    const raw = fs.readFileSync(f, 'utf8'), code = stripComments(scriptOf(f, raw)), out = new Set()
    for (const m of code.matchAll(/(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g)) { const r = resolveImport(f, m[1]); if (r) out.add(r) } // solo estáticos: los dinámicos son carga diferida
    for (const d of out) if (!seen.has(d)) { seen.add(d); q.push(d) }
  }
  return seen
}
const RUNTIME_ENTRY = path.join(SRC, 'runtime-app', 'main.js')
const RUNTIME_FORBIDDEN = /^(tools-register\.js|core\/(mesh\/(session|ops|sel|cuts|bevel)\.js|commands\.js|capture\/(index|timeline|edit|camera|retarget|simulate|format|math)\.js|vscode\/)|engine\/.*editor|filmmaker\/|components\/(?!UiRoot|PerfPanel))/
const pReach = exists(RUNTIME_ENTRY) ? [...reachFrom(RUNTIME_ENTRY)] : []
const runtimeLines = pReach.reduce((a, f) => a + fs.readFileSync(f, 'utf8').split('\n').length, 0)
const runtimeLeaks = pReach.map(rel).filter((r) => RUNTIME_FORBIDDEN.test(r)).sort()
// Adaptadores de plataforma: acceso directo a DOM/APIs del navegador que NO es deuda (cada uno con su motivo). El resto del motor pasa por core/platform.js.
const PLATFORM = {
  'engine/runtime/platform.js': 'la puerta única a document/window',
  'engine/runtime/audio/engine.js': 'Web Audio: AudioContext y desbloqueo con el primer gesto',
  'core/disk.js': 'File System Access API / puente de archivos de Electron',
  'core/desktop.js': 'puente del EDITOR con Electron (window.lf); antes vivía en engine/runtime/platform.js y el Runtime no debe conocerlo',
  'core/tooltips.js': 'ayuda emergente del editor (DOM puro)',
  'engine/runtime/render/viewport.js': 'el lienzo WebGL, su tamaño y sus eventos',
  'engine/runtime/render/viewport-nav.js': 'parte de viewport.js: teclado, ratón y mando sobre el lienzo (navegación de la vista)',
}
// Vue permitido por diseño: la interfaz del juego se dibuja con Vue (render functions y ciclo de vida), el resto de core usa @vue/reactivity.
const VUE_OK = { 'engine/runtime/ui/components.js': 'componentes de la interfaz del juego (h, inject)', 'engine/runtime/ui/manager.js': 'gestor de la interfaz del juego (ciclo de vida de Vue)', 'engine/runtime/ui/UiRoot.vue': 'raíz de la interfaz del juego (la dibuja con Vue)' }
const nowVue = [...vueUsers].filter((f) => inEngine(f) && !VUE_OK[f]).sort(), nowDom = [...domUsers].filter((f) => inEngine(f) && !PLATFORM[f]).sort()
const baseline = exists(BASE_FILE) ? JSON.parse(fs.readFileSync(BASE_FILE, 'utf8')) : { vue: [], dom: [], layers: [], runtimeLeaks: [], runtimeLines: 0 }

const newVue = nowVue.filter((f) => !baseline.vue.includes(f)), newDom = nowDom.filter((f) => !baseline.dom.includes(f))
const layerViolations = layerAll.filter((v) => !(baseline.layers || []).includes(v)), staleLayers = (baseline.layers || []).filter((v) => !layerAll.includes(v))
const staleVue = baseline.vue.filter((f) => !nowVue.includes(f)), staleDom = baseline.dom.filter((f) => !nowDom.includes(f))

const newLeaks = runtimeLeaks.filter((f) => !(baseline.runtimeLeaks || []).includes(f))
const overBudget = baseline.runtimeLines && runtimeLines > baseline.runtimeLines
// Tamaño: un archivo grande mezcla responsabilidades y no escala. Tope duro de MAX_LINES; lo que ya lo superaba se tolera en `sizes` sin poder crecer.
const MAX_LINES = 600, SOFT_LINES = 500
const lineCount = (f) => fs.readFileSync(f, 'utf8').split('\n').length
const sizeNow = Object.fromEntries(files.map((f) => [rel(f), lineCount(f)]))
const bigNow = Object.entries(sizeNow).filter(([, n]) => n > MAX_LINES)
if (process.argv.includes('--update')) {
  fs.writeFileSync(BASE_FILE, JSON.stringify({ _: 'Excepciones toleradas por scripts/check-layers.mjs. Objetivo: vacío (fase F5). Quita una entrada cuando arregles el archivo.', vue: nowVue, dom: nowDom, layers: layerAll.sort(), runtimeLeaks, runtimeLines, sizes: Object.fromEntries(bigNow) }, null, 2) + '\n')
  console.log(`lista base escrita: ${nowVue.length} con vue, ${nowDom.length} con document/window`); process.exit(0)
}
const bigBase = baseline.sizes || {}
const bigBad = bigNow.filter(([f, n]) => !(f in bigBase) || n > bigBase[f])
const bigStale = Object.keys(bigBase).filter((f) => !(sizeNow[f] > MAX_LINES))
const soft = Object.entries(sizeNow).filter(([f, n]) => n > SOFT_LINES && n <= MAX_LINES).sort((a, b) => b[1] - a[1])
const problems = bigBad.length + newLeaks.length + (overBudget ? 1 : 0) + cyc.length + layerViolations.length + newVue.length + newDom.length
console.log(`${files.length} archivos · ${[...graph.values()].reduce((a, s) => a + s.size, 0)} importaciones`)
console.log(`ciclos: ${cyc.length}${cyc.map((c) => '\n  ✗ ' + c.join(' ⇄ ')).join('')}`)
console.log(`capas prohibidas: ${layerAll.length} (base ${(baseline.layers || []).length})${layerViolations.map((v) => '\n  ✗ NUEVA ' + v).join('')}`)
for (const c of vueCyc) console.log(`  · recursión entre componentes (ok): ${c.join(' ⇄ ')}`)
console.log(`vue en el motor: ${nowVue.length} (base ${baseline.vue.length})${newVue.map((v) => '\n  ✗ NUEVO ' + v).join('')}`)
console.log(`archivos de más de ${MAX_LINES} líneas: ${bigNow.length}${bigBad.map(([f, n]) => `\n  ✗ ${f}: ${n} líneas (parte el archivo por responsabilidad: un mixin o un módulo nuevo)`).join('')}`)
if (soft.length) console.log(`  · cerca del tope (>${SOFT_LINES}): ${soft.map(([f, n]) => `${f.split('/').pop()} ${n}`).join(', ')}`)
for (const f of bigStale) console.log(`  · ya no pasa del tope (quítalo de sizes en la lista base): ${f}`)
console.log(`document/window en el motor: ${nowDom.length} (base ${baseline.dom.length})${newDom.map((v) => '\n  ✗ NUEVO ' + v).join('')}`)
if (process.env.LIST) console.log(pReach.map(rel).join("\n"))
console.log(`Runtime exportado: ${pReach.length} archivos, ${runtimeLines} líneas alcanzables (base ${baseline.runtimeLines || '—'})${newLeaks.map((f) => '\n  ✗ NUEVA herramienta del editor en el juego: ' + f).join('')}${overBudget ? '\n  ✗ el Runtime exportado crece por encima de la base' : ''}`)
for (const v of staleLayers) console.log(`  · ya no importa (quítalo de la lista base): ${v}`)
for (const f of staleVue) console.log(`  · ya no usa vue (quítalo de la lista base): ${f}`)
for (const f of staleDom) console.log(`  · ya no usa document/window (quítalo de la lista base): ${f}`)
if (process.argv.includes('--check')) {
  if (problems) { console.error(`✗ ${problems} problema(s) de arquitectura`); process.exit(1) }
  console.log('✓ sin ciclos ni violaciones nuevas de capas')
}
