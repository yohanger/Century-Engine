// LF-EDITOR-EDITMODE-SHIFT-SNAP-CORR-G001 · pruebas de contratos y continuidad del gesto.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { snapModalValue, snapEnabled, snapStep } from '../src/core/editor/snap.js'

const src = (file) => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
const near = (a, b) => assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`)

test('EMS-01: el modo modal usa la configuración real de Snap', () => {
  const cfg={ moveSnapOn:true,rotateSnapOn:true,scaleSnapOn:true,gridSize:.5,rotSnap:15,scaleSnap:.25 }
  assert.equal(snapEnabled(cfg,'translate'),true)
  near(snapStep(cfg,'translate'),.5)
  near(snapStep(cfg,'rotate'),15)
  near(snapStep(cfg,'scale'),.25)
  assert.match(src('core/mesh/session-modal.js'), /!m\.shift && \(m\.ctrl \|\| snapEnabled\(settings, mode\)\)/)
})
test('EMS-02: Shift libera traslación sin salto al presionarlo', () => {
  const m={}
  near(snapModalValue(m,'grab:X',.81,.5,true),1)
  near(snapModalValue(m,'grab:X',.81,.5,false),1)
  near(snapModalValue(m,'grab:X',.99,.5,false),1.18)
  near(snapModalValue(m,'grab:X',.99,.5,true),1.18)
  near(snapModalValue(m,'grab:X',1.33,.5,true),1.68)
})
test('EMS-03: Shift evita Snap en los tres componentes de posición', () => {
  const m={}
  assert.deepEqual(snapModalValue(m,'grab:free',[.6,1.3,-.2],1,true),[1,1,0])
  assert.deepEqual(snapModalValue(m,'grab:free',[.6,1.3,-.2],1,false),[1,1,0])
  snapModalValue(m,'grab:free',[.8,1.8,-.55],1,false).forEach((v,i)=>near(v,[1.2,1.5,-.35][i]))
})
test('EMS-04: cambio de Shift con rotación conserva grados acumulados', () => {
  const m={}
  near(snapModalValue(m,'rotate:Y',17,15,true),15)
  near(snapModalValue(m,'rotate:Y',17,15,false),15)
  near(snapModalValue(m,'rotate:Y',21,15,false),19)
  near(snapModalValue(m,'rotate:Y',21,15,true),19)
  near(snapModalValue(m,'rotate:Y',29,15,true),34)
})
test('EMS-05: escala conserva el factor y evita redondeos al sostener Shift', () => {
  const m={}
  near(1+snapModalValue(m,'scale:all',.32,.25,true),1.25)
  near(1+snapModalValue(m,'scale:all',.32,.25,false),1.25)
  near(1+snapModalValue(m,'scale:all',.42,.25,false),1.35)
})
test('EMS-06: con Snap desactivado persiste movimiento libre', () => {
  const m={}
  near(snapModalValue(m,'grab:X',.33,1,false),.33)
  near(snapModalValue(m,'grab:X',.58,1,false),.58)
})
test('EMS-07: cambiar de restricción empieza un cálculo nuevo', () => {
  const m={}
  near(snapModalValue(m,'grab:X',.77,1,true),1)
  near(snapModalValue(m,'grab:Y',.22,1,false),.22)
  near(snapModalValue(m,'grab:Y',.33,1,false),.33)
})
test('EMS-08: Edit Mesh usa Shift en G/R/S modales sin Snap de TransformControls', () => {
  const s=src('core/mesh/session.js'), x=src('core/mesh/session-xform.js'), i=src('core/mesh/session-input.js')
  assert.doesNotMatch(s,/new TransformControls\(/)
  assert.doesNotMatch(x,/this\.tc|this\.gz/)
  assert.match(i,/this\._shiftSnapHeld = held/)
  assert.match(i,/if \(this\.modal\) this\.modal\.shift = held/)
  assert.match(src('core/mesh/session-modal.js'),/m\.shift|!m\.shift/)
})
test('EMS-09: el teclado ya no excluye Edit Mode y libera Shift con foco', () => {
  const s=src('core/editor/keys.js')
  assert.doesNotMatch(s,/!this\.edit && !store\.locked/)
  assert.match(s,/if \(this\.edit\) this\.edit\.setSnapShiftHeld\(true\)/)
  assert.match(s,/this\.edit\?\.setSnapShiftHeld\(false\)/)
  assert.match(s,/win\.addEventListener\('blur', releaseShift\)/)
  assert.match(s,/doc\.addEventListener\('visibilitychange', onVisibility\)/)
})
test('EMS-10: Shift+X/Y/Z y Ctrl+Shift+B siguen siendo atajos de malla', () => {
  const s=src('core/mesh/session-modal.js'),i=src('core/mesh/session-input.js')
  assert.match(s,/if \(e\.shiftKey\) \{ m\.axis = ax; m\.plane = true \}/)
  assert.match(i,/e\.shiftKey \? 'bevelVertex' : 'bevel'/)
  assert.match(i,/d\.e\.shiftKey/)
})
test('EMS-11: capturas normales y Continuous Grab propagan Shift al modal', () => {
  const i=src('core/mesh/session-input.js'),m=src('core/mesh/session-modal.js')
  assert.match(i,/this\.setSnapShiftHeld\?\.\(!!e\.shiftKey\)/)
  assert.match(m,/this\.setSnapShiftHeld\?\.\(!!e\.shiftKey\)/)
  assert.match(m,/m\.shift = !!e\.shiftKey/)
  assert.match(m,/m\.snapGesture = null/)
})
test('EMS-12: no cambia Snap persistente, Player ni Bevel', () => {
  const m=src('core/mesh/session-modal.js'),k=src('core/editor/keys.js')
  assert.doesNotMatch(m,/settings\.(?:snap|gridSize|rotSnap|scaleSnap)\s*=/)
  assert.match(k,/if \(store\.play\.on\) return/)
  assert.match(m,/ax === 'c' && m\.kind === 'bevel'/)
})
