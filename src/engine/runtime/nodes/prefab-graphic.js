// Gráfico «Prefab» de una página de evento: dibuja una copia del prefab (mallas, modelos, luces, partículas…) dentro del evento,
// como al instanciar una escena hija. Es la forma de reutilizar un conjunto sin duplicar datos: una «Farola» (poste + luz)
// en la página 1 y una «Farola rota» en la página 2; al cambiar la página cambia todo el conjunto.
//
// Solo lo visual: los eventos, triggers, spawns, cámaras y Canvas que haya dentro del prefab no se ejecutan desde aquí (para eso,
// coloca el prefab en la escena como instancia). Las luces sí iluminan. Con «Sólido» las mallas del prefab chocan con el jugador.
import * as THREE from 'three'
import { getDef } from './registry.js'

const SKIP = new Set(['event', 'trigger', 'atmovolume', 'postvolume', 'spawn', 'camera', 'canvas', 'player'])

/**
 * Árbol Three.js del prefab `pf` con la raíz en el origen. `ctx` = contexto de construcción de nodos del editor (modelos, texturas…).
 * `play`: oculta los iconos de ayuda de las luces. Devuelve null si el prefab no existe o está vacío.
 */
export function buildPrefabGraphic(pf, ctx, { play = false } = {}) {
  if (!pf?.objects?.length) return null
  const group = new THREE.Group()
  group.name = `prefab:${pf.name || pf.id}`
  const nodes = new Map()
  for (const o of pf.objects) {
    const def = getDef(o.type)
    let node
    if (!def || SKIP.has(o.type)) {
      // conserva la transformación para que sus hijos queden en su sitio
      node = new THREE.Object3D()
      node.position.set(...(o.position || [0, 0, 0]))
      node.rotation.order = 'YXZ'
      node.rotation.set(...(o.rotation || [0, 0, 0]).map((v) => (v * Math.PI) / 180))
    } else {
      try {
        node = def.build(o, ctx)
        def.update(node, o)
      } catch (e) {
        console.warn('Prefab en evento:', o.type, e)
        node = new THREE.Object3D()
      }
      if (play && o.type === 'light' && node.userData.visual) node.userData.visual.visible = false
      node.traverse((m) => { if (m.isMesh && !m.userData.helper) { m.castShadow = o.castShadow !== false; m.receiveShadow = true } })
    }
    node.userData.prefabPart = o.id
    nodes.set(o.id, node)
  }
  for (const o of pf.objects) {
    const n = nodes.get(o.id)
    const parent = (o.parentId && nodes.get(o.parentId)) || group
    parent.add(n)
  }
  // la raíz del prefab va en el origen del gráfico (su posición guardada es la del prefab, no la de la escena)
  const root = nodes.get(pf.objects[0].id)
  if (root) root.position.set(0, 0, 0)
  return group
}

/** ¿Usa algún evento este prefab como gráfico? (para rehacer su vista previa cuando cambia el prefab). */
export const eventUsesPrefab = (obj, prefabId) => obj?.type === 'event' && (obj.props?.pages || []).some((pg) => pg.graphic?.kind === 'prefab' && pg.graphic.prefabId === prefabId)
