import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  newTimeline,newTrack,newKey,addTimelineCameraBinding,ensureTimelineNodePropertyTrack,
  upsertTimelineNodePropertyKey,timelineVisibleRows,timelineTrackNodeOwner,
  addTimelineGroup,moveTimelineTrack,normalizeTimeline,timelineKeysInRegion,
} from '../src/core/timeline/model.js'

const sceneId='scene-a'
const camera={id:'cam-a',name:'Camera3D',type:'camera',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],visible:true}
const cameraB={id:'cam-b',name:'Camera3D',type:'camera',position:[1,0,0],rotation:[0,0,0],scale:[1,1,1],visible:true}
const mesh={id:'mesh-a',name:'Malla',type:'mesh',position:[1,2,3],rotation:[0,0,0],scale:[1,1,1],visible:true}
const objects=[camera,cameraB,mesh]
const timeline=()=>newTimeline('QA Nodo',{id:'timeline-corr002',duration:6})
const addProp=(t,node=camera,prop='position')=>ensureTimelineNodePropertyTrack(t,node,prop,sceneId,objects).track
const addShot=(t,node=camera,time=0,params={})=>addTimelineCameraBinding(t,node,time,{sceneId,...params}).track
const rows=(t, opts={})=>timelineVisibleRows(t,{objects,sceneId,...opts})
const hdrs=t=>rows(t).filter(row=>row.type==='node')
const children=t=>rows(t).filter(row=>row.child)
const code=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8')

