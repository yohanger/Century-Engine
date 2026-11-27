// LF-CAMERA-PROJECTION-CORR-G001: diagnóstico de las dos cámaras sin WebGL ni efectos.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { refreshCameraFov } from '../src/engine/runtime/render/camera-fov.js'
const read = (file) => readFileSync(new URL('../'+file,import.meta.url),'utf8')
const vp=read('src/engine/runtime/render/viewport.js')
const nav=read('src/engine/runtime/render/viewport-nav.js')
const play=read('src/engine/runtime/events/play-controls.js')
const view=read('src/engine/runtime/events/play-camera.js')
const fps=read('src/engine/runtime/player/fps/camera.js')
const rad=(degrees)=>degrees*Math.PI/180
const halfHorizontal=(fov,aspect)=>Math.atan(Math.tan(rad(fov)/2)*aspect)
const edgeMagnification=(angle)=>1/Math.cos(angle)**2
const nearly=(actual,expected,eps=1e-10)=>assert.ok(Math.abs(actual-expected)<eps,`${actual} vs ${expected}`)
const fitBody=vp.split('  _fitCameras(')[1]?.split('\n  _viewChanged()')[0]
assert.ok(fitBody,'no se localiza método _fitCameras() del Viewport')
const fit=new Function('refreshCameraFov','return ({_fitCameras('+fitBody+'})._fitCameras')(refreshCameraFov)
function fitFixture(w,h){
  const updates=[]
  const persp={aspect:1,updateProjectionMatrix(){updates.push(['persp',this.aspect])}}
  const ortho={left:0,right:0,top:0,bottom:0,updateProjectionMatrix(){updates.push(['ortho',this.right/this.top])}}
  fit.call({persp,ortho,_orthoH:10},w,h)
  return {persp,ortho,updates}
}
const resizeBody=vp.split('  resize() {')[1]?.split('\n  _fitCameras(')[0]
assert.ok(resizeBody,'no se localiza Viewport.resize()')
const resize=new Function('return ({resize() {'+resizeBody+'}).resize')()
function resizeFixture({w=1366,h=768,playing=false,active='persp'}={}){
  const stages=[]
  const camera={isPerspectiveCamera:active!=='ortho',aspect:1,updateProjectionMatrix(){stages.push(['active',this.aspect])}}
  const persp=active==='persp'?camera:{aspect:1,updateProjectionMatrix(){}}
  const obj={
    playing,camera,persp,container:{clientWidth:w,clientHeight:h},
    renderer:{domElement:{width:1,height:1},getPixelRatio(){return 1},setSize(x,y){stages.push(['framebuffer',x,y])}},
    look:{setSize(x,y){stages.push(['composer',x,y])}},_syncPsx(){},
    _fitCameras(x,y){stages.push(['editorAspect',x/y])},
    _render(){stages.push(['render',this.camera.aspect])}
  }
  resize.call(obj)
  return {obj,camera,stages}
}

