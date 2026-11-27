// Geometrías compartidas del proyecto: los nodos mantienen sus propias transformaciones y materiales.
/** Recupera la geometría de un nodo, sea independiente o referenciada por ID. */
export function meshDataOf(obj, meshes = []) {
  const id = obj?.props?.meshRef
  if (id) return meshes.find((m) => m.id === id)?.mesh || null
  return obj?.props?.mesh || null
}

/** Un objeto editable sin vínculo pasa a usar un único recurso de geometría. */
export function linkMesh(project, obj, newId) {
  if (!project || obj?.type !== 'mesh') return null
  if (obj.props?.meshRef) return project.meshes?.find((m) => m.id === obj.props.meshRef) || null
  const data = obj.props?.mesh
  if (!data) return null
  project.meshes ||= []
  const resource = { id: newId, mesh: data }
  project.meshes.push(resource)
  obj.props.meshRef = resource.id
  delete obj.props.mesh
  return resource
}

/** Rompe el vínculo solo de esta instancia, sin alterar los demás consumidores. */
export function unlinkMesh(project, obj) {
  if (!obj?.props?.meshRef) return false
  const mesh = meshDataOf(obj, project?.meshes)
  if (!mesh) return false
  obj.props.mesh = JSON.parse(JSON.stringify(mesh))
  delete obj.props.meshRef
  return true
}

/** Confirma cambios de Edit Mesh en una sola fuente de verdad. */
export function writeMesh(project, obj, mesh) {
  if (!obj || (obj.type !== 'mesh' && obj.type !== 'subtract')) return false
  if (obj.type === 'subtract') { if (!obj.props) return false; obj.props.mesh = mesh; return true }
  if (obj.props.meshRef) {
    const res = project?.meshes?.find((m) => m.id === obj.props.meshRef)
    if (!res) return false
    res.mesh = mesh
  } else obj.props.mesh = mesh
  return true
}

export function meshConsumers(project, id) {
  return (project?.objects || []).filter((o) => o.type === 'mesh' && o.props?.meshRef === id)
}
