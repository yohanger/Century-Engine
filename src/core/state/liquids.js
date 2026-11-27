// Recursos .liquid compartidos: el proyecto almacena perfiles; el estado dinámico vive en WaterWorld.
import { uid } from '../../engine/runtime/util.js'
import { normalizeLiquid } from '../../engine/runtime/geometry/liquid-containers.js'
import { addFolderChain, normFolder, uniqueFileName } from '../project.js'
import { store } from './state.js'
import { commit } from './history.js'

export const findLiquid=(id)=>store.project?.liquids?.find((l)=>l.id===id)||null
export function createLiquid(folder='Assets/Liquids',name='Líquido.liquid') {
  if(!store.project || store.locked) return null
  const p=store.project, dest=normFolder(folder),file=uniqueFileName(p,dest,name.endsWith('.liquid')?name:name+'.liquid')
  const l=normalizeLiquid({id:uid('li'),name:file,folder:dest},{resource:true})
  p.liquids ||= [];p.liquids.push(l);addFolderChain(p,dest);commit('Crear líquido');return l
}
export function updateLiquid(id,patch) {
  const l=findLiquid(id);if(!l||store.locked)return false
  if(Object.keys(patch).some((k)=>['id','name','folder'].includes(k)))throw new Error('Usa el CRUD de Assets para renombrar')
  const updated=normalizeLiquid({...l,...patch},{resource:true})
  Object.assign(l,updated);commit(`Editar líquido ${l.name}`);return true
}
export function openLiquidEditor(id) {
  if(!findLiquid(id)||store.locked)return false
  store.projSel={kind:'liquid',id};store.prefs.rightTab='object';store.prefs.rightOpen=true;return true
}
