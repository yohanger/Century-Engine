import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { newTimeline, normalizeTimeline, filmMakerSource, isFilmMakerTimeline, FILMMAKER_SOURCE, CINEMATICS_FOLDER } from '../src/core/timeline/model.js'
import { DOCK_PANELS, defaultDockLayout, normalizeDockLayout, findDockPanel } from '../src/core/editor/docking.js'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const src=p=>readFileSync(resolve(root,p),'utf8')
const movie={id:'film-alpha',name:'Rodaje',scene:{id:'scene-1'}}
const marker=filmMakerSource(movie,'montage','film-alpha')

test('Origen de película válido y separado del nombre del recurso',()=>{
 assert.equal(marker.provider,FILMMAKER_SOURCE)
 assert.equal(marker.kind,'montage')
 assert.equal(marker.filmId,'film-alpha')
 assert.equal(marker.sceneId,'scene-1')
 assert.equal(marker.sourceId,'film-alpha')
 assert.equal(CINEMATICS_FOLDER,'Assets/Cinematics')
})
test('FilmMaker prohíbe marcadores sin identidad de película, escena o montaje',()=>{
 assert.throws(()=>filmMakerSource({...movie,id:''},'montage','film-alpha'))
 assert.throws(()=>filmMakerSource({...movie,scene:{id:''}},'pass','toma-1'))
 assert.throws(()=>filmMakerSource(movie,'fake','toma-1'))
 assert.throws(()=>filmMakerSource(movie,'pass',''))
})
test('Origen preservado al normalizar, incluso con nombre de timeline cambiado',()=>{
 const timeline=normalizeTimeline(newTimeline('Secuencia libre',{id:'tl-1',filmMaker:marker,duration:23.75}))
 assert.equal(isFilmMakerTimeline(timeline),true)
 assert.deepEqual(timeline.filmMaker,marker)
 assert.equal(timeline.duration,23.75)
 assert.equal(timeline.id,'tl-1')
})
test('Timeline manual y timeline heredado sin origen nunca son películas FilmMaker',()=>{
 assert.equal(isFilmMakerTimeline(newTimeline('Montaje · Rodaje')),false)
 assert.equal(isFilmMakerTimeline(normalizeTimeline(newTimeline('Montaje · Rodaje',{id:'old'}))),false)
 assert.equal(isFilmMakerTimeline(normalizeTimeline(newTimeline('Contenido importado',{filmMaker:{...marker,provider:'other-tool'}}))),false)
})
test('Metadatos malformados no pasan al catálogo, ni se reinterpretan por el nombre',()=>{
 for(const bad of [{...marker,kind:'random'},{...marker,sceneId:''},{...marker,filmId:4},{...marker,sourceId:' '},'FilmMaker']) {
  assert.equal(isFilmMakerTimeline({name:'FilmMaker',filmMaker:bad}),false)
  assert.equal('filmMaker' in normalizeTimeline(newTimeline('FilmMaker',{filmMaker:bad})),false)
 }
})
test('Se admiten pasadas independientes y montaje final',()=>{
 const pass=filmMakerSource(movie,'pass','pass-2')
 const a=normalizeTimeline(newTimeline('Toma de cámara',{filmMaker:pass}))
 const b=normalizeTimeline(newTimeline('Montaje final',{filmMaker:marker}))
 assert.equal(a.filmMaker.kind,'pass');assert.equal(b.filmMaker.kind,'montage')
 assert.equal(isFilmMakerTimeline(a)&&isFilmMakerTimeline(b),true)
})
test('Assets clasifica timelines por origen, sin duplicar colección persistida',()=>{
 const text=src('src/core/project.js')
 const block=text.slice(text.indexOf('export function allEntries('),text.indexOf('export function allEntries(')+3900)
 assert.match(block,/if \(includeTemporal\)/)
 assert.match(block,/kind: isFilmMakerTimeline\(ref\) \? 'cinematic' : 'timeline'/)
 assert.match(block,/folder: isFilmMakerTimeline\(ref\) \? CINEMATICS_FOLDER : ref\.folder \|\| ROOT_FOLDER/)
 assert.match(block,/kind: 'animation'.*folder: ROOT_FOLDER/)
 assert.doesNotMatch(text,/project\.cinematics\s*=/)
})
test('Importador NFM aplica origen en pases y montaje, e incorpora carpeta de Cinematics',()=>{
 const text=src('src/core/state/film.js')
 assert.match(text,/filmMakerSource\(film, 'pass', ps\.id, filmTool\(\)\.cinematicReel\(film, ps\.id\)\)/)
 assert.match(text,/filmMakerSource\(film, 'montage', film\.id, filmTool\(\)\.cinematicReel\(film\)\)/)
 assert.match(text,/store\.project\.timelines\.push\(normalizeTimeline\(tl\)\)/)
 assert.match(text,/addFolderChain\(store\.project, CINEMATICS_FOLDER\)/)
 assert.match(text,/const fields = \[[^\]]*'folders'/)
 assert.match(text,/snapshot.*Object\.fromEntries/s)
})
test('Duplicar un timeline FilmMaker pierde procedencia y respeta contenido/IDs nuevos',()=>{
 const text=src('src/core/state/timelines.js')
 assert.match(text,/delete tl\.filmMaker/)
 assert.match(text,/tl\.id = uid\('tl'\)/)
 assert.match(text,/for \(const tr of tl\.tracks\) \{ tr\.id = uid\('tr'\); for \(const k of tr\.keys\) k\.id = uid\('k'\) \}/)
})
test('Cinematics no permite abrir timelines que no hayan sido importados desde FilmMaker',()=>{
 const text=src('src/core/state/timelines.js')
 assert.match(text,/id === id && isFilmMakerTimeline\(t\)/)
 assert.match(text,/store\.projSel = \{ kind: 'cinematic', id: store\.cinematicId \}/)
 assert.match(text,/store\.prefs\.bottomTab = 'anim'/)
})
test('Dock conserva Cinematics y retira exclusivamente el editor heredado de clips (CA-G003)',()=>{
 assert.equal(DOCK_PANELS.anim[0],'Cinematics')
 assert.equal(DOCK_PANELS.clips,undefined)
 const base=defaultDockLayout()
 assert.equal(findDockPanel(base,'anim').kind,'dock')
 assert.equal(findDockPanel(base,'clips'),null)
})
test('Layouts antiguos migran eliminando clips sin alterar Cinematics ni sus flotantes',()=>{
 const older=defaultDockLayout()
 older.zones.bottom.tabs.push('clips');older.zones.bottom.active='clips'
 const normalized=normalizeDockLayout(older)
 assert.equal(findDockPanel(normalized,'anim').kind,'dock')
 assert.equal(findDockPanel(normalized,'clips'),null)
 const oldFloat=defaultDockLayout();oldFloat.zones.bottom.tabs=oldFloat.zones.bottom.tabs.filter(t=>t!=='anim');oldFloat.floats.push({id:'anim',x:20,y:60,w:400,h:250},{id:'clips',x:30,y:50,w:350,h:300})
 assert.equal(findDockPanel(normalizeDockLayout(oldFloat),'anim').kind,'float')
 assert.equal(findDockPanel(normalizeDockLayout(oldFloat),'clips'),null)
})
test('Ruta heredada de autoría retirada, modelo de gameplay preservado',()=>{
 assert.doesNotMatch(src('src/components/BottomDock.vue'),/AnimationPanel/)
 assert.match(src('src/components/BottomDock.vue'),/CinematicsPanel/)
 assert.doesNotMatch(src('src/components/ProjectPanel.vue'),/openAnimationEditor|Clip de animación.*newTemporal/)
 assert.doesNotMatch(src('src/components/Inspector.vue'),/openAnimationEditor/)
 assert.match(src('src/core/state/animation.js'),/export function deleteAnimation/)
})
test('Cinematics muestra biblioteca por procedencia y no tiene controles de autoría',()=>{
 const panel=src('src/components/CinematicsPanel.vue')
 assert.match(panel,/\.filter\(isFilmMakerTimeline\)/)
 assert.match(panel,/const selected = computed/)
 assert.match(panel,/function choose\(id\)/)
 assert.match(panel,/function toggle\(/)
 assert.match(panel,/function seek\(/)
 assert.match(panel,/function stop\(/)
 assert.match(panel,/store\.projSel\?\.kind === 'cinematic'/)
 assert.match(panel,/importFilmDialog\(\)/)
 assert.doesNotMatch(panel,/(?:createAnimation|newTimeline|createTimeline|newTrack|newKey|commit\(|autoKey|recordPose|addKey|deleteTrack)\s*\(/)
})
test('Vista previa Cinematics no despacha comandos ni métodos en Edit Mode',()=>{
 const text=src('src/core/timeline/preview.js')
 assert.match(text,/evalCamera\(/)
 assert.match(text,/evalNode\(/)
 assert.match(text,/this\.restoreNodes\(\)/)
 assert.match(text,/this\.restoreCamera\(\)/)
 assert.doesNotMatch(text,/(?:runCommand|callPublic|runAudio|dispatchMethod|TimelineRunner)\s*\(/)
 const panel=src('src/components/CinematicsPanel.vue')
 assert.match(panel,/preview.apply\(current, time.value/)
 assert.match(panel,/!store.play.on && store.projSel\?\.kind === 'cinematic'/)
 assert.match(panel,/runFilmCinematic\(current, \{ from: time.value/)
 assert.doesNotMatch(panel,/new TimelineRunner\(/)
})
test('Timeline reutiliza el evaluador original mediante delegación de preview',()=>{
 const timeline=src('src/core/timeline/playback-session.js')
 assert.match(timeline,/createVisualPreview\(/)
 assert.match(timeline,/visual\.apply\(/)
 assert.match(timeline,/!current.cinematic/)
 assert.match(timeline,/visual\.stop\(\)/)
})
test('El Inspector de Cinematics solo presenta información; no contiene formulario editable',()=>{
 const inspector=src('src/components/CinematicResourceInspector.vue')
 assert.match(inspector,/isFilmMakerTimeline\(t\)/)
 assert.match(inspector,/Solo lectura/)
 assert.doesNotMatch(inspector,/(?:ParamForm|commit\(|@input|@change|v-model)/)
 assert.match(src('src/components/InspectorDock.vue'),/CinematicResourceInspector/)
})
test('Assets/Cinematics impide crear, mover, importar archivos o borrar la carpeta de catálogo',()=>{
 const text=src('src/components/ProjectPanel.vue')
 assert.match(text,/const createItems = \(parent\) => isSystemUiPath\(parent\) \|\| isCinematicsFolder\(parent\) \? \[\]/)
 assert.match(text,/if \(isCinematicsFolder\(parent\)\) return toast/)
 assert.match(text,/if \(isSystemUiPath\(path\) \|\| isCinematicsFolder\(path\)\) return false/)
 assert.match(text,/if \(dragging\.some\(d => d\.kind === 'folder' && isCinematicsFolder\(d\.id\)\)\) return false/)
 assert.match(text,/const folderChoices = \(\) => store\.project\.folders\.filter\(f => !isCinematicsFolder\(f\)\)/)
 assert.match(text,/it\.id === ROOT_FOLDER.*isCinematicsFolder\(it\.id\)/)
})
test('Cinematics se adapta a panel estrecho, sin segunda interfaz ni cambios de formato',()=>{
 const panel=src('src/components/CinematicsPanel.vue')
 assert.match(panel,/container-type:inline-size/)
 assert.match(panel,/@container \(max-width:590px\)/)
 assert.match(src('src/core/editor/docking.js'),/anim: \['Cinematics'/)
 assert.match(src('src/core/project.js'),/DEFAULT_FOLDERS.*CINEMATICS_FOLDER/)
})
test('La nueva selección cinematográfica no sobrescribe el estado de Timeline ni de clips',()=>{
 const text=src('src/core/state/state.js')
 assert.match(text,/cinematicId\s*:/)
 assert.match(src('src/core/state/timelines.js'),/store\.cinematicId = null/)
 assert.match(src('src/core/state/animation.js'),/store\.animId/)
 assert.match(src('src/core/state/timelines.js'),/store\.timelineId/)
})
