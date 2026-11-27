// Recursos históricos de animación de gameplay. Se conserva el modelo para el runtime,
// pero no existe otro editor cinematográfico ni una ruta de autoría desde Assets.
import { uid } from '../../engine/runtime/util.js'
import { store, clearTemporal } from './state.js'
import { commit } from './history.js'
import { newClip, sampleClip, normalizeClip } from '../../engine/runtime/anim/model.js'

function uniqueName(items, base) {
  const names = new Set(items.map(item => item.name.toLowerCase()))
  let name = base
  for (let i = 2; names.has(name.toLowerCase()); i++) name = `${base} ${i}`
  return name
}
export function createAnimation(name = 'Animación', sample = false) {
  const p = store.project
  p.animations ||= []
  name = uniqueName(p.animations, name)
  const c = sample ? sampleClip(name) : newClip(name)
  p.animations.push(c)
  commit('Nueva animación')
  return c
}
export function duplicateAnimation(id) {
  const p = store.project, src = (p.animations || []).find((c) => c.id === id); if (!src) return null
  const c = normalizeClip(JSON.parse(JSON.stringify(src)))
  c.id = uid('an'); c.name = uniqueName(p.animations, src.name + ' (copia)')
  for (const tr of c.tracks) { tr.id = uid('tr'); for (const k of tr.keys) k.id = uid('k') }
  for (const e of c.events) e.id = uid('ev')
  p.animations.push(c); commit('Duplicar animación'); return c
}
export function deleteAnimation(id) {
  const p = store.project
  if (!(p.animations || []).some(c => c.id === id)) return false
  p.animations = (p.animations || []).filter((c) => c.id !== id)
  if (store.animId === id) store.animId = null
  clearTemporal('animation', id)
  if (store.projSel?.kind === 'animation' && store.projSel.id === id) store.projSel = null
  commit('Eliminar animación')
  return true
}
export function openThemeEditor() { store.modal = 'theme' }

