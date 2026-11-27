// LF-EDITOR-TOP-HUD-LAYOUT-CORR-G001: mensajes solo en el borde inferior del viewport.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const src=p=>readFileSync(new URL(`../src/${p}`,import.meta.url),'utf8')
const toolbar=src('components/Toolbar.vue')
const overlay=src('components/ViewportOverlay.vue')
const orient=src('components/OrientGizmo.vue')
const keys=src('core/editor/keys.js')
const app=src('App.vue')
const state=src('core/state/state.js')
const status=src('components/StatusBar.vue')
const template=s=>s.match(/<template>([\s\S]*)<\/template>/)?.[1] || ''
test('HUD-01: Toolbar comienza con los controles de juego y conserva los grupos de herramientas',()=>{
 const t=template(toolbar);assert.match(t,/class="side left"/);assert.match(t,/class="side right"/)
 assert.doesNotMatch(t,/uniformScaleHud|role="status"|class="uniform-scale-hud"/)
 assert.match(toolbar,/display: grid; grid-template-columns: auto minmax\(0, 1fr\) auto/)
 assert.ok(t.indexOf('class="g play"') < t.indexOf('class="side left"'))
})
test('HUD-02: barra de herramientas conserva altura fija de 36px',()=>{
 assert.match(toolbar,/\.tb \{[^}]*height: 36px;/)
 assert.doesNotMatch(toolbar,/\.uniform-scale-hud \{/)
})
test('HUD-03: ViewportOverlay no contiene banda superior ni mensajes persistentes',()=>{
 const t=template(overlay)
 assert.doesNotMatch(t,/<div class="ov"|class="chip|class="left"|crumb|mode\.text|viewInfo/)
 assert.doesNotMatch(overlay,/\.ov \{|position: absolute; top: 8px/)
})
test('HUD-04: aviso escala numérica se muestra solamente en viewport inferior',()=>{
 assert.match(template(overlay),/store\.uniformScaleHud/)
 assert.match(overlay,/\.hud \{ position: absolute; left: 50%; bottom: 12px;/)
 assert.doesNotMatch(template(toolbar),/uniformScaleHud/)
})
test('HUD-05: aviso Edit Mode conserva el mismo estado y la misma región',()=>{
 assert.match(template(overlay),/store\.edit\.on \? !!store\.edit\.hud : !!store\.uniformScaleHud/)
 assert.match(template(overlay),/store\.edit\.on \? store\.edit\.hud : store\.uniformScaleHud/)
})
test('HUD-06: solo existe un estado accesible y no bloquea pulsaciones',()=>{
 assert.equal((template(overlay).match(/role="status"/g)||[]).length,1)
 assert.match(overlay,/aria-live="polite"/);assert.match(overlay,/pointer-events: none/)
})
test('HUD-07: gizmo de orientación permanece funcional e interactivo',()=>{
 assert.match(template(overlay),/<OrientGizmo v-if="store\.prefs\.orientGizmo"\s*\/>/)
 assert.match(orient,/@click\.stop="run\('view\.' \+ a\.view\)"/)
 assert.match(orient,/\.og \{ position: absolute; top: 48px;/)
})
test('HUD-08: sin aviso temporal no se crea contenedor vacío',()=>{
 assert.match(template(overlay),/v-if="store\.edit\.on \? !!store\.edit\.hud : !!store\.uniformScaleHud"/)
})
test('HUD-09: CA-TRANSFORM-S-OBJECTMODE-001 retira la escala modal de Object Mode',()=>{
 assert.doesNotMatch(keys,/_uniformScaleKey|_endUniformScale|uniformScaleHud|case 's':/)
 assert.match(keys,/if \(mod && k === 's'\).*?saveAll\(\)/)
})
test('HUD-10: el aviso Edit Mode sigue ligado al estado del editor',()=>{
 assert.match(state,/hud: ''/)
 assert.match(src('core/mesh/session-modal.js'),/store\.edit\.hud/)
})
test('HUD-11: no se duplica lógica de HUD en StatusBar',()=>{
 assert.doesNotMatch(status,/uniformScaleHud|edit\.hud/)
 assert.match(status,/saveView/)
})
test('HUD-12: overlay solo aparece en Editor, no sobre Player',()=>{
 assert.match(app,/<ViewportOverlay v-if="store\.project && !store\.play\.on"\s*\/>/)
})
test('HUD-13: atajos y herramientas permanecen en el encabezado',()=>{
 const t=template(toolbar)
 for(const token of ['tool.move','tool.rotate','tool.scale','SnapControls','openMeshPanel','run(\'play.start\')'])assert.ok(toolbar.includes(token),token)
 assert.match(t,/role="toolbar"/)
 assert.match(src('components/MenuBar.vue'), /openAddMenu\(/)
 assert.doesNotMatch(t, /@click="openAdd"/)
})
test('HUD-14: aviso largo ocupa un máximo del ancho, con elipsis',()=>{
 assert.match(overlay,/max-width: calc\(100% - 24px\)/)
 assert.match(overlay,/text-overflow: ellipsis/)
 assert.match(overlay,/white-space: nowrap/)
})
test('HUD-15: no se crea otro overlay ni un gestor de mensajes',()=>{
 assert.doesNotMatch(overlay,/useState|watch\(|new .*Manager|setTimeout/)
 assert.match(overlay,/import \{ store \} from '\.\.\/core\/store\.js'/)
})
