import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('Docking con BrowserWindow, IPC de producción y entradas del runner', {timeout:80000},async()=>{
 const backend=process.env.LF_QA_DOCK_BACKEND
 if(backend && (process.platform!=='linux'||!['x11','wayland'].includes(backend)))throw Error('LF_QA_DOCK_BACKEND debe ser x11 o wayland en Linux')
 const result=await verifyWebGL({electronArgs:backend?[`--ozone-platform=${backend}`]:[],port:44349,fixture:'scripts/fixtures/editor/native-docking-restoration.html',id:'qa-result',minChecks:23,fixtureWaitMs:50000,runner:'qa-electron-native-docking.cjs'})
 console.log('Movimiento físico del compositor:',JSON.stringify(result.nativeMove ?? {status:'NO VERIFICADO'}))
})
