// Paquete del juego: el contenedor propio del Runtime (un zip). Lo escribe el editor al exportar y lo lee el reproductor del juego.
// El Runtime no conoce ningún formato de proyecto del editor: este es su único formato de entrega, con su propia versión (`packageFormat`).
//
//   game.json            datos del juego (ajustes, base de datos, interfaces, scripts, shaders, prefabs, índice de escenas y de archivos…)
//   scenes/<id>.json     una escena: { objects, environment, terrain }. Solo las que se eligieron al exportar, en orden (la 1.ª es la inicial)
//   files/<id>           modelos, texturas, audio, fuentes… (binarios, por id)
import { FORMAT_VERSION, upgradeFormat } from '../format.js'
import { normalizeStreaming } from '../streaming/config.js'

export const PACKAGE_FORMAT = 1
const MAGIC = 'rt-package'

/** Campos de los datos del proyecto que el juego no necesita (son del editor). */
const EDITOR_ONLY = ['folders', 'createdAt', 'updatedAt', 'version', 'thumb', 'build', 'activeSceneId', 'objects', 'environment', 'terrain', 'theme_editor']

/**
 * Construye el paquete. Devuelve Uint8Array.
 * @param {object} o
 * @param o.data    datos del proyecto (meta, sin escena)
 * @param o.scenes  [{ id, name, data: { objects, environment, terrain } }] en el orden de arranque
 * @param o.files   Map(id → Uint8Array) de los recursos
 */
export async function writePackage({ data, scenes, files }) {
  if (!scenes?.length) throw new Error('El paquete necesita al menos una escena')
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const game = {}
  for (const k of Object.keys(data)) if (!EDITOR_ONLY.includes(k)) game[k] = data[k]
  game.scenes = scenes.map((s) => {
    const source = data.scenes?.find((entry) => entry.id === s.id)
    // El GameManager pertenece a la escena, no al estado del Editor: PlayMode lo necesita también en el paquete.
    const streaming = normalizeStreaming(source?.streaming, s.id)
    return { id: s.id, name: s.name,
      ...(streaming.enabled ? { streaming } : {}),
      ...(source?.gameManagerId ? { gameManagerId: source.gameManagerId } : {}),
      ...(source?.playerNodeId ? { playerNodeId: source.playerNodeId } : {}),
      ...(source?.playerSpawnMode === 'api' ? { playerSpawnMode: 'api' } : {}),
      ...(source?.transitions ? { transitions: source.transitions } : {}) }
  })
  game.game = { ...(data.game || {}), startScene: scenes[0].id }
  const used = new Set()
  for (const f of [...(game.models || []), ...(game.assets || [])]) used.add(f.id)
  game.models = (game.models || []).filter((m) => files.has(m.id))
  game.assets = (game.assets || []).filter((a) => files.has(a.id))
  zip.file('game.json', JSON.stringify({ format: MAGIC, packageFormat: PACKAGE_FORMAT, runtimeFormat: data.runtimeFormat ?? FORMAT_VERSION, ...game }))
  for (const s of scenes) zip.file(`scenes/${s.id}.json`, JSON.stringify(s.data))
  for (const [id, bytes] of files) if (used.has(id)) zip.file(`files/${id}`, bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), { binary: true })
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

/**
 * Abre un paquete. Lee `game.json` y deja las escenas y los archivos para pedirlos de uno en uno.
 * @returns {Promise<{ game: any, sceneIds: string[], scene: (id: string) => Promise<any>, file: (id: string) => Promise<Uint8Array|null>, report: any }>}
 */
export async function readPackage(bytes) {
  const { default: JSZip } = await import('jszip')
  let zip
  try { zip = await JSZip.loadAsync(bytes) } catch { throw new Error('El paquete del juego no es válido') }
  return readPackageEntries({
    async game() { return zip.file('game.json')?.async('string') },
    async scene(id) { return zip.file(`scenes/${id}.json`)?.async('string') },
    async file(id) { return zip.file(`files/${id}`)?.async('uint8array') },
  })
}

/** Mismo formato lógico desde archivos separados o desde el ZIP transportable. */
export async function readPackageEntries(entries) {
  const text = await entries.game()
  if (!text) throw new Error('Falta game.json en el paquete del juego')
  const raw = JSON.parse(text)
  if (raw.format !== MAGIC) throw new Error('Formato de paquete desconocido')
  if ((raw.packageFormat ?? 1) > PACKAGE_FORMAT) throw new Error('El paquete es de una versión más nueva que este reproductor')
  const { format, packageFormat, ...game } = raw
  const report = upgradeFormat(game) // por si el paquete es de un formato del Runtime anterior
  if (!game.scenes?.length) throw new Error('El paquete no tiene escenas')
  const sceneIds = game.scenes.map((s) => s.id)
  return {
    game, sceneIds, report,
    async scene(id) { const text = await entries.scene(id); return text ? JSON.parse(text) : null },
    async file(id) { const bytes = await entries.file(id); return bytes ? new Uint8Array(bytes) : null },
  }
}
