import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const file = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const panel = file('src/components/TimelinePanel.vue')
const context = file('src/components/ContextMenu.vue')
const list = file('src/components/MenuList.vue')

// Ejecutar el algoritmo ORIGINAL del componente con DOM simulado: no mantener un clon de QA.
// Parseo correcto de funciones: los bloques equilibran llaves, no hay strings con llaves en estas funciones.
function fn(source,name){
 const start=source.indexOf(`function ${name}(`), brace=source.indexOf('{',start)
 assert.ok(start>=0)
 let d=0
 for(let i=brace;i<source.length;i++){
   if(source[i]==='{')d++; else if(source[i]==='}' && --d===0)return source.slice(start,i+1)
 }
 throw Error(`Bloque ${name} no cerrado`)
}
function posHarness({vw=640,vh=480,x=170,y=210,w=220,h=230,anchor=null}={}) {
 const store={menu:{x,y,...(anchor?{timelineAnchor:anchor}:{})}}
 const pos={value:null},el={value:{getBoundingClientRect:()=>({width:w,height:h})}}
 const win={innerWidth:vw,innerHeight:vh}
 const cx=vm.createContext({store,pos,el,window:win})
 vm.runInContext(fn(context,'positionMenu'),cx)
 cx.positionMenu()
 return {at:pos.value,store,window:win,rerun:()=>{cx.positionMenu();return pos.value}}
}
const anchor=(top,bottom,left=60,right=250,contentTop=148,mode='row')=>({top,bottom,left,right,contentTop,mode})
const bounded=(result,screen)=>result.x>=5&&result.x+220<=screen-5

