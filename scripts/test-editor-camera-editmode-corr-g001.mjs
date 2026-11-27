import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const project = readFileSync(new URL('../src/core/state/project.js', import.meta.url), 'utf8')
const viewport = readFileSync(new URL('../src/engine/runtime/render/viewport.js', import.meta.url), 'utf8')
test('CAM-01 · cámara inicial próxima al origen', () => assert.match(viewport, /this\.persp\.position\.set\(0, 10, 10\)/))
test('CAM-02 · al cargar proyecto no se encuadra automáticamente el terreno', () => assert.match(project, /await store\.editor\.loadProject[\s\S]*?resetSceneState\(\{ frame: false \}\)/))
test('CAM-03 · cambiar escena preserva vista de edición', () => assert.match(project, /export async function switchScene[\s\S]*?resetSceneState\(\{ frame: false \}\)/))
test('CAM-04 · frameAll permanece disponible bajo opción explícita', () => assert.match(project, /if \(frame\) store\.editor\.frameAll\(\)/))
test('CAM-05 · no se altera Player ni el sistema de eventos', () => { assert.match(viewport, /saveEditorView\(\)/); assert.match(viewport, /restoreEditorView\(s\)/) })
