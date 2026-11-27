// La configuración anterior solo tenía `snap`. Sin valores nuevos conservamos ese comportamiento.
export const snapEnabled = (settings, mode) => {
  if (!settings) return false
  const key = { translate: 'moveSnapOn', rotate: 'rotateSnapOn', scale: 'scaleSnapOn' }[mode]
  return key ? (settings[key] ?? settings.snap ?? true) !== false : false
}
export const snapStep = (settings, mode) => {
  const step = Number(settings?.[{ translate: 'gridSize', rotate: 'rotSnap', scale: 'scaleSnap' }[mode]])
  return Number.isFinite(step) && step > 0 ? step : { translate: 1, rotate: 15, scale: 0.25 }[mode]
}


/** El redondeo incremental conserva el valor al cambiar de Snap a libre y viceversa. */
export const snapDelta = (delta, step) => Math.round(delta / step) * step
export const snapAbsolute = (value, step) => Math.round(value / step) * step

/** Los ejes excluidos conservan su valor al inicio del tramo. */
export const snapAxisValue = (raw, rawStart, outputStart, step, selected, absolute = false) => {
  const delta = raw - rawStart
  if (!selected || !Number.isFinite(delta) || Math.abs(delta) < 1e-10) return outputStart
  if (!(step > 0)) return outputStart + delta
  return absolute ? snapAbsolute(raw, step) : outputStart + snapDelta(delta, step)
}

// El tramo siguiente parte del último valor visible cuando cambia Shift/Snap.
// La operación conserva el mismo origen y no acumula errores al alternar.
export const snapModalValue = (m, kind, raw, step, enabled) => {
  const array = Array.isArray(raw)
  const input = array ? raw : [raw]
  let state = m.snapGesture
  if (!state || state.kind !== kind || state.raw.length !== input.length) {
    state = { kind, enabled, raw: Array(input.length).fill(0),
      anchorRaw: Array(input.length).fill(0), anchorOut: Array(input.length).fill(0),
      output: Array(input.length).fill(0) }
    m.snapGesture = state
  }
  if (state.enabled !== enabled) {
    state.enabled = enabled
    state.anchorRaw = [...state.raw]
    state.anchorOut = [...state.output]
  }
  state.raw = [...input]
  state.output = input.map((v, i) => {
    const delta = v - state.anchorRaw[i]
    return state.anchorOut[i] + (enabled && step > 0 ? Math.round(delta / step) * step : delta)
  })
  return array ? state.output : state.output[0]
}

