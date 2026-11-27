import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TEMPLATES, DEFAULT_TEMPLATE, LEGACY_TEMPLATE, getTemplate } from '../src/core/templates/index.js'
import { defaultDatabase, emptyDatabase, normalizeDatabase } from '../src/engine/runtime/database/schema.js'
import { Party } from '../src/engine/runtime/database/rules.js'
import { defaultInputMap, normalizeInputMap } from '../src/engine/runtime/input/inputmap.js'

const file = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const project = file('src/core/project.js')
const stateProject = file('src/core/state/project.js')
const hub = file('src/components/WelcomeScreen.vue')
const databasePanel = file('src/components/DatabaseModal.vue')

// Prueba las funciones reales de creación, aislando los servicios de almacenamiento,
// Vue y Three.js; aquí lo importante es qué registros y objetos genera la plantilla.
const sceneFn = project.slice(project.indexOf('export function createSceneContent('), project.indexOf('export function createProjectData(')).replace('export function ', 'function ')
const createFn = project.slice(project.indexOf('export function createProjectData('), project.indexOf('/** Campos que pertenecen a la escena')).replace('export function ', 'function ')
const createFixture = new Function('getTemplate','DEFAULT_TEMPLATE','defaultEnvironment','DEFAULT_LAYERS','makeObject','uid', 'PROJECT_VERSION','FORMAT_VERSION','defaultSettings','DEFAULT_FOLDERS','rendererPreset','presetOf','defaultAudio','normalizeLoc','BAKE_DEFAULTS','emptyDatabase','defaultDatabase','defaultInputMap','defaultTagLayers','defaultTheme','emptySlots','SCENE_FADE_DEFAULTS', `${sceneFn}\n${createFn}\nreturn createProjectData`)(
  getTemplate, DEFAULT_TEMPLATE, ()=>({sky:'original'}), [{name:'Base'}], (type,kind,extra)=>({type,kind,...extra}), (prefix='')=>prefix+'id',
  3, 2, ()=>({}), ['Assets','Assets/Scenes'], (r)=>({renderer:r}), ()=>({}), ()=>({}), ()=>({}), {},
  emptyDatabase, defaultDatabase, defaultInputMap, ()=>({}), ()=>({}), ()=>({}), {},
)

