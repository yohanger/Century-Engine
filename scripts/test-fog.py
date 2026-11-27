# Niebla atmosférica física (bloque D) en el navegador: el shader contra la referencia en CPU (world/fog.js), haces de sol, volúmenes
# atmosféricos con geometría real, profundidad real, clima → humedad y las salidas de emergencia (clásico, bajo el agua).
# Chromium con SwiftShader (sin GPU). Se lee el contenido de los buffers del pase (media resolución, half-float), no una captura.
# Uso: (npx vite --port 5199 &) ; python3 scripts/test-fog.py
import asyncio, io, json, math, sys, time
_T0 = time.time()
import numpy as np
from PIL import Image
from playwright.async_api import async_playwright

ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']
OK = True
def check(name, cond, extra=''):
    global OK
    OK &= bool(cond)
    print(('  OK  ' if cond else ' FALLA ') + name + (f'  [{extra}]' if extra != '' else '') + f'  ({time.time() - _T0:.0f}s)', flush=True)

# utilidades dentro de la página
LIB = """() => {
  const vp = window.__lf.editor.vp
  const half = (u) => { const s = (u & 0x8000) ? -1 : 1, e = (u >> 10) & 31, f = u & 1023; return e === 0 ? s * Math.pow(2, -14) * (f / 1024) : e === 31 ? s * Infinity : s * Math.pow(2, e - 15) * (1 + f / 1024) }
  window.__T = {
    vp, half,
    draw() { vp.look.atmoPass && 0; vp._render() },
    read(rt) { const w = rt.width, h = rt.height, buf = new Uint16Array(w * h * 4); vp.renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf); return { w, h, buf } },
    texel(rt, u, v) { const r = this.read(rt), i = Math.min(r.w - 1, Math.floor(u * r.w)), j = Math.min(r.h - 1, Math.floor(v * r.h)), k = (j * r.w + i) * 4; return [half(r.buf[k]), half(r.buf[k + 1]), half(r.buf[k + 2]), half(r.buf[k + 3])] },
    ray(u, v) { const c = vp.camera; c.updateMatrixWorld(true); const p = new c.position.constructor(); p.setFromMatrixPosition(c.matrixWorld)
      const d = new c.position.constructor(u * 2 - 1, v * 2 - 1, 0.5).unproject(c).sub(p).normalize(); return [d.x, d.y, d.z] },
    cam(x, y, z, pitch, yaw, fov = 60) { const c = vp.camera; c.fov = fov; c.updateProjectionMatrix(); c.position.set(x, y, z); const p = pitch * Math.PI / 180, a = yaw * Math.PI / 180
      c.lookAt(x + Math.cos(p) * Math.sin(a), y + Math.sin(p), z - Math.cos(p) * Math.cos(a)); c.updateMatrixWorld(true) },
  }
  return true }"""

SETUP = """async (env) => { const { S, store, editor } = window.__lf
  S.updateEnvironment(env, false)
  store.view.grid = false; store.view.terrain = false; editor.applyView()
  return true }"""

# lo que el shader debería dar para un rayo del cielo (dist = distancia máxima): referencia CPU de world/fog.js
CPU = """async ([u, v, dist, vol]) => { const F = await import('/src/engine/runtime/world/fog.js'); const T = window.__T, vp = T.vp, S = vp._fogState
  const r = T.ray(u, v), c = vp.camera, P = { ...S.params }
  const volume = vol ? F.makeVolume(vol) : null
  const out = F.fogRay({ params: P, originY: c.position.y, origin: [c.position.x, c.position.y, c.position.z], ray: r, dist, color: [S.color.r, S.color.g, S.color.b], sun: { dir: S.sunDir, color: S.sunColor, intensity: S.sunIntensity }, volume })
  return { T: out.transmittance, rgb: out.rgb, tau: out.opticalDepth, ray: r } }"""

