// Contrato G003_CORR-001: configuración celestial sin autoridades redundantes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { lightingMode, celestialTime, selectedSun } from '../src/engine/runtime/world/lighting.js'
import { normalizeWorld, normalizeTime } from '../src/engine/runtime/world/params.js'
import { World } from '../src/engine/runtime/world/world.js'
import { normalizeLight } from '../src/engine/runtime/render/lightlib.js'
import { environmentMethods } from '../src/engine/runtime/scene/environment.js'
import { lightMethods } from '../src/engine/runtime/events/play-light.js'
import { getDef, makeObject } from '../src/engine/runtime/nodes/index.js'

const read = (name) => readFileSync(new URL('../' + name, import.meta.url), 'utf8')
const scene = read('src/components/ScenePanel.vue')
const vpSource = read('src/engine/runtime/render/viewport-env.js')
const lightSource = read('src/engine/runtime/nodes/light.js')
const inspector = read('src/components/Inspector.vue')

function light(id, { visible=true, type='directional' }={}) { return { id, type:'light', light:{ type }, visible } }

test('CORR-01: escenas sin modo nuevo preservan el contrato heredado', () => {
  assert.equal(lightingMode({time:{on:true, celestialLights:false}}),'legacy')
  assert.deepEqual(normalizeWorld({time:{on:true, celestialLights:false}}).time, normalizeTime({on:true,celestialLights:false}))
})
test('CORR-02: solo manual/ciclo son modos explícitos válidos', () => {
  assert.equal(lightingMode({lightingMode:'manual'}),'manual')
  assert.equal(lightingMode({lightingMode:'cycle'}),'cycle')
  assert.equal(lightingMode({lightingMode:'invalid'}),'legacy')
})
test('CORR-03: modo manual impide hora y la luna separados aunque haya flags antiguos', () => {
  const t=celestialTime({lightingMode:'manual',time:{on:true,celestialLights:true,astro:true,hour:4}})
  assert.equal(t.on,false);assert.equal(t.celestialLights,false);assert.equal(t.astro,true);assert.equal(t.hour,4)
})
test('CORR-04: ciclo dirige ambas luces sin necesitar interruptor celestialLights', () => {
  const t=normalizeWorld({lightingMode:'cycle',time:{on:false,celestialLights:false,hour:3}}).time
  assert.equal(t.on,true); assert.equal(t.celestialLights,true);assert.equal(t.hour,3)
})
test('CORR-05: World modo manual conserva el clima pero no activa reloj', () => {
  const w=new World().configure({lightingMode:'manual',time:{on:true},weather:{on:true,preset:'cloudy'}})
  assert.equal(w.timeOn,false);assert.equal(w.weatherOn,true);assert.equal(w.frame().timeOn,false)
})
test('CORR-06: World ciclo publica sol y luna independientes', () => {
  const w=new World().configure({lightingMode:'cycle',time:{on:false, hour:0, moonLight:0.2}})
  assert.equal(w.timeOn,true);assert.equal(w.cfg.time.celestialLights,true)
  const f=w.frame();assert.ok(Array.isArray(f.sunDir));assert.ok(Array.isArray(f.moonDir))
})
test('CORR-07: sol asignado por ID tiene prioridad frente al orden de jerarquía', () => {
  const objects=[light('a'),light('b'),light('c',{visible:false}),light('d',{type:'area'})]
  assert.equal(selectedSun(objects,{sunLightId:'b'}).id,'b')
  assert.equal(selectedSun(objects,{sunLightId:'a'}).id,'a')
})
test('CORR-08: sol asignado oculto o eliminado no impide usar la luz visible', () => {
  const objects=[light('a'),light('b',{visible:false})]
  assert.equal(selectedSun(objects,{sunLightId:'b'}).id,'a')
  assert.equal(selectedSun(objects,{sunLightId:'z'}).id,'a')
  assert.equal(selectedSun([],{sunLightId:'z'}),null)
})
test('CORR-09: Lensflare funciona en los cuatro tipos y permanece opt-in', () => {
  for(const type of ['omni','spot','directional','area']) {
    assert.equal(normalizeLight({type}).flareOn,false)
    assert.equal(normalizeLight({type,flareOn:true}).flareOn,true)
  }
  assert.equal(normalizeLight({type:'invalid',flareOn:true}).flareOn,false)
})
test('CORR-10: direccional usa fuente óptica lejana y área centrada', () => {
  assert.match(lightSource,/updateFlareCamera = \(camera\) =>/)
  assert.match(lightSource,/Math\.min\(1000, camera\.far \* 0\.6\)/)
  assert.match(read('src/engine/runtime/scene-graph.js'), /updateFlareCamera\?\.\(this\.vp\.camera\)/)
  assert.match(lightSource,/light\.add\(effect\)/)
  assert.match(inspector,/\['omni', 'spot', 'directional', 'area'\]\.includes\(obj\.light\.type\)/)
})
test('CORR-11: los proyectos nuevos eligen modo manual por defecto', () => {
  assert.match(read('src/core/project.js'),/lightingMode: 'manual', sunLightId: ''/)
  assert.match(read('src/engine/runtime/world/params.js'),/normalizeTime\(celestialTime\(env\)\)/)
})
test('CORR-12: el panel oculta las opciones redundantes en el modo nuevo', () => {
  assert.match(scene,/Manual<\/option><option value="cycle">Ciclo día\/noche/)
  assert.match(scene,/v-if="mode\(\) === 'legacy'"/)
  assert.match(scene,/sunLightId: \$event\.target\.value/)
  assert.match(scene,/\!\['on', 'hour', 'flow', 'celestialLights'\]/)
})
test('CORR-13: reset general requiere confirmación, registra Undo y conserva baking', () => {
  assert.match(scene,/window\.confirm/);assert.match(scene,/store\.project\.environment = \{ \.\.\.def, \.\.\.\(bake \? \{ bake \} : \{\}\) \}/)
  assert.match(scene,/commit\('Restablecer entorno'\)/)
  assert.match(scene,/resetSection\('all'\)/)
})
test('CORR-14: reset por secciones no toca nodos, modelos ni objetos', () => {
  assert.match(scene,/resetSection\('celestial'\)/)
  assert.match(scene,/resetSection\('sky'\)/)
  assert.match(scene,/resetSection\('weather'\)/)
  assert.match(scene,/updateEnvironment\(patch\)/)
})
function sceneWithSun() {
  const sun = makeObject('light', 'directional', { id: 'sun' })
  const fill = makeObject('light', 'directional', { id: 'fill' })
  sun.color = '#c6eeef'
  sun.light.energy = 1.7
  sun.light.temperature = 6200
  const env = { lightingMode: 'cycle', sunLightId: sun.id, weather: { on: true, preset: 'clear' } }
  const project = { objects: [fill, sun], environment: env }
  const nodes = new Map()
  const scene = new THREE.Scene()
  const def = getDef('light')
  for (const obj of project.objects) {
    const node = def.build(obj)
    def.update(node, obj)
    scene.add(node)
    nodes.set(obj.id, node)
  }
  const world = new World().configure(env)
  const vp = { scene, invalidateShadows() {}, requestRender() {}, setSun(sun) { this.sun = sun } }
  const graph = { ...environmentMethods, host: { project, view: { lights: true } }, nodes, world, vp }
  return { graph, world, vp, project, env, sun, fill, node: nodes.get(sun.id), fillNode: nodes.get(fill.id) }
}

