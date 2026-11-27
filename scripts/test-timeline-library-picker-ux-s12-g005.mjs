import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/TimelinePanel.vue', import.meta.url), 'utf8')
const script = source.split('<script setup>')[1].split('</script>')[0]
const template = source.slice(source.indexOf('<template>') + 10, source.indexOf('</template>\n\n<style scoped>'))
const css = source.split('<style scoped>')[1].split('</style>')[0]
const ref = value => ({ value })
const block = name => {
  const found = script.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`, 'm'))
  assert.ok(found, `Falta la función original ${name}`)
  return found[0]
}
const pick = (names, context) => Function(...Object.keys(context), `${names.map(block).join('\n')};return {${names.join(',')}}`)(...Object.values(context))
const viewport = (rect, windowSize) => {
  const libraryOpen = ref(true), optMenu = ref(false), addMenu = ref(false), popupPlacement = ref({})
  const controls = {libraryOpen,optMenu,addMenu,popupPlacement,
    libraryButton:ref({getBoundingClientRect:()=>rect}),optionsButton:ref(null),trackButton:ref(null),window:windowSize}
  pick(['activePopup','repositionPopup'],controls).repositionPopup()
  return popupPlacement.value
}
const px = n => parseFloat(n)

test('G005-01 · fuente única de la biblioteca, ID y exclusión FilmMaker', () => {
  assert.match(script, /store\.project\?\.timelines \|\| \[\]\)\.filter\(t => !isFilmMakerTimeline\(t\)\)/)
  assert.match(script, /const listing = computed\(\(\) => timelines\.value\.filter\(t => t\.name\.toLocaleLowerCase\(\)\.includes/)
  assert.match(script, /store\.projSel = \{ kind: 'timeline', id \}/)
  assert.match(script, /openTimelineEditor\(id\)/)
  assert.match(template, /v-for="resource in listing" :key="resource.id"/)
  assert.match(template, /@click="createTimelineDialog\(\)"/)
})

test('G005-02 · popup compacto sin altura fija, con scroll de resultados', () => {
  assert.match(script, /height: 'auto'/)
  assert.doesNotMatch(script, /height: kind === 'library' \? Math\.min/)
  assert.match(css, /\.library-pop \{[^}]*display:flex;flex-direction:column;/)
  assert.match(css, /\.library-list \{[^}]*flex:0 1 auto;overflow-x:hidden;overflow-y:auto/)
  assert.match(css, /\.library-search \{[^}]*flex:none/)
  assert.match(template, /v-if="!timelines\.length"/)
  assert.match(template, /v-else-if="!listing\.length"/)
})

test('G005-03 · popup bajo selector respeta los límites de ventana', () => {
  const place = viewport({left:330,right:480,top:210,bottom:233},{innerWidth:900,innerHeight:650})
  assert.equal(place.top,'238px')
  assert.equal(place.height,'auto')
  assert.equal(place.width,'368px')
  assert.ok(px(place.left) >= 8)
  assert.ok(px(place.maxHeight) + px(place.top) <= 650 - 5)
})

test('G005-04 · popup abre arriba cuando no cabe debajo', () => {
  const place = viewport({left:350,right:480,top:610,bottom:635},{innerWidth:900,innerHeight:690})
  assert.equal(place.top,'auto')
  assert.ok(px(place.bottom) > 0)
  assert.ok(px(place.maxHeight) + px(place.bottom) < 690)
})

test('G005-05 · dock estrecho y ventana pequeña no causan desbordes', () => {
  for(const width of [260,320,420]){
    const place=viewport({left:width-65,right:width-5,top:42,bottom:65},{innerWidth:width,innerHeight:280})
    assert.equal(place.height,'auto')
    assert.ok(px(place.left)>=8)
    assert.ok(px(place.left)+px(place.width)<=width-8+0.1)
  }
})

test('G005-06 · abrir enfoca la búsqueda y cerrar no reabre otro menú', async () => {
  let focused=false, repositioned=false
  const ctx={ libraryOpen:ref(false), addMenu:ref(false),optMenu:ref(false),search:ref('anterior'),
    librarySearch:ref({focus(){focused=true}}),trackPopup:ref(null),nextTick:fn=>Promise.resolve().then(fn),
    repositionPopup:()=>{repositioned=true},activePopup:()=>'',closeLibrary:()=>{} }
  const {togglePopup}=pick(['togglePopup'],ctx)
  togglePopup('library')
  await Promise.resolve()
  assert.equal(ctx.libraryOpen.value,true)
  assert.equal(ctx.search.value,'')
  assert.equal(focused,true)
  assert.equal(repositioned,true)
})

test('G005-07 · Escape limpia y devuelve el foco al botón selector', async () => {
  let focused=false
  const state={libraryOpen:ref(true),search:ref('salida'),libraryButton:ref({focus(){focused=true}}),nextTick:fn=>Promise.resolve().then(fn)}
  const {closeLibrary}=pick(['closeLibrary'],state)
  closeLibrary(true)
  await Promise.resolve()
  assert.equal(state.libraryOpen.value,false)
  assert.equal(state.search.value,'')
  assert.equal(focused,true)
})

test('G005-08 · flechas recorren botones reales y ArrowUp regresa a búsqueda', () => {
  const controls=[],doc={activeElement:null},input={focus(){doc.activeElement=this}}
  for(let i=0;i<3;i++)controls.push({focus(){doc.activeElement=this}})
  const ctx={libraryPopup:ref({querySelectorAll:()=>controls}),librarySearch:ref(input),document:doc}
  const {focusLibraryResult}=pick(['focusLibraryResult'],ctx)
  doc.activeElement=input
  focusLibraryResult(1)
  assert.equal(doc.activeElement,controls[0])
  focusLibraryResult(1)
  assert.equal(doc.activeElement,controls[1])
  focusLibraryResult(1)
  focusLibraryResult(1)
  assert.equal(doc.activeElement,controls[2])
  focusLibraryResult(-1);focusLibraryResult(-1);focusLibraryResult(-1)
  assert.equal(doc.activeElement,input)
})

test('G005-09 · Enter de búsqueda abre primer ID filtrado; sin resultados no abre', () => {
  const open=[],searchEl={};let prevented=0,stopped=0
  const ctx={librarySearch:ref(searchEl),listing:ref([{id:'timeline-a'}]),chooseTimeline:id=>open.push(id),
    closeLibrary:()=>{},focusLibraryResult:()=>{}}
  const {libraryKeydown}=pick(['libraryKeydown'],ctx)
  const event={key:'Enter',target:searchEl,preventDefault(){prevented++},stopPropagation(){stopped++}}
  libraryKeydown(event)
  assert.deepEqual(open,['timeline-a'])
  assert.equal(prevented,1);assert.equal(stopped,1)
  ctx.listing.value=[]
  libraryKeydown(event)
  assert.equal(open.length,1)
})

test('G005-10 · Escape se detiene en el popup; Enter en botones usa su click nativo', () => {
  let closed=0,prevented=0,stopped=0
  const ctx={librarySearch:ref({}),listing:ref([]),chooseTimeline:()=>{},closeLibrary:()=>{closed++},focusLibraryResult:()=>{}}
  const {libraryKeydown}=pick(['libraryKeydown'],ctx)
  const button={}
  libraryKeydown({key:'Enter',target:button,preventDefault(){prevented++},stopPropagation(){stopped++}})
  assert.equal(prevented,0)
  libraryKeydown({key:'Escape',target:button,preventDefault(){prevented++},stopPropagation(){stopped++}})
  assert.equal(closed,1);assert.equal(prevented,1);assert.equal(stopped,1)
})

test('G005-11 · popup conectado al selector, controles accesibles y rol de diálogo', () => {
  assert.match(template, /aria-haspopup="dialog" aria-controls="timeline-library-popup"/)
  assert.match(template, /id="timeline-library-popup" ref="libraryPopup"/)
  assert.match(template, /role="dialog" aria-label="Seleccionar Timeline" @keydown="libraryKeydown"/)
  assert.match(template, /ref="librarySearch" v-model="search" type="search"/)
  assert.match(template, /:aria-pressed="tl\?\.id === resource\.id"/)
  assert.match(template, /class="library-footnote"/)
})

test('G005-12 · se conserva crear/seleccionar por ID, sin estado ni modelo paralelo', () => {
  assert.match(script, /const timelines = computed/)
  assert.doesNotMatch(script, /new Map\(.*timeline/i)
  assert.match(template, /resource\.folder \|\| 'Assets'/)
  assert.match(template, /resource\.duration/)
  assert.match(template, /v-for="resource in listing" :key="resource.id" class="timeline-item"/)
  assert.doesNotMatch(template, /filmMaker\.passes/)
})

test('G005-13 · compilación del template Vue si @vue/compiler-sfc está instalado', async t => {
  let compiler
  try { compiler=await import('@vue/compiler-sfc') }
  catch(error){if(error.code==='ERR_MODULE_NOT_FOUND'){t.skip('Sin compilador Vue en el entorno; comprobar con npm run build local');return}throw error}
  const parsed=compiler.parse(source,{filename:'src/components/TimelinePanel.vue'})
  assert.deepEqual(parsed.errors,[])
  const built=compiler.compileTemplate({source:parsed.descriptor.template.content,filename:'TimelinePanel.vue',id:'timeline-s12-g005'})
  assert.deepEqual(built.errors,[])
})
