// Contrato QA S13-G011: espaciamiento del Inspector de nodos, sin alterar datos ni plegado.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const inspector = read('src/components/Inspector.vue')
const shared = read('src/styles.css')
const dock = read('src/components/InspectorDock.vue')
const fixture = read('scripts/fixtures/editor/inspector-node-spacing-s13-g011-g001.html')
const runner = read('scripts/test-inspector-node-spacing-s13-g011-g001-electron.mjs')
const spacing = inspector.slice(inspector.indexOf('/* Ficha compacta'), inspector.indexOf('/* Señal discreta al soltar'))

const checks = [
  ['SPACE-01 · mismo Inspector original sin otro panel', () => { assert.match(inspector, /class="head node-head"/); assert.equal((inspector.match(/<InspectorDock/g)||[]).length, 0) }],
  ['SPACE-02 · padding superior e inferior del encabezado de nodo', () => assert.match(spacing, /\.insp > \.node-head \{ padding: 6px 7px;/)],
  ['SPACE-03 · separación interna uniforme sin alterar nombres', () => { assert.match(spacing,/\.insp > \.node-head \.hcol \{ gap: 4px; \}/); assert.match(inspector, /<TextField v-else class="name"/) }],
  ['SPACE-04 · DontDestroyOnLoad obtiene columna flexible y checkbox intacto', () => { assert.match(spacing, /\.node-properties \.field \{ grid-template-columns: minmax\(0, 1fr\) auto;/); assert.match(inspector, /<label>DontDestroyOnLoad<\/label><input type="checkbox"/) }],
  ['SPACE-05 · encabezados de secciones sin recortar controles', () => { assert.match(dock, /\.insp > \.sect > header\) \{\s*min-height: 28px;/); assert.match(inspector, /@click\.stop="resetTransform"/) }],
  ['SPACE-06 · padding de cuerpos del nodo exclusivamente', () => assert.match(spacing, /\.insp > \.sect > \.body \{ padding: 8px 12px 10px; \}/)],
  ['SPACE-07 · filas con altura y separación legibles', () => { assert.match(spacing, /\.insp > \.sect > \.body > \.field \{ min-height: 25px; \}/); assert.match(spacing, /\.field \+ \.field \{ margin-top: 4px; \}/) }],
  ['SPACE-08 · variante primitiva conserva su composición y adquiere espacio', () => { assert.match(spacing, /\.insp\[data-node-type='primitive'\] > \.sect\[data-primitive-section\] > \.body/); assert.match(inspector, /:deep\(\.mr-primitive \.field\)/) }],
  ['SPACE-09 · responsividad recupera ancho útil bajo 260 px', () => { assert.match(spacing, /@container insp \(max-width: 260px\)/); assert.match(spacing, /grid-template-columns: var\(--transform-label\) minmax\(0, 1fr\)/); assert.match(shared, /\.idock \.scroll \{ container: insp \/ inline-size; \}/) }],
  ['SPACE-10 · no cambia tamaño ni comportamiento de Vec3Field', () => { assert.match(inspector, /<Vec3Field :model-value="obj.position"/); assert.match(inspector, /<Vec3Field :model-value="shape3d.size"/) }],
  ['SPACE-11 · no toca preferencias de plegado ni callbacks', () => { assert.match(dock, /store\.prefs\.inspFold/); assert.match(inspector, /data-fold-id="transform"/); assert.match(inspector, /data-fold-id="collision-shape"/) }],
  ['SPACE-12 · no altera CSS compartido de ventanas ni escenas', () => { assert.match(spacing, /\.insp > \.node-head/); assert.doesNotMatch(spacing, /\.scenehead|\.edwin|\.tlp/); assert.match(shared,/\.sect > \.body \{ padding: 6px 10px 10px 12px; \}/) }],
  ['SPACE-13 · fixture Electron usa componentes originales, no una maqueta', () => { assert.match(fixture,/import\('\/src\/components\/InspectorDock.vue'\)/); assert.match(fixture,/getComputedStyle/); assert.match(fixture,/createProjectData/); assert.match(fixture,/makeObject/); assert.match(fixture,/WebGLRenderer/) }],
  ['SPACE-14 · runner sigue usando QA Electron y WebGL embebidos', () => { assert.match(runner,/verifyWebGL\(/); assert.match(runner,/minChecks:25/); assert.match(runner,/port:44572/) }],
  ['SPACE-15 · recuento exacto y protección contra falso PASS', () => { const calls=[...fixture.matchAll(/^  check\('/gm)]; assert.equal(calls.length,25); assert.match(fixture,/checks\.length===25&&checks\.every\(c=>c\.pass\)/); assert.match(fixture,/if\(!pass\)throw Error/) }],
  ['SPACE-16 · scripts de fixture Electron conservan sintaxis', () => { const scripts=[...fixture.matchAll(/<script(?: type="module")?>([\s\S]*?)<\/script>/g)].map(m=>m[1]); assert.equal(scripts.length,2); const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor; new Function(scripts[0]); new AsyncFunction(scripts[1]) }],
]

for (const [name,fn] of checks) test(name,fn)
