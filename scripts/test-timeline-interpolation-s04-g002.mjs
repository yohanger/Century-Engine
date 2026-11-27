import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { newTrack, newKey, normalizeTimeline, normalizeTrack, normalizeKey, INTERPOLATIONS } from '../src/core/timeline/model.js'
import { easeValue } from '../src/engine/runtime/anim/eval.js'

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
// El evaluador es el original, con una sustitución de import de Three.js para ejecutar
// las pruebas matemáticas sin instalar ni simular un renderer de Electron en Node.
const threeStub = `const THREE = {
  Euler: class { set(x,y,z){ this.x=x;this.y=y;this.z=z;return this } setFromQuaternion(q){ this.x=q.x;this.y=q.y;this.z=q.z;return this } },
  Quaternion: class { setFromEuler(e){ Object.assign(this,{x:e.x,y:e.y,z:e.z});return this }
    clone(){ return Object.assign(new this.constructor(),this) }
    slerp(b,u){ this.x+=(b.x-this.x)*u;this.y+=(b.y-this.y)*u;this.z+=(b.z-this.z)*u;return this }
  }
}`
const source = read('src/engine/runtime/timeline/eval.js')
  .replace("import * as THREE from 'three'", threeStub)
  .replace("import { easeValue as animationEase } from '../anim/eval.js'", `import { easeValue as animationEase } from '${new URL('../src/engine/runtime/anim/eval.js', import.meta.url).href}'`)
assert.doesNotMatch(source, /^import .*'three'/m)
const { evalNode, evalCamera, segment } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
const node = (mode, prop = 'position', values = [[0,0,0],[10,20,30]], times = [0, 2]) => ({
  prop, ...(mode ? { interpolation: mode } : {}),
  keys: values.map((v, i) => ({id:'k'+i,t:times[i],v,ease:'inOut'})),
})
const approx = (a,b,eps=1e-8) => assert.ok(Math.abs(a-b)<eps, `${a} != ${b}`)

test('Nuevo modelo: interpolación opcional; no altera el contrato de pistas heredadas', () => {
  assert.ok(!Object.hasOwn(newTrack('node'),'interpolation'))
  const old=normalizeTrack({kind:'node',node:'n',prop:'position',keys:[{t:0,v:[0,0,0],ease:'inOut'},{t:2,v:[10,0,0],ease:'inOut'}]})
  assert.ok(!Object.hasOwn(old,'interpolation'))
  approx(evalNode(old,0.5)[0],1.5625)
  assert.deepEqual(INTERPOLATIONS.map(p=>p[0]),['nearest','linear','cubic','linear-angle','cubic-angle'])
})

test('Normalización conserva los cinco modos válidos según la propiedad', () => {
  for(const mode of INTERPOLATIONS.map(p=>p[0])) {
    const tr=normalizeTrack({kind:'node',prop:'rotation',interpolation:mode,keys:[]})
    assert.equal(tr.interpolation, mode)
  }
  assert.equal(normalizeTrack({kind:'node',prop:'position',interpolation:'linear-angle'}).interpolation,undefined)
  assert.equal(normalizeTrack({kind:'node',prop:'visible',interpolation:'nearest'}).interpolation,undefined)
  assert.equal(normalizeTrack({kind:'node',prop:'position',interpolation:'magic'}).interpolation,undefined)
  assert.ok(!Object.hasOwn(normalizeTrack({kind:'camera',interpolation:'cubic'}),'interpolation'))
})

test('Guardado/reapertura por normalización mantiene ID y modo explícito', () => {
  const data={id:'c',name:'Cinemática',duration:8,tracks:[{id:'tr-1',kind:'node',name:'Nodo',node:'n-42',byId:true,prop:'position',interpolation:'cubic',keys:[{id:'a',t:0,v:[0,0,0],ease:'cut'},{id:'b',t:2,v:[10,2,3],ease:'linear'}]}]}
  const a=normalizeTimeline(data), b=normalizeTimeline(JSON.parse(JSON.stringify(a)))
  assert.deepEqual(b,a)
  assert.equal(b.tracks[0].byId,true)
  assert.equal(b.tracks[0].interpolation,'cubic')
})