test('NH-01 · arrastrar una cámara produce un encabezado único y una pista real',()=>{
 const t=timeline(),shot=addShot(t)
 assert.deepEqual(rows(t).map(row=>row.type),['node','track'])
 assert.equal(hdrs(t)[0].nodeId,camera.id);assert.equal(children(t)[0].track,shot)
 assert.equal(t.tracks.length,1)
})
test('NH-02 · una posición por llave comparte encabezado con su toma',()=>{
 const t=timeline();addShot(t);addProp(t)
 assert.equal(hdrs(t).length,1);assert.deepEqual(children(t).map(row=>row.track.kind),['camera','node'])
 assert.equal(t.tracks.length,2)
})
test('NH-03 · posición, rotación y escala son filas hijas, no nuevos encabezados',()=>{
 const t=timeline();['position','rotation','scale'].forEach(prop=>addProp(t,camera,prop))
 assert.equal(hdrs(t).length,1);assert.equal(children(t).length,3)
 assert.deepEqual(children(t).map(row=>row.track.prop),['position','rotation','scale'])
})
test('NH-04 · cámara añadida dos veces reutiliza pista y encabezado',()=>{
 const t=timeline();const shot=addShot(t);const second=addShot(t,camera,2)
 assert.equal(second,shot);assert.equal(shot.keys.length,2);assert.equal(t.tracks.length,1);assert.equal(hdrs(t).length,1)
})
test('NH-05 · camera binding duplicado en mismo tiempo reutiliza ID',()=>{
 const t=timeline();const first=addTimelineCameraBinding(t,camera,0,{sceneId});const again=addTimelineCameraBinding(t,camera,0,{sceneId})
 assert.equal(again.changed,false);assert.equal(again.key.id,first.key.id);assert.equal(hdrs(t).length,1)
})
test('NH-06 · dos cámaras con idéntico nombre mantienen encabezados distintos',()=>{
 const t=timeline();addShot(t,camera);addShot(t,cameraB)
 assert.equal(hdrs(t).length,2);assert.notEqual(hdrs(t)[0].id,hdrs(t)[1].id)
})
test('NH-07 · renombrar un nodo cambia encabezado pero conserva datos de pistas',()=>{
 const t=timeline();const shot=addShot(t);const before=structuredClone(shot);const name=camera.name
 try {camera.name='Otra cámara';assert.equal(hdrs(t)[0].node.name,'Otra cámara');assert.deepEqual(shot,before)} finally{camera.name=name}
})
test('NH-08 · collapse por ID solo oculta filas, no toca Timeline',()=>{
 const t=timeline();addShot(t);addProp(t);const before=structuredClone(t);const id=hdrs(t)[0].id
 assert.deepEqual(rows(t,{collapsedNodes:new Set([id])}).map(r=>r.type),['node']);assert.deepEqual(t,before)
})
test('NH-09 · eliminar una sola propiedad conserva las restantes',()=>{
 const t=timeline();addShot(t);const prop=addProp(t);t.tracks=t.tracks.filter(tr=>tr!==prop)
 assert.equal(hdrs(t).length,1);assert.equal(children(t).length,1)
})
test('NH-10 · eliminar última pista elimina encabezado derivado',()=>{
 const t=timeline();addProp(t);t.tracks=[];assert.equal(hdrs(t).length,0)
})
test('NH-11 · snapshots de historial pueden restaurar todas las filas sin IDs adicionales',()=>{
 const t=timeline();addProp(t);const before=structuredClone(t);addShot(t)
 const after=structuredClone(t);assert.equal(t.tracks.length,2)
 Object.assign(t,before);assert.equal(t.tracks.length,1);assert.equal(hdrs(t).length,1)
 Object.assign(t,after);assert.equal(t.tracks.length,2);assert.equal(hdrs(t).length,1)
})
test('NH-12 · guardar/normalizar conserva las pistas reales, no cabeceras',()=>{
 const t=timeline();addShot(t);addProp(t);const saved=JSON.stringify(t)
 const normalized=normalizeTimeline(JSON.parse(saved))
 assert.deepEqual(normalized.tracks.map(x=>x.id),t.tracks.map(x=>x.id))
 assert.equal(hdrs(normalized).length,1);assert.equal(JSON.parse(saved).tracks.length,2)
 assert.equal(JSON.parse(saved).nodes,undefined)
})
test('NH-13 · pista global de dos cámaras permanece fuera de cualquier encabezado',()=>{
 const t=timeline(),shot=addShot(t)
 addTimelineCameraBinding(t,cameraB,2,{sceneId,trackId:shot.id})
 assert.equal(t.tracks.length,1);assert.deepEqual(rows(t).map(r=>r.type),['track'])
 assert.equal(timelineTrackNodeOwner(shot,objects,sceneId),null)
})
test('NH-14 · pista con fuente free o Player no reclama un nodo',()=>{
 const t=timeline(),shot=addShot(t)
 shot.keys.push(newKey('camera',2,{mode:'free'}))
 assert.equal(hdrs(t).length,0)
})
test('NH-15 · pista de cámara de otra escena no se asocia a la escena activa',()=>{
 const t=timeline(),shot=addShot(t)
 shot.keys[0].sceneId='scene-b';assert.equal(hdrs(t).length,0)
})
test('NH-16 · pista method por ID se agrupa bajo el mismo nodo',()=>{
 const t=timeline();addProp(t,mesh);t.tracks.push(newTrack('method',{node:mesh.id,byId:true,name:'Métodos'}))
 assert.equal(hdrs(t).length,1);assert.equal(children(t).length,2)
})
test('NH-17 · grupos manuales existentes conservan la estructura sin cambios',()=>{
 const t=timeline();const g=addTimelineGroup(t,'Grupo original');const prop=addProp(t)
 moveTimelineTrack(t,prop.id,{groupId:g.id});const before=structuredClone(t)
 assert.deepEqual(rows(t).map(r=>r.type),['group','node','track']);assert.deepEqual(t,before)
})
test('NH-18 · grupo editorial colapsado sigue ocultando sus pistas',()=>{
 const t=timeline();const g=addTimelineGroup(t);const prop=addProp(t)
 moveTimelineTrack(t,prop.id,{groupId:g.id});g.collapsed=true
 assert.deepEqual(rows(t).map(r=>r.type),['group'])
})
test('NH-19 · cruces de grupos existentes no se reordenan ni duplican encabezados',()=>{
 const t=timeline();const g=addTimelineGroup(t);const a=addProp(t,camera,'position'),b=addProp(t,camera,'rotation')
 moveTimelineTrack(t,a.id,{groupId:g.id});const before=structuredClone(t)
 assert.equal(hdrs(t).length,0);assert.equal(rows(t).filter(row=>row.nodeConflict).length,2)
 assert.deepEqual(t,before)
})
test('NH-20 · nueva propiedad hereda el grupo de las pistas del mismo nodo',()=>{
 const t=timeline();const g=addTimelineGroup(t);const a=addProp(t)
 moveTimelineTrack(t,a.id,{groupId:g.id});const b=addProp(t,camera,'rotation')
 assert.equal(b.groupId,g.id);assert.equal(hdrs(t).length,1)
})
test('NH-21 · nueva toma de cámara hereda el grupo de su propiedad ya creada',()=>{
 const t=timeline(),g=addTimelineGroup(t),prop=addProp(t)
 moveTimelineTrack(t,prop.id,{groupId:g.id});const shot=addShot(t)
 assert.equal(shot.groupId,g.id);assert.equal(hdrs(t).length,1)
})
test('NH-22 · grupos contradictorios bloquean nueva pista sin modificar Timeline',()=>{
 const t=timeline(),g=addTimelineGroup(t);const a=addProp(t,camera,'position'),b=addProp(t,camera,'rotation')
 moveTimelineTrack(t,b.id,{groupId:g.id});const before=structuredClone(t)
 assert.throws(()=>addProp(t,camera,'scale'),/grupos distintos/);assert.deepEqual(t,before)
})
test('NH-23 · pista de método por nombre heredado único se presenta sin migración',()=>{
 const t=timeline(),legacy=newTrack('method',{node:mesh.name,byId:false})
 t.tracks.push(legacy);assert.equal(hdrs(t)[0].nodeId,mesh.id);assert.equal(t.tracks[0].node,mesh.name)
})
test('NH-24 · nombre heredado ambiguo permanece plano, sin asociación especulativa',()=>{
 const t=timeline();t.tracks.push(newTrack('method',{node:camera.name,byId:false}))
 assert.deepEqual(rows(t).map(r=>r.type),['track'])
})
test('NH-25 · una pista global y una de propiedad de Camera3D no son dos copias de datos',()=>{
 const t=timeline(),shot=addShot(t);addTimelineCameraBinding(t,cameraB,2,{sceneId,trackId:shot.id});addProp(t)
 assert.equal(t.tracks.length,2);assert.equal(hdrs(t).length,1)
 assert.deepEqual(rows(t).map(r=>r.type),['track','node','track'])
})
test('NH-26 · ordenar visualmente no modifica el orden persistido de reproducción',()=>{
 const t=timeline();const a=addProp(t,camera,'position'),b=addProp(t,mesh,'position'),c=addProp(t,camera,'rotation')
 const before=t.tracks.map(tr=>tr.id);rows(t)
 assert.deepEqual(t.tracks.map(tr=>tr.id),before)
 assert.deepEqual(children(t).filter(r=>r.nodeId===camera.id).map(r=>r.track.id),[a.id,c.id])
})
test('NH-27 · selección rectangular utiliza filas derivadas, no el índice plano',()=>{
 const t=timeline();addShot(t);const prop=addProp(t)
 prop.keys.push(newKey('node',1,{v:[1,2,3]}))
 const visible=rows(t)
 assert.equal(visible[0].type,'node');assert.equal(visible[2].track,prop)
 const selected=timelineKeysInRegion(t,0,2,2,2,visible)
 assert.equal(selected.length,1);assert.equal(selected[0].tr,prop.id)
 assert.equal(timelineKeysInRegion(t,0,2,0,0,visible).length,0)
})
test('NH-28 · llave del encabezado consulta los descriptores de propiedad, sin NODE_PROPS fijo',()=>{
 const panel=code('src/components/TimelinePanel.vue')
 assert.match(panel,/nodeAnimationProperties\(row\.node\)/)
 assert.doesNotMatch(panel,/\.\.\.NODE_PROPS\.map/)
})
test('NH-29 · el encabezado no participa en historial ni grabación del proyecto',()=>{
 const panel=code('src/components/TimelinePanel.vue')
 assert.match(panel,/const collapsedNodes = ref\(new Set\(\)\)/)
 assert.match(panel,/function toggleNodeRow\(row\)/)
 const fn=panel.slice(panel.indexOf('function toggleNodeRow(row)'),panel.indexOf('function pickNodeRow(row)'))
 assert.doesNotMatch(fn,/commit\(|markDirty\(|\.groups\.push/)
})
test('NH-30 · selección de encabezado utiliza selector original de Jerarquía',()=>{
 const panel=code('src/components/TimelinePanel.vue')
 assert.match(panel,/function pickNodeRow\(row\)/)
 assert.match(panel,/selectObject\(row\.nodeId\)/)
 assert.match(panel,/<button type="button" class="node-row-name"/)
})
test('NH-31 · filas de cabecera y carril comparten la misma lista reactiva',()=>{
 const panel=code('src/components/TimelinePanel.vue')
 assert.equal((panel.match(/v-for="row in visibleRows"/g)||[]).length,2)
 assert.match(panel,/v-else-if="row\.type==='node'" class="node-lane"/)
})
test('NH-32 · la caché visual no modifica Player, física ni Camera Orchestration',()=>{
 const panel=code('src/components/TimelinePanel.vue')
 const model=code('src/core/timeline/model.js')
 assert.match(model,/El Player sigue leyendo timeline\.tracks/)
 assert.doesNotMatch(panel,/new AnimationPlayer|new CameraOrchestrator|new NodeTrackManager/)
})
