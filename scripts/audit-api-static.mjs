// Inventario estático de la superficie pública y declaraciones; no sustituye Play.
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
const root = process.argv.find(x => x.startsWith('--root='))?.slice(7) || new URL('..', import.meta.url).pathname
const read = name => fs.readFileSync(path.join(root, name), 'utf8')
const parse = name => ts.createSourceFile(name, read(name), ts.ScriptTarget.Latest, true)
const interfaces = new Map(), aliases = []
function visit(n) {
  if (ts.isInterfaceDeclaration(n)) interfaces.set(n.name.text, n)
  if (ts.isTypeAliasDeclaration(n)) aliases.push(n.name.text)
  ts.forEachChild(n, visit)
}
visit(parse('src/core/events/game-api.d.ts'))
const nameOf = n => n.name && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)) ? n.name.text : null
function declared(name, seen = new Set()) {
  if (seen.has(name)) return new Set()
  seen.add(name)
  const i = interfaces.get(name)
  const result = new Set(i?.members.map(nameOf).filter(Boolean) || [])
  for (const h of i?.heritageClauses || []) for (const t of h.types) for (const n of declared(t.expression.getText(), seen)) result.add(n)
  return result
}
function method(file, name) {
  let result
  function find(n) { if (ts.isMethodDeclaration(n) && nameOf(n) === name) result = n; else ts.forEachChild(n, find) }
  find(parse(file)); if (!result) throw Error(`No se encontró ${name}`); return result
}
const game = method('src/engine/runtime/events/interpreter.js', '_buildApi').body.statements.find(ts.isReturnStatement).expression
const node = method('src/engine/runtime/events/play-nodes.js', '_nodeHandle').body.statements.filter(ts.isVariableStatement).flatMap(n => [...n.declarationList.declarations]).find(n => n.name.getText() === 'handle').initializer
const keys = o => new Set(o.properties.map(nameOf).filter(Boolean))
function compare(label, actual, type, partial = false) {
  const typed = declared(type)
  return { label, type, partial, runtimeLiteral: [...actual].sort(), missingDeclarations: [...actual].filter(n => !typed.has(n)).sort(), missingRuntimeLiteral: [...typed].filter(n => !actual.has(n)).sort() }
}
const comparisons = [compare('game', keys(game), 'Game'), compare('node (literal base; extensiones dinámicas no incluidas)', keys(node), 'NodeHandle', true)]
for (const [name, type] of [['prefabs','RuntimePrefabsApi'],['scenes','RuntimeScenesApi'],['timeline','TimelineApi'],['nav','NavApi']]) {
  const prop = game.properties.find(n => nameOf(n) === name)
  comparisons.push(compare(`game.${name}`, keys(prop.initializer), type))
}
const nodes = []
for (const file of fs.readdirSync(path.join(root,'src/engine/runtime/nodes')).filter(n => n.endsWith('.js'))) {
  const src = read('src/engine/runtime/nodes/'+file)
  for (const m of src.matchAll(/registerNode\(\{\s*type:\s*'([^']+)'/g)) nodes.push({type:m[1],file})
  for (const m of src.matchAll(/bodyDefinition\('([^']+)'/g)) nodes.push({type:m[1],file})
  if (file === 'sprite.js') nodes.push({type:'sprite2d',file},{type:'sprite3d',file})
}
const inventory = [...interfaces].map(([name,i])=>({name, members:i.members.map(m=>({name:nameOf(m),signature:m.getText(),jsdoc:!!m.jsDoc?.length,deprecated:ts.getJSDocDeprecatedTag(m)!=null}))}))
const output = { scope:'Inventario AST de declaraciones, literales públicos y registro de nodos; funciones host, capacidades dinámicas y ejecución requieren auditoría Play.', comparisons, interfaces:inventory, aliases, nodes, declarationCopiesEqual:read('src/core/events/game-api.d.ts')===read('vscode-extension/media/game-api.d.ts') }
console.log(JSON.stringify(output,null,2))
if (process.argv.includes('--strict') && (!output.declarationCopiesEqual || comparisons.some(c=>c.missingDeclarations.length || (!c.partial && c.missingRuntimeLiteral.length)))) process.exitCode=1
