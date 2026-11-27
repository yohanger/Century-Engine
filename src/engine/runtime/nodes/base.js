import { registerNode } from './registry.js'
import { makeRoot, applyBase, hitSphere } from './three-helpers.js'

/** Recipientes de Node3D/RigidBody3D: el caudal físico pertenece a WaterWorld.
 * El canal temporal solo cambia su parámetro en el recipiente existente.
 */
export function liquidPourAnimation(ownerType) {
  const key = `${ownerType}.pourRate`
  const field = root => root.userData.timelineLiquid?.pourRate
  const runtime = root => root.userData.liquidRuntime
  const sync = (root, value) => {
    const item = runtime(root)
    if (item && item.world.containers.has(item.id)) item.world.setContainerPourRate(item.id, value)
  }
  return { [key]: {
    label: 'Caudal de salida', kind: 'number', def: 0.5, min: 0, max: 5,
    available: obj => obj.props?.liquidContainer?.enabled === true,
    read: obj => obj.props?.liquidContainer?.pourRate ?? 0.5,
    runtimeRead: (root,obj) => field(root) ?? obj.props?.liquidContainer?.pourRate ?? 0.5,
    apply: (root,value) => {
      if (!Number.isFinite(value) || value < 0 || value > 5) throw new RangeError('Caudal temporal inválido')
      ;(root.userData.timelineLiquid ??= {}).pourRate = value
      sync(root,value)
    },
    capture: root => ({ had: Object.hasOwn(root.userData.timelineLiquid || {}, 'pourRate'),
      value:field(root), live: runtime(root)?.world.containerState(runtime(root).id)?.pourRate }),
    restore: (root,snapshot,obj) => {
      if (snapshot?.had) (root.userData.timelineLiquid ??= {}).pourRate = snapshot.value
      else if (root.userData.timelineLiquid) {
        delete root.userData.timelineLiquid.pourRate
        if (!Object.keys(root.userData.timelineLiquid).length) delete root.userData.timelineLiquid
      }
      sync(root, snapshot?.live ?? field(root) ?? obj.props?.liquidContainer?.pourRate ?? 0.5)
    },
  } }
}

/** Dimensiones y forma del recipiente existente. El mismo WaterWorld es dueño
 * de capacidad, volumen y sustancia. No se crea un segundo inventario líquido. */
export function liquidGeometryAnimation(ownerType) {
  const fields=[['liquidShape','shape','Forma interior','enum','cylinder',null,null],
    ['liquidSize','size','Interior (m)','vec3',[0.09,0.12,0.09],0.001,10]]
  return Object.fromEntries(fields.map(([id,field,label,kind,def,min,max])=>{
    const runtime=root=>root.userData.liquidRuntime
    const authored=obj=>obj.props?.liquidContainer?.[field] ?? def
    const temporal=root=>root.userData.timelineLiquid?.[field]
    const physical=root=>{
      const owner=runtime(root)
      return owner?.world.containerState(owner.id)
    }
    const set=(root, value)=>{
      const owner=runtime(root)
      if (owner) owner.world.setContainerGeometry(owner.id,{[field]:value})
    }
    const check=value=>{
      if (field==='shape' && !['cylinder','box'].includes(value)) throw new RangeError('Recipiente: forma temporal inválida')
      if (field==='size' && (!Array.isArray(value)||value.length!==3 ||
          !value.every(v=>typeof v==='number' && Number.isFinite(v) && v>=0.001 && v<=10)))
        throw new RangeError('Recipiente: dimensiones temporales inválidas')
    }
    return [`${ownerType}.${id}`, {
      label,kind,def,...(kind==='enum'?{options:['cylinder','box']}:{min,max}),
      available:obj=>obj.props?.liquidContainer?.enabled===true,
      read:authored,
      runtimeRead:(root,obj)=>temporal(root)??physical(root)?.[field]??authored(obj),
      apply:(root,value)=>{
        check(value)
        set(root,value) // Si no cabe el líquido, NO se reserva la clave ni se muta WaterWorld.
        ;(root.userData.timelineLiquid ??= {})[field]=Array.isArray(value)?[...value]:value
      },
      capture:root=>({had:Object.hasOwn(root.userData.timelineLiquid||{},field),
        value:temporal(root),live:physical(root)?.[field]}),
      restore:(root,saved,obj)=>{
        const value=saved?.live??(saved?.had?saved.value:authored(obj))
        set(root,value) // Mantiene el líquido vigente; puede rechazar restaurar si no cabe.
        if (saved?.had) (root.userData.timelineLiquid ??= {})[field]=Array.isArray(saved.value)?[...saved.value]:saved.value
        else if (root.userData.timelineLiquid) {
          delete root.userData.timelineLiquid[field]
          if (!Object.keys(root.userData.timelineLiquid).length) delete root.userData.timelineLiquid
        }
      },
    }]
  }))
}

