import { runProbe } from './probe.mjs';
import { verifyParity } from './verify.mjs';

const status = document.querySelector('#status');
const detail = document.querySelector('#detail');
const output = document.querySelector('#result');

function setState(state, message, values) {
  status.textContent = state;
  status.dataset.state = state === 'S05_BROWSER_PASS' ? 'pass' : 'fail';
  document.body.dataset.qa = status.dataset.state;
  detail.textContent = message;
  output.textContent = values ? JSON.stringify(values, null, 2) : '';
}

try {
  const response = await fetch('/expected.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Node reference unavailable: HTTP ${response.status}`);
  const expected = await response.json();
  const actual = runProbe();
  verifyParity(actual, expected);
  setState('S05_BROWSER_PASS', 'Importación ESM, simulación, estado físico y paridad Node/navegador: PASS.', { actual, expected });
  console.info('S05_BROWSER_PASS', { actual, expected });
} catch (error) {
  setState('S05_BROWSER_FAIL', String(error));
  console.error('S05_BROWSER_FAIL', error);
}
