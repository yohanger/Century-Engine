// LF-VFX-INSPECTOR-UX-CORR-G001 — regresión UX sin dependencias adicionales.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const vfx = read('src/components/VfxEditor.vue')
const global = read('src/styles.css')
const dock = read('src/components/InspectorDock.vue')
const saves = read('src/core/state/project.js')
const keys = read('src/core/editor/keys.js')
const commands = read('src/core/commands.js')
const harness = read('scripts/fixtures/vfx/s03/ui.html')
const template = vfx.split('<template>')[1].split('</template>')[0]
const styles = vfx.split('<style scoped>')[1].split('</style>')[0]

test('UX-01 los selectores VFX tienen altura legible con padding vertical nulo', () => {
  const css = styles.match(/\.vfx-row select\s*\{([^}]*)\}/)?.[1]
  assert.ok(css)
  assert.match(css, /height:\s*30px/)
  assert.match(css, /padding:\s*0 8px/)
  assert.match(css, /box-sizing:\s*border-box/)
  assert.doesNotMatch(css, /padding:\s*6px/)
})
test('UX-02 el ajuste no altera selectores globales ni otros Inspectores', () => {
  assert.match(global, /input, select, textarea\s*\{[^}]*height:\s*var\(--h\)/s)
  assert.match(vfx, /<style scoped>/)
  assert.match(dock, /<VfxEditor v-else-if=/)
})
test('UX-03 se conservan todos los dropdowns y las cinco secciones', () => {
  for(const group of ['emission','birth','movement','appearance','evolution']) assert.match(vfx, new RegExp(`'${group}'`))
  for(const option of ['Ráfaga','Esfera','Mundo','Procedural (sin textura)','Aditiva']) assert.ok(template.includes(option), option)
  assert.equal((template.match(/<select\b/g)||[]).length, 5)
  assert.match(styles, /\.vfx-row :deep\(\.vfx-texture-slot select\)\s*\{\s*width:100%/)
})
test('UX-04 guardar VFX solo corresponde al flujo general, sin botón local', () => {
  assert.doesNotMatch(vfx, /\bsaveAll\b/)
  assert.doesNotMatch(template, /<button[^>]*>\s*(?:<Icon[^>]*>)?\s*Guardar/)
  assert.doesNotMatch(styles, /\.vfx-footer button/)
  assert.match(saves, /export async function saveAll\(\)/)
  assert.match(keys, /if \(mod && k === 's'\).*saveAll\(\)/)
  assert.match(commands, /'file.save'.*saveAll\(\)/)
})
test('UX-05 se mantiene el commit de Undo/Redo al desmontar y al editar', () => {
  assert.match(vfx, /function confirm\(\)\s*\{ finishVfxEdit\(props.vfxId\) \}/)
  assert.match(vfx, /onBeforeUnmount\(\(\) => \{ confirm\(\); stopPreview\(\) \}\)/)
  assert.match(template, /@commit="confirm"/)
  assert.match(vfx, /updateVfx\(props.vfxId/)
})
test('UX-06 el harness del Editor real comprueba las cinco pestañas y dropdowns', () => {
  assert.match(harness, /Sin botón Guardar redundante en VFX/)
  assert.match(harness, /Dropdown legible en/)
  assert.match(harness, /Dropdown dentro del Inspector/)
  assert.match(harness, /Cinco grupos de propiedades/)
})
