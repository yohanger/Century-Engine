// S04 CORR-004 — Evitar que los límites globales de diálogos reduzcan el Script Editor.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const globals = read('src/styles.css')
const scriptEditor = read('src/components/ScriptEditor.vue')
const frame = read('src/components/FloatingEditorWindow.vue')
const fixture = read('scripts/fixtures/editor/script-editor-godot-ux-s04-g001-integral.html')
const extract = (text, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = text.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))
  assert.ok(match, `Falta regla ${selector}`)
  return match[1]
}

test('SE-C04-01 · los límites de .edwin globales no se modifican para otros diálogos', () => {
  const css = extract(globals, '.edwin')
  assert.match(css, /max-width\s*:\s*94vw\s*;/)
  assert.match(css, /max-height\s*:\s*min\(82vh/)
  assert.match(frame, /:deep\(\.edwin\)/)
})

test('SE-C04-02 · Script Editor anula explícitamente topes globales sin duplicar componentes', () => {
  const css = extract(scriptEditor, '.edwin.se')
  assert.match(css, /width\s*:\s*100%\s*;/)
  assert.match(css, /height\s*:\s*100%\s*;/)
  assert.match(css, /max-width\s*:\s*none\s*;/)
  assert.match(css, /max-height\s*:\s*none\s*;/)
  assert.match(css, /min-width\s*:\s*0\s*;/)
  assert.match(css, /min-height\s*:\s*0\s*;/)
  assert.match(scriptEditor, /<FloatingEditorWindow[^>]*:integrated-titlebar="true"/)
})

test('SE-C04-03 · su área flex y CodeMirror siguen ocupando el espacio real', () => {
  assert.match(extract(scriptEditor, '.se-workspace'), /flex\s*:\s*1\s*;/)
  assert.match(extract(scriptEditor, '.script-editor'), /flex\s*:\s*1\s*;/)
  assert.match(extract(frame, '.floating-editor-window.has-titlebar'), /flex-direction\s*:\s*column\s*;/)
  assert.match(extract(frame, '.floating-editor-window.has-titlebar :deep(.edwin)'), /flex\s*:\s*1\s*;/)
})

test('SE-C04-04 · Electron verifica límites efectivos y el rectángulo interior del editor', () => {
  assert.match(fixture, /getComputedStyle\(shell\(\)\)/)
  assert.match(fixture, /computedEditor\.maxWidth/)
  assert.match(fixture, /computedEditor\.maxHeight/)
  assert.match(fixture, /Math\.abs\(maximizedEditor\.right-maximizedRect\.right\)<2/)
  assert.match(fixture, /Math\.abs\(maximizedEditor\.bottom-maximizedRect\.bottom\)<2/)
  assert.match(fixture, /cmRect\?\.height>80/)
})
