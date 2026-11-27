import { withTemporaryHidden, withTemporarilyVisible } from '../../engine/runtime/render/temporary-visibility.js'

export function isLocalMeshShortcut(event) {
  return !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing &&
    (event.key === '/' || event.code === 'NumpadDivide')
}

/** Conserva la cadena de transformaciones y oculta sus ramas hermanas, no sus descendientes editables. */
export function localMeshBranches(scene, visual, lights = []) {
  const path = []
  for (let node = visual; node && node !== scene; node = node.parent) path.push(node)
  if (!path.length || path.at(-1).parent !== scene) return null
  const keep = new Set(lights)
  const hidden = []
  for (const node of path) {
    for (const sibling of node.parent.children) {
      if (sibling !== node && !keep.has(sibling)) hidden.push(sibling)
    }
  }
  return { hidden, revealed: [...path, ...lights] }
}

export function drawLocalMesh(vp, visual, background) {
  const { scene, renderer, camera, hemi, editorSun } = vp
  const lights = [hemi, editorSun].filter(light => light?.parent === scene)
  const mask = localMeshBranches(scene, visual, lights)
  if (!mask) return false
  const saved = { background: scene.background, fog: scene.fog, target: renderer.getRenderTarget(),
    autoClear: renderer.autoClear, shadows: renderer.shadowMap.enabled }
  const intensities = lights.map(light => light.intensity)
  try {
    scene.background = background
    scene.fog = null
    renderer.setRenderTarget(null)
    renderer.autoClear = true
    renderer.shadowMap.enabled = false
    for (const light of lights) light.intensity = light === hemi ? 0.9 : 2.0
    withTemporaryHidden(mask.hidden, () => withTemporarilyVisible(mask.revealed, () => renderer.render(scene, camera)))
    return true
  } finally {
    scene.background = saved.background
    scene.fog = saved.fog
    renderer.autoClear = saved.autoClear
    renderer.shadowMap.enabled = saved.shadows
    renderer.setRenderTarget(saved.target)
    lights.forEach((light, index) => { light.intensity = intensities[index] })
  }
}
