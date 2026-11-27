import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { matchSceneSections, sceneFoldPreferred, filterSceneInspector } from '../src/components/scene-inspector-search.js'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const scene = read('src/components/ScenePanel.vue')
const inspector = read('src/components/Inspector.vue')
const dock = read('src/components/InspectorDock.vue')
const entries = [
  { id:'world', parent:null, heading:'Mundo', text:'Mundo' },
  { id:'weather', parent:'world', heading:'Clima', text:'Clima intensidad' },
  { id:'advanced', parent:'weather', heading:'Avanzado', text:'Avanzado Dirección del viento' },
  { id:'sky', parent:'world', heading:'Cielo', text:'Cielo exposición' },
  { id:'scene', parent:null, heading:'Escena', text:'Escena' },
]
test('Búsqueda sin acentos y propagación a ancestros', () => assert.deepEqual([...matchSceneSections(entries,'DIRECCION')].sort(), ['advanced','weather','world']))
test('Coincidencia de encabezado muestra descendientes', () => assert.deepEqual([...matchSceneSections(entries,'clima')].sort(), ['advanced','weather','world']))
test('Búsqueda sin coincidencias y consulta vacía', () => { assert.equal(matchSceneSections(entries,'ausente').size,0); assert.equal(matchSceneSections(entries,'').size,5) })
test('Preferencias de plegado con identidad existente', () => { const el={dataset:{sceneFold:'world',foldDefault:'open'}};assert.equal(sceneFoldPreferred(el,{}),true);assert.equal(sceneFoldPreferred(el,{'fold:scene:world':true}),false) })
test('Aislamiento temporal de búsqueda y recuperación de pliegues', () => {
  const make=(name,heading,open,parent=null)=>{const el={dataset:{sceneFold:name,foldDefault:open?'open':'closed'},open,hidden:false,parentElement:{closest:()=>parent},querySelector:()=>({textContent:heading}),querySelectorAll:()=>[]};return el}
  const world=make('world','Mundo',false), sky=make('sky','Cielo',false,world), scene=make('scene','Escena',true)
  const root={querySelectorAll:()=>[world,sky,scene]},prefs={'fold:scene:world':true}
  assert.equal(filterSceneInspector(root,'Cielo',prefs).found,true);assert.equal(world.open,true);assert.equal(sky.open,true);assert.equal(scene.hidden,true)
  assert.deepEqual(prefs,{'fold:scene:world':true});filterSceneInspector(root,'',prefs);assert.equal(world.open,false);assert.equal(sky.open,false);assert.equal(scene.hidden,false);assert.equal(scene.open,true)
})
test('No hay cabecera duplicada y el título permanece en el dock',()=>{assert.doesNotMatch(inspector,/class="head scenehead"/);assert.match(inspector,/<ScenePanel \/>/);assert.match(dock,/activeScene\(\)\?\.name/);assert.match(dock,/filterSceneInspector\(scene, query.value/);assert.match(scene,/data-scene-inspector/);assert.match(scene,/el.dataset.sceneSearch === 'true'/)})
test('Tres autoridades e iconos nativos por sección',()=>{assert.equal((scene.match(/data-owner-group=/g)||[]).length,3);assert.equal((scene.match(/data-scene-fold="[\w-]+"/g)||[]).length,(scene.match(/<summary(?: class="owner-heading")?><Icon /g)||[]).length)})
test('Sliders y campos numéricos comparten valor y acción',()=>{const rows=[...scene.matchAll(/<div class="scene-range"[^>]*>([\s\S]*?)<\/div>/g)];assert.equal(rows.length,44);for(const [,row] of rows){const slider=row.match(/<input [^>]+>/)[0], field=row.match(/<NumberField [^>]+>/)[0];const attr=(s,n)=>s.match(new RegExp(n+'="([^"]+)"'))[1];assert.equal(attr(slider,':value'),attr(field,':modelValue'));assert.equal(attr(slider,'@input').replace('+$event.target.value','+$event'),attr(field,'@update:modelValue'));for(const k of ['min','max','step'])assert.equal(attr(slider,k),attr(field,':'+k));if(slider.includes('@change='))assert.equal(attr(slider,'@change'),attr(field,'@commit'))}})
test('Ciclo horario usa valor y acción existentes sin GPU',()=>{assert.match(scene,/clock-band/);assert.match(scene,/env\(\).time.hour = \+\$event; updateEnvironment\(\{\}, false\)/);assert.match(scene,/solarPosition\(t.hour/);assert.doesNotMatch(scene,/WebGLRenderer|requestAnimationFrame|<canvas/);assert.match(scene,/@container scene-inspector \(max-width: 260px\)/)})
test('Plegado global reconoce las secciones nativas de escena',()=>{assert.match(dock,/scene.querySelectorAll\('details\[data-scene-fold\]:not\(\[hidden\]\)'\)/);assert.match(dock,/fold:scene:\$\{el.dataset.sceneFold\}/)})
test('Horneado conserva acciones y distingue progreso y resultado',()=>{for(const action of ['runBake','cancelBake','clearBake','doBakeTerrain','clearSceneTerrainBake'])assert.ok(scene.includes('@click="'+action+'"'));assert.match(scene,/role="progressbar"/);assert.match(scene,/scene-bake-result/);assert.match(scene,/Horneado desactualizado/)})
test('Fixture utiliza constructor nativo y checks completos',()=>{const f=read('scripts/fixtures/editor/scene-inspector-professional-ux.html');assert.match(f,/createProjectData\(/);const n=(f.match(/\bcheck\('/g)||[]).length;assert.ok(n>=15);assert.match(f,new RegExp('checks.length === '+n));assert.match(read('scripts/test-scene-inspector-professional-ux-electron.mjs'),new RegExp('minChecks: '+n))})
