import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { timelineRulerTicks } from '../src/core/timeline/model.js'
import { normalizeEdit, duplicateShot, duplicateLayer, duplicateAudioClip, sequence, filmEnd } from '../src/filmmaker/montage.js'
import { addNodeTrack, addProperty, upsertNodeKey, editNodeKey, moveNodeKey, FilmTrackHistory } from '../src/filmmaker/node-authoring.js'

const source = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
const film = (edit = {}) => ({ passes: [], edit: normalizeEdit(edit), takes: [], cameras: [{ id: 'cam-1', name: 'Principal' }], activeCameraId: 'cam-1' })
const base = source('src/filmmaker/NleTimeline.vue')
const level = source('src/components/TimelinePanel.vue')

test('S03-01 · regla de tiempo compartida: límites, marcas crecientes y marcas mayores', () => {
  for (const [end, scale] of [[0,70],[15,70],[600,8],[10000,400],[86400,1]]) {
    const result = timelineRulerTicks(end, scale)
    assert.ok(result.length <= 1200)
    assert.equal(result[0]?.t, 0)
    assert.ok(result.every((t,i) => Number.isFinite(t.t) && t.t >= 0 && t.t <= end && (i === 0 || t.t > result[i-1].t)))
    assert.ok(result.some(t => t.major))
  }
})
test('S03-02 · LevelForge y FilmMaker invocan el mismo cálculo de regla, sin relojes compartidos', () => {
  assert.match(level, /timelineRulerTicks\(tl\.value\?\.duration \|\| 0, zoom\.value\)/)
  assert.match(base, /timelineRulerTicks\(end\.value \+ 10, pps\.value\)/)
  assert.doesNotMatch(base, /project\.timelines\s*=/)
})
test('S03-03 · película sin montaje: ninguna pista, clip, audio ni efecto se genera automáticamente', () => {
  const f = film()
  assert.deepEqual(Object.keys(f.edit).sort(), ['audio','filters','layers','nodeTracks','outro','physicsBakes','shots'].sort())
  for (const kind of ['audio','filters','layers','nodeTracks','physicsBakes','shots']) assert.equal(f.edit[kind].length, 0, kind)
  assert.equal(sequence(f).items.length, 0)
  assert.equal(filmEnd(f), 0)
  assert.match(base, /data-test="nle-empty"/)
  assert.match(base, /v-if="!hasTimelineContent"/)
})
test('S03-04 · duplicar un plano conserva pase, transición y orden, sin mutar el original', () => {
  const f = film({shots:[{id:'shot-1',pass:'pass-1',in:0,out:3,tin:{kind:'black',dur:0.6}}]})
  f.passes=[{id:'pass-1',duration:3,keys:[],name:'Cámara A'}]
  const before=JSON.stringify(f.edit)
  const result=duplicateShot(f, 'shot-1')
  assert.equal(JSON.stringify(f.edit), before)
  assert.equal(result.edit.shots.length,2)
  assert.equal(result.edit.shots[1].pass,'pass-1')
  assert.equal(result.edit.shots[1].tin.kind,'black')
  assert.notEqual(result.edit.shots[1].id,'shot-1')
})
test('S03-05 · una capa duplicada conserva atributos y avanza temporalmente', () => {
  const f = film({layers:[{id:'layer-1',kind:'text',t0:1,t1:3,params:{text:'Diálogo'}}]})
  const result=duplicateLayer(f,'layer-1')
  assert.equal(result.edit.layers.length,2)
  const layer=result.edit.layers[1]
  assert.notEqual(layer.id,'layer-1')
  assert.equal(layer.t0,3)
  assert.equal(layer.t1,5)
  assert.equal(layer.params.text,'Diálogo')
  assert.equal(f.edit.layers.length,1)
})
test('S03-06 · duplicar clip de audio conserva canal y fundidos, sin duplicar el recurso Assets', () => {
  const f=film({audio:[{id:'track-1',name:'Diálogos',clips:[{id:'audio-1',asset:'asset-1',name:'Voz',start:1,in:0,dur:2,len:10,fadeIn:0.2,fadeOut:0.5}]}]})
  const result=duplicateAudioClip(f,'audio-1')
  assert.equal(result.edit.audio.length,1)
  const clips=result.edit.audio[0].clips
  assert.equal(clips.length,2)
  assert.notEqual(clips[1].id,'audio-1')
  assert.equal(clips[1].asset,'asset-1')
  assert.equal(clips[1].start,3)
  assert.equal(clips[1].fadeOut,0.5)
  assert.equal(f.edit.audio[0].clips.length,1)
})
test('S03-07 · ID inexistente no altera el montaje ni fabrica duplicados', () => {
  const f=film()
  assert.equal(duplicateShot(f,'absent').id,null)
  assert.equal(duplicateLayer(f,'absent').id,null)
  assert.equal(duplicateAudioClip(f,'absent').id,null)
  assert.equal(JSON.stringify(f.edit),JSON.stringify(normalizeEdit()))
})
test('S03-08 · claves Bézier utilizan el evaluador de animación existente y persisten controladores', () => {
  let edit=normalizeEdit()
  edit=addNodeTrack(edit,'node-1','Puerta')
  edit=addProperty(edit,'node-1','position')
  edit=upsertNodeKey(edit,'node-1','position',0,[0,0,0],'bezier')
  let key=edit.nodeTracks[0].properties[0].keys[0]
  assert.deepEqual(key.bz,[0.42,0,0.58,1])
  edit=editNodeKey(edit,'node-1','position',key.id,undefined,'bezier',[0,0.5,0.4,1])
  key=edit.nodeTracks[0].properties[0].keys[0]
  assert.deepEqual(key.bz,[0,0.5,0.4,1])
  edit=moveNodeKey(edit,'node-1','position',key.id,1)
  assert.equal(edit.nodeTracks[0].properties[0].keys[0].t,1)
  edit=editNodeKey(edit,'node-1','position',key.id,undefined,'cut')
  assert.equal(edit.nodeTracks[0].properties[0].keys[0].bz,undefined)
})
test('S03-09 · la edición por pistas utiliza el historial existente con undo/redo', () => {
  const prev=normalizeEdit()
  const next=addNodeTrack(prev,'node-1','Puerta')
  const hist=new FilmTrackHistory()
  assert.equal(hist.commit(prev,next),true)
  assert.equal(hist.canUndo,true)
  const undone=hist.undo(next)
  assert.equal(undone.nodeTracks.length,0)
  const redone=hist.redo(undone)
  assert.equal(redone.nodeTracks.length,1)
})
test('S03-10 · arrastre Jerarquía utiliza el mismo MIME, sin convertir a project.timelines', () => {
  assert.match(level,/application\/x-lf-node/)
  assert.match(base,/application\/x-lf-node/)
  assert.match(base,/F\.addFilmNode\(nodeId\)/)
  assert.match(base,/if \(addNodeById\(node\.id\)\) addNodeProperty\(node\.id, prop\)/)
})
test('S03-11 · menús de contexto usan la infraestructura de LevelForge y operaciones sobre el modelo FilmMaker', () => {
  assert.match(base,/store\.menu = \{ x: e\.clientX, y: e\.clientY, items \}/)
  assert.match(base,/M\.duplicateShot/)
  assert.match(base,/M\.duplicateLayer/)
  assert.match(base,/M\.duplicateAudioClip/)
  assert.match(base,/contextMenu\(\$event, \{kind: 'nodekey'/)
})
test('S03-12 · la Timeline conserva clips de cine, física, audio y nodos y no permite ejecutar métodos arbitrarios', () => {
  for(const marker of ['class="clip shot"','class="clip actor"','class="clip audio"', 'class="lane bake-head"','class="lane node-part"','data-test="nle-add-menu"']) assert.match(base,new RegExp(marker))
  assert.doesNotMatch(base,/openEventEditor|runMethod\(/)
})
test('S03-13 · .nfm mantiene un formato único y una cámara de autoría estructural', () => {
  const code=source('src/filmmaker/film.js')
  assert.doesNotMatch(code,/NFM_VERSION|f\.version|cam_legacy/)
  assert.match(code,/cameras: \[camera\], activeCameraId: camera\.id/)
})
