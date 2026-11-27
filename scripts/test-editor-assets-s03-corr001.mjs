import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../src/components/ProjectPanel.vue', import.meta.url), 'utf8')
// Run against the actual Vue compiler installed in the project's dependencies.
const { parse, compileTemplate } = require('@vue/compiler-sfc')
test('CORR-001 · plantilla Vue válida sin atributos duplicados', () => {
  const { descriptor, errors } = parse(source, { filename: 'ProjectPanel.vue' })
  assert.deepEqual(errors, [])
  const result = compileTemplate({ source: descriptor.template.content, filename: 'ProjectPanel.vue', id: 'assets-s03-corr001' })
  assert.deepEqual(result.errors, [])
})
test('CORR-002 · ambos estados visuales siguen presentes', () => {
  assert.match(source, /'asset-list': viewMode === 'list', hov: hover === folder/)
  assert.match(source, /@drop="drop\(\$event, folder\)"/)
})
