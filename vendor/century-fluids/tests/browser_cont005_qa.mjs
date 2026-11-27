/** Run the four scenes against an already serving Vite production preview.
 * Playwright and Brave live outside the project dependency graph.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [url, evidence] = process.argv.slice(2);
const {PLAYWRIGHT_MODULE, BROWSER_EXECUTABLE} = process.env;
assert.ok(url && evidence && PLAYWRIGHT_MODULE && BROWSER_EXECUTABLE,
  'Use PLAYWRIGHT_MODULE and BROWSER_EXECUTABLE with arguments URL EVIDENCE_DIR');
const {chromium} = await import(pathToFileURL(resolve(PLAYWRIGHT_MODULE)));
const browser = await chromium.launch({
  executablePath: resolve(BROWSER_EXECUTABLE), headless: false,
  args: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding'],
});
await mkdir(evidence, {recursive: true});
const errors = [], scenes = [], responses = [];
try {
  const system = await browser.newBrowserCDPSession();
  const {gpu} = await system.send('SystemInfo.getInfo');
  const page = await browser.newPage({viewport: {width: 1280, height: 800}, deviceScaleFactor: 1});
  page.setDefaultTimeout(45000);
  await page.bringToFront();
  const cdp = await page.context().newCDPSession(page);
  page.on('pageerror', e => errors.push({type: 'pageerror', text: e.message}));
  page.on('console', msg => {
    if (['warn', 'error'].includes(msg.type())) errors.push({type: msg.type(), text: msg.text(), ...msg.location()});
  });
  page.on('response', response => {
    if (!response.ok()) responses.push({url: response.url(), status: response.status()});
  });
  const ready = page.waitForEvent('console', {predicate: msg => msg.text().includes('S09_BROWSER_READY')});
  const HTTP = await page.goto(url, {waitUntil: 'load'});
  assert.ok(HTTP?.ok());
  assert.match(await page.title(), /Century Fluids/);
  await ready;
  assert.match(await page.locator('#engineBadge').textContent(), /Jolt WASM · real/);
  assert.equal(await page.locator('#viewport canvas').count(), 1);
  assert.equal(await page.locator('vite-error-overlay').count(), 0);
  const read = id => page.locator('#'+id).textContent();
  const waitForPlaying = () => page.waitForFunction(
    () => document.querySelector('#status').textContent === 'EJECUTANDO');
  const waitForStep = () => page.waitForFunction(
    () => parseFloat(document.querySelector('#simTime').textContent) > 0);
  const text = await page.locator('main').innerText();
  assert.match(text, /Vista de simulación/);

  const options=await page.locator('#sceneSelect option').evaluateAll(nodes=>nodes.map(node=>node.value));
  const sceneIds=['tank','dam','obstacle','float',...(options.includes('shore')?['shore']:[]),...(options.includes('cup')?['cup']:[])];
  for (const id of sceneIds) {
    await page.locator('#sceneSelect').selectOption(id);
    await waitForPlaying();
    await waitForStep();
    const active = await page.evaluate(async () => {
      const read = id => document.getElementById(id).textContent;
      const startSim = parseFloat(read('simTime'));
      const startDrops = Number(read('dropValue'));
      const frames = [], measures = [];
      let start, last, lastMetric = -Infinity;
      await new Promise(resolve => {
        const frame = t => {
          if (start === undefined) start = t;
          if (last !== undefined) frames.push(t - last);
          last = t;
          if (t - lastMetric >= 250) {
            measures.push({
              physicsSubmitMs: parseFloat(read('physicsMs')),
              surfaceUpdateMs: parseFloat(read('meshMs')),
              renderSubmitMs: parseFloat(read('renderMs')),
              heapMiB: parseFloat(read('memoryValue')),
            });
            lastMetric = t;
          }
          if (t - start < 6500) requestAnimationFrame(frame); else resolve();
        };
        requestAnimationFrame(frame);
      });
      const duration = last - start;
      return {
        frames, measures, fps: frames.length * 1000 / duration, measuredSeconds: duration / 1000,
        simulatedSeconds: parseFloat(read('simTime')) - startSim,
        dropped: Number(read('dropValue')) - startDrops,
        intervalMs: Number(document.querySelector('#meshRange').value),
        view: document.querySelector('#viewSelect').value,
        quality: document.querySelector('#qualitySelect').value,
      };
    });
    assert.ok(active.simulatedSeconds > 0 && active.frames.length > 0);
    assert.equal(await read('status'), 'EJECUTANDO');
    const heap = await cdp.send('Runtime.getHeapUsage');
    const step = page.locator('#stepButton');
    await step.click();
    assert.equal(await read('status'), 'PAUSADO');
    const t = parseFloat(await read('simTime'));
    await step.click();
    const next = parseFloat(await read('simTime'));
    assert.ok(next >= t && next - t <= .011, 'manual step changed the clock by more than one tick');
    const triangles = Number((await read('triangleValue')).replace(/\D/g, ''));
    const displayedParticles = Number(await read('particleValue'));
    assert.ok(displayedParticles >= 64 && triangles > 0);
    const mode = await read('stepState');
    assert.ok(['float','cup'].includes(id) ? mode.includes('Jolt WASM') : mode.includes('Solo solver físico'));
    await page.screenshot({path: resolve(evidence, id+'.png')});
    await page.locator('#viewSelect').selectOption('particles');
    await page.locator('#viewSelect').selectOption('surface');
    await page.locator('#viewSelect').selectOption(active.view);
    if (id === 'tank') {
      await page.locator('#qualitySelect').selectOption('fine');
      await page.locator('#qualitySelect').selectOption('balanced');
      await page.locator('#playButton').click();
      await waitForPlaying();
      await page.locator('#playButton').click();
      assert.equal(await read('status'), 'PAUSADO');
    }
    await page.locator('#resetTop').click();
    await waitForPlaying();
    scenes.push({id, displayedParticles, triangles, stoppedSimTime: next, mode, active, heap});
    console.log('CONT005_BRAVE_SCENE', id, active.fps.toFixed(2), 'FPS');
  }

  // Exercise the UI allocation and shutdown path with repeated scene switches.
  for (let pass = 0; pass < 20; pass++) {
    await page.locator('#sceneSelect').selectOption(sceneIds[pass % sceneIds.length]);
    await waitForPlaying();
  }
  const heapAfter20Transitions = await cdp.send('Runtime.getHeapUsage');
  const operational = errors.filter(e => !/404/.test(e.text));
  assert.deepEqual(operational, []);
  assert.deepEqual(responses.filter(r => !r.url.endsWith('/favicon.ico')), []);
  await writeFile(resolve(evidence, 'run.json'), JSON.stringify({
    url, browser: browser.version(), mode: 'headful', viewport: [1280, 800],
    renderer: gpu.auxAttributes?.glRenderer, device: gpu.devices[0],
    scenes, heapAfter20Transitions, transitions: 20, errors, responses,
    humanVisualAcceptance: false,
  }, null, 2)+'\n');
} finally {
  await browser.close();
}
