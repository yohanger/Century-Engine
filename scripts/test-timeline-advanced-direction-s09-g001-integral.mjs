import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { newKey, newTrack, newTimeline, timelineMinDuration, retimeTimelineSegment } from '../src/core/timeline/model.js'
import { COMMANDS, newCommand } from '../src/engine/runtime/events/commandDefs.js'
import { EXEC } from '../src/engine/runtime/events/exec-commands.js'
import { World } from '../src/engine/runtime/world/world.js'

const vue = readFileSync(new URL('../src/components/TimelinePanel.vue', import.meta.url), 'utf8')
const script = vue.split('<script setup>')[1].split('</script>')[0]
const template = vue.slice(vue.indexOf('<template>') + '<template>'.length, vue.lastIndexOf('</template>'))
const preview = readFileSync(new URL('../src/core/timeline/preview.js', import.meta.url), 'utf8')
const functionBody = name => {
  const match = script.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`, 'm'))
  assert.ok(match, `${name} debe existir`)
  return match[0]
}

test('S09-01 · duración mínima protege claves reales y simulación horneada', () => {
  const timeline = newTimeline('Control', { duration: 10 })
  const track = newTrack('node', { prop: 'position' })
  track.keys = [newKey('node', 0), newKey('node', 4.2)]
  timeline.tracks.push(track)
  assert.equal(timelineMinDuration(timeline), 4.2)
  track.keys.push(newKey('node', 14))
  assert.equal(timelineMinDuration(timeline), 14)
  timeline.tracks.push({ kind:'bake', start: 5, duration: 12 })
  assert.equal(timelineMinDuration(timeline), 17)
})

test('S09-02 · cambiar la duración de un tramo conserva identidades, valores y vecinos', () => {
  const track = newTrack('node', { prop:'position' })
  track.keys = [newKey('node', 0, { v:[1,2,3] }), newKey('node', 2, {v:[4,5,6]}), newKey('node', 7, {v:[9,9,9]})]
  const copy = structuredClone(track.keys)
  assert.equal(retimeTimelineSegment(track, track.keys[0].id, 4.26, 10, .1), true)
  assert.equal(track.keys[1].t,4.3)
  assert.equal(track.keys[0].t,0)
  assert.equal(track.keys[2].t,7)
  assert.deepEqual(track.keys.map(k => k.v), copy.map(k => k.v))
  assert.deepEqual(track.keys.map(k => k.id), copy.map(k => k.id))
  assert.equal(retimeTimelineSegment(track, track.keys[0].id, 7.1, 10, .1), false)
  assert.equal(track.keys[1].t, 4.3)
  assert.equal(retimeTimelineSegment(track, track.keys[0].id, -1, 10, 0), false)
  assert.equal(retimeTimelineSegment(track, track.keys[0].id, 4.3, 10, 0), false)
})

test('S09-03 · segmentos deshabilitados para comandos, pistas únicas y física', () => {
  const track = newTrack('commands')
  track.keys = [newKey('commands',0),newKey('commands',3)]
  assert.equal(retimeTimelineSegment(track,track.keys[0].id,2,10),false)
  track.kind = 'camera'; track.keys = [newKey('camera',0)]
  assert.equal(retimeTimelineSegment(track,track.keys[0].id,2,10),false)
  assert.match(template, /class="duration-grip"/)
  assert.match(template, /class="segment-grip"/)
  assert.match(script, /commit\('Redimensionar duración del Timeline'\)/)
  assert.match(script, /commit\('Ajustar duración del segmento'\)/)
})

test('S09-04 · duración numérica usa el mismo límite y el zoom queda independiente', () => {
  const update = Function('tl','timelineMinDuration','ph','bump','commit','toast',functionBody('updateDuration')+';return updateDuration')
  const timeline={duration:10,tracks:[{kind:'node',keys:[{t:8}]}]}
  const history=[], warnings=[]; const ph={value:9}; let bumps=0
  const updateDuration=update({value:timeline},timelineMinDuration,ph,()=>bumps++,x=>history.push(x),(...a)=>warnings.push(a))
  assert.equal(updateDuration(2,true),true)
  assert.equal(timeline.duration,8)
  assert.equal(ph.value,8)
  assert.equal(warnings.length,1)
  assert.equal(history.length,1)
  assert.equal(updateDuration(8,true),false)
  assert.ok(!functionBody('updateDuration').includes('zoom.value'))
})

test('S09-05 · cámara del Editor crea una clave local y no cambia el nodo original', () => {
  class V3 {
    constructor(x=0,y=0,z=0){ this.v=[x,y,z] }
    applyMatrix4(matrix){this.v=this.v.map((v,i)=>v+(matrix.offset?.[i]||0));return this}
    toArray(){return [...this.v]}
  }
  class M4 {
    constructor(offset=[0,0,0]){this.offset=offset}
    determinant(){return 1}
    clone(){return new M4([...this.offset])}
    invert(){return new M4(this.offset.map(v=>-v))}
  }
  const object={id:'obj',parentId:'parent',name:'Cubo',position:[1,0,0]}
  const tr={id:'track',kind:'node',prop:'position',node:'obj',byId:true,keys:[]}
  const resource={id:'tl',duration:10,tracks:[tr]}
  const cam={updateMatrixWorld(){},getWorldPosition(v){return new V3(12,3,5)}}
  const deps={tl:{value:resource},trackObject:()=>object,store:{editor:{vp:{persp:cam}}},
    toast:()=>{throw Error('Fallo inesperado')},THREE:{Vector3:V3,Matrix4:M4},
    worldMatrix:()=>new M4([10,0,0]),snapT:()=>2.5,ph:{value:2.5},newKey,sortKeys:(track)=>track.keys.sort((a,b)=>a.t-b.t),
    pick:()=>{},commit:()=>{},bump:()=>{}}
  const capture=Function(...Object.keys(deps), functionBody('captureCameraForTrack')+';return captureCameraForTrack')(...Object.values(deps))
  capture(tr)
  assert.deepEqual(tr.keys[0].v,[2,3,5])
  assert.equal(tr.keys[0].t,2.5)
  assert.deepEqual(object.position,[1,0,0])
  const id=tr.keys[0].id
  capture(tr)
  assert.equal(tr.keys.length,1)
  assert.equal(tr.keys[0].id,id)
})

test('S09-06 · menú de naturaleza crea comandos del catálogo existente, sin scripts incrustados', () => {
  assert.equal(COMMANDS.weather.label,'Cambiar el clima')
  assert.ok(COMMANDS.weatherLightning)
  assert.ok(COMMANDS.weatherThunder)
  for(const code of ['weather','weatherLightning','weatherThunder']) {
    const command=newCommand(code)
    assert.equal(command.code,code)
    assert.ok(Array.isArray(COMMANDS[code].params))
  }
  assert.match(script,/newCommand\(def\[0\], def\[1\]\)/)
  assert.match(template,/Relámpago sin trueno automático/)
  assert.match(template,/Trueno independiente/)
  assert.doesNotMatch(functionBody('addWeatherCue'),/eval\(|Function\(/)
})

test('S09-07 · rayos y truenos separados usan el motor meteorológico y la acústica reales', () => {
  const strikes=[], thunder=[], signals=[]
  const host={ world: {strike(...args){strikes.push(args)},cfg:{weather:{peakKA:44}}},
    weatherSound: {thunder(e){thunder.push(e);return {region:'forest'}}},game:{emit(...args){signals.push(args)}} }
  EXEC.weatherLightning.call({host},{distance:350,bearing:60})
  EXEC.weatherThunder.call({host},{distance:1200,bearing:140})
  assert.deepEqual(strikes,[[350,60,false]])
  assert.equal(thunder.length,1)
  assert.equal(thunder[0].distance,1200)
  assert.deepEqual(signals[0],[ 'thunder', {distance:1200,bearing:140,delay:0,peak:44,region:'forest'} ])
})

test('S09-08 · un rayo habitual conserva el trueno; una clave dirigida puede excluirlo', () => {
  const w=Object.create(World.prototype), events=[]
  Object.assign(w,{cfg:{weather:{lightningModel:'classic',peakKA:25}},flash:0,_pulses:[],cur:{altitude:3000,thickness:0.1},drng:()=>0.2,listeners:{lightning:[e=>events.push(e)]},t:0})
  const silent=w.strike(600,90,false)
  assert.equal(silent.delay,0)
  assert.equal(events[0].thunderEnabled,false)
  const normal=w.strike(600,90)
  assert.ok(Math.abs(normal.delay-600/343)<1e-9)
  assert.equal(events[1].thunderEnabled,undefined)
  const play=readFileSync(new URL('../src/engine/runtime/events/play.js',import.meta.url),'utf8')
  assert.match(play,/if \(e\.thunderEnabled !== false\) this\.timers\.push/)
})

test('S09-09 · trayectoria usa evalNode, padres temporales y overlay del editor, sin persistencia', () => {
  assert.match(preview,/updateMotionPath\(timeline, track\)/)
  assert.match(preview,/const position = evalTimelineNode\(track, time\)/)
  assert.match(preview,/matrix\.multiply\(localMatrix\(pose\)\)/)
  assert.match(preview,/new THREE\.LineSegments/)
  assert.match(preview,/new THREE\.ArrowHelper/)
  assert.match(preview,/viewport\.overlay\.add\(group\)/)
  assert.match(preview,/this\.clearMotionPath\(\)/)
  assert.match(readFileSync(new URL('../src/core/timeline/playback-session.js',import.meta.url),'utf8'),/selectedTrack:track\?\.kind==='node'/)
})

test('S09-10 · scrubbing no dispara efectos de gameplay ni audio desde preview', () => {
  assert.doesNotMatch(preview,/\.commands\?\(|\.weatherSound\?\.thunder\(|\.strike\(/)
  assert.match(preview,/if \(!enabled \|\| !timeline \|\| !viewport\) \{ this\.stop\(\); return \}/)
  const player=readFileSync(new URL('../src/engine/runtime/timeline/player.js',import.meta.url),'utf8')
  assert.match(player,/this\.host\.commands\?\.\(k\.list/)
})

test('S09-11 · overlay real genera líneas, puntos, flechas y libera sus propias geometrías', () => {
  class V3 {
    constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
    toArray(){return [this.x,this.y,this.z]}
    clone(){return new V3(this.x,this.y,this.z)}
    sub(other){this.x-=other.x;this.y-=other.y;this.z-=other.z;return this}
    length(){return Math.hypot(this.x,this.y,this.z)}
    divideScalar(x){this.x/=x;this.y/=x;this.z/=x;return this}
    applyMatrix4(m){this.x+=m.off?.[0]||0;this.y+=m.off?.[1]||0;this.z+=m.off?.[2]||0;return this}
  }
  class M4 {constructor(off=[0,0,0]){this.off=[...off]} multiply(other){this.off=this.off.map((x,i)=>x+other.off[i]);return this}}
  class G {
    constructor(){this.children=[];this.userData={};this.parent=null}
    add(child){child.parent=this;this.children.push(child)}
    remove(child){this.children=this.children.filter(x=>x!==child);child.parent=null}
    traverse(fn){fn(this);for(const child of this.children){if(child.traverse)child.traverse(fn);else fn(child)}}
  }
  class Geo {constructor(){this.attributes={};this.disposed=false}setAttribute(k,v){this.attributes[k]=v}dispose(){this.disposed=true}}
  class Mat {constructor(o){this.cfg=o}dispose(){this.disposed=true}}
  class Lines {constructor(geometry,material){this.geometry=geometry;this.material=material;this.userData={}}}
  class Points extends Lines {}
  class Arr {
    constructor(direction,from,length){this.line={userData:{},geometry:new Geo(),material:new Mat({})};this.cone={userData:{},geometry:new Geo(),material:new Mat({})};this.from=from;this.direction=direction;this.length=length;this.userData={}}
    traverse(fn){fn(this);fn(this.line);fn(this.cone)}
  }
  const THREE={Vector3:V3,Quaternion:class{},PerspectiveCamera:class{},Matrix4:M4,Group:G,
    BufferGeometry:Geo,Float32BufferAttribute:class{constructor(array){this.array=array}},LineSegments:Lines,LineBasicMaterial:Mat,
    Points,PointsMaterial:Mat,ArrowHelper:Arr}
  const code=preview.replace(/^import .*$/gm,'').replace('export class TimelinePreview','class TimelinePreview')
  const Preview=Function('THREE','evalTimelineNode','evalTimelineCamera','quatFromRot','sampleBakeTrack','DEG','localMatrix',code+';return TimelinePreview')(
    THREE,(track,t)=>[t*2,0,0],()=>null,()=>null,()=>null,Math.PI/180,obj=>new M4(obj.position||[0,0,0]))
  const overlay=new G(),viewport={overlay,requestRender(){}}
  const o={id:'obj',name:'cubo',parentId:null},editor={vp:viewport,nodes:new Map([['obj',{}]])}
  const timeline={id:'tl',tracks:[]},track={kind:'node',node:'obj',byId:true,prop:'position',keys:[{id:'a',t:0,ease:'linear'},{id:'b',t:2,ease:'linear'}]}
  const instance=new Preview({getEditor:()=>editor,getObjects:()=>[o],worldMatrix:()=>new M4()})
  instance.updateMotionPath(timeline,track)
  const group=instance.pathGroup
  assert.ok(group)
  assert.equal(overlay.children.length,1)
  assert.ok(group.children.some(child=>child instanceof Lines))
  assert.ok(group.children.some(child=>child instanceof Points))
  assert.ok(group.children.some(child=>child instanceof Arr))
  const lines=group.children.find(child=>child instanceof Lines)
  assert.equal(lines.geometry.attributes.position.array[0],0)
  const last=lines.geometry.attributes.position.array.slice(-3)
  assert.deepEqual(last,[4,0,0])
  instance.updateMotionPath(timeline,track)
  assert.equal(instance.pathGroup,group)
  instance.clearMotionPath()
  assert.equal(overlay.children.length,0)
  assert.equal(lines.geometry.disposed,true)
  assert.equal(group.children.find(child=>child instanceof Arr).line.geometry.disposed,false,'ArrowHelper comparte geometrías con los gizmos de Three')
})

test('S09-12 · la ruta incorpora movimiento de la jerarquía y no dibuja continuidad falsa en nearest', () => {
  // El evaluador pertenece a TimelinePreview; la transformación mundial se calcula por muestra temporal.
  assert.match(preview,/const parentTracks = \(timeline\.tracks \|\| \[\]\)/)
  assert.match(preview,/const v = evalTimelineNode\(animation, time\)/)
  assert.match(preview,/matrix\.multiply\(localMatrix\(pose\)\)/)
  assert.match(preview,/track\.interpolation === 'nearest'/)
  assert.match(preview,/keys\[i\]\.ease === 'cut'/)
  assert.match(preview,/Math\.min\(24, Math\.max\(6,/)
  assert.match(preview,/arrows\.length < 32/)
})
