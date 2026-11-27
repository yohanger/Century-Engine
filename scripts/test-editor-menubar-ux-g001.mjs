import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const root = new URL('../src/components/', import.meta.url)
const bar = readFileSync(new URL('MenuBar.vue', root), 'utf8')
const menu = readFileSync(new URL('ContextMenu.vue', root), 'utf8')
test('barra superior conserva comandos existentes y cambia menú al pasar el cursor', () => {
  assert.match(bar, /items\(m\.ids\)/)
  assert.match(bar, /@mouseenter="hoverMenu\(\$event, m\)"/)
  assert.match(bar, /menubar: m\.label/)
})
test('dropdown no bloquea barra superior y respeta Escape y clic exterior', () => {
  assert.match(menu, /\.veil\.dropdown \{ pointer-events: none; \}/)
  assert.match(menu, /\.veil\.dropdown \.pop \{ pointer-events: auto; \}/)
  assert.match(menu, /e\.key === 'Escape'/)
  assert.match(menu, /onPointerDown/)
  assert.match(menu, /positionMenu\(\)/)
})
