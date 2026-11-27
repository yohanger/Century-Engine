import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCapabilityEvidence, cameraPermissionGranted, summarizeCapabilityReport } from '../src/filmmaker/mobile-capability-contract.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const native = { source: 'android-native', model: 'Z2473', sensors: [{ type: 11 }], cameras: [{ id: '0', facing: 'back' }] }
const ori = { source: 'android-rotation-vector-3dof', samples: [{ elapsedMs: 10, quaternionXYZW: [0, 0, 0, 1] }] }
const pose = { source: 'arcore-session-live', samples: [
  { elapsedMs: 0, positionMeters: [0, 0, 0], quaternionXYZW: [0, 0, 0, 1], trackingState: 'TRACKING' },
  { elapsedMs: 100, positionMeters: [0.1, 0, 0], quaternionXYZW: [0, 0, 0, 1], trackingState: 'TRACKING' },
] }
const code = (f) => readFileSync(path.join(root, f), 'utf8')

test('S01-01: sin inventario nativo no hay evidencia', () => assert.equal(summarizeCapabilityReport({}).deviceEvidence, 'NO_VERIFICADO'))
test('S01-02: inventario nativo identifica su fuente', () => assert.equal(summarizeCapabilityReport({ inventory: native }).deviceEvidence, 'INVENTARIO_NATIVO_RECIBIDO'))
test('S01-03: ninguna muestra acredita 6DoF de producción', () => assert.equal(summarizeCapabilityReport({ inventory: native, poseProbe: pose }).sixDofProductionApproved, false))
test('S01-04: orientación 3DoF válida', () => assert.equal(summarizeCapabilityReport({ inventory: native, orientation: ori }).rotation3DoF, 'MUESTRAS_VALIDAS'))
test('S01-05: orientación sin traslación no marca pose AR', () => assert.equal(summarizeCapabilityReport({ inventory: native, orientation: ori }).arPose, 'NO_VERIFICADO'))
test('S01-06: muestra con NaN no se certifica', () => assert.equal(summarizeCapabilityReport({ inventory: native, orientation: { ...ori, samples: [{ elapsedMs: 0, quaternionXYZW: [0, NaN, 0, 1] }] } }).rotation3DoF, 'NO_VERIFICADO'))
test('S01-07: pose ARCore válida necesita TRACKING', () => assert.equal(summarizeCapabilityReport({ inventory: native, poseProbe: pose }).arPose, 'TRACKING_REPORTADO_POR_ARCORE'))
test('S01-08: estado PAUSED no certifica tracking', () => assert.equal(summarizeCapabilityReport({ inventory: native, poseProbe: { ...pose, samples: [{ ...pose.samples[0], trackingState: 'PAUSED' }] } }).arPose, 'SIN_TRACKING_CONFIRMADO'))
test('S01-09: fuente simulada no certifica pose', () => assert.equal(summarizeCapabilityReport({ inventory: native, poseProbe: { ...pose, source: 'simulated' } }).arPose, 'NO_VERIFICADO'))
test('S01-10: rechazo de vector mal formado', () => assert.equal(summarizeCapabilityReport({ inventory: native, poseProbe: { ...pose, samples: [{ ...pose.samples[0], positionMeters: [0, 0] }] } }).arPose, 'NO_VERIFICADO'))
test('S01-11: desplazamiento muestral se informa sin promesa 6DoF', () => assert.equal(summarizeCapabilityReport({ inventory: native, poseProbe: pose }).maxDisplacementMetersFromFirstTrackingSample, 0.1))
test('S01-12: ARCore instalado no implica sesión válida', () => assert.equal(summarizeCapabilityReport({ inventory: native, arAvailability: { availability: 'SUPPORTED_INSTALLED' } }).arPose, 'NO_VERIFICADO'))
test('S01-13: exportación JSON contiene advertencia diagnóstica y Gate', () => { const j = JSON.parse(buildCapabilityEvidence({ inventory: native })); assert.equal(j.diagnosticsOnly, true); assert.equal(j.summary.sixDofProductionApproved, false); assert.match(j.gate, /CAPABILITIES-S01-G001/) })
test('S01-14: la app de PC sigue cargando FilmApp', () => { const src = code('src/filmmaker/main.js'); assert.match(src, /import\('\.\/FilmApp\.vue'\)/); assert.match(src, /window\.Capacitor\?\.isNativePlatform/) })
test('S01-15: plugin registrado en la actividad existente', () => assert.match(code('filmmaker-mobile/android/app/src/main/java/com/levelforge/netherfilmmaker/MainActivity.java'), /registerPlugin\(MobileCapabilitiesPlugin\.class\)/))
test('S01-16: ARCore opcional, sin exigirlo a otros dispositivos', () => assert.match(code('filmmaker-mobile/android/app/src/main/AndroidManifest.xml'), /android:name="com\.google\.ar\.core" android:value="optional"/))
test('S01-17: permiso cámara antes de iniciar pose AR', () => assert.match(code('filmmaker-mobile/android/app/src/main/java/com/levelforge/netherfilmmaker/MobileCapabilitiesPlugin.java'), /getPermissionState\("camera"\) != PermissionState\.GRANTED/))
test('S01-18: no se incorporó un servidor ni se alteraron pases', () => { const ui=code('src/filmmaker/MobileCapabilities.vue'); assert.doesNotMatch(ui, /WebSocket|PeerConnection|startPass|\.nfm/); assert.match(ui, /Guardar\/compartir informe JSON/) })

