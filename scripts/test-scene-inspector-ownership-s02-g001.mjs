import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeSky } from '../src/engine/runtime/render/skylib.js'
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const ui=src('src/components/ScenePanel.vue'), renderer=src('src/engine/runtime/render/viewport-env.js')
const project=src('src/core/project.js')
const checks=[
 ['S02-01: grupos Escena, Mundo y Recursos únicos',()=>{
  for(const g of ['scene','world','resources'])assert.equal((ui.match(new RegExp('data-owner-group="'+g+'"','g'))||[]).length,1)
 }],
 ['S02-02: orden de grupos',()=>assert.ok(ui.indexOf('data-owner-group="scene"')<ui.indexOf('data-owner-group="world"')&&ui.indexOf('data-owner-group="world"')<ui.indexOf('data-owner-group="resources"'))],
 ['S02-03: GameManager y transiciones son escena',()=>{
  const i=ui.indexOf('data-owner-group="world"');assert.ok(ui.indexOf('<h4>GameManager</h4>')<i);assert.ok(ui.indexOf('Transiciones de pantalla')<i)
 }],
 ['S02-04: nivel y clima dependen de ambiente de escena',()=>{
  assert.ok(ui.indexOf(' />Nivel</summary>')>ui.indexOf('data-owner-group="world"'));assert.match(ui,/env\(\)\.level/);assert.match(ui,/env\(\)\.weather/)
 }],
 ['S02-05: bake permanece único y después de entorno',()=>{
  assert.equal((ui.match(/<summary><Icon[^>]+\/>Iluminación horneada<\/summary>/g)||[]).length,1)
  assert.ok(ui.indexOf('Iluminación horneada')>ui.indexOf('data-owner-group="resources"'))
 }],
 ['S02-06: reset global pertenece al entorno y conserva semántica',()=>{
  assert.match(ui,/@click="resetSection\('all'\)"/);assert.match(ui,/store\.project\.environment = \{ \.\.\.def/)
  assert.match(ui,/const bake = env\(\)\.bake/)
 }],
 ['S02-07: reset de clima conserva claves heredadas',()=>{
  assert.match(ui,/weather: \['weather', \.\.\.Object\.keys\(SKY_DEFAULTS\).*'fog'/)
 }],
 ['S02-08: no se crea tercer estado de ownership',()=>{
  assert.match(ui,/const weatherConfigured = \(\) => !!env\(\)\.weather\?\.on/)
  assert.doesNotMatch(ui,/owner(Mode|State|Cache)\s*=/)
 }],
 ['S02-09: estado visual en meteorología',()=>assert.match(ui,/data-authority="weather"/)],
 ['S02-10: estado visual en cielo y luz',()=>{assert.match(ui,/data-authority="sky"/);assert.match(ui,/mode\(\) === 'manual'/)}],
 ['S02-11: nubes muestran autoridad y valores manuales',()=>{assert.match(ui,/data-authority="clouds"/);assert.match(ui,/:checked="sky\(\)\.cloudsOn"/)}],
 ['S02-12: niebla muestra autoridad sin borrar controles',()=>{assert.match(ui,/data-authority="fog"/);assert.match(ui,/:checked="env\(\)\.fog"/)}],
 ['S02-13: World sustituye nubes cuando hay frame',()=>{assert.match(renderer,/if \(w\.clouds\) Object\.assign\(e/);assert.match(renderer,/cloudsCoverage: w\.clouds\.coverage/)}],
 ['S02-14: World sustituye densidad/color/estado de niebla',()=>assert.match(renderer,/if \(w\.fog\) Object\.assign\(e, \{ fog: w\.fog\.on, fogDensity: w\.fog\.density, fogColor: w\.fog\.color \}\)/)],
 ['S02-15: modo manual conserva iluminación original',()=>assert.match(renderer,/if \(lightingMode\(env\) === 'manual'\) Object\.assign/)],
 ['S02-16: modelo de escena persiste environment sin schema nuevo',()=>{assert.match(project,/SCENE_KEYS = \['objects', 'environment', 'terrain'\]/);assert.match(project,/environment: toRaw\(project\.environment\)/)}],
 ['S02-17: campos manuales no se deshabilitan con clima',()=>{assert.match(ui,/cloudEdit\(\{ cloudsCoverage:/);assert.doesNotMatch(ui,/disabled="weatherConfigured/)}],
 ['S02-18: estilo usa tokens existentes',()=>{assert.match(ui,/background: var\(--g-800\)/);assert.match(ui,/border: 1px solid var\(--hair\)/)}],
 ['S02-19: no se altera ParamForm ni World',()=>{assert.match(ui,/<ParamForm :params="weatherBasic"/);assert.match(ui,/<ParamForm :params="weatherAdvanced"/);assert.match(ui,/const worldChanged = \(\) => updateEnvironment\(\{\}\)/)}],
 ['S02-20: panel estrecho usa minmax y min-width',()=>{assert.match(ui,/grid-template-columns: minmax\(0, 96px\) minmax\(0, 1fr\)/);assert.match(ui,/\.ownership-group \{[^}]*min-width: 0/)}],
 ['S02-21: elementos de transición no desaparecen',()=>{for (const t of ['Fade In al entrar','Fade Out al salir','Duración de salida','Duración de entrada','Espera inicial'])assert.ok(ui.includes(t))}],
 ['S02-22: persistencia del GameManager conservada',()=>{assert.match(ui,/@change="assignSceneGameManager\(/);assert.match(ui,/@click="newManagerHere"/)}],
 ['S02-23: no campos de clima en script ni eventos',()=>{assert.doesNotMatch(ui,/emit\('event'/);assert.doesNotMatch(ui,/addEventListener\(/)}],
 ['S02-24: valores manuales de nubes se conservan tras normalizar',()=>{const e={cloudsOn:true,cloudsCoverage:.47,cloudsDensity:1.38,cloudsAltitude:1675,cloudsWind:14};assert.equal(normalizeSky(e).cloudsCoverage,.47);assert.equal(normalizeSky(e).cloudsDensity,1.38)}],
]
for(const [name,fn] of checks)test(name,fn)
