<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { registerPlugin } from '@capacitor/core'
import { buildCapabilityEvidence, cameraPermissionGranted, summarizeCapabilityReport } from './mobile-capability-contract.mjs'
import { saveBytes } from './files.js'
import { checkedVisualFrame, visualCaptureManifest, VISUAL_FRAME_LIMIT, VISUAL_STAGE_IDS } from './mobile-visual-tracking-contract.mjs'
import { createMobileLiveMonitor } from './mobile-live-monitor.js'

const device = registerPlugin('MobileCapabilities')
const mobileVideo = ref(null)
const mobileMonitor = createMobileLiveMonitor(device, () => mobileVideo.value)
async function connectMonitor() {
  try { await mobileMonitor.connect() } catch (e) { /* El error se muestra en la pantalla */ }
}
async function disconnectMonitor() { await mobileMonitor.disconnect() }
const busy = ref('')
const error = ref('')
const inventory = ref(null)
const arAvailability = ref(null)
const orientation = ref(null)
const poseProbe = ref(null)
const history = ref([])
const visualStage = ref('calibracion')
const visualFrames = ref([])
const rearOptics = ref(null)
const diagnosticErrors = ref([])
const report = computed(() => ({ inventory: inventory.value, arAvailability: arAvailability.value, orientation: orientation.value, poseProbe: poseProbe.value, diagnosticErrors: diagnosticErrors.value }))
const summary = computed(() => summarizeCapabilityReport(report.value))
const cameraGranted = computed(() => cameraPermissionGranted(inventory.value?.cameraPermission))
const native = () => !!window.Capacitor?.isNativePlatform?.()

async function task(label, fn) {
  if (busy.value) return
  busy.value = label
  error.value = ''
  try { await fn() } catch (err) { error.value = err?.message || String(err); history.value.push(`${label}: ${error.value}`); diagnosticErrors.value.push({ step: label, message: error.value }) }
  finally { busy.value = '' }
}
async function inspect() {
  await task('Inventario', async () => {
    inventory.value = await device.inventory()
    arAvailability.value = await device.arAvailability()
    orientation.value = null
    poseProbe.value = null
    history.value.push('Inventario nativo y disponibilidad ARCore consultados')
  })
}
async function permission() {
  await task('Permiso de cámara', async () => {
    await device.requestCamera()
    inventory.value = await device.inventory()
  })
}
async function sensorTest() {
  await task('Sensor de orientación · 4 s', async () => {
    orientation.value = await device.sampleOrientation({ durationMs: 4000 })
    history.value.push(`Sensor: ${orientation.value.samples?.length || 0} muestras; solo orientación, no traslación`)
  })
}
async function arInstall() {
  await task('Instalación ARCore', async () => {
    const result = await device.installArService()
    history.value.push(`Servicio ARCore: ${result.installStatus}`)
    arAvailability.value = await device.arAvailability()
  })
}
async function poseTest() {
  await task('Seguimiento AR · 5 s', async () => {
    poseProbe.value = await device.probeArPose({ durationMs: 5000 })
    history.value.push(`ARCore: ${poseProbe.value.trackingFrames || 0} fotogramas TRACKING; evaluación física todavía pendiente`)
  })
}
async function captureVisualFrame() {
  await task('Fotografía de referencia S01A', async () => {
    if (!cameraGranted.value) throw new Error('Primero concede el permiso de cámara')
    if (visualFrames.value.length >= VISUAL_FRAME_LIMIT) throw new Error('Límite de 12 imágenes alcanzado: exporta antes de continuar')
    if (rearOptics.value == null) {
      try { rearOptics.value = await device.rearCameraOptics() }
      catch (err) { history.value.push(`Óptica trasera sin calibración verificable: ${err?.message || err}`) }
    }
    const raw = await device.captureVisualReference()
    const frame = checkedVisualFrame(raw, visualStage.value, visualFrames.value.length)
    visualFrames.value.push(frame)
    history.value.push(`Fotografía de referencia ${frame.filename}: ${frame.width} × ${frame.height}. Lente trasera por confirmar.`)
  })
}
async function exportVisualArchive() {
  await task('Exportar capturas S01A', async () => {
    if (!visualFrames.value.length) throw new Error('No hay fotografías para exportar')
    const { default: JSZip } = await import('jszip')
    const archive = new JSZip()
    const manifest = visualCaptureManifest(visualFrames.value, rearOptics.value, inventory.value)
    archive.file('manifest.json', JSON.stringify(manifest, null, 2))
    for (const frame of visualFrames.value) archive.file(frame.filename, frame.imageBase64, { base64: true })
    const bytes = await archive.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 3 } })
    const location = await saveBytes(bytes, 'LF_MOBILE_S01A_Z2473_CAPTURAS.zip', 'application/zip')
    history.value.push(`Capturas S01A exportadas: ${location}; no se acredita todavía 6DoF`)
  })
}
function discardVisualFrames() {
  visualFrames.value = []
  rearOptics.value = null
  history.value.push('Capturas temporales S01A descartadas de memoria; los ZIP exportados no se eliminan automáticamente')
}
async function exportJson() {
  await task('Exportar evidencia', async () => {
    const bytes = new TextEncoder().encode(buildCapabilityEvidence(report.value))
    const location = await saveBytes(bytes, 'LF_MOBILE_S01_Z2473_DIAGNOSTICO.json', 'application/json')
    history.value.push(`Evidencia solicitada para guardar/compartir: ${location}`)
  })
}
const onMobileVisibility = () => { if (document.hidden && mobileMonitor.state.phase !== 'idle') void mobileMonitor.disconnect() }
onMounted(() => { document.addEventListener('visibilitychange', onMobileVisibility); if (native()) inspect(); else error.value = 'El enlace móvil funciona únicamente en el APK Android. El navegador no simula el teléfono.' })
onBeforeUnmount(() => { document.removeEventListener('visibilitychange', onMobileVisibility); void mobileMonitor.disconnect() })
</script>