test('HUB-01 · la plantilla Empty tiene ID nuevo sin secuestrar el legado',()=>{
  assert.equal(DEFAULT_TEMPLATE, 'empty-project');assert.equal(LEGACY_TEMPLATE,'empty')
  assert.notEqual(DEFAULT_TEMPLATE, LEGACY_TEMPLATE)
})
test('HUB-02 · First Person mantiene el identificador anterior',()=>{
  assert.equal(getTemplate('empty').game.player, 'native');assert.equal(getTemplate('empty').game.player,'native')
  assert.equal(getTemplate('empty').scene.length,1)
})
test('HUB-03 · blank clásico preserva cámara y sol',()=>{
  assert.equal(getTemplate('blank').game.player,'none');assert.equal(getTemplate('blank').scene.length,2)
})
test('HUB-04 · Empty no tiene Spawn, sol, cámara ni contenido',()=>{
  assert.deepEqual(getTemplate(DEFAULT_TEMPLATE).scene,[])
  assert.equal(getTemplate(DEFAULT_TEMPLATE).game.player,'none')
})
test('HUB-05 · todas las plantillas declaran tipo Player',()=>{
  assert.ok(TEMPLATES.every((t)=>['none','native'].includes(t.game.player)))
  assert.equal(new Set(TEMPLATES.map((t)=>t.id)).size,TEMPLATES.length)
})
test('HUB-06 · la Database Empty no incluye protagonista ni muestras',()=>{
  const db=emptyDatabase();assert.equal(db.noPlayer,true)
  for (const key of ['actors','classes','skills','items','weapons','armors','enemies','states','commonEvents','quests','lore']) assert.deepEqual(db[key],[],key)
  assert.equal('player' in db,false);assert.deepEqual(db.system.party,[])
})
test('HUB-07 · normalizar Empty no inventa un registro de jugador',()=>{
  const db=normalizeDatabase(emptyDatabase());assert.equal('player' in db,false);assert.equal(db.noPlayer,true)
})
test('HUB-08 · sucesivas normalizaciones conservan ausencia del jugador',()=>{
  const once=normalizeDatabase(emptyDatabase());const twice=normalizeDatabase(JSON.parse(JSON.stringify(once)))
  assert.deepEqual(twice,once);assert.equal('player' in twice,false)
})
test('HUB-09 · runtime Party acepta Database sin jugadores',()=>{
  const db=normalizeDatabase(emptyDatabase());const party=new Party(db)
  assert.deepEqual(party.members,[]);assert.deepEqual(party.actors,{})
})
test('HUB-10 · Database antigua sin player sigue creando el registro legado',()=>{
  const old={switches:[],variables:[],actors:[],system:{party:[]}}
  assert.ok(normalizeDatabase(old).player)
})
test('HUB-11 · First Person conserva actor, registro de jugador y grupo',()=>{
  const db=normalizeDatabase(defaultDatabase());assert.ok(db.player);assert.equal(db.actors.length,1);assert.ok(db.system.party.length)
})
test('HUB-12 · juego Empty no requiere asignaciones de entrada',()=>{
  const p=createFixture('Mi Empty', 'empty-project')
  assert.equal(p.game.player,'none')
  assert.ok(p.inputMap.actions.every((x)=>x.bindings.length===0))
  assert.ok(normalizeInputMap(p.inputMap).actions.every((x)=>x.bindings.length===0))
})
test('HUB-13 · Empty creado tiene cero objetos y terreno desactivado',()=>{
  const p=createFixture('Mi Empty', 'empty-project')
  assert.deepEqual(p.objects,[]);assert.equal(p.terrain.enabled,false)
  assert.equal(p.database.noPlayer,true);assert.equal('player' in p.database,false)
  assert.equal(p.scenes.length,1)
})
test('HUB-14 · FPS sólo crea sol, conserva Prefab en Assets y bindings originales',()=>{
  const p=createFixture('FPS', 'empty');assert.equal(p.objects.length,1)
  assert.equal(p.objects.filter((o)=>o.type==='spawn').length,0)
  assert.ok(p.prefabs.some(f=>f.name==='Personaje FPS'))
  assert.ok(p.inputMap.actions.some((a)=>a.bindings.length))
  assert.ok(p.database.player);assert.equal(p.terrain.enabled,true)
})
test('HUB-15 · plantilla clásica mantiene su cámara principal y terreno',()=>{
  const p=createFixture('Legacy', 'blank');assert.equal(p.objects.length,2)
  assert.ok(p.objects.some((o)=>o.type==='camera' && o.props.main))
  assert.equal(p.terrain.enabled,true)
})
test('HUB-16 · proyecto nuevo conserva renderizador seleccionado',()=>{
  const p=createFixture('Empty Compat','empty-project',{renderer:'compat'});assert.equal(p.render.renderer,'compat')
})
test('HUB-17 · creación conserva el ID de plantilla y flags para guardar',()=>{
  const p=createFixture('Empty');assert.equal(p.template,'empty-project');assert.equal(p.database.noPlayer,true)
  assert.equal(p.game.player,'none')
})
test('HUB-18 · importación y normalización preservan el template antiguo',()=>{
  assert.match(project, /meta\.template = meta\.template \|\| LEGACY_TEMPLATE/)
  assert.match(project, /meta\.database = normalizeDatabase\(meta\.database, meta\.game\)/)
})
test('HUB-19 · terreno Empty persiste desactivado en el guardado',()=>{
  assert.match(stateProject,/content\.terrain\.enabled === false/)
  assert.match(stateProject,/t\.enabled = false/)
  assert.match(stateProject,/t\.serialize\(\)/)
})
test('HUB-20 · modo sin jugador acepta Database ausente',()=>{
  const p=file('src/engine/runtime/player/none/index.js');assert.match(p,/if \(!c\) return/)
  assert.match(file('src/engine/runtime/events/play-camera.js'),/no hay cámara activa/)
})
test('HUB-21 · navegación del Hub conserva recientes, importación y borrado seguro',()=>{
  for(const token of ['openRecent','duplicateProject','openLfprojDialog','openFromFolder','removeProject','isProjectOpen']) assert.ok(hub.includes(token),token)
  assert.match(hub, /if \(isProjectOpen\(p\.id\)\) return toast/)
})
test('HUB-22 · la creación usa un diálogo del Hub con selector de plantilla',()=>{
  assert.match(hub, /data-testid="hub-create"/)
  assert.match(hub, /template-grid/);assert.match(hub, /project-settings/)
  assert.match(hub, /createDialog\.value\.showModal\(\)/)
  assert.match(hub, /<select id="hub-project-template" v-model="template">/)
  assert.match(hub, /@submit\.prevent="create"/)
})
test('HUB-23 · navegador de plantillas preparado para próximos Players',()=>{
  assert.match(hub,/v-for="t in featured"/);assert.match(hub, /t\.game\.player/)
  assert.match(hub, /v-for="t in legacy"/)
})
test('HUB-24 · todos los renderizadores anteriores continúan seleccionables',()=>{
  assert.match(hub,/v-for="r in RENDERERS"/)
  assert.match(hub,/\{ renderer: renderer.value \}/)
})
test('HUB-25 · Database no muestra Jugador en Empty',()=>{
  assert.match(databasePanel,/db\.value\?\.noPlayer/)
  assert.match(databasePanel,/ui\.section === 'player' && !db\.noPlayer/)
})
test('HUB-26 · no se cambian identificadores de recursos previos ni registros RPG',()=>{
  assert.deepEqual(TEMPLATES.map((x)=>x.id),['empty-project','blank','empty'])
  assert.equal('noPlayer' in defaultDatabase(),false)
})
test('HUB-27 · crear Empty no altera colecciones del esquema antiguo',()=>{
  const db=emptyDatabase(); const clean=normalizeDatabase(db)
  assert.equal(Object.keys(clean).length,Object.keys(db).length)
  assert.ok(Object.hasOwn(clean,'system'));assert.deepEqual(clean.system.party,[])
})
