// Fuente «Simulado»: un actor sintético que se mueve (sirve para probar la app y Century sin cámara ni build nativa).
import { useEffect, useRef } from 'react'
import { simulatedFrame } from './simframe.js'
export { simulatedFrame }
/** Llama a onPose(p) a ~30 fps mientras `active`. */
export function useSimulatedPose(active, onPose) {
  const cb = useRef(onPose); cb.current = onPose
  useEffect(() => {
    if (!active) return
    const t0 = Date.now()
    const id = setInterval(() => cb.current(simulatedFrame((Date.now() - t0) / 1000), null), 33)
    return () => clearInterval(id)
  }, [active])
}
