import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  newTimeline, newTrack, newKey, normalizeTimeline, timelineVisibleRows,
  addTimelineGroup, removeTimelineGroup, moveTimelineGroup, moveTimelineTrack,
  timelineTrackEditable, timelineSelectedKeys, timelineKeysInRegion,
  moveTimelineSelection, duplicateTimelineSelection, deleteTimelineSelection,
  addTimelineMarker, moveTimelineMarker, deleteTimelineMarker, timelineMinDuration,
  addTimelineClip, editTimelineClip, deleteTimelineClip, editTimelineEvent,
  retimeTimelineSegment, timelineClipSnapTime, timelineSelectionMoveDelta,
} from '../src/core/timeline/model.js'
const panel=readFileSync(new URL('../src/components/TimelinePanel.vue',import.meta.url),'utf8')
const inspector=readFileSync(new URL('../src/components/TemporalResourceInspector.vue',import.meta.url),'utf8')
const editor=readFileSync(new URL('../src/components/EventEditor.vue',import.meta.url),'utf8')
const state=readFileSync(new URL('../src/core/state/timelines.js',import.meta.url),'utf8')
const sample=()=>{
 const t=newTimeline('QA',{duration:12}),a=newTrack('node',{name:'Luz',prop:'position'}),b=newTrack('camera',{name:'Cámara'}),c=newTrack('commands',{name:'Eventos'})
 a.keys=[newKey('node',1,{v:[0,0,0]}),newKey('node',3,{v:[3,0,0]})]
 b.keys=[newKey('camera',2),newKey('camera',6)]
 c.keys=[newKey('commands',4),newKey('commands',7)]
 t.tracks=[a,b,c]
 return {t,a,b,c}
}
test('G004-01 · proyectos anteriores normalizan sin migración destructiva',()=>{
 const {t,a}=sample();delete t.groups;delete t.markers;delete a.locked
 const n=normalizeTimeline(t);assert.deepEqual(n.groups,[]);assert.deepEqual(n.markers,[]);assert.equal(n.tracks[0].locked,false)
 assert.equal(n.tracks[0].keys[0].id,a.keys[0].id)
})
test('G004-02 · crear grupos planos con IDs distintos y sin pistas nuevas',()=>{
 const {t}=sample();const g=addTimelineGroup(t,'Actores'),h=addTimelineGroup(t,'Audio')
 assert.notEqual(g.id,h.id);assert.equal(t.tracks.length,3);assert.deepEqual(t.groups.map(x=>x.name),['Actores','Audio'])
})
test('G004-03 · agrupar y desagrupar conserva claves, pistas y orden runtime',()=>{
 const {t,a,b,c}=sample(),g=addTimelineGroup(t,'Primer grupo'),before=t.tracks.map(x=>x.id)
 assert.ok(moveTimelineTrack(t,a.id,{groupId:g.id}));assert.ok(moveTimelineTrack(t,b.id,{groupId:g.id}))
 assert.deepEqual(t.tracks.map(x=>x.id),before)
 assert.ok(removeTimelineGroup(t,g.id));assert.deepEqual(t.tracks.map(x=>x.id),before)
 assert.equal(a.groupId,undefined);assert.equal(b.groupId,undefined);assert.equal(c.keys.length,2)
})
test('G004-04 · grupos colapsados ocultan filas, nunca pistas persistidas',()=>{
 const {t,a,b}=sample(),g=addTimelineGroup(t)
 moveTimelineTrack(t,a.id,{groupId:g.id});moveTimelineTrack(t,b.id,{groupId:g.id})
 let rows=timelineVisibleRows(t);assert.deepEqual(rows.map(r=>r.type),['track','group','track','track'])
 g.collapsed=true;rows=timelineVisibleRows(t);assert.deepEqual(rows.map(r=>r.type),['track','group'])
 assert.equal(t.tracks.length,3)
})
test('G004-05 · el orden editorial no reordena timeline.tracks',()=>{
 const {t,a,b,c}=sample(),ids=t.tracks.map(x=>x.id)
 assert.ok(moveTimelineTrack(t,c.id,{beforeId:a.id}));assert.deepEqual(t.tracks.map(x=>x.id),ids)
 assert.deepEqual(timelineVisibleRows(t).filter(r=>r.type==='track').map(r=>r.id),[c.id,a.id,b.id])
 const loaded=normalizeTimeline(t);assert.deepEqual(timelineVisibleRows(loaded).filter(r=>r.type==='track').map(r=>r.id),[c.id,a.id,b.id])
})
test('G004-06 · mover pista dentro de grupo contraído conserva el orden oculto',()=>{
 const {t,a,b,c}=sample(),g=addTimelineGroup(t);moveTimelineTrack(t,a.id,{groupId:g.id});moveTimelineTrack(t,b.id,{groupId:g.id})
 g.collapsed=true;assert.ok(moveTimelineTrack(t,c.id,{groupId:g.id,beforeId:a.id}))
 g.collapsed=false;assert.deepEqual(timelineVisibleRows(t).filter(r=>r.type==='track').map(r=>r.id),[c.id,a.id,b.id])
})
test('G004-07 · reordenar grupos no modifica el orden de evaluación',()=>{
 const {t,a,b}=sample(),g=addTimelineGroup(t,'Uno'),h=addTimelineGroup(t,'Dos'),ids=t.tracks.map(x=>x.id)
 moveTimelineTrack(t,a.id,{groupId:g.id});moveTimelineTrack(t,b.id,{groupId:h.id});assert.ok(moveTimelineGroup(t,h.id,g.id))
 assert.deepEqual(t.groups.map(x=>x.id),[h.id,g.id]);assert.deepEqual(t.tracks.map(x=>x.id),ids)
})
test('G004-08 · rechaza grupos inexistentes, IDs duplicados y referencias rotas',()=>{
 const {t,a}=sample();assert.equal(moveTimelineTrack(t,a.id,{groupId:'inexistente'}),false)
 const g=addTimelineGroup(t);const cloned=structuredClone(t);cloned.groups.push({...g});assert.throws(()=>normalizeTimeline(cloned),/duplicado/)
 const bad=structuredClone(t);bad.tracks[0].groupId='falso';assert.throws(()=>normalizeTimeline(bad),/inexistente/)
})
test('G004-09 · bloqueo persiste y se distingue de mute',()=>{
 const {t,a}=sample();a.locked=true;a.muted=false;const n=normalizeTimeline(t)
 assert.equal(n.tracks[0].locked,true);assert.equal(n.tracks[0].muted,false);assert.equal(timelineTrackEditable(n.tracks[0]),false)
})
test('G004-10 · selección de claves omite pista bloqueada',()=>{
 const {t,a,b}=sample();a.locked=true
 assert.deepEqual(timelineSelectedKeys(t,[{tr:a.id,k:a.keys[0].id}]),[])
 assert.equal(timelineSelectedKeys(t,[{tr:b.id,k:b.keys[0].id}]).length,1)
})
test('G004-11 · selección rectangular respeta grupos y bloqueo',()=>{
 const {t,a,b}=sample(),g=addTimelineGroup(t);moveTimelineTrack(t,a.id,{groupId:g.id});moveTimelineTrack(t,b.id,{groupId:g.id})
 const rows=timelineVisibleRows(t);assert.equal(rows[1].type,'group')
 let result=timelineKeysInRegion(t,0,10,1,1,rows);assert.deepEqual(result,[])
 result=timelineKeysInRegion(t,0,10,2,3,rows);assert.equal(result.length,4)
 a.locked=true;result=timelineKeysInRegion(t,0,10,2,3,rows);assert.equal(result.length,2)
})
test('G004-12 · mover, duplicar y eliminar claves bloqueadas no modifica datos',()=>{
 const {t,a}=sample(),ref=[{tr:a.id,k:a.keys[0].id}],before=structuredClone(a.keys)
 a.locked=true;assert.equal(moveTimelineSelection(t,ref,1),0);assert.deepEqual(duplicateTimelineSelection(t,ref),[])
 assert.equal(deleteTimelineSelection(t,ref),0);assert.deepEqual(a.keys,before)
})
test('G004-13 · operaciones de clips rechazan pista bloqueada',()=>{
 const {t,a}=sample(),clip=addTimelineClip(t,a.id,a.keys[0].id),before=structuredClone(a.clips)
 a.locked=true
 assert.throws(()=>editTimelineClip(t,a.id,clip.id,{start:4}),/válido|Clip/)
 assert.equal(deleteTimelineClip(t,a.id,clip.id),false)
 assert.throws(()=>addTimelineClip(t,a.id,a.keys[0].id),/admiten/)
 assert.deepEqual(a.clips,before)
})
test('G004-14 · eventos, keyframe retime y Snap no editan pista bloqueada',()=>{
 const {t,a,c}=sample();a.locked=true;c.locked=true
 assert.equal(retimeTimelineSegment(a,a.keys[0].id,4,12,.1),false)
 assert.throws(()=>editTimelineEvent(t,c.id,c.keys[0].id,5,'ripple'),/discretos/)
 assert.equal(a.keys[1].t,3);assert.equal(c.keys[0].t,4)
})
test('G004-15 · marcador conserva nombre e ID al normalizar',()=>{
 const {t}=sample(),m=addTimelineMarker(t,3.125,'Entrada')
 const n=normalizeTimeline(t);assert.deepEqual(n.markers,[{id:m.id,t:3.125,name:'Entrada'}]);assert.equal(n.tracks.length,3)
})
test('G004-16 · marcadores se ordenan, mueven y eliminan sin claves nuevas',()=>{
 const {t}=sample(),m=addTimelineMarker(t,8,'Fin'),n=addTimelineMarker(t,2,'Inicio')
 assert.deepEqual(t.markers.map(x=>x.id),[n.id,m.id]);assert.ok(moveTimelineMarker(t,m.id,1));assert.equal(t.markers[0].id,m.id)
 assert.ok(deleteTimelineMarker(t,m.id));assert.equal(t.markers.length,1);assert.equal(t.tracks[0].keys.length,2)
})
test('G004-17 · marcadores fuera de duración o duplicados son rechazados',()=>{
 const {t}=sample();assert.throws(()=>addTimelineMarker(t,-1),/fuera/)
 const m=addTimelineMarker(t,3);assert.equal(moveTimelineMarker(t,m.id,50),false)
 const invalid=structuredClone(t);invalid.markers.push({...m});assert.throws(()=>normalizeTimeline(invalid),/inválido/)
})
test('G004-18 · marcadores extienden la duración mínima no destructiva',()=>{
 const {t}=sample();addTimelineMarker(t,11);assert.equal(timelineMinDuration(t),11)
})
test('G004-19 · claves y clips usan marcadores como Snap temporal',()=>{
 const {t,a}=sample(),m=addTimelineMarker(t,7),clip=addTimelineClip(t,a.id,a.keys[0].id)
 // time 7 es un candidato temporal; el centro de la clave se ajusta por tolerancia.
 const snapped=timelineSelectionMoveDelta(t,[{tr:a.id,k:a.keys[0].id}],6.04,{snap:.1,zoom:70,playhead:0})
 assert.equal(snapped,6)
 const snappedClip=timelineClipSnapTime(t,a.id,clip.id,7.02,{snap:.1,zoom:70})
 assert.equal(snappedClip,7)
 assert.equal(m.t,7)
})
test('G004-20 · marcadores no son claves ni eventos ni pistas de runtime',()=>{
 const {t}=sample(),before=t.tracks.map(tr=>structuredClone(tr))
 addTimelineMarker(t,5,'Dirección');assert.deepEqual(t.tracks,before)
})
test('G004-21 · la UI usa mismas filas visibles para cabeceras y carriles',()=>{
 assert.match(panel,/const visibleRows = computed\(\(\) => timelineVisibleRows\(tl\.value,\s*\{/)
 assert.equal((panel.match(/v-for="row in visibleRows"/g)||[]).length,2)
 assert.match(panel,/<div class="pinned-column"/)
 assert.match(panel,/ref="scroller" class="scroll"/)
 assert.match(panel,/timelineKeysInRegion\(tl\.value,[\s\S]*?visibleRows\.value\)/)
})
test('G004-22 · la UI enlaza DnD, grupo, bloqueo y marcadores con datos reales',()=>{
 for(const token of ['@dragstart="beginOrganizeDrag','@drop="dropOrganize','@click.stop="toggleGroup','@click.stop="toggleTrackLock','@dblclick.stop="markerAtPointer','@pointerdown.stop="markerDown','@click="addMarker()"']) assert.ok(panel.includes(token),token)
 assert.match(panel,/commit\('Organizar pistas'\)/)
})
test('G004-23 · el Inspector tiene bloqueos de campos reales y edición de grupo y marcador',()=>{
 assert.match(inspector,/:disabled="isTimeline && !!track\.locked"/)
 assert.match(inspector,/:disabled="isTimeline && !!track\?\.locked"/)
 assert.match(inspector,/function editMarkerTime\(/)
 assert.match(inspector,/function editGroupName\(/)
 assert.match(inspector,/toggleInspectorTrackLock/)
})
test('G004-24 · comandos no pueden guardarse tras bloquear su pista',()=>{
 assert.match(editor,/if\(!track \|\| track\.locked \|\| store\.locked \|\| store\.play\.on\)/)
 assert.match(editor,/La pista de Timeline está bloqueada/)
})
test('G004-25 · duplicación completa regenera referencias de grupo, marcador y clips',()=>{
 assert.match(state,/const groupIds=new Map/)
 assert.match(state,/for \(const marker of tl\.markers\|\|\[\]\) marker\.id=uid\('tm'\)/)
 assert.match(state,/clip\.from=keyIds\.get\(clip\.from\)/)
})
test('G004-26 · no hay cambios de Player ni sistemas paralelos de Timeline',()=>{
 assert.doesNotMatch(panel,/UnityEngine|UnityEditor|new TimelinePlayer/)
 assert.match(panel,/const ORGANIZE_MIME='application\/x-lf-timeline-organize'/)
})
test('G004-27 · compilador Vue valida templates cuando está disponible',async t=>{
 let compiler
 try {compiler=await import('@vue/compiler-sfc')}catch(e){if(e.code==='ERR_MODULE_NOT_FOUND'){t.skip('Compiler Vue ausente; QA Electron del usuario requerido');return}throw e}
 for(const [file,content] of [['TimelinePanel.vue',panel],['TemporalResourceInspector.vue',inspector],['EventEditor.vue',editor]]){
   const parsed=compiler.parse(content,{filename:file});assert.deepEqual(parsed.errors,[],file)
   const result=compiler.compileTemplate({source:parsed.descriptor.template.content,filename:file,id:'g004'});assert.deepEqual(result.errors,[],file)
 }
})

test('G004-28 · grupo en misma posición no provoca mutación sin commit',()=>{
 const {t,a}=sample(),g=addTimelineGroup(t);moveTimelineTrack(t,a.id,{groupId:g.id})
 const before=structuredClone(t);assert.equal(moveTimelineTrack(t,a.id,{groupId:g.id}),false)
 assert.deepEqual(t,before)
})
test('G004-29 · las rutas complementarias de edición respetan bloqueo',()=>{
 for(const token of ['if (isTimeline.value && !timelineTrackEditable(track.value)) return', 'function methodArgsChange(text)', 'function curveChange(index, value)']) assert.ok(inspector.includes(token),token)
 assert.match(panel,/La pista Naturaleza está bloqueada/)
 assert.match(panel,/function toggleGroup\(group\) \{if\(store.locked \|\| store.play.on/)
})
