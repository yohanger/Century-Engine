import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const panel = readFileSync(new URL('../src/components/ProjectPanel.vue', import.meta.url), 'utf8')
const menu = readFileSync(new URL('../src/components/MenuList.vue', import.meta.url), 'utf8')
const context = readFileSync(new URL('../src/components/ContextMenu.vue', import.meta.url), 'utf8')
const start = panel.indexOf('const createItems = (parent) =>')
const end = panel.indexOf('\nfunction createMenu(e)', start)
assert.ok(start > -1 && end > start)
const createItemsSource = panel.slice(start, end)

function catalog() {
  const calls = []
  const actions = [
    'newFolder', 'newTemporal', 'createNativeCinematicDialog', 'importFilmDialog',
    'addScene', 'newScript', 'newShader', 'newShaderGraph', 'newMaterial',
    'newVfx', 'newGameManager', 'newProfile', 'newUi', 'newPrefab', 'prefabFromSelection',
  ]
  const ctx = {
    ROOT_FOLDER: 'Assets',
    isSystemUiPath: (path) => path === 'Assets/UI/System',
    isCinematicsFolder: (path) => path === 'Assets/Cinematics' || path.startsWith('Assets/Cinematics/'),
  }
  for (const name of actions) ctx[name] = (...args) => { calls.push({ name, args }); return name }
  const createItems = runInNewContext(`${createItemsSource}\ncreateItems`, ctx)
  return { createItems, calls }
}
const labelList = (list) => Array.from(list, (item) => item.label).filter(Boolean)
const get = (list, label) => list.find((item) => item.label === label)
const leaves = (items) => items.flatMap((item) => item.children ? leaves(item.children) : item.label ? [item] : [])

const expectedLeaves = [
  'Carpeta', 'Escena', 'Escena vacía', 'Prefab (vacío)', 'Prefab desde la selección',
  'Timeline', 'Cinematic', 'Importar película de FilmMaker (.nfm)…',
  'Script de Nodo (.js)', 'Script Global (.js)', 'Shader (.glsl)',
  'Shader Graph · Material', 'Shader Graph · Post Processing', 'Material (.material)',
  'Perfil de post-proceso (.post)', 'Efecto VFX (.vfx)',
  'GameManager (.gamemanager)', 'Interfaz (.ui)',
]

test('Crear en Assets conserva todas las acciones y las agrupa sin duplicados', () => {
  const items = catalog().createItems('Assets')
  assert.deepEqual(labelList(items), [
    'Carpeta', 'Escenas', 'Prefabs', 'Cinemáticas', 'Scripts',
    'Shaders y materiales', 'Efecto VFX (.vfx)', 'GameManager (.gamemanager)', 'Interfaz (.ui)',
  ])
  const names = labelList(leaves(items))
  assert.deepEqual([...names].sort(), [...expectedLeaves].sort())
  assert.equal(new Set(names).size, names.length)
  for (const item of items.filter((it) => it.children)) assert.ok(item.children.length >= 2)
  for (const item of leaves(items)) assert.equal(typeof item.run, 'function', item.label)
  assert.equal(items.filter((it) => it.sep).length, 2)
})

test('Las categorías no contienen los recursos individuales y no actúan como acordeón', () => {
  const items = catalog().createItems('Assets')
  assert.deepEqual(labelList(get(items, 'Escenas').children), ['Escena', 'Escena vacía'])
  assert.deepEqual(labelList(get(items, 'Prefabs').children), ['Prefab (vacío)', 'Prefab desde la selección'])
  assert.deepEqual(labelList(get(items, 'Cinemáticas').children), [
    'Timeline', 'Cinematic', 'Importar película de FilmMaker (.nfm)…',
  ])
  assert.deepEqual(labelList(get(items, 'Scripts').children), ['Script de Nodo (.js)', 'Script Global (.js)'])
  assert.deepEqual(labelList(get(items, 'Shaders y materiales').children), [
    'Shader (.glsl)', 'Shader Graph · Material', 'Shader Graph · Post Processing',
    'Material (.material)', 'Perfil de post-proceso (.post)',
  ])
  for (const label of ['Carpeta', 'Efecto VFX (.vfx)', 'GameManager (.gamemanager)', 'Interfaz (.ui)']) {
    assert.equal(get(items, label)?.children, undefined)
  }
})

