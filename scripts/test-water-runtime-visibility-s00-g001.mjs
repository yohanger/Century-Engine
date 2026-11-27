import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (name) => readFileSync(new URL('../' + name, import.meta.url), 'utf8')

function harness({ simulation = true, depth = 0.3, coupled = true, ownerVisible = true } = {}) {
  const states = { views: [], fail: false, calls: 0, warnings: [], active: false }
  const WETU = { uPhysicalCount: { value: 0 }, uHydroCount: { value: 0 },
    uHydroMoisture: { value: null }, uPhysicalBounds: { value: { set() {} } } }
  class WaterSurfaceView {
    constructor(scene, water) {
      if (states.fail) throw new Error('No se pudo construir la superficie física')
      this.scene = scene; this.water = water; this.disposed = false
      states.views.push(this); states.calls++
    }
    update(water) { this.water = water }
    dispose() { this.disposed = true }
  }
  class WaterWorld {
    static fromObjects(objects) {
      const bodies = objects.filter(o => o.type === 'water' && o.visible !== false).map(o => ({
        id: o.id, shape: o.props?.shape || 'rect', coupledRegion: o.props?.physicalRegionId || '' }))
      return { bodies, regions: new Map() }
    }
  }
  class TerrainWaterConnection {
    constructor(water, config) {
      if (!config.regions) throw new Error('Regiones inexistentes')
      for (const r of config.regions) water.regions.set(r.id, { ...r,
        width: 1, height: 1, dx: 1, dz: 1, valid: new Uint8Array([1]), depth: new Float64Array([r.initialDepth ?? 0]) })
    }
  }
  // CA-005: el ensayo conserva las transiciones WV históricas, adaptando la
  // selección de dominios: Lago/Río poseen región nativa aunque no esté activado
  // el panel de simulación de escena.
  const nativeWaterConfiguration = (water, authored) => {
    if (authored?.enabled && !Array.isArray(authored.regions)) throw new Error('Agua física: falta la lista de regiones')
    if (authored?.enabled && authored.regions.length) {
      const regions = authored.regions
      for (const body of water.bodies) if (body.shape === 'rect' || body.shape === 'river')
        body.coupledRegion = regions[0].id
      return {enabled:true, regions}
    }
    const regions = water.bodies.filter((b) => b.shape === 'rect' || b.shape === 'river').map((b) => {
      const id = `native-water:${b.id}`
      b.coupledRegion=id
      return {id,initialDepth:0.3}
    })
    return regions.length ? {enabled:true,regions} : null
  }
  const source = read('src/engine/runtime/scene/water.js')
    .replace(/^import .*$/gm, '')
    .replace('export const waterMethods =', 'const waterMethods =')
  const factory = new Function('WaterWorld', 'WaterSurfaceView', 'TerrainWaterConnection', 'nativeWaterConfiguration', 'WETU', 'nodeActive', 'THREE', 'groundAtAll', 'halfExtentAll', 'normalizeWaterFx', 'collectWaterBodies', 'bakeWaterMap', 'setWaterFxUniforms', 'WM', 'addRipple', 'effectiveMaterialObject', 'normalizedRunoff', 'roadSlotMaterial', 'surfaceOf', `return (() => { ${source}; return waterMethods })()`)
  const methods = factory(WaterWorld, WaterSurfaceView, TerrainWaterConnection, nativeWaterConfiguration, WETU,
    o => o.active !== false, {}, () => 0, () => 0, () => ({}), () => [], () => {}, () => {}, {}, () => {}, () => {}, () => {}, () => {}, () => {})
  const owner = { id:'lake', type:'water', name:'Lago', visible:ownerVisible, active:true, parentId:null,
    position:[0,1,0], rotation:[0,0,0], props: { shape:'rect', physicalRegionId:coupled?'pond':'' } }
  const parent = {id:'parent',type:'node3d',name:'Padre',visible:true,active:true,position:[0,0,0],rotation:[0,0,0]}
  const waterNode={ visible:ownerVisible, _lfNodeOwner:owner }
  const project={objects:[owner,parent], environment:{waterSimulation:simulation? {enabled:true,regions:[{id:'pond',initialDepth:depth}]}:{enabled:false}}}
  let renders=0
  const host={project, getObject:id=>project.objects.find(o=>o.id===id),toast:(s)=>states.warnings.push(s)}
  const graph={...methods, host, nodes:new Map([[owner.id,waterNode]]),
    terrains:[], world:{}, vp:{world:{},requestRender:()=>{ renders++ }},
    get isPlaying(){return states.active},
    get renders(){return renders},
  }
  return { graph,waterNode,owner,parent,project,states,WETU }
}

test('WV-01 CA-005: Lago sin configuración crea dominio nativo y recupera autoría al desmontar', () => {
  const h=harness({ simulation:false, coupled:false }); const {graph,waterNode}=h
  graph.refreshPhysicalWaterPreview()
  assert.equal(waterNode.visible,false)
  assert.equal(graph._physicalWaterView.water.regions.size,1)
  h.states.active=true
  graph.hidePhysicalWater()
  graph.showPhysicalWater({bodies:[{id:'lake',coupledRegion:''}],regions:new Map()})
  assert.equal(waterNode.visible,true)
  graph.hidePhysicalWater()
  h.states.active=false
  graph.refreshPhysicalWaterPreview()
  assert.equal(waterNode.visible,false)
  assert.equal(h.WETU.uPhysicalCount.value,1)
})

