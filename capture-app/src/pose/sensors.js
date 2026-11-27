// Orientación del móvil para la cámara virtual (expo-sensors · DeviceMotion: alpha/beta/gamma en radianes, como W3C).
import { useEffect, useRef } from 'react'
import { DeviceMotion } from 'expo-sensors'
import { cameraFromDeviceAngles, relativeTo } from '../core/camera.js'

const D = 180 / Math.PI
/** Devuelve una ref con la última orientación { pitch, yaw, roll } (grados) y una función para tomar la referencia (yaw 0). */
export function useDeviceCamera(active = true, hz = 30) {
  const last = useRef(null), ref = useRef(null), avail = useRef(true)
  useEffect(() => {
    if (!active) return
    let sub = null, alive = true
    DeviceMotion.isAvailableAsync().then((ok) => {
      avail.current = ok
      if (!ok || !alive) return
      try {
        DeviceMotion.setUpdateInterval(Math.round(1000 / hz))
        sub = DeviceMotion.addListener((m) => {
          const r = m.rotation; if (!r) return
          last.current = cameraFromDeviceAngles((r.alpha || 0) * D, (r.beta || 0) * D, (r.gamma || 0) * D)
        })
      } catch { avail.current = false } // p. ej. navegador sin sensores
    }).catch(() => { avail.current = false })
    return () => { alive = false; sub?.remove() }
  }, [active, hz])
  return {
    available: () => avail.current,
    /** Fija «hacia delante» = hacia donde apunta ahora el móvil. */
    zero: () => { ref.current = last.current },
    /** [pitch, yaw, roll] relativos a la referencia, o null si aún no hay datos. */
    read: () => (last.current ? relativeTo(last.current, ref.current || last.current) : null),
  }
}
