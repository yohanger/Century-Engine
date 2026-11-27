import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// QA corregido tras la evidencia de usuario: CORR-001 anterior daba PASS con un scroll
// defectuoso porque solo verificaba una compensación matemática sin comprobar el layout.
const source = readFileSync(new URL('../src/components/TimelinePanel.vue', import.meta.url), 'utf8')
const script = source.split('<script setup>')[1].split('</script>')[0]
const template = source.slice(source.indexOf('<template>') + 10, source.indexOf('</template>\n\n<style scoped>'))
const css = source.split('<style scoped>')[1].split('</style>')[0]
function block(name) {
  const start = script.indexOf(`function ${name}(`)
  assert.ok(start >= 0, `Falta ${name}`)
  const curly = script.indexOf('{', start)
  let count = 0
  for (let i=curly; i<script.length; i++) {
    if (script[i] === '{') count++
    if (script[i] === '}' && --count === 0) return script.slice(start,i+1)
  }
  throw Error(`Función ${name} sin cierre`)
}

function mockScrollable({scrollLeft=0,scrollTop=0, clientWidth=550}={}) {
  const styles = new Map()
  const viewport = {scrollLeft,scrollTop,clientWidth, style:{setProperty(k,v){styles.set(k,v)}}}
  const pinned = {style:{transform:'unset'}}
  return {viewport,pinned,styles}
}