<template>
  <main class="mobile-cap" data-test="mobile-capabilities">
    <header class="mobile-head">
      <p class="eyebrow">Nether Film Maker / Cámara móvil</p>
      <h1>Cámara móvil de FilmMaker</h1>
      <p>S03 · Monitor de encuadre y orientación por LAN. El PC conserva escena, render y grabación. La traslación 6DoF sigue sin verificarse.</p>
    </header>
    <section class="cap-panel" data-test="mobile-live-monitor">
      <h2>Monitor remoto · FilmMaker PC</h2>
      <div class="mobile-screen"><video ref="mobileVideo" autoplay muted playsinline :style="{ visibility: mobileMonitor.state.monitoring ? 'visible' : 'hidden' }" aria-label="Encuadre recibido de Nether FilmMaker"></video>
        <p v-if="!mobileMonitor.state.monitoring" class="mobile-screen-status">{{ mobileMonitor.state.phase === 'idle' ? 'Sin conexión al PC' : 'Esperando imagen nueva del PC…' }}</p>
      </div>
      <p class="cap-status">Estado: {{ mobileMonitor.state.phase }} · Escena: {{ mobileMonitor.state.productionName || "—" }} · RTT p50/p95: {{ mobileMonitor.state.rttP50 ?? "—" }}/{{ mobileMonitor.state.rttP95 ?? "—" }} ms · Fotogramas decodificados: {{ mobileMonitor.state.framesDecoded }} · Orientaciones enviadas: {{ mobileMonitor.state.samplesSent }}</p>
      <p class="cap-status" data-test="mobile-monitor-quality-stats">Recepción: {{ mobileMonitor.state.videoFps ?? '—' }} fps · {{ mobileMonitor.state.bitrateKbps ?? '—' }} kb/s · {{ mobileMonitor.state.videoWidth ?? '—' }} × {{ mobileMonitor.state.videoHeight ?? '—' }} px · Edad última imagen: {{ mobileMonitor.state.staleMs ?? '—' }} ms.</p>
      <p class="cap-status" data-test="mobile-monitor-latency">Vídeo, latencia estimada p50/p95 (solo si el WebView ofrece captureTime): {{ mobileMonitor.state.videoLatencyP50 ?? '—' }}/{{ mobileMonitor.state.videoLatencyP95 ?? '—' }} ms.</p>
      <p class="cap-status" data-test="mobile-monitor-resources">Proceso Android: CPU {{ mobileMonitor.state.processCpuPercent == null ? '—' : `${mobileMonitor.state.processCpuPercent.toFixed(1)} %` }} · PSS {{ mobileMonitor.state.processPssMiB == null ? '—' : `${mobileMonitor.state.processPssMiB.toFixed(0)} MiB` }} · RAM disponible del sistema {{ mobileMonitor.state.availableSystemMiB == null ? '—' : `${mobileMonitor.state.availableSystemMiB.toFixed(0)} MiB` }}.</p>
      <template v-if="mobileMonitor.state.phase === 'idle' || mobileMonitor.state.phase === 'error'">
        <p>En FilmMaker para PC, abre una película, entra en Cámara y pulsa «Activar enlace». Copia aquí la dirección y el código de esa sesión.</p>
        <label class="cap-field-label" for="mobile-pc-address">IP del PC y puerto</label>
        <input id="mobile-pc-address" v-model.trim="mobileMonitor.state.address" class="cap-field" placeholder="192.168.1.20:45000" autocomplete="off" inputmode="url" />
        <label class="cap-field-label" for="mobile-pair-code">Código temporal de 12 dígitos</label>
        <input id="mobile-pair-code" v-model.trim="mobileMonitor.state.code" class="cap-field" maxlength="14" placeholder="123456789012" autocomplete="one-time-code" inputmode="numeric" />
        <div class="cap-actions"><button class="cap-primary" :disabled="!native()" data-test="mobile-connect" @click="connectMonitor">Vincular con FilmMaker</button></div>
      </template>
      <div v-else class="cap-actions"><button data-test="mobile-disconnect" @click="disconnectMonitor">Desconectar monitor</button></div>
      <p v-if="mobileMonitor.state.error" class="cap-error" role="alert">{{ mobileMonitor.state.error }}</p>
      <p>Mientras haya imagen reciente podrás girar el teléfono para orientar la cámara virtual. No controla la posición física, las colisiones ni la grabación. Si se pierde el monitor, deja de enviar orientación.</p>
    </section>
    <details class="mobile-diagnostics">
      <summary>Diagnóstico y pruebas S01 / S01A</summary>
    <section class="cap-panel">
      <div class="cap-row"><span>Dispositivo</span><strong>{{ inventory ? `${inventory.manufacturer} ${inventory.model}` : 'Pendiente' }}</strong></div>
      <div class="cap-row"><span>Software Android</span><strong>{{ inventory?.softwareBuild ?? '—' }}</strong></div>
      <div class="cap-row"><span>RAM física reportada por Android</span><strong>{{ Number.isFinite(inventory?.physicalRamBytesReportedByOs) ? `${(inventory.physicalRamBytesReportedByOs / 1073741824).toFixed(2)} GiB` : '—' }}</strong></div>
      <div class="cap-row"><span>Android / WebView</span><strong>{{ inventory ? `${inventory.androidRelease} / ${inventory.webViewVersion}` : 'Pendiente' }}</strong></div>
      <div class="cap-row"><span>Sensores</span><strong>{{ inventory?.sensors?.length ?? '—' }}</strong></div>
      <div class="cap-row"><span>Cámaras</span><strong>{{ inventory?.cameras?.length ?? '—' }}</strong></div>
      <div class="cap-row"><span>Permiso de cámara</span><strong>{{ inventory?.cameraPermission ?? '—' }}</strong></div>
      <div class="cap-row"><span>ARCore</span><strong>{{ summary.arSupport }}</strong></div>
      <div class="cap-row"><span>Orientación</span><strong>{{ summary.rotation3DoF }}</strong></div>
      <div class="cap-row"><span>Pose AR</span><strong>{{ summary.arPose }}</strong></div>
      <div class="cap-row"><span>Desplazamiento AR observado</span><strong>{{ summary.maxDisplacementMetersFromFirstTrackingSample == null ? '—' : `${summary.maxDisplacementMetersFromFirstTrackingSample.toFixed(3)} m` }}</strong></div>
      <details v-if="inventory?.sensors?.length" class="cap-details"><summary>Ver sensores detectados</summary>
        <ul><li v-for="sensor in inventory.sensors" :key="`${sensor.type}-${sensor.name}`">{{ sensor.name }} · {{ sensor.stringType }}</li></ul>
      </details>
      <details v-if="inventory?.cameras?.length" class="cap-details"><summary>Ver cámaras detectadas</summary>
        <ul><li v-for="camera in inventory.cameras" :key="camera.id">Cámara {{ camera.id }} · {{ camera.facing }}</li></ul>
      </details>
      <p v-if="inventory?.cameraEnumerationError" class="cap-error">Error al consultar cámaras: {{ inventory.cameraEnumerationError }}</p>
    </section>
    <section class="cap-panel">
      <h2>Pruebas autorizadas</h2>
      <p>Primero consulta capacidades, después toma una muestra girando suavemente el teléfono. La prueba AR se habilita únicamente si Android confirma el servicio instalado y el permiso de cámara.</p>
      <div class="cap-actions">
        <button :disabled="!!busy || !native()" @click="inspect">Actualizar inventario</button>
        <button :disabled="!!busy || !inventory" @click="sensorTest">Medir orientación (4 s)</button>
        <button :disabled="!!busy || !inventory || cameraGranted" @click="permission">Solicitar permiso cámara</button>
        <button v-if="arAvailability?.supportedByService && arAvailability?.availability !== 'SUPPORTED_INSTALLED'" :disabled="!!busy" @click="arInstall">Instalar servicio AR (consentimiento)</button>
        <button :disabled="!!busy || arAvailability?.availability !== 'SUPPORTED_INSTALLED' || !cameraGranted" @click="poseTest">Probar pose AR (5 s)</button>
        <button :disabled="!!busy || !inventory" class="cap-primary" @click="exportJson">Guardar/compartir informe JSON</button>
      </div>
      <p v-if="busy" class="cap-status" role="status">{{ busy }}…</p>
      <p v-if="error" class="cap-error" role="alert">{{ error }}</p>
    </section>
    <section class="cap-panel">
      <h2>Viabilidad S01A · referencias visuales</h2>
      <p>Experimento de cámara física, no control del FilmMaker. Imprime el marcador AprilTag de 120 mm y la cuadrícula de calibración con escala 1:1; comprueba sus medidas con una regla. Fotografía desde distintas distancias y ángulos, con luz suficiente y sin caminar mirando la pantalla.</p>
      <p>La cámara nativa solicita lente trasera, pero el fabricante puede ignorar esa preferencia. Verifica manualmente que no está seleccionada la cámara frontal. El análisis métrico se realizará fuera de línea en el PC.</p>
      <div class="cap-row"><span>Imágenes temporales</span><strong>{{ visualFrames.length }} / {{ VISUAL_FRAME_LIMIT }}</strong></div>
      <label class="cap-field-label" for="visual-stage">Tipo de captura</label>
      <select id="visual-stage" v-model="visualStage" :disabled="!!busy" class="cap-field">
        <option v-for="stage in VISUAL_STAGE_IDS" :key="stage" :value="stage">{{ stage }}</option>
      </select>
      <div class="cap-actions">
        <button :disabled="!!busy || !native() || !cameraGranted || visualFrames.length >= VISUAL_FRAME_LIMIT" @click="captureVisualFrame">Abrir cámara y tomar fotografía</button>
        <button class="cap-primary" :disabled="!!busy || visualFrames.length === 0" @click="exportVisualArchive">Compartir ZIP de capturas S01A</button>
        <button :disabled="!!busy || visualFrames.length === 0" @click="discardVisualFrames">Descartar capturas temporales</button>
      </div>
      <details v-if="visualFrames.length" class="cap-details"><summary>Ver nombres de fotografías</summary>
        <ul><li v-for="frame in visualFrames" :key="frame.filename">{{ frame.filename }} · {{ frame.width }} × {{ frame.height }}</li></ul>
      </details>
      <p>Guardar capturas es voluntario. No se transmite nada por red ni se accede a películas del proyecto. Este experimento no asegura seguimiento en tiempo real.</p>
    </section>
    <section class="cap-panel">
      <h2>Interpretación</h2>
      <p>El sensor de rotación solo acredita orientación (3DoF). Un resultado ARCore TRACKING aporta muestras temporales de posición y orientación, pero no certifica todavía rodaje continuo 6DoF, calibración, colisiones ni grabación.</p>
      <p>Para la prueba AR, mantén despejada una zona segura, apunta a una superficie con textura y mueve el teléfono unos centímetros. No camines mirando esta pantalla: el monitor S02 todavía no acredita seguimiento 6DoF.</p>
      <ul v-if="history.length"><li v-for="(entry, index) in history" :key="index">{{ entry }}</li></ul>
    </section>
    </details>
  </main>
