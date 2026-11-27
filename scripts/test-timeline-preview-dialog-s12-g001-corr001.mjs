import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseMessage, segmentsUpTo, TEXT_COLORS } from '../src/engine/runtime/events/textcodes.js'

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const fixture = read('scripts/fixtures/editor/timeline-preview-dialog-s12-g001.html')

test('S12-G001-CORR001-01 · fixture aislada registra los mismos componentes UI nativos que Editor y Player', () => {
  assert.match(read('src/main.js'), /registerUiComponents\(app\)/)
  assert.match(read('src/runtime-app/main.js'), /registerUiComponents\(app\)/)
  assert.match(fixture, /import \{ registerUiComponents, RtDialogText \} from .*ui\/components\.js/)
  const registration = fixture.indexOf('registerUiComponents(app)')
  const mounting = fixture.indexOf("app.mount('#mount')")
  assert.ok(registration > 0 && registration < mounting)
  assert.match(fixture, /app\.component\('RtDialogText'\) === RtDialogText/)
})

test('S12-G001-CORR001-02 · prueba exige componente real y texto visible, no solo contenedor ni texto oculto', () => {
  assert.match(fixture, /\.rt-dialog-text \.rt-dt-body/)
  assert.match(fixture, /getComputedStyle\(el\)\.visibility\s*!==\s*'hidden'/)
  assert.match(fixture, /'Prueba color'/)
  assert.doesNotMatch(fixture, /textContent\?\.includes\('Prueba'\)/)
})

test('S12-G001-CORR001-03 · la comprobación de C[2] compara el color del DOM con la paleta real', () => {
  const parsed = parseMessage('Prueba\\C[2] color')
  assert.equal(parsed.plain, 'Prueba color')
  const pieces = segmentsUpTo(parsed, parsed.plain.length)
  assert.ok(pieces.some((p) => p.text.includes('color') && p.color === TEXT_COLORS[2]))
  assert.match(fixture, /getComputedStyle\(colored\)\.color\s*===\s*expectedColor/)
  assert.match(fixture, /TEXT_COLORS\[2\]/)
})

test('S12-G001-CORR001-04 · se preserva runner y aislamiento de Preview', () => {
  assert.match(fixture, /preview\.pause\(\)/)
  assert.match(fixture, /preview\.seek\(2\)/)
  assert.match(fixture, /preview\.stop\(\)/)
  assert.match(read('src/components/DialogPreview.vue'), /previewReadOnly: props\.inline/)
  assert.match(read('src/engine/runtime/ui/manager.js'), /if \(c\.setup && !mgr\.host\.previewReadOnly\)/)
})