/** El clima propietario mantiene la fuente térmica; Timeline solo conserva overrides.
 * Sólo se aplican propiedades continuas. Encender/apagar requiere una transacción de fuego.
 */
export function combustionEnvironmentAnimation(ownerType) {
  const fields=[['moisture','Humedad',0.25,0,1],['ignitionK','Temperatura de ignición (K)',570,300,2000]]
  return Object.fromEntries(fields.map(([field,label,def,min,max]) => {
    const runtime = root => root.userData.combustionRuntime
    const source = root => {
      const entry=runtime(root)
      return entry?.owner?._combustion?.sources.get(entry.id)
    }
    const current = root => root.userData.timelineCombustion?.[field]
    return [`${ownerType}.${field}`, {
      label, kind:'number', def, min, max,
      available: obj => obj.props?.combustion?.enabled === true,
      read: obj => obj.props?.combustion?.[field] ?? def,
      runtimeRead: (root,obj) => current(root) ?? source(root)?.[field] ?? obj.props?.combustion?.[field] ?? def,
      apply: (root,value) => {
        if (!Number.isFinite(value) || value < min || value > max)
          throw new RangeError(`Combustión: ${field} temporal inválido`)
        const entry=runtime(root)
        if (entry) {
          if (!entry.owner._combustion) throw new Error('Combustión: modelo físico no disponible')
          entry.owner._combustion.configure(entry.id,{[field]:value})
        }
        ;(root.userData.timelineCombustion ??= {})[field]=value
      },
      capture: root => ({ had:Object.hasOwn(root.userData.timelineCombustion || {},field),
        value:current(root),live:source(root)?.[field] }),
      restore: (root,saved,obj) => {
        const value=saved?.live ?? (saved?.had ? saved.value : obj.props?.combustion?.[field] ?? def)
        const entry=runtime(root)
        if (entry) {
          if (!entry.owner._combustion) throw new Error('Combustión: modelo físico no disponible')
          entry.owner._combustion.configure(entry.id,{[field]:value})
        }
        if (saved?.had) (root.userData.timelineCombustion ??= {})[field]=saved.value
        else if (root.userData.timelineCombustion) {
          delete root.userData.timelineCombustion[field]
          if (!Object.keys(root.userData.timelineCombustion).length) delete root.userData.timelineCombustion
        }
      },
    }]
  }))
}

// Node organiza la escena; no tiene posición, escala, geometría ni física.
registerNode({
  type: 'node', base: 'Node', label: 'Node', icon: 'network', category: 'Estructura', scalable: false,
  create: () => ({ name: 'Node' }),
  build(obj) { return makeRoot(obj).root },
  update(root, obj) { root.visible = obj.visible !== false },
})

// Node3D incorpora las transformaciones espaciales del proyecto; no tiene cuerpo físico propio.
const node3d = registerNode({
  type: 'node3d', base: 'Node3D', label: 'Node3D', icon: 'move-3d', category: 'Estructura', scalable: true,
  animation: { ...liquidPourAnimation('node3d'), ...liquidGeometryAnimation('node3d'), ...combustionEnvironmentAnimation('node3d') },
  create: () => ({ name: 'Node3D' }),
  build(obj) {
    const { root } = makeRoot(obj)
    root.add(hitSphere(0.25))
    return root
  },
  update(root, obj) {
    applyBase(root, obj, false)
    // Node3D transforma a sus hijos. Las primitivas antiguas usan escala visual propia.
    root.scale.set(...obj.scale)
  },
})

// La escena fuente es un recurso vinculado. Este nodo solo aporta Transform y pertenencia al árbol.
registerNode({
  type: 'sceneInstance', base: 'Node3D', label: 'Instancia de escena', icon: 'scene',
  category: 'Estructura', scalable: true, creatable: false,
  create: () => ({ name: 'Instancia de escena', props: { sceneId: '' } }),
  build: node3d.build,
  update: node3d.update,
})
