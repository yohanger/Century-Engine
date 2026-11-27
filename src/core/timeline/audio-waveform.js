import { normalizeSource } from '../../engine/runtime/audio/config.js'

const MAX_BINS = 8192
const COLUMNS = 128
export const MAX_WAVEFORM_COLUMNS = 2048
const MIN_DISPLAY_PEAK = 0.0001 // Límite de ampliación gráfica para residuos de decodificación.
const yieldToEditor = () => new Promise(resolve => setTimeout(resolve, 0))

export async function analyzeAudioBuffer(buffer, signal, yieldWork = yieldToEditor) {
  const { length, sampleRate, numberOfChannels: channels } = buffer
  if (!(length > 0 && sampleRate > 0 && channels > 0)) throw new Error('Audio sin muestras')
  const bins = Math.min(MAX_BINS, length)
  const low = new Float32Array(bins).fill(Infinity), high = new Float32Array(bins).fill(-Infinity)
  const pcm = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel))
  const chunk = Math.max(1, Math.floor(131072 / channels))
  let squared = 0, min = Infinity, max = -Infinity
  for (let start = 0; start < length; start += chunk) {
    signal?.throwIfAborted()
    const end = Math.min(length, start + chunk)
    for (let frame = start; frame < end; frame++) {
      const bin = Math.floor(frame * bins / length)
      for (const channel of pcm) {
        const sample = Number.isFinite(channel[frame]) ? channel[frame] : 0
        squared += sample * sample
        if (sample < low[bin]) low[bin] = sample
        if (sample > high[bin]) high[bin] = sample
        if (sample < min) min = sample
        if (sample > max) max = sample
      }
    }
    if (end < length) await yieldWork()
  }
  return { duration: length / sampleRate, channels, sampleRate, low, high, min, max,
    peakDb: 20 * Math.log10(Math.max(-min, max)), rmsDb: 10 * Math.log10(squared / (length * channels)) }
}

/** Duración efectiva de una pasada de la fuente en el reloj del Timeline.
 * No convierte duration=0 en un valor persistido: eso sigue siendo «audio completo».
 */
export function audioSourcePlaybackSpan(sourceSeconds, key = {}) {
  if (!Number.isFinite(sourceSeconds) || sourceSeconds <= 0) return 0
  const offset = Math.max(0, Number(key.offset) || 0)
  const rate = normalizeSource({ pitch: key.pitch }).pitch
  return Math.max(0, (sourceSeconds - offset) / rate)
}

/** Tiempo inicial persistible sin ampliar el recurso Timeline ni alterar el archivo. */
export function initialTimelineAudioDuration(sourceSeconds, key, timelineSeconds) {
  const span = audioSourcePlaybackSpan(sourceSeconds, key)
  const available = Math.max(0, (Number(timelineSeconds) || 0) - (Number(key?.t) || 0))
  return {
    seconds: span > 0 && available > 0 ? +Math.min(span, available).toFixed(5) : 0,
    exceedsTimeline: span > available + 0.00001,
  }
}

/** Pico de la ventana completa, independiente de scroll y resolución del SVG. */
export function audioWaveformPeak(analysis, duration, offset, pitch, loop) {
  if (!analysis || !(duration > 0)) return 0
  const { duration: length, low, high, min, max } = analysis
  if (!(length > 0) || !low?.length || !high?.length) return 0
  const rate = normalizeSource({ pitch }).pitch
  const start = Math.min(length, Math.max(0, Number(offset) || 0))
  if (!loop && start >= length) return 0
  if (loop && duration * rate >= length) return Math.max(0, -min, max)
  const first = loop ? start % length : start
  const last = first + duration * rate
  let peak = 0
  const scan = (from, to) => {
    const begin = Math.max(0, Math.floor(from * low.length / length))
    const end = Math.min(low.length, Math.ceil(to * low.length / length))
    for (let i = begin; i < end; i++) peak = Math.max(peak, -low[i], high[i])
  }
  scan(first, Math.min(length, last))
  if (loop && last > length) scan(0, Math.min(length, last - length))
  return peak
}

