import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Game } from '../src/engine/runtime/events/interpreter.js'
import { newKey, newTimeline, newTrack } from '../src/core/timeline/model.js'
import { resolveAudioClip, resolveAudioGroup } from '../src/engine/runtime/audio/config.js'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const source = read('src/core/timeline/event-preview.js')
const runnerSource = read('src/engine/runtime/timeline/player.js')
const TimelineRunner = Function('evalTimelineCamera','evalTimelineNode','sampleBakeTrack',
  runnerSource.replace(/^import .*\n/gm, '').replace('export class TimelineRunner','class TimelineRunner') + ';return TimelineRunner')
  (() => null, () => undefined, () => null)
const { TimelineEventPreview } = Function('TimelineRunner','Game','getAudio','resolveAudioClip','resolveAudioGroup',
  source.replace(/^import .*\n/gm, '').replaceAll('export class ', 'class ').replaceAll('export function ', 'function ') + ';return {TimelineEventPreview}')
  (TimelineRunner, Game, () => ({}), resolveAudioClip, resolveAudioGroup)
const flush = async () => { for (let i = 0; i < 7; i++) await Promise.resolve() }
function fixture() {
  const dialogs = [], captions = [], warnings = []
  const project = { database: {}, timelines: [], audio: { groups: [{ id: 'sfx', name: 'SFX' }] } }
  const preview = new TimelineEventPreview({ getProject: () => project, audioEngine: () => ({ configure() {} }),
    onDialog: value => dialogs.push(value), onCaption: value => captions.push(value), onWarning: value => warnings.push(value) })
  const track = newTrack('commands', { name: 'Comandos' })
  track.keys = [newKey('commands', 1, { name: 'Texto', list: [{ code: 'text', p: { speaker: 'Ariel', text: 'Hola\\C[2] rojo', pos: 'top', enter: 'fade', animTime: 200 } }] })]
  const tl = newTimeline('QA S12', { duration: 5, tracks: [track] })
  project.timelines.push(tl)
  return { dialogs, captions, warnings, preview, tl, project }
}
test('S12-G001-01 · la clave de texto emite speaker, texto, posición y animación estructurados', async () => {
  const f = fixture(); f.preview.start(f.tl); f.preview.update(1.1); await flush()
  const d = f.dialogs.at(-1)
  assert.equal(d?.speaker, 'Ariel')
  assert.equal(d?.text, 'Hola\\C[2] rojo')
  assert.equal(d?.pos, 'top')
  assert.equal(d?.anim?.in, 'fade')
  assert.match(f.captions.at(-1), /Ariel: Hola/)
  f.preview.stop()
})
test('S12-G001-02 · la sustitución visual no permite ejecutar comandos fuera de whitelist', async () => {
  const f=fixture(), key=f.tl.tracks[0].keys[0]
  key.list.push({code:'script', p:{code:'throw Error("inseguro")'}})
  f.preview.start(f.tl); f.preview.update(1.1); await flush()
  assert.ok(f.warnings.some(w=>w.includes('script')))
  assert.ok(!f.dialogs.some(d=>d?.text))
  f.preview.stop()
})
test('S12-G001-03 · Seek limpia el diálogo y no vuelve a ejecutar comandos pasados', async () => {
  const f=fixture(); f.preview.start(f.tl); f.preview.update(1.1); await flush()
  assert.ok(f.dialogs.at(-1)?.text)
  f.preview.seek(2); await flush()
  assert.equal(f.dialogs.at(-1), null)
  f.preview.stop()
})
test('S12-G001-04 · Stop limpia el diálogo sin alterar la clave serializada', async () => {
  const f=fixture(), snapshot=JSON.stringify(f.tl)
  f.preview.start(f.tl); f.preview.update(1.2); await flush(); f.preview.stop()
  assert.equal(f.dialogs.at(-1), null)
  assert.equal(JSON.stringify(f.tl),snapshot)
})
test('S12-G001-05 · la sesión única conserva diálogo en el Editor, no en la pestaña Timeline', () => {
  const session=read('src/core/timeline/playback-session.js'), app=read('src/App.vue')
  assert.match(session,/dialog = ref\(null\)/)
  assert.match(session,/onDialog: message =>/)
  assert.match(session,/dialog\.value=null/)
  assert.match(app,/provide\(timelinePlaybackKey,timelinePlayback\)/)
  assert.match(app,/<DialogPreview v-if="!store\.play\.on && timelinePlayback\.dialog\.value"/)
  assert.match(app,/:timeline-time="timelinePlayback\.time\.value"/)
})
test('S12-G001-06 · se elimina la caja auxiliar de Timeline y se reutiliza DialogPreview', () => {
  const panel=read('src/components/TimelinePanel.vue'), modal=read('src/components/DialogPreview.vue')
  assert.doesNotMatch(panel,/Vista previa · Mensaje|previewCaption|timeline-preview-dialog/)
  assert.match(modal,/data-testid="timeline-preview-dialog"/)
  assert.match(modal,/<UiRoot :manager="pm"/)
  assert.match(modal,/v-if="inline"/)
  assert.match(modal,/v-else[^>]*title="Vista previa"/)
})
test('S12-G001-07 · el modo Timeline conserva Canvas diálogo, tema y códigos de texto', () => {
  const modal=read('src/components/DialogPreview.vue')
  assert.match(modal,/parseMessage\(message\.text \|\| ''\)/)
  assert.match(modal,/store\.project\.theme/)
  assert.match(modal,/normalizeCanvas\(o\.props\)\.role === 'dialog'/)
  assert.match(modal,/speaker: message\.speaker/)
  assert.match(modal,/pos: message\.pos/)
  assert.match(modal,/anim: message\.anim/)
})
test('S12-G001-08 · escritura acoplada al tiempo, pausa sin avanzar e interfaz no interactiva', () => {
  const modal=read('src/components/DialogPreview.vue')
  assert.match(modal,/props\.timelineTime - \(props\.timelineDialog\.at \|\| 0\)/)
  assert.match(modal,/watch\(\(\) => props\.timelineTime, advanceTimelineDialog\)/)
  assert.match(modal,/pointer-events: none !important/)
})
test('S12-G001-09 · scripts de Canvas no se ejecutan en Preview; Editor de UI conserva modo normal', () => {
  const mgr=read('src/engine/runtime/ui/manager.js'), modal=read('src/components/DialogPreview.vue')
  assert.match(mgr,/if \(c\.setup && !mgr\.host\.previewReadOnly\)/)
  assert.match(modal,/previewReadOnly: props\.inline/)
  assert.doesNotMatch(mgr,/new UiManager\(/)
})
test('S12-G001-10 · Player y estado persistente no se modifican para previsualizar texto', () => {
  const session=read('src/core/timeline/playback-session.js')
  assert.doesNotMatch(session,/saveAll|commit\(|project\.timelines\s*=/)
  assert.match(source,/this\.game\.run\(list/)
  assert.match(source,/this\._clearDialog\(\)/)
})
