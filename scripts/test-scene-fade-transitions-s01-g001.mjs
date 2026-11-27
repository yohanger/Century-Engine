// LF-SCENE-FADE-TRANSITIONS-S01-G001 · persistencia, prioridad y rutas del motor.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeSceneTransitions, SCENE_FADE_DEFAULTS, sceneFadeSeconds, fadeState, sceneFadeState } from '../src/engine/runtime/events/scene-transitions.js'
const src = (p) => readFileSync(new URL('../' + p, import.meta.url),'utf8')
const project = src('src/core/project.js')
const scenePanel = src('src/components/ScenePanel.vue')
const state = src('src/core/state/project.js')
const player = src('src/runtime-app/RuntimeApp.vue')
const play = src('src/engine/runtime/events/play.js')
const nodes = src('src/engine/runtime/events/play-nodes.js')
const pack = src('src/engine/runtime/package/format.js')
const history = src('src/core/state/history.js')

function gotoFixture({ configA, configB, fadeOut, fadeIn, color, fail = false } = {}) {
  const beginning = nodes.indexOf('  async _gotoScene({')
  const end = nodes.indexOf('\n  },\n}',beginning)
  assert.ok(beginning > 0 && end > beginning,'Método real _gotoScene disponible')
  const code = nodes.slice(beginning,end+4).replace(/^  async _gotoScene/,'async function _gotoScene')
  const fn = new Function('normalizeSceneTransitions','sceneFadeSeconds','sceneFadeState','NEVER','DEG','loadNavCache',code+';return _gotoScene')(normalizeSceneTransitions,sceneFadeSeconds,sceneFadeState,Promise.resolve(),Math.PI/180,async()=>{})
  const p = {activeSceneId:'a',scenes:[{id:'a',name:'A',transitions:configA},{id:'b',name:'B',transitions:configB}]}
  const calls=[]
  const ctx = {project:p,state:{fade:fadeState('in',0)},on:true,rt:{async switchScene(id){if(fail)throw Error('Error carga');p.activeSceneId=id;calls.push('switch');return true}},
    _placeAtSpawn(){calls.push('spawn')},_rememberEventPhysics(){},_gpCapture(){},_persistBeforeScene(){},_teardownScene(){},_persistAfterScene(){},
    _setupScene(){calls.push('setup')},_prefabClearRuntime(){},_cameraReset(){},_teleport(){},ed:{_persistRetainIds:null},vp:{},cam:{},showPlayView(){},
    audio:{resetSources(){}},_persistObjects:new Map(),game:{emit:async()=>{},db:{player:{}},saves:{busy:false}},
  }
  return {ctx,p,calls,run:()=>fn.call(ctx,{scene:'b',tag:'player',fadeOut,fadeIn,color})}
}

