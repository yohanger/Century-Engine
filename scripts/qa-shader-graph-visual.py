"""QA de Vue real: capturas, geometría y operaciones de Shader Graph integrado.
Vite debe estar activo. Usa un perfil Chromium temporal, nunca el perfil del usuario.
Las aserciones funcionales no conceden aprobación visual humana.
"""
from pathlib import Path
import argparse
import json
import os
import shutil
import tempfile
from urllib.request import urlopen

BASE = 'http://127.0.0.1:5173'
OUT = Path('docs/qa/shader-graph-g002')
RESOLUTIONS = ((1366, 768), (1536, 960), (1920, 1080))
SNAPSHOT = '''() => {
 const root = document.querySelector('.sg');
 let c = root.__vueParentComponent;
 while (c && !c.setupState.g) c = c.parent;
 const s = c.setupState;
 return {graph:JSON.parse(JSON.stringify(s.g)), view:{...s.view}, selected:[...s.selected], sel:s.sel,
   undo:s.undo.length, redo:s.redo.length, detail:s.detailTab, id:s.sc.id};
}'''
METRICS = '''() => {
 const box = e => {if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}};
 const query=s=>box(document.querySelector(s));
 const tb=document.querySelector('.sg-tools'), t=tb.getBoundingClientRect();
 const cut=[...tb.querySelectorAll('button')].filter(e=>e.getClientRects().length && !e.closest('.sg-more-menu')).filter(e=>{
   const b=e.getBoundingClientRect(); return b.left<t.left-1 || b.right>t.right+1 || b.top<t.top-1 || b.bottom>t.bottom+1;
 }).map(e=>e.getAttribute('aria-label')||e.textContent);
 const preview=document.querySelector('.sp-viewport canvas');
 return {toolbar:query('.sg-tools'),canvas:query('.sg-canvas'),inspector:query('.sg-inspector'),
   preview:query('.sg-preview-stage'),output:query('.sg-output'),window:query('.floating-editor-window'),content:query('.sg'),
   horizontalToolbarOverflow:tb.scrollWidth>tb.clientWidth+1,cutControls:cut,
   graphCount:document.querySelectorAll('.sg').length,previewCount:document.querySelectorAll('.sp-viewport canvas').length,
   previewCanvas:!!preview,previewPixels:preview?{width:preview.width,height:preview.height}:null,
   textureLoaded:[...document.querySelectorAll('.sg-texture-thumb img')].every(i=>i.complete&&i.naturalWidth>0)};
}'''


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path, default=OUT)
    parser.add_argument('--fixture-only', action='store_true')
    parser.add_argument('--integrated-only', action='store_true')
    parser.add_argument('--browser', default=os.environ.get('LF_QA_BROWSER'))
    args = parser.parse_args()
    try:
        from playwright.sync_api import sync_playwright
        with urlopen(BASE + '/scripts/fixtures/shader-graph-visual.html', timeout=5) as r:
            assert r.status == 200
    except Exception as error:
        print('BLOQUEADO: se requieren Vite y Playwright:', error)
        return 2
    cached = sorted((Path.home() / '.cache/ms-playwright').glob('chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell'))
    executable = args.browser or (str(cached[-1]) if cached else None) or shutil.which('chromium') or shutil.which('brave-browser')
    if not executable:
        print('BLOQUEADO: falta Chromium local')
        return 2
    args.out.mkdir(parents=True, exist_ok=True)
    report = {'browser': executable, 'checks': [], 'captures': [], 'page_errors': [], 'console_errors': [], 'warnings': []}

    def check(name, condition):
        report['checks'].append({'name': name, 'pass': bool(condition)})
        print(('PASS ' if condition else 'FAIL ') + name, flush=True)
        if not condition:
            raise AssertionError(name)

    def observe(page):
        page.set_default_timeout(30000)
        page.on('pageerror', lambda e: report['page_errors'].append(str(e)))
        page.on('console', lambda m: report['console_errors'].append(m.text) if m.type == 'error' else report['warnings'].append(m.text) if m.type == 'warning' else None)
        # El guardado integrado usa IndexedDB; nunca pide ni escribe una carpeta del usuario.
        page.add_init_script('window.showDirectoryPicker = undefined')

    def capture(page, name):
        page.locator('.sg-workspace .sg-canvas').wait_for()
        page.wait_for_timeout(500)
        metrics = page.evaluate(METRICS)
        check(name + ' · controles completos', not metrics['horizontalToolbarOverflow'] and not metrics['cutControls'])
        check(name + ' · única instancia y preview', metrics['graphCount'] == metrics['previewCount'] == 1)
        check(name + ' · lienzo dominante', metrics['canvas']['w'] > metrics['inspector']['w'])
        check(name + ' · contenido llena ventana', abs(metrics['content']['w'] - metrics['window']['w']) < 3 and abs(metrics['content']['h'] - metrics['window']['h']) < 3)
        check(name + ' · textura cargada', metrics['textureLoaded'])
        page.screenshot(path=str(args.out / (name + '.png')), animations='disabled')
        report['captures'].append({'file': name + '.png', 'metrics': metrics})
        (args.out / (name + '.json')).write_text(json.dumps(metrics, indent=2))

    def open_graph(page, target):
        page.evaluate('(target)=>window.__lf.S.openShaderEditor("shader-qa-"+target)', target)
        page.locator('.sg').wait_for()

    def focus_graph(page):
        page.locator('.sg').focus()

    def snap(page):
        return page.evaluate(SNAPSHOT)

    def click_node(page, kind, modifiers=None):
        page.locator(f'.node[data-type="{kind}"] .nh').first.click(modifiers=modifiers or [])

    def port_drag(page, source, destination):
        a = page.locator(source).last.bounding_box()
        b = page.locator(destination).last.bounding_box()
        page.mouse.move(a['x'] + a['width']/2, a['y'] + a['height']/2)
        page.mouse.down()
        page.mouse.move(b['x'] + b['width']/2, b['y'] + b['height']/2, steps=8)
        page.mouse.up()

    try:
        with sync_playwright() as p, tempfile.TemporaryDirectory(prefix='lf-shader-g002-browser-') as profile:
            launch = dict(executable_path=executable, headless=True, args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
            browser = p.chromium.launch(**launch)
            if not args.integrated_only:
                for w, h in RESOLUTIONS:
                    for target in ('material', 'post'):
                        context = browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1)
                        page = context.new_page(); observe(page)
                        page.goto(BASE + '/scripts/fixtures/shader-graph-visual.html?target=' + target, wait_until='domcontentloaded')
                        page.wait_for_function('window.__lfVisualReady === true', timeout=60000)
                        if target == 'material': page.locator('.sg-texture-thumb img').wait_for()
                        capture(page, f'fixture-{target}-{w}x{h}')
                        context.close()
            browser.close()
            if not args.fixture_only:
                context = p.chromium.launch_persistent_context(profile, viewport={'width': 1536, 'height': 960}, **launch)
                page = context.pages[0]; observe(page)
                page.goto(BASE, wait_until='domcontentloaded', timeout=60000)
                page.wait_for_function('window.__lf?.store.ready === true', timeout=120000)
                await_seed = '''async()=>{const {installVisualGraph}=await import('/scripts/fixtures/shader-graph-visual.js');
                  await installVisualGraph(window.__lf.store.project,'material');await installVisualGraph(window.__lf.store.project,'post');
                  window.__lf.store.prefs.shaderGraphDocked=false;window.__lf.S.openShaderEditor('shader-qa-material');}'''
                page.evaluate(await_seed)
                page.locator('.sg-texture-thumb img').wait_for()
                check('material real en nodo e Inspector', page.locator('.sg-resource-thumb img').count() == 1)
                # Zoom y paneo se producen mediante los eventos de usuario originales.
                canvas = page.locator('.sg-canvas').bounding_box()
                page.mouse.move(canvas['x']+20, canvas['y']+20);page.mouse.wheel(0,-90);page.wait_for_timeout(150)
                page.mouse.down();page.mouse.move(canvas['x']+42, canvas['y']+37,steps=4);page.mouse.up()
                before = snap(page)
                page.evaluate('window.qaGraph=document.querySelector(".sg");window.qaCanvas=document.querySelector(".sp-viewport canvas")')
                for mode in ('Dock', 'Undock', 'Dock'):
                    page.get_by_role('button',name=mode+' Shader Graph',exact=True).click()
                    after = snap(page)
                    check(mode + ' · grafo/selección/zoom/historial intactos', before == after)
                    check(mode + ' · mismos DOM y contexto WebGL', page.evaluate('qaGraph===document.querySelector(".sg") && qaCanvas===document.querySelector(".sp-viewport canvas") && !qaCanvas.getContext("webgl2").isContextLost()'))
                page.get_by_role('tab', name='Escena 1', exact=False).first.click()
                check('pestaña escena oculta el grafo sin destruirlo', not page.locator('.sg').is_visible())
                page.get_by_role('tab',name='Shader Graph · Stone_Study.glsl',exact=True).click()
                check('volver a pestaña conserva instancia', page.evaluate('qaGraph===document.querySelector(".sg")'))
                page.get_by_role('button',name='Undock Shader Graph',exact=True).click()
                page.get_by_role('button',name='Encajar nodos',exact=True).click()
                initial = snap(page)
                # Inspector escribe en el nodo UV conectado, con undo y redo del mismo editor.
                uv = page.get_by_role('spinbutton',name='Repetición X',exact=True)
                uv.fill('4');uv.press('Tab')
                check('Inspector edita UV real', next(n for n in snap(page)['graph']['nodes'] if n['type']=='tilingOffset')['v']['tile'][0] == 4)
                page.get_by_role('button',name='Deshacer',exact=True).click()
                check('Undo del Inspector', snap(page)['graph'] == initial['graph'])
                page.get_by_role('button',name='Rehacer',exact=True).click()
                check('Redo del Inspector', next(n for n in snap(page)['graph']['nodes'] if n['type']=='tilingOffset')['v']['tile'][0] == 4)
                page.get_by_role('button',name='Deshacer',exact=True).click()
                page.get_by_role('button',name='Buscar nodo',exact=True).click()
                page.locator('#sg-search').fill('Número');page.locator('#sg-search').press('Enter')
                check('crear nodo desde búsqueda', len(snap(page)['graph']['nodes']) == len(initial['graph']['nodes'])+1)
                new_id = snap(page)['sel']
                field=page.locator('.sg-board input[type="number"]').first
                field.fill('0.3');field.press('Tab')
                page.get_by_role('button',name='Encajar nodos',exact=True).click()
                port_drag(page,f'.port.out[data-node="{new_id}"]','.node[data-type="surface"] .port.in[data-key="metallic"]')
                check('conectar nodos', any(e['to'][1]=='metallic' and e['from'][0]==new_id for e in snap(page)['graph']['edges']))
                a=page.locator('.node[data-type="surface"] .port.in[data-key="metallic"]').bounding_box();c=page.locator('.sg-canvas').bounding_box()
                page.mouse.move(a['x']+a['width']/2,a['y']+a['height']/2);page.mouse.down();page.mouse.move(c['x']+8,c['y']+8,steps=6);page.mouse.up()
                check('desconectar nodos', not any(e['to'][1]=='metallic' for e in snap(page)['graph']['edges']))
                focus_graph(page);page.keyboard.press('Control+z')
                check('Undo restaura conexión', any(e['to'][1]=='metallic' for e in snap(page)['graph']['edges']))
                click_node(page,'color');click_node(page,'mul',['Control'])
                check('selección múltiple', len(snap(page)['selected']) == 2)
                count=len(snap(page)['graph']['nodes']);edge_count=len(snap(page)['graph']['edges'])
                focus_graph(page);page.keyboard.press('Control+c');page.keyboard.press('Control+v')
                check('copiar/pegar conserva conexión interna', len(snap(page)['graph']['nodes'])==count+2 and len(snap(page)['graph']['edges'])==edge_count+1)
                focus_graph(page);page.keyboard.press('Delete')
                check('eliminar selección',len(snap(page)['graph']['nodes'])==count)
                page.keyboard.press('Control+z');check('Undo eliminación',len(snap(page)['graph']['nodes'])==count+2)
                page.keyboard.press('Control+y');check('Redo eliminación',len(snap(page)['graph']['nodes'])==count)
                # Cambio inmediato + cierre en el mismo turno JS: no esperar los 160 ms del debounce.
                click_node(page,'float')
                page.evaluate('''()=>{const e=document.querySelector('.sg-board input[type=number]');e.value='0.42';e.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('.floating-editor-action.close').click()}''')
                open_graph(page,'material')
                check('cerrar/reabrir conserva última edición pendiente', next(n for n in snap(page)['graph']['nodes'] if n['type']=='float')['params']['v']==0.42)
                material=snap(page)
                open_graph(page,'post');page.get_by_role('button',name='Compilar grafo',exact=True).click()
                check('post real compila',not page.locator('.sg-status .bad').count())
                open_graph(page,'material');check('cambiar grafo y volver conserva sesión',snap(page)==material)
                page.get_by_role('button',name='Guardar grafo',exact=True).click()
                page.wait_for_function('window.__lf.store.saveState === "saved"',timeout=30000)
                saved=snap(page)['graph']
                check('guardar usa documento real', page.evaluate('window.__lf.store.project.shaders.find(s=>s.id==="shader-qa-material").graph')==saved)
                # Una escena de comparación legible, usando las mismas operaciones del usuario.
                for w,h in RESOLUTIONS:
                    page.set_viewport_size({'width':w,'height':h})
                    for target in ('material','post'):
                        open_graph(page,target)
                        if page.get_by_role('button',name='Undock Shader Graph',exact=True).count(): page.get_by_role('button',name='Undock Shader Graph',exact=True).click()
                        page.get_by_role('button',name='Encajar nodos',exact=True).click()
                        capture(page,f'integrated-{target}-undock-{w}x{h}')
                        page.get_by_role('button',name='Dock Shader Graph',exact=True).click()
                        page.get_by_role('button',name='Encajar nodos',exact=True).click()
                        capture(page,f'integrated-{target}-dock-{w}x{h}')
                page.evaluate('window.__lf.S.saveNow()')
                context.close()
                context=p.chromium.launch_persistent_context(profile,viewport={'width':1366,'height':768},**launch)
                page=context.pages[0];observe(page);page.goto(BASE,wait_until='domcontentloaded',timeout=60000)
                page.wait_for_function('window.__lf?.store.ready === true',timeout=120000)
                check('reiniciar Editor conserva preferencia Dock',page.evaluate('window.__lf.store.prefs.shaderGraphDocked === true'))
                open_graph(page,'material');check('reiniciar Editor conserva grafo guardado',snap(page)['graph']==saved)
                context.close()
        check('sin excepciones JavaScript', not report['page_errors'])
        check('sin errores de consola/WebGL', not report['console_errors'])
        report['result']='TEST AUTOMATIZADO PASS · APROBACIÓN VISUAL PENDIENTE'
    except Exception as error:
        report['result']='FAIL';report['failure']=str(error)
        print('FAIL',error,flush=True)
    finally:
        (args.out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(report['result'],flush=True)
    return 0 if report['result'].startswith('TEST') else 1


if __name__ == '__main__':
    raise SystemExit(main())