test('CORR001-QA2-01 · cabeceras fuera del scroll horizontal, sin cabeceras duplicadas', () => {
  assert.equal((template.match(/ref="scroller"/g)||[]).length,1)
  assert.equal((template.match(/class="hcorner"/g)||[]).length,1)
  assert.equal((template.match(/class="head"/g)||[]).length,1)
  assert.match(template, /class="main"/)
  assert.match(template, /class="pinned-column"/)
  assert.match(template, /class="pinned-viewport"/)
  assert.match(template, /ref="pinnedRows" class="pinned-rows"/)
  assert.ok(template.indexOf('class="pinned-column"') < template.indexOf('ref="scroller"'), 'columna izquierda debe ser hermana del scroller')
  assert.ok(template.indexOf('class="head"') < template.indexOf('ref="scroller"'), 'controles de pista no pueden ser descendientes del scroller')
  assert.match(css,/\.main \{ display:grid; grid-template-columns:var\(--tl-header-width\) minmax\(0,1fr\)/)
})

test('CORR001-QA2-02 · un scroll horizontal no altera posición de cabeceras', () => {
  const {viewport,pinned}=mockScrollable({scrollLeft:0})
  const scrollX={value:-1}
  const sync=Function('scroller','pinnedRows','durationScrollX',block('syncTimelineScroll')+';return syncTimelineScroll')({value:viewport},{value:pinned},scrollX)
  sync({currentTarget:viewport})
  assert.equal(pinned.style.transform,'translateY(0px)')
  for(const x of [1,70,350,600]) {viewport.scrollLeft=x;sync({currentTarget:viewport});assert.equal(pinned.style.transform,'translateY(0px)')}
  assert.equal(viewport.scrollLeft,600)
  assert.equal(scrollX.value,600)
  assert.doesNotMatch(css,/\.hcorner,\s*\.head\s*\{\s*transform:\s*translateX/)
  assert.match(css,/\.pinned-column \.hcorner \{[^}]*transform:none/)
  assert.match(css,/\.pinned-row \.head \{[^}]*transform:none/)
})

test('CORR001-QA2-03 · scroll vertical sincroniza filas, sin segundo scrollbar',()=>{
  const {viewport,pinned}=mockScrollable({scrollTop:0})
  const scrollX={value:-1}
  const sync=Function('scroller','pinnedRows','durationScrollX',block('syncTimelineScroll')+';return syncTimelineScroll')({value:viewport},{value:pinned},scrollX)
  for(const y of [0,18,180,360]) {viewport.scrollTop=y;sync();assert.equal(pinned.style.transform,`translateY(${-y}px)`)}
  assert.match(css,/\.pinned-viewport \{[^}]*overflow:hidden/)
  assert.match(css,/\.scroll \{ grid-column:2;[^}]*overflow:auto/)
  assert.doesNotMatch(template,/class="pinned-(?:scroll|scroller)"/)
})

test('CORR001-QA2-04 · rueda sobre las cabeceras desplaza el mismo scroll',()=>{
  const {viewport,pinned}=mockScrollable({scrollTop:80,scrollLeft:100})
  const scrollX={value:-1}
  const sync=Function('scroller','pinnedRows','durationScrollX',block('syncTimelineScroll')+';return syncTimelineScroll')({value:viewport},{value:pinned},scrollX)
  const wheel=Function('scroller','syncTimelineScroll',block('forwardPinnedWheel')+';return forwardPinnedWheel')({value:viewport},sync)
  wheel({deltaY:50,deltaX:35})
  assert.equal(viewport.scrollTop,130)
  assert.equal(scrollX.value,135)
  assert.equal(viewport.scrollLeft,135)
  assert.equal(pinned.style.transform,'translateY(-130px)')
  assert.match(template,/@wheel\.prevent="forwardPinnedWheel"/)
})

test('CORR001-QA2-05 · medición de ancho usa ambas columnas sin deformar el zoom',()=>{
  const {viewport}=mockScrollable({clientWidth:460})
  const viewportWidth={value:0},headerWidth={value:190},durationViewportHeight={value:0}
  viewport.clientHeight=380;viewport.parentElement={clientWidth:650}
  const measure=Function('scroller','viewportWidth','headerWidth','clampHeaderWidth','preferredHeaderWidth','repositionPopup','durationViewportHeight',block('measureViewport')+';return measureViewport')({value:viewport},viewportWidth,headerWidth,(requested,available)=>Math.min(requested,available-120),190,()=>{},durationViewportHeight)
  measure()
  assert.equal(viewportWidth.value,650)
  assert.equal(durationViewportHeight.value,380)
  assert.equal(headerWidth.value,190)
  assert.match(template, /:style="\{ '--tl-header-width': headerWidth \+ 'px' \}"/)
  assert.match(template, /:style="\{ width: W \+ 'px', '--tl-grid-step': gridStep \+ 'px'/)
})

test('CORR001-QA2-06 · tiempo cero unificado: carriles, clave, regla y cabezal empiezan en el viewport derecho',()=>{
  assert.match(template,/class="time-grid" :style="\{ width: W \+ 'px' \}"/)
  assert.match(template,/class="ruler" @pointerdown="scrubDown"/)
  assert.match(template,/left: timeToX\(t\.t\) \+ 'px'/)
  assert.match(template,/left: timeToX\(k\.t\) \+ 'px'/)
  assert.match(template,/class="playhead" :style="\{ left: timeToX\(ph\) \+ 'px' \}"/)
  assert.match(css,/\.time-grid \{ left:0; background-position:var\(--tl-time-origin\)/)
  assert.doesNotMatch(template,/left: headerWidth \+ ph \* zoom/)
})

test('CORR001-QA2-07 · una frontera física recorta regla, claves y clips sin sangrar sobre nombres',()=>{
  assert.match(css,/\.main \{[^}]*overflow:hidden/)
  assert.match(css,/\.pinned-column \{[^}]*z-index:9;[^}]*overflow:hidden/)
  assert.match(css,/\.scroll \{[^}]*overflow:auto/)
  assert.match(template,/class="pinned-column"[\s\S]*?class="scroll"/)
  assert.doesNotMatch(template,/class="head"[\s\S]*?class="lane"[^<]*class="head"/)
})

test('CORR001-QA2-08 · filas de nombres/carriles comparten dimensiones y siguen en orden',()=>{
  assert.match(template,/v-for="row in visibleRows" :key="row\.type\+'-'\+row\.id" class="pinned-row"/)
  assert.match(template,/v-for="row in visibleRows" :key="row\.type\+'-'\+row\.id" class="trow"/)
  assert.match(css,/\.pinned-row \{[^}]*height:36px;[^}]*min-height:36px/)
  assert.match(css,/\.trow \{ display:block; height:36px; \}/)
  assert.match(css,/\.pinned-column \.hcorner \{[^}]*height:29px/)
  assert.match(css,/\.rulerrow \{[^}]*height:29px/)
})

test('CORR001-QA2-09 · ancho de cabeceras ajustable; menú, silencio, selección y vista previa existentes',()=>{
  for(const text of ['ref="trackButton"','@pointerdown="beginHeaderResize"','@keydown="keyHeaderResize"','@click.stop="toggleTrackMute(row.track)"','@pointerdown="pickTrack(row.track)"','@pointerdown="keyDown($event, row.track, k)"','@pointerdown="scrubDown"'])assert.ok(template.includes(text),text)
  assert.match(css,/\.pinned-column \.header-resizer \{ right:0; width:8px/)
  assert.match(script,/function fitZoom\(\)/)
  assert.match(script,/const visibleRows = computed\(\(\) => timelineVisibleRows\(tl\.value\)\)/)
  assert.match(script,/scroller\.value\.scrollLeft = 0/)
})

test('CORR001-QA2-10 · sin modelo temporal, segunda Timeline o estado duplicado',()=>{
  assert.match(script,/import \{ newTrack, newKey, sortKeys, TRACK_KINDS/)
  assert.match(readFileSync(new URL('../src/core/timeline/playback-session.js',import.meta.url),'utf8'),/import \{ TimelinePreview \} from/)
  assert.match(template,/@pointerdown\.stop\.prevent="beginSegmentResize\(\$event, row\.track, s\.id\)"/)
  assert.equal((template.match(/ref="scroller"/g)||[]).length,1)
  assert.doesNotMatch(script,/scrollLeft\s*=\s*ref|scrollX\s*=\s*ref|globalThis|new ScrollManager/)
})

test('CORR001-QA2-11 · compilador Vue de verdad valida cuando hay dependencias',async(t)=>{
  let vue
  try {vue=await import('@vue/compiler-sfc')}
  catch(error) {if(error?.code==='ERR_MODULE_NOT_FOUND') {t.skip('No están instaladas las dependencias Vue en este entorno');return} throw error}
  const parsed=vue.parse(source,{filename:'TimelinePanel.vue'})
  assert.deepEqual(parsed.errors,[])
  const built=vue.compileTemplate({source:parsed.descriptor.template.content,filename:'TimelinePanel.vue',id:'corr001-qa2'})
  assert.deepEqual(built.errors,[])
})