test('SFT-01: escena histórica sin config no recibe nuevos fades',()=>{
  const v=normalizeSceneTransitions();assert.equal(v.enter,false);assert.equal(v.exit,false)
  assert.equal(sceneFadeSeconds(v,'in'),0);assert.equal(sceneFadeSeconds(v,'out'),0)
})
test('SFT-02: nuevas escenas reciben entrada, salida, color y ritmo declarados',()=>{
  assert.equal(SCENE_FADE_DEFAULTS.enter,true);assert.equal(SCENE_FADE_DEFAULTS.exit,true)
  assert.match(project,/transitions: \{ \.\.\.SCENE_FADE_DEFAULTS \}/)
  assert.match(state,/transitions: \{ \.\.\.SCENE_FADE_DEFAULTS \}/)
})
test('SFT-03: duplicar escena conserva su transición sin compartir referencia',()=>assert.match(state,/transitions: clone\(src\.transitions\)/))
test('SFT-04: entradas inválidas no entran en el render ni valores negativos',()=>{
  const v=normalizeSceneTransitions({enter:true,exit:true,inSeconds:-5,outSeconds:Infinity,delay:500,color:'bad',curve:'oops'})
  assert.equal(v.inSeconds,0);assert.equal(v.outSeconds,SCENE_FADE_DEFAULTS.outSeconds)
  assert.equal(v.delay,60);assert.equal(v.color,'#000000');assert.equal(v.curve,'ease-in-out')
})
test('SFT-05: cero explícito prevalece sobre Fade In/Out configurados',()=>{
  assert.equal(sceneFadeSeconds(SCENE_FADE_DEFAULTS,'in',0),0)
  assert.equal(sceneFadeSeconds(SCENE_FADE_DEFAULTS,'out',0),0)
})
test('SFT-06: fadeState conserva una duración y curva consistente',()=>{
  assert.deepEqual(fadeState('out',1.25,'#135791','ease-out'),{color:'#135791',alpha:1,ms:1250,curve:'ease-out'})
  assert.equal(fadeState('in',0).alpha,0)
})
test('SFT-07: la metadata se guarda en project.scenes y se edita con historial',()=>{
  assert.match(scenePanel,/const scene = activeScene\(\)/)
  assert.match(scenePanel,/scene\.transitions =/)
  assert.match(scenePanel,/commit\('Transiciones de escena'\)/)
  assert.match(history,/scenes: JSON\.stringify\(toRaw\(p\.scenes \|\| \[\]\)\)/)
  assert.match(history,/if \(e\.scenes\) p\.scenes = JSON\.parse\(e\.scenes\)/)
})
test('SFT-08: UI de escena permite controles independientes, espera, color y curva',()=>{
  for(const v of ['Fade In al entrar','Fade Out al salir','Espera inicial','Duración de entrada','Duración de salida','Color','Ritmo'])assert.ok(scenePanel.includes(v),v)
})
test('SFT-09: paquete Player conserva únicamente config de transición de escena seleccionada',()=>{
  assert.match(pack,/data\.scenes\?\.find\(\(entry\) => entry\.id === s\.id\)/)
  assert.match(pack,/transitions: source\.transitions/)
})
test('SFT-10: Player utiliza su overlay de carga original para la entrada inicial',()=>{
  assert.match(player,/const settings = normalizeSceneTransitions\(scene\?\.transitions\)/)
  assert.match(player,/startFadeOut\(settings\.enter \? settings\.delay : 0\)/)
  assert.equal((player.match(/class="overlay"/g)||[]).length,1)
  assert.match(play,/!this\.runtime && !film && entering\.enter/)
})
test('SFT-11: Play Editor cubre antes de revelar y limpia el timer al detenerse',()=>{
  assert.match(play,/startupCover/);assert.match(play,/_sceneFadeTimer = setTimeout/)
  assert.match(play,/clearTimeout\(this\._sceneFadeTimer\)/)
})
test('SFT-12: sistema de UI único respeta easing y no sobrescribe fundido personalizado',()=>{
  assert.match(src('src/engine/runtime/ui/defaults.js'),/transitionTimingFunction: play\.fade\.curve/)
  assert.match(src('src/engine/runtime/ui/system.js'),/d\.code === OLD_FADE_UI/)
})
test('SFT-13: el comando fade y los scripts siguen usando la autoridad play.fade',()=>{
  assert.match(src('src/engine/runtime/events/play-host.js'),/this\.state\.fade = fadeState\(dir/)
  assert.match(src('src/engine/runtime/events/interpreter.js'),/gotoScene/)
})
test('SFT-14: el cambio de escena aplica sus duraciones si faltan argumentos',async()=>{
  const f=gotoFixture({configA:{...SCENE_FADE_DEFAULTS,outSeconds:0.005},configB:{...SCENE_FADE_DEFAULTS,inSeconds:0.005,delay:0}})
  await f.run();assert.equal(f.p.activeSceneId,'b');assert.equal(f.ctx.state.fade.alpha,0);assert.equal(f.ctx.state.fade.ms,5)
})
test('SFT-15: parámetros explícitos de duración cero hacen corte sin fades',async()=>{
  const f=gotoFixture({configA:SCENE_FADE_DEFAULTS,configB:SCENE_FADE_DEFAULTS,fadeOut:0,fadeIn:0})
  await f.run();assert.equal(f.p.activeSceneId,'b');assert.equal(f.ctx.state.fade.alpha,0)
  assert.equal(f.ctx.state.fade.ms,0)
})
test('SFT-16: no se filtra el color si se sobrescribe desde un script',async()=>{
  const f=gotoFixture({configA:{...SCENE_FADE_DEFAULTS,outSeconds:0.002},configB:{...SCENE_FADE_DEFAULTS,inSeconds:0.002,delay:0},color:'#f02040'})
  await f.run();assert.equal(f.ctx.state.fade.color,'#f02040')
})
test('SFT-17: fallos al cargar no dejan una pantalla opaca permanente',async()=>{
  const f=gotoFixture({configA:{...SCENE_FADE_DEFAULTS,outSeconds:0.001},configB:SCENE_FADE_DEFAULTS,fail:true})
  await assert.rejects(f.run(),/Error carga/);assert.equal(f.ctx.state.fade.alpha,0)
})
test('SFT-18: no se modifica el renderer ni la cámara para crear un segundo fade',()=>{
  assert.doesNotMatch(play,/new .*FadeRenderer/)
  assert.match(player,/class="overlay"/)
})
