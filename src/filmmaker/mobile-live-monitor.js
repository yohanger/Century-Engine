// Cliente Android del monitor S02; emplea HTTP nativo solo para señalización local autenticada.
// Vídeo y orientación van cifrados por DTLS/SRTP del navegador, sin transferir la escena al móvil.
import { reactive } from 'vue'
import { CapacitorHttp } from '@capacitor/core'

const bytes = (value) => new TextEncoder().encode(value)
const toHex = (array) => [...array].map((v) => v.toString(16).padStart(2, '0')).join('')
const hash = async (value) => toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes(value))))
async function hmac(pin, value) {
  const key = await crypto.subtle.importKey('raw', bytes(pin), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(new Uint8Array(await crypto.subtle.sign('HMAC', key, bytes(value))))
}
const gatherIce = (pc) => new Promise((resolve, reject) => {
  if (pc.iceGatheringState === 'complete') { resolve(); return }
  const timeout = setTimeout(() => { pc.removeEventListener('icegatheringstatechange', check); reject(new Error('ICE Android no completó en 8 segundos')) }, 8000)
  function check() { if (pc.iceGatheringState === 'complete') { clearTimeout(timeout); pc.removeEventListener('icegatheringstatechange', check); resolve() } }
  pc.addEventListener('icegatheringstatechange', check)
})
const validLanHost = (value) => /^(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):\d{1,5}$/.test(value) && Number(value.split(':')[1]) > 0 && Number(value.split(':')[1]) <= 65535

export function createMobileLiveMonitor(device, getVideo) {
  const state = reactive({ address: '', code: '', phase: 'idle', error: '', framesDecoded: 0, samplesSent: 0, latencyMs: null, monitoring: false, productionName: '', rttP50: null, rttP95: null, videoFps: null, videoWidth: null, videoHeight: null, bitrateKbps: null, videoLatencyP50: null, videoLatencyP95: null, processCpuPercent: null, processPssMiB: null, availableSystemMiB: null, staleMs: null })
  let pc = null, channel = null, orientationListener = null, timer = null, connectTimeout = null, frameCallback = 0, seq = 0, lastDecodedAt = 0, lastSampleAt = 0, stopped = false, rtts = [], connectionId = 0, lastVideoTime = -1, lastStats = null, lastCpu = null, latencies = [], statsBusy = false, statsCount = 0, framesAtStats = 0, statsAt = 0
  const send = (type, payload = {}) => {
    if (channel?.readyState !== 'open') return false
    channel.send(JSON.stringify({ version: 1, type, seq: ++seq, ...payload }))
    return true
  }
  function reportFrame(_now, metadata) {
    if (stopped) return
    const video = getVideo()
    if (!video || video.readyState < 2 || video.paused) return
    // Un callback de vídeo procesado, no la mera presencia de un elemento <video>.
    state.framesDecoded++
    lastDecodedAt = performance.now()
    state.monitoring = true
    state.videoWidth = metadata?.width || video.videoWidth || null
    state.videoHeight = metadata?.height || video.videoHeight || null
    if (Number.isFinite(metadata?.captureTime)) {
      // captureTime: hora estimada de captura expresada en la escala del receptor.
      const delay = performance.now() - metadata.captureTime
      if (delay >= 0 && delay < 10000) {
        latencies.push(delay); if (latencies.length > 60) latencies.shift()
        const sorted = [...latencies].sort((a, b) => a - b)
        state.videoLatencyP50 = Math.round(sorted[Math.floor((sorted.length - 1) * .5)])
        state.videoLatencyP95 = Math.round(sorted[Math.floor((sorted.length - 1) * .95)])
      }
    }
    if (video.requestVideoFrameCallback) frameCallback = video.requestVideoFrameCallback(reportFrame)
  }
  function fallbackFrame() {
    const v = getVideo()
    if (!v || v.currentTime <= lastVideoTime) return
    lastVideoTime = v.currentTime
    reportFrame()
  }
  async function measure(id) {
    if (statsBusy || !pc || stopped || id !== connectionId) return
    statsBusy = true
    try {
      const stamp = performance.now(), current = pc
      const results = await current.getStats()
      if (stopped || id !== connectionId || current !== pc) return
      const seconds = statsAt ? (stamp - statsAt) / 1000 : 0
      if (seconds > 0.3) state.videoFps = Math.round((state.framesDecoded - framesAtStats) / seconds * 10) / 10
      framesAtStats = state.framesDecoded; statsAt = stamp
      for (const stat of results.values()) {
        if (stat.type !== 'inbound-rtp' || (stat.kind || stat.mediaType) !== 'video' || !Number.isFinite(stat.bytesReceived)) continue
        if (lastStats && stat.timestamp > lastStats.time) {
          state.bitrateKbps = Math.max(0, Math.round((stat.bytesReceived - lastStats.bytes) * 8 / ((stat.timestamp - lastStats.time) / 1000) / 1000))
        }
        lastStats = { time: stat.timestamp, bytes: stat.bytesReceived }
      }
      const resources = await device.monitorResources()
      if (stopped || id !== connectionId) return
      if (lastCpu && resources.elapsedMs > lastCpu.time) {
        const cpu = (resources.cpuTimeMs - lastCpu.cpu) / (resources.elapsedMs - lastCpu.time) * 100
        state.processCpuPercent = Number.isFinite(cpu) && cpu >= 0 ? Math.round(cpu * 10) / 10 : null
      }
      lastCpu = { time: resources.elapsedMs, cpu: resources.cpuTimeMs }
      state.processPssMiB = Number.isFinite(resources.processPssMiB) ? resources.processPssMiB : null
      state.availableSystemMiB = Number.isFinite(resources.availableSystemMiB) ? resources.availableSystemMiB : null
    } catch { /* Las estadísticas son diagnósticas; no interrumpen la cámara. */ }
    finally { statsBusy = false }
  }
  async function signal(address, packet) {
    const res = await CapacitorHttp.post({
      url: `http://${address}/bridge`,
      headers: { 'Content-Type': 'application/json' },
      data: packet,
      connectTimeout: 6000,
      readTimeout: 12000,
    })
    const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
    if (res.status !== 200) throw new Error(data?.error || `Señalización HTTP ${res.status}`)
    return data
  }
  const disconnect = async () => {
    ++connectionId
    stopped = true
    clearInterval(timer); timer = null
    clearTimeout(connectTimeout); connectTimeout = null
    const v = getVideo()
    if (v?.cancelVideoFrameCallback && frameCallback) v.cancelVideoFrameCallback(frameCallback)
    v?.removeEventListener('timeupdate', fallbackFrame)
    frameCallback = 0
    statsBusy = false; lastStats = lastCpu = null; latencies = []; statsCount = 0; statsAt = framesAtStats = 0; lastVideoTime = -1
    try { await device.stopRemoteOrientation() } catch { /* plugin suspendido */ }
    try { await orientationListener?.remove() } catch { /* ya cerrada */ }
    orientationListener = null
    try { channel?.close() } catch { /* ya cerrada */ }
    try { pc?.close() } catch { /* ya cerrada */ }
    if (v) { v.pause(); v.srcObject = null }
    channel = pc = null
    lastDecodedAt = 0; state.monitoring = false; state.phase = 'idle'; state.latencyMs = null; rtts = []; state.rttP50 = state.rttP95 = state.staleMs = null; state.productionName = ''; state.videoFps = state.bitrateKbps = state.videoWidth = state.videoHeight = state.videoLatencyP50 = state.videoLatencyP95 = state.processCpuPercent = state.processPssMiB = state.availableSystemMiB = state.staleMs = null
  }
  async function connect() {
    if (state.phase !== 'idle' && state.phase !== 'error') return
    if (!validLanHost(state.address)) throw new Error('Introduce una dirección IPv4 privada y puerto, por ejemplo 192.168.1.2:45000')
    const pin = state.code.replace(/[\s-]/g, '')
    if (!/^\d{12}$/.test(pin)) throw new Error('Introduce los 12 dígitos del código que muestra FilmMaker')
    await disconnect()
    stopped = false; state.phase = 'pairing'; state.error = ''; state.framesDecoded = 0; state.samplesSent = 0; seq = 0
    const activeId = ++connectionId
    try {
      if (!globalThis.crypto?.subtle || !window.RTCPeerConnection) throw new Error('El WebView no admite cifrado WebCrypto o WebRTC')
      const nonce = toHex(crypto.getRandomValues(new Uint8Array(16)))
      const result = await signal(state.address, { version: 1, type: 'pair', nonce, proof: await hmac(pin, `pair|${nonce}`) })
      if (result?.version !== 1 || !result.offer?.sdp || typeof result.ticket !== 'string' || typeof result.production?.filmId !== 'string' || typeof result.production.sceneId !== 'string') throw new Error('Oferta LAN incompatible')
      const serializedOffer = JSON.stringify({ type: 'offer', sdp: result.offer.sdp })
      if (result.proof !== await hmac(pin, `offer|${await hash(serializedOffer)}`)) throw new Error('Oferta PC no autenticada: no conectar')
      state.productionName = result.production.sceneName || result.production.sceneId || 'Escena';
      pc = new RTCPeerConnection({ iceServers: [] })
      pc.ondatachannel = (event) => {
        if (event.channel.label !== 'lf-camera-orientation') { event.channel.close(); return }
        channel = event.channel
        channel.onmessage = (message) => {
          let packet
          try { packet = JSON.parse(message.data) } catch { return }
          if (packet?.version !== 1 || packet.type !== 'pong' || typeof packet.sentAt !== 'number') return
          const value = performance.now() - packet.sentAt
          if (value < 0 || value > 30000) return
          rtts.push(value); if (rtts.length > 60) rtts.shift()
          const sorted = [...rtts].sort((a, b) => a - b)
          state.rttP50 = Math.round(sorted[Math.floor((sorted.length - 1) * .5)])
          state.rttP95 = Math.round(sorted[Math.floor((sorted.length - 1) * .95)])
        }
        channel.onopen = async () => {
          if (stopped || activeId !== connectionId) return
          clearTimeout(connectTimeout); connectTimeout = null
          state.phase = 'connected'
          let listener
          try { listener = await device.addListener('remoteOrientation', (sample) => {
            if (!state.monitoring || performance.now() - lastDecodedAt > 2500 || document.hidden) return
            if (performance.now() - lastSampleAt < 50) return
            lastSampleAt = performance.now()
            const q = sample?.quaternionXYZW
            if (Array.isArray(q) && q.length === 4 && q.every((v) => typeof v === 'number' && Number.isFinite(v))) {
              if (send('orientation', { quaternionXYZW: q })) state.samplesSent++
            }
          }) } catch (e) {
            if (!stopped && activeId === connectionId) { state.error = 'No se pudo escuchar la orientación: ' + (e.message || e); state.phase = 'sensor-error' }
            return
          }
          if (stopped || activeId !== connectionId) { await listener.remove(); return }
          orientationListener = listener
          try { await device.startRemoteOrientation() }
          catch (e) { if (!stopped && activeId === connectionId) { state.error = 'Sensor no disponible: ' + (e.message || e); state.phase = 'sensor-error' } }
          if (stopped || activeId !== connectionId) { try { await device.stopRemoteOrientation() } catch { /* desconexión simultánea */ }; return }
          timer = setInterval(() => {
            const age = lastDecodedAt ? performance.now() - lastDecodedAt : null
            state.staleMs = age == null ? null : Math.round(age)
            const fresh = !document.hidden && age != null && age <= 2500 && getVideo()?.readyState >= 2 && !getVideo()?.paused
            state.monitoring = fresh
            send('monitor', { fresh, frames: state.framesDecoded })
            send('ping', { sentAt: performance.now() })
            if (++statsCount % 4 === 0) void measure(activeId)
            if (!fresh && state.phase === 'connected') state.phase = 'monitor-stale'
            else if (fresh && state.phase === 'monitor-stale') state.phase = 'connected'
          }, 500)
        }
        channel.onclose = () => {
          if (stopped || activeId !== connectionId) return
          const closingId = connectionId
          void disconnect().then(() => {
            if (connectionId === closingId + 1) {
              state.error = 'Canal de control cerrado. Vuelve a vincular el teléfono.'
              state.phase = 'error'
            }
          })
        }
      }
      pc.ontrack = async (event) => {
        if (stopped || activeId !== connectionId) return
        const video = getVideo()
        if (!video || event.track.kind !== 'video') return
        video.srcObject = event.streams[0] || new MediaStream([event.track])
        try { await video.play() } catch (err) { if (!stopped && activeId === connectionId) state.error = 'La reproducción del monitor fue bloqueada: ' + (err.message || err) }
        if (stopped || activeId !== connectionId) return
        if (video.requestVideoFrameCallback) frameCallback = video.requestVideoFrameCallback(reportFrame)
        else {
          video.addEventListener('timeupdate', fallbackFrame)
        }
      }
      pc.onconnectionstatechange = () => {
        if (!stopped && activeId === connectionId && (pc?.connectionState === 'failed' || pc?.connectionState === 'closed')) {
          const closingId = connectionId
          void disconnect().then(() => {
            if (connectionId === closingId + 1) {
              state.error = 'Conexión WebRTC perdida. Vuelve a vincular el teléfono.'
              state.phase = 'error'
            }
          })
        }
      }
      await pc.setRemoteDescription(result.offer)
      await pc.setLocalDescription(await pc.createAnswer())
      await gatherIce(pc)
      const answer = { type: pc.localDescription.type, sdp: pc.localDescription.sdp }
      const answerProof = await hmac(pin, `answer|${await hash(JSON.stringify(answer))}`)
      const reply = await signal(state.address, { version: 1, type: 'answer', ticket: result.ticket, answer, proof: answerProof })
      if (reply.accepted !== true) throw new Error('PC rechazó el emparejamiento')
      if (!stopped && activeId === connectionId && state.phase === 'pairing') {
        state.phase = 'connecting'
        connectTimeout = setTimeout(() => {
          if (stopped || activeId !== connectionId || state.phase !== 'connecting') return
          void disconnect().then(() => { state.error = 'No llegó vídeo ni DataChannel del PC en 15 segundos. Comprueba Wi-Fi, cortafuegos e IP.'; state.phase = 'error' })
        }, 15000)
      }
    } catch (err) {
      if (activeId === connectionId) {
        await disconnect()
        state.error = err.message || String(err); state.phase = 'error'
      }
      throw err
    }
  }
  return { state, connect, disconnect }
}
