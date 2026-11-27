import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const bar = readFileSync(new URL('../src/components/MenuBar.vue', import.meta.url), 'utf8')
const add = readFileSync(new URL('../src/components/AddModal.vue', import.meta.url), 'utf8')
const commands = readFileSync(new URL('../src/core/commands.js', import.meta.url), 'utf8')
test('la barra reconoce Añadir como menú activo y cierra ambos estados antes de cambiar', () => {
  assert.match(bar, /store\.addModal\?\.menubar === 'Añadir'/)
  assert.match(bar, /store\.menu = null\s+store\.addModal = null\s+if \(m\.add\)/)
  assert.match(bar, /activeMenu === m\.label/)
})
test('clic sobre Añadir activo puede cerrarlo sin cierre anticipado en pointerdown', () => {
  assert.match(bar, /toggle && current === m\.label/)
  assert.match(bar, /data-menubar-trigger/)
  assert.match(add, /\[data-menubar-trigger\]/)
})
test('Shift+A cierra dropdown previo sin perder la interfaz especializada de Añadir', () => {
  assert.match(commands, /store\.menu = null \/\/ Añadir/)
  assert.match(commands, /store\.addModal = menu/)
  assert.match(add, /searchAddNodes/)
  assert.match(add, /openBranch/)
})
