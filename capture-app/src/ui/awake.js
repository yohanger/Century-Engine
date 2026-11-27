// Mantiene la pantalla encendida mientras se graba o edita (en el navegador puede no estar permitido: se ignora).
import { useEffect } from 'react'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
export function useAwake() {
  useEffect(() => {
    activateKeepAwakeAsync('lfcap').catch(() => {})
    return () => { try { Promise.resolve(deactivateKeepAwake('lfcap')).catch(() => {}) } catch {} }
  }, [])
}
