import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { filmNodeAnimationAllowed, FilmNodePose } from '../src/filmmaker/node-tracks.js'

const file = name => readFileSync(new URL(`../${name}`,import.meta.url),'utf8')
const nle = file('src/filmmaker/NleTimeline.vue')
const app = file('src/filmmaker/FilmApp.vue')
const style = file('src/filmmaker/film-ux.css')
const session = file('src/filmmaker/session.js')

test('CORR01 · selector + Nodo no depende de una selección previa y permite búsqueda',()=>{
  assert.match(nle,/data-test="node-add"/)
  assert.doesNotMatch(nle,/:disabled="!activeNode \|\|/)
  assert.match(nle,/data-test="film-node-chooser"/)
  assert.match(nle,/data-test="film-node-filter"/)
  assert.match(nle,/v-for="node in availableNodes"/)
  assert.match(nle,/filmNodeAnimationAllowed\(o, session\.film\?\.actor\?\.objectId\)/)
})

test('CORR02 · los nodos editoriales de FilmMaker se ofrecen como planos, no como nodos falsos',()=>{
  assert.match(nle,/availableFilmCameras = computed\(/)
  assert.match(nle,/v-for="cam in availableFilmCameras"/)
  assert.match(nle,/addEditorialShot\(cam\.id\)/)
  assert.match(nle,/F\.createFilmEditorialShot\(cameraId, 5\)/)
})

test('CORR03 · arrastre de Jerarquía mantiene MIME y acepta selección múltiple sin duplicar pistas',()=>{
  assert.match(nle,/application\/x-lf-node/)
  assert.match(nle,/const unique = \[\.\.\.new Set\(ids\)\]/)
  assert.match(nle,/unique\.forEach\(id => addNodeById\(id\)\)/)
  assert.match(nle,/film\.value\?\.edit\.nodeTracks\.some\(tr => tr\.nodeId === nodeId\)/)
  assert.match(nle,/F\.addFilmNode\(nodeId\)/)
})

test('CORR04 · elegibilidad de nodos y escritor de pose comparten la misma regla',()=>{
  const o=(id,type)=>({id,type})
  assert.equal(filmNodeAnimationAllowed(o('x','mesh')),true)
  assert.equal(filmNodeAnimationAllowed(o('x','cameraShake')),true)
  assert.equal(filmNodeAnimationAllowed(o('x','node3d')),true)
  assert.equal(filmNodeAnimationAllowed(o('x','node')),false)
  assert.equal(filmNodeAnimationAllowed(o('x','rigidbody3d')),false)
  assert.equal(filmNodeAnimationAllowed(o('actor','mesh'),'actor'),false)
  const editor={nodes:new Map([['x',{}]])}
  const pose = new FilmNodePose(editor,[],[o('x','cameraShake')])
  assert.ok(pose.target('x'))
})

test('CORR05 · inspector NLE conecta con dock Inspector sin duplicar editor',()=>{
  assert.match(app,/ref="filmInspectorHost"/)
  assert.match(app,/:inspector-target="filmClipInspectorTarget"/)
  assert.match(nle,/<Teleport :to="inspectorTarget \|\| 'body'" :disabled="!inspectorTarget">/)
  assert.match(nle,/class="props" :class="\{'dock-props': !!inspectorTarget\}"/)
  assert.match(nle,/defineExpose\(\{ placeAudio, sel, showProperties(?:, openAddMenu)? \}\)/)
  assert.match(app,/<Inspector v-show="!selectedFilmClip" \/>/)
})

test('CORR06 · seleccionar clip activa Inspector y cerrar devuelve a Inspector de escena',()=>{
  assert.match(nle,/if \(item\) emit\('inspect-clip'\)/)
  assert.match(app,/@inspect-clip="inspectFilmClip"/)
  assert.match(app,/right\.value = 'insp'/)
  assert.match(app,/rightOpen\.value = true/)
  assert.match(nle,/function closeClipProperties\(\) \{ showProperties\.value = false; sel\.value = null \}/)
  assert.match(nle,/@click="closeClipProperties"/)
})

test('CORR07 · el inspector ocupa dock, no tapa pistas en pantalla grande',()=>{
  assert.match(nle,/\.props\.dock-props \{ position: relative;/)
  assert.match(style,/\.film-nle-inspector-host \{ height:100%;/)
  assert.match(style,/\.film-nle-inspector-switch \{ width:100%;/)
})

test('CORR08 · seguridad de reproducción y grabación preservada',()=>{
  assert.match(nle,/session\.rec\.state !== 'idle'/)
  assert.match(nle,/session\.pass\.state !== 'idle'/)
  assert.match(nle,/if \(session\.montage\.on\) F\.stopMontage\(\)/)
  assert.match(session,/export function stopMontage\(\)/)
  assert.match(session,/if \(!pose\.target\(nodeId\)\)/)
  assert.doesNotMatch(nle,/eval\(/)
})
