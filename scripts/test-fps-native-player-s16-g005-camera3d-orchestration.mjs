import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { InputState, defaultInputMap } from '../src/engine/runtime/input/inputmap.js'
import { inputMethods } from '../src/engine/runtime/events/play-input.js'
import { validateNodeTree } from '../src/engine/runtime/nodes/hierarchy.js'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const scene = JSON.parse(read('scripts/fixtures/fps/s16-g005-native-camera-scene.json'))
const code = read('scripts/fixtures/fps/s16-g005-native-camera-node.js')
const Script = new Function('game','node', code + '\nreturn { ready:_ready,frame:_process }')
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`)

function harness() {
  const input = new InputState(defaultInputMap())
  const game = { input: inputMethods._inputApi.call({ input, _inApi:null }), camera:{active:null} }
  const child = {id:'native-camera',type:'camera',rotation:[0,0,0],is_valid(){ return true }}
  const body = {rotation:[0,0,0],get_node(path){ return path==='VistaFPS'?child:null }}
  const script = Script(game,body)
  script.ready()
  return {input,game,child,body,script, frame(dx,dy){input.movePointer(dx,dy);input.step();script.frame(1/60)} }
}

test('G005-01 · cámara hija nativa; script adjunto al CharacterBody3D normal', () => {
  assert.doesNotThrow(()=>validateNodeTree(scene.objects))
  const body=scene.objects.find(o=>o.id==='a'),camera=scene.objects.find(o=>o.id==='native-camera')
  assert.equal(camera.parentId,body.id)
  assert.equal(camera.type,'camera');assert.equal(camera.props.main,true)
  assert.equal(scene.scripts.find(s=>s.id==='native-camera-a').code,code)
  assert.ok(body.scriptIds.includes('native-camera-a'))
  assert.ok(body.scriptIds.includes('locomotion-a'))
  assert.doesNotMatch(code,/FpsPlayer|requestAnimationFrame|setInterval|player\.viewPose|camera\.acquire/)
})

test('G005-02 · varios eventos del ratón se agregan y se congelan una vez por frame',()=>{
  const i = new InputState();i.movePointer(5,-3);i.movePointer(4,2);i.step()
  assert.deepEqual(i.pointerDelta,{x:9,y:-1})
  i.step();assert.deepEqual(i.pointerDelta,{x:0,y:0})
})

test('G005-03 · descarta NaN/infinitos y limita eventos extremos',()=>{
  const i = new InputState();i.movePointer(NaN,5);i.movePointer(Infinity,1);i.movePointer(300,-400);i.step()
  assert.deepEqual(i.pointerDelta,{x:250,y:-250})
})

test('G005-04 · clear borra el movimiento acumulado y congelado',()=>{
  const i=new InputState();i.movePointer(20,30);i.step();i.movePointer(5,5);i.clear()
  assert.deepEqual(i.pointerDelta,{x:0,y:0});i.step();assert.deepEqual(i.pointerDelta,{x:0,y:0})
})

test('G005-05 · API pública devuelve copia; scripts no alteran el estado interno',()=>{
  const h=harness();h.input.movePointer(10,4);h.input.step()
  const delta=h.game.input.pointerDelta;delta.x=900
  assert.equal(h.game.input.pointerDelta.x,10)
})

test('G005-06 · giro horizontal en el cuerpo y vertical en Camera3D hija',()=>{
  const h=harness();h.frame(20,10)
  near(h.body.rotation[1],-2.52);near(h.child.rotation[0],-1.26)
  near(h.body.rotation[0],0);near(h.child.rotation[1],0)
})

test('G005-07 · la cámara sigue la nueva orientación en frames consecutivos sin duplicar el delta',()=>{
  const h=harness();h.frame(12,0);near(h.body.rotation[1],-1.512)
  h.input.step();h.script.frame(1/60);near(h.body.rotation[1],-1.512)
  h.frame(4,0);near(h.body.rotation[1],-2.016)
})

test('G005-08 · límites de pitch para ratón acumulado',()=>{
  const h=harness();for(let j=0;j<10;j++)h.frame(0,250)
  near(h.child.rotation[0],-85)
  for(let j=0;j<20;j++)h.frame(0,-250)
  near(h.child.rotation[0],85)
})

test('G005-09 · cámara propia activa puede recibir orientación',()=>{
  const h=harness();h.game.camera.active={kind:'camera3d',id:'native-camera'};h.frame(15,5)
  near(h.body.rotation[1],-1.89)
})

test('G005-10 · no cambia la pose cuando otra cámara adquiere autoridad',()=>{
  const h=harness()
  for(const active of [{kind:'camera3d',id:'other'},{kind:'film'},{kind:'timeline'},{kind:'pose'},{kind:'player'}]){
    h.game.camera.active=active;h.frame(20,5)
    near(h.body.rotation[1],0);near(h.child.rotation[0],0)
  }
})

test('G005-11 · la cámara recupera el control al terminar una toma',()=>{
  const h=harness();h.game.camera.active={kind:'film'};h.frame(10,0)
  h.game.camera.active={kind:'camera3d',id:'native-camera'};h.frame(5,0)
  near(h.body.rotation[1],-0.63)
})

test('G005-12 · sin cámara hija falla explícitamente en ready',()=>{
  const game={input:{pointerDelta:{x:1,y:1}},camera:{active:null}}
  const bad={rotation:[0,0,0],get_node:()=>null}
  assert.throws(()=>Script(game,bad).ready(),/falta Camera3D/)
})

test('G005-13 · cámara invalidada entre escenas no recibe giros',()=>{
  const h=harness();h.child.is_valid=()=>false;h.frame(20,20)
  near(h.body.rotation[1],0);near(h.child.rotation[0],0)
})

test('G005-14 · PlayMode conserva el modo de control legacy y entrega delta desde el mismo listener',()=>{
  const src=read('src/engine/runtime/events/play-controls.js')
  const match=src.match(/_look\(e\)\s*\{([\s\S]*?)\n  \},/)
  assert.ok(match)
  assert.match(match[1],/pointerLockElement !== this\.dom/)
  assert.match(match[1],/this\.paused/)
  assert.match(match[1],/_playerMode\(\)/)
  assert.match(match[1],/this\.input\?\.movePointer\(/)
  assert.match(match[1],/this\.player\.look\(e\)/)
})

test('G005-15 · tipado sincronizado en API central y extensión VS Code',()=>{
  const main=read('src/core/events/game-api.d.ts'), ext=read('vscode-extension/media/game-api.d.ts')
  assert.equal(main,ext)
  assert.match(main,/readonly pointerDelta: \{ x: number; y: number \}/)
})

test('G005-16 · Camera Orchestration mantiene autoridad única de render y Camera3D utiliza transformación mundial',()=>{
  const src=read('src/engine/runtime/events/play-camera.js')
  assert.match(src,/mc\.node\.updateMatrixWorld\(true\)/)
  assert.match(src,/cam\.position\.setFromMatrixPosition\(m\)/)
  assert.match(src,/this\._cameraActive = active/)
  assert.match(src,/this\.film\.camera\(cam\)/)
})
