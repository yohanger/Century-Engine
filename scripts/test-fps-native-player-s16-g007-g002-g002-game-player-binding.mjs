import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { MOVE_KEYS, PLAYER_PARAMS, clampPlayerField, normalizePlayer } from '../src/engine/runtime/database/player.js'

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')
const code = read('src/engine/runtime/events/play-player.js')
const play = read('src/engine/runtime/events/play.js')
const classMethods = play.slice(play.indexOf('  _scenePlayerDecision() {'), play.indexOf('  // Una sola resolución por escena:'))
const decision = new Function('resolveScenePlayerNode', `return ({${classMethods.replace('\n  _scenePlayerSelect()', ',\n  _scenePlayerSelect()')}})`)((scene, objects) => {
  if (!scene?.playerNodeId) return { status: 'unassigned', id: '', node: null }
  const node = objects.find(o => o.id === scene.playerNodeId)
  return node?.type === 'characterbody3d' && node.active !== false
    ? { status: 'valid', id: node.id, node }
    : { status: node ? 'wrong-type' : 'missing', id: scene.playerNodeId, node: node ?? null }
})

class Vec {
  constructor(x=0,y=0,z=0) { this.x=x; this.y=y; this.z=z }
  clone() { return new Vec(this.x,this.y,this.z) }
  copy(v) { return this.set(v.x,v.y,v.z) }
  set(x,y,z) { this.x=x;this.y=y;this.z=z; return this }
  toArray() { return [this.x,this.y,this.z] }
}
class Quat { invert() { return this } premultiply() { return this } setFromAxisAngle() { return this } }
class Euler { setFromQuaternion() { this.y=0; return this } }
const playerMethods = new Function('THREE','DEG','MOVE_KEYS','PLAYER_PARAMS','clampPlayerField','pickMove',`return (${code.slice(code.indexOf('export const playerMethods =') + 'export const playerMethods ='.length).trim()})`)({Vector3:Vec,Quaternion:Quat,Euler},Math.PI/180,MOVE_KEYS,PLAYER_PARAMS,clampPlayerField,c=>Object.fromEntries(MOVE_KEYS.map(k=>[k,c[k]])))

function scenePlayer({ id='body-a', parentOffset=10, extra=false }={}) {
  const scene = { id:'scene', playerNodeId:id }
  const project = { activeSceneId:'scene', scenes:[scene], objects:[
    {id:'body-a',type:'characterbody3d',active:true,props:{}},
    {id:'body-b',type:'characterbody3d',active:true,props:{}},
    {id:'shape-a',parentId:'body-a',type:'collisionshape3d',props:{shape:{radius:0.45,height:2}}},
    {id:'camera-a',parentId:'body-a',type:'camera',active:true},
    ...(extra ? [{id:'box',type:'primitive'}] : []),
  ] }
  const parent = { worldToLocal: v => {v.x-=parentOffset;return v},getWorldQuaternion:()=>new Quat() }
  const makeNode = x => ({
    parent,position:new Vec(x,0,0),rotation:{x:0,y:0},quaternion:{copy(){}},
    updateMatrixWorld(){},getWorldPosition(v){return v.set(this.position.x+parentOffset,this.position.y,this.position.z)},getWorldQuaternion:()=>new Quat(),
  })
  const nodes=new Map([['body-a',makeNode(1)],['body-b',makeNode(5)],['camera-a',makeNode(0)]])
  const physical = new Map([['body-a', {obj:project.objects[0],node:nodes.get('body-a'),velocity:[2,0,3],ground:'stable',onFloor:true}],
    ['body-b', {obj:project.objects[1],node:nodes.get('body-b'),velocity:[5,0,6],ground:'air',onFloor:false}]])
  const spatial = {disposed:false,characters:physical,characterState: key=>{
    const c=physical.get(key); return c ? {velocity:[...c.velocity],ground:c.ground,onFloor:c.onFloor} : null
  }, setVelocity:(key,value)=>{physical.get(key).velocity=[...value]},syncCharacter:()=>{ spatial.synced++ },synced:0}
  const self = Object.create(playerMethods)
  Object.assign(self,{
    on:true, _referenceSession:{}, _nativePlayerId:id, _nativePlayerIssue:null,
    project, ed:{nodes}, phys:{nodeSpatial:spatial},
    player:{pos:new Vec(9,9,9),body:{radius:0.2,stepHeight:0.4},vy:0,grounded:false,api:()=>({legacy:true})},
    _nodeEnabled:obj=>obj.active!==false,_nodeHandle:key=>({id:key,type:'characterbody3d'}),
    _eyeRay:()=>({origin:[1,2,3],dir:[0,0,-1]}),_playerLook:()=>null,
    _textCtx:()=>({actor:()=> 'Jugador'}), _playerMode:()=> 'free', surfaceAt:()=> 'stone',
    game:{db:{player:normalizePlayer({walk:4})},party:{actors:{}}},g:{walk:4},control:true,
  })
  return { self, nodes, spatial, physical, project }
}

