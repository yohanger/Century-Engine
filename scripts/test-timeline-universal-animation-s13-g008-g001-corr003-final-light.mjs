import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerNode, getDef } from '../src/engine/runtime/nodes/registry.js'
import { nodeAnimationProperty, validatePropertyValue } from '../src/engine/runtime/anim/model.js'
import { normalizeLight, kelvinToRgb } from '../src/engine/runtime/render/lightlib.js'
import { LIGHT_STYLES } from '../src/engine/runtime/render/lightfx.js'
import { newTimeline, upsertTimelineNodePropertyKey, normalizeTimeline } from '../src/core/timeline/model.js'

const src = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const scrub = file => src(file).replace(/^import .*$/gm, '').replace(/^export default /gm, '').replace(/^export (?:const|function) /gm, match => match.slice(7))
const released = { flare: 0 }
class Color {
  constructor(value = '#ffffff') { this.set(value) }
  set(value) {
    if (value instanceof Color) { this.v = [...value.v]; return this }
    const h = String(value).replace('#', '')
    this.v = [0,2,4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
    return this
  }
  setRGB(r, g, b) { this.v = [r, g, b]; return this }
  multiply(c) { this.v = this.v.map((n, i) => n * c.v[i]); return this }
  multiplyScalar(n) { this.v = this.v.map(v => v * n); return this }
  copy(c) { return this.set(c) }
  getHexString() { return this.v.map(v => Math.min(255, Math.max(0, Math.round(v * 255))).toString(16).padStart(2, '0')).join('') }
}
class FakeLight {
  constructor(color) {
    this.color = new Color(color); this.position = { set() {} }; this.rotation = { y: 0 }
    this.target = { position: { set() {} } }; this.userData = {}
    this.shadow = { bias: 0, normalBias: 0, needsUpdate: false,
      mapSize: { x: 1024, set(x, y) { this.x = x; this.y = y } },
      camera: { left: -60, right: 60, bottom: -60, top: 60, far: 250, updateProjectionMatrix() { this.updates = (this.updates || 0) + 1 } } }
  }
  add(item) { item.parent = this }
  remove() {}
}
class FakeFlare {
  constructor() { this.elements = [] }
  addElement(e) { this.elements.push(e) }
  dispose() { released.flare++ }
}
class FakeFlareElement {
  constructor(texture, size) { this.texture = texture; this.size = size; this.color = new Color() }
}
const fakeThree = {
  Color, SRGBColorSpace: 'srgb', RGBAFormat: 1, LinearFilter: 1,
  SphereGeometry: class {}, DataTexture: class { constructor() {} },
  Mesh: class { constructor(_geometry, material) { this.material = material } },
  PointLight: class extends FakeLight {}, SpotLight: class extends FakeLight { constructor(c) { super(c); this.isSpotLight = true } },
  DirectionalLight: class extends FakeLight { constructor(c) { super(c); this.isDirectionalLight = true } },
  RectAreaLight: class extends FakeLight { constructor(c) { super(c); this.isRectAreaLight = true } },
}
const makeRoot = () => {
  const visual = { add() {} }
  return { root: { userData: { visual }, add() {}, position: {}, quaternion: {} }, visual }
}
const lightCode = scrub('src/engine/runtime/nodes/light.js')
Function('registerNode','normalizeLight','kelvinToRgb','THREE','Lensflare','LensflareElement','RectAreaLightHelper','makeRoot','applyBase','iconMat','arrowToward','DEG','LIGHT_STYLES',
  lightCode + '\nreturn true')(
  registerNode, normalizeLight, kelvinToRgb, fakeThree, FakeFlare, FakeFlareElement, class { constructor() { this.userData={}; this.update=()=>{}; this.dispose=()=>{} } }, makeRoot, () => {},
  () => ({ color: new Color('#ffffff') }), () => ({}), Math.PI / 180, LIGHT_STYLES)
const def = getDef('light')
function rig(type = 'omni', options = {}) {
  const obj = { id: 'light-test', type: 'light', active: true, visible: true, color: '#aabbee',
    light: { type, energy: 1.5, range: 12, style: 'steady', shadow: type === 'directional', ...options } }
  const root = def.build(obj)
  def.update(root, obj)
  return { obj, root, light: root.userData.light, key: id => nodeAnimationProperty(obj, 'light.' + id) }
}

test('FIN-L01 · 34 tipos heredados; siete opciones ópticas nuevas usan el único registro de Luz', () => {
  const names = ['temperature','flareOn','flareSize','volumetric','volIntensity','shadowDistance','style']
  for (const name of names) assert.ok(def.animation['light.' + name], name)
  for (const name of ['mode','shadowRes','stairs','ignited']) assert.equal(def.animation['light.' + name], undefined)
  const inventory = src('docs/qa/LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-CORR003-CONTINUATION_QA.md')
  assert.match(inventory, /34 tipos/)
})
test('FIN-L02 · disponibilidad respeta tipo y condiciones existentes del Inspector', () => {
  const area = rig('area'), directional = rig('directional'), omni = rig('omni')
  assert.equal(area.key('volumetric'), null)
  assert.equal(area.key('shadowDistance'), null)
  assert.equal(omni.key('shadowDistance'), null)
  assert.ok(directional.key('shadowDistance'))
  assert.equal(omni.key('flareSize'), null)
  assert.equal(omni.key('volIntensity'), null)
  assert.ok(rig('omni', { flareOn: true }).key('flareSize'))
  assert.ok(rig('omni', { volumetric: true }).key('volIntensity'))
})
test('FIN-L03 · temperatura afecta emisor real sin alterar autoría y restaura tras STOP', () => {
  const x = rig(), spec = x.key('temperature'), before = structuredClone(x.obj), snapshot = spec.capture(x.root,x.obj)
  const original = [...x.light.color.v]
  spec.apply(x.root, 1900, x.obj)
  assert.notDeepEqual(x.light.color.v, original)
  assert.deepEqual(x.obj, before)
  assert.equal(spec.runtimeRead(x.root,x.obj),1900)
  spec.restore(x.root,snapshot,x.obj)
  assert.equal(x.root.userData.timelineLight,undefined)
  assert.deepEqual(x.light.color.v, original)
})
test('FIN-L04 · el color runtime y la temperatura se componen sin acumular tonos', () => {
  const x = rig(), spec = x.key('temperature')
  x.root.userData.rtColor = '#ffffff'
  const saved = spec.capture(x.root, x.obj)
  spec.apply(x.root, 2300, x.obj)
  const warm = [...x.light.color.v]
  x.root.userData.refreshLightColor()
  assert.deepEqual(x.light.color.v, warm)
  assert.ok(warm[2] < warm[0])
  spec.restore(x.root, saved, x.obj)
  assert.equal(x.light.color.getHexString(),'ffffff')
})
test('FIN-L05 · Lensflare se activa y desactiva sin mantener recurso ajeno', () => {
  const x = rig(), spec = x.key('flareOn'), saved = spec.capture(x.root,x.obj)
  assert.equal(x.root.userData.flare,undefined)
  spec.apply(x.root,true,x.obj)
  assert.equal(x.root.userData.flareElements.length,2)
  const count = released.flare
  spec.apply(x.root,false,x.obj)
  assert.equal(x.root.userData.flare,null)
  assert.equal(released.flare,count+1)
  spec.restore(x.root,saved,x.obj)
  assert.equal(x.root.userData.timelineLight,undefined)
  assert.equal(x.root.userData.flare,null)
})
test('FIN-L06 · tamaño Flare afecta elementos propios y no altera intensidad ya animada', () => {
  const a = rig('omni',{ flareOn:true }), b = rig('omni',{flareOn:true})
  const spec = a.key('flareSize'), saved = spec.capture(a.root,a.obj)
  const intensity = a.key('flareIntensity')
  intensity.apply(a.root, 0.4)
  spec.apply(a.root, 180,a.obj)
  assert.equal(a.root.userData.flareElements[0].size,180)
  assert.equal(a.root.userData.flareElements[1].size,45)
  assert.equal(a.root.userData.flareIntensity,0.4)
  assert.equal(b.root.userData.flareElements[0].size,72)
  spec.restore(a.root,saved,a.obj)
  assert.equal(a.root.userData.flareElements[0].size,72)
})
test('FIN-L07 · volumétrica respeta escena y no modifica otros emisores', () => {
  const a=rig(), b=rig(), on=a.key('volumetric'), saved=on.capture(a.root,a.obj)
  on.apply(a.root,true,a.obj)
  assert.equal(a.light.userData.rtVol.intensity,1)
  assert.equal(b.light.userData.rtVol,null)
  assert.deepEqual(a.obj.light.volumetric,undefined)
  on.restore(a.root,saved,a.obj)
  assert.equal(a.light.userData.rtVol,null)
})
test('FIN-L08 · intensidad volumétrica preserva el estado de activación y restaura', () => {
  const x=rig('spot',{volumetric:true,volIntensity:1.7}), spec=x.key('volIntensity'), saved=spec.capture(x.root,x.obj)
  spec.apply(x.root,7,x.obj)
  assert.equal(x.light.userData.rtVol.intensity,7)
  assert.equal(validatePropertyValue('light.volIntensity',7),7)
  assert.throws(()=>validatePropertyValue('light.volIntensity',22))
  spec.restore(x.root,saved,x.obj)
  assert.equal(x.light.userData.rtVol.intensity,1.7)
})
test('FIN-L09 · alcance de sombra direccional recalcula proyección sin regenerar luz', () => {
  const x=rig('directional'), spec=x.key('shadowDistance'), snapshot=spec.capture(x.root,x.obj)
  const l=x.light, original=l.shadow.camera.right
  spec.apply(x.root,125,x.obj)
  assert.equal(x.light,l)
  assert.equal(l.shadow.camera.right,125)
  assert.equal(l.shadow.camera.bottom,-125)
  assert.equal(l.shadow.needsUpdate,true)
  spec.restore(x.root,snapshot,x.obj)
  assert.equal(l.shadow.camera.right,original)
})
test('FIN-L10 · estilo de parpadeo usa LightFX existente y enum tipado', () => {
  const x=rig(), spec=x.key('style'), snap=spec.capture(x.root,x.obj)
  spec.apply(x.root,'strobe',x.obj)
  assert.equal(x.root.userData.fx.style,LIGHT_STYLES.strobe.id)
  assert.throws(()=>validatePropertyValue('light.style','invalid'))
  spec.restore(x.root,snap,x.obj)
  assert.equal(x.root.userData.fx.style,0)
})
test('FIN-L11 · siete canales guardan y cargan claves tipadas por nodo/escena', () => {
  const x=rig('directional',{flareOn:true,volumetric:true})
  const before=structuredClone(x.obj), tl=newTimeline('Luz',{duration:5})
  const fields = [['temperature',3500],['flareOn',false],['flareSize',120],['volumetric',true],['volIntensity',5],['shadowDistance',110],['style','pulse']]
  for (const [k,v] of fields) upsertTimelineNodePropertyKey(tl,x.obj,'light.'+k,'scene',[x.obj],2,v)
  const data=normalizeTimeline(JSON.parse(JSON.stringify(tl)))
  assert.equal(data.tracks.length,fields.length)
  for (const [k,v] of fields) assert.deepEqual(data.tracks.find(t=>t.prop==='light.'+k).keys[0].v,v)
  assert.deepEqual(x.obj,before)
})
test('FIN-L12 · Shake film/timeline/pose no se altera; escaleras siguen geométricas', () => {
  assert.match(src('src/engine/runtime/events/play-camera-shake.js'), /\['film', 'timeline', 'pose'\]\.includes\(this\._cameraActive\.kind\)/)
  assert.doesNotMatch(src('src/engine/runtime/nodes/primitive.js'), /'primitive\.steps'\s*:/)
  const ui=src('src/components/Inspector.vue')
  for (const field of ['temperature','flareOn','flareSize','volumetric','volIntensity','shadowDistance','style'])
    assert.ok(ui.includes(`inspectorKeyable('light.${field}')`),field)
})
