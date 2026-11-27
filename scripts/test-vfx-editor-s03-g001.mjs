import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { newVfxResource, validateVfxResource } from '../src/engine/runtime/vfx/resource.js'
import { moveVfxPoint, insertVfxPoint, removeVfxPoint } from '../src/core/editor/vfx-curves.js'

const resource = newVfxResource('s03', 'edicion.vfx')
const validate = (curve, key = 'size') => validateVfxResource({
  ...resource, evolution: { ...resource.evolution, [key]: curve },
}).evolution[key]

test('VFX-S03-01 · los puntos editados mantienen identidad y extremos', () => {
  const original = resource.evolution.size
  const moved = moveVfxPoint(original, 0, 0.9, 2)
  assert.equal(moved[0].t, 0)
  assert.equal(moved[0].value, 2)
  assert.equal(original[0].value, 0.5)
  assert.deepEqual(validate(moved), moved)
})
test('VFX-S03-02 · límites temporales impiden cruces entre puntos', () => {
  const values = [{ t: 0, value: 0 }, { t: 0.25, value: 0.5 }, { t: 1, value: 1 }]
  const after = moveVfxPoint(values, 1, 2, 0.7)
  assert.ok(after[1].t < after[2].t)
  assert.deepEqual(validate(after, 'opacity'), after)
})
test('VFX-S03-03 · insertar genera un punto interpolado, sin modificar el original', () => {
  const a = resource.evolution.size, b = insertVfxPoint(a)
  assert.equal(a.length, 2)
  assert.equal(b.length, 3)
  assert.equal(b[1].t, 0.5)
  assert.equal(b[1].value, 1)
  assert.deepEqual(validate(b), b)
})
test('VFX-S03-04 · color conserva interpolación de paradas editables', () => {
  const a = resource.evolution.color, b = insertVfxPoint(a, 'color')
  const c = moveVfxPoint(b, 1, 0.7, '#abc123', 'color')
  assert.equal(c[1].t, 0.7)
  assert.equal(c[1].color, '#abc123')
  assert.deepEqual(validate(c, 'color'), c)
})
test('VFX-S03-05 · eliminar impide quitar extremos y deja recursos válidos', () => {
  const a = insertVfxPoint(resource.evolution.size)
  assert.equal(removeVfxPoint(a, 0), null)
  assert.equal(removeVfxPoint(a, 2), null)
  assert.deepEqual(validate(removeVfxPoint(a, 1)), resource.evolution.size)
})
test('VFX-S03-06 · 32 paradas son el límite del esquema', () => {
  const a = Array.from({ length:32 }, (_,i) => ({ t: i / 31, value: i / 31 }))
  assert.equal(insertVfxPoint(a), null)
  assert.deepEqual(validate(a, 'opacity'), a)
})

// Instrumentación funcional de la sesión real: se sustituyen únicamente WebGL y el host.
const source = readFileSync(new URL('../src/core/editor/vfx-preview.js', import.meta.url), 'utf8')
  .replace(/^import .+\n/gm, '').replace('export class VfxPreviewSession', 'class VfxPreviewSession') + '\nthis.Preview = VfxPreviewSession'
const renderers = []
class Group {
  constructor() { this.children=[]; this.parent=null }
  add(x) { this.children.push(x); x.parent=this }
  remove(x) { this.children=this.children.filter(v=>v!==x); x.parent=null }
}
class Simulation { constructor(r) { this.resource=r; this.count=0; this.elapsed=0 } update(dt) { this.elapsed+=dt; this.count++ } }
class Renderer { constructor(s) { this.simulation=s; this.mesh={}; renderers.push(this) } sync() { this.draws=(this.draws||0)+1 } dispose() { this.disposed=true; this.mesh.parent?.remove(this.mesh) } }
const context={ THREE:{Group}, VfxSimulation:Simulation, VfxBillboardRenderer:Renderer, JSON, Error }
vm.runInNewContext(source, context)
function makeHost() {
  const vp={
    world:{visible:true},overlay:{visible:true},grid:{visible:true},scene:new Group(),
    persp:{position:{set(){}},zoom:2,updateProjectionMatrix(){}},camera:{tag:'original'},
    controls:{object:null,target:{set(){}},update(){}},
    snap:{id:'before'}, events:[], onFrame(fn){this.events.push(fn);return ()=>{this.events=this.events.filter(x=>x!==fn)}},
    saveEditorView(){return this.snap},restoreEditorView(s){this.restored=s},requestRender(){this.redraw=(this.redraw||0)+1},
  }
  return {vp,spriteTexture:()=>null}
}
test('VFX-S03-07 · preview reutiliza onFrame y revierte visibilidad, cámara y ciclo',()=>{
  const editor=makeHost(), session=new context.Preview(editor,()=>resource)
  assert.equal(editor.vp.events.length,1)
  assert.equal(editor.vp.world.visible,false)
  assert.equal(editor.vp.overlay.visible,false)
  assert.equal(editor.vp.grid.visible,false)
  editor.vp.events[0](0.1)
  assert.equal(session.simulation.count,1)
  session.playing=false
  editor.vp.events[0](0.1)
  assert.equal(session.simulation.count,1)
  session.step()
  assert.equal(session.simulation.count,2)
  session.dispose()
  assert.equal(editor.vp.events.length,0)
  assert.equal(editor.vp.world.visible,true)
  assert.equal(editor.vp.overlay.visible,true)
  assert.equal(editor.vp.grid.visible,true)
  assert.equal(editor.vp.restored,editor.vp.snap)
  assert.equal(renderers.at(-1).disposed,true)
  assert.equal(editor.vp.scene.children.length,0)
  session.dispose()
})
test('VFX-S03-08 · preview rechaza textura ausente y no resucita tras destruirse',()=>{
  const editor=makeHost(), r=structuredClone(resource)
  r.appearance.textureId='not-loaded'
  const session=new context.Preview(editor,()=>r)
  assert.match(session.error,/Esperando textura/)
  assert.equal(session.simulation,null)
  const previous=renderers.length
  session.dispose()
  assert.equal(editor.vp.events.length,0)
  session.frame(1)
  assert.equal(renderers.length,previous)
})
