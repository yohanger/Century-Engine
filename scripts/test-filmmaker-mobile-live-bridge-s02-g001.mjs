import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = (p) => readFileSync(path.join(root, p), 'utf8')
const { createFilmMobileBridge } = require('../electron/filmmaker-mobile-bridge.cjs')
const hmac = (pin, text) => crypto.createHmac('sha256', pin).update(text).digest('hex')
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex')
const production = { filmId: 'film_123', sceneId: 'scene_A', projectId: 'project_1', sceneName: 'Bosque' }
const offer = { type: 'offer', sdp: 'v=0\r\na=ice-ufrag:PC\r\n' }
const answer = { type: 'answer', sdp: 'v=0\r\na=ice-ufrag:ANDROID\r\n' }
const post = async (port, body) => {
  const result = await fetch(`http://127.0.0.1:${port}/bridge`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return { status: result.status, data: await result.json() }
}

test('S02-01: emparejamiento HMAC, producción y respuesta WebRTC autenticada', async () => {
  const received = []
  const service = createFilmMobileBridge({ onAnswer: (owner, a, ticket) => received.push({ owner, a, ticket }) })
  try {
    const info = await service.start(77, offer, production)
    assert.match(info.code, /^\d{12}$/)
    assert.ok(info.port > 0)
    assert.ok(info.host)
    const nonce = crypto.randomBytes(16).toString('hex')
    const reply = await post(info.port, { version: 1, type: 'pair', nonce, proof: hmac(info.code, `pair|${nonce}`) })
    assert.equal(reply.status, 200)
    assert.deepEqual(reply.data.production, production)
    assert.equal(reply.data.proof, hmac(info.code, `offer|${digest(JSON.stringify(offer))}`))
    const paired = await post(info.port, { version: 1, type: 'answer', ticket: reply.data.ticket, answer, proof: hmac(info.code, `answer|${digest(JSON.stringify(answer))}`) })
    assert.equal(paired.status, 200)
    assert.equal(paired.data.accepted, true)
    assert.deepEqual(received.map((r) => [r.owner, r.a]), [[77, answer]])
    assert.equal((await post(info.port, { version: 1, type: 'answer', ticket: reply.data.ticket, answer, proof: hmac(info.code, `answer|${digest(JSON.stringify(answer))}`) })).status, 403)
  } finally { service.stop() }
})

test('S02-02: PIN incorrecto rechazado y cinco intentos bloquean la sesión', async () => {
  const service = createFilmMobileBridge()
  try {
    const info = await service.start(77, offer, production)
    for (let i = 0; i < 5; i++) {
      const nonce = crypto.randomBytes(16).toString('hex')
      const outcome = await post(info.port, { version: 1, type: 'pair', nonce, proof: '0'.repeat(64) })
      assert.equal(outcome.status, 403)
    }
    const nonce = crypto.randomBytes(16).toString('hex')
    assert.equal((await post(info.port, { version: 1, type: 'pair', nonce, proof: hmac(info.code, `pair|${nonce}`) })).status, 429)
  } finally { service.stop() }
})

test('S02-03: una sesión a la vez, rechazo de mensajes arbitrarios y scopes incorrectos', async () => {
  const service = createFilmMobileBridge()
  try {
    await assert.rejects(() => service.start(1, offer, { filmId: '', sceneId: 'a', projectId: 'p' }), /identidad/i)
    const info = await service.start(77, offer, production)
    await assert.rejects(() => service.start(78, offer, production), /existe una cámara/i)
    assert.equal(service.isOwner(77), true)
    assert.equal(service.isOwner(78), false)
    assert.equal((await post(info.port, { version: 1, type: 'execute', command: 'rm -rf /', filmId: 'x' })).status, 400)
    service.stopIfOwner(78)
    assert.equal(service.state().running, true)
    service.stopIfOwner(77)
    assert.equal(service.state().running, false)
  } finally { service.stop() }
})

test('S02-04: formato y límites de señalización restringidos', async () => {
  const service = createFilmMobileBridge()
  try {
    const info = await service.start(77, offer, production)
    assert.equal((await post(info.port, { version: 10, type: 'pair' })).status, 400)
    assert.equal((await post(info.port, { version: 1, type: 'pair', nonce: 'x', proof: 'x' })).status, 403)
    const r = await fetch(`http://127.0.0.1:${info.port}/bridge`, { method: 'POST', body: 'x'.repeat(110_000) })
    assert.equal(r.status, 413)
  } finally { service.stop() }
})

test('S02-05: Electron expone IPC acotado a FilmMaker y cierra al navegar/salir', () => {
  const main = source('electron/main.cjs')
  const preload = source('electron/preload.cjs')
  assert.match(main, /isFilmWindow\(event\.sender\)/)
  assert.match(main, /const rendererId = win\.webContents\.id/)
  assert.match(main, /filmBridge\.stopIfOwner\(rendererId\)/)
  assert.match(preload, /filmMobileBridge:/)
  assert.doesNotMatch(source('electron/vscode-bridge.cjs'), /filmMobileBridge/)
})

test('S02-06: el monitor captura canvas real; vídeo y orientación viajan por WebRTC', () => {
  const desktop = source('src/filmmaker/mobile-live-bridge.js')
  const android = source('src/filmmaker/mobile-live-monitor.js')
  assert.match(desktop, /editor\.vp\?\.renderer\?\.domElement/)
  assert.match(desktop, /captureStream\(10\)/)
  assert.match(desktop, /RTCPeerConnection\(\{ iceServers: \[\] \}\)/)
  assert.match(android, /RTCPeerConnection\(\{ iceServers: \[\] \}\)/)
  assert.match(android, /CapacitorHttp\.post/)
  assert.match(android, /crypto\.subtle/)
})

test('S02-07: rotación nativa, pausa y liberación; sin posición inventada', () => {
  const native = source('filmmaker-mobile/android/app/src/main/java/com/levelforge/netherfilmmaker/MobileCapabilitiesPlugin.java')
  const rig = source('src/filmmaker/operator.js')
  assert.match(native, /startRemoteOrientation\(PluginCall call\)/)
  assert.match(native, /stopRemoteSensor\(\);\s*if \(activePoseProbe/)
  assert.match(native, /notifyListeners\("remoteOrientation", sample\)/)
  assert.match(rig, /setRemoteOrientation\(values\)/)
  assert.match(rig, /this\.input !== 'ar' && this\.input !== 'remote'/)
  assert.match(rig, /this\.input === 'remote' && this\._remote/)
})

test('S02-08: sin grabación remota ni escrituras de proyectos', () => {
  const desktop = source('src/filmmaker/mobile-live-bridge.js')
  const android = source('src/filmmaker/mobile-live-monitor.js')
  const session = source('src/filmmaker/session.js')
  assert.match(session, /export function beginRemotePreview\(\)/)
  assert.match(session, /export function stopRemotePreview\(\)/)
  assert.doesNotMatch(desktop + android, /startPass\(|buildNfm\(|writeFiles\(|startRecording\(/)
  assert.match(source('src/filmmaker/FilmApp.vue'), /:mobile-link="mobileLink"/)
  assert.match(source('src/filmmaker/MobileCapabilities.vue'), /data-test="mobile-live-monitor"/)
})

test('S02-09: primera imagen y edad de fotogramas gobiernan el control, no el socket', () => {
  const android = source('src/filmmaker/mobile-live-monitor.js')
  const pc = source('src/filmmaker/mobile-live-bridge.js')
  assert.match(android, /lastDecodedAt/)
  assert.match(android, /state\.monitoring = fresh/)
  assert.match(pc, /state\.monitorFresh/)
  assert.match(pc, /performance\.now\(\) - monitorAt > 2500/)
})

test('S02-10: no se cambia la .nfm, ni el editor/player ni la definición de S01A', () => {
  const s01a = source('src/filmmaker/mobile-visual-tracking-contract.mjs')
  assert.match(s01a, /VISUAL_FRAME_LIMIT/)
  assert.match(source('src/filmmaker/main.js'), /import\('\.\/FilmApp\.vue'\)/)
  assert.match(source('filmmaker-mobile/capacitor.config.json'), /androidScheme/)
})


test('S02-11: desconexión elimina escucha, callback de vídeo y adquisición nativa asincrónica', () => {
  const mobile = source('src/filmmaker/mobile-live-monitor.js')
  assert.match(mobile, /connectionId/)
  assert.match(mobile, /if \(stopped \|\| activeId !== connectionId\)/)
  assert.match(mobile, /await listener\.remove\(\)/)
  assert.match(mobile, /removeEventListener\('timeupdate', fallbackFrame\)/)
  assert.match(mobile, /await device\.stopRemoteOrientation\(\)/)
})

test('S02-12: la señalización anuncia IP alternativas y la conexión tiene tiempo límite', () => {
  const pc = source('src/filmmaker/mobile-live-bridge.js')
  const client = source('src/filmmaker/mobile-live-monitor.js')
  assert.match(source('electron/filmmaker-mobile-bridge.cjs'), /hosts: hosts\(\)/)
  assert.match(pc, /state\.hosts = \(info\.hosts \|\| \[\]\)/)
  assert.match(source('src/filmmaker/panels/CameraPanel.vue'), /mobileLink\.state\.hosts/)
  assert.match(client, /setTimeout\(\(\) => \{[\s\S]*?15 segundos/)
})


test('S02-13: FilmMaker informa al usuario los errores de arranque del enlace', () => {
  const panel = source('src/filmmaker/panels/CameraPanel.vue')
  assert.match(panel, /mobileLink\.start\(\)\.catch\(e => toast/)
})
