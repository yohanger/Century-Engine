// Regresión de QA: las fixtures del cielo deben declarar los uniforms del material real.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const source = readFileSync(new URL('src/engine/runtime/render/skylib.js', root), 'utf8')
const viewport = readFileSync(new URL('src/engine/runtime/render/viewport.js', root), 'utf8')
const shader = source.split('export const SKY_FRAG = /* glsl */`')[1]?.split('`')[0] || ''
const allUniforms = [...shader.matchAll(/uniform\s+(?:highp\s+)?\w+\s+([^;]+);/g)]
  .flatMap(([,vars]) => vars.split(',').map(part => part.trim().match(/^(\w+)/)?.[1]).filter(Boolean))
const fixtures = ['tornado-cohesion.html', 'tornado-visual.html']

for (const fixture of fixtures) {
  test(`WU3-EQA: ${fixture} define todos los uniforms del cielo real`, () => {
    const html = readFileSync(new URL(`scripts/fixtures/vfx/${fixture}`, root), 'utf8')
    const missing = allUniforms.filter(name => !new RegExp(`\\b${name}\\s*:`).test(html))
    assert.deepEqual(missing, [], `Faltan uniforms en ${fixture}`)
    assert.ok(allUniforms.length > 50)
    assert.ok(viewport.includes('fragmentShader: SKY_FRAG'))
  })
  test(`WU3-EQA: ${fixture} expone el código GPU y los errores GLSL`, () => {
    const html = readFileSync(new URL(`scripts/fixtures/vfx/${fixture}`, root), 'utf8')
    assert.match(html, /renderer\.debug\.onShaderError/)
    assert.match(html, /ctx\.getError\(\)/)
    assert.match(html, /glError===ctx\.NO_ERROR/)
    assert.match(html, /glsl:shaderDiagnostics/)
  })
}
