import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { runInNewContext } from 'node:vm'

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const key = (name, extra = {}) => ({ type: 'keyDown', key: name, control: false, shift: false, meta: false, alt: false, ...extra })

async function runtimeFixture(diagnostics, env = {}) {
  const dir = '/tmp/levelforge-g003/runtime'
  const PAGE = pathToFileURL(path.join(dir, 'dist', 'runtime.html')).href
  const windows = [], handlers = new Map(), channels = new Map()
  const webRequest = { onBeforeRequest: fn => { webRequest.check = fn } }
  class WebContents {
    constructor() { this.events = new Map(); this.toggles = 0; this.sends = []; this.url = PAGE }
    on(name, fn) { this.events.set(name, fn) }
    setWindowOpenHandler(fn) { this.windowOpen = fn }
    getURL() { return this.url }
    toggleDevTools() { this.toggles++ }
    send(...args) { this.sends.push(args) }
    emitKey(input) { let prevented = false; this.events.get('before-input-event')?.({ preventDefault() { prevented = true } }, input); return prevented }
  }
  class Window {
    constructor(options) { this.options = options; this.webContents = new WebContents(); this.events = new Map(); windows.push(this); this.fullscreen = options.fullscreen }
    on(n, cb) { this.events.set(n, cb) }
    once(n, cb) { this.events.set(n, cb) }
    loadFile(file) { this.file = file }
    maximize() {}
    setFullScreen(v) { this.fullscreen = v }
    isFullScreen() { return this.fullscreen }
    show() {}
    focus() {}
    isMinimized() { return false }
  }
  const app = { requestSingleInstanceLock: () => true, getPath: () => '/tmp/lf-s17-g003-saves', whenReady: () => Promise.resolve(), on: (k, fn) => channels.set(k, fn), quit() {} }
  const cfg = { title: 'Demo', ...(diagnostics === undefined ? {} : { diagnostics }) }
  const fakeFs = { readFileSync: (p) => {
    if (String(p).endsWith('config.json')) return JSON.stringify(cfg)
    return Buffer.from('fake')
  } }
  const fakeSession = { defaultSession: {
    setPermissionRequestHandler: fn => { fakeSession.request = fn },
    setPermissionCheckHandler: fn => { fakeSession.checkPermission = fn },
    webRequest,
  } }
  const electron = { app, BrowserWindow: Window, ipcMain: {handle(n,fn){handlers.set(n,fn)},on(n,fn){handlers.set(n,fn)}}, Menu:{setApplicationMenu(){}}, session:fakeSession }
  runInNewContext(read('electron/runtime/main.cjs'), {
    require: n => n==='electron'?electron:n==='node:path'?path:n==='node:fs'?fakeFs:n==='node:url'?{pathToFileURL}:n==='./saves.cjs'?{createSaves:()=>({})}:(()=>{throw new Error(n)})(),
    __dirname:dir,Buffer,console,process:{ env, platform:'linux',arch:'x64' },module:{exports:{}},
  },{filename:'electron/runtime/main.cjs'})
  await Promise.resolve();await Promise.resolve()
  assert.equal(windows.length,1)
  const win=windows[0]
  return { win, handlers, PAGE, session:fakeSession, async request(url) { return new Promise(resolve => webRequest.check({url},resolve)) } }
}

async function exportedConfig(diagnostics) {
  const calls = new Map()
  const sq = {
    dir: () => ({}),addDir() {},addSymlink() {},
    addFile(_root,dest,opts) { if(opts.data)calls.set(dest,opts.data) },
    async writeSquashfs() { return {size:123} },
  }
  const fakeFs={
    existsSync:()=>true,
    readdirSync:()=>[],
    readFileSync:()=>Buffer.from('stub'),
    statSync:()=>({isDirectory:()=>false}),
    chmodSync(){},renameSync(){},
  }
  const module={exports:{}}
  runInNewContext(read('electron/appimage.cjs'),{
    require:n=>n==='node:path'?path:n==='node:fs'?fakeFs:n==='./squashfs.cjs'?sq:(()=>{throw new Error(n)})(),
    __dirname:'/runtime/electron',Buffer,console,process:{platform:'linux',arch:'x64',execPath:'/runtime/electron/bin'},module,
  },{filename:'electron/appimage.cjs'})
  await module.exports.exportAppImage({distDir:'/game/dist-runtime',runtimeDir:'/runtime',runtimeExe:'bin',outPath:'/tmp/demo.AppImage',name:'Demo',gameBytes:Buffer.from('game'),diagnostics})
  const cfg=calls.get('resources/app/config.json')
  assert.ok(cfg)
  return JSON.parse(cfg.toString())
}