test('WV-02: un lago acoplado se sustituye por su región y se restituye al desmontar', () => {
  const h=harness(); const {graph,waterNode,states}=h
  graph.refreshPhysicalWaterPreview()
  assert.equal(waterNode.visible,false)
  assert.equal(states.views.length,1)
  assert.ok(graph._physicalWaterView)
  graph.hidePhysicalWater()
  assert.equal(waterNode.visible,true)
  assert.equal(graph._physicalWaterView,null)
  assert.ok(states.views[0].disposed)
})

test('WV-03: fallo al construir la vista física no oculta el lago ni destruye la vista anterior', () => {
  const h=harness(), {graph,waterNode,states}=h
  graph.refreshPhysicalWaterPreview()
  const old=graph._physicalWaterView
  states.fail=true
  assert.throws(()=>graph.showPhysicalWater({bodies:[{id:'lake',coupledRegion:'pond'}],regions:new Map([['pond',{}]])}),/No se pudo construir/)
  assert.equal(graph._physicalWaterView,old)
  assert.equal(old.disposed,false)
  assert.equal(waterNode.visible,false)
  graph.hidePhysicalWater()
  assert.equal(waterNode.visible,true)
})

test('WV-04: tras Play el lago se restaura al estado de autoría, no al estado transitorio capturado', () => {
  const h=harness(), {graph,owner,waterNode}=h
  graph.refreshPhysicalWaterPreview()
  graph._coupledWaterVisibility[0][1]=false // snapshot transitorio antiguo
  graph.hidePhysicalWater()
  assert.equal(waterNode.visible,true)
  owner.visible=false
  graph.showPhysicalWater({bodies:[{id:'lake',coupledRegion:'pond'}],regions:new Map([['pond',{}]])})
  graph.hidePhysicalWater()
  assert.equal(waterNode.visible,false,'no restituir objetos ocultos por el autor')
})

test('WV-05: la vista previa detecta cambio de región, transformación y visibilidad sin tocar la configuración', () => {
  const h=harness(), {graph,owner,waterNode,states}=h
  graph.refreshPhysicalWaterPreview()
  assert.equal(states.views.length,1)
  graph.refreshPhysicalWaterPreview()
  assert.equal(states.views.length,1,'sin reconstrucciones repetidas por frame')
  owner.position[0]=3
  graph.refreshPhysicalWaterPreview()
  assert.equal(states.views.length,2)
  owner.props.physicalRegionId=''
  graph.refreshPhysicalWaterPreview()
  assert.equal(waterNode.visible,false,'CA-005: desvincular no desactiva el Lago nativo')
  assert.equal(states.views.length,3)
  owner.visible=false
  waterNode.visible=false // syncObject aplica visible antes de refrescar el entorno
  graph.refreshPhysicalWaterPreview()
  assert.equal(waterNode.visible,false)
  assert.equal(states.views.length,4)
})

test('WV-06: cambio del ancestro obliga a recalcular vista previa', () => {
  const h=harness(), {graph,owner,parent,states}=h
  owner.parentId=parent.id
  graph.refreshPhysicalWaterPreview()
  const prev=states.views.length
  parent.position[2]=40
  graph.refreshPhysicalWaterPreview()
  assert.equal(states.views.length,prev+1)
})

test('WV-07: escena física seca no genera agua ficticia ni modifica volumen', () => {
  const h=harness({depth:0}),{graph}=h
  graph.refreshPhysicalWaterPreview()
  const region=graph._physicalWaterView.water.regions.get('pond')
  assert.equal(region.depth[0],0)
  assert.equal(h.waterNode.visible,false,'sin volumen: la representación física manda')
  graph.hidePhysicalWater()
  assert.equal(h.waterNode.visible,true)
})

test('WV-08 CA-005: al quitar regiones manuales Lago sigue nativo y se redibuja', () => {
  const h=harness(),{graph,project,waterNode}=h
  graph.refreshPhysicalWaterPreview()
  const count=graph.renders
  project.environment.waterSimulation.enabled=false
  graph.refreshPhysicalWaterPreview()
  assert.equal(waterNode.visible,false)
  assert.ok(graph.renders>count)
  assert.ok(graph._physicalWaterView)
})

test('WV-09: no modificar nodos reemplazados durante el juego', () => {
  const h=harness(),{graph,waterNode,owner}=h
  graph.refreshPhysicalWaterPreview()
  const replacement={visible:false,_lfNodeOwner:owner}
  graph.nodes.set(owner.id,replacement)
  graph.hidePhysicalWater()
  assert.equal(replacement.visible,false)
  assert.equal(waterNode.visible,false,'nodo obsoleto no se reactiva')
})

