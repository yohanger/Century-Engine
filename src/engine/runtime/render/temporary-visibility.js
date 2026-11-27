export function withTemporaryHidden(objects, render) {
  const hidden = []
  for (const object of objects) {
    if (!object.visible) continue
    object.visible = false
    hidden.push(object)
  }
  try { return render() } finally {
    for (const object of hidden) object.visible = true
  }
}

export function withTemporarilyVisible(objects, render) {
  const revealed = []
  for (const object of objects) {
    if (object.visible) continue
    object.visible = true
    revealed.push(object)
  }
  try { return render() } finally {
    for (const object of revealed) object.visible = false
  }
}
