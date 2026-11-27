import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { timelineReferences, filmMakerSource, newTimeline, isFilmMakerTimeline } from '../src/core/timeline/model.js'
import { DOCK_PANELS, defaultDockLayout, normalizeDockLayout, findDockPanel } from '../src/core/editor/docking.js'
const src = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const projectPanel = src('src/components/ProjectPanel.vue')
const timelineState = src('src/core/state/timelines.js')
const filesystem = src('src/core/state/filesystem.js')

function deletionHarness({ resources = [{ id: 'tl-1', name: 'Intro' }, { id: 'tl-2', name: 'Montaje' }], selected = null } = {}) {
  const store = { project: { timelines: resources.map(r => ({ ...r })), id: 'p1' }, timelineId: 'tl-1', cinematicId: 'tl-2', projSel: selected || { kind: 'cinematic', id: 'tl-2' }, temporalSelection: { kind: 'timeline', resourceId: 'tl-1' }, temporalSeek: { kind: 'timeline', resourceId: 'tl-1' } }
  const snapshots = [], cleared = []
  const code = timelineState.slice(timelineState.indexOf('export function deleteTimelines('), timelineState.indexOf('export const deleteTimeline'))
  const context = vm.createContext({ store, commit: label => snapshots.push({ label, ids: store.project.timelines.map(t => t.id) }), clearTemporal: (...args) => { cleared.push(args); store.temporalSelection = null } })
  vm.runInContext(code.replace('export function', 'function') + '\nglobalThis.callDelete = deleteTimelines', context)
  return { store, snapshots, cleared, delete: ids => context.callDelete(ids) }
}
function assetHarness({ found = [], confirm = true, usageError = null, selection = [{ kind: 'timeline', id: 't1', name: 'Timeline QA', embedded: true }] } = {}) {
  const project = { id: 'P1', timelines: [{ id: 't1' }], animations: [] }
  const store = { project, play: { on: false } }
  const actions = [], messages = []
  const ctx = vm.createContext({
    store, ROOT_FOLDER: 'Assets',
    selectedItems: () => selection, nested: items => items,
    isCinematicsFolder: path => path === 'Assets/Cinematics', isSystemUiPath: () => false, isSystemUi: () => false,
    inside: () => false, allEntries: () => [],
    findTimelineUsage: async id => { actions.push('scan:'+id); if (usageError) throw usageError; return found },
    askConfirm: async text => { messages.push(text); if (confirm === 'switch') { store.project = { id: 'P2' }; return true } return confirm },
    deleteTimelines: ids => { actions.push('delete:'+ids.join(','));store.project.timelines = [];return true },
    deleteAnimation: () => { actions.push('delete-animation');return true },
    removeEntry: async(kind,id) => { actions.push('remove:'+kind+':'+id);return true },
    deleteFolder: async () => { actions.push('remove-folder');return true },
    setSel: value => { actions.push('selection:'+value.length) },
    toast: message => { messages.push(message) },
  })
  const block = projectPanel.slice(projectPanel.indexOf('// Los recursos temporales'), projectPanel.indexOf('async function duplicate('))
  vm.runInContext(block + '\nglobalThis.doRemove = remove', ctx)
  return { store, actions, messages, remove: () => ctx.doRemove(selection) }
}

