import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const source = path => readFileSync(new URL(path, root), 'utf8')
// Se evalúan los métodos productivos con sustitutos mínimos de Three/Jolt para aislar la autoridad.
// No se replica ni reescribe el algoritmo de orquestación en el test.
const cameraSource = source('src/engine/runtime/events/play-camera.js')
  .replace(/^import .*$/gm, '').replace(/^export /gm, '')
const cameraMethods = Function('THREE', 'setCameraFov', 'resolveCamera3D',
  cameraSource + '\nreturn cameraMethods')(
  { Matrix4: class { extractRotation(m) { return m } } },
  (cam, fov) => { cam.fov = fov },
  (key, scene, objects, nodes) => {
    if (key.sceneId !== scene) return null
    const o = objects.find(x => x.id === key.node && x.type === 'camera')
    const node = nodes.get(key.node)
    return o && node ? { pos: [...node.pos], quat: { ...node.quat }, fov: o.props?.fov || 70, profile: o.props?.profile || '' } : null
  },
)
const makeCam = () => {
  const position = { x: 0, y: 0, z: 0, set(x,y,z) { Object.assign(this,{x,y,z}) }, setFromMatrixPosition(m) { this.set(...m.pos) } }
  const quaternion = { v: 'initial', copy(q) { this.v = q.v }, setFromRotationMatrix(m) { this.v = m.quat.v } }
  return { position, quaternion, fov: 70 }
}
const fixture = ({ player = true, main = false } = {}) => {
  const objects = [
    { id:'a', type:'camera', visible:true, props:{ fov:53, profile:'night', main } },
    { id:'b', type:'camera', visible:true, props:{ fov:83, profile:'day' } },
  ]
  const nodes = new Map([['a',{pos:[2,3,4],quat:{v:'A'},matrixWorld:{pos:[2,3,4],quat:{v:'A'}},updateMatrixWorld(){}}],
    ['b',{pos:[8,9,10],quat:{v:'B'},matrixWorld:{pos:[8,9,10],quat:{v:'B'}},updateMatrixWorld(){}}]])
  const cam = makeCam(), writes = [], warnings = []
  const pm = {
    _nodeEnabled(obj) {return obj?.active !== false && !this.project.objects.some(parent => parent.id === obj?.parentId && parent.active === false)},
    ...cameraMethods, on:true, hasPlayer:player, film:null, tls:[], ed:{nodes,vp:{}},
    project:{activeSceneId:'sceneA', objects}, _gm:{}, g:{fov:90}, cam,
    state:{noCamera:false}, dom:{style:{}}, rt:{log: (message,kind) => warnings.push([kind,message])},
    _profCamera(profile){writes.push(['profile',profile])},
    _waterFx(camera){writes.push(['water',camera.position.x])},
    _dofFocus(camera){writes.push(['dof',camera.position.x])},
    _tlCamera(cam){ const r=[...this.tls].reverse().find(x=>x.cam); if(r){this._cameraApply(cam,r.cam);this._tlFov=true;this._profCamera(r.cam.profile)} },
    player:{viewPose(camera){camera.position.set(0,1.6,0);camera.quaternion.v='FPS';camera.fov=90}},
  }
  pm._cameraReset()
  return {pm,cam,objects,nodes,writes,warnings}
}

