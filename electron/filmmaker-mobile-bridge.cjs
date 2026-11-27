// Señalización local de una sola cámara móvil. El vídeo y el control viajan por WebRTC (DTLS/SRTP).
// El PIN efímero autentica las ofertas/respuestas; no se envía por HTTP.
const http = require('node:http')
const crypto = require('node:crypto')
const os = require('node:os')

const MAX_BYTES = 100_000
const PAIR_TTL = 90_000
const CODE_TTL = 10 * 60_000
const fixed = (a, b) => typeof a === 'string' && typeof b === 'string' && /^[a-f0-9]+$/.test(a) && Buffer.byteLength(a) === Buffer.byteLength(b) && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
const mac = (pin, message) => crypto.createHmac('sha256', pin).update(message).digest('hex')
const digest = (json) => crypto.createHash('sha256').update(json).digest('hex')
const isPrivate = (ip) => /^127\.|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(String(ip || '').replace(/^::ffff:/, '')) || ip === '::1'
const hosts = () => Object.values(os.networkInterfaces()).flat().filter((net) => net?.family === 'IPv4' && !net.internal && isPrivate(net.address)).map((net) => net.address).sort((a, b) => {
  const rank = (ip) => ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : 2
  return rank(a) - rank(b)
})

function createFilmMobileBridge({ onAnswer, onStatus } = {}) {
  let server = null, owner = null, pin = '', offer = '', ticket = '', pairedIP = '', since = 0, attempts = 0, pairUntil = 0, production = null
  const state = () => ({ running: !!server, paired: !!ticket, host: hosts()[0] || '', hosts: hosts(), port: server?.address()?.port || 0, code: pin })
  const stop = () => {
    const old = server
    server = null; owner = null; pin = ''; offer = ''; ticket = ''; pairedIP = ''; attempts = 0; since = 0; pairUntil = 0; production = null
    if (old) { old.closeAllConnections?.(); old.close() }
    onStatus?.({ type: 'stopped' })
  }
  const handle = async (req, res) => {
    const reply = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Connection: 'close' })
      res.end(JSON.stringify(data))
    }
    const remote = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '')
    if (!isPrivate(remote) || req.method !== 'POST' || req.url !== '/bridge' || !server) { reply(404, { error: 'No disponible' }); return }
    const sizeHeader = Number(req.headers['content-length'] || 0)
    if (sizeHeader > MAX_BYTES) { reply(413, { error: 'Mensaje demasiado grande' }); return }
    let size = 0, body = ''
    try {
      for await (const chunk of req) {
        size += chunk.length
        if (size > MAX_BYTES) throw new Error('Límite de mensaje superado')
        body += chunk.toString('utf8')
      }
    } catch { reply(413, { error: 'Límite de mensaje superado' }); return }
    let packet
    try { packet = JSON.parse(body) } catch { reply(400, { error: 'JSON inválido' }); return }
    if (packet?.version !== 1 || typeof packet.type !== 'string') { reply(400, { error: 'Protocolo incompatible' }); return }
    if (Date.now() - since > CODE_TTL) { reply(410, { error: 'Sesión caducada; inicia otra en FilmMaker' }); return }
    if (packet.type === 'pair') {
      if (ticket || pairUntil > Date.now()) { reply(409, { error: 'Ya existe una cámara vinculada' }); return }
      if (attempts >= 5) { reply(429, { error: 'Límite de intentos; reinicia la sesión en el PC' }); return }
      if (!/^[a-f0-9]{32}$/.test(packet.nonce || '') || !fixed(packet.proof, mac(pin, `pair|${packet.nonce}`))) {
        attempts++
        reply(403, { error: 'Código o prueba de emparejamiento incorrectos' }); return
      }
      pairUntil = Date.now() + PAIR_TTL
      pairedIP = remote
      ticket = crypto.randomBytes(20).toString('hex')
      reply(200, { version: 1, type: 'offer', ticket, production, offer: JSON.parse(offer), proof: mac(pin, `offer|${digest(offer)}`), ttlMs: PAIR_TTL })
      onStatus?.({ type: 'paired' })
    } else if (packet.type === 'answer') {
      const answer = packet.answer
      if (!ticket || remote !== pairedIP || pairUntil < Date.now() || !fixed(packet.ticket, ticket) || !answer || answer.type !== 'answer' || typeof answer.sdp !== 'string' || answer.sdp.length > 90000) {
        reply(403, { error: 'Respuesta de sesión no autorizada' }); return
      }
      const serialized = JSON.stringify(answer)
      if (!fixed(packet.proof, mac(pin, `answer|${digest(serialized)}`))) { reply(403, { error: 'Respuesta no autenticada' }); return }
      const acceptedTicket = ticket
      pairUntil = 0
      reply(200, { version: 1, accepted: true })
      onAnswer?.(owner, answer, acceptedTicket)
      onStatus?.({ type: 'answer-received' })
    } else reply(400, { error: 'Tipo de paquete no permitido' })
  }
  return {
    state,
    async start(nextOwner, nextOffer, nextProduction) {
      if (!Number.isInteger(nextOwner) || typeof nextOffer?.sdp !== 'string' || nextOffer.type !== 'offer' || nextOffer.sdp.length > 90000) throw new Error('Oferta WebRTC inválida')
      if (server) throw new Error('Ya existe una cámara móvil enlazándose; detén la sesión anterior')
      if (typeof nextProduction?.filmId !== 'string' || !nextProduction.filmId || nextProduction.filmId.length > 128 || typeof nextProduction.sceneId !== 'string' || nextProduction.sceneId.length > 128 || typeof nextProduction.projectId !== 'string' || nextProduction.projectId.length > 128) throw new Error('Identidad de película/escena ausente')
      production = { filmId: nextProduction.filmId, sceneId: nextProduction.sceneId, projectId: nextProduction.projectId, sceneName: String(nextProduction.sceneName || '').slice(0, 128) }
      owner = nextOwner
      offer = JSON.stringify({ type: 'offer', sdp: nextOffer.sdp })
      pin = String(crypto.randomInt(0, 1_000_000_000_000)).padStart(12, '0')
      since = Date.now()
      server = http.createServer((req, res) => void handle(req, res))
      server.requestTimeout = 8000
      server.headersTimeout = 10000
      server.keepAliveTimeout = 1000
      try {
        await new Promise((resolve, reject) => {
          server.once('error', reject)
          server.listen(0, '0.0.0.0', () => { server.off('error', reject); resolve() })
        })
        if (!hosts().length) { stop(); throw new Error('No se detectó una dirección IPv4 privada en el PC') }
        onStatus?.({ type: 'listening' })
        return state()
      } catch (error) { stop(); throw error }
    },
    stop,
    stopIfOwner(id) { if (owner === id) stop() },
    isOwner(id) { return !!server && owner === id },
  }
}
module.exports = { createFilmMobileBridge }
