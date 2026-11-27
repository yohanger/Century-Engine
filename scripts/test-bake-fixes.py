# Prueba de navegador (vite dev en :5199) de las correcciones 0.26.x del horneado y la pérdida de GPU.
# Uso: (npx vite --port 5199 &) ; python3 scripts/test-bake-fixes.py     (Chromium con SwiftShader, sin GPU real)
import asyncio, sys
from playwright.async_api import async_playwright
ARGS=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl']
OK=True
def check(name, cond, extra=''):
    global OK; OK = OK and bool(cond); print(('OK   ' if cond else 'FALLA'), name, extra, flush=True)

MEAN = """()=>{const {store,editor}=window.__lf; const b=store.project.environment.bake; const out=[]
  const f=(h)=>{const s=(h&0x8000)?-1:1,e=(h>>10)&0x1f,m=h&0x3ff; return e===0?s*Math.pow(2,-14)*(m/1024):s*Math.pow(2,e-15)*(1+m/1024)}
  for(const v of Object.values(b.lightmaps)){const d=editor.bake.textures.get(v.id).image.data; let n=0,s=0; for(let i=0;i<d.length;i+=4){const t=f(d[i])+f(d[i+1])+f(d[i+2]); if(t>0){n++;s+=t/3}} out.push(s/n)}
  return out.reduce((a,b)=>a+b,0)/out.length}"""

async def bake(pg, setup):
    return await pg.evaluate("""async(setup)=>{const {S,store,editor}=window.__lf
      S.updateEnvironment(setup.env,false); S.updateBake({samples:8,density:2,maxSize:128,probeSpacing:8,denoise:true,gpuUsage:1})
      store.view.renderMethod=setup.method||null
      await new Promise(r=>setTimeout(r,300))
      const ok=await S.runBake(); return ok}""", setup)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        pg = await b.new_page(viewport={'width':800,'height':500}); logs=[]
        pg.on('console', lambda m: logs.append(m.text[:200])); pg.on('pageerror', lambda e: logs.append('PAGEERR '+str(e)[:200]+' '+(getattr(e,'stack','') or '')[:600]))
        await pg.goto('http://localhost:5199/', wait_until='load')
        await pg.wait_for_function("window.__lf && window.__lf.store && window.__lf.store.ready && window.__lf.editor && window.__lf.editor.vp", timeout=60000)
        await pg.wait_for_timeout(1500)
        await pg.evaluate("()=>{const {S,store,editor}=window.__lf; S.addObject({type:'primitive',kind:'box',position:[0,1,0]}); store.view.grid=false; editor.applyView()}")
        # 1) la hora/clima no cambia el bake (se usa el entorno del inspector)
        await bake(pg, {'env':{'time':{'on':False}}}); m_off = await pg.evaluate(MEAN)
        await bake(pg, {'env':{'time':{'on':True,'hour':0,'latitude':20,'season':'summer','moonLight':0.06,'nightAmbient':0.15}}}); m_on = await pg.evaluate(MEAN)
        check('bake independiente de la hora (00:00 == sin hora)', abs(m_on-m_off) < 0.02*max(m_off,1e-6), f'{m_off:.4f} vs {m_on:.4f}')
        # tras hornear con hora activa el mundo se reactiva
        st = await pg.evaluate("()=>window.__lf.editor.world.suspended===false && window.__lf.editor.world.active")
        check('mundo reactivado tras hornear', st)
        # 2) reflexiones del proyecto, no del visor
        await bake(pg, {'env':{'time':{'on':False}},'method':'compat'}); m_c = await pg.evaluate(MEAN)
        await bake(pg, {'env':{'time':{'on':False}},'method':'forward'}); m_f = await pg.evaluate(MEAN)
        check('bake igual desde Compatibility y Forward+', abs(m_c-m_f) < 0.02*max(m_f,1e-6), f'{m_c:.4f} vs {m_f:.4f}')
        # 3) el ambiente se hornea
        await bake(pg, {'env':{'time':{'on':False},'ambient':0}}); a0 = await pg.evaluate(MEAN)
        await bake(pg, {'env':{'time':{'on':False},'ambient':1}}); a1 = await pg.evaluate(MEAN)
        check('el ambiente del inspector se hornea', a1 > a0 + 0.1, f'{a0:.3f} -> {a1:.3f}')
        # 4) el sol estático horneado no se vuelve a encender con la hora activa
        r = await pg.evaluate("""async()=>{const {S,store,editor}=window.__lf
          const sun=store.project.objects.find(o=>o.type==='light'&&o.light?.type==='directional'); if(!sun) return 'sinsol'
          sun.light.mode='baked'; editor.syncObject(sun.id)
          S.updateEnvironment({time:{on:true,hour:12,latitude:20,season:'summer'}},false)
          await S.runBake(); for(let i=0;i<5;i++) editor.tickWorld(0.1)
          return editor.nodes.get(sun.id).userData.light.visible}""")
        check('sol estático horneado sigue apagado con la hora activa', r is False, str(r))
        # 5) Jugar con geometría horneada: sin OOM
        logs.clear()
        err = await pg.evaluate("""async()=>{try{await window.__lf.editor.player.start({here:true}); await new Promise(r=>setTimeout(r,2500)); return null}catch(e){return String(e.message||e)}}""")
        check('Jugar con horneado sin OOM', not err and not any('OOM' in l for l in logs), str(err))
        await pg.evaluate("()=>{try{window.__lf.editor.player.stop()}catch{}}")
        # 6) pérdida y restauración del contexto
        r = await pg.evaluate("""async()=>{const vp=window.__lf.editor.vp, gl=vp.renderer.getContext(), ext=gl.getExtension('WEBGL_lose_context'); if(!ext) return 'sinext'
          ext.loseContext(); await new Promise(r=>setTimeout(r,300)); const lost=vp._glLost
          ext.restoreContext(); await new Promise(r=>setTimeout(r,1500)); vp.requestRender(); await new Promise(r=>setTimeout(r,800))
          return {lost, restored:!vp._glLost, ctx:!gl.isContextLost()}}""")
        check('contexto perdido y restaurado', isinstance(r, dict) and r['lost'] and r['restored'] and r['ctx'], str(r))
        errs=[l for l in logs if 'PAGEERR' in l]
        check('sin errores de página', not errs, str(errs[:3]))
        await b.close()
    print('RESULTADO:', 'OK' if OK else 'HAY FALLOS'); sys.exit(0 if OK else 1)
asyncio.run(main())
