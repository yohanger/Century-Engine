# Trueno procedural (Bloque C2) en el navegador: WebAudio real, rayo → retardo → síntesis → mezclador, región por posición del oyente y
# oclusión por rayos de sonido contra un techo de verdad (Jolt). Chromium con SwiftShader, sin GPU ni altavoces reales (salida de audio de prueba).
# Uso: (npx vite --port 5199 &) ; python3 scripts/test-thunder.py
import asyncio, json, sys
from playwright.async_api import async_playwright

ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required']
OK = True
def check(name, cond, extra=''):
    global OK
    OK &= bool(cond)
    print(('  OK  ' if cond else ' FALLA ') + name + (f'  [{extra}]' if extra != '' else ''), flush=True)

SETUP = """async ([weather, roof]) => { const { S, store, editor } = window.__lf
  S.updateEnvironment({ time: { on: true, hour: 22 }, weather: Object.assign({ on: true, preset: 'storm', lightning: true, lightningModel: 'physical', maxStrikes: 0, thunderSound: 'procedural' }, weather) }, false)
  if (roof) S.addObject({ type: 'primitive', kind: 'box', position: [0, 4, 0], scale: [30, 0.4, 30] }, { select: false })
  store.view.grid = false; editor.applyView()
  await editor.player.start(); await new Promise((r) => setTimeout(r, 1200))
  const pm = editor.player; window.__pm = pm; window.__ev = []
  pm.game.on('thunder', (e) => { window.__ev.push(e) }); pm.game.on('lightning', (e) => { window.__lig = e })
  // Sin GPU cada fotograma de SwiftShader puede bloquear el hilo principal durante segundos (más que un trueno entero) y los temporizadores de la
  // prueba llegarían tarde (hallado: 3 de 24 pasadas veían «nada activo» porque el trueno ya había terminado). Se corta el bucle de dibujo: el juego
  // se avanza a mano con ADV y el audio sigue corriendo en su propio hilo.
  window.requestAnimationFrame = () => 0; await new Promise((r) => setTimeout(r, 500))
  return { on: pm.on, ctx: pm.weatherSound?.engine?.ctx?.state } }"""
# Pico de la salida del grupo sfx medido EN EL HILO DE AUDIO (AudioWorklet): no depende de que el hilo principal esté libre (con SwiftShader un
# fotograma lo bloquea durante segundos y un muestreo con temporizadores se perdería el trueno entero).
TAP = """async () => { const eng = window.__pm.weatherSound.engine, ctx = eng.ctx
  const code = "class P extends AudioWorkletProcessor { constructor() { super(); this.m = 0; this.port.onmessage = (e) => { if (e.data === 'reset') this.m = 0; else this.port.postMessage(this.m) } } process(i) { const c = i[0][0]; if (c) for (let k = 0; k < c.length; k++) { const a = Math.abs(c[k]); if (a > this.m) this.m = a } return true } } registerProcessor('peak', P)"
  await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })))
  const node = new AudioWorkletNode(ctx, 'peak', { numberOfOutputs: 0 }); eng.nodes.get('sfx').vol.connect(node); window.__tap = node
  window.__peak = () => new Promise((r) => { node.port.onmessage = (e) => r(e.data); node.port.postMessage('read') }); node.port.postMessage('reset'); return true }"""
RESET = "() => window.__tap.port.postMessage('reset')"
# espera `ms` de reloj y devuelve el pico desde el último reset
PEAK = """async (ms) => { await new Promise((r) => setTimeout(r, ms)); return await window.__peak() }"""
# Con SwiftShader el juego va a ~1 % de la velocidad real (el fotograma tarda segundos y su dt se acota), así que el tiempo del juego se avanza a mano:
# mismos pasos que el bucle (timers → mundo → …) y el audio del clima. El sonido sí corre en tiempo real.
ADV = """(sec) => { const pm = window.__pm, ws = pm.weatherSound, dt = 1 / 30; for (let t = 0; t < sec; t += dt) { pm._simStep(dt, 0, dt); ws.update(dt) } return pm.ed.world.t }"""
DIRECT = """async () => { const ws = window.__pm.weatherSound, eng = ws.engine
  const pre = { on: ws.on, muted: ws.muted, ctx: eng.ctx?.state, voices: eng.voices.size, kind: ws.cfg.thunderSound }
  const info = ws.thunder({ distance: 700, bearing: 90, seed: 123, peak: 30, altitude: 1100, thickness: 1200 })
  return { info, pre, active: ws.active.length, lp: ws.active[0]?.lp.frequency.value, gain: ws.active[0]?.gain.gain.value, occ: ws.occlusion, voices: eng.voices.size, ctx: eng.ctx?.state, log: ws.log.slice(-1) } }"""

