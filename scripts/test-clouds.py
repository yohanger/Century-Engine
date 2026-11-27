# Nubes por celdas (bloque E) en el navegador: el mapa llega al shader, el cielo cambia con la semilla, las nubes siguen al viento, el modelo clásico no cambia ni un píxel,
# la lluvia local sigue a la cámara, el campo se recentra al viajar lejos y la API de scripts responde.
# Uso: npx vite --port 5199 &  python3 scripts/test-clouds.py          (≈4 min con SwiftShader)
import asyncio, io, sys, time
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright

ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
OK = True
_T0 = time.time()
def check(name, cond, extra=''):
    global OK
    OK &= bool(cond)
    print(('  OK  ' if cond else ' FALLA ') + name + (f'  [{extra}]' if extra != '' else '') + f'  ({time.time() - _T0:.0f}s)', flush=True)

# Escena: clima activo con el modelo y la semilla dados; el mundo avanza `sec` segundos de simulación y el visor lo recibe.
SET = """async ([o]) => { const { S, store, editor } = window.__lf, vp = editor.vp
  S.updateEnvironment({ time: { on: true, hour: 13 }, weather: Object.assign({ on: true, preset: 'cloudy', cloudModel: 'cells', cloudSeed: 4242, directorSeed: 9, moisture: false, windSpeed: 3, windDir: 45, gusts: 0 }, o.weather || {}) }, false)
  store.view.grid = false; store.view.terrain = false; editor.applyView()
  const w = editor.world, c = vp.camera; c.position.set(o.x || 0, 1.7, o.z || 0); c.updateMatrixWorld(true)
  for (let i = 0; i < (o.steps ?? 100); i++) { editor.applyWorld(); w.update(0.1) }
  editor.applyWorld(); return { cells: w.cellsOn, seed: w.field?.seed ?? null, v: w.field?.map.version ?? null } }"""
STEP = """([sec, dt]) => { const { editor } = window.__lf, w = editor.world; for (let t = 0; t < sec; t += dt) { w.update(dt) } editor.applyWorld(); return w.field ? { off: [...w.field.windOff], wind: [...w.field.wind] } : null }"""
POSE = """([pitch, yaw, fov, x, z]) => { const vp = window.__lf.editor.vp, c = vp.camera; c.fov = fov; c.updateProjectionMatrix(); const p = pitch * Math.PI / 180, a = yaw * Math.PI / 180
  c.position.set(x, 1.7, z); c.lookAt(x + Math.cos(p) * Math.sin(a), 1.7 + Math.sin(p), z - Math.cos(p) * Math.cos(a)); c.updateMatrixWorld(true)
  window.__lf.editor.applyWorld(); vp.requestRender(); vp._render(); vp._render(); return true }"""

FREEZE = "() => { const u = window.__lf.editor.vp.skyMat.uniforms.uTime; Object.defineProperty(u, 'value', { get: () => 5.0, set: () => {} }); return true }"

async def shot(pg):
    els = await pg.query_selector_all('canvas'); best = None; area = 0
    for e in els:
        bb = await e.bounding_box()
        if bb and bb['width'] * bb['height'] > area: best, area = e, bb['width'] * bb['height']
    return np.array(Image.open(io.BytesIO(await best.screenshot(timeout=120000))).convert('L')).astype(np.float32)