test('CORR-15: al entrar en manual se restaura la luz anterior sin volver a modificarla', () => {
  const { graph, world, vp, env, node } = sceneWithSun()
  const { light } = node.userData
  const base = [light.intensity, light.color.getHex(), node.quaternion.toArray()]
  world.setWeather('rain', 1)
  graph._worldSun()
  assert.ok(light.intensity < base[0])
  env.lightingMode = 'manual'
  world.configure({ ...env, weather: { on: true, preset: 'rain' } })
  graph._updateSun()
  assert.deepEqual([light.intensity, light.color.getHex(), node.quaternion.toArray()], base)
  assert.equal(graph._worldSunBinding, null)
  assert.equal(node.userData.environmentSun, undefined)
  const manualDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(node.quaternion)
  assert.ok(manualDirection.distanceTo(new THREE.Vector3(...vp.sun.dir)) < 1e-10)
  graph._worldSun()
  assert.deepEqual([light.intensity, light.color.getHex(), node.quaternion.toArray()], base)
})

test('El sol aplica la transición meteorológica a la energía y al color del emisor', () => {
  const { graph, world, sun, node, fillNode } = sceneWithSun()
  const { light } = node.userData
  const base = structuredClone(sun)
  const blueRed = () => light.color.b / light.color.r
  graph._worldSun()
  const noon = { intensity: light.intensity, tone: blueRed() }
  assert.equal(noon.intensity, sun.light.energy * Math.PI)
  assert.ok(noon.tone > 1) // Conserva el tinte cian configurado en el nodo.
  world.setHour(6)
  graph._worldSun()
  assert.ok(light.intensity < noon.intensity && blueRed() < noon.tone)
  world.setHour(12)
  world.setWeather('rain', 1, 2)
  world.update(1)
  graph._worldSun()
  const during = { intensity: light.intensity, tone: blueRed() }
  world.update(1)
  graph._worldSun()
  assert.ok(noon.intensity > during.intensity && during.intensity > light.intensity)
  assert.ok(noon.tone < during.tone && during.tone < blueRed())
  world.setHour(0)
  graph._worldSun()
  assert.equal(light.visible, false)
  assert.equal(light.intensity, 0)
  assert.ok(graph._worldMoon.intensity > 0 && graph._worldMoon.color.b > graph._worldMoon.color.r)
  assert.equal(fillNode.userData.light.intensity, Math.PI)
  assert.deepEqual(sun, base)
})

