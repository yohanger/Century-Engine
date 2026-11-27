# Estrellas estables al mover la cámara (cielo real y modo sencillo): brillo constante con la fase de muestreo, posición exacta
# (aristas y esquinas del atlas de cubo, polo), forma redonda, independencia de la posición de la cámara y de la resolución.
# Uso: npx vite --port 5199 &  python3 scripts/test-stars.py          (≈3 min con SwiftShader)
#      python3 scripts/test-stars.py --play   (además, en modo Jugar con TAA: ≈3 min más)
import asyncio, io, math, sys
import numpy as np
from PIL import Image
from scipy.ndimage import maximum_filter, label
from playwright.async_api import async_playwright

ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
OK = True
def check(name, cond, extra=''):
    global OK
    OK &= bool(cond)
    print(('  OK  ' if cond else ' FALLA ') + name + (f'  [{extra}]' if extra != '' else ''))

PLACE = """([t]) => { const {S,store,editor} = window.__lf
  S.updateEnvironment({ time: Object.assign({ on: true, latitude: 19, nightAmbient: 0.15, moonLight: 0 }, t) }, false)
  store.view.grid = false; store.view.terrain = false; editor.applyView(); return true }"""
FREEZE = "() => { const u = window.__lf.editor.vp.skyMat.uniforms.uTime; Object.defineProperty(u, 'value', { get: () => 5.0, set: () => {} }); return true }"
CAM = """([pitch, yaw, fov, x, z]) => { const vp = window.__lf.editor.vp, c = vp.camera; c.fov = fov; c.updateProjectionMatrix()
  const p = pitch * Math.PI / 180, y = yaw * Math.PI / 180; c.position.set(x, 1.7, z)
  c.lookAt(x + Math.cos(p) * Math.sin(y), 1.7 + Math.sin(p), z - Math.cos(p) * Math.cos(y)); c.updateMatrixWorld(true); vp.requestRender(); vp._render(); return true }"""
LOOK = """([dx, dy, dz, fov]) => { const vp = window.__lf.editor.vp, c = vp.camera; c.fov = fov; c.updateProjectionMatrix(); c.position.set(0, 1.7, 0)
  c.lookAt(dx, 1.7 + dy, dz); c.updateMatrixWorld(true); vp.requestRender(); vp._render(); return true }"""
# estrellas brillantes sobre el horizonte a esa hora, y cuáles quedan junto a una arista, una esquina o el polo del atlas de cubo
POOL = """async ([hour]) => {
  const A = await import('/src/engine/runtime/world/astro.js'), T = await import('/src/engine/runtime/render/astro-sky.js'), C = await import('/src/engine/runtime/world/starcat.js')
  const s = A.astroState({ year: 2026, day: 15, hour, latitude: 19, longitude: -70, utcOffset: -4 }), RAD = Math.PI / 180
  const out = []
  for (const st of C.starList(T.starCatalogData())) {
    if (st.a < 100) continue
    const raD = st.ra / RAD, decD = st.dec / RAD, d = A.toEngine(A.equatorialToHorizontal(raD, decD, 19, s.lst))
    if (d[1] < 0.22 || d[1] > 0.96) continue
    const e = [Math.cos(st.dec) * Math.cos(st.ra), Math.cos(st.dec) * Math.sin(st.ra), Math.sin(st.dec)], m = e.map(Math.abs).sort((a, b) => b - a)
    out.push({ a: st.a, d, dec: decD, edge: m[0] - m[1], corner: (m[0] - m[2]) })
  }
  return out }"""

async def shot(pg):
    els = await pg.query_selector_all('canvas'); best = None; area = 0
    for e in els:
        bb = await e.bounding_box()
        if bb and bb['width'] * bb['height'] > area: best, area = e, bb['width'] * bb['height']
    bb = await best.bounding_box()
    return np.array(Image.open(io.BytesIO(await pg.screenshot(clip=bb, timeout=120000))).convert('L')).astype(np.float32)