test('UXP-01 · un menú normal conserva el comportamiento de ventana',()=>{
 const {at}=posHarness({x:500,y:400})
 assert.equal(at.x,414);assert.equal(at.y,244);assert.equal(at.maxHeight,null)
})
test('UXP-02 · menú de pista bajo primera fila, sin invadir regla',()=>{
 const {at}=posHarness({anchor:anchor(185,221)})
 assert.ok(at.y>=227);assert.ok(at.x>=256)
})
test('UXP-03 · menú de fila no invade nombre cuando hay espacio lateral',()=>{
 const a=anchor(187,223);const {at}=posHarness({anchor:a,vw:800})
 assert.ok(at.x>=a.right+6)
})
test('UXP-04 · menú de fila se abre hacia izquierda al llegar al borde derecho',()=>{
 const {at}=posHarness({vw:670,anchor:anchor(185,221,480,660)})
 assert.equal(at.x,254)
})
test('UXP-05 · menú largo con poco espacio inferior adquiere scroll',()=>{
 const {at}=posHarness({vh:350,h:400,anchor:anchor(185,221)})
 assert.ok(at.maxHeight<400 && at.maxHeight>=36)
 assert.ok(at.y>=148)
})
test('UXP-06 · si hay espacio superior y no inferior, se abre arriba de la fila',()=>{
 const {at}=posHarness({vh:480,h:230,anchor:anchor(388,424,60,250,150)})
 assert.ok(at.y+at.maxHeight<=388)
 assert.ok(at.y>=150)
})
test('UXP-07 · menú de pista no invade la cabecera aunque haya muy poca altura',()=>{
 const {at}=posHarness({vh:265,h:400,anchor:anchor(185,221,60,250,148)})
 assert.ok(at.y>=148)
})
test('UXP-08 · límite de ventana horizontal también aplica a un anclaje puntual',()=>{
 const {at}=posHarness({x:615,vw:640,anchor:anchor(185,197,615,625,148,'point')})
 assert.ok(bounded(at,640))
})
test('UXP-09 · menú de keyframe puntual aparece al lado de la clave cuando cabe',()=>{
 const {at}=posHarness({x:313,anchor:anchor(196,207,313,324,148,'point')})
 assert.ok(at.x>=330)
})
test('UXP-10 · redimensionado actualiza los límites con el mismo host',()=>{
 const h=posHarness({vw:1000,anchor:anchor(185,221,60,250)});h.window.innerWidth=640
 assert.ok(bounded(h.rerun(),640))
})
test('UXP-11 · cálculo de posición no altera acciones de menú',()=>{
 const h=posHarness({anchor:anchor(185,221)});const before=JSON.stringify(h.store.menu)
 h.rerun();assert.equal(JSON.stringify(h.store.menu),before)
})
test('UXP-12 · menú compartido recibe la máxima altura mediante variable CSS',()=>{
 assert.match(context,/--lf-menu-max-height/);assert.match(list,/var\(--lf-menu-max-height/)
 assert.match(list,/overflow-y:\s*auto/)
})
test('UXP-13 · menús compartidos conservan Escape y clic exterior',()=>{
 assert.match(context,/e\.key !== 'Escape'/);assert.match(context,/onOutsideContextMenu/)
 assert.match(context,/onPointerDown/);assert.match(list,/ArrowDown.*ArrowUp/)
})
test('UXP-14 · los submenús mantienen su propio posicionamiento reversible',()=>{
 assert.match(list,/function openSub/);assert.match(list,/left = r\.right/)
 assert.match(list,/function closeSub/)
})
test('UXP-15 · el título y las etiquetas largas se truncan dentro del menú',()=>{
 assert.match(list,/\.lbl\s*\{[^}]*text-overflow: ellipsis/)
 assert.match(list,/\.head\s*\{[^}]*text-overflow:ellipsis/)
})
test('UXP-16 · Timeline incorpora anclaje a seis menús, sin otro sistema',()=>{
 assert.ok((panel.match(/timelineAnchor:/g)||[]).length>=6)
 assert.doesNotMatch(panel,/new MenuManager|new ContextMenuManager/)
})
test('UXH-01 · los encabezados se derivan de un único visibleRows',()=>{
 assert.equal((panel.match(/v-for="row in visibleRows"/g)||[]).length,2)
 assert.match(panel,/:data-timeline-row="row\.type"/)
})
test('UXH-02 · las pistas especializadas conservan 36 px y ambas columnas comparten la geometría compacta',()=>{
 assert.match(panel,/\.pinned-row\s*\{[^}]*height:36px;\s*min-height:36px/)
 assert.match(panel,/\.trow\s*\{\s*display:block;\s*height:36px/)
 assert.match(panel,/\.pinned-row\.property-value-row[^}]*height:var\(--tl-property-row-height\)/)
 assert.match(panel,/\.trow\.property-value-row[^}]*height:var\(--tl-property-row-height\)/)
})
test('UXH-03 · encabezado y propiedad tienen roles visuales distintos',()=>{
 assert.match(panel,/\.node-row-name\s*\{[^}]*font-weight:600/)
})
test('UXH-04 · propiedades no replican los controles de cabecera',()=>{
 assert.match(panel,/\.pinned-row \.head\.node-property-head\s*\{[^}]*padding:0 8px 0 66px/)
 assert.match(panel,/\.node-property-name[^\n]*text-overflow:ellipsis/)
})
test('UXH-05 · el control de bloqueo y mute no comprimen la propiedad indefinidamente',()=>{
 assert.match(panel,/class="property-actions"/)
 assert.match(panel,/\.node-property-name[^\n]*min-width:0/)
})
test('UXH-06 · keyframe es puntual y su línea no intercepta clics',()=>{
 assert.match(panel,/\.lane\.property-lane \.key\.node[^\n]*rotate\(45deg\)/)
 assert.match(panel,/\.lane\.property-lane \.node-key-interval[^\n]*pointer-events:none/)
})
test('UXH-07 · foco de keyframe no depende del hover ni mueve tiempo',()=>{
 assert.match(panel,/\.lane\.property-lane \.key\.node\.on,\.lane\.property-lane \.key\.node:focus-visible/)
 assert.match(panel,/outline-offset:2px/)
})
test('UXH-08 · las pistas de audio y cámaras conservan controles propios',()=>{
 assert.match(panel,/row\.track\.kind === 'camera'/)
 assert.match(panel,/TimelineAudioSource/)
 assert.match(panel,/timeline-live-clip/)
})
