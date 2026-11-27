import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { decodeElectronResult, formatWebGLFailure } from './qa-electron-webgl-runner.mjs'
const html = readFileSync(new URL('./fixtures/editor/scene-inspector-professional-ux.html', import.meta.url), 'utf8')
const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)[1]
const moduleSource = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]
function fixture() {
  const out = { dataset:{}, textContent:'Cargando…' }, listeners = new Map()
  const window = {addEventListener(type,fn){listeners.set(type,fn)}}
  runInNewContext(bootstrap,{document:{getElementById:()=>out},window})
  return {out, qa:window.__sceneInspectorQA, emit:(type,event)=>listeners.get(type)(event), report:()=>JSON.parse(out.textContent)}
}
test('Bootstrap informa su estado antes de importar',()=>{const f=fixture();assert.equal(f.out.dataset.stage,'bootstrap');assert.equal(f.out.dataset.checks,'0');assert.equal(f.out.dataset.pass,undefined)})
test('Fallo de script de módulo informa URL y etapa',()=>{const f=fixture();f.emit('error',{target:{tagName:'SCRIPT',src:'/fixture?html-proxy'}});assert.equal(f.out.dataset.pass,'false');assert.match(f.report().error,/html-proxy/);assert.equal(f.report().stage,'bootstrap')})
test('Error de importación rechazado conserva etapa y excepción',()=>{const f=fixture();f.qa.progress('import:InspectorDock');f.qa.fail(new Error('module rejected'));assert.equal(f.report().stage,'import:InspectorDock');assert.match(f.report().error,/module rejected/);assert.equal(f.out.dataset.pass,'false')})
test('Excepción global y rechazo no ocultos',()=>{const f=fixture();f.emit('error',{message:'SyntaxError',filename:'file.js',lineno:5,colno:1});assert.match(f.report().error,/file.js:5:1/);const g=fixture();g.emit('unhandledrejection',{reason:new Error('rejected')});assert.match(g.report().error,/rejected/)})
test('Progreso conserva comprobaciones y un fallo no se convierte en PASS',()=>{const f=fixture();f.qa.checks.push({name:'one',pass:true});f.qa.progress('check:1:one');assert.equal(f.out.dataset.checks,'1');f.qa.fail(Error('bad'));f.qa.progress('later');f.qa.finish(true);assert.equal(f.report().pass,false);assert.equal(f.report().stage,'check:1:one');assert.equal(f.report().checks.length,1)})
test('Error de limpieza invalida un resultado exitoso',()=>{const f=fixture();f.qa.finish(true);f.qa.fail(Error('cleanup'));assert.equal(f.report().pass,false);assert.match(f.report().error,/cleanup/)})
test('Carga de módulos bajo captura y 19 comprobaciones conservadas',()=>{assert.doesNotMatch(moduleSource,/^import\s/m);assert.match(moduleSource,/try \{\s*progress\('import:styles'\)/);assert.equal((moduleSource.match(/\bcheck\('/g)||[]).length,19);assert.match(moduleSource,/checks.length === 19 && checks.every\(c=>c.pass\)/)})
test('Runner conserva stderr y stdout incluso con resultado estructurado',()=>{const result=decodeElectronResult('boot\nLF_WEBGL_QA_RESULT:{"ok":false,"error":"timeout"}\n','[WebGL] SyntaxError',0);const msg=formatWebGLFailure(result,'[vite] error');assert.match(msg,/timeout/);assert.match(msg,/SyntaxError/);assert.match(msg,/boot/);assert.match(msg,/\[vite\] error/)})
test('Resultado exitoso conserva datos originales y diagnósticos',()=>{const r=decodeElectronResult('LF_WEBGL_QA_RESULT:{"ok":true,"data":{"pass":true,"checks":[1]}}\n','',0);assert.equal(r.ok,true);assert.deepEqual(r.data.checks,[1]);assert.equal(r.diagnostics.exitCode,0)})
test('Ausencia o corrupción de marcador conserva evidencia',()=>{assert.throws(()=>decodeElectronResult('stdout','renderer gone',1),/renderer gone/);assert.throws(()=>decodeElectronResult('LF_WEBGL_QA_RESULT:broken','Vite error',1),/Vite error/)})

test('Runner conserva error original aunque también exista un resultado estructurado',()=>{const result=decodeElectronResult('LF_WEBGL_QA_RESULT:{"ok":false,"error":"Fallo de captura","data":{"checks":[{"passed":false}]}}\n','',0);const msg=formatWebGLFailure(result,'');assert.match(msg,/Fallo de captura/);assert.match(msg,/checks/);assert.match(msg,/false/)})
