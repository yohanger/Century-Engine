import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const html = readFileSync(new URL('./fixtures/editor/timeline-library-picker-ux-s12-g005.html', import.meta.url), 'utf8')
const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)?.[1]
const moduleScript = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1]

function startFixture({throwCanvas=false}={}) {
  assert.ok(bootstrap, 'Falta el diagnóstico anterior a las importaciones ESM')
  const out = {dataset:{},textContent:''}
  const listeners = new Map()
  const clocks = new Map()
  let clockId = 0
  const window = {addEventListener(event, callback) { listeners.set(event,callback) }}
  const document = {getElementById: id => id === 'timeline-library-picker-ux-s12-g005-result' ? out : null,
    createElement: () => ({getContext: () => {if(throwCanvas)throw new Error('GPU no disponible');return true}})}
  runInNewContext(bootstrap, {window,document,
    setTimeout(callback,ms) {const id=++clockId; clocks.set(id,{callback,ms});return id},
    clearTimeout(id){clocks.delete(id)},Error,JSON,String})
  return {out,qa:window.__lfPickerQa,listeners,clocks}
}

test('CORR001-01 · diagnóstico existe antes de cargar Vue y conserva 40 comprobaciones', () => {
  assert.ok(bootstrap && moduleScript)
  assert.ok(html.indexOf('<script>') < html.indexOf('<script type="module">'))
  assert.equal((moduleScript.match(/^  check\('/gm)||[]).length,40)
  assert.match(moduleScript,/try\{\s*stage\('Importación Vue'\)/)
  assert.match(moduleScript,/await import\('vue'\)/)
  assert.match(moduleScript,/await import\('\/src\/components\/TimelinePanel.vue'\)/)
  assert.doesNotMatch(moduleScript,/^import\s/m)
})

test('CORR001-02 · bootstrap publica etapa y contador incluso sin cargar módulos', () => {
  const {out,qa,clocks} = startFixture()
  assert.equal(out.dataset.stage,'bootstrap')
  assert.equal(out.dataset.checks,'0')
  assert.equal(out.dataset.pass,undefined)
  assert.equal(clocks.size,1)
  qa.stage('Importación TimelinePanel.vue')
  qa.check('Apertura del selector',true,{items:3})
  assert.equal(out.dataset.stage,'Comprobación 1: Apertura del selector')
  assert.equal(out.dataset.checks,'1')
  assert.deepEqual(JSON.parse(out.textContent).checks.map(c=>c.name),['Apertura del selector'])
})

test('CORR001-03 · un error de importación se informa con etapa y sin PASS falso', () => {
  const {out,qa,listeners} = startFixture()
  qa.stage('Importación TimelinePanel.vue')
  listeners.get('error')({message:'Módulo no encontrado',filename:'TimelinePanel.vue'})
  const result = JSON.parse(out.textContent)
  assert.equal(out.dataset.pass,'false')
  assert.equal(result.pass,false)
  assert.equal(result.stage,'Importación TimelinePanel.vue')
  assert.match(result.error,/Módulo no encontrado/)
  qa.pass()
  assert.equal(out.dataset.pass,'false', 'El PASS tardío no puede ocultar un error')
})

test('CORR001-04 · rechazo no capturado se informa y conserva comprobaciones parciales', () => {
  const {out,qa,listeners} = startFixture()
  qa.check('Mount',true)
  listeners.get('unhandledrejection')({reason:new Error('Falló el render')})
  const result=JSON.parse(out.textContent)
  assert.equal(result.pass,false)
  assert.equal(result.checks.length,1)
  assert.match(result.error,/Falló el render/)
})

test('CORR001-05 · watchdog informa etapa del bloqueo y termina antes del runner', () => {
  const {out,qa,clocks}=startFixture()
  qa.stage('Teclado: ArrowDown')
  assert.equal([...clocks.values()][0].ms,45000)
  ;[...clocks.values()][0].callback()
  const result=JSON.parse(out.textContent)
  assert.equal(result.pass,false)
  assert.match(result.error,/Teclado: ArrowDown/)
  assert.equal(out.dataset.stage,'final:FAIL')
})

test('CORR001-06 · un check falso impide un PASS aunque se complete la secuencia', () => {
  const {out,qa}=startFixture()
  qa.check('A',true)
  qa.check('B',false)
  qa.pass()
  const result=JSON.parse(out.textContent)
  assert.equal(result.pass,false)
  assert.equal(result.checks.length,2)
  assert.equal(out.dataset.pass,'false')
})

test('CORR001-07 · espera Vue/RAF tiene límite real y no depende de RAF infinito', async () => {
  assert.ok(moduleScript)
  const match=moduleScript.match(/const tick=async\(\)=>\{[\s\S]*?\n\}/)
  assert.ok(match,'No se encuentra tick bounded')
  const tick=Function('nextTick','requestAnimationFrame','setTimeout','clearTimeout',match[0]+';return tick')(
    async()=>{},()=>{},callback=>{queueMicrotask(callback);return 1},()=>{})
  await tick()
  assert.match(match[0],/setTimeout\(done,150\)/)
})

test('CORR001-08 · el runner compartido permanece intacto y recibe stage/checks', () => {
  const runner=readFileSync(new URL('./qa-electron-webgl.cjs',import.meta.url),'utf8')
  const harness=readFileSync(new URL('./test-timeline-library-picker-ux-s12-g005-electron.mjs',import.meta.url),'utf8')
  assert.match(runner,/stage:el\?\.dataset\.stage \|\| null/)
  assert.match(runner,/checks:el\?\.dataset\.checks \|\| null/)
  assert.match(harness,/minChecks:32,fixtureWaitMs:55000/)
  assert.match(moduleScript,/finally\{[\s\S]*?playback\?\.dispose\(\)/)
})

test('CORR001-09 · el resultado exige exactamente 40 checks, no un PASS prematuro', () => {
  const {out,qa}=startFixture()
  qa.check('Solo el primero',true)
  qa.pass()
  const result=JSON.parse(out.textContent)
  assert.equal(result.pass,false)
  assert.match(result.error,/Comprobaciones incompletas: 1 \/ 40/)
})

test('CORR001-10 · únicamente 40 checks correctos permiten publicar PASS', () => {
  const {out,qa}=startFixture()
  for(let i=0;i<40;i++)qa.check('Comprobación '+(i+1),true)
  qa.pass()
  const result=JSON.parse(out.textContent)
  assert.equal(result.pass,true)
  assert.equal(result.checks.length,40)
  assert.equal(out.dataset.stage,'final:PASS')
})

test('CORR001-11 · error WebGL opcional no deja el resultado sin publicar', () => {
  const {out,qa}=startFixture({throwCanvas:true})
  for(let i=0;i<40;i++)qa.check('Comprobación '+i,true)
  qa.pass()
  assert.equal(out.dataset.pass,'true')
  const result=JSON.parse(out.textContent)
  assert.equal(result.pass,true)
  assert.equal(result.gl,false)
})
