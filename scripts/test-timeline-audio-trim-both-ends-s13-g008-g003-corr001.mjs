import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { analyzeAudioBuffer, audioWaveformPeak, audioWaveformPath } from '../src/core/timeline/audio-waveform.js'

const fixturePath = new URL('./fixtures/editor/timeline-audio-trim-both-ends-s13-g008-g003.html', import.meta.url)
const fixture = readFileSync(fixturePath, 'utf8')
const electron = readFileSync(new URL('./test-timeline-audio-trim-both-ends-s13-g008-g003-electron.mjs', import.meta.url), 'utf8')

function syntheticSource() {
  const rate = 16000, length = rate * 6, output = new Float32Array(length)
  const amplitudes = [.04, .82, .12, .53, .23, .67]
  for (let i = 0; i < length; i++) output[i] = Math.sin(2 * Math.PI * 180 * i / rate) * amplitudes[Math.floor(i / rate)]
  return {length, sampleRate:rate, numberOfChannels:1, getChannelData:()=>output}
}

test('TRIM-CORR001-01 · la fixture desplaza el scroll nativo y espera que la onda resulte visible', () => {
  assert.match(fixture, /querySelector\('#timeline \.scroll'\)/)
  assert.match(fixture, /scroller\.scrollLeft\s*=\s*460/)
  assert.match(fixture, /scroller\.dispatchEvent\(new Event\('scroll'/)
  assert.match(fixture, /until\(\(\)=>wave\(\)\?\.dataset\.audioAnalysis==='ready'\s*&&\s*parseFloat\(wave\(\)\.style\.width\)>0/)
})

test('TRIM-CORR001-02 · se usa análisis PCM real, sin crear motor paralelo', () => {
  assert.match(fixture, /requestTimelineAudioAnalysis\(project,asset\.name/)
  assert.match(fixture, /audioWaveformPath\(pcm,key\.duration,key\.offset,key\.pitch,key\.loop,options\)/)
  assert.match(fixture, /audioWaveformPeak\(pcm,key\.duration,key\.offset,key\.pitch,key\.loop\)/)
  assert.doesNotMatch(fixture, /new AudioContext\(|new OfflineAudioContext\(/)
})

test('TRIM-CORR001-03 · se mantiene la aserción fallida original y se comprueba la ruta SVG', () => {
  assert.match(fixture, /check\('Waveform sigue dibujada y desplazada sobre la fuente',actualWaveMatchesSource\(fresh,1\)\)/)
  assert.match(fixture, /path\.getAttribute\('d'\)===expected/)
  assert.match(fixture, /expected!==staleOffset/)
})

test('TRIM-CORR001-04 · se preserva la batería completa, sin rebajar el mínimo Electron', () => {
  const assertions = fixture.split('\n').filter(line => /^\s+check\('/.test(line))
  assert.equal(assertions.length, 46)
  assert.match(electron, /minChecks:46/)
  assert.match(electron, /qa-electron-webgl-runner\.mjs/)
  assert.match(electron, /fixtureWaitMs:55000/)
})

test('TRIM-CORR001-05 · scripts de fixture y test Electron son sintácticamente válidos', () => {
  const js = fixture.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(js)
  const nodeCheck = spawnSync(process.execPath, ['--input-type=module', '--check', '-'], {input:js, encoding:'utf8'})
  assert.equal(nodeCheck.status, 0, nodeCheck.stderr)
  const fileCheck = spawnSync(process.execPath, ['--check', new URL('./test-timeline-audio-trim-both-ends-s13-g008-g003-electron.mjs', import.meta.url).pathname], {encoding:'utf8'})
  assert.equal(fileCheck.status, 0, fileCheck.stderr)
})

test('TRIM-CORR001-06 · la muestra sintética identifica secciones de intensidad diferentes', async () => {
  const source=syntheticSource()
  const pcm=await analyzeAudioBuffer(source, new AbortController().signal, async()=>{})
  const peakAt=(second)=>{
    let peak=0
    const a=Math.floor((second+.15)*pcm.low.length/pcm.duration),b=Math.ceil((second+.85)*pcm.low.length/pcm.duration)
    for(let i=a;i<Math.min(b,pcm.low.length);i++)peak=Math.max(peak,Math.abs(pcm.low[i]),Math.abs(pcm.high[i]))
    return peak
  }
  assert.ok(peakAt(1)>peakAt(0)*5)
  assert.ok(peakAt(3)>peakAt(2)*2)
})

test('TRIM-CORR001-07 · el trazado PCM distingue offset 1 frente a offset 0', async () => {
  const pcm=await analyzeAudioBuffer(syntheticSource(),new AbortController().signal,async()=>{})
  const duration=5, columns=350
  const original=audioWaveformPath(pcm,duration,0,1,false,{columns,startTime:0,endTime:duration,peak:audioWaveformPeak(pcm,duration,1,1,false)})
  const trimmed=audioWaveformPath(pcm,duration,1,1,false,{columns,startTime:0,endTime:duration,peak:audioWaveformPeak(pcm,duration,1,1,false)})
  assert.ok(trimmed.startsWith('M'))
  assert.notEqual(trimmed,original)
})

test('TRIM-CORR001-08 · la waveform fuera del rango visible puede quedar sin trazado y no es un fallo de audio', async () => {
  const pcm=await analyzeAudioBuffer(syntheticSource(),new AbortController().signal,async()=>{})
  assert.equal(audioWaveformPath(pcm,0,1,1,false,{columns:1,startTime:0,endTime:0}),'')
  assert.ok(audioWaveformPath(pcm,5,1,1,false,{columns:64,startTime:0,endTime:2}).length>0)
})
