import { shallowRef } from 'vue'
import { loadingProgress, waitForLoadingPaint } from '../../engine/runtime/loading-progress.js'

export const projectLoading = shallowRef(null)
const phases = [
  ['project', 'Preparando el proyecto…'],
  ['terrain', 'Montando el terreno y el visor…'],
  ['models', 'Cargando modelos…'],
  ['finish', 'Preparando la escena y los paneles…'],
]

export async function withProjectLoading(name, work) {
  if (projectLoading.value) return false
  let status = null
  const publish = () => { if (status) projectLoading.value = { name, status } }
  const report = loadingProgress(phases, (state) => { status = state; publish() })
  const setName = (value) => { name = value }
  try {
    await report('project')
    const result = await work(report, setName)
    if (result !== false) {
      await report('finish', 1, 1)
      await waitForLoadingPaint()
    }
    return result
  } finally { projectLoading.value = null }
}