def close(a, b, tol): return all(abs(x - y) <= tol for x, y in zip(a, b))

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS); pg = await b.new_page(viewport={'width': 900, 'height': 560})
        logs = []
        pg.on('pageerror', lambda e: logs.append('ERR ' + str(e)[:300]))
        pg.on('console', lambda m: logs.append(m.text[:300]) if (m.type in ('error', 'warning') and ('GL' in m.text or 'WebGL' in m.text or 'feedback' in m.text.lower() or m.type == 'error') and 'GPU stall' not in m.text) else None) # el aviso de rendimiento de ReadPixels lo provoca la propia prueba
        await pg.goto('http://localhost:5199/', wait_until='load')
        await pg.wait_for_function("window.__lf && window.__lf.store && window.__lf.store.ready && window.__lf.editor && window.__lf.editor.vp", timeout=60000)
        await pg.wait_for_timeout(1500)
        await pg.evaluate(LIB)
        ENV = {'fog': True, 'fogDensity': 0.01, 'fogColor': '#9fb2c8', 'fogStart': 0, 'fogMode': 'physical', 'fogFalloff': 0, 'fogHeight': 0, 'fogShafts': 1, 'fogScatter': 1,
               'time': {'on': False}, 'weather': {'on': False}}

        print('Propiedad de la niebla: pase del compositor o FogExp2')
        await pg.evaluate(SETUP, ENV); await pg.evaluate("() => { const T = window.__T; T.cam(5000, 1.7, 5000, 0, 0); T.draw(); T.draw() }")
        st = await pg.evaluate("() => { const v = window.__T.vp, l = v.look; return { phys: !!v._fogState?.physical, own: !!l._physFog, pass: !!l.atmoPass, en: l.atmoPass?.enabled, fog: v.scene.fog ? (v.scene.fog.isFogExp2 ? 'FogExp2' : 'otra') : null, composer: l.usesComposer, profile: l.profile } }")
        check('modo físico con composer: el pase trabaja y la escena no lleva FogExp2', st['phys'] and st['own'] and st['pass'] and st['en'] and st['fog'] is None and st['composer'], st)
        await pg.evaluate(SETUP, {**ENV, 'fogMode': 'simple'}); await pg.evaluate("() => { const T = window.__T; T.draw(); T.draw() }")
        st = await pg.evaluate("() => { const v = window.__T.vp, l = v.look; return { own: !!l._physFog, en: l.atmoPass?.enabled, fog: v.scene.fog ? (v.scene.fog.isFogExp2 ? 'FogExp2' : 'otra') : null, d: v.scene.fog?.density } }")
        check('modo simple: FogExp2 de three y el pase apagado', (not st['own']) and (not st['en']) and st['fog'] == 'FogExp2' and abs(st['d'] - 0.01) < 1e-9, st)
        await pg.evaluate(SETUP, ENV); await pg.evaluate("() => { const T = window.__T; T.draw(); T.draw() }")

        print('Shader frente a la referencia CPU (cielo: distancia = distancia máxima)')
        cases = [('horizontal', 0, 0, 0.5, 0.5), ('arriba 25°', 25, 0, 0.5, 0.5), ('abajo 8°', -8, 0, 0.5, 0.5), ('arriba 60°', 60, 30, 0.5, 0.5), ('esquina sup. dcha', 5, 90, 0.9, 0.9), ('esquina inf. izq', 2, 200, 0.1, 0.1)]
        for hgt in (1.7, 400):
            for name, pitch, yaw, u, v in cases:
                await pg.evaluate("([h, pi, ya]) => { const T = window.__T; T.cam(5000, h, 5000, pi, ya); T.draw() }", [hgt, pitch, yaw])
                gpu = await pg.evaluate("([u, v]) => window.__T.texel(window.__T.vp.look.atmoPass.fog, u, v)", [u, v])
                dist = await pg.evaluate("() => Math.min(window.__T.vp._fogState.params.maxDistance, window.__T.vp.camera.far * 0.98)")
                cpu = await pg.evaluate(CPU, [u, v, dist, None])
                err = max(abs(gpu[0] - cpu['rgb'][0]), abs(gpu[1] - cpu['rgb'][1]), abs(gpu[2] - cpu['rgb'][2]), abs(gpu[3] - cpu['T']))
                check(f'altura {hgt} m · {name}: rgb y T coinciden (error {err:.4f})', err < 0.008, f"gpu {[round(x, 3) for x in gpu]} cpu {[round(x, 3) for x in cpu['rgb']] + [round(cpu['T'], 3)]}")

        print('Profundidad real: un muro a 40 m')
        await pg.evaluate("() => { const { S } = window.__lf; window.__wall = S.addObject({ type: 'primitive', kind: 'box', position: [5000, 6, 4960], scale: [200, 30, 1] }, { select: false }); const T = window.__T; T.cam(5000, 1.7, 5000, 0, 0); T.draw() }")
        gpu = await pg.evaluate("() => window.__T.texel(window.__T.vp.look.atmoPass.fog, 0.5, 0.5)")
        cpu = await pg.evaluate(CPU, [0.5, 0.5, 39.5, None])
        check('el muro limita la distancia: T y luz con distancia ≈ 39,5 m', abs(gpu[3] - cpu['T']) < 0.004 and abs(gpu[1] - cpu['rgb'][1]) < 0.004, f"gpu {[round(x, 4) for x in gpu]} cpu T {cpu['T']:.4f} g {cpu['rgb'][1]:.4f}")
        far = await pg.evaluate(CPU, [0.5, 0.5, 1960, None])
        check('y es claramente distinta de la del cielo (la profundidad se usa)', far['T'] < cpu['T'] - 0.3, f"T muro {cpu['T']:.3f} · T cielo {far['T']:.3f}")

        print('Volúmenes atmosféricos con geometría real')
        VOL = {'position': [5000, 1.7, 5000], 'rotation': [0, 0, 0, 1], 'size': [8, 4, 8], 'exchange': 0}
        await pg.evaluate("() => { const { S } = window.__lf; window.__vol = S.addObject({ type: 'atmovolume', position: [5000, 1.7, 5000], scale: [8, 4, 8] }, { select: false }); window.__T.draw() }")
        n = await pg.evaluate("() => window.__T.vp.atmoVolumes().length")
        check('el nodo «Volumen atmosférico» se registra y el visor lo ve', n == 1, n)
        # muro a 2,5 m dentro del volumen
        await pg.evaluate("() => { const { S } = window.__lf; S.updateObject?.(window.__wall.id, { position: [5000, 6, 4997.5] }); window.__T.draw() }")
        wp = await pg.evaluate("() => { const o = window.__wall; return window.__lf.store.project.objects.find((x) => x.id === o.id)?.position }")
        gpu = await pg.evaluate("() => window.__T.texel(window.__T.vp.look.atmoPass.fog, 0.5, 0.5)")
        check('dentro del interior cerrado (exchange 0), con un muro a ~2 m, no hay niebla (T = 1)', wp and abs(wp[2] - 4997.5) < 1e-6 and gpu[3] > 0.9995 and gpu[1] < 0.001, f"muro z={wp} gpu {[round(x, 4) for x in gpu]}")
        # intercambio 1: la niebla entra entera → vuelve a coincidir con la referencia sin volumen
        await pg.evaluate("() => { const { S } = window.__lf; S.updateObject?.(window.__wall.id, { position: [5000, 6, 4960] }); S.updateObject?.(window.__vol.id, { props: { exchange: 1 } }); window.__T.draw() }")
        gpu = await pg.evaluate("() => window.__T.texel(window.__T.vp.look.atmoPass.fog, 0.5, 0.5)")
        cpu = await pg.evaluate(CPU, [0.5, 0.5, 39.5, None])
        check('exchange 1: igual que sin volumen', abs(gpu[3] - cpu['T']) < 0.004, f"gpu T {gpu[3]:.4f} cpu {cpu['T']:.4f}")
        # exchange 0 y muro lejano (40 m): la niebla cuenta solo desde la salida (a 4 m) → coincide con la CPU con volumen
        await pg.evaluate("() => { const { S } = window.__lf; S.updateObject?.(window.__vol.id, { props: { exchange: 0 } }); window.__T.draw() }")
        gpu = await pg.evaluate("() => window.__T.texel(window.__T.vp.look.atmoPass.fog, 0.5, 0.5)")
        cpu = await pg.evaluate(CPU, [0.5, 0.5, 39.5, VOL])
        check('exchange 0 con muro a 40 m: la niebla empieza en la salida (4 m) y coincide con la CPU', abs(gpu[3] - cpu['T']) < 0.004 and abs(gpu[1] - cpu['rgb'][1]) < 0.004, f"gpu T {gpu[3]:.4f} cpu {cpu['T']:.4f}")
        await pg.evaluate("() => { const { S } = window.__lf; S.removeObject?.(window.__vol.id); S.removeObject?.(window.__wall.id); window.__T.draw() }")

        print('Haces de sol: mirando al sol el valor es exacto')
        # sol a 20° de elevación, azimut 0 (norte): cámara mirando justo al sol
        await pg.evaluate(SETUP, {**ENV, 'sunLink': False, 'sunElevation': 20, 'sunAzimuth': 0})
        await pg.evaluate("() => { const T = window.__T; T.cam(5000, 1.7, 5000, 20, 0); T.draw() }")
        info = await pg.evaluate("() => { const T = window.__T, S = T.vp._fogState, a = T.vp.look.atmoPass; return { dir: S.sunDir, sc: S.sunColor, I: S.sunIntensity, str: a.state.shaft, den: Math.min(1, S.params.density / 0.01), mul: S.shafts } }")
        sh = await pg.evaluate("() => window.__T.texel(window.__T.vp.look.atmoPass.shaft, 0.5, 0.5)")
        want = [info['sc'][0] * info['str'] * info['den'] * info['mul'], info['sc'][1] * info['str'] * info['den'] * info['mul'], info['sc'][2] * info['str'] * info['den'] * info['mul']]
        check('con el sol en el centro: rgb de los haces = color del sol × fuerza × densidad relativa', info['str'] > 0.1 and close(sh[:3], want, 0.01) and abs(sh[3] - info['str'] * info['den']) < 0.01, f"fuerza {info['str']:.3f} · gpu {[round(x, 3) for x in sh]} · esperado {[round(x, 3) for x in want]}")
        await pg.evaluate("() => { const T = window.__T; T.cam(5000, 1.7, 5000, 20, 180); T.draw() }")
        info2 = await pg.evaluate("() => window.__T.vp.look.atmoPass.state.shaft")
        sh2 = await pg.evaluate("() => window.__T.texel(window.__T.vp.look.atmoPass.shaft, 0.5, 0.5)")
        check('de espaldas al sol no hay haces', info2 == 0 and sh2[3] == 0, f"{info2} {sh2}")
        await pg.evaluate(SETUP, {**ENV, 'sunLink': False, 'sunElevation': 20, 'sunAzimuth': 0, 'fogShafts': 0}); await pg.evaluate("() => { const T = window.__T; T.cam(5000, 1.7, 5000, 20, 0); T.draw() }")
        sh3 = await pg.evaluate("() => window.__T.texel(window.__T.vp.look.atmoPass.shaft, 0.5, 0.5)")
        check('«Haces de sol» = 0 los apaga', sh3[3] == 0 and sh3[0] == 0, sh3)

        print('Clima → humedad de la niebla')
        await pg.evaluate(SETUP, {**ENV, 'time': {'on': True, 'hour': 6}, 'weather': {'on': True, 'preset': 'fog', 'moisture': False}})
        await pg.evaluate("() => window.__T.draw()")
        hw = await pg.evaluate("() => { const v = window.__T.vp, s = v._fogState; return { wf: !!v._wf, hum: v._wf?.humidity, fogOn: v._wf?.fog?.on, dens: v._wf?.fog?.density, params: s.params && { h: s.params.humidity, fall: s.params.falloff, g: s.params.anisotropy, ext: s.params.extinction } } }")
        check('con el preset «Niebla» la humedad del mundo llega a los parámetros (≈ 0,97) y la caída pasa a ser casi la húmeda', hw['wf'] and hw['fogOn'] and hw['params'] and abs(hw['params']['h'] - hw['hum']) < 0.01 and hw['params']['h'] > 0.9 and hw['params']['fall'] > 0.0017, hw)
        await pg.evaluate(SETUP, {**ENV, 'time': {'on': True, 'hour': 12}, 'weather': {'on': True, 'preset': 'clear'}, 'fogDensity': 0.01})
        await pg.evaluate("() => window.__T.draw()")
        hw2 = await pg.evaluate("() => { const s = window.__T.vp._fogState; return s.params && { h: s.params.humidity, fall: s.params.falloff } }")
        check('con tiempo despejado la humedad baja y la niebla se «despega» del suelo', hw2 and hw2['h'] < 0.6 and hw2['fall'] < hw['params']['fall'], hw2)

        print('Salidas de emergencia')
        await pg.evaluate(SETUP, ENV); await pg.evaluate("() => { const T = window.__T; T.cam(5000, 1.7, 5000, 0, 0); T.draw() }")
        await pg.evaluate("() => { const { store, editor } = window.__lf; window.__render0 = JSON.stringify(store.project.render || null); store.project.render = Object.assign({}, store.project.render, { look: 'clasico' }); editor.applyRender?.(); window.__T.draw(); window.__T.draw() }")
        st = await pg.evaluate("() => { const v = window.__T.vp, l = v.look; return { composer: l.usesComposer, own: !!l._physFog, fog: v.scene.fog ? (v.scene.fog.isFogExp2 ? 'FogExp2' : 'otra') : null } }")
        check('look «clásico» (sin composer): vuelve el FogExp2 de three, la niebla no desaparece', (not st['composer']) and (not st['own']) and st['fog'] == 'FogExp2', st)
        await pg.evaluate("() => { const { store, editor } = window.__lf; store.project.render = Object.assign({}, store.project.render, { look: 'realista' }); editor.applyRender?.(); window.__T.draw(); window.__T.draw() }")
        st = await pg.evaluate("() => { const v = window.__T.vp, l = v.look; return { composer: l.usesComposer, own: !!l._physFog, fog: v.scene.fog ? (v.scene.fog.isFogExp2 ? 'FogExp2' : 'otra') : null } }")
        check('al volver a «realista» el pase vuelve a ser el dueño de la niebla', st['composer'] and st['own'] and st['fog'] is None, st)
        await pg.evaluate("() => { const v = window.__T.vp; v.setUnderwater({ color: '#1d4a66', density: 0.05 }); window.__T.draw(); window.__T.draw() }")
        st = await pg.evaluate("() => { const v = window.__T.vp, l = v.look; return { own: !!l._physFog, en: l.atmoPass?.enabled, fog: v.scene.fog ? (v.scene.fog.isFogExp2 ? 'FogExp2' : 'otra') : null, d: v.scene.fog?.density } }")
        check('bajo el agua: el pase se aparta y manda la niebla del agua', (not st['own']) and (not st['en']) and st['fog'] == 'FogExp2' and abs(st['d'] - 0.05) < 1e-9, st)
        await pg.evaluate("() => { const v = window.__T.vp; v.setUnderwater(null); window.__T.draw(); window.__T.draw() }")
        st = await pg.evaluate("() => { const v = window.__T.vp, l = v.look; return { own: !!l._physFog, fog: v.scene.fog ? (v.scene.fog.isFogExp2 ? 'FogExp2' : 'otra') : null } }")
        check('al salir del agua vuelve la niebla física', st['own'] and st['fog'] is None, st)

        print('En juego: game.scene.set, game.weather.visibility y el nodo oculto')
        await pg.evaluate(SETUP, {**ENV, 'fog': False, 'fogMode': 'simple', 'time': {'on': True, 'hour': 12}, 'weather': {'on': True, 'preset': 'fog', 'moisture': False}})
        await pg.evaluate("() => { const { S } = window.__lf; window.__vol2 = S.addObject({ type: 'atmovolume', position: [0, 1.5, 0], scale: [6, 3, 6] }, { select: false }) }")
        r = await pg.evaluate("""async () => { const { editor } = window.__lf; await editor.player.start(); await new Promise((r) => setTimeout(r, 1200)); const pm = editor.player, g = pm.game.api
          const before = { vis: g.weather.visibility, props: g.scene.props.includes('fogMode') && g.scene.props.includes('fogShafts') }
          g.scene.set({ fog: true, fogMode: 'physical', fogDensity: 0.02, fogFalloff: 0.004 })
          let err = null; try { g.scene.set({ fogMode: 'nope' }) } catch (e) { err = String(e.message || e) }
          const vp = editor.vp; vp._applyEnv?.()
          const hid = (() => { const n = editor.nodes.get(window.__vol2.id); return n ? n.visible : null })()
          return { before, mode: g.scene.fogMode, st: !!vp._fogState?.physical, fall: vp._fogState?.params?.falloff, vis: g.weather.visibility, vis100: g.weather.visibilityAt(100), err, hid, pass: !!vp.look.atmoPass } }""")
        check('game.scene.props incluye los ajustes nuevos', r['before']['props'], r['before'])
        check('game.scene.set({ fogMode: "physical", fogFalloff… }) llega al visor', r['mode'] == 'physical' and r['st'] and abs(r['fall'] - 0.004) < 1e-9, r)
        check('un fogMode inválido lanza un error claro', r['err'] and 'fogMode' in r['err'], r['err'])
        check('game.weather.visibility es un número finito y crece con la altura', 20 < r['vis'] < 400 and r['vis100'] > r['vis'], f"{r['vis']:.1f} → {r['vis100']:.1f}")
        check('el nodo «Volumen atmosférico» queda oculto al jugar', r['hid'] is False, r['hid'])
        # modo dividido (TAA / resolución interna < 1): el pase vive en el compositor de resolución interna
        sp = await pg.evaluate("""async () => { const { store, editor } = window.__lf; const vp = editor.vp
          store.project.render = Object.assign({}, store.project.render, { resScale: 0.7, taa: false, dynRes: false }); editor.applyRender?.()
          for (let i = 0; i < 3; i++) { vp.requestRender(); vp._render() }
          const l = vp.look, a = l.atmoPass; const t = a ? (() => { const r = vp.renderer, rt = a.fog, buf = new Uint16Array(rt.width * rt.height * 4); r.readRenderTargetPixels(rt, 0, 0, rt.width, rt.height, buf); return buf.length })() : 0
          return { split: l.split, A: !!l.composerA, en: a?.enabled, own: !!l._physFog, fog: vp.scene.fog ? 'FogExp2' : null, size: t, w: a?.fog.width, ph: window.__T.half } }""")
        check('modo dividido (resolución interna 0,7): el pase del compositor A trabaja y la escena no lleva FogExp2', sp['split'] and sp['A'] and sp['en'] and sp['own'] and sp['fog'] is None and sp['size'] > 0, sp)
        await pg.evaluate("""() => { const { store, editor } = window.__lf; store.project.render = Object.assign({}, store.project.render, { resScale: 1 }); editor.applyRender?.() }""")
        await pg.evaluate("() => window.__lf.editor.player.stop?.()")

        print('Imagen final', flush=True)
        async def luma():
            els = await pg.query_selector_all('canvas'); best = None; area = 0
            for e in els:
                bb = await e.bounding_box()
                if bb and bb['width'] * bb['height'] > area: best, area = e, bb['width'] * bb['height']
            bb = await best.bounding_box()
            return np.array(Image.open(io.BytesIO(await pg.screenshot(clip=bb, timeout=120000))).convert('RGB')).astype(np.float32)
        await pg.evaluate(SETUP, {**ENV, 'fog': False}); await pg.evaluate("() => { const T = window.__T; T.cam(0, 1.7, 8, 0, 0); window.__lf.editor.vp.requestRender(); T.draw() }"); await pg.wait_for_timeout(600)
        a = await luma()
        await pg.evaluate(SETUP, {**ENV, 'fogDensity': 0.03}); await pg.evaluate("() => { window.__T.draw(); window.__T.draw() }"); await pg.wait_for_timeout(600)
        c = await luma()
        check('con niebla el cielo y la escena cambian de verdad en la imagen (diferencia media > 3/255)', float(np.abs(a - c).mean()) > 3, f'{float(np.abs(a - c).mean()):.2f}')
        check('sin errores de página ni de WebGL en toda la prueba', not logs, logs[:4])

        await b.close()
    print('\nTodo bien' if OK else '\nHay pruebas con fallo')
    sys.exit(0 if OK else 1)

asyncio.run(main())