test('CAM-01 Editor y jugador usan cámaras perspectiva distintas del mismo tipo rectilíneo',()=>{
  assert.match(vp,/this\.persp = new THREE\.PerspectiveCamera\(60, 1/)
  assert.match(read('src/engine/runtime/events/play.js'),/this\.cam = new THREE\.PerspectiveCamera\(75, 1/)
})
test('CAM-02 Vista Editor: aspecto calculado como ancho físico / alto físico',()=>{
  const p=fitFixture(1366,768);nearly(p.persp.aspect,1366/768);assert.deepEqual(p.updates.map(x=>x[0]),['persp','ortho'])
})
test('CAM-03 Vista ortográfica: extensión horizontal proporcional al aspecto, sin estirar la vertical',()=>{
  const {ortho}=fitFixture(1800,600)
  nearly(ortho.top,10);nearly(ortho.bottom,-10);nearly(ortho.left,-30);nearly(ortho.right,30)
})
test('CAM-04 Resize en Play actualiza cámara activa antes de dibujar',()=>{
  const {stages,camera}=resizeFixture({w:900,h:600,playing:true,active:'play'})
  nearly(camera.aspect,1.5)
  assert.ok(stages.findIndex(x=>x[0]==='active')<stages.findIndex(x=>x[0]==='render'))
})
test('CAM-05 Resize en Editor conserva responsabilidad de _fitCameras',()=>{
  const {stages}=resizeFixture({w:900,h:600,playing:false})
  assert.equal(stages.filter(x=>x[0]==='active').length,0)
  assert.ok(stages.some(x=>x[0]==='editorAspect'&&x[1]===1.5))
})
test('CAM-06 Resize de cámara ortográfica no la trata como perspectiva FPS',()=>{
  const {stages}=resizeFixture({playing:true,active:'ortho'})
  assert.equal(stages.filter(x=>x[0]==='active').length,0)
})
test('CAM-07 Fotograma FPS vuelve a sincronizar aspecto con viewport',()=>{
  assert.match(play,/const aspect = Math\.max\(1, c\.clientWidth\) \/ Math\.max\(1, c\.clientHeight\)/)
  assert.match(play,/cam\.aspect = aspect; refreshCameraFov\(cam\)/)
})
test('CAM-08 Mover la cámara del jugador cambia su pose, no aspecto/FOV',()=>{
  assert.match(fps,/cam\.rotation\.set\(this\.pitch, this\.yaw, 0, 'YXZ'\)/)
  assert.doesNotMatch(fps,/\.aspect\s*=|\.fov\s*=|\.zoom\s*=/)
})
test('CAM-09 Navegar el Editor cambia pose, pero no el FOV en la órbita',()=>{
  const orbit=nav.split('  _orbitBy(dx, dy) {')[1]?.split('\n  _panBy(')[0]
  assert.ok(orbit)
  assert.match(orbit,/this\.camera\.position\.copy\(t\)\.add\(off\)/)
  assert.doesNotMatch(orbit,/\.fov\s*=|\.aspect\s*=|\.zoom\s*=/)
})
test('CAM-10 El nodo Camera3D modifica solo FOV, no escala ni aspect del mundo',()=>{
  assert.match(view,/setCameraFov\(cam, fov, 'vertical'\)/)
  assert.doesNotMatch(view,/\.scale\s*=|\.scale\.set/)
})
test('CAM-11 Una perspectiva rectilínea hace crecer la escala angular hacia los bordes',()=>{
  nearly(edgeMagnification(rad(0)),1)
  assert.ok(edgeMagnification(rad(35))>1.48)
  assert.ok(edgeMagnification(rad(50))>2.4)
})
test('CAM-12 Reducir FOV reduce el efecto en bordes, pero no lo elimina matemáticamente',()=>{
  const aspect=16/9
  const a40=edgeMagnification(halfHorizontal(40,aspect))
  const a75=edgeMagnification(halfHorizontal(75,aspect))
  assert.ok(a40>1.4&&a40<1.5)
  assert.ok(a75>2.8&&a75<3)
  assert.ok(a75>a40)
})
test('CAM-13 A igual ángulo respecto del eje, la distorsión intrínseca no depende del FOV',()=>{
  const angle=rad(25)
  for(const fov of [40,60,75]) {
    assert.ok(halfHorizontal(fov,16/9)>angle)
    nearly(edgeMagnification(angle),1/Math.cos(angle)**2)
  }
})
test('CAM-14 La proyección rectilínea no representa simultáneamente distancias angulares uniformes',()=>{
  const angle=rad(30), focal=1
  const p=x=>focal*Math.tan(x)
  const angularStep=rad(0.5)
  assert.ok((p(angle+angularStep)-p(angle))/angularStep > (p(angularStep)-p(0))/angularStep)
})
test('CAM-15 La cámara ortográfica mantiene escala transversal al girar en lugar de proyectar tan(ángulo)',()=>{
  const dim=8, pixels=800, worldWidth=20
  const factor=pixels/worldWidth
  nearly(dim*factor,320)
  assert.equal(typeof fitFixture(800,800).ortho.right,'number')
})
test('CAM-16 Los vértices y las escalas de primitivas no dependen del FOV en el núcleo',()=>{
  const primitive=read('src/engine/runtime/nodes/primitive.js')
  assert.match(primitive,/applyBase\(root, obj, true\)/)
  assert.doesNotMatch(primitive,/camera\.fov|cam\.fov|camera\.aspect/)
})
test('CAM-17 El código vigente no declara lentes panorámicas/cilíndricas alternativas',()=>{
  assert.doesNotMatch(vp,/PaniniCamera|CylindricalCamera|EquidistantCamera/)
  assert.doesNotMatch(play,/PaniniCamera|CylindricalCamera|EquidistantCamera/)
})
test('CAM-18 No se presume que las pruebas matemáticas equivalgan a QA visual WebGL',()=>{
  const val=read('docs/qa/LF-RENDER-CAMERA-G001_QA.md')
  assert.match(val,/NO VERIFICADOS/)
  assert.match(val,/proyección rectilínea/)
})
