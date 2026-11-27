// Nether Film Maker · guardar archivos según dónde corre: en el APK (Capacitor) se escribe en Documentos y se abre el menú de
// compartir del móvil (para pasarlo al PC por cable, Drive, etc.); en el PC y el navegador, descarga normal.
import { downloadBlob } from '../engine/runtime/util.js'

export const isNative = () => !!window.Capacitor?.isNativePlatform?.()
const toB64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s) }

/** Guarda `bytes` como `name`. Devuelve dónde quedó (texto para el aviso). */
export async function saveBytes(bytes, name, mime = 'application/octet-stream') {
  if (isNative()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const r = await Filesystem.writeFile({ path: `NetherFilmMaker/${name}`, data: toB64(bytes), directory: Directory.Documents, recursive: true })
    try { await Share.share({ title: name, files: [r.uri], dialogTitle: 'Enviar la película' }) } catch { /* el usuario cerró el menú */ }
    return `Documentos/NetherFilmMaker/${name}`
  }
  downloadBlob(new Blob([bytes], { type: mime }), name)
  return name
}
