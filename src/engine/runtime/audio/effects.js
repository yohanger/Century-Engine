// Nodos de efecto de WebAudio para el mezclador. Cada uno: { input, output, update(p, on), dispose() }.
import { makeImpulse } from './impulse.js'

const smooth = (ctx, param, v) => { const t = ctx.currentTime; param.cancelScheduledValues(t); param.setTargetAtTime(v, t, 0.02) }
const gain = (ctx, v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g }

export function makeEffect(ctx, type) {
  const nyq = Math.min(22000, ctx.sampleRate / 2 - 100)
  const inp = gain(ctx), out = gain(ctx)
  const done = (extra) => ({ input: inp, output: out, ...extra })
  if (type === 'lowpass' || type === 'highpass') {
    const f = ctx.createBiquadFilter(); f.type = type
    inp.connect(f); f.connect(out)
    return done({ update: (p, on) => { smooth(ctx, f.frequency, on ? p.freq : type === 'lowpass' ? nyq : 10); f.Q.value = p.q }, dispose: () => f.disconnect() })
  }
  if (type === 'eq3') {
    const lo = ctx.createBiquadFilter(), mid = ctx.createBiquadFilter(), hi = ctx.createBiquadFilter()
    lo.type = 'lowshelf'; mid.type = 'peaking'; hi.type = 'highshelf'; mid.Q.value = 0.8
    inp.connect(lo); lo.connect(mid); mid.connect(hi); hi.connect(out)
    return done({ update: (p, on) => {
      lo.frequency.value = p.lowFreq; hi.frequency.value = p.highFreq; mid.frequency.value = Math.sqrt(p.lowFreq * p.highFreq)
      smooth(ctx, lo.gain, on ? p.low : 0); smooth(ctx, mid.gain, on ? p.mid : 0); smooth(ctx, hi.gain, on ? p.high : 0)
    }, dispose: () => { lo.disconnect(); mid.disconnect(); hi.disconnect() } })
  }
  if (type === 'compressor' || type === 'limiter') {
    const c = ctx.createDynamicsCompressor(), mk = gain(ctx)
    inp.connect(c); c.connect(mk); mk.connect(out)
    return done({ update: (p, on) => {
      if (type === 'limiter') { c.threshold.value = on ? p.ceiling : 0; c.ratio.value = on ? 20 : 1; c.knee.value = 0; c.attack.value = 0.001; c.release.value = p.release / 1000; smooth(ctx, mk.gain, 1) }
      else { c.threshold.value = on ? p.threshold : 0; c.ratio.value = on ? p.ratio : 1; c.knee.value = on ? 12 : 0; c.attack.value = p.attack / 1000; c.release.value = p.release / 1000; smooth(ctx, mk.gain, on ? Math.pow(10, p.makeup / 20) : 1) }
    }, dispose: () => { c.disconnect(); mk.disconnect() } })
  }
  if (type === 'reverb') {
    const dry = gain(ctx), wet = gain(ctx, 0), conv = ctx.createConvolver()
    inp.connect(dry); dry.connect(out); inp.connect(conv); conv.connect(wet); wet.connect(out)
    let key = ''
    return done({ update: (p, on) => {
      const k = p.time.toFixed(2) + '|' + p.damping.toFixed(2)
      if (on && k !== key) { conv.buffer = makeImpulse(ctx, p.time, p.damping); key = k }
      smooth(ctx, wet.gain, on ? p.mix : 0); smooth(ctx, dry.gain, on ? 1 - p.mix * 0.5 : 1)
    }, dispose: () => { dry.disconnect(); wet.disconnect(); conv.disconnect() } })
  }
  if (type === 'echo') {
    const dry = gain(ctx), wet = gain(ctx, 0), dl = ctx.createDelay(2), fb = gain(ctx, 0)
    inp.connect(dry); dry.connect(out); inp.connect(dl); dl.connect(wet); wet.connect(out); dl.connect(fb); fb.connect(dl)
    return done({ update: (p, on) => { dl.delayTime.value = p.time; smooth(ctx, fb.gain, on ? p.feedback : 0); smooth(ctx, wet.gain, on ? p.mix : 0) }, dispose: () => { dry.disconnect(); wet.disconnect(); dl.disconnect(); fb.disconnect() } })
  }
  if (type === 'distortion') {
    const dry = gain(ctx), wet = gain(ctx, 0), ws = ctx.createWaveShaper()
    ws.oversample = '2x'
    inp.connect(dry); dry.connect(out); inp.connect(ws); ws.connect(wet); wet.connect(out)
    let last = -1
    return done({ update: (p, on) => {
      if (p.amount !== last) {
        last = p.amount; const k = p.amount * 120 + 1, n = 1024, c = new Float32Array(n)
        for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)) }
        ws.curve = c
      }
      smooth(ctx, wet.gain, on ? p.mix : 0); smooth(ctx, dry.gain, on ? 1 - p.mix : 1)
    }, dispose: () => { dry.disconnect(); wet.disconnect(); ws.disconnect() } })
  }
  throw new Error('Efecto desconocido: ' + type)
}
