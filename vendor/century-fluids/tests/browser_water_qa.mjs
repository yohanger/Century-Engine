import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const [url,evidence]=process.argv.slice(2);
const {PLAYWRIGHT_MODULE,BROWSER_EXECUTABLE}=process.env;
assert.ok(url&&evidence&&PLAYWRIGHT_MODULE&&BROWSER_EXECUTABLE);
const {chromium}=await import(pathToFileURL(resolve(PLAYWRIGHT_MODULE)));

const browser=await chromium.launch({executablePath:resolve(BROWSER_EXECUTABLE),headless:false});
const config={viewport:{width:1280,height:800},deviceScaleFactor:1};
await mkdir(evidence,{recursive:true});
try{
 const page=await browser.newPage(config);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',msg=>{if(msg.type()==='error'||msg.type()==='warning')errors.push(msg.text());});
 page.setDefaultTimeout(35000);
 await page.goto(url);
 await page.locator('#engineBadge').filter({hasText:'Jolt WASM · real'}).waitFor();
 const canvas=page.locator('#viewport canvas');
 const time=async()=>parseFloat(await page.locator('#simTime').textContent());
 const step=()=>page.locator('#stepButton').click();
 const waitForSim=target=>page.waitForFunction(n=>parseFloat(document.querySelector('#simTime').textContent)>=n,target);
 await waitForSim(.85);
 await step();
 const initialTime=await time(), initial=await canvas.screenshot();
 const viewport=await canvas.boundingBox();
 await page.locator('.water-appearance summary').click();
 await page.locator('#waterTint').fill('#d2355b');
 await page.locator('#waterTransmission').fill('0.57');
 await page.waitForTimeout(350);
 assert.notDeepEqual(initial,await canvas.screenshot());
 assert.equal(await time(),initialTime);
 await page.screenshot({path:resolve(evidence,'color.png')});
 await page.locator('#waterTint').fill('#67bbc4');
 await page.locator('#waterTransmission').fill('0.96');
 await page.mouse.move(viewport.x+viewport.width*.55,viewport.y+viewport.height*.52);
 await page.mouse.down();await page.mouse.move(viewport.x+viewport.width*.57,viewport.y+viewport.height*.52);
 await page.mouse.up();
 assert.doesNotMatch(await page.locator('#notice').textContent(),/Pulso preparado/);
 let hit;
 for(const [x,y] of [[.5,.57],[.50,.55],[.51,.56],[.48,.55],[.52,.57],[.48,.6],[.52,.62],[.49,.63],[.5,.65],[.5,.66]]){
  await page.mouse.click(viewport.x+viewport.width*x,viewport.y+viewport.height*y);
  if(/Pulso preparado/.test(await page.locator('#notice').textContent())){hit=[x,y];break;}
 }
 assert.ok(hit,'no water was hit');
 assert.equal(await time(),initialTime);
 for(let i=0;i<8;i++)await step();
 assert.ok(await time()>initialTime+.05);
 await page.screenshot({path:resolve(evidence,'pulse.png')});
 assert.equal(await page.locator('#waterFoam').count(),0);
 await page.screenshot({path:resolve(evidence,'sol.png')});
 await page.locator('#sceneSelect').selectOption('float');
 await waitForSim(.45);
 await step();
 assert.match(await page.locator('#stepState').textContent(),/Jolt WASM/);
 assert.deepEqual(errors,[]);
 await writeFile(resolve(evidence,'run.json'),JSON.stringify({browser:browser.version(),viewport:config.viewport,tint:true,
  transmission:true,orbitWithoutImpulse:true,waterClick:hit,pausedTime:initialTime,
  visualFoamControlRemoved:true,errors},null,2)+'\n');
 console.log('BRAVE_WATER_PASS');
}finally{await browser.close();}
