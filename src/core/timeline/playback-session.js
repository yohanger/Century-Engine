// Un solo transporte de Preview por Editor. La vista Timeline lo controla, pero no lo posee.
// El estado no se serializa ni altera la estructura persistente de los recursos.
import { ref, watch } from 'vue'
import { TimelinePreview } from './preview.js'
import { TimelineEventPreview } from './event-preview.js'

export const timelinePlaybackKey = Symbol('Century Timeline Playback')

export function createTimelinePlayback({getContext, getProject, getEditor, getObjects, worldMatrix,
  onWarning = () => {}, requestFrame = callback => requestAnimationFrame(callback),
  cancelFrame = handle => cancelAnimationFrame(handle), now = () => performance.now(),
  createEventPreview = options => new TimelineEventPreview(options),
  createVisualPreview = options => new TimelinePreview(options)}) {
  const time = ref(0), playing = ref(false), previewEnabled = ref(true), caption = ref(''), dialog = ref(null)
  const visual = createVisualPreview({getEditor,getObjects,worldMatrix,onWarning,getSceneId:()=>getContext()?.sceneId})
  let resource = null, contextAtStart = null, raf = 0, last = 0, ticking = false
  let selectedTrack = null, suppressed = false, suppressedAt = 0
  const events = createEventPreview({
    getProject, getEditor,
    onCaption: message => {caption.value = message},
    onDialog: message => { dialog.value = message ? { ...message, at: events.time } : null },
    onWarning,
    onEnd: () => {playing.value=false;cancelFrame(raf);raf=0; suppressed=true; suppressedAt=time.value;previewEnabled.value=false},
  })
  function contextValid() {
    if (!resource) return true
    const current=getContext(), origin=contextAtStart
    return !!current?.project && current.project === origin?.project &&
      current.sceneId === origin.sceneId && current.editor === origin.editor &&
      current.timelineId === resource.id && !current.playOn && !current.locked && !current.cinematic &&
      (current.project.timelines || []).includes(resource)
  }
  function validate() {if (resource && !contextValid()) stop();return !resource || contextValid()}
  function refresh(timeline = resource, track = selectedTrack) {
    if (resource && timeline?.id === resource.id) selectedTrack=track
    const context=getContext()
    if (!timeline || suppressed || !previewEnabled.value || !context?.project ||
      context.playOn || context.locked || context.cinematic || !contextValid()) {visual.stop();return}
    visual.apply(timeline,time.value,{enabled:true,selectedTrack:track})
  }
  function tick(timestamp) {
    raf=0
    if (!playing.value) return
    if (!contextValid()) {stop();return}
    const dt=Math.max(0,Math.min(.1,(timestamp-last)/1000));last=timestamp
    ticking=true
    const active=events.update(dt)
    time.value=events.time
    ticking=false
    if (!active) {playing.value=false;visual.stop();return}
    refresh()
    raf=requestFrame(tick)
  }
  function pause() {
    if (!playing.value) return
    playing.value=false;cancelFrame(raf);raf=0;events.pause()
    // La pausa conserva la evaluación temporal; la edición autoral requiere una acción explícita.
  }
  /** Cesión explícita para editar la pose autoral en pausa; la selección no la invoca. */
  function yieldToEditing() {
    if (playing.value || !previewEnabled.value) return false
    previewEnabled.value=false
    return true
  }
  function stop() {
    playing.value=false;cancelFrame(raf);raf=0;events.stop()
    resource=null;contextAtStart=null;selectedTrack=null
    suppressed=true;suppressedAt=0;time.value=0;caption.value='';dialog.value=null;visual.stop()
  }
  function toggle(timeline, track = null) {
    if (!timeline) return false
    if (playing.value) {pause();return false}
    if (!resource || resource!==timeline) {
      stop();resource=timeline;contextAtStart=getContext()
    }
    // La pista elegida en Timeline conserva prioridad también al iniciar Play.
    selectedTrack = track?.id && timeline.tracks?.includes(track) ? track : null
    if (!contextValid()) {stop();return false}
    if(time.value>=timeline.duration)time.value=0
    previewEnabled.value=true;suppressed=false;suppressedAt=null
    if(events.active && events.runner?.tl===timeline) {
      if(events.time!==time.value)events.seek(time.value)
      events.resume()
    } else events.start(timeline,time.value)
    playing.value=events.active && !events.paused
    if(playing.value){last=now();refresh();raf=requestFrame(tick)}
    return playing.value
  }
  function seek(value) {
    const end=resource?.duration ?? Number.MAX_SAFE_INTEGER
    const next=Math.max(0,Math.min(end,Number(value)||0))
    suppressed=false
    previewEnabled.value=true
    time.value=next
  }
  watch(time, value=>{
    if(ticking)return
    if(events.active && !events.paused)events.seek(value)
    else if(events.paused) {caption.value='';dialog.value=null}
    if(suppressed && value!==suppressedAt)suppressed=false
    if(resource)refresh()
  },{flush:'sync'})
  watch(previewEnabled, enabled=>{
    // Desactivar Preview mientras se edita no debe reiniciar un runner pausado ni el cabezal.
    if (!enabled && playing.value) stop()
    else if (!enabled) visual.stop()
  }, {flush:'sync'})
  function dispose(){stop()}
  return {time,playing,previewEnabled,caption,dialog,toggle,pause,stop,seek,refresh,validate,dispose,yieldToEditing,
    eventsEdited() { events.runner?.refreshEditedEvents() },
    get resourceId(){return resource?.id||null},get active(){return events.active},get paused(){return events.paused}}
}