test('Cambiar el sol asignado devuelve la luz anterior a su dirección, energía y color base', () => {
  const { graph, world, env, fill, node, fillNode } = sceneWithSun()
  const { light } = node.userData
  const base = [light.intensity, light.color.getHex(), node.quaternion.toArray()]
  world.setWeather('rain', 1)
  graph._worldSun()
  env.sunLightId = fill.id
  graph._updateSun()
  assert.deepEqual([light.intensity, light.color.getHex(), node.quaternion.toArray()], base)
  assert.equal(node.userData.environmentSun, undefined)
  assert.equal(graph._worldSunBinding.node, fillNode)
  assert.ok(fillNode.userData.light.intensity < Math.PI)
})

test('Scripting y Timeline redibujan los valores temporales con la modulación del sol', async () => {
  const { graph, world, project, sun, node, vp } = sceneWithSun()
  const runtime = { ...lightMethods, project, ed: graph, vp, on: true }
  runtime._lightInit()
  const handle = runtime._lightHandle(sun)
  const { light } = node.userData
  graph._worldSun()
  world.setWeather('rain', 1)
  graph._worldSun()
  const multiplier = world.frame().sunDirectMul
  const temp = getDef('light').animation['light.temperature']
  const original = temp.capture(node)
  const before = light.color.getHex()
  temp.apply(node, 3000)
  assert.notEqual(light.color.getHex(), before)
  await handle.fadeTo({ energy: 0.5, color: '#ddbb88' }, 0)
  assert.equal(handle.energy, 0.5)
  assert.equal(light.intensity, 0.5 * Math.PI * multiplier)
  const linked = light.color.getHex()
  graph._worldSun()
  assert.equal(light.intensity, 0.5 * Math.PI * multiplier)
  assert.equal(light.color.getHex(), linked)
  assert.equal(handle.color, '#ddbb88')
  temp.restore(node, original)
  assert.notEqual(light.color.getHex(), linked)
  handle.on = false
  graph._worldSun()
  assert.equal(light.visible, false)
  assert.equal(sun.light.energy, 1.7)
  assert.equal(sun.light.temperature, 6200)
})

test('CORR-16: cielo manual conserva su paleta y ambiente con clima activo', () => {
  const code=vpSource.replace(/^import .*\n/gm,'').replace('export const envMethods =','const envMethods =')
  const m=new Function('lightingMode',code+'\nreturn envMethods')(lightingMode)
  const e={lightingMode:'manual',skyTop:'#abcdef',skyHorizon:'#123456',ground:'#223344',ambientColor:'#eeeeee',ambient:0.4,skyExposure:1.2}
  const wf={skyTop:'#000000',skyHorizon:'#111111',ground:'#333333',ambientColor:'#222222',ambientMul:0.2,exposure:0.5,clouds:null,fog:null}
  const eff=m._effectiveEnv(e,wf)
  for(const k of ['skyTop','skyHorizon','ground','ambientColor','ambient','skyExposure']) assert.equal(eff[k],e[k])
  const inherited=m._effectiveEnv({...e,lightingMode:undefined},wf)
  assert.equal(inherited.skyTop,wf.skyTop)
})
