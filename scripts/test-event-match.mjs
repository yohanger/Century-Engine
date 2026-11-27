// LF-EVENT-MATCH-G001: ramas Match sobre el intérprete real; sin montar Vue o Electron.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { COMMANDS, newCommand, blocksOf, syncBlocks, visibleParams } from '../src/engine/runtime/events/commandDefs.js'
import { newMatchCase, matchBlocks, matchCaseKey, matchCaseValue, matchEquals, moveMatchCase } from '../src/engine/runtime/events/match.js'
import { Game } from '../src/engine/runtime/events/interpreter.js'
import { walk, clone } from '../src/engine/runtime/events/model.js'

const say = (text) => newCommand('text', { text })
function sample(cases, opts = {}) {
  const m = newCommand('match', { src: 'variable', variable: 1, hasDefault: true, cases: cases.map((c) => ({ ...newMatchCase(), ...c })), ...opts })
  for (let i = 0; i < cases.length; i++) m.b[matchCaseKey(m.p.cases[i])] = [say(`Case ${i}`)]
  m.b.default = [say('Default')]
  return m
}
function run(list, setup = () => {}) {
  const said = [], errors = []
  const game = new Game({ host: { say: async (m) => said.push(m.text) } })
  game.report = (e) => errors.push(e.message)
  setup(game)
  return game.run(list, { eventId: 'ev-match', signal: { name: 'test', data: { id: 'A', n: 9 } } }).done.then(() => ({ game, said, errors }))
}

test('MATCH-01 · registró comando en Flujo y bloque inicial y Default', () => {
  const m = newCommand('match')
  assert.equal(COMMANDS.match.group, 'Flujo')
  assert.equal(m.p.cases.length, 1)
  assert.deepEqual(blocksOf(m).map((b) => b.key), [matchCaseKey(m.p.cases[0]), 'default'])
  assert.ok(visibleParams('match', m.p).some((x) => x.key === 'cases'))
  assert.deepEqual(Object.keys(m.b), [matchCaseKey(m.p.cases[0]), 'default'])
})

test('MATCH-02 · usa una variable y ejecuta una sola rama', async () => {
  const m = sample([{value: 0}, {value: 2}, {value: 3}])
  const {said,errors} = await run([m,say('Después')], (g) => g.setVar(1, 2))
  assert.deepEqual(said, ['Case 1','Después'])
  assert.deepEqual(errors, [])
})

test('MATCH-03 · si varios casos coinciden gana el primero', async () => {
  const m = sample([{value: 2}, {value: 2}])
  const {said} = await run([m], (g) => g.setVar(1, 2))
  assert.deepEqual(said, ['Case 0'])
})

test('MATCH-04 · evalúa Default cuando no coincide ningún caso', async () => {
  const m = sample([{value: 6}])
  const {said} = await run([m], (g) => g.setVar(1, 9))
  assert.deepEqual(said, ['Default'])
})

test('MATCH-05 · desactivar Default no ejecuta ramas y continúa', async () => {
  const m = sample([{value: 6}], {hasDefault:false})
  syncBlocks(m)
  assert.ok(m.b.default) // Default permanece oculto y puede reactivarse sin perder sus comandos
  const {said} = await run([m,say('Fin')], (g) => g.setVar(1, 3))
  assert.deepEqual(said, ['Fin'])
})

test('MATCH-06 · la comparación es estricta: número 1 != texto "1"', async () => {
  const m = sample([{src:'text',text:'1'}, {src:'number',value:1}])
  const {said} = await run([m], (g) => g.setVar(1,1))
  assert.deepEqual(said,['Case 1'])
  assert.equal(matchEquals(1,'1'),false)
})

test('MATCH-07 · texto no coincide con booleano', async () => {
  const m = sample([{src:'bool',flag:true},{src:'text',text:'true'}])
  const {said} = await run([m], (g) => g.setVar(1,'true'))
  assert.deepEqual(said,['Case 1'])
})

test('MATCH-08 · booleano True/False funciona con origen booleano', async () => {
  const m = sample([{src:'bool',flag:false},{src:'bool',flag:true}], {src:'bool',flag:false})
  const {said} = await run([m])
  assert.deepEqual(said,['Case 0'])
})

test('MATCH-09 · un origen texto reconoce su case equivalente', async () => {
  const m = sample([{src:'text',text:'llave'}], {src:'text',text:'llave'})
  const {said} = await run([m])
  assert.deepEqual(said,['Case 0'])
})

test('MATCH-10 · un origen numérico constante se compara con número', async () => {
  const m = sample([{value:12}], {src:'number',value:12})
  const {said} = await run([m])
  assert.deepEqual(said,['Case 0'])
})

test('MATCH-11 · puede comparar con otra variable', async () => {
  const m = sample([{src:'variable',variable:2}])
  const {said} = await run([m], (g) => {g.setVar(1,'listo');g.setVar(2,'listo')})
  assert.deepEqual(said,['Case 0'])
  assert.equal(matchCaseValue({src:'variable',variable:2}, (n)=>n),2)
})

test('MATCH-12 · lee dato contextual de una señal (sin crear variables globales)', async () => {
  const m = sample([{src:'text',text:'A'}],{src:'signal',signalField:'id'})
  const {said} = await run([m])
  assert.deepEqual(said,['Case 0'])
})

