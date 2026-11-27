// QA real Vue + WebGL + JSZip. Sin nuevos renderers: se abre la aplicación de producción.
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
const root=fileURLToPath(new URL('..',import.meta.url))
const vite=join(root,'node_modules/vite/bin/vite.js')
const browser=process.env.LF_FILM_BROWSER || (process.platform==='win32'?'chrome.exe':'chromium')
const port=43831
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
test('FILM-S01-UI · app Vue, encuadre WebGL, cámara y .nfm real', {timeout:65000}, async()=>{
  assert.ok(existsSync(vite),'Falta Vite: ejecutar npm ci antes de realizar el QA Vue/WebGL')
  const server=spawn(process.execPath,[vite,'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:'ignore',env:{...process.env,BROWSER:'none'}})
  try{
    const url=`http://127.0.0.1:${port}/scripts/fixtures/filmmaker/frame.html`
    let ready=false
    for(let i=0;i<100;i++){
      if(server.exitCode!==null)throw Error(`Vite terminó (${server.exitCode})`)
      try{const r=await fetch(url);if(r.ok){ready=true;break}}catch{}
      await sleep(120)
    }
    assert.ok(ready,'Vite no inició')
    const result=spawnSync(browser,['--headless','--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--window-size=1280,720','--virtual-time-budget=15000','--dump-dom',url],{encoding:'utf8',timeout:46000,maxBuffer:3*1024*1024})
    if(result.error)throw result.error
    assert.equal(result.status,0,result.stderr?.slice(-950))
    const raw=result.stdout?.match(/<pre id="frame-result" data-pass="(true|false)">([\s\S]*?)<\/pre>/)
    assert.ok(raw,'No hay resultado de QA Vue/WebGL: '+result.stdout?.slice(-850))
    const data=JSON.parse(raw[2].replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&'))
    assert.equal(data.pass,true,JSON.stringify(data,null,2))
    assert.ok(data.checks.length>=12)
  }finally{server.kill('SIGTERM')}
})
