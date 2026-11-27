import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const ui = read('src/components/PreferencesModal.vue')
const css = ui.split('<style scoped>')[1].split('</style>')[0]
const rules = selector => [...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)].filter(m => m[1].trim() === selector).map(m => m[2])
for (const selector of ['.prefs-nav button', '.section-head']) {
  test(`${selector}: alinea localmente icono y texto a la izquierda`, () => {
    const rule = rules(selector)[0]
    assert.match(rule, /justify-content:\s*flex-start\b/)
    assert.match(rule, /text-align:\s*left\b/)
  })
}
test('Textos de varias líneas ajustables e iconos de ancho fijo', () => {
  assert.match(rules('.prefs-nav button > span, .section-head > span')[0], /min-width:\s*0;\s*overflow-wrap:\s*anywhere/)
  assert.match(read('src/components/Icon.vue'), /\.ic\s*\{\s*flex:\s*none/)
})
test('Conserva estados de selección, plegado y puntos de adaptación', () => {
  assert.match(css, /\.prefs-nav button\.on\s*\{[^}]*background:var\(--blue-wash\)/)
  assert.match(ui, /:aria-pressed="category === c.id && !search.trim\(\)"/)
  assert.match(ui, /:aria-expanded="!closed\(s.id\)"/)
  assert.match(css, /@container win \(max-width:560px\)[\s\S]*flex-wrap:wrap/)
  assert.match(css, /@container win \(max-width:390px\)/)
})