test('G002-01 · request general Camera3D configura salida, FOV, perfil y consumidores finales', () => {
  const {pm,cam,writes}=fixture()
  const lease=pm._cameraAcquire('a')
  assert.ok(lease)
  pm._cameraFrame(cam)
  assert.deepEqual([cam.position.x,cam.position.y,cam.position.z,cam.fov,cam.quaternion.v],[2,3,4,53,'A'])
  assert.equal(pm._cameraActive.kind,'camera3d');assert.equal(pm._cameraActive.requested,true)
  assert.deepEqual(writes,[['profile','night'],['water',2],['dof',2]])
})
test('G002-02 · liberar sin salida mantiene Camera3D viva; posteriores transformaciones se observan',()=>{
  const {pm,cam,nodes}=fixture()
  const lease=pm._cameraAcquire('a');assert.equal(lease.release(),true)
  nodes.get('a').pos[0]=11;pm._cameraFrame(cam)
  assert.equal(cam.position.x,11);assert.equal(pm._cameraActive.held,true)
  assert.equal(lease.use('b'),false);assert.equal(lease.release(),false)
  const next=pm._cameraAcquire('b');assert.ok(next);pm._cameraFrame(cam);assert.equal(cam.position.x,8)
})
test('G002-03 · devolución explícita al gameplay respeta FOV principal',()=>{
  const {pm,cam}=fixture({main:true})
  const lease=pm._cameraAcquire('b');pm._cameraFrame(cam);assert.equal(cam.fov,83)
  assert.equal(lease.release({to:'base'}),true)
  pm._cameraFrame(cam);assert.equal(cam.fov,53);assert.equal(pm._cameraActive.id,'a')
})
test('G002-04 · solicitud existente bloquea otra y conserva autoridad ante Timeline',()=>{
  const {pm,cam,warnings}=fixture()
  const lease=pm._cameraAcquire('a');assert.ok(lease)
  assert.equal(pm._cameraAcquire('b'),null)
  pm.tls=[{tl:{id:'timeline'},finished:false,cam:{pos:[99,0,0],quat:{v:'TL'},fov:45}}]
  pm._cameraFrame(cam);assert.equal(cam.position.x,2)
  pm._cameraFrame(cam);assert.equal(warnings.length,2) // conflicto request y Timeline, ambos avisados una vez
})
test('G002-05 · Timeline activo anterior rechaza adquisición externa y mantiene la vista',()=>{
  const {pm,cam}=fixture()
  pm.tls=[{tl:{id:'timeline'},finished:false,cam:{pos:[99,0,0],quat:{v:'TL'},fov:45,profile:'cinematic'}}]
  assert.equal(pm._cameraAcquire('a'),null)
  pm._cameraFrame(cam);assert.equal(cam.position.x,99);assert.equal(cam.fov,45)
  assert.equal(pm._cameraActive.kind,'timeline')
})
test('G002-06 · FilmMaker conserva autoridad, aunque exista una pista Timeline',()=>{
  const {pm,cam}=fixture()
  pm.tls=[{tl:{id:'timeline'},cam:{pos:[99,0,0],quat:{v:'TL'},fov:45}}]
  pm.film={camera(c){c.position.set(33,0,0);c.fov=32}}
  assert.equal(pm._cameraAcquire('b'),null)
  pm._cameraFrame(cam);assert.equal(cam.position.x,33);assert.equal(pm._cameraActive.kind,'film')
})
test('G002-07 · sin jugador, Camera3D es visible; al perderse fuente, salida negra segura',()=>{
  const {pm,cam,objects}=fixture({player:false})
  const lease=pm._cameraAcquire('a');pm._cameraFrame(cam)
  assert.equal(pm.state.noCamera,false)
  objects.splice(objects.findIndex(o=>o.id==='a'),1)
  pm._cameraFrame(cam)
  assert.equal(pm.state.noCamera,true);assert.equal(pm.dom.style.opacity,'0')
  assert.equal(lease.release(),false)
})
test('G002-08 · identidad de escena y nodo valida solicitudes y leases',()=>{
  const {pm,cam}=fixture()
  assert.equal(pm._cameraAcquire('not-camera'),null)
  const lease=pm._cameraAcquire('a'); assert.ok(lease)
  assert.equal(lease.use('missing'),false)
  pm.project.activeSceneId='sceneB';pm._cameraFrame(cam)
  assert.equal(lease.use('b'),false)
  pm._cameraReset();assert.equal(pm._cameraSource,null)
})
test('G002-09 · no hay duplicación de loop ni escritura posterior a elección en frame',()=>{
  const controls=source('src/engine/runtime/events/play-controls.js')
  assert.match(controls,/this\._cameraFrame\(cam\)/)
  assert.ok(controls.indexOf('this._cameraFrame(cam)') < controls.indexOf('this.audio?.update(cam)'))
  assert.ok(controls.indexOf('this._cameraFrame(cam)') < controls.indexOf('this._profVolumesTick(dt)'))
  assert.doesNotMatch(controls,/this\._tlCamera\(cam\)/)
  assert.doesNotMatch(controls,/this\.film\.camera\(cam\)/)
})
test('G002-10 · APIs y ciclo de vida en host, scripts, escenas y Player compartido',()=>{
  assert.match(source('src/engine/runtime/events/interpreter.js'),/get camera\(\) \{ return h\(\)\.camera \}/)
  assert.match(source('src/engine/runtime/events/play-host.js'),/get camera\(\) \{ return self\._cameraApi\(\) \}/)
  assert.match(source('src/engine/runtime/events/play-nodes.js'),/this\._cameraReset\(\)/)
  assert.match(source('src/engine/runtime/events/play.js'),/this\._cameraReset\(\)/)
  assert.match(source('src/engine/runtime/package/game.js'),/PlayMode/)
  assert.match(source('src/engine/runtime/events/play-look.js'),/this\._eyeRayCam \?\?= this\.cam\.clone\(\)/)
})


test('G002-11 · lease puede cambiar cámara explícitamente sin crear otro propietario', () => {
  const {pm,cam}=fixture()
  const lease=pm._cameraAcquire('a')
  assert.equal(lease.use('b'),true)
  pm._cameraFrame(cam)
  assert.equal(cam.position.x,8);assert.equal(cam.fov,83)
  assert.equal(lease.release({to:'base'}),true)
  assert.equal(lease.use('a'),false)
})
test('G002-12 · plantilla Sin jugador con muestra Timeline válida no oculta el render',()=>{
  const {pm,cam}=fixture({player:false})
  pm.tls=[{tl:{id:'narrative'},finished:false,cam:{pos:[4,5,6],quat:{v:'CUT'},fov:35,profile:''}}]
  pm._cameraFrame(cam)
  assert.equal(cam.position.x,4)
  assert.equal(pm.state.noCamera,false)
  assert.equal(pm._cameraActive.kind,'timeline')
})
test('G002-13 · la invalidación de sesión no deja usar un lease antiguo',()=>{
  const {pm}=fixture()
  const lease=pm._cameraAcquire('a')
  pm._cameraReset()
  assert.equal(lease.use('b'),false)
  assert.equal(lease.release(),false)
  assert.equal(pm._cameraApi().active,null)
})
test('G002-14 · política de liberación desconocida no destruye la solicitud',()=>{
  const {pm,cam}=fixture()
  const lease=pm._cameraAcquire('a')
  assert.throws(()=>lease.release({to:'invalid'}),/salida no válida/)
  pm._cameraFrame(cam)
  assert.equal(cam.position.x,2)
})


test('G002-15 · tipos de script sincronizados entre Editor y extensión VS Code',()=>{
  const editor=source('src/core/events/game-api.d.ts')
  const vscode=source('vscode-extension/media/game-api.d.ts')
  assert.equal(editor,vscode)
  assert.match(editor,/readonly camera: CameraApi/)
  assert.match(editor,/interface CameraLease/)
  assert.match(editor,/acquire\(cameraId: string\): CameraLease \| null/)
})