async def stability(pg, label, mode, fov, W, H, minmed=0.97, minp10=0.85, maxflick=0.5):
    await pg.set_viewport_size({'width': W, 'height': H}); await pg.wait_for_timeout(900)
    await pg.evaluate(PLACE, [mode]); await pg.wait_for_timeout(400)
    await pg.evaluate(CAM, [40, 20, fov, 0, 0]); await shot(pg)   # calentamiento: que el visor ya tenga el tamaño nuevo
    imgs = []
    for i in range(12):
        await pg.evaluate(CAM, [40, 20 + i * 0.03, fov, 0, 0]); imgs.append(await shot(pg))
    a = imgs[0]; pk = (a == maximum_filter(a, size=5)) & (a > 40); ys, xs = np.nonzero(pk)
    ok = (xs > 30) & (xs < a.shape[1] - 30) & (ys > 30) & (ys < a.shape[0] - 30); xs, ys = xs[ok], ys[ok]
    mx = np.array([[im[y - 4:y + 5, x - 4:x + 5].max() for im in imgs] for x, y in zip(xs, ys)])
    ratio = mx.min(1) / np.maximum(mx.max(1), 1); flick = ((mx.max(1) > 45) & (mx.min(1) < 27)).mean() * 100
    check(f'{label}: brillo estable con 0,03° de giro por cuadro ({len(xs)} estrellas, lienzo {a.shape[1]}×{a.shape[0]})', len(xs) > 300 and np.median(ratio) >= minmed and np.percentile(ratio, 10) >= minp10 and flick <= maxflick,
          f'mediana min/max {np.median(ratio):.2f} · p10 {np.percentile(ratio, 10):.2f} · caen bajo el umbral {flick:.1f} %')