test('WV-10: Play y Player comparten WaterWorld y la vista física, sin sistema duplicado',()=>{
  const play=read('src/engine/runtime/events/play.js')
  const runtime=read('src/engine/runtime/package/game.js')
  assert.match(play,/ed\.hidePhysicalWater\(\)[\s\S]*?this\.water = WaterWorld\.fromObjects\(p\.objects\)/)
  assert.match(play,/if \(this\._waterConnection\) ed\.showPhysicalWater\(this\.water\)/)
  assert.ok(play.indexOf('if (this._waterConnection) ed.showPhysicalWater(this.water)') < play.indexOf('ed.setPhysicalWaterBounds(this.water)'), 'uniformes físicos se aplican DESPUÉS del montaje')
  assert.match(runtime,/get isPlaying\(\)/)
  assert.match(play,/if \(this\.session\) this\.ed\.refreshPhysicalWaterPreview\(\)/)
})

test('WV-11: constructor de superficie física libera recursos si falla la actualización',()=>{
  const source=read('src/engine/runtime/geometry/water-surface.js')
  assert.match(source,/scene\.add\(this\.group\)[\s\S]*?try \{ this\.update\(water\) \}/)
  assert.match(source,/catch \(error\) \{ this\.dispose\(\); throw error \}/)
})

test('WV-12: error de construcción real de WaterSurfaceView retira grupo sin fugas', () => {
  const module = read('src/engine/runtime/geometry/water-surface.js')
    .replace(/^import .*$/gm, '')
    .replace('export class WaterSurfaceView', 'class WaterSurfaceView')
  const Three = {
    Group: class { constructor(){ this.children=[]; this.userData={} } add(obj){this.children.push(obj)} remove(obj){this.children=this.children.filter(x=>x!==obj)} },
    BufferGeometry: class { constructor(){this.attributes={}} },
  }
  const WaterSurfaceView = new Function('THREE','makeWaterUniforms','patchWaterMaterial', `${module};return WaterSurfaceView`)(Three,()=>({}),()=>{})
  const scene={children:[],add(obj){this.children.push(obj)},remove(obj){this.children=this.children.filter(x=>x!==obj)}}
  const invalid={regions:new Map([['broken',{id:'broken',width:-1,height:1}]])}
  assert.throws(()=>new WaterSurfaceView(scene,invalid), RangeError)
  assert.equal(scene.children.length,0,'ningún grupo creado a medias se retiene en escena')
})

test('WV-13: vista previa inválida limpia estado y no repite error por fotograma', () => {
  const h=harness(), {graph,states,waterNode,project}=h
  graph.refreshPhysicalWaterPreview()
  assert.equal(waterNode.visible,false)
  project.environment.waterSimulation.regions=null
  graph.refreshPhysicalWaterPreview()
  assert.equal(waterNode.visible,true)
  assert.equal(graph._physicalWaterView,null)
  assert.equal(states.warnings.length,1)
  graph.refreshPhysicalWaterPreview()
  assert.equal(states.warnings.length,1)
  project.environment.waterSimulation.regions=[{id:'pond',initialDepth:0.3}]
  graph.refreshPhysicalWaterPreview()
  assert.equal(waterNode.visible,false)
})

test('WV-14: error al preparar material físico libera geometría y material antes de restaurar Edit', () => {
  const module = read('src/engine/runtime/geometry/water-surface.js')
    .replace(/^import .*$/gm, '')
    .replace('export class WaterSurfaceView', 'class WaterSurfaceView')
  let geometries = 0, materials = 0
  class Group { constructor(){this.children=[];this.userData={}} add(x){this.children.push(x)} remove(x){this.children=this.children.filter(y=>y!==x)} }
  class Geometry { constructor(){this.attributes={}} setAttribute(k,v){this.attributes[k]=v} setIndex(v){this.index=v} dispose(){geometries++} }
  class Attribute { constructor(array){this.array=array} setUsage(){return this} }
  class Color { set(){return this} }
  const Three={ Group, BufferGeometry:Geometry, BufferAttribute:Attribute, MeshStandardMaterial:class { dispose(){materials++} },
    DynamicDrawUsage:1, NearestFilter:1, DoubleSide:2 }
  const uniforms=()=>({rtShallow:{value:new Color()},rtDeep:{value:new Color()},rtOpacity:{value:0},rtFoam:{value:0},
    rtTotalAmp:{value:0},rtWMp:{value:{z:1}},rtWFx:{value:{set(){}}}})
  const WaterSurfaceView=new Function('THREE','makeWaterUniforms','patchWaterMaterial',`${module};return WaterSurfaceView`)(Three,uniforms,()=>{throw new Error('shader inválido')})
  const scene={children:[],add(x){this.children.push(x)},remove(x){this.children=this.children.filter(y=>y!==x)}}
  const region={id:'pond',name:'Lago físico',width:2,height:2,color:'#3377bb',deepColor:'#001122'}
  assert.throws(()=>new WaterSurfaceView(scene,{regions:new Map([['pond',region]])}),/shader inválido/)
  assert.equal(geometries,1)
  assert.equal(materials,1)
  assert.equal(scene.children.length,0)
})
