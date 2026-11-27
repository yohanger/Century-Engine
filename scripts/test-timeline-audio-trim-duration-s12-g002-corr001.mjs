import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { audioWaveformPath } from '../src/core/timeline/audio-waveform.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(resolve(root, 'src/components/TimelineAudioSource.vue'), 'utf8')
const normalScript = source.match(/<script>([\s\S]*?)<\/script>/)?.[1] || ''
const setupScript = source.match(/<script setup>([\s\S]*?)<\/script>/)?.[1] || ''

test('S12-G002-CORR001-01 · audioWaveformPath declarado en el componente y renderiza los extremos PCM', () => {
  assert.match(setupScript, /import\s*\{\s*audioWaveformPath\s*\}\s*from\s*['"]\.\.\/core\/timeline\/audio-waveform\.js['"]/) 
  assert.match(setupScript, /waveform\s*=\s*computed\(\(\)\s*=>\s*audioWaveformPath\(result\.value\?\.data/)
  const pcm = { duration: 1, low: new Float32Array([-0.4,-0.8,-0.2,-0.6]), high: new Float32Array([0.4,0.8,0.2,0.6]), min: -0.8, max: 0.8 }
  assert.match(audioWaveformPath(pcm,1,0,1,false), /^M\d/)
})

test('S12-G002-CORR001-02 · el observer y su mapa se declaran en alcance compartido, no por clip', () => {
  assert.match(normalScript, /let\s+observer\b/)
  assert.match(normalScript, /const\s+observed\s*=\s*new\s+Map\(\)/)
  assert.doesNotMatch(setupScript, /(?:let|const|var)\s+observer\b/)
  assert.doesNotMatch(setupScript, /(?:let|const|var)\s+observed\b/)
  assert.match(setupScript, /observer\s*\?\?=\s*new IntersectionObserver/)
  assert.match(setupScript, /observed\.get\(entry\.target\)\?\.\(entry\.isIntersecting\)/)
})

test('S12-G002-CORR001-03 · montaje y limpieza liberan targets y observador sin fuga', () => {
  assert.match(setupScript, /observed\.set\(surface\.value/)
  assert.match(setupScript, /observer\.observe\(surface\.value\)/)
  assert.match(setupScript, /observer\?\.unobserve\(surface\.value\)/)
  assert.match(setupScript, /observed\.delete\(surface\.value\)/)
  assert.match(setupScript, /if\s*\(observed\.size\s*===\s*0\s*&&\s*observer\)/)
  assert.match(setupScript, /observer\.disconnect\(\)/)
  assert.match(setupScript, /observer\s*=\s*null/)
  assert.match(setupScript, /typeof IntersectionObserver\s*===\s*'undefined'/)
})

test('S12-G002-CORR001-04 · cola compartida y emisión de duración permanecen intactas', () => {
  assert.match(setupScript, /requestTimelineAudioAnalysis\(store\.project,\s*props\.clip/)
  assert.match(setupScript, /emit\('source-duration',\s*value\.status\s*===\s*'ready'\s*\?\s*value\.data\.duration\s*:\s*null\)/)
  assert.doesNotMatch(setupScript, /new OfflineAudioContext|createAudioAnalysisQueue\(/)
  assert.match(source, /<svg\s+v-else\s+ref="surface"/)
  assert.match(source, /<path\s+v-if="waveform"/)
})
