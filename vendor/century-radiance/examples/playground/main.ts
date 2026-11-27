import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CenturyRadiance, WebGL2Backend, type WorkerEndpoint } from '../../src/index.js';

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required element is missing: ${selector}`);
  return element;
}

const canvas = requireElement<HTMLCanvasElement>('#viewport');
const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
if (!gl) throw new Error('WebGL 2 is required');

const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101820);
scene.fog = new THREE.Fog(0x101820, 10, 32);
const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
camera.position.set(8, 6, 10);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.5, 0);
controls.enableDamping = true;

const material = (color: number, roughness = 0.65, metalness = 0.05) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
const box = (size: [number, number, number], position: [number, number, number], color: number) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material(color));
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
};

box([12, 0.25, 10], [0, -0.125, 0], 0x48545a);
box([12, 4, 0.25], [0, 2, -5], 0x667078);
box([0.25, 4, 10], [-6, 2, 0], 0x5a656c);
box([2.2, 2.2, 2.2], [-2.2, 1.1, -1.2], 0xa9643c);
box([1.3, 3.5, 1.3], [2.4, 1.75, -2.1], 0x327c88);
box([2.6, 0.8, 1.8], [1.8, 0.4, 2.1], 0x7f8261);

const doorPivot = new THREE.Group();
doorPivot.position.set(-0.1, 0, -4.82);
const door = new THREE.Mesh(new THREE.BoxGeometry(2, 3.2, 0.16), material(0x6f402a, 0.7));
door.position.set(1, 1.6, 0);
door.castShadow = true;
door.receiveShadow = true;
doorPivot.add(door);
scene.add(doorPivot);

scene.add(new THREE.HemisphereLight(0x9fc8ee, 0x302a20, 1.4));
const sun = new THREE.DirectionalLight(0xffe4bd, 3.2);
sun.position.set(5, 9, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -9;
sun.shadow.camera.right = 9;
sun.shadow.camera.top = 9;
sun.shadow.camera.bottom = -9;
scene.add(sun);
const practical = new THREE.PointLight(0x80cfff, 28, 9, 2);
practical.position.set(2, 3.2, 1.5);
practical.castShadow = true;
scene.add(practical);

const radiance = new CenturyRadiance(new WebGL2Backend(gl), {
  workerFactory: () => new Worker(new URL('../../src/workers/RadianceWorker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerEndpoint,
});

const status = requireElement<HTMLElement>('#status');
const statusContainer = requireElement<HTMLElement>('.status');
const capabilities = requireElement<HTMLElement>('#capabilities');
const diagnostics = requireElement<HTMLElement>('#diagnostics');

function showDiagnostics(): void {
  diagnostics.textContent = JSON.stringify(radiance.getDiagnostics(), null, 2);
}

async function start(): Promise<void> {
  try {
    const caps = await radiance.initialize();
    status.textContent = 'READY · HYBRID DEFAULT';
    statusContainer.className = 'status ready';
    const rows: Array<[string, string]> = [
      ['Backend', 'WebGL 2'],
      ['Renderer', caps.renderer],
      ['GLSL', caps.shadingLanguageVersion],
      ['HDR target', caps.diagnosticHdrFormat ?? 'No'],
      ['Timer query', caps.timerQuery ? 'Sí' : 'No'],
      ['OffscreenCanvas', caps.offscreenCanvas ? 'Disponible' : 'No'],
    ];
    capabilities.innerHTML = rows.map(([key, value]) => `<dt>${key}</dt><dd title="${value}">${value}</dd>`).join('');
    showDiagnostics();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
    statusContainer.className = 'status failed';
  }
}

let doorOpen = false;
document.querySelector<HTMLButtonElement>('#door')?.addEventListener('click', (event) => {
  doorOpen = !doorOpen;
  (event.currentTarget as HTMLButtonElement).textContent = doorOpen ? 'Cerrar puerta' : 'Abrir puerta';
});
document.querySelector<HTMLButtonElement>('#worker')?.addEventListener('click', async () => {
  const data = new Uint8Array(4 * 1024 * 1024);
  crypto.getRandomValues(data.subarray(0, 65536));
  const result = await radiance.runWorkerDiagnostic(data.buffer, { chunkBytes: 128 * 1024 });
  status.textContent = `WORKER OK · ${result.bytes.toLocaleString()} BYTES`;
  showDiagnostics();
});
document.querySelector<HTMLButtonElement>('#reset')?.addEventListener('click', async () => {
  await radiance.reset();
  await start();
});

function resize(): void {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
}

function render(): void {
  resize();
  doorPivot.rotation.y += ((doorOpen ? -Math.PI * 0.52 : 0) - doorPivot.rotation.y) * 0.08;
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

window.addEventListener('beforeunload', () => radiance.dispose(), { once: true });
await start();
render();
