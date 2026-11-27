// Harness real Vue/Vite/WebGL: usa el editor de producción, sin renderer ni RAF auxiliares.
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
const root=fileURLToPath(new URL('..',import.meta.url))
const vite=join(root,'node_modules/vite/bin/vite.js')
const browser=process.env.LF_VFX_BROWSER || (process.platform==='win32'?'chrome.exe':'chromium')
const port=43829
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
test('VFX-S03-UI · Vue real + viewport real + Undo/Redo', {timeout:60000}, async()=>{
  assert.ok(existsSync(vite),'Falta Vite: ejecutar npm ci')
  const server=spawn(process.execPath,[vite,'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:'ignore',env:{...process.env,BROWSER:'none'}})
  try{
    const url=`http://127.0.0.1:${port}/scripts/fixtures/vfx/s03/ui.html`
    let ready=false
    for(let i=0;i<100;i++){
      if(server.exitCode!==null)throw Error(`Vite terminó (${server.exitCode})`)
      try{const r=await fetch(url);if(r.ok){ready=true;break}}catch{}
      await sleep(120)
    }
    assert.ok(ready,'Vite no inició')
    const result=spawnSync(browser,['--headless','--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--window-size=1280,720','--virtual-time-budget=12000','--dump-dom',url],{encoding:'utf8',timeout:45000,maxBuffer:4*1024*1024})
    if(result.error)throw result.error
    assert.equal(result.status,0,result.stderr?.slice(-900))
    const raw=result.stdout?.match(/<pre id="vfx-s03-result" data-pass="(true|false)">([\s\S]*?)<\/pre>/)
    assert.ok(raw,'No hay salida de QA Vue/WebGL: '+result.stdout?.slice(-800))
    const json=raw[2].replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&')
    const response=JSON.parse(json)
    assert.equal(response.pass,true,JSON.stringify(response,null,2))
    assert.ok(response.checks.length>=15)
  } finally {server.kill('SIGTERM')}
})