test('DG-01 · F3 Editor abre Stats durante Play sin interceptar formularios',()=>{
  const s=read('src/core/editor/keys.js')
  const method=s.slice(s.indexOf('  _bindKeys() {'),s.indexOf('  // =================== watchers'))
  const handlers=new Map(),store={locked:false,play:{on:true},modal:null,palette:false,project:{},view:{perf:false}}
  const win={addEventListener(n,fn){handlers.set(n,fn)}}
  const doc={addEventListener() {},hidden:false}
  const dependencies=['win','doc','store','clamp','hasTool','tool','getObject','selectObject','undo','redo','removeSelected','duplicateSelected','linkedDuplicateSelected','copySelected','pasteSelected','groupSelected','ungroup','saveLfproj','saveAll','openLfprojDialog','parentSelectionToActive','unparentSelection','joinSelectedMeshes','openEventEditor','toast']
  const fn=new Function(...dependencies,`return ({${method}})._bindKeys`)(win,doc,store,(x)=>x,()=>false,{},...Array(19).fill(()=>{}))
  fn.call({_setSnapShiftHeld(){},vp:{isFlying:false}})
  const e=(target,keyValue='F3',extra={})=>({key:keyValue,code:keyValue,target,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false,prevented:false,preventDefault(){this.prevented=true},...extra})
  const press=handlers.get('keydown');assert.ok(press)
  const a=e({tagName:'DIV'});press(a);assert.equal(store.view.perf,true);assert.equal(a.prevented,true)
  const b=e({tagName:'DIV'});press(b);assert.equal(store.view.perf,false)
  const c=e({tagName:'INPUT'});press(c);assert.equal(store.view.perf,false)
  const d=e({tagName:'DIV'},'F3',{ctrlKey:true});press(d);assert.equal(store.view.perf,false)
})