async def play_taa(pg):
    """Modo Jugar con TAA (activado por defecto en Forward+): el recorte de la historia contra la vecindad 3×3 hacía parpadear las estrellas de 1 píxel."""
    await pg.set_viewport_size({'width': 560, 'height': 400}); await pg.wait_for_timeout(900)
    await pg.evaluate(PLACE, [dict(astro=True, year=2026, day=15, hour=2, longitude=-70, utcOffset=-4)])
    await asyncio.wait_for(pg.evaluate("async () => { await window.__lf.editor.player.start(); await new Promise(r => setTimeout(r, 1500)); return 1 }"), 240)
    await asyncio.wait_for(pg.evaluate("() => { const {store, editor} = window.__lf; store.project.render = Object.assign({}, store.project.render, { resScale: 1, taa: true, dynRes: false }); editor.applyRender?.(); return 1 }"), 120)
    POSE = """([yaw, n]) => { const vp = window.__lf.editor.vp, c = vp.camera; c.fov = 50; c.updateProjectionMatrix(); const p = 40 * Math.PI / 180, y = yaw * Math.PI / 180
      c.position.set(0, 1.7, 0); c.lookAt(Math.cos(p) * Math.sin(y), 1.7 + Math.sin(p), -Math.cos(p) * Math.cos(y)); c.updateMatrixWorld(true); vp.requestRender(); for (let k = 0; k < n; k++) vp._render(); return vp.look.split }"""
    split = await asyncio.wait_for(pg.evaluate(POSE, [20, 20]), 400)          # 20 cuadros de calentamiento: que la historia converja
    imgs = []
    for i in range(6):
        await asyncio.wait_for(pg.evaluate(POSE, [20 + i * 0.03, 4]), 200); imgs.append(await asyncio.wait_for(shot(pg), 120))
    a = imgs[0]; pk = (a == maximum_filter(a, size=5)) & (a > 40); ys, xs = np.nonzero(pk)
    ok = (xs > 30) & (xs < a.shape[1] - 30) & (ys > 30) & (ys < a.shape[0] - 30); xs, ys = xs[ok], ys[ok]
    mx = np.array([[im[y - 4:y + 5, x - 4:x + 5].max() for im in imgs] for x, y in zip(xs, ys)]); ratio = mx.min(1) / np.maximum(mx.max(1), 1)
    check(f'modo Jugar con TAA, resolución nativa: brillo estable al girar 0,03° ({len(xs)} estrellas; antes ≈ 0,83 / p10 0,55 con las mismas condiciones)', bool(split) and len(xs) > 200 and np.median(ratio) >= 0.90 and np.percentile(ratio, 10) >= 0.78,
          f'mediana min/max {np.median(ratio):.2f} · p10 {np.percentile(ratio, 10):.2f} · render dividido {split}')

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS); pg = await b.new_page(viewport={'width': 900, 'height': 560})
        logs = []; pg.on('pageerror', lambda e: logs.append(str(e)[:300])); pg.on('console', lambda m: logs.append(m.text[:300]) if m.type == 'error' else None)
        await pg.goto('http://localhost:5199/', wait_until='load')
        await pg.wait_for_function("window.__lf && window.__lf.store && window.__lf.store.ready && window.__lf.editor && window.__lf.editor.vp", timeout=60000)
        await pg.wait_for_timeout(1500); await pg.evaluate(FREEZE)
        REAL = dict(astro=True, year=2026, day=15, hour=2, longitude=-70, utcOffset=-4); SIMPLE = dict(astro=False, hour=1)

        print('Brillo estable al girar la cámara (antes: mediana 0,84 y 0,72, hasta 3,8 % de estrellas que caían bajo el umbral)')
        await stability(pg, 'astronomía real · campo 45°', REAL, 45, 900, 560)
        await stability(pg, 'astronomía real · campo 80°', REAL, 80, 900, 560)
        await stability(pg, 'astronomía real · campo 45° y lienzo pequeño (píxel ≈ 0,16°)', REAL, 45, 600, 460)
        await stability(pg, 'modo sencillo · campo 45°', SIMPLE, 45, 900, 560)
        await stability(pg, 'modo sencillo · campo 80°', SIMPLE, 80, 900, 560, maxflick=0.6)
        await pg.set_viewport_size({'width': 900, 'height': 560}); await pg.wait_for_timeout(900)

        print('Posición exacta y forma redonda (centradas en la estrella: aristas, esquinas y polo del atlas)')
        await pg.evaluate(PLACE, [REAL]); await pg.wait_for_timeout(500)
        pool = await pg.evaluate(POOL, [2])
        sel = {'arista': sorted(pool, key=lambda s: s['edge'])[:6], 'esquina': sorted(pool, key=lambda s: s['corner'])[:4], 'polo': sorted(pool, key=lambda s: -abs(s['dec']))[:4]}
        print(f'  {len(pool)} estrellas brillantes sobre el horizonte; se prueban {sum(len(v) for v in sel.values())}')
        for kind, lst in sel.items():
            errs, asp, peaks = [], [], []
            for s in lst:
                await pg.evaluate(LOOK, [s['d'][0] * 100, s['d'][1] * 100, s['d'][2] * 100, 30]); img = await shot(pg); H, W = img.shape
                cy, cx = H // 2, W // 2; R = 9; win = img[cy - R:cy + R + 1, cx - R:cx + R + 1]; pk = win.max(); peaks.append(pk)
                lab, _ = label(win > max(30, 0.35 * pk)); m = lab == lab[R, R] if lab[R, R] else lab == lab[np.unravel_index(win.argmax(), win.shape)]   # la mancha que contiene el centro
                yy, xx = np.nonzero(m); w = win[m]
                errs.append(math.hypot((xx * w).sum() / w.sum() - R, (yy * w).sum() / w.sum() - R))
                asp.append(max(np.ptp(xx) + 1, 1) / max(np.ptp(yy) + 1, 1)); asp[-1] = max(asp[-1], 1 / asp[-1])
            check(f'estrellas junto a {kind} ({len(lst)}): centradas a < 1,5 px, picos > 100 y redondas (relación < 1,7)', len(lst) >= 3 and max(errs) < 1.5 and min(peaks) > 100 and max(asp) < 1.7,
                  f'error máx {max(errs):.2f} px · pico mín {min(peaks):.0f} · relación máx {max(asp):.2f}')

        print('El cielo no depende de la posición de la cámara ni de su movimiento')
        await pg.evaluate(CAM, [35, 40, 50, 0, 0]); a0 = await shot(pg)
        await pg.evaluate(CAM, [35, 40, 50, 800, -300]); a1 = await shot(pg)
        d = np.abs(a0 - a1); check('mover la cámara 850 m sin girarla deja el cielo idéntico (diferencia máx < 3)', d.max() < 3, f'{d.max():.1f}')
        await pg.evaluate(PLACE, [SIMPLE]); await pg.wait_for_timeout(300)
        await pg.evaluate(CAM, [35, 40, 50, 0, 0]); s0 = await shot(pg); await pg.evaluate(CAM, [35, 40, 50, 800, -300]); s1 = await shot(pg)
        check('también en el modo sencillo (diferencia máx < 3)', np.abs(s0 - s1).max() < 3, f'{np.abs(s0 - s1).max():.1f}')
        if '--play' in sys.argv: print('Modo Jugar (el TAA se retiró en 0.26.9: mide MSAA ×4, ya sin las expectativas de TAA)'); await play_taa(pg)
        check('sin errores de página ni de consola', not [l for l in logs if 'GPU stall' not in l], logs[:3])
        await b.close()
    print('\nRESULTADO:', 'OK' if OK else 'HAY FALLOS'); sys.exit(0 if OK else 1)
asyncio.run(main())
