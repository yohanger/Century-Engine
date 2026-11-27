// Monta el componente original y utiliza recursos, persistencia y compilador reales.
import { createApp } from 'vue'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '../../src/styles.css'
import { store } from '../../src/core/state/state.js'
import { createProjectData } from '../../src/core/project.js'
import { putAsset } from '../../src/core/db.js'
import { newGraph, sampleGraph, newNode, newProp, compileGraph } from '../../src/core/shadergraph/compile.js'
import ShaderGraphEditor from '../../src/components/ShaderGraphEditor.vue'

// Reutilizable por QA integrado; importar este módulo desde App no monta otra instancia.
export async function installVisualGraph(project, target = 'material') {
  const id = 'shader-qa-' + target
  const graph = target === 'post' ? newGraph('post') : { target: 'material', props: [], nodes: [], edges: [] }
  if (target === 'material') {
    const prop = newProp('texture', 'Albedo'); graph.props.push(prop)
    const texture = newNode('texture', 20, 20, { params: { prop: prop.id } })
    const uv = newNode('tilingOffset', 20, 290, { v: { tile: [3, 3] } })
    const tint = newNode('color', 305, 250, { params: { v: '#c8b9a2' } })
    const multiply = newNode('mul', 305, 30)
    const roughness = newNode('float', 305, 430, { params: { v: 0.65 } })
    const output = newNode('surface', 600, 100)
    graph.nodes.push(texture, uv, tint, multiply, roughness, output)
    const edge = (a, k, b, input) => graph.edges.push({ id: 'qa-' + graph.edges.length, from: [a.id, k], to: [b.id, input] })
    edge(texture, 'rgb', multiply, 'a'); edge(tint, 'out', multiply, 'b'); edge(multiply, 'out', output, 'albedo')
    edge(uv, 'out', texture, 'uv'); edge(roughness, 'out', output, 'roughness')
    const bytes = await (await fetch(new URL('./shader-graph-assets/stone.png', import.meta.url))).arrayBuffer()
    const assetId = 'shader-qa-stone'
    await putAsset(project.id, assetId, 'stone.png', bytes)
    project.assets = project.assets.filter((a) => a.id !== assetId)
    project.assets.push({ id: assetId, name: 'stone.png', folder: 'Assets/Textures', kind: 'texture', ext: 'png', bytes: bytes.byteLength })
    project.materials = project.materials.filter((m) => m.id !== 'shader-qa-stone-material')
    project.materials.push({ id: 'shader-qa-stone-material', name: 'Stone_Study.material', folder: 'Assets/Materials', color: '#ffffff', roughness: 1, metallic: 0, opacity: 1,
      mat: { shader: id, mapping: 'object', params: { uAlbedo: assetId } } })
  }
  const shader = { id, folder: 'Assets/Shaders', name: target === 'post' ? 'Post_Study.glsl' : 'Stone_Study.glsl', graph, code: compileGraph(graph, 'Visual QA').code }
  project.shaders = project.shaders.filter((s) => s.id !== id); project.shaders.push(shader)
  return shader
}

if (location.pathname.endsWith('/shader-graph-visual.html')) {
  const target = new URLSearchParams(location.search).get('target') || 'material'
  store.project = createProjectData('QA Shader Graph')
  const shader = await installVisualGraph(store.project, target)
  if (new URLSearchParams(location.search).has('sample')) { shader.graph = sampleGraph(); shader.code = compileGraph(shader.graph).code }
  store.shaderEditId = shader.id; store.prefs.shaderGraphDocked = false
  store.editor = { refreshMaterials() {}, serializeTerrain() { return store.project.terrain }, thumbnail() { return undefined } }
  createApp(ShaderGraphEditor).mount('#app')
  window.__lfVisualReady = true
  window.__lfVisual = { store }
}
