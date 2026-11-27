// Nodo de escena que referencia una pieza Terrain. La geometría, alturas y pintura siguen en Terrain.
import { makeRoot } from './three-helpers.js'
import { registerNode } from './registry.js'

// La pieza existente es la única autoridad de alturas, pintura, follaje y posición.
// El nodo tiene el mismo ID; los enlaces runtime no son propiedades serializables.
function terrainPosition(piece) { return [piece.ox, piece.oy, piece.oz] }
function terrainContext(root, obj) {
  const piece = root.userData.terrainPiece, scene = root.userData.terrainScene
  if (!piece || piece.id !== obj.id || !scene?.terrains?.includes(piece) ||
      scene.host?.getObject?.(obj.id)?.type !== 'terrain') throw new Error('Terrain: referencia de pieza inválida')
  return { piece, scene }
}
function setTerrainPosition(root, obj, position) {
  const { piece, scene } = terrainContext(root, obj)
  if (!Array.isArray(position) || position.length !== 3 || !position.every(v => Number.isFinite(v) && Math.abs(v) <= 1e6))
    throw new RangeError('Terrain: posición XYZ inválida')
  if (position.every((value,index) => value === terrainPosition(piece)[index])) return
  const physics = scene.player?.on ? scene.player.phys : null
  if (physics) physics.moveTerrainPiece(piece.id, position) // falla antes de modificar la pieza
  if (!piece._timelineAuthoredPosition) piece._timelineAuthoredPosition = terrainPosition(piece)
  ;[piece.ox, piece.oy, piece.oz] = position
  piece.mesh.position.set(...position)
  piece.foliage.group.position.set(...position)
  scene.vp.invalidateShadows?.()
  scene.vp.requestRender()
}

const terrainAnimation = {
  'terrain.piecePosition': {
    label: 'Posición de la pieza (XYZ)', kind: 'vec3', def: [0,0,0],
    available: obj => !!obj._lfTerrainPiece && obj._lfTerrainPiece.id === obj.id,
    read: obj => obj._lfTerrainPiece ? terrainPosition(obj._lfTerrainPiece) : [0,0,0],
    runtimeRead: (root, obj) => root.userData.timelineTerrainPosition || terrainPosition(terrainContext(root,obj).piece),
    capture: (root, obj) => ({
      position: terrainPosition(terrainContext(root,obj).piece),
      had: Object.hasOwn(root.userData, 'timelineTerrainPosition'),
      previous: root.userData.timelineTerrainPosition,
    }),
    apply: (root, value, obj) => {
      setTerrainPosition(root,obj,value)
      root.userData.timelineTerrainPosition = [...value]
    },
    restore: (root, saved, obj) => {
      setTerrainPosition(root,obj,saved.position)
      if (saved.had) root.userData.timelineTerrainPosition = saved.previous
      else {
        delete root.userData.timelineTerrainPosition
        delete root.userData.terrainPiece._timelineAuthoredPosition
      }
    },
  },
}

export default registerNode({
  type: 'terrain', base: 'Node', label: 'Terreno', icon: 'terrain', category: 'Naturaleza', scalable: false,
  animation: terrainAnimation,
  create() { return { name: 'Terreno', props: {} } },
  build(obj) { return makeRoot(obj).root }, // identidad en el árbol; no duplica la malla ni su renderer
  update(root, obj) { root.visible = obj.visible !== false },
})
