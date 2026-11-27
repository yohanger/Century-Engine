from pathlib import Path
from playwright.sync_api import sync_playwright
import re, json, zipfile
root=Path('/tmp/ce9'); vue='/opt/pyvenv/lib/python3.13/site-packages/trame_client/module/vue3-www/vue.global.js'
code=(root/'src/core/editor/native-tool-window.js').read_text(); resolver=(root/'src/core/editor/view-dock-session.js').read_text(); registry=(root/'src/core/editor/native-tool-registry.js').read_text();
strip=lambda s: re.sub(r'^import .*\n|^export \{.*\n','',s,flags=re.M).replace('export function ','function ')
js='const {nextTick,onBeforeMount,onBeforeUnmount,onMounted,shallowRef,watch}=Vue;\n'+strip(registry)+'\n'+strip(resolver)+'\n'+strip(code)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);
 for corrected in [False,True]:
  pg=b.new_page(); pg.set_content('<div id="app"></div>'); pg.add_script_tag(path=vue);pg.add_script_tag(content=js); errors=[]; pg.on('pageerror',lambda e:errors.append(str(e)));pg.on('console',lambda e:errors.append(e.text) if e.type=='error' else None)
  pg.evaluate('''corrected=>{const {createApp,h,Teleport,ref,nextTick}=Vue;window.mode=ref(false);window.count=ref(0);window.mounts=0;const Child={setup(){mounts++;return()=>h('span',{id:'payload'},String(count.value))}};const app=createApp({setup(){const dest=corrected?useMountedDockTarget(()=>mode.value?'#b':'#a',()=> '#parking',()=>[mode.value]):null;return()=>h('div',[h(Teleport,{to:corrected?dest.value:(mode.value?'#b':'#a'),defer:true},[h(Child)]),h('div',{id:'parking'}),h('div',{id:mode.value?'b':'a',key:mode.value?'b':'a'})])}});app.config.errorHandler=e=>{throw e};app.mount('#app')}''',corrected)
  pg.evaluate('async()=>{await Vue.nextTick();await Vue.nextTick();mode.value=true;await Vue.nextTick();await Vue.nextTick();count.value++;await Vue.nextTick();await Vue.nextTick()}'); print('corrected',corrected,'vue',pg.evaluate('Vue.version'),'result',pg.evaluate('({parent:document.getElementById("payload")?.parentElement?.id||null,text:document.getElementById("payload")?.textContent||null,mounts})'),'errors',errors);pg.close()
 b.close()