def shift(a, b, rng=160):
    """Desplazamiento horizontal (px) del contenido de `a` a `b` (dx > 0: hacia la derecha): el que minimiza la diferencia media absoluta en la zona común."""
    best, bx = 1e9, 0
    for dx in range(-rng, rng + 1, 2):
        if dx >= 0: d = np.abs(a[:, : a.shape[1] - dx] - b[:, dx:]).mean()
        else: d = np.abs(a[:, -dx:] - b[:, : b.shape[1] + dx]).mean()
        if d < best: best, bx = d, dx
    return bx, 0

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS); pg = await b.new_page(viewport={'width': 760, 'height': 520})
        logs = []
        pg.on('pageerror', lambda e: logs.append('ERR ' + str(e)[:300]))
        pg.on('console', lambda m: logs.append(m.text[:300]) if (m.type == 'error' and 'GPU stall' not in m.text) else None)
        await pg.goto('http://localhost:5199/', wait_until='load')
        await pg.wait_for_function("window.__lf && window.__lf.store && window.__lf.store.ready && window.__lf.editor && window.__lf.editor.vp", timeout=60000)
        await pg.wait_for_timeout(1500)
        await pg.evaluate(FREEZE)   # el detalle de las nubes se anima con uTime: congelado para comparar imágenes

        print('Render con celdas')
        r = await pg.evaluate(SET, [{}])
        check('el mundo crea el campo con «cloudModel: cells»', r['cells'] and r['seed'] == 4242, r)
        await pg.evaluate(POSE, [35, 0, 90, 0, 0])
        u = await pg.evaluate("""() => { const vp = window.__lf.editor.vp, u = vp.skyMat.uniforms, M = window.__lf.editor.world.field.map
          return { cc: u.uCCells.value, tex: !!u.uCMap.value, N: u.uCMap.value?.image.width, half: u.uCMapHalf.value, base: u.uCBase.value, thick: u.uCThick.value, slabB: M.slabBase, slabT: M.slabThick, clouds: u.uClouds.value, hc: M.hasClouds } }""")
        check('el shader recibe el mapa, su radio y la losa de nubes', u['cc'] == 1 and u['tex'] and u['N'] == 128 and abs(u['half'] - 24960) < 1 and abs(u['base'] - u['slabB']) < 1e-3 and abs(u['thick'] - u['slabT']) < 1e-3 and u['clouds'] == 1, u)
        A = await shot(pg)
        sky = A[: int(A.shape[0] * 0.55)]
        check('el cielo muestra nubes: contraste y brillo plausibles', sky.std() > 8 and sky.max() > 150, f'σ {sky.std():.1f} · máx {sky.max():.0f}')

        print('Semilla y reconfiguración')
        await pg.evaluate(SET, [{'weather': {'cloudSeed': 99}}]); await pg.evaluate(POSE, [35, 0, 90, 0, 0]); B = await shot(pg)
        d = np.abs(A - B)[: int(A.shape[0] * 0.55)].mean()
        check('otra semilla → otro cielo (la textura del mapa se resube aunque la versión coincida)', d > 6, f'diferencia media {d:.1f}')
        await pg.evaluate(SET, [{}]); await pg.evaluate(POSE, [35, 0, 90, 0, 0]); C = await shot(pg)
        check('misma semilla → mismo cielo', np.abs(A - C)[: int(A.shape[0] * 0.55)].mean() < 1.0, f'{np.abs(A - C).mean():.2f}')

        print('Modelo clásico intacto')
        await pg.evaluate(SET, [{'weather': {'cloudModel': 'classic'}}])
        await pg.evaluate("() => { const w = window.__lf.editor.world; w.__upd = w.update; w.update = () => {} }")   # el mundo quieto: el visor en vivo ya no mueve las nubes entre capturas
        await pg.evaluate(POSE, [35, 0, 90, 0, 0]); K1 = await shot(pg)
        st = await pg.evaluate("() => { const vp = window.__lf.editor.vp; return { cc: vp.skyMat.uniforms.uCCells.value, f: !!window.__lf.editor.world.field } }")
        check('clásico: sin campo y uCCells = 0', st['cc'] == 0 and not st['f'], st)
        await pg.evaluate(POSE, [35, 0, 90, 0, 0]); K1b = await shot(pg)   # referencia de ruido: el mismo shader dos veces (el mundo sigue avanzando entre capturas)
        # shader anterior (sin la rama de celdas) reconstruido en la página: debe dar los mismos píxeles
        K2 = None
        ok = await pg.evaluate("""() => { const vp = window.__lf.editor.vp, m = vp.skyMat, fs = m.fragmentShader
          const a = fs.indexOf('float cloudDensity(vec3 wp, float hf, bool full) {'), b = fs.indexOf('vec3 q = p * (0.00032 / uCScale);', a)
          if (a < 0 || b < 0) return false
          const old = 'float cloudDensity(vec3 wp, float hf, bool full) {\\n  vec3 p = vec3(wp.x + uWindOff.x, wp.y, wp.z + uWindOff.y);\\n  float cov = cloudCoverage(p);\\n  if (cov <= 0.002) return 0.0;\\n  '
          window.__fs0 = fs; m.fragmentShader = (fs.slice(0, a) + old + fs.slice(b)).replace('heightGradient(hf, typ)', 'heightGradient(hf, uCType)'); m.needsUpdate = true; vp.requestRender(); vp._render(); vp._render(); return true }""")
        if ok: K2 = await shot(pg)
        await pg.evaluate("() => { const m = window.__lf.editor.vp.skyMat; if (window.__fs0) { m.fragmentShader = window.__fs0; m.needsUpdate = true } }")
        base = float(np.abs(K1 - K1b).mean()); dd = float(np.abs(K1 - K2).mean()) if K2 is not None else 99.0
        await pg.evaluate("() => { const w = window.__lf.editor.world; if (w.__upd) { w.update = w.__upd; delete w.__upd } }")
        check('clásico: el shader nuevo da el mismo cielo que el anterior (mismo shader dos veces = referencia de ruido)', ok and K2 is not None and dd <= base + 1e-6 and float(np.abs(K1 - K2).max()) <= float(np.abs(K1 - K1b).max()), f'nuevo↔anterior {dd:.3f} · nuevo↔nuevo {base:.3f} (media de |Δ| en 0–255)')

        print('Viento')
        for dirn, sign in ((90, 1), (270, -1)):
            await pg.evaluate(SET, [{'weather': {'windSpeed': 14, 'windDir': dirn, 'gusts': 0}, 'steps': 60}])
            await pg.evaluate(POSE, [30, 0, 70, 0, 0]); S0 = await shot(pg)
            off0 = await pg.evaluate(STEP, [0.1, 0.1]); await pg.evaluate(STEP, [20, 0.1]); off1 = await pg.evaluate(STEP, [0.1, 0.1])
            await pg.evaluate(POSE, [30, 0, 70, 0, 0]); S1 = await shot(pg)
            sk = lambda im: im[: int(im.shape[0] * 0.5)]
            dx, dy = shift(sk(S0), sk(S1))
            mv = off1['off'][0] - off0['off'][0]
            check(f'viento hacia {"el este" if dirn == 90 else "el oeste"} ({dirn}°): las nubes se desplazan {mv:.0f} m y el cielo se corre hacia {"la derecha" if sign > 0 else "la izquierda"}', mv * sign > 200 and dx * sign >= 3, f'Δx {mv:.0f} m · corrimiento {dx} px')

        print('Lluvia local y observador')
        await pg.evaluate(SET, [{'weather': {'preset': 'rain', 'cloudSize': 1}, 'steps': 120}])
        pts = await pg.evaluate("""() => { const w = window.__lf.editor.world, f = w.field; let wet = null, dry = null
          for (let x = -6000; x <= 6000 && !(wet && dry); x += 250) for (let z = -6000; z <= 6000 && !(wet && dry); z += 250) { const mm = f.effectivePrecipitationAt(x, 1.7, z); if (mm > 15 && !wet) wet = [x, z, mm]; if (mm < 1 && !dry) dry = [x, z, mm] }
          return { wet, dry } }""")
        check('hay un punto mojado y uno seco a pocos km (preset «lluvia», nubes ×1)', pts['wet'] and pts['dry'], pts)
        if pts['wet'] and pts['dry']:
            rr = []
            for q in (pts['wet'], pts['dry']):
                r = await pg.evaluate("""([x, z]) => { const { editor } = window.__lf, w = editor.world, vp = editor.vp; vp.camera.position.set(x, 1.7, z); vp.camera.updateMatrixWorld(true)
                  w._cq.init = false; editor.applyWorld(); w.update(0.05); editor.applyWorld()
                  return { obs: [...w._obs], rain: w.rainLevel, fr: vp._wf.precip.rain, mm: vp._wf.precipMm, api: editor.player?.game?.api?.weather ? 1 : 0 } }""", [q[0], q[1]])
                rr.append(r)
            check('la cámara es el observador del clima (se mueve con ella)', abs(rr[0]['obs'][0] - pts['wet'][0]) < 1e-6 and abs(rr[1]['obs'][2] - pts['dry'][1]) < 1e-6, rr[0]['obs'])
            check('el visor recibe la lluvia local: llueve en el punto mojado y no en el seco', rr[0]['fr'] > 0.25 and rr[0]['mm'] > 10 and rr[1]['fr'] < 0.06 and rr[1]['mm'] < 3, f"mojado {rr[0]['fr']:.2f} ({rr[0]['mm']:.0f} mm/h) · seco {rr[1]['fr']:.2f} ({rr[1]['mm']:.1f} mm/h)")

        print('Viajar lejos: el campo se recentra')
        await pg.evaluate(SET, [{'weather': {'preset': 'cloudy'}}])
        c0 = await pg.evaluate("() => window.__lf.editor.world.field.map.cx")
        await pg.evaluate(SET, [{'weather': {'preset': 'cloudy'}, 'x': 14000, 'z': -9000, 'steps': 30}])
        await pg.evaluate(POSE, [35, 0, 90, 14000, -9000])
        far = await pg.evaluate("() => { const M = window.__lf.editor.world.field.map, u = window.__lf.editor.vp.skyMat.uniforms; return { cx: M.cx, cz: M.cz, camx: u.uCCam.value.x, camz: u.uCCam.value.y, half: M.half } }")
        F = await shot(pg); sky = F[: int(F.shape[0] * 0.55)]
        check('a 17 km del origen el mapa se recentra sobre la cámara y el cielo sigue dibujando nubes', abs(far['camx']) < far['half'] * 0.3 and abs(far['camz']) < far['half'] * 0.3 and sky.std() > 6, f"cámara en el mapa ({far['camx']:.0f}, {far['camz']:.0f}) m · σ {sky.std():.1f}")

        print('Coste')
        await pg.evaluate(SET, [{'weather': {'preset': 'storm'}}]); await pg.evaluate(POSE, [30, 0, 80, 0, 0])
        tm = await pg.evaluate("""() => { const vp = window.__lf.editor.vp, f = window.__lf.editor.world.field, t = []
          for (let i = 0; i < 6; i++) { const a = performance.now(); vp.requestRender(); vp._render(); vp.renderer.getContext().finish(); t.push(performance.now() - a) }
          return { med: t.sort((a, b) => a - b)[3], bake: f.map.ms, prims: f.map.prims, cells: f.stats().active } }""")
        await pg.evaluate(SET, [{'weather': {'preset': 'storm', 'cloudModel': 'classic'}}]); await pg.evaluate(POSE, [30, 0, 80, 0, 0])
        tc = await pg.evaluate("""() => { const vp = window.__lf.editor.vp, t = []
          for (let i = 0; i < 6; i++) { const a = performance.now(); vp.requestRender(); vp._render(); vp.renderer.getContext().finish(); t.push(performance.now() - a) }
          return t.sort((a, b) => a - b)[3] }""")
        check('tormenta: el horneado del mapa cuesta pocos ms y hay celdas y primitivas', tm['bake'] < 60 and tm['cells'] > 20 and tm['prims'] > 100, f"horneado {tm['bake']:.1f} ms · {tm['cells']} celdas · {tm['prims']} primitivas (render medido en SwiftShader: {tm['med']:.0f} vs {tc:.0f} ms clásico, no fiable)")

        print('API de scripts (game.weather)')
        await pg.evaluate(SET, [{'weather': {'preset': 'storm'}}])
        api = await asyncio.wait_for(pg.evaluate("""async () => { const { editor } = window.__lf; await editor.player.start(); await new Promise((r) => setTimeout(r, 1500)); const g = editor.player.game.api, W = g.weather
          const out = { model: W.cloudModel, cover: W.cloudCover ?? W.cloudCoverage, sun: W.sunTransmission, mm: W.precipitation, here: W.precipitationAt(0, 0), far: W.precipitationAt(1e6, 1e6), storm: W.nearestStorm(), none: W.nearestStorm(5) }
          editor.player.stop?.(); return out }"""), 240)
        check('game.weather.cloudModel devuelve «cells» y las medidas están en rango', api['model'] == 'cells' and 0 <= api['cover'] <= 1 and 0 <= api['sun'] <= 1 and api['mm'] >= 0, api)
        check('precipitationAt(x, z) es un número ≥ 0 (el campo no termina: a 1 000 km también hay tormenta) y coincide con precipitation en el punto del jugador', isinstance(api['here'], (int, float)) and api['here'] >= 0 and api['far'] >= 0 and abs(api['here'] - api['mm']) < 6, f"aquí {api['here']:.1f} · precipitation {api['mm']:.1f} · muy lejos {api['far']:.1f}")
        check('nearestStorm() da {distance, bearing} o null; con alcance mínimo, null', (api['storm'] is None or (api['storm']['distance'] > 0 and 0 <= api['storm']['bearing'] < 360)) and api['none'] is None, api['storm'])

        bad = [l for l in logs if 'GPU stall' not in l]
        check('sin errores de página ni de WebGL', not bad, bad[:3])
        await b.close()
    print('\nTodo bien' if OK else '\nHay fallos')
    sys.exit(0 if OK else 1)

asyncio.run(main())