test('DG-02 · Build omite capacidades en la exportación normal', async()=>{
  const c=await exportedConfig(undefined)
  assert.equal(Object.hasOwn(c,'diagnostics'),false)
})
test('DG-03 · dos flags independientes y estrictamente booleanos se integran en AppImage',async()=>{
  assert.deepEqual(JSON.parse(JSON.stringify((await exportedConfig({devtools:true,stats:false})).diagnostics)),{devtools:true,stats:false})
  assert.deepEqual(JSON.parse(JSON.stringify((await exportedConfig({devtools:false,stats:true})).diagnostics)),{devtools:false,stats:true})
  assert.equal((await exportedConfig({devtools:'true',stats:'true'})).diagnostics,undefined)
})
test('DG-04 · sin permiso DevTools sigue prohibido aunque haya variables de entorno',async()=>{
  const {win}=await runtimeFixture(undefined,{GAME_DEVTOOLS:'1'})
  assert.equal(win.options.webPreferences.devTools,false)
  assert.equal(win.webContents.emitKey(key('F12')),false)
  assert.equal(win.webContents.emitKey(key('F12',{control:true,shift:true})),true)
  assert.equal(win.webContents.toggles,0)
})
test('DG-05 · Stats sin DevTools conmuta solo con Ctrl+Shift+F3',async()=>{
  const {win}=await runtimeFixture({stats:true,devtools:false})
  assert.equal(win.options.webPreferences.devTools,false)
  assert.equal(win.webContents.emitKey(key('F3',{control:true,shift:true})),true)
  assert.equal(win.webContents.sends.length,1)
  assert.equal(win.webContents.sends[0][0],'lf-runtime:stats-toggle')
  win.webContents.emitKey(key('F3',{control:true,shift:true,isAutoRepeat:true}))
  assert.equal(win.webContents.sends.length,1)
  win.webContents.emitKey(key('F12',{control:true,shift:true}))
  assert.equal(win.webContents.toggles,0)
})
test('DG-06 · DevTools solo mediante atajo NGME y permiso del artefacto',async()=>{
  const {win}=await runtimeFixture({devtools:true,stats:false})
  assert.equal(win.options.webPreferences.devTools,true)
  assert.equal(win.webContents.emitKey(key('F12',{control:true,shift:true})),true)
  assert.equal(win.webContents.toggles,1)
  win.webContents.emitKey(key('F12',{control:true,shift:true,isAutoRepeat:true}))
  assert.equal(win.webContents.toggles,1)
  assert.equal(win.webContents.emitKey(key('F12')),true)
  assert.equal(win.webContents.emitKey(key('I',{control:true,shift:true})),true)
  assert.equal(win.webContents.toggles,1)
  win.webContents.emitKey(key('F3',{control:true,shift:true}))
  assert.equal(win.webContents.sends.length,0)
})
test('DG-07 · IPC de permisos restringido al frame principal del Runtime',async()=>{
  const {handlers,PAGE}=await runtimeFixture({stats:true})
  const diag=handlers.get('lf-runtime:diagnostics')
  assert.ok(diag)
  assert.deepEqual(JSON.parse(JSON.stringify(diag({senderFrame:{url:PAGE}}))),{stats:true})
  assert.throws(()=>diag({senderFrame:{url:'https://externo.com'}}),/no permitido/)
})
test('DG-08 · el filtro de red conserva la denegación por defecto, y habilita devtools:// solo con permiso',async()=>{
  const a=await runtimeFixture(undefined)
  assert.equal((await a.request('devtools://devtools/bundled/inspector.html')).cancel,true)
  assert.equal((await a.request('https://example.org')).cancel,true)
  const b=await runtimeFixture({devtools:true})
  assert.equal((await b.request('devtools://devtools/bundled/inspector.html')).cancel,false)
  assert.equal((await b.request('https://example.org')).cancel,true)
})
test('DG-09 · las opciones no se guardan en Database ni en el paquete de juego',()=>{
  const ui=read('src/components/ExportGameModal.vue')
  assert.match(ui,/st\.diagnostics\.devtools = \$event\.target\.checked/)
  assert.match(ui,/st\.diagnostics\.stats = \$event\.target\.checked/)
  assert.doesNotMatch(read('src/engine/runtime/package/format.js'),/diagnostics/)
  assert.match(read('src/core/state/game.js'),/st\.diagnostics\?\.devtools === true/)
})
test('DG-10 · Stats en Runtime utiliza el mismo PerfPanel que el Editor',()=>{
  assert.match(read('src/runtime-app/RuntimeApp.vue'),/import PerfPanel from '\.\.\/components\/PerfPanel\.vue'/)
  const panel=read('src/components/PerfPanel.vue')
  assert.doesNotMatch(panel,/from '\.\.\/core\/store\.js'/)
  assert.match(panel,/props\.monitor/)
  assert.match(read('src/App.vue'),/:monitor="store\.editor\.vp\.perf"/)
  assert.match(read('src/engine/runtime/events/play-controls.js'),/!this\.runtime && e\.code === 'F3'/)
  assert.match(read('src/runtime-app/RuntimeApp.vue'),/statsAllowed && statsOpen/)
})
test('DG-11 · AO mantiene 16 muestras y 16 de denoise sin cambiar calidad por defecto',()=>{
  const look=read('src/engine/runtime/render/look.js')
  assert.match(look,/samples: 16, distanceFallOff: 1/)
  assert.match(look,/rings: 2, samples: 16/)
  assert.match(look,/\[\[this\.renderPass, 'Escena'\]/)
  assert.match(look,/\[this\.aoPass, 'AO'\]/)
})
