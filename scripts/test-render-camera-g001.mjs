// QA de proyección: prueba el resize real sin WebGL, y el contrato GLSL del ajuste PSX.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const viewport = source('src/engine/runtime/render/viewport.js')
const pbr = source('src/engine/runtime/render/pbr.js')
const scene = source('src/engine/runtime/scene-graph.js')
const play = source('src/engine/runtime/events/play-controls.js')

// Extraer el método real sin instanciar WebGLRenderer: usa el mismo cuerpo de código de producción.
const resizeBody = viewport.split('  resize() {')[1]?.split('\n  _fitCameras(')[0]
assert.ok(resizeBody, 'Falta Viewport.resize()')
const resize = new Function('return ({ resize() {' + resizeBody + ' }).resize')()
function mock({playing=true, active='play', width=800, height=450}={}) {
  const sequence = [], cam = { isPerspectiveCamera: active !== 'ortho', aspect: 1, updateProjectionMatrix(){ sequence.push(['projection', this.aspect]) } }
  const persp = active === 'editor' ? cam : { aspect: 1 }
  const obj = {
    container: { clientWidth: width, clientHeight: height }, playing,
    camera: cam, persp,
    renderer: {domElement: {width: 1, height: 1}, getPixelRatio(){return 1}, setSize(w,h){sequence.push(['framebuffer',w,h])}},
    look: {setSize(w,h){sequence.push(['look',w,h])}},
    _syncPsx(){sequence.push(['psx'])},
    _fitCameras(w,h){sequence.push(['editorProjection',w/h])},
    _render(){sequence.push(['render',cam.aspect])},
  }
  resize.call(obj)
  return {obj, cam, sequence}
}

test('Play Mode: aspect correcto antes del render inmediato de ResizeObserver', () => {
  const {cam, sequence} = mock({width: 1024, height: 400})
  assert.equal(cam.aspect, 1024 / 400)
  const i = sequence.findIndex(x=>x[0]==='projection'), j=sequence.findIndex(x=>x[0]==='render')
  assert.ok(i > -1 && j > i, JSON.stringify(sequence))
  assert.equal(sequence[j][1], 2.56)
})
test('Cámara perspectiva compartida del editor: no hay doble actualización', () => {
  const {sequence} = mock({active:'editor'})
  assert.equal(sequence.filter(x=>x[0]==='projection').length, 0)
})
test('Cámara ortográfica: no recibir aspect de PerspectiveCamera', () => {
  const {sequence} = mock({active:'ortho'})
  assert.equal(sequence.filter(x=>x[0]==='projection').length, 0)
})
test('Modo edición: no altera la cámara activa desde resize de juego', () => {
  const {sequence} = mock({playing:false})
  assert.equal(sequence.filter(x=>x[0]==='projection').length, 0)
})
test('PSX 0: shader deja las posiciones clip originales sin redondear', () => {
  assert.match(pbr, /if \(uLfPsxStep > 0\.0 && gl_Position\.w > 0\.0001\)/)
  assert.doesNotMatch(pbr, /max\(1\.0, uLfPsxStep\)/)
  assert.match(scene, /psxSnap > 0 \? sg\.vp\.psxUniforms : null/)
  // El viejo GLSL redondeaba a 1 píxel aun con step=0; ahora la rama no se ejecuta.
  const unchangedClip = [-0.3671, 0.1658, 0.49]
  const project = (clip, step) => step <= 0 ? clip : clip.map(v => Math.round(v * 500 / step) * step / 500)
  assert.deepEqual(project(unchangedClip, 0), unchangedClip)
  assert.notDeepEqual(project(unchangedClip, 1), unchangedClip)
})
test('PSX activado: el gancho de cuantización y la interpolación afín siguen disponibles', () => {
  assert.match(pbr, /p = floor\(p \/ uLfPsxStep \+ 0\.5\) \* uLfPsxStep/)
  assert.match(pbr, /function injectPsxAffine/)
  assert.match(viewport, /cfg\.psx \? \(cfg\.psxSnap \|\| 0\) : 0/)
})
test('FPS: permanece la actualización de aspect y el FOV del jugador', () => {
  assert.match(play, /cam\.aspect = aspect; refreshCameraFov\(cam\)/)
  assert.match(source('src/engine/runtime/player/fps/api.js'), /setCameraFov\(pm\.cam, pm\.g\.fov\)/)
})
test('Primitivas: no se introduce escalado dependiente de la cámara', () => {
  const primitive = source('src/engine/runtime/nodes/primitive.js')
  assert.match(primitive, /applyBase\(root, obj, true\)/)
  assert.doesNotMatch(primitive, /camera\.position|camera\.rotation|cam\.fov/)
})
