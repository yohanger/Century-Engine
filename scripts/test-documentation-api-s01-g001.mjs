import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { createAnalysis, scriptRoots } from '../src/core/editor/analysis.js'
import { projectNames, projectDts, scriptOwnerTypes } from '../src/core/vscode/files.js'
import { parseInterface } from '../src/core/events/apiParse.js'
import { analyzeScriptEditables } from '../src/engine/runtime/scene/script-editables.js'
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8')
const dts=read('src/core/events/game-api.d.ts'), analysis=createAnalysis(dts), engine=analysis.engine
const plugin=createRequire(import.meta.url)('../vscode-extension/lib/node-owner-types/index.js')
const scripts=[{id:'s',name:'owner.js',folder:'Assets',execution:'node'}]
const meta={scripts,scenes:[{id:'a',name:'A'},{id:'b',name:'B'}],prefabs:[{name:'Personaje',objects:[]}]}
const scenes=new Map([['a',{objects:[{type:'characterbody3d',scriptIds:['s'],name:'Jugador'}]}],['b',{objects:[]}]])
test('API única y proyección de directivas sincronizadas',()=>{
 assert.equal(dts,read('vscode-extension/media/game-api.d.ts'))
 assert.equal(read('src/core/events/apiParse.js'),read('vscode-extension/lib/apiParse.mjs'))
 assert.equal(read('vscode-extension/lib/node-owner-types/script-editables.cjs'),'// Generado por scripts/sync-extension.mjs desde script-editables.js.\n'+read('src/engine/runtime/scene/script-editables.js').replace(/^export function /gm,'function ')+'\nmodule.exports = { analyzeScriptEditables }\n')
})
test('Code: contexto físico exclusivo, métodos de persistencia y diagnóstico',()=>{
 const root=scriptRoots('nodeScript','characterbody3d'), generic=scriptRoots('nodeScript')
 const members=roots=>engine.membersAfter('node',engine.contextAt('node.',5,roots)).list.map(x=>x.name)
 assert.ok(members(root).includes('velocity'));assert.ok(!members(generic).includes('velocity'));assert.ok(members(generic).includes('keepOnLoad'))
 assert.equal(scriptRoots('script','characterbody3d').node,undefined)
 const code='game.dontDestroyOnLoad(';assert.equal(analysis.signatureAt(code,code.length,root).entries[0].ret,'boolean')
 assert.ok(analysis.diagnose('await game.wait(1)',{context:'nodeScript'}).some(x=>x.severity==='error'))
 assert.equal(analysis.diagnose('await game.wait(1)',{context:'script'}).length,0)
})
test('Propietarios incompletos no habilitan física y los Prefabs se sugieren',()=>{
 assert.equal(Object.values(JSON.parse(scriptOwnerTypes(meta,scenes)).owners)[0],'characterbody3d')
 assert.equal(Object.keys(JSON.parse(scriptOwnerTypes(meta,new Map([['a',scenes.get('a')]]))).owners).length,0)
 assert.deepEqual(projectNames(meta,scenes).prefabs,['Personaje'])
 assert.match(projectDts(meta,scenes),/prefabs: "Personaje"/)
 const choices=engine.stringChoices('game.prefabs.instantiate',[],0,engine.contextAt('',0,scriptRoots('script')),projectNames(meta,scenes));assert.ok(choices.some(x=>x.label==='Personaje'))
})
test('Referencia, documentación multilineal y sobrecargas de señales',()=>{
 assert.equal(parseInterface(dts,'NodeHandle').find(x=>x.name==='call').property,false)
 assert.match(parseInterface(dts,'NodeHandle').find(x=>x.name==='call').description,/rechazos Promise/)
 assert.match(parseInterface(dts,'Game').find(x=>x.name==='water').description,/@deprecated/)
 const choices=engine.stringChoices('game.on',[],0,engine.contextAt('',0,scriptRoots('script')),{})
 assert.ok(choices.some(x=>x.label==='lightningImpact'));assert.ok(choices.some(x=>x.label==='tornadoPhase'))
 const code="game.on('tornadoPhase', (e) => { e."; const ctx=engine.contextAt(code,code.length,scriptRoots('script')); const list=engine.membersAfter('e',ctx)?.list.map(x=>x.name)||[]
 assert.ok(list.includes('phase')&&list.includes('position'),JSON.stringify(list))
})
test('TypeScript real: directivas, contexto, firma, hover y error sin reescribir JS',()=>{
 const root=mkdtempSync(join(tmpdir(),'century-intel-'))
 try {
  mkdirSync(join(root,'.levelforge'));mkdirSync(join(root,'Assets'))
  const file=join(root,'Assets','owner.js'), api=join(root,'.levelforge','api.d.ts'), project=join(root,'.levelforge','project.d.ts')
  const code='@header("Movimiento")\n@editable\nlet speed = 4\nnode.velocity = [speed, 0, 0]\ngame.dontDestroyOnLoad("Jugador", true)\nnode.noExiste;\n'
  const files=new Map([[file,code],[api,dts],[project,projectDts(meta,scenes)]])
  writeFileSync(join(root,'.levelforge','script-owners.json'),scriptOwnerTypes(meta,scenes))
  let revision=0
  const host={getCompilationSettings:()=>({allowJs:true,checkJs:true,noEmit:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleDetection:ts.ModuleDetectionKind.Force,lib:['lib.es2022.d.ts']}),getScriptFileNames:()=>[...files.keys()],getScriptVersion:()=>String(revision),getScriptSnapshot:f=>{const s=files.get(f)??ts.sys.readFile(f);return s===undefined?undefined:ts.ScriptSnapshot.fromString(s)},getCurrentDirectory:()=>root,getDefaultLibFileName:opts=>ts.getDefaultLibFilePath(opts),fileExists:f=>files.has(f)||ts.sys.fileExists(f),readFile:f=>files.get(f)??ts.sys.readFile(f),readDirectory:ts.sys.readDirectory,directoryExists:ts.sys.directoryExists,getDirectories:ts.sys.getDirectories}
  const service=ts.createLanguageService(host);plugin({typescript:ts}).create({languageServiceHost:host,languageService:service,project:{getCurrentDirectory:()=>root}})
  assert.deepEqual(service.getSyntacticDiagnostics(file),[])
  assert.ok(service.getSemanticDiagnostics(file).some(d=>d.code===2339&&String(d.messageText).includes('noExiste')))
  assert.ok(!service.getSemanticDiagnostics(file).some(d=>d.code===2339&&String(d.messageText).includes('velocity')))
  assert.ok(service.getCompletionsAtPosition(file,code.indexOf('node.velocity')+5,{}).entries.some(x=>x.name==='velocity'))
  const index=code.indexOf('dontDestroyOnLoad'); const hover=service.getQuickInfoAtPosition(file,index+1);assert.match(ts.displayPartsToString(hover.documentation),/escena/)
  assert.ok(service.getSignatureHelpItems(file,code.indexOf('("Jugador"')+1,{}).items.length)
  assert.equal(files.get(file),code);assert.equal(analyzeScriptEditables(code).editorSource.length,code.length)
  files.set(file,'@editable\nlet x = {}\n');revision++;assert.ok(service.getSyntacticDiagnostics(file).some(d=>d.code===98001))
 }finally{rmSync(root,{recursive:true,force:true})}
})