async def open_page(p, weather, roof):
    b = await p.chromium.launch(args=ARGS); pg = await b.new_page(viewport={'width': 900, 'height': 560}); logs = []
    pg.on('pageerror', lambda e: logs.append('ERR ' + str(e)[:300])); pg.on('console', lambda m: logs.append(m.text[:200]) if m.type == 'error' else None)
    await pg.goto('http://localhost:5199/', wait_until='load')
    await pg.wait_for_function("window.__lf && window.__lf.store && window.__lf.store.ready && window.__lf.editor && window.__lf.editor.vp", timeout=60000)
    st = await pg.evaluate(SETUP, [weather, roof]); await pg.evaluate(TAP)
    return b, pg, logs, st

async def main():
    async with async_playwright() as p:
        print('Cielo abierto: rayo → trueno con retardo, síntesis y mezclador')
        b, pg, logs, st = await open_page(p, {}, False)
        check('jugando y con el contexto de audio real en marcha', st['on'] and st['ctx'] == 'running', st)
        occ0 = await pg.evaluate("() => window.__pm._soundOcclusion(null)")
        check('sin techo, los rayos de sonido no chocan (oclusión 0)', occ0 == 0, occ0)
        t0 = await pg.evaluate("() => performance.now()")
        await pg.evaluate("() => { window.__pm.ed.world.strike(300, 90) }")
        await pg.evaluate(ADV, 0.3)
        check('al caer el rayo llega el evento «lightning» con rumbo y semilla', await pg.evaluate("() => window.__lig && window.__lig.bearing === 90 && Number.isInteger(window.__lig.seed)"))
        check('y todavía no ha sonado el trueno (300 m → 0,87 s)', await pg.evaluate("() => window.__ev.length === 0"))
        await pg.evaluate(RESET); await pg.evaluate(ADV, 0.8)
        ev = await pg.evaluate("() => window.__ev.map((e) => ({ ...e, at: 0 }))")
        check('llega UN evento «thunder» con región, oclusión y volumen', len(ev) == 1 and ev[0].get('region') == 'open' and ev[0].get('occlusion') == 0 and 0 < ev[0].get('loudness', 0) <= 1, json.dumps(ev[0]) if ev else 'sin evento')
        lt = await pg.evaluate("() => { const l = window.__pm.weatherSound.lastThunder; return l && { seg: l.segments, dur: l.duration, level: l.level, region: l.region, rmin: l.rMin } }")
        check('se sintetizó con el canal del rayo (cientos de segmentos, a ≈300 m)', lt and lt['seg'] > 200 and abs(lt['rmin'] - 300) / 300 < 0.15, lt)
        lvl = await pg.evaluate(PEAK, int(1000 * ((lt or {}).get('dur', 5))) + 800)
        check('el trueno SUENA en el mezclador (pico del grupo sfx, medido en el hilo de audio)', lvl > 0.05, f'pico {lvl:.4f}')
        check('al terminar se libera el filtro (nada activo)', await pg.evaluate("() => window.__pm.weatherSound.active.length === 0"))
        api = await pg.evaluate("() => { const w = window.__pm.game._worldApi.weather; return { region: w.thunderRegion, occ: w.occlusion } }")
        check('game.weather.thunderRegion / occlusion', api['region'] == 'open' and api['occ'] == 0, api)
        await pg.evaluate("() => window.__pm.game._worldApi.weather.setOcclusion(0.8)"); await pg.evaluate(ADV, 3)
        check('game.weather.setOcclusion(0.8) lo fuerza (y se suaviza hasta 0,8)', abs(await pg.evaluate("() => window.__pm.weatherSound.occlusion") - 0.8) < 0.03)
        await pg.evaluate("() => window.__pm.game._worldApi.weather.setOcclusion(null)")
        check('sin errores de página', not logs, logs[:3])
        await b.close()

        print('Bajo un techo: oclusión por rayos y paso bajo')
        b, pg, logs, st = await open_page(p, {}, True)
        occ = await pg.evaluate("() => window.__pm._soundOcclusion(null)")
        check('con un techo de 30×30 m a 4 m, los 9 rayos chocan (0,92)', abs(occ - 0.92) < 1e-6, occ)
        await pg.evaluate(ADV, 3)
        await pg.evaluate(RESET); r = await pg.evaluate(DIRECT)
        check('el trueno entra con el filtro ya cerrado (~600 Hz, ~50 % de volumen)', r['active'] == 1 and 450 < (r.get('lp') or 0) < 900 and (r.get('gain') or 9) < 0.55, r)
        lvl_roof = await pg.evaluate(PEAK, 6500)
        await b.close()
        b, pg, logs, st = await open_page(p, {}, False)
        await pg.evaluate(ADV, 3)
        await pg.evaluate(RESET); r2 = await pg.evaluate(DIRECT); lvl_open = await pg.evaluate(PEAK, 6500)
        check('el mismo trueno al aire libre pasa con el filtro abierto', (r2.get('lp') or 0) > 19000 and (r2.get('gain') or 0) > 0.99, r2)
        check('y suena bastante más fuerte que bajo el techo', lvl_open > 0 and lvl_roof < lvl_open * 0.8, f'{lvl_roof:.4f} < {lvl_open:.4f}')
        await b.close()

        print('Regiones acústicas por posición del oyente')
        b, pg, logs, st = await open_page(p, {'thunderRegion': 'city', 'thunderRegions': [{'preset': 'valley', 'cx': 0, 'cy': 0, 'cz': 0, 'sx': 20, 'sy': 20, 'sz': 20}, {'preset': 'interior', 'cx': 500, 'cy': 0, 'cz': 0, 'sx': 20, 'sy': 20, 'sz': 20}]}, False)
        check('el oyente (cámara del jugador) está en la caja Valle', await pg.evaluate("() => window.__pm.weatherSound.region.id") == 'valley')
        await pg.evaluate("() => window.__pm.ed.world.strike(250, 0)"); await pg.evaluate(ADV, 1.6)
        ev = await pg.evaluate("() => window.__ev.map((e) => e.region)")
        check('el trueno usa esa región', ev == ['valley'], ev)
        await pg.evaluate("() => { const cam = window.__pm.cam; cam.position.set(1000, 1.65, 0); cam.updateMatrixWorld(true) }")
        check('fuera de las cajas vale la acústica por defecto (Ciudad)', await pg.evaluate("() => window.__pm.weatherSound.region.id") == 'city')
        await pg.evaluate("() => { const cam = window.__pm.cam; cam.position.set(505, 1.65, 3); cam.updateMatrixWorld(true) }")
        await pg.evaluate(ADV, 3)
        occ = await pg.evaluate("() => window.__pm.weatherSound.occlusion")
        check('la región Interior amortigua sola aunque no haya techo (suelo 0,75)', abs(occ - 0.75) < 0.03, occ)
        await b.close()

        print('Modo «clips» (por defecto): nada cambia')
        b, pg, logs, st = await open_page(p, {'thunderSound': 'clips'}, False)
        await pg.evaluate("() => window.__pm.ed.world.strike(200, 0)"); await pg.evaluate(ADV, 1.5)
        r = await pg.evaluate("() => ({ last: window.__pm.weatherSound.lastThunder, ev: window.__ev.map((e) => ({ r: e.region, o: e.occlusion })), act: window.__pm.weatherSound.active.length })")
        check('no sintetiza, y el evento «thunder» llega igual, sin campos nuevos', r['last'] is None and r['act'] == 0 and r['ev'] == [{}] or (r['last'] is None and len(r['ev']) == 1 and r['ev'][0].get('r') is None), r)
        await b.close()

    print('\nTODO OK' if OK else '\nHAY FALLOS')
    sys.exit(0 if OK else 1)

asyncio.run(main())
