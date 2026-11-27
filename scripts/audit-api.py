# Auditoría de la API de scripts: arranca el modo Jugar y compara, objeto por objeto, lo que EXISTE en game.* con lo que declara game-api.d.ts.
# Lista lo que el motor tiene y los scripts no ven (sin tipar). Uso: vite --port 5199 & python3 scripts/audit-api.py [--strict]
import asyncio, json, sys, re, os, subprocess
if "--static" in sys.argv:
    sys.exit(subprocess.call(["node", os.path.join(os.path.dirname(__file__), "audit-api-static.mjs"), *[a for a in sys.argv[1:] if a != "--static"]]))
from playwright.async_api import async_playwright
DTS = open(os.path.join(os.path.dirname(__file__), '..', 'src/core/events/game-api.d.ts'), encoding='utf8').read()
def members(iface):
    m = re.search(r'interface %s(?:<[^>]*>)?(?: extends [\w, ]+)? \{' % iface, DTS)
    if not m: return None
    i, depth, out = m.end(), 1, []
    start = i
    while depth and i < len(DTS):
        c = DTS[i]
        depth += (c == '{') - (c == '}')
        i += 1
    body = DTS[start:i-1]
    d = 0; line = ''
    names = set()
    for ch in body:
        if ch == '{': d += 1
        if ch == '}': d -= 1
        if d == 0 and ch == '\n':
            n = re.match(r'\s*(?:readonly\s+)?(?:(?:\[[^\]]*\])|([A-Za-z_$][\w$]*))\s*[?(:<]', line)
            if n and n.group(1): names.add(n.group(1))
            line = ''
        else: line += ch
    ext = re.search(r'interface %s(?:<[^>]*>)? extends ([\w, ]+) \{' % iface, DTS)
    if ext:
        for e in ext.group(1).split(','):
            sub = members(e.strip()); names |= sub or set()
    return names
# interfaz que tipa cada propiedad de game (se lee de la propia interfaz Game)
game_body = re.search(r'interface Game \{(.*?)\n  \}\n\}', DTS, re.S).group(1)
TYPES = {}
for m in re.finditer(r'(?:readonly\s+)?(\w+)\??:\s*([A-Z]\w+)\s*(?:\n|\|)', game_body):
    TYPES[m.group(1)] = m.group(2)
TYPES['player'] = 'Player'
JS = """async(keys)=>{
  const {S,store,editor}=window.__lf; const pl=editor.player; await pl.start(); await new Promise(r=>setTimeout(r,500));
  const api=pl.game.api; const out={};
  const real=(o)=>{ const s=new Set(); let p=o; for(let i=0;i<3&&p&&p!==Object.prototype;i++){ for(const k of Object.getOwnPropertyNames(p)) if(k!=='constructor'&&!k.startsWith('_')) s.add(k); p=Object.getPrototypeOf(p) } return [...s] };
  for (const k of keys) { let o; try { o=api[k] } catch(e) { out[k]=null; continue } out[k]=o&&typeof o==='object'?real(o):null }
  out.__node=null;
  const nodes=store.project.objects; if(nodes.length){ const h=api.node(nodes[0].name); out.__node=h?real(h):null }
  out.__event=null; const ev=store.project.objects.find(o=>o.type==='event'); if(ev){ const h=api.event(ev.name); out.__event=h?real(h):null }
  out.__light=null; const lt=store.project.objects.find(o=>o.type==='light'); if(lt){ const h=api.node(lt.name); out.__light=h&&h.light?real(h.light):null }
  out.__game=real(api);
  await pl.stop(); return out }"""
async def main():
    strict = '--strict' in sys.argv
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':900,'height':560})
        await pg.goto('http://localhost:5199/'); await pg.wait_for_function('window.__lf && window.__lf.store.ready', timeout=60000)
        await pg.evaluate("()=>{const {S}=window.__lf; S.addObject({type:'primitive',kind:'box',name:'Caja'},{select:false}); S.addObject({type:'event',name:'Ev'},{select:false}); S.addObject({type:'light',kind:'omni',name:'Foco'},{select:false})}")
        keys = sorted(TYPES)
        res = await pg.evaluate(JS, keys)
        await b.close()
    gaps = {}
    checks = [(k, TYPES[k], res.get(k)) for k in keys] + [('node()', 'NodeHandle', res['__node']), ('event()', 'EventHandle', res['__event']), ('node().light', 'LightHandle', res['__light'])]
    # Ayudantes internos de las reglas de la base de datos: se usan por dentro (battler, quest, useItem…), no son API.
    INTERNAL = {'Party': {'actor', 'actors', 'canAct', 'ctx', 'db', 'elementRate', 'expFor', 'fmt', 'formula', 'inv', 'journal', 'need', 'need1', 'param', 'partyBattlers', 'rec', 'reset', 'runEvents', 'setCount', 'setLevelKeepExp', 'skillIds', 'snapshot', 'targetsOf', 'tick', 'traitsOf'}}
    for name, iface, real in checks:
        typed = members(iface)
        if real is None or typed is None: continue
        miss = sorted(set(real) - typed - INTERNAL.get(iface, set()))
        if miss: gaps['game.' + name + ' (' + iface + ')'] = miss
    top = sorted(set(res['__game']) - (members('Game') or set()))
    if top: gaps['game (Game)'] = top
    for k, v in gaps.items(): print('SIN TIPAR', k, ':', ', '.join(v))
    print('TOTAL sin tipar:', sum(len(v) for v in gaps.values()))
    sys.exit(1 if (strict and gaps) else 0)
asyncio.run(main())
