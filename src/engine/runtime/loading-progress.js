export function waitForLoadingPaint() {
  if (typeof requestAnimationFrame !== 'function') return Promise.resolve()
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

/** Presentación breve de la marca, independiente del progreso de E/S. */
export function beginBrandSplash(onVisibility) {
  onVisibility(true)
  let finish
  const done = new Promise((resolve) => {
    let timer = setTimeout(() => finish(), 850)
    finish = () => {
      if (timer === null) return
      clearTimeout(timer)
      timer = null
      onVisibility(false)
      resolve()
    }
  })
  return { done, finish }
}

/** Progreso por fases completadas. Una fase con trabajo contado puede avanzar por unidad. */
export function loadingProgress(phases, publish) {
  let current = -1, percent = 0
  return async (key, done = 0, total = 0) => {
    const index = phases.findIndex(([id]) => id === key)
    if (index < 0 || index < current) return
    const changed = index !== current
    current = index
    const fraction = total > 0 ? Math.max(0, Math.min(1, done / total)) : 0
    percent = Math.max(percent, Math.floor(100 * (index + fraction) / phases.length))
    publish({ phase: phases[index][1], percent, step: index + 1, steps: phases.length, done, total })
    if (changed) await waitForLoadingPaint()
  }
}
