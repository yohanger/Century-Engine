// Proceso principal temporal para QA WebGL: reutiliza Electron sin abrir el Editor.
const { app, BrowserWindow } = require('electron')
const { writeFile, mkdir } = require('node:fs/promises')
const { join } = require('node:path')

// Electron conserva --no-sandbox en argv al ejecutarse como root: las dos entradas finales son la fixture y su ID.
const [url, resultId] = process.argv.slice(-2)
const tag = 'LF_WEBGL_QA_RESULT:'
const deadline = Math.max(1000, Math.min(90000, Number(process.env.LF_QA_FIXTURE_WAIT_MS) || 20000))
let window
const send = result => { process.stdout.write(`${tag}${JSON.stringify(result)}\n`) }

async function run() {
  if (!/^http:\/\/127\.0\.0\.1:\d+\//.test(url || '') || !/^[\w-]+$/.test(resultId || ''))
    throw new Error('Fixture WebGL o identificador inválido')
  if (process.env.LF_QA_PROFILE) app.setPath('userData',process.env.LF_QA_PROFILE)
  await app.whenReady()
  const width = Math.max(320, Math.min(1920, Number(process.env.LF_QA_WINDOW_WIDTH) || 640))
  const height = Math.max(240, Math.min(1080, Number(process.env.LF_QA_WINDOW_HEIGHT) || 480))
  window = new BrowserWindow({ show:false, width, height, useContentSize:true, webPreferences:{
    sandbox:true, contextIsolation:true, nodeIntegration:false, backgroundThrottling:false,
  } })
  window.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const details = typeof level === 'object' && level !== null ? level : event
    const severity = details?.level ?? level
    const text = details?.message ?? message
    if (severity >= 2 || severity === 'warning' || severity === 'error') {
      process.stderr.write(`[WebGL] ${text} (${details?.sourceId ?? sourceId ?? ''}:${details?.lineNumber ?? line ?? ''})\n`)
    }
  })
  window.webContents.on('did-fail-load', (_event, code, description, target, mainFrame) => {
    process.stderr.write(`[WebGL load] ${code} ${description} ${target} mainFrame=${mainFrame}\n`)
  })
  window.webContents.on('render-process-gone', (_event, details) => {
    process.stderr.write(`[WebGL renderer] ${JSON.stringify(details)}\n`)
  })
  await window.loadURL(url)
  if (process.env.LF_QA_FOCUS_WINDOW === '1') {
    window.show()
    window.focus()
    window.webContents.focus()
  }
  // Solo la fixture que lo solicita envía teclas nativas al dispatcher del Editor.
  await window.webContents.executeJavaScript('window.__lfNativeKeyReady || null', true)
  const keySteps = await window.webContents.executeJavaScript('window.__lfNativeKeySteps || null', true)
  if (Array.isArray(keySteps) && keySteps.length) {
    const debug = window.webContents.debugger
    debug.attach('1.3')
    try {
      for (const [index, step] of keySteps.entries()) {
        if (typeof step.key !== 'string' || typeof step.code !== 'string' || !Number.isInteger(step.keyCode)) throw new Error('Tecla de QA inválida')
        if (step.focus) await window.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(step.focus)})?.focus()`, true)
        const params = {key:step.key, code:step.code, windowsVirtualKeyCode:step.keyCode, modifiers:step.modifiers || 0, isKeypad:!!step.keypad, location:step.keypad ? 3 : 0}
        // El texto declarado se envía por el protocolo nativo: sin insertText sintético ni mock de CodeMirror.
        if (typeof step.text === 'string' && step.text.length === 1) params.text = step.text
        await debug.sendCommand('Input.dispatchKeyEvent', {type:'keyDown', ...params})
        await debug.sendCommand('Input.dispatchKeyEvent', {type:'keyUp', ...params})
        const result = await window.webContents.executeJavaScript(`window.__lfNativeKeyAfter?.(${index})`, true)
        if (result?.ok !== true) throw new Error(`Tecla nativa ${index}: ${JSON.stringify(result)}`)
      }
      await window.webContents.executeJavaScript('window.__lfNativeKeyDone = true', true)
    } finally { debug.detach() }
  }
  // Gestos de diagnóstico solicitados por la fixture: puntero real de Electron, sin dispatchEvent sintético.
  await window.webContents.executeJavaScript('window.__lfNativePointerReady || null', true)
  const pointerSteps = await window.webContents.executeJavaScript('window.__lfNativePointerSteps || null', true)
  if (Array.isArray(pointerSteps) && pointerSteps.length) {
    const debug = window.webContents.debugger
    debug.attach('1.3')
    try {
      for (const [index, step] of pointerSteps.entries()) {
        if (!['mouseMoved', 'mousePressed', 'mouseReleased'].includes(step.type) || !['none', 'left', 'middle', 'right'].includes(step.button)) throw new Error('Paso de puntero de QA inválido')
        const point = await window.webContents.executeJavaScript(`(() => { const r=document.querySelector(${JSON.stringify(step.selector)})?.getBoundingClientRect(); return r ? {x:r.left+r.width*${JSON.stringify(step.x ?? .5)},y:r.top+r.height*${JSON.stringify(step.y ?? .5)}} : null })()`, true)
        if (!point) throw new Error(`No existe el destino del puntero de QA (${step.type} ${step.selector})`)
        await debug.sendCommand('Input.dispatchMouseEvent', { type:step.type, ...point, button:step.button, buttons:step.buttons || 0, clickCount:step.type === 'mouseMoved' ? 0 : 1 })
        await new Promise(resolve => setTimeout(resolve, 35))
        for (const key of step.keys || []) {
          if (!['keyDown','keyUp'].includes(key.type) || typeof key.key !== 'string' || typeof key.code !== 'string' || !Number.isInteger(key.keyCode)) throw new Error('Tecla de gesto QA inválida')
          await debug.sendCommand('Input.dispatchKeyEvent', {type:key.type,key:key.key,code:key.code,windowsVirtualKeyCode:key.keyCode,modifiers:key.modifiers || 0})
        }
        if (step.verify) {
          const result = await window.webContents.executeJavaScript(`window.__lfNativePointerAfter?.(${index})`, true)
          if (result?.ok !== true) throw new Error(`Gesto nativo ${index}: ${JSON.stringify(result)}`)
        }
      }
      await window.webContents.executeJavaScript('window.__lfNativePointerDone = true', true)
    } finally { debug.detach() }
  }
  // Solo las fixtures que lo solicitan prueban arrastres nativos del navegador.
  // Un dispatchEvent sintético NO demuestra que el ratón haga Drag & Drop en Electron.
  const steps = await window.webContents.executeJavaScript('window.__lfNativeDndSteps || null', true)
  if (Array.isArray(steps) && steps.length) {
    const debug = window.webContents.debugger
    debug.attach('1.3')
    try {
      const mouse = (type, x, y, pressed) => debug.sendCommand('Input.dispatchMouseEvent', {
        type, x, y, button: type === 'mouseMoved' ? 'none' : 'left',
        buttons: pressed ? 1 : 0, clickCount: type === 'mouseMoved' ? 0 : 1,
      })
      for (const step of steps) {
        const point = await window.webContents.executeJavaScript(`(() => {
          const find = id => id === '@scene' ? document.querySelector('.sceneroot') :
            [...document.querySelectorAll('.list [role="treeitem"]')].find(el => el.dataset.id === id)
          const a = find(${JSON.stringify(step.from)}), b = find(${JSON.stringify(step.to)})
          if (!a || !b) return null
          const r = a.getBoundingClientRect(), t = b.getBoundingClientRect()
          const fraction = ${step.zone === 'before' ? 0.12 : step.zone === 'after' ? 0.88 : 0.5}
          return { from: {x:r.left + Math.min(46,r.width/2),y:r.top+r.height/2},
            to: {x:t.left+Math.min(46,t.width/2),y:t.top+t.height*fraction} }
        })()`, true)
        if (!point) throw new Error(`Fixture DnD: no existe el origen o destino ${step.from}/${step.to}`)
        const a=point.from, b=point.to
        await mouse('mouseMoved',a.x,a.y,false)
        await mouse('mousePressed',a.x,a.y,true)
        await mouse('mouseMoved',a.x+10,a.y+2,true)
        for (let n=1;n<=6;n++) {
          await mouse('mouseMoved',a.x+10+(b.x-a.x-10)*n/6,a.y+2+(b.y-a.y-2)*n/6,true)
          await new Promise(resolve=>setTimeout(resolve,30))
        }
        await mouse('mouseReleased',b.x,b.y,false)
        await new Promise(resolve=>setTimeout(resolve,110))
        const actual=await window.webContents.executeJavaScript(`window.__lfNativeDndRead?.(${JSON.stringify(step.from)})`,true)
        if (!actual || (step.expectRoot && actual.roots.join(',') !== step.expectRoot) ||
            (Object.hasOwn(step,'expectParent') && actual.parent !== step.expectParent)) {
          throw new Error(`DnD nativo ${step.from} → ${step.to} (${step.zone}) incorrecto: ${JSON.stringify(actual)}; esperado ${JSON.stringify(step)}`)
        }
      }
      await window.webContents.executeJavaScript('window.__lfNativeDndDone = true',true)
    } finally { debug.detach() }
  }
  const started = Date.now()
  let result
  while (Date.now() - started < deadline) {
    result = await window.webContents.executeJavaScript(`(() => { const el=document.getElementById(${JSON.stringify(resultId)}); return el?.dataset.pass ? { pass:el.dataset.pass, text:el.textContent } : null })()`, true)
    if (result) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  if (!result) {
    const status = await window.webContents.executeJavaScript(`(() => {
      const el=document.getElementById(${JSON.stringify(resultId)});
      return {readyState:document.readyState,stage:el?.dataset.stage || null,
        checks:el?.dataset.checks || null,text:el?.textContent?.slice(0,300) || null,
        codeMirror:!!document.querySelector('.cm-editor'),fixtureUrl:location.pathname};
    })()`, true).catch(error => ({inspectionError:String(error)}))
    throw new Error(`No se obtuvo resultado WebGL de la fixture; estado=${JSON.stringify(status)}`)
  }
  const parsed = JSON.parse(result.text)
  if (process.env.LF_QA_CAPTURE_DIR) {
    await mkdir(process.env.LF_QA_CAPTURE_DIR, { recursive:true })
    await window.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
    await new Promise(resolve => setTimeout(resolve,150))
    await writeFile(join(process.env.LF_QA_CAPTURE_DIR, `${resultId}.png`), (await window.webContents.capturePage()).toPNG())
  }
  if (process.env.LF_QA_PROFILE) window.webContents.session.flushStorageData()
  send({ok:result.pass==='true' && parsed.pass===true, data:parsed})
}
run().catch(error => { send({ok:false,error:String(error?.stack || error)}) })
  .finally(() => { if (window && !window.isDestroyed()) window.destroy(); app.exit() })