test('Lineal y Más cercana producen muestreos distintos y respetan el punto medio', () => {
  const linear=node('linear'), nearest=node('nearest')
  assert.deepEqual(evalNode(linear,0.5),[2.5,5,7.5])
  assert.deepEqual(evalNode(nearest,0.5),[0,0,0])
  assert.deepEqual(evalNode(nearest,1),[10,20,30])
  assert.deepEqual(evalNode(linear,2),[10,20,30])
})

test('Corte heredado mantiene hasta la clave siguiente; Más cercana cambia al punto medio', () => {
  const legacy=node(null); legacy.keys[0].ease='cut'
  assert.equal(evalNode(legacy,1.5)[0],0)
  assert.equal(evalNode(node('nearest'),1.5)[0],10)
  assert.equal(evalNode(legacy,2)[0],10)
})

test('Modo explícito ignora ease de cada clave; desactivarlo restaura ease heredado', () => {
  const n=node('linear'); n.keys[0].ease='cut'
  approx(evalNode(n,0.5)[0],2.5)
  delete n.interpolation
  approx(evalNode(n,0.5)[0],0)
})

test('Cúbica usa valores vecinos y mantiene continuidad en un punto de unión', () => {
  const tr=node('cubic','position',[[0,0,0],[4,0,0],[12,0,0],[13,0,0]],[0,1,3,4])
  const p=evalNode(tr,2)[0], l=evalNode(tr,3-1e-5)[0], r=evalNode(tr,3+1e-5)[0]
  assert.ok(p>4&&p<12)
  approx(evalNode(tr,3)[0],12)
  assert.ok(Math.abs(l-12)<0.001&&Math.abs(r-12)<0.001)
  const slopeL=(12-l)/1e-5, slopeR=(r-12)/1e-5
  assert.ok(Math.abs(slopeL-slopeR)<0.001,`pendientes ${slopeL} / ${slopeR}`)
})

test('Lineal angular usa camino corto 350° → 10° y 170° → -170°', () => {
  approx(evalNode(node('linear-angle','rotation',[[350,170,0],[10,-170,0]]),1)[0],360)
  approx(evalNode(node('linear-angle','rotation',[[350,170,0],[10,-170,0]]),1)[1],180)
  const reverse=node('linear-angle','rotation',[[-170,0,0],[170,0,0]])
  approx(evalNode(reverse,1)[0],-180)
  approx(evalNode(node('linear-angle','rotation',[[350,0,0],[10,0,0]]),2)[0],370)
})

test('Cúbica angular mantiene la continuidad y evita la vuelta de 340°', () => {
  const tr=node('cubic-angle','rotation',[[340,0,0],[350,0,0],[10,0,0],[20,0,0]],[0,1,2,3])
  const middle=evalNode(tr,1.5)[0]
  assert.ok(middle>350&&middle<370,`interpolación ${middle}`)
  approx(evalNode(tr,2)[0],370)
  const before=evalNode(tr,2-1e-5)[0]
  assert.ok(before>350&&before<380)
  assert.ok(Math.abs(before-evalNode(tr,2)[0])<0.001)
  assert.ok(Math.abs(evalNode(tr,2+1e-5)[0]-evalNode(tr,2)[0])<0.001)
})

test('Claves repetidas y extremos no generan NaN ni extrapolaciones', () => {
  const tr=node('cubic','position',[[0,0,0],[1,0,0],[2,0,0],[4,0,0]],[0,0,1,2])
  assert.equal(evalNode(tr,-0.1),undefined)
  assert.equal(evalNode(tr,0)[0],1)
  assert.ok(Number.isFinite(evalNode(tr,0.5)[0]))
  assert.equal(evalNode(tr,10)[0],4)
  assert.equal(segment(tr.keys,0),1)
})

