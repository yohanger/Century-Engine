import { finiteVector, finiteQuaternion } from '../../engine/runtime/numeric-integrity.js'
import { VIEW_MODES } from '../../engine/runtime/render/view-diagnostics-contract.js'

export const DEFAULT_EDITOR_VIEW = Object.freeze({ renderMethod: '', mode: 'lit', grid: true, wireframe: false, lights: true, terrain: true, foliage: true, fx: true, weather: true, bake: true, perf: false })
const modes = new Set(VIEW_MODES.map(v => v.id))
const axes = new Set(['horizontal', 'vertical'])
const positive = n => Number.isFinite(n) && n > 0
const vector = v => ({ x: v.x, y: v.y, z: v.z })
const own = (o, k) => o && Object.hasOwn(o, k)
const entries = o => o && typeof o === 'object' && !Array.isArray(o) ? Object.entries(o) : []
const bools = o => Object.fromEntries(entries(o).filter(([,v]) => typeof v === 'boolean'))
const ids = a => Array.isArray(a) ? [...new Set(a.filter(v => typeof v === 'string' && v.length))] : []
export function encodeCameraView(s) {
  if (!s || !finiteVector(s.target) || typeof s.isOrtho !== 'boolean' || !positive(s.orthoH) ||
      !Number.isFinite(s.minPolarAngle) || !Number.isFinite(s.maxPolarAngle) || s.minPolarAngle < 0 || s.maxPolarAngle > Math.PI || s.minPolarAngle > s.maxPolarAngle) return null
  const pose = p => {
    if (!p || !finiteVector(p.pos) || !finiteQuaternion(p.quat) || !positive(p.zoom)) return null
    const q = p.quat, norm = Math.hypot(q.x,q.y,q.z,q.w)
    if (Math.abs(norm - 1) > 1e-4) return null
    if (p.fov != null && (!positive(p.fov) || p.fov >= 180)) return null
    if (p.fovSpec != null && (!axes.has(p.fovSpec.axis) || !positive(p.fovSpec.value) || p.fovSpec.value >= 180)) return null
    return { pos: vector(p.pos), quat: {...vector(q), w:q.w}, zoom:p.zoom, ...(p.fov != null ? { fov:p.fov } : {}), fovSpec:p.fovSpec ? {value:p.fovSpec.value, axis:p.fovSpec.axis} : null }
  }
  const persp=pose(s.persp), ortho=pose(s.ortho)
  if (!persp || !ortho || !positive(persp.fov)) return null
  const active=s.isOrtho ? ortho : persp
  const distance=Math.hypot(active.pos.x-s.target.x,active.pos.y-s.target.y,active.pos.z-s.target.z)
  if (!positive(distance)) return null
  return {isOrtho:s.isOrtho,currentView:['top','bottom','front','back','right','left'].includes(s.currentView)?s.currentView:null,target:vector(s.target),persp,ortho,orthoH:s.orthoH,minPolarAngle:s.minPolarAngle,maxPolarAngle:s.maxPolarAngle}
}
export function setWorkspaceTreeOpen(state, node, open) { if (node) state.treeState.open = { ...state.treeState.open, [node.id]: !!open } }
export const mergeEditorSettings = state => ({ ...state.project?.settings, ...state.editorSnap })
export const SNAP_KEYS = ['snap','moveSnapOn','rotateSnapOn','scaleSnapOn','gridSize','rotSnap','scaleSnap']
export function normalizeEditorSnap(raw) {
  const out={}
  for (const k of SNAP_KEYS) if (own(raw,k) && (k.endsWith('On') || k==='snap' ? typeof raw[k]==='boolean' : positive(raw[k]))) out[k]=raw[k]
  if (own(out,'moveSnapOn')) out.snap=out.moveSnapOn
  else if (own(out,'snap')) out.moveSnapOn=out.snap
  return out
}
export function normalizeSceneWorkspace(s) {
  return {camera:encodeCameraView(s?.camera), selectedIds:ids(s?.selectedIds), selectedId:typeof s?.selectedId==='string'?s.selectedId:null, sceneSel:s?.sceneSel===true,
    tree:{open:bools(s?.tree?.open),rootOpen:s?.tree?.rootOpen!==false,scroll:Number.isFinite(s?.tree?.scroll)&&s.tree.scroll>=0?s.tree.scroll:0}, mode:modes.has(s?.mode)?s.mode:'lit'}
}
export function normalizeWorkspace(raw) {
  const view={...DEFAULT_EDITOR_VIEW}
  for (const k of Object.keys(view)) if (typeof view[k]==='boolean' && typeof raw?.view?.[k]==='boolean') view[k]=raw.view[k]
  if (['','forward','mobile','compat'].includes(raw?.view?.renderMethod)) view.renderMethod=raw.view.renderMethod
  return {version:1,activeSceneId:typeof raw?.activeSceneId==='string'?raw.activeSceneId:null,tabs:Array.isArray(raw?.tabs)?ids(raw.tabs):null,
    gizmo:['translate','rotate','scale','universal','none'].includes(raw?.gizmo)?raw.gizmo:'translate',space:raw?.space==='local'?'local':'world',snap:normalizeEditorSnap(raw?.snap),view,
    aids:{...bools(raw?.aids),gizmoCategories:bools(raw?.aids?.gizmoCategories)},folder:typeof raw?.folder==='string'?raw.folder:'Assets',scenes:Object.fromEntries(entries(raw?.scenes).map(([id,s])=>[id,normalizeSceneWorkspace(s)]))}
}
export function workspaceSelection(s, objects) {
  const map=new Map(objects.map(o=>[o.id,o]))
  const available=id=>map.has(id)&&!map.get(id).sceneInstanceOwner
  const selectedIds=ids(s?.selectedIds).filter(available)
  const selectedId=selectedIds.includes(s?.selectedId)?s.selectedId:selectedIds.at(-1)??null
  return {selectedIds,selectedId,sceneSel:!selectedId&&s?.sceneSel===true}
}
export function workspaceTabs(saved, scenes, active) {
  const valid=new Set(scenes.map(s=>s.id))
  const tabs=(saved===null?Array.from(valid):ids(saved)).filter(id=>valid.has(id))
  if (valid.has(active)&&!tabs.includes(active)) tabs.push(active)
  return tabs
}
export const workspaceKey = id => 'levelforge:workspace:v1:'+encodeURIComponent(id)
export class EditorWorkspaceState {
  constructor(storage) { this.storage=storage; this.last=new Map() }
  read(id) {
    try { const text=this.storage.getItem(workspaceKey(id)); if (!text) return null; const raw=JSON.parse(text); if (raw?.version!==1) return null; this.last.set(id,text); return normalizeWorkspace(raw) }
    catch (error) { console.warn('No se pudo leer el espacio de trabajo editorial',id,error); return null }
  }
  write(id,state) {
    try { const text=JSON.stringify(normalizeWorkspace(state)); if (this.last.get(id)===text) return false; this.storage.setItem(workspaceKey(id),text); this.last.set(id,text); return true }
    catch (error) { console.warn('No se pudo guardar el espacio de trabajo editorial',id,error); return false }
  }
  forget(id) { try { this.storage.removeItem(workspaceKey(id)); this.last.delete(id) } catch(error) { console.warn('No se pudo eliminar el espacio de trabajo editorial',id,error) } }
}
