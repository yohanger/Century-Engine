# Capturas del editor con las mismas cámaras que Godot (scripts/godot-check.mjs + check.gd).
# Uso: vite --port 5199 & python3 scripts/godot-compare.py /tmp/pg.lfproj /tmp/shots "orilla:30,9,34,6,0,-4;lago:..."
import asyncio, base64, sys
from playwright.async_api import async_playwright
lfproj, outdir, shots = sys.argv[1], sys.argv[2], sys.argv[3]
async def main():
    b64 = base64.b64encode(open(lfproj, 'rb').read()).decode()
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': 1280, 'height': 800})
        pg.on('pageerror', lambda e: print('PAGEERROR', e))
        pg.on('console', lambda m: print('CONSOLE', m.text) if m.type == 'error' and 'ERR_TUNNEL' not in m.text else None)
        await pg.goto('http://localhost:5199/')
        await pg.wait_for_function('window.__lf && window.__lf.store.ready', timeout=60000)
        await pg.evaluate("""async (b64) => {
          const {S, store, editor} = window.__lf
          const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
          await S.openLfproj(new File([bytes], 'pg.lfproj'), { onConflict: () => 'replace' })
          store.view.grid = false; editor.applyView()
        }""", b64)
        await pg.wait_for_timeout(1500)
        for s in shots.split(';'):
            name, v = s.split(':'); v = [float(x) for x in v.split(',')]
            await pg.evaluate("""(v) => {
              const {editor} = window.__lf; const vp = editor.vp
              vp.camera.fov = 60; vp.camera.updateProjectionMatrix()
              vp.camera.position.set(v[0], v[1], v[2]); vp.controls.target.set(v[3], v[4], v[5]); vp.camera.lookAt(v[3], v[4], v[5])
              vp.controls.update(); editor.refreshWaterMap(); vp.requestRender()
            }""", v)
            await pg.wait_for_timeout(1200)
            await pg.evaluate("window.__lf.editor.vp.requestRender()")
            await pg.wait_for_timeout(600)
            await pg.locator('canvas').first.screenshot(path=f'{outdir}/editor_{name}.png')
        await b.close()
asyncio.run(main())
