// LF-POST-S01-G001: un solo catálogo .post/.profile, prioridad y preview sin segundo compositor.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PROFILE_EXT, LEGACY_PROFILE_EXT, isProfileName, profileStem, normalizeProfile, normalizeProfiles, newProfile, findProfile, applyProfile, lerpRender, PROFILE_EFFECTS } from '../src/engine/runtime/render/profiles.js'
import { profileMethods } from '../src/engine/runtime/events/play-profile.js'
const s = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const old = { id: 'p-old', name: 'Antiguo.profile', fx: { bloom: { on: true, bloom: 1.7 } } }
const modern = { id: 'p-new', name: 'Terror.post', fx: { color: { on: true, saturation: 0.6, contrast: 1.4 } } }
const render = { ...Object.fromEntries(PROFILE_EFFECTS.flatMap(e=>e.params.map(p=>[p.key,p.def]))), bloom: 0, bloomRadius: 0.2, bloomThreshold: 0.8, saturation: 1, contrast: 1, exposure: 1 }
const game = () => {
  const project = { profiles: [old, modern] }
  const history = []
  return { project, _gm: { profile: old.id }, _gfxRender: () => render, vp: { setRenderLive: x => history.push(x) }, ed: { vp: { setRender(){} }, baseRender: () => render }, history, ...profileMethods }
}
test('POST-01: extensión principal .post', () => assert.equal(PROFILE_EXT, '.post'))
test('POST-02: extensión anterior reconocida', () => assert.equal(LEGACY_PROFILE_EXT, '.profile'))
test('POST-03: detecta ambos tipos por nombre', () => { assert.equal(isProfileName('a.post'),true); assert.equal(isProfileName('a.profile'),true) })
test('POST-04: extensión inválida no se confunde', () => assert.equal(isProfileName('a.json'),false))
test('POST-05: el nombre visible elimina ambas extensiones', () => assert.deepEqual(['a.post','a.profile'].map(profileStem), ['a','a']))
test('POST-06: perfil nuevo usa .post', () => assert.equal(newProfile('id','Nuevo').name,'Nuevo.post'))
test('POST-07: perfil viejo no se renombra al normalizar', () => assert.equal(normalizeProfile(old).name,'Antiguo.profile'))
test('POST-08: perfil nuevo conserva su identidad', () => assert.deepEqual([normalizeProfile(modern).id,normalizeProfile(modern).name],['p-new','Terror.post']))
test('POST-09: lista mixta conserva nombres y orden', () => assert.deepEqual(normalizeProfiles([old,modern]).map(p=>p.name),['Antiguo.profile','Terror.post']))
test('POST-10: busca por id en el registro único', () => assert.equal(findProfile([old,modern],'p-new'),modern))
test('POST-11: busca por nombre completo .post', () => assert.equal(findProfile([old,modern],'terror.post'),modern))
test('POST-12: busca por nombre sin extensión legacy', () => assert.equal(findProfile([old,modern],'antiguo'),old))
test('POST-13: nombres con extensión tienen prioridad sobre ambigüedades', () => { const a={id:'a',name:'Same.post'},b={id:'b',name:'Same.profile'}; assert.equal(findProfile([a,b],'Same.profile'),b) })
test('POST-14: perfiles no cambian render origen', () => { applyProfile(render,modern); assert.equal(render.saturation,1) })
test('POST-15: un efecto marcado se aplica', () => assert.equal(applyProfile(render,modern).saturation,0.6))
test('POST-16: efecto no marcado no sustituye render', () => assert.equal(applyProfile(render,{fx:{color:{on:false,saturation:0}}}).saturation,1))
test('POST-17: interpolación gradúa valores', () => { const defaults=Object.fromEntries(PROFILE_EFFECTS.flatMap(e=>e.params.map(p=>[p.key,p.def]))); assert.equal(lerpRender({ ...defaults, ...render,saturation:1 },{ ...defaults, ...render,saturation:0 },0.5).saturation,0.5) })
test('POST-18: los efectos pertenecen al catálogo existente', () => assert.ok(PROFILE_EFFECTS.some(e=>e.id==='color')))
test('POST-19: importador reconoce .post y .profile', () => { const code=s('src/core/project.js'); assert.match(code, /e === 'post' \|\| e === 'profile'/) })
test('POST-20: el recurso aparece en la misma colección de Assets', () => { const code=s('src/core/project.js'); assert.match(code, /project\.profiles \|\| \[\]/); assert.match(code, /kind: 'profile'/) })
test('POST-21: GameManager aporta el fallback al iniciar', () => { const x=game();x._profInit();assert.equal(x._prof.id,old.id) })
test('POST-22: Spawn domina GameManager', () => { const x=game();x._profInit();x._profSpawn({props:{profile:modern.id}});assert.equal(x._prof.id,modern.id) })
test('POST-23: cámara activa domina Spawn', () => { const x=game();x._profInit();x._profSpawn({props:{profile:old.id}});x._profCamera(modern.id);assert.equal(x._prof.id,modern.id) })
test('POST-24: override de evento/script domina cámara', () => { const x=game();x._profInit();x._profCamera(old.id);x._profSet(modern.id,0);assert.equal(x._prof.id,modern.id) })
test('POST-25: cambiar cámara no borra override temporal', () => { const x=game();x._profInit();x._profSet(modern.id,0);x._profCamera(old.id);assert.equal(x._prof.id,modern.id) })
test('POST-26: clear restaura cámara', () => { const x=game();x._profInit();x._profCamera(modern.id);x._profSet(old.id,0);x._profSet('',0);assert.equal(x._prof.id,modern.id) })
test('POST-27: clear restaura GameManager sin cámara', () => { const x=game();x._profInit();x._profSet(modern.id,0);x._profSet('',0);assert.equal(x._prof.id,old.id) })
test('POST-28: sin GameManager ni cámara clear vuelve a Render', () => { const x=game();x._gm=null;x._profInit();x._profSet(modern.id,0);x._profSet('',0);assert.equal(x._prof.id,'');assert.equal(x._prof.cur.saturation,1) })
test('POST-29: cámara retirada restaura Spawn', () => { const x=game();x._profInit();x._profSpawn({props:{profile:old.id}});x._profCamera(modern.id);x._profCamera('');assert.equal(x._prof.id,old.id) })
test('POST-30: perfil inválido se rechaza sin tocar override', () => { const x=game();x._profInit();assert.throws(()=>x._profSet('ghost',0));assert.equal(x._prof.override,null) })
test('POST-31: renombrar no migra .profile existente', () => assert.match(s('src/components/ProfileEditor.vue'),/endsWith\('\.profile'\)/))
test('POST-32: editor ofrece antes/después real', () => { const v=s('src/components/ProfileEditor.vue');assert.match(v,/pf-before-after/);assert.match(v,/previewProfile/);assert.match(v,/before\.value \? null : pr\.value/) })
test('POST-33: editor configura un efecto sin segundo compositor', () => { const v=s('src/components/ProfileEditor.vue');assert.match(v,/ParamForm/);assert.ok(!v.includes('new WebGLRenderer')) })
test('POST-34: GameManager permite crear y editar recurso', () => { const v=s('src/components/GameManagerEditor.vue');assert.match(v,/addPost/);assert.match(v,/editPost/) })
test('POST-35: slot de cámara crea .post', () => assert.match(s('src/components/ProfileSlot.vue'),/\.post/))
test('POST-36: cámara de escena usa el mismo fallback', () => assert.match(s('src/engine/runtime/events/play-timeline.js'),/_mainCameraNode\(\)\?\.obj\?\.props\?\.profile/))
test('POST-37: un cambio de escena limpia override temporal', () => assert.match(s('src/engine/runtime/events/play.js'),/this\._prof\.override = null/))
test('POST-38: cambios gráficos respetan la prioridad', () => assert.match(s('src/engine/runtime/events/play-graphics.js'),/_profApply\(this\._profWanted\(\), 0\)/))
test('POST-39: .lfproj exporta datos de perfiles JSON', () => assert.match(s('src/core/lfproj.js'),/e\.kind === 'profile'/))
test('POST-40: .levelpackage conserva el tipo único de recurso', () => assert.match(s('src/core/levelpackage.js'),/entry\.kind === 'profile'/))
test('POST-41: importación directa JSON normaliza campos', () => assert.match(s('src/core/state/filesystem.js'),/p\.profiles\.push\(normalizeProfile/))
test('POST-42: menú de Assets ofrece .post', () => assert.match(s('src/components/ProjectPanel.vue'),/post-proceso \(\.post\)/))
test('POST-43: transición temporal actualiza el render interpolado', () => { const x=game();x._profInit();x._profSet(modern.id,1);x._profTick(0.5);assert.ok(x._prof.cur.saturation < 1 && x._prof.cur.saturation > 0.6);assert.ok(x.history.length >= 2) })
test('POST-44: terminar una transición llega exactamente al perfil', () => { const x=game();x._profInit();x._profSet(modern.id,1);x._profTick(1);assert.equal(x._prof.cur.saturation,0.6) })
test('POST-45: clear interpola hasta el fallback activo', () => { const x=game();x._gm=null;x._profInit();x._profSet(modern.id,0);x._profSet('',2);x._profTick(1);assert.ok(x._prof.cur.saturation>0.6 && x._prof.cur.saturation<1);x._profTick(1);assert.equal(x._prof.cur.saturation,1) })
test('POST-46: sin inicializar no se inventa perfil', () => { const x=game();assert.equal(x._profWanted(), '');assert.equal(x._profSet('',0),null) })
