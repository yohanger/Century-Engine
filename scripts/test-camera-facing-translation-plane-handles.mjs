import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const gizmo = read('src/core/editor/gizmo.js')

function loadMethods(source, declaration, injections = {}) {
  const body = source.replace(/^import .*$/gm, '').replace(`export const ${declaration} =`, `const ${declaration} =`)
  const names = Object.keys(injections)
  return new Function(...names, `${body}\nreturn ${declaration}`)(...names.map(n => injections[n]))
}

class FakeVector3 {
  constructor(x=0,y=0,z=0) { this.x=x; this.y=y; this.z=z }
  copy(v) { this.x=v.x; this.y=v.y; this.z=v.z; return this }
  applyQuaternion(q) {
    const a=q.rotationY||0, x=this.x, z=this.z
    this.x=x*Math.cos(a)+z*Math.sin(a)
    this.z=z*Math.cos(a)-x*Math.sin(a)
    return this
  }
  dot(v) { return this.x*v.x+this.y*v.y+this.z*v.z }
}

function fakePlane(name, basePosition) {
  return {
    name,
    visible:true,
    position:{x:0,y:0,z:0},
    bakedCenter:{...basePosition},
    scale:{x:1,y:1,z:1},
    layers:{mask:1},
    updateMatrixWorld(){ this.updated = (this.updated || 0) + 1 },
  }
}

function fakeAxis(axis, side) {
  const coord=axis.toLowerCase()
  const [min,max] = side==='negative' ? [-0.6,-0.5] : side==='positive' ? [0.5,0.6] : [0,0.5]
  return {
    name:axis,
    side,
    visible:true,
    scale:{x:1,y:1,z:1},
    layers:{mask:1},
    updateMatrixWorld(){ this.updated = (this.updated || 0) + 1 },
    geometry:{ boundingBox:{min:{[coord]:min},max:{[coord]:max}}, computeBoundingBox(){} },
  }
}

function fakeGroup(includeLine=false) {
  const children=[]
  for (const axis of ['X','Y','Z']) {
    children.push(fakeAxis(axis,'negative'))
    if (includeLine) children.push(fakeAxis(axis,'line'))
    children.push(fakeAxis(axis,'positive'))
  }
  children.push(fakePlane('XY',{x:0.15,y:0.15,z:0}))
  children.push(fakePlane('XZ',{x:0.15,y:0,z:0.15}))
  children.push(fakePlane('YZ',{x:0,y:0.15,z:0.15}))
  children.push({name:'XYZ'})
  return { children }
}

class FakeTransformControls {
  constructor() {
    this.mode='translate'
    this.space='world'
    this.dragging=false
    this.eye=new FakeVector3(1,1,1)
    this.worldQuaternion={ rotationY:0 }
    this.worldPosition={x:12,y:-4,z:7}
    this.nativeScale=2.5
    this._gizmo={
      gizmo:{ translate:fakeGroup(true), scale:fakeGroup(true) },
      picker:{ translate:fakeGroup(false), scale:fakeGroup(false) },
    }
    this._gizmo.updateMatrixWorld=()=>{
      for (const layer of ['gizmo','picker']) {
        for (const h of this._gizmo[layer][this.mode].children) {
          h.visible = true
          if (h.scale) Object.assign(h.scale, {x:this.nativeScale,y:this.nativeScale,z:this.nativeScale})
          if (h.position) Object.assign(h.position,this.worldPosition)
        }
      }
    }
  }
}

const methods = loadMethods(gizmo, 'gizmoMethods', {
  THREE: { Vector3: FakeVector3, Quaternion: class {} },
  TransformControls: FakeTransformControls,
  ContinuousGrab: class {},
  store: { prefs:{ gizmoSize:1 } },
  gizmoScale: x => x,
})

function makeControl(mode='translate') {
  const control = new FakeTransformControls()
  control.mode = mode
  methods._cameraFacingHandles.call({}, control)
  control.object = {}
  return control
}

function groupHandle(control, layer, name) {
  return control._gizmo[layer][control.mode].children.find(h => h.name === name)
}
function bakedCenter(handle) {
  const { position:p, scale:s, bakedCenter:g } = handle
  return {x:p.x + g.x * s.x, y:p.y + g.y * s.y, z:p.z + g.z * s.z}
}
function expectedCenter(pivot, scale, localCenter, signs) {
  return Object.fromEntries(['x','y','z'].map(axis => [axis, pivot[axis] + scale * localCenter[axis] * signs[axis]]))
}

