import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = p => readFileSync(new URL('../'+p, import.meta.url), 'utf8')
const inspector = read('src/components/Inspector.vue'), material = read('src/components/MaterialSection.vue'), styles = read('src/styles.css'), mesh = read('src/components/MeshPanel.vue')
test('Paleta compartida exacta de Edit Mesh', () => {
  for (const [axis,color] of [['x','#ef8d8d'],['y','#91cb96'],['z','#91b6f1']]) {
    assert.ok(styles.includes(`--inspector-axis-${axis}: ${color}`))
    assert.ok(mesh.includes(`color: var(--inspector-axis-${axis})`))
    assert.ok(inspector.includes(`color: var(--inspector-axis-${axis})`))
  }
})
test('Los tres ejes individuales y múltiples comparten la paleta', () => {
  for (let i=1;i<=3;i++) assert.ok(inspector.includes(`.nf:nth-child(${i}) .lbl), .multi-axis:nth-child(${i}) span`))
})
test('Transformaciones y commits conservan rutas existentes', () => {
  for (const key of ['position','rotation','scale']) assert.ok(inspector.includes(`@change="vec('${key}', $event)"`))
  assert.ok(inspector.includes('editSharedAxis(field.key,axis-1,$event)'))
  assert.ok(inspector.includes('@commit="confirmUniformScale"'))
  assert.ok(inspector.includes('@click.stop="resetTransform"'))
})
test('Identidad de nodo sin icono genérico redundante', () => {
  assert.doesNotMatch(inspector,/selectedNodeIcon|class="actor-icon"/)
  for (const token of ['Nombre del nodo','Nodo activo','node-lock','TagLayerRow','node-type-label','pathOf(obj.id)']) assert.ok(inspector.includes(token),token)
})
test('Asignación de script única sin duplicar acción', () => {
  assert.equal((inspector.match(/@change="assignSelectedScript/g)||[]).length,1)
  assert.doesNotMatch(inspector,/@click="chooseNodeScript"/)
  for(const token of ['onScriptDrop','onScriptSortDrop','removeNodeScript(obj.id, id)','updateScriptEditable(id, field']) assert.ok(inspector.includes(token),token)
})
test('Modelo y nodo comparten una sola esfera y menú', () => {
  assert.equal((material.match(/class="mr-sphere"/g)||[]).length,1)
  assert.equal((material.match(/@click.stop.prevent="openSlotMenu"/g)||[]).length,1)
  assert.match(material,/slotEdit \|\| nodeMaterial/)
  assert.match(material,/v-if="!slotEdit && !nodeMaterial" class="mr-resource"/)
  assert.doesNotMatch(material,/class="mr-actions"|new WebGLRenderer|requestAnimationFrame/)
})
test('Acciones de material conservan autoridad nativa y restauración exclusiva de slots', () => {
  for(const token of ['makeMaterialLocal(props.obj.id)','assignMaterial(props.obj.id, id)','updateMaterial(resource.value.id','run:create','openMaterialEditor(resource.value.id)','props.slotRestore?.()']) assert.ok(material.includes(token),token)
  assert.match(material,/props\.slotEdit \? \[\{ sep:true \}/)
  assert.match(material,/assetUrl\(id, projectId\)/)
})
test('Drag and drop, propiedades PBR y Timeline conservados', () => {
  for(const token of ['@assign="choose"','@assign="setMap(map.key,$event)"','MaterialSurfaceDetail','MaterialShader','PropertyKey','setRunoff','setRainAudio']) assert.ok(material.includes(token),token)
})
test('Responsividad conserva los campos y las llaves', () => {
  assert.match(inspector,/@container insp \(max-width: 260px\)/)
  assert.match(inspector,/\.node-inspector \.lf-transform \.field:has\(> \.property-key\)/)
  assert.match(material,/\.mr\.mr-node \.field:has\(> \.property-key\)/)
})
test('El estilo se limita a nodos, mantiene Escena y Audio', () => {
  assert.match(inspector,/!audioContext && \(obj \|\| multi\)/)
  assert.match(inspector,/<ScenePanel \/>/)
  assert.match(inspector,/<AudioMixerInspector v-if="audioContext"/)
})
test('Runner Electron construye el proyecto nativo y no oculta errores', () => {
  const fixture=read('scripts/fixtures/editor/node-inspector-professional-ux.html')
  assert.match(fixture,/createProjectData\(/);assert.match(fixture,/unhandledrejection/);assert.match(fixture,/getComputedStyle/)
  const n=(fixture.match(/\bcheck\('/g)||[]).length
  assert.match(fixture,new RegExp('checks.length === '+n))
  assert.match(read('scripts/test-node-inspector-professional-ux-electron.mjs'),new RegExp('minChecks: '+n))
})
