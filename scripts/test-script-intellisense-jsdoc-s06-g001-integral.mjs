// QA S06: contratos JSDoc sobre el motor real de LevelForge, sin navegador.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createTypeEngine } from '../src/core/editor/types.js'
import { jsdocContext, jsdocLiteralDiagnostics } from '../src/core/editor/types-jsdoc.js'
import { createAnalysis, CONTEXTS } from '../src/core/editor/analysis.js'

const dts = readFileSync(new URL('../src/core/events/game-api.d.ts', import.meta.url), 'utf8')
const engine = createTypeEngine(dts)
const analysis = createAnalysis(dts)
const ctx = (source, at = source.length, roots = CONTEXTS.script) => engine.contextAt(source, at, roots)
const members = (expr, source, at = source.length) => engine.membersAfter(expr, ctx(source, at))?.list.map(m => m.name) || []
const T = '/** @type {{ vida: number, nombre: string }} */\nconst jugador = {}\njugador.'

 test('JSDOC-01 · @type resuelve propiedades de objeto inline', () => assert.deepEqual(members('jugador', T), ['vida','nombre']))
 test('JSDOC-02 · @typedef + @property registra un objeto local', () => {
  const src = '/**\n * @typedef {Object} Personaje\n * @property {number} vida\n * @property {string} nombre\n */\n/** @type {Personaje} */\nconst jugador = {}\njugador.'
  assert.deepEqual(members('jugador', src), ['vida','nombre'])
 })
 test('JSDOC-03 · @typedef con objeto inline acepta anidamiento', () => {
  const src = '/** @typedef {{ perfil: { nombre: string }, vida: number }} Ficha */\n/** @type {Ficha} */\nlet ficha = {}\nficha.'
  assert.deepEqual(members('ficha', src), ['perfil','vida'])
  assert.deepEqual(members('ficha.perfil', src), ['nombre'])
 })
 test('JSDOC-04 · @property opcional mantiene el signo ?', () => {
  const src = '/** @typedef {Object} Ficha\n * @property {string} [alias]\n */\n/** @type {Ficha} */\nconst ficha = {}\nficha.'
  assert.equal(engine.membersAfter('ficha', ctx(src))?.list[0]?.entries?.[0]?.optional, true)
 })
 test('JSDOC-05 · @type puede anotar una variable sin inicializador', () => {
  const src = '/** @type {NodeHandle} */\nlet objetivo;\nobjetivo.'
  assert.ok(members('objetivo', src).length > 3)
 })
 test('JSDOC-06 · referencias a tipos de game-api.d.ts no cambian las raíces', () => {
  const src = '/** @type {NodeHandle} */\nconst objetivo = game.node("Puerta");\nobjetivo.'
  assert.ok(members('objetivo', src).length > 3)
  assert.ok(members('game', src).length > 10)
 })
 test('JSDOC-07 · @param dentro de función tipa el parámetro', () => {
  const src = '/** @param {{ vida: number, nombre: string }} pj */\nfunction curar(pj) {\n pj.'
  assert.deepEqual(members('pj', src), ['vida','nombre'])
 })
 test('JSDOC-08 · @param funciona con una función flecha declarada', () => {
  const src = '/** @param {{ vida: number }} pj */\nconst curar = (pj) => {\n pj.'
  assert.deepEqual(members('pj', src), ['vida'])
 })
 test('JSDOC-09 · @returns tipa el valor devuelto por una función', () => {
  const src = '/** @returns {{ vida: number, nombre: string }} */\nfunction crear() { return {} }\ncrear().'
  assert.deepEqual(members('crear()', src), ['vida','nombre'])
 })
 test('JSDOC-10 · @param/@returns producen firmas reales para ayuda contextual', () => {
  const src = '/** @param {string} nombre\n * @returns {boolean} */\nfunction existe(nombre) { return true }\nexiste('
  const sig = analysis.signatureAt(src,src.length,CONTEXTS.script)
  assert.equal(sig?.entries?.[0]?.params?.[0]?.type,'string')
  assert.equal(sig?.entries?.[0]?.ret,'boolean')
 })
 test('JSDOC-11 · @returns y @typedef pueden combinarse', () => {
  const src = '/** @typedef {{ estado: string }} Estado */\n/** @returns {Estado} */\nfunction crear() { return {} }\ncrear().'
  assert.deepEqual(members('crear()', src), ['estado'])
 })
 test('JSDOC-12 · tipos de argumentos funcionan en modo Nodo', () => {
  const src = '/** @param {NodeHandle} n */\nfunction inspeccionar(n) { n.'
  assert.ok(engine.membersAfter('n',engine.contextAt(src,src.length,CONTEXTS.nodeScript))?.list.length > 3)
 })
 test('JSDOC-13 · ninguna anotación se filtra al documento siguiente', () => {
  assert.deepEqual(members('jugador','let jugador = {};\njugador.'),[])
  assert.deepEqual(members('jugador',T),['vida','nombre'])
 })
 test('JSDOC-14 · comentarios incompletos no generan tipos inventados', () => {
  const src = '/** @type {{ vida: number } */\nconst jugador = {}\njugador.'
  assert.deepEqual(members('jugador',src),[])
 })
 test('JSDOC-15 · comentarios JSDoc dentro de cadenas no se interpretan', () => {
  const src = 'const ejemplo = "/** @type {{ vida: number }} */";\nlet jugador = {};\njugador.'
  assert.deepEqual(members('jugador',src),[])
 })
 test('JSDOC-16 · no se confunden JSDoc y comentario sin declaración adjunta', () => {
  const src = '/** @type {{ vida: number }} */\n// comentario intermedio\nlet jugador = {}\njugador.'
  assert.deepEqual(members('jugador',src),[])
 })
 test('JSDOC-17 · diagnóstico limitado a un literal incompatible evidente', () => {
  const src = '/** @type {number} */\nconst velocidad = "lenta";'
  const d = jsdocLiteralDiagnostics(src)
  assert.equal(d.length,1);assert.match(d[0].message,/literal es string/)
 })
 test('JSDOC-18 · no diagnostica valores dinámicos sin tipo demostrado', () => {
  assert.deepEqual(jsdocLiteralDiagnostics('/** @type {number} */\nconst velocidad = game.variable("v");'),[])
 })
 test('JSDOC-19 · no altera tipos de la API ni las consultas de proyectos', () => {
  const src = '/** @type {{ vida: number }} */\nconst jugador = {}\ngame.node("Puerta").'
  assert.ok(members('game.node("Puerta")',src).length > 2)
 })
 test('JSDOC-20 · no ejecuta scripts ni introduce una segunda fuente de documentos', () => {
  const code = readFileSync(new URL('../src/core/editor/types-jsdoc.js', import.meta.url), 'utf8')
  assert.doesNotMatch(code,/\b(?:eval|new Function)\s*\(/)
  assert.doesNotMatch(code,/\b(?:window|document|localStorage)\b/)
  const ui = readFileSync(new URL('../src/components/ScriptEditor.vue', import.meta.url),'utf8')
  assert.match(ui,/jsIntelligence\(/)
 })
 test('JSDOC-21 · el análisis conserva diagnóstico real de miembros inexistentes', () => {
  const source='/** @type {{ vida: number }} */\nconst pj = {};\npj.novida;'
  const from=source.indexOf('pj.novida')
  const to=from+'pj.novida'.length
  const tree={iterate({enter}) {enter({name:'MemberExpression',from,to,node:{lastChild:{name:'PropertyName',from:to-6,to}}})}}
  const d=analysis.diagnose(source,{tree})
  assert.ok(d.some(x=>/novida/.test(x.message)),JSON.stringify(d))
 })

 test('JSDOC-22 · variable local posterior conserva precedencia sobre parámetro tipado', () => {
  const src = '/** @param {{ vida: number }} pj */\nfunction f(pj) {\n { const pj = game.node("Puerta"); pj.'
  const found=members('pj',src)
  assert.ok(found.length>3 && !found.includes('vida'),JSON.stringify(found))
 })
 test('JSDOC-23 · alias de tipo funciona como elemento de lista tipada', () => {
  const src = '/** @typedef {{ vida: number }} Ficha */\n/** @type {Ficha[]} */\nconst equipo = [];\nequipo[0].'
  assert.deepEqual(members('equipo[0]',src),['vida'])
 })