</template>

<style scoped>
/* FilmMaker oculta el scroll global: el monitor móvil conserva desplazamiento propio. */
.mobile-cap {
  box-sizing: border-box;
  height: 100vh;
  height: 100dvh;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  touch-action: pan-y;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
  background: #111519;
  color: #ecf0f3;
  padding: calc(env(safe-area-inset-top) + 22px) 18px calc(env(safe-area-inset-bottom) + 26px);
  max-width: 900px;
  margin: auto;
  font-family: 'IBM Plex Sans', sans-serif;
}
.mobile-screen { position:relative; width:100%; aspect-ratio:16/9; max-height:52dvh; background:#030509; border:1px solid #526679; border-radius:10px; display:flex; align-items:center; justify-content:center; overflow:hidden; }
.mobile-screen video { width:100%; height:100%; object-fit:contain; background:#000; }
.mobile-screen-status { position:absolute; left:0; right:0; bottom:12px; text-align:center; pointer-events:none; background:rgba(0,0,0,.5); color:#fff !important; margin:0; padding:7px; }
.mobile-diagnostics > summary { cursor:pointer; background:#252f38; border-radius:10px; color:#dde8f3; padding:14px; margin-bottom:14px; }
.mobile-head { margin-bottom:22px; }
.eyebrow { color:#9fb5c4; text-transform:uppercase; letter-spacing:.11em; font-size:11px; font-weight:600; }
.mobile-head h1 { font-size:25px; letter-spacing:-.04em; margin:8px 0; }
.mobile-head p { color:#adbac4; line-height:1.5; }
.cap-panel { background:#1c232a; border:1px solid #37424d; border-radius:13px; padding:18px; margin-bottom:14px; }
.cap-panel h2 { font-size:16px; margin:0 0 10px; }
.cap-panel p { font-size:13px; line-height:1.55; color:#bdc8d1; }
.cap-row { display:flex; justify-content:space-between; flex-wrap:wrap; gap:6px 16px; border-bottom:1px solid #333e48; padding:10px 0; font-size:13px; }
.cap-row:last-child { border:0; }
.cap-row span { color:#a9bac7; }
.cap-row strong { font-size:12px; font-weight:600; max-width:64%; text-align:right; overflow-wrap:anywhere; }
.cap-actions { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:10px; margin-top:16px; }
button { background:#2b3945; color:#eff7ff; border:1px solid #526679; padding:12px; border-radius:8px; font:inherit; font-size:13px; text-align:left; cursor:pointer; }
button:focus-visible { outline:2px solid #c9e7ff; outline-offset:2px; }
button:disabled { opacity:.4; cursor:not-allowed; }
.cap-primary { background:#235f8a; border-color:#397fae; }
.cap-field-label { display:block; margin:12px 0 6px; color:#c1d5e3; font-size:12px; }
.cap-field { width:100%; padding:10px; border-radius:8px; background:#2b3945; color:#eff7ff; border:1px solid #526679; font:inherit; font-size:13px; }
.cap-error { color:#ffabb2 !important; }
.cap-status { color:#a8ddfb !important; }
.cap-details { margin-top:12px; font-size:13px; color:#c1d5e3; }
.cap-details summary { cursor:pointer; padding:8px 0; }
ul { padding-left:20px; font-size:12px; color:#aebcc7; overflow-wrap:anywhere; }
</style>