test('Visibilidad permanece discreta incluso con un modo interpolado inválido en memoria', () => {
  const tr=node('nearest','visible',[false,true])
  assert.equal(evalNode(tr,0.5),false)
  assert.equal(evalNode(tr,2),true)
})

test('Opciones no válidas en memoria vuelven a la semántica heredada', () => {
  const tr=node('linear-angle','position')
  approx(evalNode(tr,0.5)[0],1.5625)
})

test('Cámara: curvas Bézier se preservan en normalización, sin pérdida de controles', () => {
  const k=normalizeKey('camera',{id:'a',t:0,ease:'bezier',bz:[0.2,0.4,0.7,0.9],mode:'free',pos:[0,0,0],rot:[0,0,0],fov:70})
  assert.deepEqual(k.bz,[0.2,0.4,0.7,0.9])
  const again=normalizeKey('camera',JSON.parse(JSON.stringify(k)))
  assert.deepEqual(again,k)
  assert.deepEqual(normalizeKey('camera',{ease:'bezier',bz:[-1,0,2,1]}).bz,[0,0,1,1])
  assert.ok(normalizeKey('camera',{ease:'bezier',bz:[null,'bad',null,4]}).bz.every(Number.isFinite))
})

test('Cámara usa todos los suavizados definidos por el editor, incluido Bézier', () => {
  for(const mode of ['linear','in','out','inOut','bezier','back','bounce','elastic']) {
    const key={id:'a',t:0,mode:'free',pos:[0,0,0],rot:[0,0,0],fov:60,ease:mode,bz:[0.2,0.1,0.8,0.9]}
    const last={...key,id:'b',t:2,pos:[10,0,0],fov:100}
    const cam={kind:'camera',path:'linear',keys:[key,last]}
    const expected=easeValue(key,0.25)
    approx(evalCamera(cam,0.5).pos[0],10*expected)
    approx(evalCamera(cam,0.5).fov,60+40*expected)
  }
})

test('Cámara: Corte conserva pose hasta siguiente clave, trayectoria espacial separada', () => {
  const k={id:'a',t:0,mode:'free',pos:[0,0,0],rot:[0,0,0],fov:70,ease:'cut'}
  const b={...k,id:'b',t:2,pos:[10,0,0],fov:90,ease:'linear'}
  const tr={kind:'camera',path:'smooth',keys:[k,b]}
  assert.equal(evalCamera(tr,1).pos[0],0)
  assert.equal(evalCamera(tr,2).pos[0],10)
  assert.equal(evalCamera({...tr,path:'linear'},1).pos[0],0)
})

test('Inspector ofrece modos por pista, los limita por propiedad y conserva historial', () => {
  const ui=read('src/components/TemporalResourceInspector.vue')
  const model=read('src/core/timeline/model.js')
  assert.match(ui,/INTERPOLATIONS\.filter\(/)
  assert.match(ui,/track\.prop === 'rotation' \|\| !id\.endsWith\('-angle'\)/)
  assert.match(ui,/timelineInterpolationChange\(\$event\.target\.value\)/)
  assert.match(ui,/trackChange\('Interpolación de pista'\)/)
  assert.match(ui,/delete track\.value\.interpolation/)
  assert.match(ui,/track\.value\.prop === 'visible'/)
  assert.match(ui,/item\.ease === 'bezier' && \(!isTimeline/)
  assert.match(model,/track\.interpolation \? \[\] : \[easeP\(\)\]/)
  assert.match(ui,/store\.temporalEditRevision\+\+/)
})

test('Preview y Player importan el mismo evaluador de Timeline sin bifurcaciones', () => {
  assert.match(read('src/core/timeline/playback-session.js'),/import \{ TimelinePreview \} from/); assert.match(read('src/core/timeline/preview.js'),/import \{ evalTimelineCamera, evalTimelineNode/)
  assert.match(read('src/engine/runtime/timeline/player.js'),/import \{ evalTimelineCamera, evalTimelineNode \} from '\.\/eval\.js'/)
})