// Regresión del BUILD FAIL aportado en QA local: Vite/esbuild sigue apuntando a es2020.
test('S01-19: los await del arranque están dentro de una función async', () => {
  const entry = code('src/filmmaker/main.js')
  assert.match(entry, /async function mountFilmMaker\(\)/)
  assert.match(entry, /void mountFilmMaker\(\)/)
  assert.doesNotMatch(entry, /^const \{ default: MobileCapabilities \} = await /m)
  assert.doesNotMatch(entry, /^const \[\{ default: FilmApp \}/m)
})

test('S01-20: esbuild acepta la entrada de FilmMaker para target es2020', async (t) => {
  const esbuild = await import('esbuild').catch(() => null)
  if (!esbuild) {
    t.skip('esbuild no está instalado en este entorno; repetir tras npm ci')
    return
  }
  const result = await esbuild.transform(code('src/filmmaker/main.js'), {
    loader: 'js', format: 'esm', target: 'es2020',
  })
  assert.match(result.code, /mountFilmMaker/)
})

// Regresión de compilación Android observada en QA local: JSONArray.put(double) exige JSONException.
test('S01-21: el plugin captura JSONException al serializar muestras nativas y libera la adquisición', () => {
  const source = code('filmmaker-mobile/android/app/src/main/java/com/levelforge/netherfilmmaker/MobileCapabilitiesPlugin.java')
  assert.match(source, /import org\.json\.JSONException;/)
  assert.match(source, /try \{\s*for \(double coordinate : new double\[\]\{q\[1\], q\[2\], q\[3\], q\[0\]\}\) values\.put\(coordinate\);\s*\} catch \(JSONException error\) \{/)
  assert.match(source, /catch \(JSONException error\) \{\s*PluginCall pending = sensorCall;\s*clearSensors\(\);\s*if \(pending != null\) pending\.reject/)
})

// S01 · QA-CORR-003: el diagnóstico debe desplazarse aunque el editor bloquee el body.
test('S01-22: pantalla Android permite scroll táctil sin alterar el shell del editor', () => {
  const global = code('src/styles.css')
  const screen = code('src/filmmaker/MobileCapabilities.vue')
  const mobileRule = screen.match(/\.mobile-cap\s*\{([^}]*)\}/)?.[1] || ''
  assert.match(global, /body\s*\{[^}]*overflow:\s*hidden/s)
  assert.match(mobileRule, /height:\s*100dvh\s*;/)
  assert.match(mobileRule, /overflow-y:\s*auto\s*;/)
  assert.match(mobileRule, /touch-action:\s*pan-y\s*;/)
  assert.doesNotMatch(code('src/filmmaker/main.js'), /document\.body\.style\.overflow/)
})

// QA S01-CORR-004: Android serializa PermissionState.GRANTED como "granted" en inventario.
test('S01-23: reconocimiento de permiso concedido sin distinguir mayúsculas; bloquear otros estados', () => {
  assert.equal(cameraPermissionGranted('granted'), true)
  assert.equal(cameraPermissionGranted('GRANTED'), true)
  assert.equal(cameraPermissionGranted('denied'), false)
  assert.equal(cameraPermissionGranted('prompt'), false)
  assert.equal(cameraPermissionGranted(null), false)
  const ui = code('src/filmmaker/MobileCapabilities.vue')
  assert.match(ui, /const cameraGranted = computed\(\(\) => cameraPermissionGranted\(inventory\.value\?\.cameraPermission\)\)/)
  assert.match(ui, /inventory \|\| cameraGranted/)
  assert.match(ui, /!cameraGranted/)
  assert.doesNotMatch(ui, /cameraPermission\s*[!=]==?\s*'GRANTED'/)
})
