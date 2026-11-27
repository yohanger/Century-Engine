// LF-EDITOR-WINDOWS-LAYOUT-CORR-G001 — política de escritorio y paneles sin ocultamiento por DPI.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { editorScreenMode, fitEditorDocks, fitEditorWindow } from '../src/core/editor/window-layout.js'

const read = (path) => readFileSync(new URL('../'+path,import.meta.url),'utf8')
const app = read('src/App.vue'), splitter = read('src/components/Splitter.vue')
const appWin = read('src/components/AppWindow.vue')
const floating = read('src/components/FloatingEditorWindow.vue')
const prefs = () => ({leftOpen:true,rightOpen:true,bottomOpen:true,leftW:236,rightW:296,bottomH:210})

for(const width of [576,640,720,768,910,1099,1100,1366,1920]){
  test(`WL-01 Electron mantiene dock fijo con ${width}px CSS`,()=>assert.equal(editorScreenMode(width,true),'desktop'))
}
test('WL-02 Navegador continúa usando modo tableta y móvil',()=>{
  assert.equal(editorScreenMode(680,false),'phone')
  assert.equal(editorScreenMode(900,false),'tablet')
  assert.equal(editorScreenMode(1100,false),'desktop')
})
for(const [label,w,h] of [['1920x1080',1920,1080],['1366x768',1366,768],['125% 1366',1093,614],['150% 1366',910,512],['720 small',720,480],['576 ultra',576,440]]){
  test(`WL-03 Distribución estable ${label} con paneles y viewport`,()=>{
    const p=prefs(), original=JSON.stringify(p), d=fitEditorDocks(w,h,p)
    assert.ok(d.left>0&&d.right>0&&d.bottom>0)
    assert.ok(d.left+d.right+10<=w,JSON.stringify(d))
    assert.ok(w-d.left-d.right-10>90)
    assert.ok(d.bottom+96+5<h)
    assert.equal(JSON.stringify(p),original,'no reescribir preferencias al limitar tamaño')
  })
}
test('WL-04 El tamaño original vuelve al ampliar ventana',()=>{
  const p=prefs(), normal=fitEditorDocks(1440,900,p),small=fitEditorDocks(720,480,p),again=fitEditorDocks(1440,900,p)
  assert.equal(normal.left,p.leftW);assert.equal(normal.right,p.rightW);assert.equal(normal.bottom,p.bottomH)
  assert.ok(small.left<normal.left&&small.right<normal.right)
  assert.deepEqual(again,normal)
})
test('WL-05 Ocultar un panel deja espacio al viewport sin alterar otros',()=>{
  const p=prefs();p.leftOpen=false;p.rightOpen=true
  const d=fitEditorDocks(720,550,p)
  assert.equal(d.left,0);assert.ok(d.right>0)
  p.leftOpen=true;p.rightOpen=false
  assert.equal(fitEditorDocks(720,550,p).right,0)
})
test('WL-06 Splitters reciben límites dinámicos para el espacio disponible',()=>{
  const d=fitEditorDocks(720,480,prefs())
  assert.ok(d.leftMax>=d.leftMin&&d.rightMax>=d.rightMin&&d.bottomMax>=55)
  assert.match(app,/:max="dockSizes\.leftMax"/)
  assert.match(app,/:max="dockSizes\.rightMax"/)
  assert.match(app,/:max="dockSizes\.bottomMax"/)
  assert.match(splitter,/window\.addEventListener\('pointermove'/)
})
test('WL-07 Los 3 docks siguen en template escritorio sin cajones forzados',()=>{
  assert.match(app,/mode === 'desktop' && store\.prefs\.leftOpen/)
  assert.match(app,/mode === 'desktop' && store\.prefs\.rightOpen/)
  assert.match(app,/mode === 'desktop' && store\.prefs\.bottomOpen/)
  assert.match(app,/editorScreenMode\(viewportSize\.width, !!window\.lf\?\.isElectron\)/)
  assert.match(app,/width: dockSizes\.left/)
  assert.match(app,/width: dockSizes\.right/)
  assert.match(app,/height: dockSizes\.bottom/)
})
test('WL-08 Preferencias de aperturas/tamaños siguen persistentes y voluntarias',()=>{
  const s=read('src/core/state/state.js')
  for(const key of ['leftOpen','rightOpen','bottomOpen','leftW','rightW','bottomH']) assert.match(s,new RegExp(key+':'))
  assert.match(s,/localStorage\.setItem\(PREFS_KEY/)
  // CA-001: visibilidad por panel en el layout único; las preferencias legadas se mantienen para compatibilidad.
  assert.match(read('src/components/Toolbar.vue'),/hideDockPanel\(/)
  assert.match(read('src/components/Toolbar.vue'),/restoreDockPanel\(/)
  assert.match(read('src/components/Toolbar.vue'),/store\.prefs\[dest\.zone \+ 'Open'\] = true/)
})
test('WL-09 ventana restaurada a la derecha vuelve a estar completamente visible',()=>{
  assert.deepEqual(fitEditorWindow({x:2200,y:200,w:650,h:500},800,600),{x:142,y:92,w:650,h:500})
})
test('WL-10 ventana restaurada con origen negativo queda visible',()=>{
  const a=fitEditorWindow({x:-350,y:-900,w:720,h:520},900,700)
  assert.equal(a.x,8);assert.equal(a.y,40)
})
test('WL-11 Ventana mayor que el viewport reduce tamaño sin desbordarlo',()=>{
  const a=fitEditorWindow({x:80,y:150,w:1400,h:1000},720,480)
  assert.ok(a.w<=704&&a.h<=432&&a.x+a.w<=720&&a.y+a.h<=480)
})
test('WL-12 AppWindow conserva geometría persistente al redimensionar',()=>{
  assert.match(appWin,/load\(\)/);assert.match(appWin,/function save\(/)
  assert.match(appWin,/fitEditorWindow\(/)
  assert.match(appWin,/!window\.lf\?\.isElectron/)
  assert.match(appWin,/hostWindow\.addEventListener\('resize', onResize\)/)
})
test('WL-13 FloatingEditorWindow restaura la posición propia y respeta docking',()=>{
  assert.match(floating,/lf\.float\.\$\{props\.label\}/)
  assert.match(floating,/function loadPosition\(/)
  assert.match(floating,/function savePosition\(/)
  // CA-001: docking integrado con la posición del panel; conserva docking central heredado.
  assert.match(floating,/const isDocked = computed\(/)
  assert.match(floating,/if \(isDocked\.value\) return/)
  assert.match(floating,/fitEditorWindow\(/)
  assert.match(floating,/savePosition\(\)/)
})
test('WL-14 No se cambian las reglas de Play maximizado ni de Player',()=>{
  assert.match(app,/store\.play\.on && store\.prefs\.gameMaximize/)
  assert.match(app, /!maxed/)
  assert.match(read('src/engine/runtime/package/game.js'), /export|function|const/)
})
test('WL-15 Espacio estrecho sin preferencias corruptas ni NaN',()=>{
  for(const x of [0,NaN,-100,Infinity,5e6]){
    const d=fitEditorDocks(720,400,{...prefs(),leftW:x,rightW:x,bottomH:x})
    for(const k of ['left','right','bottom']) assert.ok(Number.isFinite(d[k])&&d[k]>=0)
  }
})

test('WL-16 El divisor izquierdo puede aprovechar el espacio bajo escalado DPI',()=>{
  const p=prefs(), a=fitEditorDocks(720,500,p,'left')
  p.leftW=a.leftMax
  const b=fitEditorDocks(720,500,p,'left')
  assert.equal(b.left,b.leftMax)
  assert.ok(b.right>=b.rightMin)
  assert.ok(720-b.left-b.right-10>=280)
})
test('WL-17 El divisor derecho puede aprovechar el espacio bajo escalado DPI',()=>{
  const p=prefs(), a=fitEditorDocks(720,500,p,'right')
  p.rightW=a.rightMax
  const b=fitEditorDocks(720,500,p,'right')
  assert.equal(b.right,b.rightMax)
  assert.ok(b.left>=b.leftMin)
})
test('WL-18 Arrastrar un panel no modifica el ancho guardado del otro',()=>{
  assert.match(app,/function resizeDock\(side, width\)/)
  assert.match(app, /store\.prefs\[side \+ 'W'\] = width/)
  assert.match(app, /resizeDock\('left', \$event\)/)
  assert.match(app, /resizeDock\('right', \$event\)/)
})
test('WL-19 Sin proyecto el Editor conserva la estructura de pantalla',()=>{
  assert.match(app, /<header v-else class="ph"><\/header>/)
  assert.match(app,/v-if="store\.project && mode === 'desktop'/)
})
test('WL-20 Reiniciar Electron preserva pestañas y configuración abierta',()=>{
  const s=read('src/core/state/state.js')
  for(const key of ['leftOpen','rightOpen','bottomOpen','leftW','rightW','bottomH','rightTab','bottomTab'])
    assert.match(s,new RegExp('\\b'+key+':'))
  assert.match(s,/localStorage\.getItem\(PREFS_KEY/)
})
test('WL-21 Ventana flotante fuera de monitor anterior se rescata',()=>{
  const r=fitEditorWindow({x:5000,y:3000,w:1100,h:700},1093,614,44,12)
  assert.ok(r.x>=12&&r.y>=44&&r.x+r.w<=1093-12&&r.y+r.h<=614-12)
})
test('WL-22 La corrección es equivalente en Windows y Linux Electron',()=>{
  assert.match(read('electron/preload.cjs'),/isElectron: true/)
  assert.match(app,/!!window\.lf\?\.isElectron/)
  assert.doesNotMatch(app,/navigator\.platform.*Win32/)
})
test('WL-23 Fuzz anchos de viewport sin paneles fuera de su contenedor',()=>{
  for(let w=360;w<=1920;w+=7) {
    const d=fitEditorDocks(w,520,{...prefs(),leftW:2000,rightW:2000},'left')
    assert.ok(d.left+d.right+10<=w,`width ${w}: ${JSON.stringify(d)}`)
    assert.ok(d.left>=0 && d.right>=0 && d.bottom>0)
  }
})
