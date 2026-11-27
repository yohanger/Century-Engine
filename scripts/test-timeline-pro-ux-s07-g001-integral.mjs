import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { timelineRulerTicks } from '../src/core/timeline/model.js'

const source = readFileSync(new URL('../src/components/TimelinePanel.vue', import.meta.url), 'utf8')
const script = source.split('<script setup>')[1].split('</script>')[0]
const template = source.slice(source.indexOf('<template>') + 10, source.indexOf('</template>\n\n<style scoped>'))
const css = source.split('<style scoped>')[1].split('</style>')[0]
function fn(name, dependencies = {}) {
  const found = script.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`, 'm'))
  assert.ok(found, `No existe ${name}`)
  return Function(...Object.keys(dependencies), `${found[0]};return ${name}`)(...Object.values(dependencies))
}
const ref = value => ({ value })

test('S07-PRO-01 · selector compacto mantiene identidad real y búsqueda en Assets', () => {
  assert.match(template, /timeline-picker[^>]+aria-expanded="libraryOpen"/)
  assert.match(template, /v-for="resource in listing"[^>]+:key="resource.id"/)
  assert.match(script, /chooseTimeline\(id\)[\s\S]*?openTimelineEditor\(id\)/)
  assert.match(script, /timelines = computed\([\s\S]*?!isFilmMakerTimeline\(t\)/)
  assert.doesNotMatch(template, /<aside class="timeline-library"/)
  assert.doesNotMatch(css, /grid-template-columns:\s*205px/)
  assert.match(template, /createTimelineDialog\(\)/)
})

test('S07-PRO-02 · límite horizontal conserva siempre espacio de edición', () => {
  const bound = fn('clampHeaderWidth')
  for (const [area, minLane] of [[220,120],[260,120],[400,120],[800,120],[1500,120]]) {
    for (const requested of [90,190,300,800]) {
      const w = bound(requested, area)
      assert.ok(w >= 96 && w <= 360, `${area}/${requested}: ${w}`)
      assert.ok(area - w >= Math.min(minLane,area-96), `${area}/${requested}: carril sin espacio`)
    }
  }
  assert.equal(bound(190,260), 140)
  assert.equal(bound(190,800), 190)
  assert.equal(bound(340,800), 340)
})

test('S07-PRO-03 · arrastre del separador conserva preferencia al reducir y ampliar el dock', () => {
  const viewportWidth=ref(800),headerWidth=ref(190),scroller=ref({clientWidth:800,clientHeight:480}),durationViewportHeight=ref(0)
  const clampHeaderWidth=fn('clampHeaderWidth')
  const code = [
    'let preferredHeaderWidth = 190, headerDrag = null',
    ...['measureViewport','beginHeaderResize','moveHeaderResize','endHeaderResize','keyHeaderResize'].map(name => script.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`, 'm'))?.[0]),
    'return {measureViewport,beginHeaderResize,moveHeaderResize,endHeaderResize,keyHeaderResize,getPreferred:()=>preferredHeaderWidth}'
  ].join('\n')
  const actions = Function('viewportWidth','headerWidth','scroller','clampHeaderWidth','repositionPopup','durationViewportHeight',code)(viewportWidth,headerWidth,scroller,clampHeaderWidth,()=>{},durationViewportHeight)
  const handle={setPointerCapture(id){this.id=id},hasPointerCapture(id){return id===this.id},releasePointerCapture(){this.id=null}}
  actions.beginHeaderResize({button:0,pointerId:7,clientX:200,currentTarget:handle,preventDefault(){},stopPropagation(){}})
  actions.moveHeaderResize({pointerId:7,clientX:280})
  actions.endHeaderResize({pointerId:7,currentTarget:handle})
  assert.equal(headerWidth.value,270)
  scroller.value.clientWidth=260
  actions.measureViewport()
  assert.equal(headerWidth.value,140)
  scroller.value.clientWidth=900
  actions.measureViewport()
  assert.equal(headerWidth.value,270)
  assert.equal(durationViewportHeight.value,480)
  actions.keyHeaderResize({key:'ArrowLeft',preventDefault(){}})
  assert.equal(headerWidth.value,258)
  assert.equal(actions.getPreferred(),258)
})