/** Dibuja una ventana PCM; sin opciones conserva el contrato original de 128 columnas. */
export function audioWaveformPath(analysis, duration, offset, pitch, loop, options = null) {
  if (!analysis || !(duration > 0)) return ''
  const { duration: length, low, high, min, max } = analysis
  if (!(length > 0) || !low?.length || !high?.length) return ''
  const rate = normalizeSource({ pitch }).pitch
  const start = Math.min(length, Math.max(0, Number(offset) || 0))
  const columnsCount = options
    ? Math.max(1, Math.min(MAX_WAVEFORM_COLUMNS, low.length, Math.round(Number(options.columns) || 1)))
    : COLUMNS
  const viewStart = Math.max(0, Math.min(duration, Number(options?.startTime) || 0))
  const viewEnd = options ? Math.max(viewStart, Math.min(duration, (options.endTime == null ? duration : Number(options.endTime)))) : duration
  if (!(viewEnd > viewStart)) return ''
  const step = (viewEnd - viewStart) * rate / columnsCount
  const columns = []
  let peak = 0
  for (let column = 0; column < columnsCount; column++) {
    let from = start + viewStart * rate + column * step
    if (loop) from %= length
    if (from >= length) break
    const to = from + step
    let lo = Infinity, hi = -Infinity
    const addBins = (a, b) => {
      const first = Math.floor(a * low.length / length)
      const last = Math.min(low.length, Math.ceil(b * low.length / length))
      for (let i = first; i < last; i++) {
        lo = Math.min(lo, low[i]); hi = Math.max(hi, high[i])
      }
    }
    if (loop && step >= length) { lo = min; hi = max }
    else {
      addBins(from, Math.min(length, to))
      if (loop && to > length) addBins(0, to - length)
    }
    if (lo === Infinity) continue
    const end = !loop && to > length ? (column + (length - from) / step).toFixed(2) : column + 1
    columns.push({ column, end, lo, hi })
    peak = Math.max(peak, -lo, hi)
  }
  if (!columns.length) return ''
  // El tramo entero fija la escala. El scroll y el zoom solo cambian su presentación.
  const scale = Math.max(Number.isFinite(options?.peak) ? options.peak : peak, MIN_DISPLAY_PEAK)
  const y = value => (16 - 15 * value / scale).toFixed(2)
  const top = [], bottom = []
  for (const { column, end, lo, hi } of columns) {
    top.push(`${column} ${y(hi)}`, `${end} ${y(hi)}`)
    bottom.push(`${column} ${y(lo)}`, `${end} ${y(lo)}`)
  }
  return `M${top.concat(bottom.reverse()).join('L')}Z`
}

/** Un decodificador en vuelo, solicitudes compartidas y solo resúmenes en la caché. */
export function createAudioAnalysisQueue(readBuffer, { limit = 32, analyze = analyzeAudioBuffer } = {}) {
  const cache = new Map(), pending = new Map()
  let active = null
  let scheduled = false
  const schedule = () => {
    if (active || scheduled) return
    scheduled = true
    setTimeout(() => {
      scheduled = false
      const next = [...pending.values()].find(job => job.priority) ?? pending.values().next().value
      if (next) void run(next)
    }, 0)
  }
  async function run(job) {
    active = job
    const { source, controller } = job, { signal } = controller
    let result
    try {
      const buffer = await readBuffer(job, signal)
      signal.throwIfAborted()
      result = buffer ? { status: 'ready', data: await analyze(buffer, signal) } : { status: 'missing' }
    } catch {
      result = { status: 'invalid' }
    }
    if (!signal.aborted) {
      cache.set(source, result)
      if (cache.size > limit) cache.delete(cache.keys().next().value)
    }
    if (pending.get(source) === job) pending.delete(source)
    active = null
    schedule()
    if (!signal.aborted) for (const receive of job.listeners) receive(result)
  }
  return {
    request(asset, receive, priority = false) {
      const { source } = asset
      const saved = cache.get(source)
      if (saved) {
        cache.delete(source); cache.set(source, saved)
        receive(saved)
        return () => {}
      }
      let job = pending.get(source)
      if (!job) {
        job = { ...asset, listeners: new Set(), controller: new AbortController(), priority: false }
        pending.set(source, job)
      }
      job.listeners.add(receive)
      job.priority ||= priority
      schedule()
      return () => {
        job.listeners.delete(receive)
        if (job.listeners.size || pending.get(source) !== job) return
        pending.delete(source)
        job.controller.abort()
      }
    },
    clear() {
      cache.clear()
      for (const job of pending.values()) job.controller.abort()
      pending.clear()
    },
  }
}
