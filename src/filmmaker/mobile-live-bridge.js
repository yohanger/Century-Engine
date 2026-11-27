// Un enlace de previsualización FilmMaker↔teléfono por sesión. No crea escenas, tomas ni claves.
import { reactive } from 'vue'
import * as F from './session.js'
import { MONITOR_PROFILES, applyMonitorEncoding } from './mobile-monitor-quality.mjs'

export function createFilmMobileLink(getEditor) {
  const state = reactive({ phase: 'idle', address: '', hosts: [], pin: '', error: '', framesSent: 0, videoFps: 0, bitrateKbps: 0, orientationSamples: 0, lastOrientationMs: 0, monitorFresh: false, quality: 'equilibrado', qualityStatus: 'Sin aplicar', cpuPercent: null, memoryMiB: null })
  let peer = null, stream = null, data = null, videoSender = null, offAnswer = null, statsTimer = null, watchdog = null, lastSequence = -1, monitorAt = 0, lastStats = null, epoch = 0

  const clear = async () => {
    ++epoch
    offAnswer?.(); offAnswer = null
    clearInterval(statsTimer); clearInterval(watchdog)
    statsTimer = watchdog = null
    try { data?.close() } catch { /* desconexión */ }
    try { peer?.close() } catch { /* desconexión */ }
    stream?.getTracks().forEach((track) => track.stop())
    peer = stream = data = videoSender = null
    F.stopRemotePreview()
    lastSequence = -1; monitorAt = 0; lastStats = null
    state.monitorFresh = false; state.cpuPercent = null; state.memoryMiB = null; state.qualityStatus = 'Sin aplicar'
    try { await window.lf?.filmMobileBridge?.stop() } catch { /* proceso cerrado */ }
  }
  async function stop() {
    await clear()
    state.phase = 'idle'; state.pin = ''; state.address = ''; state.hosts = []; state.error = ''
  }
  function acceptPacket(event) {
    let packet
    try { packet = JSON.parse(event.data) } catch { return }
    if (packet?.version !== 1 || !Number.isSafeInteger(packet.seq) || packet.seq <= lastSequence) return
    if (packet.type === 'ping') {
      if (typeof packet.sentAt === 'number' && Number.isFinite(packet.sentAt) && packet.sentAt >= 0) {
        try { data?.send(JSON.stringify({ version: 1, type: 'pong', sentAt: packet.sentAt })) } catch { /* canal cerrado */ }
        lastSequence = packet.seq
      }
      return
    }
    if (packet.type !== 'monitor' && packet.type !== 'orientation') return
    if (packet.type === 'monitor') {
      if (packet.fresh === true) { monitorAt = performance.now(); state.monitorFresh = true }
      else { monitorAt = 0; state.monitorFresh = false }
      lastSequence = packet.seq
      return
    }
    if (!state.monitorFresh || performance.now() - monitorAt > 2500) return
    const q = packet.quaternionXYZW
    if (!Array.isArray(q) || q.length !== 4 || q.some((v) => typeof v !== 'number' || !Number.isFinite(v))) return
    const norm = Math.hypot(...q)
    if (norm < .9 || norm > 1.1) return
    if (F.remoteOrientation(q)) {
      state.orientationSamples++
      state.lastOrientationMs = performance.now()
      lastSequence = packet.seq
    }
  }
  const iceComplete = (pc) => new Promise((resolve, reject) => {
    if (pc.iceGatheringState === 'complete') { resolve(); return }
    const timeout = setTimeout(() => { pc.removeEventListener('icegatheringstatechange', check); reject(new Error('ICE local no completó en 8 segundos')) }, 8000)
    function check() { if (pc.iceGatheringState === 'complete') { clearTimeout(timeout); pc.removeEventListener('icegatheringstatechange', check); resolve() } }
    pc.addEventListener('icegatheringstatechange', check)
  })

  async function setQuality(name) {
    if (!Object.hasOwn(MONITOR_PROFILES, name)) throw new Error('Perfil no admitido')
    if (!videoSender || !data || data.readyState !== 'open') throw new Error('Conecta un monitor antes de cambiar la calidad')
    const current = state.quality, currentSender = videoSender, currentEpoch = epoch
    try {
      await applyMonitorEncoding(currentSender, name)
      if (epoch !== currentEpoch || videoSender !== currentSender || data?.readyState !== 'open') return
      state.quality = name
      state.qualityStatus = `Límites solicitados: ${MONITOR_PROFILES[name].label}. Verificar FPS/bitrate medidos.`
    } catch (e) {
      if (currentEpoch === epoch) { state.quality = current; state.qualityStatus = `Sin cambio confirmado: ${e.message || e}` }
      throw e
    }
  }
  async function start() {
    if (state.phase !== 'idle' && state.phase !== 'error') return
    if (!window.lf?.filmMobileBridge) throw new Error('El enlace móvil requiere FilmMaker abierto en Electron')
    const editor = getEditor()
    if (!editor || !F.session.film) throw new Error('Abre una película o escena antes de emparejar el teléfono')
    if (F.session.pass.state !== 'idle' || F.session.view.index >= 0 || F.session.playing || F.session.montage.on) throw new Error('Detén otras reproducciones y tomas antes de conectar')
    await clear()
    state.phase = 'preparing'; state.error = ''; state.framesSent = 0; state.videoFps = 0; state.bitrateKbps = 0; state.orientationSamples = 0; state.quality = 'equilibrado'; state.qualityStatus = 'Preparando'; state.cpuPercent = null; state.memoryMiB = null
    try {
      const canvas = editor.vp?.renderer?.domElement
      if (!canvas?.captureStream) throw new Error('El renderer no admite captura WebRTC del canvas')
      stream = canvas.captureStream(10)
      if (!stream.getVideoTracks().length) throw new Error('Canvas sin pista de vídeo')
      peer = new RTCPeerConnection({ iceServers: [] })
      for (const track of stream.getTracks()) { const sender = peer.addTrack(track, stream); if (track.kind === 'video') videoSender = sender }
      data = peer.createDataChannel('lf-camera-orientation', { ordered: false, maxRetransmits: 0 })
      data.onmessage = acceptPacket
      data.onopen = () => {
        try { F.beginRemotePreview() } catch (e) { state.error = e.message; void stop(); return }
        state.phase = 'connected'
        // Algunos codificadores no admiten cambiar estos parámetros. No cortar el monitor si fallan.
        const currentEpoch = epoch, currentSender = videoSender
        void applyMonitorEncoding(currentSender, state.quality).then(() => {
          if (currentEpoch === epoch && videoSender === currentSender) state.qualityStatus = 'Perfil equilibrado solicitado (comprobar calidad medida)'
        }).catch((e) => { if (currentEpoch === epoch && videoSender === currentSender) state.qualityStatus = `Calidad fija del dispositivo: ${e.message || e}` })
        watchdog = setInterval(() => {
          if (monitorAt && performance.now() - monitorAt > 2500) { state.monitorFresh = false; state.phase = 'monitor-stale' }
          else if (state.monitorFresh) state.phase = 'connected'
        }, 500)
        statsTimer = setInterval(async () => {
          const currentPeer = peer, currentEpoch = epoch
          if (!currentPeer) return
          try {
            const stats = await currentPeer.getStats()
            if (currentEpoch !== epoch || currentPeer !== peer) return
            for (const stat of stats.values()) {
              if (stat.type !== 'outbound-rtp' || stat.kind !== 'video' || !Number.isFinite(stat.framesSent) || !Number.isFinite(stat.bytesSent)) continue
              state.framesSent = stat.framesSent
              if (lastStats && stat.timestamp > lastStats.at) {
                const seconds = (stat.timestamp - lastStats.at) / 1000
                state.videoFps = Math.max(0, Math.round((stat.framesSent - lastStats.frames) / seconds * 10) / 10)
                state.bitrateKbps = Math.max(0, Math.round((stat.bytesSent - lastStats.bytes) * 8 / seconds / 1000))
              }
              lastStats = { at: stat.timestamp, frames: stat.framesSent, bytes: stat.bytesSent }
            }
            const resources = await window.lf?.filmMobileBridge?.resources?.()
            if (currentEpoch === epoch && currentPeer === peer && resources) {
              state.cpuPercent = Number.isFinite(resources.cpuPercent) ? resources.cpuPercent : null
              state.memoryMiB = Number.isFinite(resources.memoryMiB) ? resources.memoryMiB : null
            }
          } catch { /* canal cerrado */ }
        }, 1600)
      }
      peer.onconnectionstatechange = () => {
        if (peer?.connectionState === 'failed' || peer?.connectionState === 'closed') { state.error = 'Conexión WebRTC perdida'; void clear().then(() => { state.phase = 'error' }) }
      }
      peer.oniceconnectionstatechange = () => { if (peer?.iceConnectionState === 'disconnected') { state.monitorFresh = false; state.phase = 'disconnected' } }
      offAnswer = window.lf.filmMobileBridge.onAnswer(async (answer) => {
        try { if (peer && peer.signalingState === 'have-local-offer') await peer.setRemoteDescription(answer) }
        catch (e) { state.error = 'Respuesta WebRTC inválida: ' + (e.message || e); await clear(); state.phase = 'error' }
      })
      await peer.setLocalDescription(await peer.createOffer())
      await iceComplete(peer)
      const currentFilm = F.session.film
      const production = { filmId: currentFilm.id, sceneId: currentFilm.scene.id, sceneName: currentFilm.scene.name, projectId: currentFilm.scene.projectId }
      const info = await window.lf.filmMobileBridge.start({ type: peer.localDescription.type, sdp: peer.localDescription.sdp }, production)
      state.address = `${info.host}:${info.port}`
      state.hosts = (info.hosts || []).map((host) => `${host}:${info.port}`)
      state.pin = info.code
      if (state.phase === 'preparing') state.phase = 'pairing'
    } catch (e) { await clear(); state.error = e.message || String(e); state.phase = 'error'; throw e }
  }
  return { state, start, stop, setQuality, profiles: MONITOR_PROFILES }
}
