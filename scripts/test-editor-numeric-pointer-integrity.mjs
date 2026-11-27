import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { acquirePointer } from '../src/engine/runtime/input/pointer-capture.js'
import { finiteMesh, finiteQuaternion, finiteTuple, strictJson, usableRect } from '../src/engine/runtime/numeric-integrity.js'
import { transformUV } from '../src/core/mesh/uv.js'
import { PolyMesh } from '../src/engine/runtime/mesh/polymesh.js'
import { readNumberDraft } from '../src/components/number-draft.js'
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8')
test('pointer capture invalidated during docking does not open a gesture', () => {
  const e = { pointerId: 8 }, errors = []
  const previous = console.warn; console.warn = m => errors.push(m)
  try {
    const target = { isConnected:true, setPointerCapture(){throw new DOMException('invalid','InvalidStateError')} }
    assert.equal(acquirePointer(target,e,'Dock'),false)
    assert.match(errors[0], /Dock.*8.*InvalidStateError/)
    assert.equal(acquirePointer({isConnected:false,setPointerCapture(){assert.fail()}},e,'Dock'),false)
    assert.throws(()=>acquirePointer({setPointerCapture(){throw new Error('unexpected')}},e,'Dock'),/unexpected/)
  } finally {console.warn=previous}
})
test('successful capture keeps real pointer identity',()=>{let id;assert.equal(acquirePointer({setPointerCapture(v){id=v}},{pointerId:12},'Viewport'),true);assert.equal(id,12)})
test('hidden zero-size viewport cannot produce NDC by division',()=>{assert.equal(usableRect({left:0,top:0,width:0,height:0}),false);assert.equal(usableRect({left:0,top:0,width:640,height:480}),true)})
test('JSON rejects NaN with full data path instead of writing null',()=>{const p={objects:[{id:'mesh',position:[0,NaN,1]}]};assert.equal(JSON.parse(JSON.stringify(p)).objects[0].position[1],null);assert.throws(()=>strictJson(p,'Scene'),/Scene\.objects\.0\.position\.1.*NaN/);assert.ok(Number.isNaN(p.objects[0].position[1]))})
test('JSON preserves valid values and rejects Infinity',()=>{const p={objects:[{position:[1,2,3]}],empty:null};assert.deepEqual(JSON.parse(strictJson(p)),p);assert.throws(()=>strictJson({scale:[Infinity]},'Node'),/Node\.scale\.0/)})
test('mesh preflight detects Float32 overflow as well as non-finite geometry and UV',()=>{const m=new PolyMesh([[0,0,0],[1,0,0],[0,1,0]],[[0,1,2]]);m.ensureUV();assert.equal(finiteMesh(m),true);m.v[0][0]=1e40;assert.equal(finiteMesh(m),false);m.v[0][0]=0;m.uv[0][0][1]=NaN;assert.equal(finiteMesh(m),false)})
test('UV multiplication rejects overflow without partial mutation',()=>{const m=new PolyMesh([[0,0,0],[1,0,0],[0,1,0]],[[0,1,2]]);m.ensureUV();const before=structuredClone(m.uv);assert.match(transformUV(m,null,{scale:[1e308,1e308]}),/rango/);assert.deepEqual(m.uv,before);assert.equal(transformUV(m,null,{translate:[.5,.25]}),undefined);assert.notDeepEqual(m.uv,before)})
test('non-finite quaternion and sparse numeric tuple rejected',()=>{assert.equal(finiteQuaternion({x:0,y:0,z:0,w:1}),true);assert.equal(finiteQuaternion({x:0,y:0,z:0,w:0}),false);assert.equal(finiteQuaternion({x:NaN,y:0,z:0,w:1}),false);assert.equal(finiteTuple([,1,2],3),false)})
test('numeric draft rejects overflow and invalid bounds',()=>{assert.equal(readNumberDraft('1e309'),null);assert.equal(readNumberDraft('3',NaN,10),null);assert.equal(readNumberDraft('-2.5'),-2.5)})
test('inspector width writer obeys the Electron range at large panel widths',()=>{const s=read('src/components/InspectorDock.vue');const max=s.match(/const maxLabelW = computed\(\(\) => (.*)\)/)[1];const fn=s.match(/function setLabelWidth\(v\) \{.*\}/)[0];const store={prefs:{inspLabelWidth:112}};const dockW={value:500};const maxLabelW={value:new Function('dockW','return '+max)(dockW)};new Function('store','maxLabelW',fn+';setLabelWidth(300)')(store,maxLabelW);assert.equal(store.prefs.inspLabelWidth,240)})
