from playwright.sync_api import sync_playwright
from pathlib import Path
root=Path(__file__).resolve().parents[4]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':640,'height':480})
    page.on('console',lambda m: print('CONSOLE',m.type,m.text))
    page.on('pageerror',lambda e:print('PAGEERROR',e))
    html=(root/'scripts/fixtures/editor/integral-pointer-recovery.html').read_text().replace("import { ContinuousGrab } from '/src/core/editor/continuous-grab.js'",(root/'src/core/editor/continuous-grab.js').read_text().replace('export class ContinuousGrab','class ContinuousGrab'))
    page.set_content(html,wait_until='load')
    page.wait_for_function('window.__lfNativePointerSteps?.length===6')
    steps=page.evaluate('window.__lfNativePointerSteps')
    for i,s in enumerate(steps):
        box=page.locator(s['selector']).bounding_box();page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2)
        if s['type']=='mousePressed':page.mouse.down()
        else:page.mouse.up()
        result=page.evaluate(f'window.__lfNativePointerAfter({i})');print('STEP',i,result)
        if not result['ok']:break
    print(page.locator('#result').inner_text())
    page.screenshot(path=str(Path(__file__).with_name('browser-isolated-reproduced.png')));browser.close()
