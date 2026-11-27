// LF-CAMERA-PROJECTION-CORR-G001 · Continuación: FOV horizontal explícito y compatibilidad vertical.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { verticalFov, setCameraFov, refreshCameraFov } from '../src/engine/runtime/render/camera-fov.js'
import { normalizePlayer, PLAYER_PARAMS, PLAYER_DEFAULTS, MOVE_KEYS } from '../src/engine/runtime/database/player.js'

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const near = (a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e, `${a} ≠ ${b}`)
function cam(aspect=16/9) {return {fov:75,aspect,userData:{},updates:0,updateProjectionMatrix(){this.updates++}}}
const hFov = (v,a)=>2*Math.atan(a*Math.tan(v*Math.PI/360))*180/Math.PI
function evalMixin(path, exportName, injections={}) {
  const src=read(path).replace(/^import [^\n]+\n/gm,'').replace(new RegExp(`export const ${exportName}`),`const ${exportName}`)
  const keys=Object.keys(injections)
  return new Function(...keys,src+'\nreturn '+exportName)(...keys.map(k=>injections[k]))
}

test('HF-01 Three.js usa FOV vertical; 90 horizontal se convierte sin perder FOV horizontal',()=>{
 for(const aspect of [1,4/3,16/9,2.15,21/9])near(hFov(verticalFov(90,aspect,'horizontal'),aspect),90)
})
test('HF-02 El usuario puede mantener 80, 85 y 90 grados horizontales',()=>{
 for(const aspect of [16/9,2.15])for(const v of [80,85,90])near(hFov(verticalFov(v,aspect,'horizontal'),aspect),v)
})
test('HF-03 La interpretación antigua del FOV vertical no se modifica',()=>{
 for(const aspect of [0.8,1,16/9,2.15])near(verticalFov(75,aspect,'vertical'),75)
})
test('HF-04 Conversión horizontal valida rango y aspecto sin propagación de NaN',()=>{
 for(const v of [NaN,0,-1,179,Infinity])assert.equal(verticalFov(v,16/9,'horizontal'),null)
 for(const a of [0,-1,NaN,Infinity])assert.equal(verticalFov(90,a,'horizontal'),null)
})
test('HF-05 Una sola actualización de matriz al aplicar una especificación nueva',()=>{
 const c=cam(2.15); assert.equal(setCameraFov(c,90,'horizontal'),true)
 near(hFov(c.fov,c.aspect),90);assert.equal(c.updates,1)
 assert.equal(setCameraFov(c,90,'horizontal'),false);assert.equal(c.updates,1)
})
test('HF-06 El cambio del aspecto mantiene exactamente los grados horizontales',()=>{
 const c=cam(2.15);setCameraFov(c,85,'horizontal')
 c.aspect=16/9;refreshCameraFov(c)
 near(hFov(c.fov,c.aspect),85);assert.equal(c.updates,2)
 c.aspect=1;refreshCameraFov(c);near(c.fov,85)
})
test('HF-07 Cambiar de horizontal a vertical recupera la matriz anterior',()=>{
 const c=cam(2.15);setCameraFov(c,90,'horizontal');setCameraFov(c,75,'vertical')
 near(c.fov,75);assert.equal(c.userData.lfFov.axis,'vertical')
 c.aspect=1.5;refreshCameraFov(c);near(c.fov,75)
})
test('HF-08 El FOV de Jugador no guarda eje ni conserva la rama heredada',()=>{
 for(const raw of [{fov:85},{fov:90,walk:5},{fovAxis:'vertical',fov:75},{}]){
   const p=normalizePlayer(raw)
   assert.equal('fovAxis' in p,false)
   assert.equal(p.fov,raw.fov ?? 90)
 }
 assert.equal(normalizePlayer(null,{fov:40}).fov,90)
})
test('HF-09 Un único FOV horizontal de 90° sin selector ni valores obsoletos',()=>{
 assert.equal(PLAYER_DEFAULTS.fov,90)
 assert.equal(normalizePlayer({fovAxis:'vertical',fov:90}).fov,90)
 assert.equal('fovAxis' in normalizePlayer({fovAxis:'vertical'}),false)
 assert.ok(!PLAYER_PARAMS.some(p=>p.key==='fovAxis'))
 assert.ok(!MOVE_KEYS.includes('fovAxis'))
})
test('HF-10 El FOV declarado no escala, traslada ni modifica objetos',()=>{
 const c=cam();const mesh={position:[1,2,3],scale:[1,1,1],vertices:[[1,2,3]]};const before=structuredClone(mesh)
 setCameraFov(c,90,'horizontal');refreshCameraFov(c)
 assert.deepEqual(mesh,before)
})
test('HF-11 El script game.player.fov usa grados horizontales sin exponer eje',()=>{
 const m=evalMixin('src/engine/runtime/player/fps/api.js','apiMethods',{clampPlayerField:(k,v)=>+v,MOVE_KEYS,PLAYER_PARAMS,DEG:Math.PI/180,setCameraFov,pickMove:(c)=>Object.fromEntries(MOVE_KEYS.map(k=>[k,c[k]]))})
 const config=normalizePlayer({fov:90})
 const pm={g:{},cam:cam(2.15),game:{db:{player:config}},phys:{setBody(){}}}
 const controller={play:pm,stand:{height:1.8,eye:1.65},body:{radius:0.3,stepHeight:0.5,height:1.8,eyeHeight:1.65},crouched:false,crouchH(){return 1.3}}
 m.applyConfig.call(controller,config)
 near(hFov(pm.cam.fov,pm.cam.aspect),90)
 m.setConfig.call({...controller,applyConfig:(cfg)=>m.applyConfig.call(controller,cfg)}, {fovAxis:'vertical',fov:85})
 near(hFov(pm.cam.fov,pm.cam.aspect),85)
 assert.equal('fovAxis' in config,false)
})
test('HF-12 Cámara principal conserva el FOV vertical de los nodos existentes',()=>{
 const src=read('src/engine/runtime/events/play-camera.js')
 assert.match(src,/setCameraFov\(cam, fov, 'vertical'\)/)
 assert.match(src,/setCameraFov\(cam, this\.g\.fov\)/)
})
test('HF-13 La cámara de juego recalcula al cambiar relación de aspecto',()=>{
 assert.match(read('src/engine/runtime/events/play-controls.js'),/cam\.aspect = aspect; refreshCameraFov\(cam\)/)
 assert.match(read('src/engine/runtime/render/viewport.js'),/this\.persp\.aspect = w \/ h\s+refreshCameraFov\(this\.persp\)/)
})
test('HF-14 La cámara editorial mantiene un solo FOV horizontal visible',()=>{
 const v=read('src/components/ViewBar.vue'),modal=read('src/components/PreferencesModal.vue'),prefs=read('src/core/state/state.js'),vp=read('src/engine/runtime/render/viewport.js')
 assert.doesNotMatch(v,/editorFovAxis|editorFov/);assert.match(modal,/setEditorFov\(\$event\.target\.value\)/)
 assert.match(prefs,/editorFov: 90,/)
 assert.match(vp,/setCameraFov\(this\.persp, p\.editorFov \?\? 90\)/)
})
test('HF-15 Vista editorial restaura el tipo de FOV después de Play',()=>{
 const v=read('src/engine/runtime/render/viewport.js')
 assert.match(v,/fovSpec: cam\.userData\?\.lfFov/)
 assert.match(v,/setCameraFov\(cam, saved\.fovSpec\.value, saved\.fovSpec\.axis\)/)
})
test('HF-16 Preview FPS y cámara de manos usan la conversión sin FOV divergente',()=>{
 assert.match(read('src/components/PlayerPreview.vue'),/setCameraFov\(fpCam, p\.fov\)/)
 assert.match(read('src/engine/runtime/player/fps/hands.js'),/PerspectiveCamera\(pm\.cam\.fov/)
 assert.match(read('src/engine/runtime/player/fps/hands.js'),/c\.fov = cam\.fov/)
})
test('HF-17 Timelines mantienen FOV vertical propio y convierten el del jugador al leerlo',()=>{
 const t=read('src/engine/runtime/events/play-timeline.js')
 assert.match(t,/setCameraFov\(cam, p\.fov, 'vertical'\)/)
 assert.match(t,/verticalFov\(self\.g\.fov, self\.cam\.aspect\)/)
 assert.match(t,/setCameraFov\(cam, this\.g\.fov\)/)
})
test('HF-18 El cambio es de cámara; PBR y shaders de materiales permanecen intactos',()=>{
 const source=read('src/engine/runtime/render/camera-fov.js')
 assert.doesNotMatch(source,/Material|Shader|geometry|WebGLRenderer|PostPass/)
 assert.match(source,/refreshCameraFov/)
})
test('HF-19 El nuevo parámetro se conserva al normalizar repetidamente la base de datos',()=>{
 const p=normalizePlayer({fov:87})
 assert.deepEqual(normalizePlayer(p),p)
})
test('HF-20 El visor ancho mantiene 90° horizontales y una ampliación menor en el extremo',()=>{
 const aspect=2.15;const originally=hFov(75,aspect)
 const v=verticalFov(90,aspect,'horizontal')
 assert.ok(originally>117 && originally<119)
 assert.ok(v>49&&v<51)
 const mag=hf=>1/Math.cos(hf*Math.PI/360)**2
 assert.ok(mag(90)<mag(originally))
})
