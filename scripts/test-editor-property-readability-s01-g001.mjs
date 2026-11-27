// LF-EDITOR-PROPERTY-READABILITY-S01-G001: etiquetas legibles, divisor común y aviso condicionado.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {textIsClipped} from '../src/core/tooltips.js'
const read=p=>readFileSync(new URL(`../src/${p}`,import.meta.url),'utf8')
const dock=read('components/InspectorDock.vue')
const styles=read('styles.css')
const mixer=read('components/AudioMixer.vue')
const form=read('components/ParamForm.vue')
const state=read('core/state/state.js')
const prefs=read('components/PreferencesModal.vue')
const split=read('components/Splitter.vue')

function splitter(initial=112){
 const events=[]
 const listeners=new Map()
 const window={addEventListener:(k,fn)=>listeners.set(k,fn),removeEventListener:k=>listeners.delete(k)}
 const document={body:{style:{cursor:''}}}
 const props={dir:'x',modelValue:initial,min:84,max:250,invert:false}
 const script=split.match(/<script setup>([\s\S]*?)<\/script>/)?.[1]
 assert.ok(script)
 const {down,key}=runInNewContext(script+ '\n;({down,key})',{defineProps:()=>props,defineEmits:()=> (k,v)=>{events.push([k,v]);props.modelValue=v},window,document,Math})
 return {props,events,window,document,listeners,down,key}
}
test('PR1-01: etiquetas visibles se parten en varias líneas sin ellipsis',()=>{
 assert.match(styles,/\.field > label \{[^}]*white-space: normal/)
 assert.match(form,/\.row > label \{[^}]*white-space: normal/)
 assert.doesNotMatch(form,/\.row > label \{[^}]*text-overflow: ellipsis/)
})
test('PR1-02: ancho compartido e InspectorDock controla una sola variable',()=>{
 assert.match(styles,/--lf-property-label-width/)
 assert.match(form,/--lf-property-label-width/)
 assert.match(dock,/:style="\{ '--lf-property-label-width': labelW \+ 'px' \}"/)
})
test('PR1-03: el Inspector utiliza Splitter.vue, no un gesto paralelo',()=>{
 assert.match(dock,/import Splitter from '\.\/Splitter\.vue'/)
 assert.match(dock,/<Splitter v-if="!compact && tab === 'object'"/)
 assert.match(dock,/@update:model-value="setLabelWidth"/)
})
test('PR1-04: preferencias se guardan en el mismo store y se restauran al reiniciar',()=>{
 assert.match(state,/inspLabelWidth: 112/)
 assert.match(state,/localStorage\.setItem\(PREFS_KEY, JSON\.stringify\(p\)\)/)
 assert.match(prefs,/const defaults = defaultPrefs\(\)/); assert.match(prefs,/\['inspLabelWidth',/)
})
test('PR1-05: el ajuste respeta mínimo, máximo y panel estrecho',()=>{
 assert.match(dock,/dockW\.value <= 260/)
 assert.match(dock,/Math\.min\(maxLabelW\.value, Number\(store\.prefs\.inspLabelWidth\) \|\| 112\)/)
 assert.match(styles,/@container insp \(max-width: 260px\)/)
})
test('PR1-06: Splitter real actualiza valor durante el arrastre y limpia listeners',()=>{
 const s=splitter(110)
 s.down({preventDefault(){},clientX:100});s.listeners.get('pointermove')({clientX:140})
 assert.equal(s.events.at(-1)[1],150)
 s.listeners.get('pointerup')()
 assert.equal(s.listeners.size,0)
 assert.equal(s.document.body.style.cursor,'')
})
test('PR1-07: el divisor respeta límites durante el arrastre',()=>{
 const s=splitter();s.down({preventDefault(){},clientX:100})
 s.listeners.get('pointermove')({clientX:999});assert.equal(s.events.at(-1)[1],250)
 s.listeners.get('pointermove')({clientX:-999});assert.equal(s.events.at(-1)[1],84)
 s.listeners.get('pointerup')()
})
test('PR1-08: el divisor responde a teclado y previene scroll de flechas',()=>{
 const s=splitter();let prevented=0
 s.key({key:'ArrowRight',preventDefault(){prevented++}})
 s.key({key:'ArrowLeft',preventDefault(){prevented++}})
 assert.deepEqual(s.events.map(e=>e[1]),[124,112])
 assert.equal(prevented,2)
 assert.match(split,/aria-valuenow/);assert.match(split,/aria-label="label"/)
})
test('PR1-09: detección de truncamiento comprueba límites reales',()=>{
 assert.equal(textIsClipped({scrollWidth:211,clientWidth:100,scrollHeight:18,clientHeight:18},{overflowX:'hidden',overflowY:'visible'}),true)
 assert.equal(textIsClipped({scrollWidth:101,clientWidth:100,scrollHeight:18,clientHeight:18},{overflowX:'hidden',overflowY:'visible'}),false)
 assert.equal(textIsClipped({scrollWidth:211,clientWidth:100,scrollHeight:18,clientHeight:18},{overflowX:'visible',overflowY:'visible'}),false)
 assert.equal(textIsClipped({scrollWidth:99,clientWidth:100,scrollHeight:40,clientHeight:20},{overflowX:'visible',overflowY:'clip'}),true)
})
test('PR1-10: revelación distinta de tooltips de ayuda y con Escape',()=>{
 const tooltips=read('core/tooltips.js')
 assert.match(tooltips,/export function showClippedText\(/)
 assert.match(tooltips,/if \(!content \|\| !textIsClipped/)
 assert.match(tooltips,/role', 'tooltip'/)
 assert.match(tooltips,/event\.key === 'Escape'/)
 assert.match(tooltips,/aria-describedby/)
 assert.match(tooltips,/bubble\.style\.top =/)
 assert.match(tooltips,/pointerover/)
 assert.match(tooltips,/focusin/)
 assert.match(tooltips,/root\.removeEventListener/)
})
test('PR1-11: mostrar textos cortados no habilita ayudas generales',()=>{
 const t=read('core/tooltips.js')
 const f=t.slice(t.indexOf('export function showClippedText('))
 assert.doesNotMatch(f,/setTooltips\(|\.lf-tips|classList\.add\('lf-tips'/)
})
test('PR1-12: Audio Mixer enseña completos nombres de grupos y efectos',()=>{
 for(const s of ['.nm { flex: 1; min-width: 0; overflow-wrap: anywhere;', '.nm2 { font-weight: 600;', '.slot span { min-width: 0; white-space: normal; overflow-wrap: anywhere;'])assert.ok(mixer.includes(s),s)
 assert.doesNotMatch(mixer,/\.nm2 \{[^}]*text-overflow: ellipsis/)
 assert.match(mixer,/\.tree li \{[^}]*min-height: 24px/)
})
test('PR1-13: tras Audio Mixer S02 los faders y efectos quedan, pero las propiedades van al Inspector',()=>{
 assert.doesNotMatch(mixer,/<aside class="insp">/)
 assert.match(mixer,/class="fader"/)
 assert.match(mixer,/class="slots"/)
 assert.match(read('components/Inspector.vue'),/<AudioMixerInspector v-if="audioContext"/)
})
test('PR1-14: FilmMaker recibe la misma lectura sin clonar el Audio Mixer',()=>{
 assert.match(read('filmmaker/main.js'),/showClippedText\(\)/)
 assert.match(read('filmmaker/FilmApp.vue'),/AudioMixer/)
})
test('PR1-15: montaje y desmontaje del editor limpian la escucha global',()=>{
 const app=read('App.vue')
 assert.match(app,/closeClippedText = showClippedText\(\)/)
 assert.match(app,/closeClippedText\?\.\(\)/)
})