test('Referencias explícitas por nombre e ID se detectan en comandos anidados', () => {
  const data = [{ props: { pages: [{ cmds: [{ kind: 'timeline', params: { timeline: 'Intro' } }, { timelineId: 't1' }] }] } }]
  const found = timelineReferences(data, { id: 't1', name: 'Intro' }, 'Escena Principal')
  assert.equal(found.length, 2)
  assert.ok(found.every(p => p.includes('Escena Principal')))
})
test('No se infieren referencias por coincidencias de nombres o cadenas de scripts', () => {
  assert.deepEqual(timelineReferences({ name: 'Intro', code: 'game.timeline.play("Intro")', other: { id: 't1' } }, { id: 't1', name: 'Intro' }), [])
})
test('Escáner soporta referencias cíclicas sin bloquear el editor', () => {
  const obj = { timeline: 'Intro' };obj.me = obj
  assert.equal(timelineReferences(obj, { id: 't1', name: 'Intro' }).length, 1)
})
test('Eliminación de varios timelines hace un único commit y no toca otros recursos', () => {
  const h = deletionHarness({ resources: [{ id:'tl-1',name:'Uno'},{ id:'tl-2',name:'Dos'},{ id:'tl-3',name:'Tres'}] })
  assert.equal(h.delete(['tl-1','tl-2']),true)
  assert.deepEqual(h.store.project.timelines.map(t=>t.id), ['tl-3'])
  assert.equal(h.snapshots.length,1)
  assert.equal(h.store.timelineId,null)
  assert.equal(h.store.cinematicId,null)
  assert.equal(h.store.temporalSelection,null)
  assert.equal(h.store.temporalSeek,null)
  assert.equal(h.store.projSel,null)
})
test('Eliminar un ID inexistente no genera entrada de historial', () => {
  const h=deletionHarness();assert.equal(h.delete(['no-existe']),false);assert.equal(h.snapshots.length,0)
})
test('La selección Cinematics se invalida aun si no pertenece al editor Timeline', () => {
  const h=deletionHarness({selected:{kind:'cinematic',id:'tl-2'}})
  assert.equal(h.delete(['tl-2']),true);assert.equal(h.store.cinematicId,null);assert.equal(h.store.projSel,null)
})
test('Menú de Assets habilita Eliminar para embedded temporal, no mover/renombrar/exportar', () => {
  assert.match(projectPanel, /disabled: !canRemove\(list\) \|\| rootSel/)
  assert.match(projectPanel, /disabled: embedded \|\| !one/)
  assert.match(projectPanel, /disabled: embedded \|\| rootSel/)
  assert.match(projectPanel, /const deletableEmbedded = .*\['timeline', 'cinematic', 'animation'\]/)
})
test('Borrado en Assets escanea referencias y advierte antes de confirmar', async () => {
  const h=assetHarness({found:['Escena Casa / Evento.timeline']})
  await h.remove()
  assert.deepEqual(h.actions,['scan:t1','delete:t1','selection:0'])
  assert.match(h.messages[0],/Escena Casa/)
  assert.match(h.messages[0],/dinámicamente/)
})
test('Cancelar el diálogo no borra recursos ni selección', async () => {
  const h=assetHarness({confirm:false});await h.remove()
  assert.deepEqual(h.actions,['scan:t1'])
  assert.equal(h.store.project.timelines.length,1)
})
test('Error al leer escena externa bloquea borrado antes de dialogar', async () => {
  const h=assetHarness({usageError:new Error('Escena sin datos')});await h.remove()
  assert.deepEqual(h.actions,['scan:t1'])
  assert.match(h.messages[0],/No se pudo comprobar/)
})
test('Cambio de proyecto durante confirmación impide borrar en otro proyecto', async () => {
  const h=assetHarness({confirm:'switch'});await h.remove()
  assert.deepEqual(h.actions,['scan:t1'])
  assert.equal(h.store.project.id,'P2')
})
test('Selección mixta de Timeline y Cinematics se elimina mediante IDs en lote', async () => {
  const h=assetHarness({selection:[{kind:'timeline',id:'t1',name:'Uno',embedded:true},{kind:'cinematic',id:'t2',name:'Dos',embedded:true}]})
  await h.remove();assert.deepEqual(h.actions,['scan:t1','scan:t2','delete:t1,t2','selection:0'])
})
test('La carpeta virtual Assets/Cinematics y la raíz no se borran mediante selección', async () => {
  const h=assetHarness({selection:[{kind:'folder',id:'Assets/Cinematics',name:'Cinematics'},{kind:'folder',id:'Assets',name:'Assets'}]})
  await h.remove();assert.deepEqual(h.actions,[])
})
test('La tecla Supr utiliza el mismo borrado protegido por diálogo', () => {
  assert.match(projectPanel, /e\.key === 'Delete'.*remove\(list\)/)
  assert.match(projectPanel, /const useWarning = found\.length/)
})
test('No elimina source NFM, capturas u otros clips cuando se borra película',()=>{
  assert.match(filesystem,/if \(kind === 'timeline' \|\| kind === 'cinematic'\) return deleteTimeline\(id\)/)
  assert.match(timelineState,/p\.timelines = p\.timelines\.filter/)
  assert.doesNotMatch(timelineState.slice(timelineState.indexOf('export function deleteTimelines')), /p\.(?:animations|captures|assets|models)\s*=/)
})
test('Sin editor histórico: Cinematics continúa solo para FilmMaker',()=>{
  assert.equal(existsSync(new URL('../src/components/AnimationPanel.vue',import.meta.url)),false)
  assert.doesNotMatch(src('src/components/BottomDock.vue'),/AnimationPanel|active\(\) === 'clips'/)
  assert.doesNotMatch(src('src/components/ProjectPanel.vue'),/openAnimationEditor|Clip de animación.*run:/)
  assert.equal(DOCK_PANELS.clips,undefined)
  assert.equal(findDockPanel(normalizeDockLayout(defaultDockLayout()),'clips'),null)
  assert.equal(DOCK_PANELS.anim[0],'Cinematics')
})
test('La procedencia FilmMaker no se reasigna por nombre en el borrado',()=>{
 const marker=filmMakerSource({id:'f',name:'Film',scene:{id:'sc'}},'montage','f')
 assert.equal(isFilmMakerTimeline(newTimeline('A',{filmMaker:marker})),true)
 assert.equal(isFilmMakerTimeline(newTimeline('Film')),false)
})
test('Eliminar clips heredados exige confirmación adicional; no se retira su runtime',async()=>{
 const h=assetHarness({selection:[{kind:'animation',id:'an-1',name:'Gameplay',embedded:true}]})
 await h.remove()
 assert.ok(h.messages[0].includes('CameraShake'))
 assert.deepEqual(h.actions,['delete-animation','selection:0'])
 assert.match(src('src/engine/runtime/events/play-anim.js'),/animations|Anim/)
})
test('Sintaxis de Vue y estado modificado sin errores de parser JS',()=>{
 const paths=['src/components/ProjectPanel.vue','src/components/BottomDock.vue','src/components/Inspector.vue','src/components/InspectorDock.vue','src/core/state/state.js','src/core/state/timelines.js','src/core/state/filesystem.js','src/core/state/animation.js']
 const dir=mkdtempSync(join(tmpdir(),'lf-s05-g003-'))
 try{for(const path of paths){const data=src(path);const script=path.endsWith('.vue')?data.match(/<script setup>([\s\S]*?)<\/script>/)?.[1]:data;assert.ok(script,path);const f=join(dir,path.split('/').at(-1)+'.mjs');writeFileSync(f,script);const result=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});assert.equal(result.status,0,`${path}: ${result.stderr}`)}}finally{rmSync(dir,{recursive:true,force:true})}
})
