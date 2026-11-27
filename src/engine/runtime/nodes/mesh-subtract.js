import { registerNode, getDef } from './registry.js'
import { applyBase } from './three-helpers.js'

export default registerNode({
  type: 'meshSubtract', label: 'Mesh Substract', icon: 'subtract', category: 'Herramientas de modelado', scalable: true,
  create: () => ({ name: 'Mesh Substract', kind: 'mesh', color: '#41bdc6', collision: false,
    castShadow: false, props: { sourceId: '', autoInset: 0.1 } }),
  build(obj) {
    const root = getDef('subtract').build(obj)
    root.userData.fill.visible = false
    root.userData.edges.visible = false
    return root
  },
  update(root, obj) {
    applyBase(root, obj, true)
    root.userData.fill.material.color.set(obj.color || '#41bdc6')
    root.userData.edges.material.color.set(obj.color || '#41bdc6')
  },
})
