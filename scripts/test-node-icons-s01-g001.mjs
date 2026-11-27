// LF-EDITOR-NODE-ICONS-S01-G001: metadatos visuales, cobertura y coherencia.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFileSync(join(root, file), 'utf8')
const iconVue = read('src/components/Icon.vue')
const defs = [...iconVue.matchAll(/^  (?:'([^']+)'|([a-z][\w-]*)): '([^']+)',?$/gm)]
const available = new Map(defs.map(([,quoted,plain,d]) => [quoted || plain,d]))
const nodes = readdirSync(join(root, 'src/engine/runtime/nodes')).filter(n=>n.endsWith('.js'))
const nodeFiles = Object.fromEntries(nodes.map(name => [name,read('src/engine/runtime/nodes/'+name)]))
const get = (name) => nodeFiles[name]

function validIcon(name) {
  assert.ok(available.has(name), `Icono no definido: ${name}`)
  assert.ok(available.get(name).trim().length > 12, `SVG vacío: ${name}`)
}

test('NI-01 · iconos SVG con claves únicas (sin sobrescritura ramp/tree)', () => {
  assert.ok(available.size > 100)
  assert.equal(defs.length,available.size)
  assert.ok(available.has('tree') && available.has('foliage-tree') && available.has('ramp'))
})
test('NI-02 · cada nombre literal icon del registro y de sus variantes tiene SVG válido', () => {
  let count = 0
  for(const [file,source] of Object.entries(nodeFiles)) for(const [,name] of source.matchAll(/\bicon:\s*'([^']+)'/g)) {validIcon(name);count++}
  assert.ok(count > 35, `Solo ${count} referencias`)
})
test('NI-03 · jerarquía: Node y Node3D tienen iconos reales, no fallback', () => {
  assert.match(get('base.js'),/type: 'node',[^\n]*icon: 'network'/)
  assert.match(get('base.js'),/type: 'node3d',[^\n]*icon: 'move-3d'/)
  validIcon('network');validIcon('move-3d')
  assert.notEqual(available.get('network'),available.get('box'))
})
test('NI-04 · cuatro cuerpos físicos poseen símbolos propios', () => {
  for(const [type,name] of Object.entries({staticbody3d:'static-body',rigidbody3d:'rigid-body',characterbody3d:'character-body',area3d:'area3d'})) {
    assert.match(get('physics.js'),new RegExp(`${type}: '${name}'`));validIcon(name)
  }
  assert.equal(new Set(['static-body','rigid-body','character-body','area3d'].map(x=>available.get(x))).size,4)
  assert.match(get('physics.js'),/icon: BODY_ICONS\[type\]/)
})
test('NI-05 · BoxShape, SphereShape, CapsuleShape usan símbolos geométricos distintos', () => {
  assert.match(get('physics.js'),/icon: `shape-\$\{kind\}`/)
  const shapes=read('src/engine/runtime/physics/shapes.js')
  for(const kind of ['box','sphere','capsule']) { assert.match(shapes,new RegExp(`^  ${kind}:`, 'm'));validIcon('shape-'+kind) }
  assert.equal(new Set(['box','sphere','capsule'].map(k=>available.get('shape-'+k))).size,3)
})
test('NI-06 · geometría y cubo reservado para una primitiva cúbica', () => {
  for(const [file,expected] of Object.entries({'subtract.js':'subtract','gameplay-object.js':'gameplay-object','decal.js':'decal'})) {
    assert.match(get(file),new RegExp(`icon: '${expected}'`));validIcon(expected)
  }
  assert.match(get('primitive.js'),/icon: 'box'/)
})
test('NI-07 · malla editable: rejilla, círculo y toro ya no son plano/esfera', () => {
  const s=read('src/engine/runtime/mesh/generators.js')
  for(const [kind,icon] of Object.entries({grid:'mesh-grid',circle:'mesh-circle',torus:'mesh-torus'})) {
    assert.match(s,new RegExp(`^  ${kind}:.*icon: '${icon}'`,'m'));validIcon(icon)
  }
  for(const prim of ['box','sphere','cone','cylinder','ramp','stairs','plane']) validIcon(prim)
})
test('NI-08 · Sprite2D, Sprite3D y lienzos de píxeles distinguen tipo/variante', () => {
  const s=get('sprite.js')
  for(const name of ['sprite2d','sprite3d','pixel','pixel3d']) validIcon(name)
  assert.match(s,/icon: two \? 'sprite2d' : 'sprite3d'/)
  assert.match(s,/Lienzo de píxeles 2D', icon: 'pixel'/)
  assert.match(s,/Lienzo de píxeles 3D', icon: 'pixel3d'/)
})
test('NI-09 · luces: variantes visuales sin alterar valores de luz', () => {
  const s=get('light.js')
  for(const name of ['light-candle','light-torch','light-neon','light-strobe','light-area','light','spot','sun']) validIcon(name)
  for(const name of ['light-candle','light-torch','light-neon','light-strobe','light-area']) assert.ok(s.includes(`'${name}'`))
  assert.match(s,/energy: 1\.5/)
})
test('NI-10 · agua: río, océano y estanque tienen iconos propios', () => {
  const s=get('water.js')
  for(const name of ['water-river','water-ocean','water-circle']) {validIcon(name);assert.ok(s.includes(`'${name}'`))}
})
test('NI-11 · audio espacial frente a audio de interfaz; Camera Shake diferente a cámara', () => {
  assert.match(get('audio.js'),/audioui: .*icon: 'audio-ui'/)
  assert.match(get('camera-shake.js'),/icon: 'camera-shake'/)
  validIcon('camera-shake');validIcon('audio-ui')
  assert.notEqual(available.get('camera-shake'),available.get('camera'))
})
test('NI-12 · Scene Tree, menú Añadir e Inspector comparten registro de nodos', () => {
  const st=read('src/components/SceneTree.vue'), ins=read('src/components/Inspector.vue'), menu=read('src/components/AddModal.vue')
  assert.match(st, /<Icon :name="kindIcon\(row\.o\)" :size="14"/)
  assert.match(ins, /kindIcon\(obj\.value\)/)
  assert.match(menu, /<Icon :name="item\.icon \|\| 'plus'" :size="14"/)
  assert.match(ins, /<Icon :name="icon" :size="13" \/> CollisionShape3D/)
  assert.match(ins, /<Icon :name="icon" :size="13" \/> CharacterBody3D/)
})
test('NI-13 · se mantienen tamaños del árbol y no se añade iconografía CSS paralela', () => {
  const st=read('src/components/SceneTree.vue')
  assert.match(st,/const ROW_H = 24/)
  assert.match(st, /COLOR\[row\.o\.type\]/)
  assert.doesNotMatch(st,/node-icon-map|iconRegistry|assetIcons/)
})
test('NI-14 · fallback seguro no convierte iconos desconocidos en cubo', () => {
  assert.match(iconVue,/P\[props\.name\] \|\| P\.file/)
  assert.match(iconVue,/aria-hidden="true"/)
  assert.match(iconVue, /viewBox="0 0 24 24"/)
})
test('NI-15 · iconos SVG legibles y sin rutas vacías', () => {
  for(const [name,d] of available) {
    assert.match(d,/^[Mm]/,name)
    assert.doesNotMatch(d,/NaN|Infinity|undefined|null/,name)
  }
})
