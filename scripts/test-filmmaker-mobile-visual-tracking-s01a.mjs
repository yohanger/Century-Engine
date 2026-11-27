import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { checkedVisualFrame, visualCaptureManifest, VISUAL_FRAME_LIMIT, VISUAL_STAGE_IDS, VISUAL_FEASIBILITY_GATE } from '../src/filmmaker/mobile-visual-tracking-contract.mjs'

const java = readFileSync('filmmaker-mobile/android/app/src/main/java/com/levelforge/netherfilmmaker/MobileCapabilitiesPlugin.java', 'utf8')
const vue = readFileSync('src/filmmaker/MobileCapabilities.vue', 'utf8')
const py = readFileSync('scripts/filmmaker-mobile-visual-tracking-s01a.py', 'utf8')
const sample = { source: 'android-native-camera-intent', mime: 'image/jpeg', imageBase64: 'aGVsbG8=', width: 1000, height: 700, imageBytes: 350000, rearLensRequested: true }

test('S01A-01 captura real identificada sin certificar trasera automáticamente', () => {
  const frame = checkedVisualFrame(sample, 'estatico', 0)
  assert.equal(frame.filename, 's01a_01_estatico.jpg')
  assert.equal(frame.rearLensVerified, false)
  assert.equal(frame.timestampIsShutterTime, false)
})
test('S01A-02 rechaza fuente sintética y etapas desconocidas', () => {
  assert.throws(() => checkedVisualFrame({...sample, source:'mock'}, 'estatico', 0))
  assert.throws(() => checkedVisualFrame(sample, 'inventado', 0))
})
test('S01A-03 impide imagen fuera de tamaño y límite de adquisición', () => {
  assert.throws(() => checkedVisualFrame({...sample, imageBytes:1200001}, 'estatico', 0))
  assert.throws(() => checkedVisualFrame(sample, 'estatico', VISUAL_FRAME_LIMIT))
})
test('S01A-04 el manifiesto separa imágenes del informe y conserva limitaciones', () => {
  const out = visualCaptureManifest([checkedVisualFrame(sample, 'estatico', 0)], null, {manufacturer:'ZTE',model:'Z2473'})
  assert.equal(out.gate, VISUAL_FEASIBILITY_GATE)
  assert.equal(out.productionSixDoFApproved, false)
  assert.equal(out.frames[0].imageBase64, undefined)
  assert.equal(out.frames[0].rearLensVerified, false)
})
test('S01A-05 adquisición es un Intent de cámara nativa con límite y URI privada', () => {
  for (const fragment of ['@ActivityCallback', 'ACTION_IMAGE_CAPTURE', 'FileProvider.getUriForFile', 'getCacheDir()', 'clearVisualReferenceFile()', 'ByteArrayOutputStream', '1200000', 'rearCameraOptics', 'CameraCharacteristics.LENS_INTRINSIC_CALIBRATION']) {
    // El límite del array se expresa en Java como 1_200_000.
    if (fragment === '1200000') assert.match(java, /1_200_000/)
    else assert.ok(java.includes(fragment), `Falta ${fragment}`)
  }
})
test('S01A-06 captura no requiere ARCore y conserva los botones S01', () => {
  assert.ok(vue.includes('captureVisualReference()'))
  assert.ok(vue.includes('visualFrames.length >= VISUAL_FRAME_LIMIT'))
  assert.ok(vue.includes('cameraGranted'))
  assert.ok(vue.includes('poseTest'))
  assert.ok(vue.includes('exportJson'))
  assert.ok(vue.includes('touch-action: pan-y'))
})
test('S01A-07 análisis offline niega certificación automática de pose productiva', () => {
  for (const fragment of ['CALIBRACION_INSUFICIENTE', 'solvePnP', 'SOLVEPNP_IPPE_SQUARE', 'MARKER_0_NO_VISIBLE', 'productionSixDoFApproved', 'physicalGroundTruthProvided']) assert.ok(py.includes(fragment))
})
test('S01A-08 el runner sintético funciona si el OpenCV auditado está disponible', t => {
  const probe = spawnSync('python3', ['-c','import cv2; assert hasattr(cv2, "aruco")'], {encoding:'utf8'})
  if (probe.status !== 0) return t.skip('OpenCV no instalado en este entorno; QA PC no ejecutado')
  const result = spawnSync('python3', ['scripts/filmmaker-mobile-visual-tracking-s01a.py', 'self-test'], {encoding:'utf8'})
  assert.equal(result.status, 0, result.stderr)
  const evidence = JSON.parse(result.stdout)
  assert.equal(evidence.status, 'SINTETICO_PASS')
  assert.equal(evidence.productionSixDoFApproved, false)
})
test('S01A-09 tipos de captura reflejan movimientos contractuales sin joystick', () => {
  assert.ok(VISUAL_STAGE_IDS.includes('frontal_0_5m'))
  assert.ok(VISUAL_STAGE_IDS.includes('lateral_1m'))
  assert.ok(VISUAL_STAGE_IDS.includes('occlusion'))
  assert.ok(!vue.toLowerCase().includes('joystick'))
})
