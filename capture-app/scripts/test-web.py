# Vista previa web de la app (react-native-web): biblioteca → grabar con el actor simulado → editor (efectos, cámara, exportar).
# Uso: npm run build:web && python3 -m http.server 5300 --directory dist-web & python3 scripts/test-web.py
import asyncio, sys
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5300/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 412, 'height': 900}, device_scale_factor=1)
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
        await pg.goto(URL)
        await pg.wait_for_selector('text=LevelForge Capture', timeout=30000)
        await pg.screenshot(path='/tmp/app-home.png')
        await pg.click('text=● Nueva captura')
        await pg.wait_for_selector('text=Grabar (cuenta atrás 3 s)', timeout=10000)
        await pg.wait_for_timeout(800)
        await pg.screenshot(path='/tmp/app-record.png')
        await pg.click('text=● Grabar (cuenta atrás 3 s)')
        await pg.wait_for_selector('text=■ Parar y guardar', timeout=10000)
        await pg.wait_for_timeout(3500)
        await pg.screenshot(path='/tmp/app-recording.png')
        await pg.click('text=■ Parar y guardar')
        await pg.wait_for_selector('text=Recorte', timeout=10000)
        await pg.wait_for_timeout(500)
        # efectos: subtítulo
        await pg.click('text=Efectos')
        await pg.click('text=+ Texto')
        await pg.wait_for_selector('input[placeholder="Texto del subtítulo"]', timeout=5000)
        await pg.fill('input[placeholder="Texto del subtítulo"]', 'Hola desde el móvil')
        await pg.click('text=+ Barras de cine')
        # cámara: plano medio
        await pg.click('text=Cámara')
        await pg.click('text=Plano medio')
        # recorte: dividir
        await pg.click('text=Recorte >> nth=0')
        await pg.wait_for_timeout(1500)  # guardado automático
        await pg.screenshot(path='/tmp/app-editor.png')
        info = await pg.evaluate("""()=>{ const k=Object.keys(localStorage).find(x=>x.startsWith('lfcap:')); const c=JSON.parse(localStorage.getItem(k)); return { frames:c.body.frames.length, layers:c.layers.map(l=>l.kind+':'+(l.params.text||'')), keys:c.camera.keys.length, dur:c.body.frames.at(-1).t } }""")
        print('guardado', info)
        await pg.click('text=Exportar')
        async with pg.expect_download() as dl:
            await pg.click('text=Compartir .lfcap (Drive, WhatsApp, USB…)')
        d = await dl.value
        path = '/tmp/app-export.lfcap'; await d.save_as(path)
        txt = open(path).read()
        await pg.screenshot(path='/tmp/app-export.png')
        await pg.click('text=‹')
        await pg.wait_for_selector('text=Nueva captura', timeout=5000)
        await pg.wait_for_timeout(400)
        await pg.screenshot(path='/tmp/app-home2.png')
        items = await pg.locator('text=fotogramas').count()
        ok = info['frames'] > 30 and any(l.startswith('text:Hola desde el móvil') for l in info['layers']) and any(l.startswith('letterbox') for l in info['layers']) and info['keys'] >= 1 and '"format":"lfcap"' in txt and items >= 1 and not errs
        print('descarga', d.suggested_filename, len(txt), 'bytes · elementos en la biblioteca', items)
        print('errores', errs)
        print('OK' if ok else 'FALLO')
        await b.close(); sys.exit(0 if ok else 1)
asyncio.run(main())