test('Las carpetas normales conservan las acciones locales, sin opciones de Cinematics exclusivas de raíz', () => {
  const items = catalog().createItems('Assets/Models')
  assert.equal(get(items, 'Cinemáticas'), undefined)
  assert.deepEqual(labelList(leaves(items)), expectedLeaves.filter((x) => ![
    'Timeline', 'Cinematic', 'Importar película de FilmMaker (.nfm)…',
  ].includes(x)))
})

test('Cinematics mantiene su acción exclusiva y la carpeta del sistema sigue protegida', () => {
  const { createItems } = catalog()
  assert.deepEqual(labelList(createItems('Assets/Cinematics')), ['Cinematic'])
  assert.deepEqual(labelList(createItems('Assets/Cinematics/Nested')), ['Cinematic'])
  assert.equal(createItems('Assets/Cinematics')[0].children, undefined)
  assert.equal(createItems('Assets/UI/System').length, 0)
})

test('Las acciones conservan la carpeta destino y los argumentos originales', () => {
  const { createItems, calls } = catalog()
  const root = createItems('Assets')
  const other = createItems('Assets/Models')
  const run = (items, category, name) => get(get(items, category).children, name).run()
  get(root, 'Carpeta').run()
  run(other, 'Escenas', 'Escena')
  run(other, 'Escenas', 'Escena vacía')
  run(other, 'Scripts', 'Script de Nodo (.js)')
  run(other, 'Scripts', 'Script Global (.js)')
  run(other, 'Shaders y materiales', 'Shader Graph · Post Processing')
  run(other, 'Prefabs', 'Prefab desde la selección')
  run(root, 'Cinemáticas', 'Timeline')
  run(root, 'Cinemáticas', 'Cinematic')
  run(root, 'Cinemáticas', 'Importar película de FilmMaker (.nfm)…')
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    { name: 'newFolder', args: ['Assets'] },
    { name: 'addScene', args: ['Escena', { folder: 'Assets/Models' }] },
    { name: 'addScene', args: ['Escena', { folder: 'Assets/Models', empty: true }] },
    { name: 'newScript', args: ['Assets/Models', 'node'] },
    { name: 'newScript', args: ['Assets/Models', 'global'] },
    { name: 'newShaderGraph', args: ['Assets/Models', 'post'] },
    { name: 'prefabFromSelection', args: ['Assets/Models'] },
    { name: 'newTemporal', args: ['Assets'] },
    { name: 'createNativeCinematicDialog', args: [] },
    { name: 'importFilmDialog', args: [] },
  ])
})

test('Las cuatro entradas del Content Browser comparten el mismo catálogo', () => {
  assert.match(panel, /function createMenu\(e\)[\s\S]*?items: createItems\(folder\.value\)/)
  assert.match(panel, /function bgMenu\(e\)[\s\S]*?children: createItems\(folder\.value\)/)
  assert.match(panel, /label: 'Crear aquí', icon: 'plus', children: createItems\(it\.id\)/)
  assert.match(panel, /label: 'Crear aquí', icon: 'plus', disabled: isSystemUiPath\(r\.path\), children: createItems\(r\.path\)/)
})

test('La vista compartida posiciona los submenús lateralmente sin desplazar las filas', () => {
  assert.match(menu, /subStyle\.value = \{ left: r\.right - 2 \+ 'px', top: r\.top - 5 \+ 'px', visibility: 'hidden' \}/)
  assert.match(menu, /r\.right - 2 \+ b\.width > window\.innerWidth - 4 \? Math\.max\(4, r\.left - b\.width \+ 2\) : r\.right - 2/)
  assert.match(menu, /\.sub \{ position: fixed; z-index: 5; \}/)
  assert.match(menu, /@mouseenter="openSub\(\$event, i, it\)"/)
  assert.match(menu, /@keydown="onKeydown"/)
  assert.match(menu, /<MenuList :items="it\.children"/)
  assert.match(context, /<MenuList :items="store\.menu\.items"/)
})
