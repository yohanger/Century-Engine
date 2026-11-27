import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { NodeLifecycle } from '../src/engine/runtime/scene/node-lifecycle.js'
import { NodeScriptRuntime, buildNodeCallbackCode } from '../src/engine/runtime/scene/node-scripts.js'
import { registerNode, getNativeSignal } from '../src/engine/runtime/nodes/registry.js'

const file = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
registerNode({ type:'signal-s07-qa', label:'Signal QA', create:()=>({}), build:()=>({}), update:()=>{} })
const obj = (id, ids=[], parentId=null) => ({ id, name:id, type:'signal-s07-qa', parentId, scriptIds:ids })
const script = (id, code) => ({ id, name:id+'.js', execution:'node', code })
const link = (id, emitterId='em', receiverId='rx', signal='ready', method='receive') => ({ id, emitterId, receiverId, signal, method })
const receive = script('rx-script', `node.expose('receive', function (...args) { game.record('received:' + args.join(',')) })`)
const makeScene = (id, options={}) => ({ objects:options.objects || [obj('em'),obj('rx',['rx-script'])], signalConnections:options.links === undefined ? [link(id+'-link')] : options.links, environment:{}, terrain:{}, settings:{} })

function makeFixture({scenes={A:makeScene('A'),B:makeScene('B',{links:[]})}, scripts=[receive], meta={}}={}) {
  const read = async id => { const scene=scenes[id]; return scene ? JSON.parse(JSON.stringify(scene)) : null }
  const pkg = { game:{ id:'test-project', models:[], assets:[], scripts, scenes:Object.keys(scenes).map(id=>({id,name:id})), game:{startScene:Object.keys(scenes)[0]}, ...meta }, scene:read, file:async()=>null, sceneIds:Object.keys(scenes) }
  const moduleCode = file('src/engine/runtime/package/host.js').replace(/^import .*\n/gm, '').replace(/\bexport /g,'')
  // Las escenas de estas pruebas son planas: inyectar identidad en el resolver aquí.
  // El resolver real (anidamiento, ciclo, fuentes, IDs) tiene su suite propia G001.
  const noSceneInstances = (record) => {
    if (record.objects?.some(o => o.type === 'sceneInstance')) throw Error('Fixture de señales no admite instancias')
    return record
  }
  const ctx = { pkg, reactive:x=>x, createPlayState:()=>({}), loadNavCache:async()=>{}, modelIdsInScene:()=>new Set(),
    validateSceneVfx:()=>{}, readSceneSources:async()=>new Map(), expandSceneInstances:noSceneInstances,
    URL, Map, Set, String, Error, Object, Array, JSON, Promise }
  vm.createContext(ctx)
  const createPackageHost = vm.runInContext(moduleCode+'\n;createPackageHost',ctx)
  const host = createPackageHost({pkg,storage:{}})
  const events=[], errors=[], nodes=new Map()
  const sceneGraph = { nodes, host, models:new Map(), modelClips:new Map(), syncAll() {nodes.clear(); for(const o of host.project.objects)nodes.set(o.id,{_lfNodeOwner:o});this.nodeLifecycle.sync()}, syncEnvironment(){}, setCaptureClips(){return {}}, async loadProject(){}, async loadScene(){ this.nodeLifecycle.stop(); nodes.clear(); this.nodeLifecycle.start() }, async registerModel(){} }
  const life = new NodeLifecycle(sceneGraph); sceneGraph.nodeLifecycle = life
  const play={ project:host.project, on:true, _sceneSignalReady:true, _referenceSession:{}, ed:sceneGraph, game:{api:{record:v=>events.push(v)},report:e=>errors.push(String(e.message||e))}, vm:{held:new Map()}, _tagLayerApi:()=>({}), _animMethodsFor:()=>({}), _persistMarked:()=>false, _persistSet:()=>false }
  play._nodeHandle = id => {
    const o = play.project.objects.find(item=>item.id===id)
    const mounted = nodes.get(id)
    if (!o || !mounted) return null
    return { id, name:o.name, is_valid:()=>play.on && nodes.get(id)?._lfNodeOwner===o,
      get object3D(){ return nodes.get(id) }, get type(){return o.type} }
  }
  life.scripts=new NodeScriptRuntime(play)
  return {host,sceneGraph,life,play,events,errors,pkg, async attach(){await host.attach(sceneGraph);life.start()},async switchTo(id){return host.switchScene(id)},stop(){life.stop()} }
}

