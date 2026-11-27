/** Use the Vite production preview with the pinned Jolt WASM and graphical Brave. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const [url,evidence]=process.argv.slice(2);
const {PLAYWRIGHT_MODULE,BROWSER_EXECUTABLE,PLAYWRIGHT_HEADLESS}=process.env;
assert.ok(url&&evidence&&PLAYWRIGHT_MODULE&&BROWSER_EXECUTABLE);
const {chromium}=await import(pathToFileURL(resolve(PLAYWRIGHT_MODULE)));
const browser=await chromium.launch({headless:PLAYWRIGHT_HEADLESS==='1',executablePath:resolve(BROWSER_EXECUTABLE),args:[
  '--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--enable-unsafe-swiftshader'
]});
await mkdir(evidence,{recursive:true});
const screens={}, measurements={};
try{
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  page.setDefaultTimeout(85000);
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(['warn','error'].includes(m.type()))errors.push(m.text());});
  const data=await browser.newBrowserCDPSession();
  const gpu=(await data.send('SystemInfo.getInfo')).gpu.auxAttributes?.glRenderer;
  const cdp=await page.context().newCDPSession(page);
  await page.goto(url);
  await page.locator('#engineBadge').filter({hasText:'Jolt WASM · real'}).waitFor();
  console.log('BRAVE_WASM_READY');
  const time=()=>page.locator('#simTime').textContent().then(parseFloat);
  const number=id=>page.locator(id).textContent().then(parseFloat);
  const screen=async(name)=>{
    screens[name]=await time();
    await page.screenshot({path:resolve(evidence,name+'.png')});
  };
  async function sample(){
    const fps=await page.evaluate(()=>new Promise(resolve=>{
      let begin, frames=0;
      const frame=t=>{
        if(begin===undefined)begin=t;else frames++;
        if(t-begin<4500)requestAnimationFrame(frame);else resolve({frames,elapsedMs:t-begin,fps:1000*frames/(t-begin)});
      };
      requestAnimationFrame(frame);
    }));
    return {...fps,heap:await cdp.send('Runtime.getHeapUsage')};
  }
  await page.locator('#sceneSelect').selectOption('dam');
  await page.waitForFunction(()=>parseFloat(document.querySelector('#airValue').textContent)>20);
  measurements.peakSnapshotAirML=await number('#airValue');
  await screen('espuma');
  measurements.foamOn=await sample();
  await page.locator('.water-appearance summary').click();
  await page.locator('#physicalFoam').uncheck();
  await page.waitForFunction(()=>document.querySelector('#airValue').textContent==='Desactivado');
  measurements.foamOff=await sample();
  await page.locator('#physicalFoam').check();

  // Reproduce the input in a fixed-step sequence at the same phase of the
  // water motion on every host. Pointer gestures still use the real canvas.
  await page.evaluate(()=>{
    const scene=document.querySelector('#sceneSelect');
    scene.value='cup';scene.dispatchEvent(new Event('change'));
    document.querySelector('#playButton').click();
  });
  await page.locator('#cupMetrics').waitFor({state:'visible'});
  const viewport=await page.locator('#viewport canvas').boundingBox();
  const center=viewport.x+viewport.width*.5;
  const y=offset=>viewport.y+viewport.height*offset;
  const step=steps=>page.evaluate(n=>{
    const button=document.querySelector('#stepButton');
    for(let i=0;i<n;i++)button.click();
  },steps);
  const view=mode=>page.locator('#viewSelect').selectOption(mode);
  async function drag(y0,y1,shift=false){
    await page.mouse.move(center,y(y0));
    if(shift)await page.keyboard.down('Shift');
    await page.mouse.down();
    await page.mouse.move(center,y(y1),{steps:4});
    await page.mouse.up();
    if(shift)await page.keyboard.up('Shift');
  }
  await view('particles');
  await step(130);
  await drag(.35,.552);
  await step(270);
  console.log('BRAVE_CUP_DIP',await number('#cupMass'),await number('#cupWork'));
  assert.ok(await number('#cupWork')>1,'cup did not respond to the drag');
  measurements.waterCapturedKg=await number('#cupMass');
  assert.ok(measurements.waterCapturedKg>0,'no water captured after dipping');
  await screen('recogida');

  await drag(.57,.335);
  await step(190);
  console.log('BRAVE_CUP_LIFT',await number('#cupMass'));
  measurements.waterAfterLiftKg=await number('#cupMass');
  assert.ok(measurements.waterAfterLiftKg>0,'mouse lift did not retain water');
  await view('surface');
  await screen('vaso');

  await drag(.322,.622,true);
  await view('particles');
  await step(385);
  assert.equal(await number('#cupMass'),0,'mouse tilt did not empty vessel');
  measurements.waterAfterPourKg=await number('#cupMass');
  await view('surface');
  await screen('vertido');
  assert.equal(await page.locator('#status').textContent(),'PAUSADO');
  assert.deepEqual(errors,[]);
  await writeFile(resolve(evidence,'run.json'),JSON.stringify({braveChromium:browser.version(),gpu,
    viewport:[1280,800],measurements,screens,errors},null,2)+'\n');
}finally{await browser.close();}
