// Contrato de QA gráfico de S03: Electron del propio proyecto, sin navegador externo.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const get=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const runner=get('scripts/qa-electron-webgl-runner.mjs')
const app=get('scripts/qa-electron-webgl.cjs')
const testFiles=['test-vfx-webgl-s02-g001.mjs','test-weather-tornado-visual-webgl-corr-g001.mjs','test-weather-tornado-visual-cohesion-webgl-corr-g001.mjs']
test('WUE-01: usa ejecutable Electron instalado por npm',()=>{assert.match(runner,/import\('electron'\)/);assert.doesNotMatch(runner,/spawnSync\(browser|LF_VFX_BROWSER/)})
test('WUE-02: Vite sirve los módulos del proyecto sin crear otro Player',()=>{assert.match(runner,/node_modules\/vite\/bin\/vite\.js/);assert.match(runner,/127\.0\.0\.1/);assert.doesNotMatch(runner,/node_modules\/\.bin\/chromium/)})
test('WUE-03: el host de QA usa BrowserWindow nativo y WebGL',()=>{assert.match(app,/BrowserWindow/);assert.match(app,/window\.loadURL\(url\)/);assert.match(app,/executeJavaScript/)})
test('WUE-04: QA no desactiva GPU por defecto',()=>{assert.doesNotMatch(runner+app,/disableHardwareAcceleration|disable-gpu|swiftshader|use-angle/)})
test('WUE-05: no expone Node al contenido de las fixtures',()=>{assert.match(app,/sandbox:true/);assert.match(app,/contextIsolation:true/);assert.match(app,/nodeIntegration:false/)})
test('WUE-06: runner captura resultado estructurado, no solo captura de pantalla',()=>{assert.match(app,/JSON\.parse\(result\.text\)/);assert.match(runner,/assert\.equal\(result\.ok,true/);assert.match(runner,/result\.data\?\.checks\?\.length/)})
test('WUE-07: las pruebas gráficas heredadas usan la misma infraestructura',()=>{for(const name of testFiles){const s=get('scripts/'+name);assert.match(s,/verifyWebGL/);assert.doesNotMatch(s,/spawnSync\(|chromium|LF_VFX_BROWSER/)}})
test('WUE-08: existe timeout y limpieza del proceso Vite',()=>{assert.match(runner,/setTimeout/);assert.match(runner,/server\.kill\('SIGTERM'\)/)})
test('WUE-09: cada fixture conserva sus aserciones reales WebGL',()=>{for(const path of ['webgl','tornado-cohesion','tornado-visual'])assert.match(get('scripts/fixtures/vfx/'+path+'.html'),/new THREE\.WebGLRenderer/)})