test('S07-PRO-04 · regla, pistas y cabezal comparten una geometría y cálculo de zoom', () => {
  assert.match(template, /'--tl-header-width': headerWidth \+ 'px'/)
  assert.match(template, /left: timeToX\(ph\) \+ 'px'/)
  assert.match(template, /'--tl-grid-step': gridStep \+ 'px'/)
  assert.match(script, /const W = computed\(\(\) => Math\.max\(160,[^\n]*viewportWidth\.value - headerWidth\.value/)
  assert.match(script, /setZoom\(\(viewportWidth\.value - headerWidth\.value - TIME_ORIGIN_PX - 24\)/)
  assert.match(css, /\.header-resizer[^}]*cursor:col-resize/)
  assert.match(template, /role="separator" tabindex="0" aria-label="Ajustar anchura de pistas"/)
  const ticks=timelineRulerTicks(10,70)
  const nextMajor = ticks.find(t=>t.major && t.t>0)
  assert.ok(nextMajor.t*70 >= 62)
})

test('S07-PRO-05 · controles esenciales recuperables con panel estrecho', () => {
  for (const action of ['Reproducir','Detener','Ajustar toda la duración','Opciones de Timeline','Pista','Intervalo de ajuste de claves']) assert.ok(template.includes(action),action)
  for (const action of ['En bucle','Bloquear al jugador','Se puede omitir','Ver en viewport','Ajustar duración visible']) assert.ok(template.includes(action),action)
  assert.match(css, /@container \(max-width: 540px\)/)
  assert.match(template, /@keydown\.esc\.stop="dismissMenus"/)
})

test('S07-PRO-06 · el Timeline conserva funciones y no modifica FilmMaker, runtime ni Player', () => {
  for (const callback of ['laneDbl($event, row.track)','laneMenu($event, row.track)','keyDown($event, row.track, k)','nodeDrop','selectTemporal','playback.refresh(tl.value,selTrack.value)','commit(initial.length > 1 ? \'Mover claves\' : \'Mover clave\')']) assert.ok(source.includes(callback),callback)
  assert.ok(!source.includes('new TimelineRunner'))
  assert.match(script, /resizeObserver\?\.disconnect\(\)/)
  assert.match(template, /ref="scroller"/)
})

test('S07-PRO-07 · compilación real del template Vue cuando las dependencias están instaladas', async t => {
  let compiler
  try { compiler = await import('@vue/compiler-sfc') }
  catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') { t.skip('Falta @vue/compiler-sfc en este entorno; ejecutar npm run build en Electron local'); return }
    throw error
  }
  const parsed = compiler.parse(source, { filename: 'src/components/TimelinePanel.vue' })
  assert.deepEqual(parsed.errors, [])
  const output = compiler.compileTemplate({ source: parsed.descriptor.template.content, filename: 'TimelinePanel.vue', id: 'timeline-s07' })
  assert.deepEqual(output.errors, [])
})

test('S07-PRO-08 · los menús flotantes eligen el lado visible del dock y se cierran al cambiar de panel', () => {
  const libraryOpen = ref(true), optMenu = ref(false), addMenu = ref(false), popupPlacement = ref({})
  const button = { getBoundingClientRect: () => ({left: 245,right: 320,top: 600,bottom: 628}) }
  const libraryButton = ref(button),optionsButton=ref(null),trackButton=ref(null)
  const mockWindow = {innerWidth:800,innerHeight:700}
  const activePopup=fn('activePopup',{libraryOpen,optMenu,addMenu})
  const repositionPopup=fn('repositionPopup',{activePopup,libraryButton,optionsButton,trackButton,popupPlacement,window:mockWindow})
  repositionPopup()
  assert.equal(popupPlacement.value.top,'auto')
  assert.ok(Number.parseFloat(popupPlacement.value.bottom)>0)
  assert.ok(Number.parseFloat(popupPlacement.value.maxHeight)>0)
  assert.ok(Number.parseFloat(popupPlacement.value.width)<=368)
  assert.match(template, /<Teleport to="body">/)
  assert.match(template, /timeline-dropdown/)
  assert.match(script, /if\(!visible\)\{libraryOpen\.value=false;addMenu\.value=false;optMenu\.value=false/)
  assert.match(script, /window\.addEventListener\('keydown', dismissMenus\)/)
  assert.match(script, /window\.removeEventListener\('keydown', dismissMenus\)/)
})
