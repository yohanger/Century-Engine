import { Frustum, Matrix4 } from 'three'

export function playerCameraFrustum(camera, frustum = new Frustum(), projection = new Matrix4()) {
  if (!camera?.isPerspectiveCamera) return null
  camera.updateWorldMatrix(true, false)
  return frustum.setFromProjectionMatrix(
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), camera.coordinateSystem)
}

function drawableForCamera(object, camera) {
  return (object.isMesh || object.isLine || object.isPoints || object.isSprite) &&
    object.layers.test(camera.layers) && !object.userData?.helper &&
    !object.userData?.isHelper && !object.userData?.pickProxy
}

function intersectsFrustum(object, frustum) {
  return object.isSprite ? frustum.intersectsSprite(object) : frustum.intersectsObject(object)
}

export function outsidePlayerFrustum(world, camera, frustum) {
  if (!world?.traverseVisible || !frustum) return []
  const discarded = []
  world.traverseVisible(object => {
    if (drawableForCamera(object, camera) && !intersectsFrustum(object, frustum)) discarded.push(object)
  })
  return discarded
}

export function occludedWithinFrustum(masked, camera, frustum) {
  if (!frustum) return null
  return new Set(masked.filter(object =>
    drawableForCamera(object, camera) && intersectsFrustum(object, frustum))).size
}

export { withTemporaryHidden, withTemporarilyVisible } from './temporary-visibility.js'
