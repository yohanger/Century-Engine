import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { timelineRulerTicks } from '../src/core/timeline/model.js'

const source = readFileSync(new URL('../src/components/TimelinePanel.vue', import.meta.url), 'utf8')
const script = source.split('<script setup>')[1].split('</script>')[0]
const template = source.slice(source.indexOf('<template>'), source.indexOf('</template>\n\n<style scoped>'))
const css = source.split('<style scoped>')[1].split('</style>')[0]
const func = (name, dependencies = {}) => {
  const definition = script.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`, 'm'))?.[0]
  assert.ok(definition, `${name} no está implementado`)
  return Function(...Object.keys(dependencies), `${definition}; return ${name}`)(...Object.values(dependencies))
}

test('S08-01 · regla adaptativa: segundos, medios y décimas según zoom', () => {
  const major = scale => timelineRulerTicks(4, scale).filter(t => t.major)
  assert.equal(major(70)[1].t, 1)
  assert.equal(major(160)[1].t, .5)
  assert.equal(major(720)[1].t, .1)
  for (const pixelsPerSecond of [20,70,160,320,720]) {
    const ticks = timelineRulerTicks(10,pixelsPerSecond)
    assert.equal(ticks[0].t,0)
    assert.ok(ticks.every((t,i) => i === 0 || ticks[i-1].t < t.t))
    assert.ok(ticks.every(t => t.t >= 0 && t.t <= 10))
  }
  assert.match(script,/ZOOM_MAX = 720/)
})

test('S08-02 · cuadrícula vertical y horizontal comparten escala y origen con la regla', () => {
  assert.match(script,/const gridStep = computed\(/)
  assert.match(script,/const gridMinorStep = computed\(/)
  assert.match(template, /'--tl-grid-step': gridStep \+ 'px', '--tl-grid-minor': gridMinorStep \+ 'px'/)
  assert.match(template, /class="time-grid" :style="\{ width: W \+ 'px' \}"/)
  assert.match(css,/\.time-grid[^}]+background-size:var\(--tl-grid-step\) 100%,var\(--tl-grid-minor\) 100%/)
  assert.match(css,/\.trow \{[^}]+border-bottom:/)
  assert.match(template,/left: timeToX\(t\.t\) \+ 'px'/)
})

test('S08-03 · la continuidad usa solo intervalos reales y distingue cortes', () => {
  const zoom = { value: 90 }
  const motionSpans = Function('zoom','timeToX', `${script.match(/const motionSpans = \(tr\) =>[\s\S]*?\.filter\(segment => segment\.w > 0\)/)[0]}; return motionSpans`)(zoom,t=>24+t*zoom.value)
  const tr = {kind:'node', keys:[{id:'a',t:0,ease:'linear'}, {id:'b',t:2,ease:'cut'},{id:'c',t:3,ease:'linear'}]}
  assert.deepEqual(motionSpans(tr),[{id:'a',l:24,w:180,cut:false},{id:'b',l:204,w:90,cut:true}])
  assert.deepEqual(motionSpans({...tr,kind:'commands'}),[])
  assert.deepEqual(motionSpans({...tr,keys:[{id:'x',t:0,ease:'linear'}]}),[])
  assert.equal(motionSpans({...tr,interpolation:'nearest'})[0].cut,true)
  assert.match(template,/v-for="s in motionSpans\(row\.track\)"/)
})

test('S08-04 · claves instantáneas circulares y clips con identidad visual propia', () => {
  assert.match(css,/\.key\.camera,\.key\.node,\.key\.method \{[^}]+border-radius: 50%/)
  assert.match(css,/\.key\.cut:not\(\.node\):not\(\.camera\):not\(\.method\)/)
  assert.match(template,/class="key" :class="\[row\.track\.kind/)
  assert.match(template,/@pointerdown="keyDown\(\$event, row\.track, k\)"/)
  assert.match(template,/@contextmenu\.prevent\.stop="keyMenu\(\$event, row\.track, k\)"/)
})

test('S08-05 · previsualización de poses depende del contexto y no del panel activo',()=>{
 const playback=readFileSync(new URL('../src/core/timeline/playback-session.js',import.meta.url),'utf8')
 assert.match(playback,/visual.apply\(timeline,time.value/)
 assert.match(playback,/contextValid\(\)/)
 assert.match(playback,/current.playOn/)
 assert.doesNotMatch(playback,/dockPanelIsActive/)
 assert.match(script,/watch\(\[ph,ver,previewOn,tl,sel,/)
})
test('S08-06 · preview visual no despacha comandos ni métodos de gameplay', () => {
  const sourcePreview = readFileSync(new URL('../src/core/timeline/preview.js', import.meta.url),'utf8')
  assert.match(sourcePreview,/if \(track\.kind !== 'node' \|\| track\.muted/)
  assert.match(sourcePreview,/track\.kind === 'camera' && !track\.muted/)
  assert.match(sourcePreview,/track\.kind !== 'bake' \|\| track\.muted/)
  assert.doesNotMatch(sourcePreview,/dispatchCommand\(|\.invokeMethod\(/)
})

test('S08-07 · aplicador real de preview modifica el nodo visual, no los datos persistidos, y restaura', () => {
  class V3 {
    constructor(x=0,y=0,z=0){ Object.assign(this,{x,y,z}) }
    set(x,y,z){ Object.assign(this,{x,y,z}); return this }
    copy(v){ return this.set(v.x,v.y,v.z) }
    clone(){ return new V3(this.x,this.y,this.z) }
    toArray(){ return [this.x,this.y,this.z] }
    fromArray(v){ return this.set(...v) }
  }
  class Euler extends V3 { constructor(){super();this.order='XYZ'} }
  class Quaternion { clone(){return new Quaternion()} copy(){return this} fromArray(){return this} }
  class PerspectiveCamera { constructor(){this.position=new V3();this.quaternion=new Quaternion();this.fov=70} updateProjectionMatrix(){} }
  const three = {Vector3:V3, Quaternion, PerspectiveCamera}
  const code = readFileSync(new URL('../src/core/timeline/preview.js', import.meta.url),'utf8')
    .replace(/^import .*$/gm,'').replace('export class TimelinePreview','class TimelinePreview')
  const TimelinePreview = Function('THREE','evalTimelineCamera','evalTimelineNode','quatFromRot','sampleBakeTrack','DEG', code+'\nreturn TimelinePreview')(
    three,()=>null,(tr,t)=>tr.keys[0].v.map((n,i)=> n + (tr.keys[1].v[i]-n)*(t/2)),()=>new Quaternion(),()=>null,Math.PI/180)
  let renders=0
  const vp={persp:{},camera:null,controls:{enabled:true},container:{clientWidth:640,clientHeight:360},requestRender(){renders++}}
  vp.camera=vp.persp
  const node={position:new V3(1,2,3),rotation:new Euler(),scale:new V3(1,1,1),userData:{},visible:true,updateMatrixWorld(){}}
  const editor={vp,nodes:new Map([['id-cubo',node]])}
  const object={id:'id-cubo',name:'Cubo 3',position:[1,2,3]}
  const preview=new TimelinePreview({getEditor:()=>editor,getObjects:()=>[object],worldMatrix:()=>null})
  const tr={kind:'node',node:'id-cubo',byId:true,prop:'position',keys:[{t:0,v:[1,2,3]},{t:2,v:[11,2,3]}]}
  preview.apply({tracks:[tr]},1)
  assert.equal(node.position.x,6)
  assert.deepEqual(object.position,[1,2,3])
  preview.apply({tracks:[tr,{kind:'commands',keys:[{t:1,list:[{action:'danger'}]}]}]},2)
  assert.equal(node.position.x,11)
  preview.stop()
  assert.deepEqual(node.position.toArray(),[1,2,3])
  assert.ok(renders>=3)
})

test('S08-08 · preview nunca ejecuta eventos, audio o métodos durante scrubbing', () => {
  const text = readFileSync(new URL('../src/core/timeline/preview.js',import.meta.url),'utf8')
  assert.match(text,/for \(const track of timeline\.tracks \|\| \[\]\) if \(track\.kind === 'camera'/)
  assert.match(text,/if \(track\.kind !== 'node' \|\| track\.muted/)
  assert.match(text,/if \(track\.kind !== 'bake' \|\| track\.muted/)
  assert.doesNotMatch(text, /(?:execCommand|emitSignal|callMethod|runScript|playAudio)\(/)
})

test('S08-09 · compilación Vue real si hay compilador disponible', async t => {
  let compiler
  try { compiler = await import('@vue/compiler-sfc') }
  catch (error) { if (error?.code === 'ERR_MODULE_NOT_FOUND') { t.skip('Compilador Vue ausente; verificar npm run build local'); return }; throw error }
  const parsed = compiler.parse(source,{ filename:'TimelinePanel.vue' })
  assert.deepEqual(parsed.errors,[])
  const result = compiler.compileTemplate({ source: parsed.descriptor.template.content, filename:'TimelinePanel.vue',id:'s08' })
  assert.deepEqual(result.errors,[])
})
