import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { newTimeline, newTrack, newKey, isFilmMakerTimeline, timelineRulerTicks } from '../src/core/timeline/model.js'

const source = readFileSync(new URL('../src/components/TimelinePanel.vue', import.meta.url), 'utf8')
const script = source.split('<script setup>')[1].split('</script>')[0]
const template = source.slice(source.indexOf('<template>') + 10, source.indexOf('</template>\n\n<style scoped>'))
const style = source.split('<style scoped>')[1].split('</style>')[0]
const body = (name) => {
  const match = script.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`, 'm'))
  assert.ok(match, `Falta ${name}`)
  return match[0]
}
const ref = value => ({value})

test('S10-01 · conserva un solo componente Timeline sobre el modelo nativo, sin motor alterno', () => {
  assert.match(script, /import \{ newTrack, newKey, sortKeys, TRACK_KINDS/)
  assert.match(readFileSync(new URL('../src/core/timeline/playback-session.js',import.meta.url),'utf8'), /import \{ TimelinePreview \} from/)
  assert.match(script, /const timelines = computed\(\(\) => \(store\.project\?\.timelines \|\| \[\]\)\.filter/)
  assert.doesNotMatch(source, /new TimelineRunner|new UnityTimeline|UnityEngine|UnityEditor/)
  const resource = newTimeline('Prueba', {duration:8})
  resource.tracks.push(newTrack('node', {prop:'position',keys:[newKey('node',0),newKey('node',3)]}))
  assert.equal(resource.tracks.length,1)
  assert.equal(isFilmMakerTimeline(resource),false)
})

test('S10-02 · selector de recurso accesible incluso sin Timeline abierta', () => {
  assert.equal((template.match(/ref="libraryButton"/g)||[]).length,1)
  assert.ok(template.indexOf('ref="libraryButton"') < template.indexOf('v-if="!tl"'))
  assert.match(template, /v-for="resource in listing"/)
  assert.match(template, /@click="createTimelineDialog\(\)"/)
})

test('S10-03 · transporte compacto tiene acciones de reproducción y navegación reales', () => {
  for(const action of ['togglePlay','stop','stepTime(-1)','stepTime(1)']) assert.ok(template.includes(action),action)
  assert.match(template, /class="preview-toggle(?:\s[^"]+)?"[^>]+:aria-pressed="previewOn"/)
  assert.match(template, /@click="previewOn = !previewOn"/)
})

test('S10-04 · pasos temporales respetan duración, Snap y estado de reproducción', () => {
  const tl=ref({duration:3}),ph=ref(1.5),snap=ref(.25),playing=ref(true)
  let stops=0
  const playback={pause(){stops++;playing.value=false}}
  const stepTime=Function('tl','ph','snap','playback',body('stepTime')+';return stepTime')
    (tl,ph,snap,playback)
  stepTime(-1); assert.equal(ph.value,1.25); assert.equal(playing.value,false)
  stepTime(1);assert.equal(ph.value,1.5)
  ph.value=3;stepTime(1);assert.equal(ph.value,3)
  ph.value=0;stepTime(-1);assert.equal(ph.value,0)
  snap.value=0;stepTime(1);assert.equal(ph.value,.1)
  assert.equal(stops,5)
})

test('S10-05 · pestañas y pistas comparten una única regla y geometría temporal', () => {
  assert.match(template,/ref="scroller"/)
  assert.match(template,/'--tl-header-width': headerWidth \+ 'px'/)
  assert.match(template,/class="time-grid" :style="\{ width: W \+ 'px' \}"/)
  assert.match(template,/left: timeToX\(ph\) \+ 'px'/)
  assert.match(template,/class="pinned-column"/)
  assert.match(template,/v-for="t in ticks"/)
  assert.ok(timelineRulerTicks(10,70).length>2)
})

test('S10-06 · selector + pista en cabecera de carriles, sin duplicar menús', () => {
  assert.equal((template.match(/ref="trackButton"/g)||[]).length,1)
  assert.match(template,/class="track-bar"/)
  assert.match(template,/class="menu add-track-menu"/)
  assert.match(template,/@click="togglePopup\('tracks'\)"/)
  assert.match(template,/@click="addTrack\(key\)"/)
})

test('S10-07 · controles de mute interactúan con el estado existente y el historial', () => {
  const tl=ref({tracks:[{id:'tr1',muted:false}]}), entries=[]
  let revisions=0
  const toggle=Function('tl','commit','bump',body('toggleTrackMute')+';return toggleTrackMute')
    (tl,value=>entries.push(value),()=>revisions++)
  toggle(tl.value.tracks[0]);assert.equal(tl.value.tracks[0].muted,true)
  toggle({id:'other',muted:false});assert.equal(entries.length,1)
  toggle(tl.value.tracks[0]);assert.equal(tl.value.tracks[0].muted,false)
  assert.deepEqual(entries,['Silenciar pista','Silenciar pista'])
  assert.equal(revisions,2)
  assert.match(template,/@click\.stop="toggleTrackMute\(row\.track\)"/)
})

test('S10-08 · los segmentos son representaciones de claves reales, no clips persistidos extra', () => {
  const tr={id:'t',kind:'node',keys:[{id:'k1',t:0},{id:'k2',t:2}]}
  const sel=ref(null)
  const pick=(t,k)=>{sel.value={tr:t.id,k:k.id}}
  const choose=Function('pick',body('pickSegment')+';return pickSegment')(pick)
  choose(tr,'k1');assert.deepEqual(sel.value,{tr:'t',k:'k1'})
  choose(tr,'wrong');assert.deepEqual(sel.value,{tr:'t',k:'k1'})
  assert.match(template, /v-for="s in motionSpans\(row\.track\)"/)
  assert.match(template, /@pointerdown\.stop="pickSegment\(row\.track, s.id, \$event\)"/)
  assert.match(script,/\.filter\(segment => segment\.w > 0\)/)
})

test('S10-09 · preserva edición de claves, duración y preview reversible', () => {
  for (const action of ['keyDown($event, row.track, k)','laneDbl($event, row.track)','laneMenu($event, row.track)','beginSegmentResize($event, row.track, s.id)','beginDurationResize','nodeDrop','selectTemporal','playback.refresh(tl.value,selTrack.value)']) assert.ok(source.includes(action),action)
  assert.match(template,/class="segment-grip"/)
  assert.match(template,/class="duration-grip"/)
  assert.match(template,/class="playhead-grip"/)
})

test('S10-10 · protección bake y bloqueo real no duplican estados de pista', () => {
  assert.match(template,/v-if="row.track.kind!=='bake'"[^>]*class="track-lock"/)
  assert.match(template,/v-else class="track-readonly"/)
  assert.match(template,/@click\.stop="toggleTrackLock\(row\.track\)"/)
  assert.match(template,/:aria-pressed="row.track.muted"/)
  assert.match(template,/class="timeline-status"/)
})

test('S10-11 · vista compacta conserva cabeceras, popup accesible y feedback de foco', () => {
  assert.match(style,/@container \(max-width: 540px\)/)
  assert.match(style,/@container \(max-width: 350px\)/)
  assert.match(style,/\.tlp :is\(button,input,select\):focus-visible/)
  assert.match(script,/position:'fixed'/)
  assert.match(template,/aria-label="Ajustar anchura de pistas"/)
})

test('S10-12 · el código original conserva las acciones meteorológicas de S09', () => {
  for(const action of ['addWeatherCue(\'rain\')','addWeatherCue(\'intensity\')','addWeatherCue(\'clear\')','addWeatherCue(\'lightning\')','addWeatherCue(\'thunder\')']) assert.ok(template.includes(action),action)
  assert.match(script,/newCommand\(def\[0\], def\[1\]\)/)
})

test('S10-13 · el compilador Vue real valida el template si está disponible', async (t) => {
  let compiler
  try { compiler=await import('@vue/compiler-sfc') }
  catch(e) { if(e?.code==='ERR_MODULE_NOT_FOUND') {t.skip('Instalar dependencias y ejecutar npm run build local');return} throw e }
  const parsed=compiler.parse(source,{filename:'TimelinePanel.vue'})
  assert.deepEqual(parsed.errors,[])
  const output=compiler.compileTemplate({source:parsed.descriptor.template.content,filename:'TimelinePanel.vue',id:'s10'})
  assert.deepEqual(output.errors,[])
})
