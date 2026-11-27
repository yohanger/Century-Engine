// Shaders GLSL y grafos de shader (Assets/Shaders).
import { uid } from '../../engine/runtime/util.js'
import { addFolderChain, uniqueFileName, normFolder } from '../project.js'
import { store } from './state.js'
import { markDirty, commit } from './history.js'
import { SHADER_TEMPLATE } from '../../engine/runtime/render/shaderlib.js'
import { newGraph, sampleGraph, compileGraph } from '../shadergraph/compile.js'

// Solo contexto e historial de edición; el documento sigue en project.shaders.
const graphSessions = new WeakMap()
export function shaderGraphSessions(project = store.project) {
  if (!graphSessions.has(project)) graphSessions.set(project, new Map())
  return graphSessions.get(project)
}

// ---------- shaders GLSL (Assets/Shaders) ----------

export function dropShader(id) {
  const p = store.project
  p.shaders = p.shaders.filter((c) => c.id !== id)
  if (p.render?.shader === id) p.render.shader = ''
  for (const profile of p.profiles || []) if (profile.fx?.shader?.postShader === id) profile.fx.shader.postShader = ''
  if (store.shaderEditId === id) closeShaderEditor()
  store.editor?.refreshMaterials?.()
  store.editor?.vp?.setShaderGraphDocs?.(p.shaders)
}
export function createShader(folder = 'Assets/Shaders', name = 'material.glsl', code = SHADER_TEMPLATE) {
  const p = store.project
  const dest = normFolder(folder)
  const file = uniqueFileName(p, dest, name)
  const d = { id: uid('sh'), name: file, folder: dest, code }
  p.shaders.push(d)
  addFolderChain(p, dest)
  commit('Nuevo shader')
  return d
}
export function createShaderGraph(folder = 'Assets/Shaders', name = 'graph.glsl', sample = false, target = 'material') {
  const g = sample && target === 'material' ? sampleGraph() : newGraph(target)
  const r = compileGraph(g, name.replace(/\.glsl$/, ''))
  const d = createShader(folder, name, r.code)
  d.graph = g
  markDirty()
  return d
}
/** Guarda el grafo de un shader y regenera su GLSL. Devuelve los errores del compilador. */
export function setShaderGraph(id, graph) {
  const c = store.project.shaders.find((x) => x.id === id)
  if (!c) return []
  const r = compileGraph(graph, c.name.replace(/\.glsl$/, ''))
  c.graph = r.graph
  c.code = r.code
  markDirty()
  store.editor?.refreshMaterials?.()
  store.editor?.vp?.setShaderGraphDocs?.(store.project.shaders)
  return r.errors
}
export function openShaderEditor(id) {
  if (!store.project.shaders.some((c) => c.id === id)) return
  store.shaderEditId = id
  store.ui.shaderWorkspace = true
  const graph = store.project.shaders.find((c) => c.id === id)?.graph
  store.modal = graph && store.prefs.shaderGraphDocked ? null : 'shader'
}
export function closeShaderEditor() { store.shaderEditId = null; store.ui.shaderWorkspace = false; if (store.modal === 'shader') store.modal = null }
export function toggleShaderGraphDock() {
  store.prefs.shaderGraphDocked = !store.prefs.shaderGraphDocked
  store.ui.shaderWorkspace = true
  store.modal = store.prefs.shaderGraphDocked ? null : 'shader'
}
export function setShaderCode(id, code) {
  const c = store.project.shaders.find((x) => x.id === id)
  if (!c || c.code === code) return
  c.code = code
  markDirty()
  store.editor?.refreshMaterials?.()
}

