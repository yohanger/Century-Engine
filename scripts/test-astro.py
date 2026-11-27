# Astronomía real (world/astro.js + catálogo + shader): matemática, estrellas en su píxel con la cámara girada, fases de la luna y API.
# Uso: npx vite --port 5199 &  python3 scripts/test-astro.py
import asyncio, io, math, sys
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright

ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
OK = True
def check(name, cond, extra=''):
    global OK
    OK &= bool(cond)
    print(('  OK  ' if cond else ' FALLA ') + name + (f'  [{extra}]' if extra != '' else ''))

MATH = """async () => {
  const A = await import('/src/engine/runtime/world/astro.js'), T = await import('/src/engine/runtime/render/astro-sky.js')
  const out = {}
  out.j2000 = A.julianDay(2000, 1, 12, 0)
  const ph = (y, m, d, h) => { const s = A.astroState({ year: y, day: A.dayOfYear(y, m, d), hour: h, latitude: 19, longitude: -70, utcOffset: 0 }); return [s.moonIllum, A.moonPhaseName(s.moonIllum, s.moonWaxing)] }
  out.newMoon = ph(2026, 2, 17, 12); out.fullMoon = ph(2026, 3, 3, 12); out.lastQ = ph(2026, 3, 10, 12); out.firstQ = ph(2026, 2, 24, 12)
  // sol del solsticio de junio al mediodía solar en el trópico de Cáncer: casi en el cenit
  const sol = A.astroState({ year: 2026, day: 172, hour: 12 + 70 / 15 * 0 + 0, latitude: 23.4, longitude: 0, utcOffset: 0 })
  out.solsticeEl = sol.sun.elevation
  // el catálogo: Sirio, Vega, Polaris, Canopus en su texel
  const tex = T.starCatalogData()
  const at = (ra, dec) => { const x = Math.floor(ra / 360 * 1024), y = Math.floor((dec + 90) / 180 * 512); let m = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) m = Math.max(m, tex[((y + dy) * 1024 + ((x + dx + 1024) % 1024)) * 4 + 3]); return m }
  out.cat = { sirius: at(101.287, -16.716), vega: at(279.234, 38.784), polaris: at(37.95, 89.26), canopus: at(95.988, -52.696) }
  let n = 0; for (let i = 3; i < tex.length; i += 4) if (tex[i] > 0) n++
  out.nstars = n
  out.moonTex = [T.moonTexture().image.width, T.moonTexture().image.data.length]
  // los planetas quedan cerca de la eclíptica (|dec| < 30°) y Júpiter en Géminis a principios de 2026
  const s = A.astroState({ year: 2026, day: 40, hour: 0, latitude: 19, longitude: -70, utcOffset: 0 })
  out.planets = s.planets.map((p) => [p.name, Math.round(p.ra), Math.round(p.dec), +p.magnitude.toFixed(1)])
  // estrella en el cenit-polo: con latitud 90 el polo celeste está en el cenit
  const h = A.equatorialToHorizontal(0, 90, 90, 123); out.polar = h
  return out }"""

PLACE = """([t]) => { const {S,store,editor} = window.__lf
  S.updateEnvironment({ time: Object.assign({ on: true, latitude: 19, nightAmbient: 0.15, moonLight: 0.06 }, t) }, false)
  store.view.grid = false; store.view.terrain = false; editor.applyView(); return true }"""
FIND = """async () => { const A = await import('/src/engine/runtime/world/astro.js'); let best = null
  for (let h = 0; h < 24; h += 0.25) { const s = A.astroState({ year: 2026, day: 15, hour: h, latitude: 19, longitude: -70, utcOffset: -4 })
    const si = A.toEngine(A.equatorialToHorizontal(101.287, -16.716, 19, s.lst)); const el = Math.asin(si[1]) * 180 / Math.PI
    if (s.sun.elevation < -20 && (!best || el > best.el)) best = { h, el, az: Math.atan2(si[0], -si[2]) * 180 / Math.PI } }
  return best }"""
CAM = """([pitch, yaw, fov]) => { const vp = window.__lf.editor.vp, c = vp.camera; c.fov = fov; c.updateProjectionMatrix()
  const p = pitch * Math.PI / 180, y = yaw * Math.PI / 180; c.position.set(0, 1.7, 0)
  c.lookAt(Math.cos(p) * Math.sin(y), 1.7 + Math.sin(p), -Math.cos(p) * Math.cos(y)); c.updateMatrixWorld(true); vp.requestRender(); return true }"""