test('BIND-01: sin identidad no se crea un controlador FPS implícito',()=>{
  const self=Object.create(decision);self.g={player:'fps'};self.film=null
  self.project={activeSceneId:'scene',scenes:[{id:'scene'}],objects:[]}
  assert.equal(self._scenePlayerDecision().kind,'none')
})
test('BIND-02: vínculo válido selecciona exactamente un CharacterBody3D',()=>{
  const self=Object.create(decision);self.g={player:'fps'};self.film=null
  self.project={activeSceneId:'scene',scenes:[{id:'scene',playerNodeId:'body-b'}],objects:[{id:'body-a',type:'characterbody3d'},{id:'body-b',type:'characterbody3d'}]}
  assert.deepEqual(self._scenePlayerDecision(),{kind:'native',id:'body-b'})
})
test('BIND-03: identidad incorrecta nunca elige el FPS heredado',()=>{
  const self=Object.create(decision);self.g={player:'fps'};self.film=null
  self.project={activeSceneId:'scene',scenes:[{id:'scene',playerNodeId:'missing'}],objects:[{id:'body-a',type:'characterbody3d'}]}
  assert.equal(self._scenePlayerDecision().kind,'invalid')
})
test('BIND-04: GameManager Sin jugador no crea controlador',()=>{
  const self=Object.create(decision);self.g={player:'none'};self.film=null
  self.project={activeSceneId:'scene',scenes:[{id:'scene',playerNodeId:'body-a'}],objects:[{id:'body-a',type:'characterbody3d'}]}
  assert.deepEqual(self._scenePlayerDecision(), {kind:'disabled',id:'body-a',reason:'game-manager-none'})
})
test('BIND-05: FilmMaker bloquea la identidad de gameplay',()=>{
  const self=Object.create(decision);self.g={player:'fps'};self.film={}
  self.project={activeSceneId:'scene',scenes:[{id:'scene',playerNodeId:'body-a'}],objects:[{id:'body-a',type:'characterbody3d'}]}
  assert.equal(self._scenePlayerDecision().kind,'disabled')
})
test('BIND-06: posición mundial consulta el nodo, no el controlador heredado',()=>{
  const {self}=scenePlayer()
  assert.deepEqual(self._playerApi().position,[11,0,0])
  assert.equal(self._playerApi().x,11)
  assert.equal(self.player.pos.x,9)
})
test('BIND-07: escritura de posición usa el padre real y sincroniza Jolt',()=>{
  const {self,spatial,nodes}=scenePlayer()
  self._playerApi().position=[30,3,4]
  assert.deepEqual(nodes.get('body-a').position.toArray(),[20,3,4])
  assert.equal(spatial.synced,1)
  assert.deepEqual(self._playerApi().position,[30,3,4])
})
test('BIND-08: velocidad y suelo proceden de NodeSpatialRuntime',()=>{
  const {self,spatial}=scenePlayer()
  const api=self._playerApi()
  assert.deepEqual(api.velocity,[2,0,3]); assert.equal(api.grounded,true); assert.equal(api.ground,'stable')
  api.velocity=[-4,2,0]
  assert.deepEqual(spatial.characterState('body-a').velocity,[-4,2,0])
  assert.equal(api.speed,4)
})
test('BIND-09: la velocidad de otro CharacterBody3D no cambia',()=>{
  const {self,spatial}=scenePlayer()
  self._playerApi().velocity=[1,1,1]
  assert.deepEqual(spatial.characterState('body-b').velocity,[5,0,6])
})
test('BIND-10: sin identidad game.player es null, incluso si project.game.player es fps',()=>{
  const {self}=scenePlayer();self._nativePlayerId=null
  assert.equal(self._playerApi(),null)
})
test('BIND-11: referencias de la escena anterior caducan',()=>{
  const {self}=scenePlayer();const api=self._playerApi()
  self._nativePlayerId='body-b'
  assert.throws(()=>api.position,/obsoleta/)
  assert.throws(()=>{api.velocity=[0,0,0]},/obsoleta/)
})
test('BIND-11B: una referencia con ID repetido en otra escena no se reutiliza',()=>{
  const {self}=scenePlayer();const api=self._playerApi();self.project.activeSceneId='scene-b'
  assert.throws(()=>api.position,/obsoleta/)
})
test('BIND-12: escritura con XYZ inválido no altera la física',()=>{
  const {self,spatial}=scenePlayer()
  assert.throws(()=>{self._playerApi().position=[NaN,0,0]},/XYZ inválida/)
  assert.equal(spatial.synced,0)
})
test('BIND-13: configuración nativa usa el registro de sesión existente, sin segundo estado',()=>{
  const {self}=scenePlayer();const api=self._playerApi()
  self.phys.nodeSpatial.configurePlayerShape=()=>{}
  assert.equal(api.walk,4)
  api.walk=6
  assert.equal(self.game.db.player.walk,6)
  assert.equal(self.g.walk,6)
})
test('BIND-14: ausencia del cuerpo Jolt no activa una cápsula falsa',()=>{
  const {self,spatial}=scenePlayer();spatial.characters.clear()
  assert.equal(self._nativeCharacterState(),null)
  assert.throws(()=>self._playerApi().position,/sin cuerpo físico activo/)
})
test('BIND-15: sensor usa únicamente la instancia vinculada cuando existe',()=>{
  const s=read('src/engine/runtime/physics/jolt-sensors.js')
  assert.match(s,/nodeSpatial\?\.characters\.get\(this\.nodeSpatial\.play\._nativePlayerId\)/)
  assert.match(s,/selected\?\.character \|\| this\.char/)
})
test('BIND-16: no se inicia el controlador FPS cuando existe identidad nativa',()=>{
  assert.match(play,/createPlayer\('none', this\)/)
  assert.doesNotMatch(play,/decision\.kind === 'legacy'/)
  assert.doesNotMatch(code,/new FpsPlayer/)
})

test('BIND-17: la configuración inicial de Jolt puede leer tamaño sin cuerpo físico',()=>{
  const {self,spatial}=scenePlayer()
  spatial.characters.clear()
  assert.equal(self.body.radius,0.32)
  assert.equal(self.body.height,1.8)
  assert.equal(self.body.stepHeight,0.55)
})
