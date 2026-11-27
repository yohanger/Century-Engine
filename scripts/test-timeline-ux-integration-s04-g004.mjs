import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/TimelinePanel.vue', import.meta.url), 'utf8')
const script = source.split('<script setup>')[1].split('</script>')[0]
const preview = readFileSync(new URL('../src/core/timeline/preview.js', import.meta.url), 'utf8')
const template = source.slice(source.indexOf('<template>') + '<template>'.length, source.indexOf('<style scoped>'))
const css = source.split('<style scoped>')[1].split('</style>')[0]

function actualFunction(name, context) {
  const match = script.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`, 'm'))
  assert.ok(match, `Falta función real ${name}`)
  return Function(...Object.keys(context), `${match[0]};return ${name}`)(...Object.values(context))
}
const ref = value => ({value})

test('Cabeceras fijas y tiempo comparten ancho mediante columnas independientes', () => {
  assert.match(script,/const headerWidth = ref\(190\)/)
  assert.match(template, /'--tl-header-width': headerWidth \+ 'px'/)
  assert.match(template, /width: W \+ 'px'/)
  assert.match(template, /left: timeToX\(ph\)/)
  assert.match(css, /\.main \{ display:grid; grid-template-columns:var\(--tl-header-width\) minmax\(0,1fr\)/)
  assert.match(css, /\.pinned-column \.hcorner \{[^}]*width:100%/)
  assert.match(css, /\.pinned-row \.head \{[^}]*width:100%/)
  assert.doesNotMatch(script,/scrollLeft - 190|\- 190 \/\//)
})
test('Cabecera se limita en un dock pequeño y recupera la anchura preferida al ampliar', () => {
  const viewportWidth=ref(0), headerWidth=ref(190), durationViewportHeight=ref(0), scroller=ref({clientWidth:260,clientHeight:280})
  const clampHeaderWidth=actualFunction('clampHeaderWidth',{})
  const preferredHeaderWidth=190
  const measureViewport=actualFunction('measureViewport',{scroller,headerWidth,viewportWidth,clampHeaderWidth,preferredHeaderWidth,durationViewportHeight,repositionPopup:()=>{}})
  measureViewport();assert.equal(headerWidth.value,140);assert.equal(durationViewportHeight.value,280)
  scroller.value.clientWidth=400;measureViewport();assert.equal(headerWidth.value,190)
  scroller.value.clientWidth=800;measureViewport();assert.equal(headerWidth.value,190)
})
test('Scrub toma la geometría real del carril, incluso después del scroll', () => {
  const tl=ref({duration:12}), ph=ref(0), zoom=ref(50)
  const target={getBoundingClientRect:()=>({left: -370})}
  const ruler=ref(target)
  const scrub=actualFunction('scrub',{tl,ruler,ph,zoom,xToTime:x=>(x-24)/zoom.value})
  scrub({clientX:-96});assert.equal(ph.value,5)
  scrub({clientX:9999});assert.equal(ph.value,12)
  scrub({clientX:-9999});assert.equal(ph.value,0)
  assert.match(script,/scrubDown\(e, e\.currentTarget\)/)
})
test('Zoom de encuadre y zoom relativo dentro de límites, sin modificar claves', () => {
  const tl=ref({duration:10}),scroller=ref({scrollLeft:100}),viewportWidth=ref(800),headerWidth=ref(220),zoom=ref(70)
  const ZOOM_MIN=0.1,ZOOM_MAX=320
  const setZoom=Function('zoom','ZOOM_MIN','ZOOM_MAX',"return "+script.match(/const setZoom = \(v\) => \{[^\n]+\}/)[0].replace('const ','')+';') (zoom,ZOOM_MIN,ZOOM_MAX)
  const zoomBy=Function('setZoom','zoom',"return "+script.match(/const zoomBy = \(factor\) => [^\n]+/)[0].replace('const ','')+';')(setZoom,zoom)
  const fitZoom=actualFunction('fitZoom',{tl,setZoom,viewportWidth,headerWidth,scroller})
  fitZoom();assert.equal(zoom.value,55.6);assert.equal(scroller.value.scrollLeft,0)
  zoomBy(0.8);assert.ok(Math.abs(zoom.value-44.48)<1e-8)
  setZoom(-50);assert.equal(zoom.value,ZOOM_MIN)
  setZoom(9999);assert.equal(zoom.value,ZOOM_MAX)
})
test('Regla temporal genera marcas estables y acotadas a zoom bajo o alto', () => {
  assert.match(script,/const ticks = computed/)
  assert.match(script,/timelineRulerTicks\(tl\.value\?\.duration \|\| 0, zoom\.value\)/)
  const ruler = readFileSync(new URL('../src/core/timeline/model.js', import.meta.url), 'utf8')
  assert.match(ruler,/ticks\.length < 1200/)
  assert.match(ruler,/v \* scale >= minMajorPixels/)
  assert.match(template, /tickText\(t\.t\)/)
  assert.match(template,/ref="ruler"/)
})
test('Etiquetas de claves acotadas por la siguiente clave', () => {
  const zoom=ref(70)
  const keyWidth=actualFunction('keyWidth',{zoom})
  const keys=[{id:'a',t:0},{id:'b',t:0.25},{id:'c',t:2}]
  assert.equal(keyWidth({kind:'node',keys},keys[0],0),14)
  assert.equal(keyWidth({kind:'method',keys},keys[0],0),14)
  assert.equal(keyWidth({kind:'method',keys},keys[1],1),114.5)
  assert.equal(keyWidth({kind:'method',keys},keys[2],2),144)
  // Discretos: límite de la siguiente clave. Audio de duración fija: intervalo real.
  assert.match(template,/keyWidth\(row\.track, k, index\) \+ 'px'/)
  assert.match(template,/audioDisplayDuration\(k\)\*zoom/)
  assert.match(css,/text-overflow: ellipsis/)
})
test('Barra compacta y adaptable: en dock estrecho agrupa controles y conserva opciones', () => {
  assert.match(css,/\.bar \{[^}]*white-space: nowrap/)
  assert.match(css,/@container \(max-width: 350px\)[\s\S]*?flex-wrap:wrap/)
  assert.match(css,/@container \(max-width: 540px\)/)
  for (const control of ['En bucle','Bloquear al jugador','Se puede omitir','Barras de cine','Ver en viewport','Eliminar Timeline','Ajustar duración visible']) assert.ok(template.includes(control),control)
  assert.match(template,/aria-label="Opciones de Timeline"/)
})
test('Reproducción y edición temporal conservan contrato existente', () => {
  for (const entry of ['keyDown($event, row.track, k)','laneDbl($event, row.track)','laneMenu($event, row.track)','nodeDrop','playback.refresh(tl.value,selTrack.value)','selectTemporal','commit(initial.length > 1 ? \'Mover claves\' : \'Mover clave\')']) assert.ok(source.includes(entry),entry)
  assert.match(preview,/evalTimelineNode\(track, time\)/)
  assert.match(preview,/evalTimelineCamera\(track, time/)
  assert.match(template,/playing \? 'pause' : 'play'/)
  assert.match(template,/name="stop"/)
  assert.match(readFileSync(new URL('../src/core/timeline/playback-session.js',import.meta.url),'utf8'),/cancelFrame\(raf\)/)
})
test('No se reemplazan datos persistentes ni motores de interpolación y scripts', () => {
  assert.ok(!script.includes('new TimelineRunner'))
  assert.ok(!script.includes('NodeScriptRuntime'))
  assert.ok(!script.includes('host.method('))
  assert.ok(!script.includes('localStorage'))
})
test('Observer de tamaño se desconecta y no persiste estado editorial', () => {
  assert.match(script,/watch\(scroller, \(element\) =>/); assert.match(script,/resizeObserver\.observe\(element\)/)
  assert.match(script,/resizeObserver\?\.disconnect\(\)/)
  assert.match(template,/ref="scroller"/)
})