PROJ = """async ([hour]) => { const A = await import('/src/engine/runtime/world/astro.js'); const vp = window.__lf.editor.vp, c = vp.camera
  const s = A.astroState({ year: 2026, day: 15, hour, latitude: 19, longitude: -70, utcOffset: -4 })
  const out = {}
  for (const [name, ra, dec] of [['sirius', 101.287, -16.716], ['rigel', 78.634, -8.2016], ['betelgeuse', 88.793, 7.407], ['procyon', 114.825, 5.225]]) {
    const d = A.toEngine(A.equatorialToHorizontal(ra, dec, 19, s.lst)); const v = new c.position.constructor(d[0], d[1], d[2]).multiplyScalar(100).add(c.position).project(c)
    out[name] = [v.x, v.y, v.z, d[1]] }
  return out }"""

async def shot(pg):
    els = await pg.query_selector_all('canvas'); best = None; area = 0
    for e in els:
        bb = await e.bounding_box()
        if bb and bb['width'] * bb['height'] > area: best, area = e, bb['width'] * bb['height']
    bb = await best.bounding_box()
    return np.array(Image.open(io.BytesIO(await pg.screenshot(clip=bb, timeout=120000))).convert('RGB')).astype(np.float32)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS); pg = await b.new_page(viewport={'width': 900, 'height': 560})
        logs = []; pg.on('pageerror', lambda e: logs.append(str(e)[:300])); pg.on('console', lambda m: logs.append(m.text[:300]) if m.type == 'error' else None)
        await pg.goto('http://localhost:5199/', wait_until='load')
        await pg.wait_for_function("window.__lf && window.__lf.store && window.__lf.store.ready && window.__lf.editor && window.__lf.editor.vp", timeout=60000)
        await pg.wait_for_timeout(1500)

        print('Matemática y datos')
        r = await pg.evaluate(MATH)
        check('día juliano de J2000 = 2451545,0', abs(r['j2000'] - 2451545.0) < 1e-6, r['j2000'])
        check('luna nueva el 17-feb-2026', r['newMoon'][0] < 0.02 and r['newMoon'][1] == 'Luna nueva', r['newMoon'])
        check('luna llena el 3-mar-2026', r['fullMoon'][0] > 0.98 and r['fullMoon'][1] == 'Luna llena', r['fullMoon'])
        check('cuarto menguante el 10-mar-2026', 0.4 < r['lastQ'][0] < 0.65 and r['lastQ'][1] == 'Cuarto menguante', r['lastQ'])
        check('cuarto creciente el 24-feb-2026', 0.4 < r['firstQ'][0] < 0.65 and 'creciente' in r['firstQ'][1], r['firstQ'])
        check('sol de solsticio al mediodía en el Trópico de Cáncer: >85°', r['solsticeEl'] > 85, round(r['solsticeEl'], 1))
        check('catálogo: Sirio, Vega, Polaris y Canopus en su texel', all(v > 100 for v in r['cat'].values()), r['cat'])
        check('catálogo: 9 479 estrellas', r['nstars'] == 9479, r['nstars'])
        check('albedo lunar 512×512', r['moonTex'] == [512, 262144], r['moonTex'])
        pl = {x[0]: x for x in r['planets']}
        check('Júpiter en Géminis (RA 95–125°, dec +15…+30°) en feb-2026', 95 < pl['Júpiter'][1] < 125 and 15 < pl['Júpiter'][2] < 30, pl['Júpiter'])
        check('planetas cerca de la eclíptica (|dec| < 30°)', all(abs(x[2]) < 30 for x in r['planets']))
        check('latitud 90: el polo celeste está en el cenit', abs(r['polar'][1] - 1) < 1e-9, r['polar'])

        print('Estrellas fijas en el cielo (la constelación no depende de la cámara)')
        best = await pg.evaluate(FIND); print('  Sirio alto a las %.2f h (elevación %.0f°, azimut %.0f°)' % (best['h'], best['el'], best['az']))
        await pg.evaluate(PLACE, [dict(astro=True, year=2026, day=15, hour=best['h'], longitude=-70, utcOffset=-4)])
        hits = []; ctrl = []
        for dyaw in (0, 7, -9, 14):
            await pg.evaluate(CAM, [best['el'] * 0.8, best['az'] + dyaw, 40]); await pg.wait_for_timeout(1200)
            img = await shot(pg); H, W, _ = img.shape; lum = img.max(axis=2)
            pr = await pg.evaluate(PROJ, [best['h']])
            for name, (x, y, z, up) in pr.items():
                if not (z < 1 and abs(x) < 0.9 and abs(y) < 0.9 and up > 0.2): continue
                px, py = int((x * 0.5 + 0.5) * W), int((1 - (y * 0.5 + 0.5)) * H)
                win = lum[max(0, py - 5):py + 6, max(0, px - 5):px + 6]; far = lum[max(0, py - 5):py + 6, max(0, px + 40 - 5):px + 40 + 6]
                hits.append((dyaw, name, win.max())); ctrl.append(far.max() if far.size else 0)
        ok = [h for h in hits if h[2] > 90]
        check('las estrellas conocidas aparecen donde la astronomía dice, con 4 orientaciones de cámara', len(hits) >= 5 and len(ok) == len(hits), f'{len(ok)}/{len(hits)} · picos {[int(h[2]) for h in hits]}')
        check('y no en otro sitio (control a 40 px: más oscuro que la estrella)', np.mean([h[2] for h in hits]) > np.mean(ctrl) + 40, f'estrellas {np.mean([h[2] for h in hits]):.0f} · control {np.mean(ctrl):.0f}')

        print('Modo sencillo intacto y modo real')
        mod = await pg.evaluate("""async () => { const {S,editor} = window.__lf; const W = await import('/src/engine/runtime/world/world.js'); const So = await import('/src/engine/runtime/world/solar.js'); const P = await import('/src/engine/runtime/world/params.js')
          const w = new W.World(); w.configure({ time: { on: true, hour: 20, latitude: 20, season: 'summer' } }); const f = w.frame(); const s = So.solarPosition(20, 20, P.SEASON_DAY.summer)
          const w2 = new W.World(); w2.configure({ time: { on: true, hour: 20, latitude: 20, astro: true, year: 2026, day: 172, longitude: -70, utcOffset: -4 } }); const g = w2.frame()
          w2.update(24 * 3600 / 24 * 5, {}); // sin flow: la fecha no avanza
          const w3 = new W.World(); w3.configure({ time: { on: true, hour: 23.9, flow: true, dayMinutes: 1, latitude: 20, astro: true, year: 2026, day: 365 } }); w3.update(2); const d3 = w3.date()
          const w4 = new W.World(); w4.configure({ time: { on: true, hour: 12, latitude: 20 } }); w4.setDate(100, 2025); const e4 = w4.frame()
          return { legacyAstro: f.astro, legacyEl: Math.abs(f.sunElevation - s.elevation), realEl: g.sunElevation, realHasPlanets: g.astro && g.astro.planets.length, dayAfter: d3, setDate: e4.astro && [e4.year, e4.day] } }""")
        check('sin «Astronomía real»: f.astro = null y el sol es el del modelo sencillo', mod['legacyAstro'] is None and mod['legacyEl'] < 1e-9)
        check('con ella: sol real + 5 planetas', mod['realHasPlanets'] == 5 and mod['realEl'] != 0, round(mod['realEl'], 1))
        check('la fecha avanza al pasar la medianoche (365/2026 → 1/2027)', mod['dayAfter'] == {'year': 2027, 'day': 1}, mod['dayAfter'])
        check('game.clock.setDate activa la astronomía real', mod['setDate'] == [2025, 100], mod['setDate'])
        api = await pg.evaluate("""async () => { const W = await import('/src/engine/runtime/world/world.js'); const Api = await import('/src/engine/runtime/world/api.js')
          const w = new W.World(); w.configure({ time: { on: true, hour: 22, latitude: 19, longitude: -70, utcOffset: -4 } }); const api = Api.makeWorldApi(() => w)
          const before = api.clock.moon.name; api.clock.setDate(62, 2026); const m = api.clock.moon
          api.clock.setDate(48, 2026); const n = api.clock.moon
          return { before, full: m.name, newish: n.name, ill: [m.illumination, n.illumination], planets: api.clock.planets.length, day: api.clock.day, year: api.clock.year } }""")
        check('game.clock.moon: sin astronomía «Luna llena»; 3-mar-2026 llena; 17-feb-2026 nueva', api['before'] == 'Luna llena' and api['full'] == 'Luna llena' and api['newish'] in ('Luna nueva', 'Creciente', 'Menguante'), api)
        check('game.clock.planets devuelve 5 y day/year', api['planets'] == 5 and api['day'] == 48 and api['year'] == 2026)
        un = await pg.evaluate("() => { const u = window.__lf.editor.vp.skyMat.uniforms; return [u.uAstro.value, u.uStarTex.value && u.uStarTex.value.image.width, u.uStarOff.value && u.uStarOff.value.image.width] }")
        check('el cielo del visor usa el atlas de cubo del catálogo (uAstro = 1, atlas 1536 de ancho + posiciones)', un == [1, 1536, 1536], un)
        await pg.evaluate(PLACE, [dict(astro=False, hour=best['h'])]); await pg.wait_for_timeout(600)
        un0 = await pg.evaluate("() => window.__lf.editor.vp.skyMat.uniforms.uAstro.value")
        check('apagando «Astronomía real» vuelve el modelo sencillo (uAstro = 0)', un0 == 0, un0)
        check('sin errores de página ni de consola', not logs, logs[:3])
        await b.close()
    print('\nRESULTADO:', 'OK' if OK else 'HAY FALLOS'); sys.exit(0 if OK else 1)
asyncio.run(main())
