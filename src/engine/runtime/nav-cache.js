// Mapas de navegación horneados (Assets/Navigation): se decodifican a navCache y la escena se resincroniza.
import { navCache } from './nav/world.js'
import { NavGrid } from './nav/grid.js'

/** Decodifica un mapa de navegación (con caché). `host.assetData(id)` da los bytes. */
export async function navGrid(host, assetId) {
  if (!assetId) return null
  if (navCache.has(assetId)) return navCache.get(assetId)
  const d = await host.assetData(assetId); if (!d) return null
  try { const g = NavGrid.decode(new Uint8Array(d.bytes)); navCache.set(assetId, g); return g } catch (e) { console.warn('Mapa de navegación ilegible', e); return null }
}

/** Decodifica los mapas de navegación de la escena activa y, si hubo alguno, vuelve a sincronizar los nodos. */
export async function loadNavCache(scene) {
  const p = scene.host.project; if (!p) return
  let n = 0
  for (const o of p.objects) if (o.type === 'navigation' && o.props.asset && await navGrid(scene.host, o.props.asset)) n++
  if (n) scene.syncAll()
}