test('MATCH-13 · lectura contextual inválida no coincide ni accede al prototipo', async () => {
  const m = sample([{src:'text',text:'undefined'}],{src:'signal',signalField:'__proto__'})
  const {said} = await run([m])
  assert.deepEqual(said,['Default'])
})

test('MATCH-14 · expresión JS existente genera valor comparable', async () => {
  const m = sample([{value:7}],{src:'script',expr:'3 + 4'})
  const {said} = await run([m])
  assert.deepEqual(said,['Case 0'])
})

test('MATCH-15 · al reordenar casos conservan su contenido por ID', async () => {
  const m = sample([{value:3},{value:4}]); const first = m.p.cases[0]; const saved = m.b[matchCaseKey(first)]
  assert.equal(moveMatchCase(m.p,0,1),true)
  syncBlocks(m)
  assert.equal(m.p.cases[1].id, first.id)
  assert.equal(m.b[matchCaseKey(first)],saved)
  const {said} = await run([m],(g)=>g.setVar(1,3))
  assert.deepEqual(said,['Case 0'])
})

test('MATCH-16 · quitar un caso retira solo la rama correspondiente', () => {
  const m = sample([{value:0},{value:1},{value:2}])
  const keep = matchCaseKey(m.p.cases[0]), gone = matchCaseKey(m.p.cases[1]), last = matchCaseKey(m.p.cases[2])
  m.p.cases.splice(1,1);syncBlocks(m)
  assert.ok(m.b[keep]); assert.equal(m.b[gone],undefined);assert.ok(m.b[last]);assert.ok(m.b.default)
})

test('MATCH-17 · añadir un caso crea un bloque nuevo sin tocar los anteriores', () => {
  const m = sample([{value:1}]); const prev = m.b[matchCaseKey(m.p.cases[0])]
  const c = newMatchCase();m.p.cases.push(c); syncBlocks(m)
  assert.equal(m.b[matchCaseKey(c)].length,0)
  assert.equal(m.b[matchCaseKey(m.p.cases[0])], prev)
})

test('MATCH-18 · Match anidado ejecuta solo la rama interior', async () => {
  const inner = sample([{src:'text',text:'ok'}],{src:'text',text:'ok'})
  const outer = sample([{value:2}]); outer.b[matchCaseKey(outer.p.cases[0])] = [inner]
  const {said} = await run([outer],(g)=>g.setVar(1,2))
  assert.deepEqual(said,['Case 0'])
})

test('MATCH-19 · Romper bucle pasa por Match hasta el bucle sin ejecutar lo posterior', async () => {
  const m = sample([{value:1}]);m.b[matchCaseKey(m.p.cases[0])] = [newCommand('break')]
  const loop = newCommand('loop'); loop.b.body = [m, say('No debe aparecer')]
  const {said} = await run([loop, say('Después')],(g)=>g.setVar(1,1))
  assert.deepEqual(said,['Después'])
})

test('MATCH-20 · Salir del evento pasa por Match hasta la lista exterior', async () => {
  const m = sample([{value:1}]);m.b[matchCaseKey(m.p.cases[0])] = [newCommand('exit')]
  const {said} = await run([m,say('No debe aparecer')],(g)=>g.setVar(1,1))
  assert.deepEqual(said,[])
})

test('MATCH-21 · copiar y serializar no pierde orden, IDs ni comandos internos', () => {
  const m = sample([{value:1},{value:2}]);moveMatchCase(m.p,0,1)
  const next = JSON.parse(JSON.stringify(m))
  assert.deepEqual(next,m)
  assert.deepEqual(blocksOf(next).map((b)=>b.key), matchBlocks(m.p).map((b)=>b.key))
  let count=0;walk([next],()=>count++)
  assert.equal(count,1+3) // 2 Case y Default tienen 1 mensaje cada uno
  assert.deepEqual(clone(m), m)
})

test('MATCH-22 · IDs independientes por comando y límites de movimiento', () => {
  const a = newCommand('match'), b = newCommand('match')
  assert.notEqual(a.p.cases[0].id,b.p.cases[0].id)
  assert.equal(moveMatchCase(a.p,0,-1),false)
  assert.equal(moveMatchCase(a.p,0,1),false)
})

test('MATCH-23 · Case sin Default y sin casos: no bloquea ejecución', async () => {
  const m = sample([],{hasDefault:false});syncBlocks(m)
  const {said} = await run([m,say('Sigue')])
  assert.deepEqual(said,['Sigue'])
})

test('MATCH-24 · interfaz ofrece añadir/quitar/reordenar y selector de variable', () => {
  const s = readFileSync(new URL('../src/components/ParamForm.vue',import.meta.url),'utf8')
  assert.match(s,/data-testid="match-cases"/)
  assert.match(s,/matchAdd\(p\)/)
  assert.match(s,/matchMove\(p, i, -1\)/)
  assert.match(s,/matchRemove\(p, i\)/)
  assert.match(s,/VarPicker v-else-if="item.src === 'variable'"/)
})

test('MATCH-25 · ramas de otros comandos siguen intactas',()=>{
  const a=newCommand('if'),b=newCommand('loop'),c=newCommand('choices')
  assert.deepEqual(blocksOf(a).map(x=>x.key),['then','else'])
  assert.deepEqual(blocksOf(b).map(x=>x.key),['body'])
  assert.deepEqual(blocksOf(c).map(x=>x.key),['c0','c1'])
})
