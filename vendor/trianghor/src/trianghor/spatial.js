// TriangHor: índice espacial de las páginas nativas de ClusterMeshes.
// No particiona triángulos ni crea otro renderer. Solo accelera consultas de páginas existentes.
function boundOf(pages) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (const page of pages) {
    const s = page.sphere
    for (let k=0;k<3;k++) {
      const v = k===0 ? s.center.x : k===1 ? s.center.y : s.center.z
      min[k] = Math.min(min[k], v-s.radius)
      max[k] = Math.max(max[k], v+s.radius)
    }
  }
  const center = min.map((v,k)=>(v+max[k])/2)
  return { center, radius: Math.hypot(max[0]-min[0],max[1]-min[1],max[2]-min[2])/2 }
}
export function buildPageTree(pages, maxLeaf=8) {
  if (!pages?.length) return null
  if (!Number.isInteger(maxLeaf) || maxLeaf<1) throw new RangeError('TriangHor spatial: tamaño de hoja inválido')
  function build(items) {
    const bounds = boundOf(items)
    if (items.length <= maxLeaf) return { bounds, pages:items, left:null, right:null }
    const range = [0,1,2].map(k=>Math.max(...items.map(p=>[p.sphere.center.x,p.sphere.center.y,p.sphere.center.z][k]))-
      Math.min(...items.map(p=>[p.sphere.center.x,p.sphere.center.y,p.sphere.center.z][k])))
    const axis=range.indexOf(Math.max(...range))
    const sorted = items.slice().sort((a,b)=>[a.sphere.center.x,a.sphere.center.y,a.sphere.center.z][axis]-
      [b.sphere.center.x,b.sphere.center.y,b.sphere.center.z][axis])
    const m=sorted.length>>1
    return { bounds, pages:null, left:build(sorted.slice(0,m)), right:build(sorted.slice(m)) }
  }
  return build(pages)
}

// intersects(center,radius) can be a camera, shadow pass or deterministic test predicate.
// No asume que la cámara cubre los shadow casters: la política de pases pertenece a ClusterMeshes.
export function queryPageTree(tree, intersects, out=[], counters=null) {
  if (!tree) return out
  const stack=[tree]
  while(stack.length) {
    const node=stack.pop()
    if (counters) counters.nodes++
    if (!intersects(node.bounds.center,node.bounds.radius)) continue
    if (node.pages) {
      for (const page of node.pages) {
        if (counters) counters.pages++
        const c=page.sphere.center
        if (intersects([c.x,c.y,c.z],page.sphere.radius)) out.push(page)
      }
    } else {stack.push(node.right,node.left)}
  }
  return out
}