test('CFH-01: planos XY/XZ/YZ quedan cerca del pivote en el cuadrante visible', () => {
  const control=makeControl()
  control.eye=new FakeVector3(-1,1,-1)
  control._gizmo.updateMatrixWorld(true)
  const pivot=control.worldPosition, factor=control.nativeScale, signs={x:-1,y:1,z:-1}
  for (const name of ['XY','XZ','YZ']) {
    const visual=groupHandle(control,'gizmo',name)
    const picker=groupHandle(control,'picker',name)
    assert.deepEqual(visual.position,pivot,`${name}: pivote visual`)
    assert.deepEqual(picker.position,pivot,`${name}: pivote picker`)
    assert.deepEqual(bakedCenter(visual),expectedCenter(pivot,factor,visual.bakedCenter,signs))
    assert.deepEqual(bakedCenter(picker),expectedCenter(pivot,factor,picker.bakedCenter,signs))
    assert.deepEqual(bakedCenter(visual),bakedCenter(picker),`${name}: picker alineado`)
  }
})

test('CFH-02: congelamiento del cuadrante durante el arrastre', () => {
  const control=makeControl()
  control.eye=new FakeVector3(1,1,1)
  control._gizmo.updateMatrixWorld(true)
  control.dragging=true
  control.eye=new FakeVector3(-1,-1,-1)
  control._gizmo.updateMatrixWorld(true)
  const xy=groupHandle(control,'gizmo','XY')
  assert.ok(xy.scale.x>0 && xy.scale.y>0)
  assert.deepEqual(xy.position,control.worldPosition)
  control.dragging=false
  control._gizmo.updateMatrixWorld(true)
  assert.ok(xy.scale.x<0 && xy.scale.y<0)
  assert.deepEqual(xy.position,control.worldPosition)
})

test('CFH-03: escala orienta sus planos de dos ejes al mismo cuadrante que traslación', () => {
  const control=makeControl('scale')
  control.eye=new FakeVector3(-1,-1,-1)
  control._gizmo.updateMatrixWorld(true)
  const xy=groupHandle(control,'gizmo','XY'), picker=groupHandle(control,'picker','XY')
  assert.deepEqual(xy.position,control.worldPosition)
  assert.deepEqual(xy.scale,{x:-2.5,y:-2.5,z:2.5})
  assert.deepEqual(picker.scale,xy.scale)
  assert.deepEqual(bakedCenter(xy),bakedCenter(picker))
})

test('CFH-04: tamaño relativo a la cámara y pivote mundial se preservan en cada actualización', () => {
  const control=makeControl()
  control.eye=new FakeVector3(-1,1,-1)
  const xy=groupHandle(control,'gizmo','XY')
  for (const [position,factor] of [ [{x:12,y:-4,z:7},2.5], [{x:-150,y:18,z:80},0.8], [{x:1250,y:-600,z:-200},4.25] ]) {
    control.worldPosition=position
    control.nativeScale=factor
    control._gizmo.updateMatrixWorld(true)
    assert.deepEqual(xy.position,position)
    assert.equal(xy.scale.x,-factor)
    assert.equal(xy.scale.y,factor)
    assert.equal(xy.scale.z,factor)
    assert.deepEqual(groupHandle(control,'picker','XY').position,position)
    assert.deepEqual(bakedCenter(xy),bakedCenter(groupHandle(control,'picker','XY')))
  }
})

test('CFH-05: los cuadrantes respetan orientación local y ejes globales', () => {
  const control=makeControl()
  control.worldQuaternion={rotationY:Math.PI}
  control.eye=new FakeVector3(1,1,1)
  control.space='local'
  control._gizmo.updateMatrixWorld(true)
  assert.ok(groupHandle(control,'gizmo','XZ').scale.x<0)
  assert.ok(groupHandle(control,'gizmo','XZ').scale.z<0)
  control.space='world'
  control._gizmo.updateMatrixWorld(true)
  assert.ok(groupHandle(control,'gizmo','XZ').scale.x>0)
  assert.ok(groupHandle(control,'gizmo','XZ').scale.z>0)
})

test('CFH-06: re-render continuo no acumula reflejos ni modifica el picker', () => {
  const control=makeControl()
  control.eye=new FakeVector3(-1,-1,-1)
  for (let i=0;i<15;i++) {
    control._gizmo.updateMatrixWorld(true)
    for (const name of ['XY','XZ','YZ']) {
      const visual=groupHandle(control,'gizmo',name), picker=groupHandle(control,'picker',name)
      assert.deepEqual(bakedCenter(visual),bakedCenter(picker))
      assert.equal(picker.layers.mask,1)
      assert.deepEqual(visual.position,control.worldPosition)
    }
  }
})

test('CFH-07: la implementación comparte el mapa de planos entre traslación y escala', () => {
  assert.match(gizmo, /const planeAxes = \{ XY: \['X', 'Y'\], XZ: \['X', 'Z'\], YZ: \['Y', 'Z'\] \}/)
  assert.match(gizmo, /native\[layer\]\[control\.mode\]\.children/)
  assert.match(gizmo, /handle\.scale\[axis\.toLowerCase\(\)\] \*= side\[axis\]/)
  assert.doesNotMatch(gizmo, /handle\.position\[coord\]\s*=/)
})