test('INT-01: la escena inicial del Player activa su conexión ready (defecto de baseline)',async()=>{const f=makeFixture();await f.attach();assert.deepEqual(f.events,['received:']);assert.equal(f.life.scripts.sceneConnections.size,1);f.stop()})
test('INT-02: cambiar de escena cambia también la autoridad de signalConnections',async()=>{const f=makeFixture({scenes:{A:makeScene('A'),B:makeScene('B',{links:[link('fromB','em','rx','tree_entered')]})}});await f.attach();assert.equal(f.host.project.signalConnections[0].id,'A-link');await f.switchTo('B');assert.equal(f.host.project.signalConnections[0].id,'fromB');assert.equal(f.life.scripts.sceneConnections.size,1);assert.deepEqual(f.events,['received:','received:']);f.stop()})
test('INT-03: las conexiones de la escena anterior no permanecen en B vacía',async()=>{const f=makeFixture();await f.attach();assert.equal(f.life.scripts.sceneConnections.size,1);await f.switchTo('B');assert.equal(f.host.project.signalConnections.length,0);assert.equal(f.life.scripts.sceneConnections.size,0);assert.deepEqual(f.events,['received:']);f.stop()})
test('INT-04: regreso a A no duplica receptores anteriores',async()=>{const f=makeFixture();await f.attach();await f.switchTo('B');await f.switchTo('A');assert.deepEqual(f.events,['received:','received:']);assert.equal(f.life.scripts.sceneConnections.size,1);f.stop()})
test('INT-05: emisión Custom y argumentos en Player',async()=>{const scripts=[receive,script('emit-script',`node.define_signal('alerta'); function _ready(){node.emit_signal('alerta',23)}`)];const s=makeScene('A',{objects:[obj('em',['emit-script']),obj('rx',['rx-script'])],links:[link('custom','em','rx','alerta')]});const f=makeFixture({scenes:{A:s},scripts});await f.attach();assert.deepEqual(f.events,['received:23']);assert.deepEqual(f.errors,[]);f.stop()})
test('INT-06: publicación de callback generado y conexión persistente funcionan conjuntamente',async()=>{const code=buildNodeCallbackCode('function _ready() {}','receive');const f=makeFixture({scenes:{A:makeScene('A')},scripts:[script('rx-script',code)]});await f.attach();assert.equal(f.life.scripts.sceneConnections.size,1);assert.deepEqual(f.errors,[]);f.stop()})
test('INT-07: paquete antiguo sin campo de conexiones inicia con lista vacía',async()=>{const old=makeScene('A');delete old.signalConnections;const f=makeFixture({scenes:{A:old},meta:{signalConnections:[link('stale')]}});await f.attach();assert.equal(f.host.project.signalConnections.length,0);assert.equal(f.life.scripts.sceneConnections.size,0);f.stop()})
test('INT-08: paquete inválido se rechaza sin reemplazar la escena activa',async()=>{const bad=makeScene('B');bad.signalConnections={invalid:true};const f=makeFixture({scenes:{A:makeScene('A'),B:bad}});await f.attach();await assert.rejects(f.switchTo('B'),/Conexiones de señales inválidas/);assert.equal(f.host.project.activeSceneId,'A');assert.equal(f.host.project.signalConnections[0].id,'A-link');f.stop()})
test('INT-09: el host no modifica los registros de autoría originales',async()=>{const A=makeScene('A');const f=makeFixture({scenes:{A}});await f.attach();assert.deepEqual(A.signalConnections,[link('A-link')]);f.stop()})
test('INT-10: metadatos globales no deben suplantar conexiones de la escena',async()=>{const f=makeFixture({meta:{signalConnections:[link('stale')]}});await f.attach();assert.equal(f.host.project.signalConnections[0].id,'A-link');f.stop()})
test('INT-11: Stop limpia los enlaces y no borra los datos guardados',async()=>{const f=makeFixture();await f.attach();f.stop();assert.equal(f.life.scripts.sceneConnections.size,0);assert.equal(f.host.project.signalConnections.length,1)})
test('INT-12: ausencia de escena destino no muta las conexiones',async()=>{const f=makeFixture();await f.attach();assert.equal(await f.switchTo('missing'),false);assert.equal(f.host.project.activeSceneId,'A');assert.equal(f.host.project.signalConnections[0].id,'A-link');f.stop()})
test('INT-13: la serialización del Player conserva contenido por escena, sin conversión Godot',()=>{const s=file('src/engine/runtime/package/format.js');assert.match(s,/scenes\/\$\{s\.id\}\.json`, JSON\.stringify\(s\.data\)/);const p=file('src/core/project.js');assert.match(p,/SCENE_KEYS = \['objects', 'environment', 'terrain', 'signalConnections'\]/);assert.match(p,/const tree = authoredSceneTree\(project\)/);assert.match(p,/signalConnections: toRaw\(validateSignalConnections\(tree\.signalConnections\)\)/)})
test('INT-14: exportación Godot continúa bloqueada para señales sin conversión',()=>{assert.match(file('src/core/exporter.js'),/Exportación Godot bloqueada: las conexiones visuales de señales no tienen conversión soportada/)})
test('INT-15: las fuentes nativas conservan emisores implementados',()=>{for(const [type,name,source] of [['signal-s07-qa','ready','node-lifecycle'],['signal-s07-qa','animation_finished','animation-runner']])assert.equal(getNativeSignal(type,name)?.source,source)})
test('INT-16: no introduce buses paralelos, temporizadores o exploraciones por frame',()=>{const host=file('src/engine/runtime/package/host.js');assert.doesNotMatch(host,/new EventBus|setInterval\(|requestAnimationFrame\(/);assert.match(host,/sceneSignalConnections\(s\)/);assert.match(file('src/engine/runtime/scene/node-scripts.js'),/syncSceneConnections\(/)})
