<script setup>
// Cámara: quién filma (persona o máquina) y la pasada del camarógrafo (grabar pases de cámara).
import { ref, computed } from 'vue'
import { store, toast } from '../../core/store.js'
import { OPERATORS, RIGS } from '../film.js'
import * as F from '../session.js'

const props = defineProps({ narrow: Boolean, mobileLink: Object })
const emit = defineEmits(['recording'])
const { session } = F
const film = computed(() => session.film)
const camera = computed(() => F.selectedCamera())
const op = computed(() => camera.value?.operator)
const shakes = computed(() => F.availableCameraShakes())
const idle = computed(() => session.pass.state === 'idle' && session.view.index < 0 && !session.montage.on && !session.playing)
const action = (fn) => { try { fn() } catch (e) { toast(e.message || String(e), 'error', 5000) } }
const INPUTS = { mouse: 'Teclado + ratón / trackpad (PC)', sensors: 'Sensores del móvil + joystick', ar: 'AR: el móvil se mueve por el nivel' }
const passInput = ref('auto'), passTake = ref(-1), autoInput = ref('mouse')
F.bestInput().then((v) => { autoInput.value = v })
const effInput = computed(() => (passInput.value === 'auto' ? autoInput.value : passInput.value))
const inputHint = computed(() => ({
  mouse: store.prefs.navigation === 'trackpad'
    ? 'Laptop: dos dedos para mirar · pellizco = zoom · Mayús + dos dedos = desplazar · W A S D caminar.'
    : 'PC: arrastra para mirar · W A S D caminar (Mayús = correr) · Q / E bajar y subir (grúa) · rueda = zoom.',
  sensors: 'Gira el móvil para mirar · joystick para caminar · deslizador para agacharte · pellizca para zoom.',
  ar: 'Camina y agáchate con el móvil de verdad (ARCore): la cámara se mueve igual por el nivel.',
}[effInput.value]))
const setOp = (patch) => action(() => F.updateCameraOperator(patch))
function dragCamera(event, id) {
  if (!idle.value || !event.dataTransfer) { event.preventDefault(); return }
  event.dataTransfer.setData('application/x-lf-film-camera', id)
  event.dataTransfer.effectAllowed = 'copy'
}
async function start() {
  await props.mobileLink?.stop()
  emit('recording')
  try { await F.startPass({ input: effInput.value, take: passTake.value, overlay: document.querySelector('.fm') }) } catch (e) { toast(e.message || String(e), 'error', 6000) }
}
async function changeMonitorQuality(event) {
  try { await props.mobileLink?.setQuality(event.target.value) }
  catch (e) { event.target.value = props.mobileLink?.state.quality || 'equilibrado'; toast(e.message || String(e), 'error', 6000) }
}
async function delPass(i) { const { askConfirm } = await import('../../core/dialogs.js'); if (await askConfirm(`¿Borrar «${film.value.passes[i].name}»?`, { ok: 'Borrar', danger: true })) F.deletePass(i) }
</script>

<template>
  <section class="pn">
    <div class="fm-mobile-link" data-test="fm-mobile-link">
      <h4>Cámara móvil · Enlace LAN</h4>
      <p class="hint">Abre esta escena en FilmMaker y vincula un teléfono de la misma red Wi-Fi. El monitor recibe la cámara real de este visor; la rotación no graba tomas.</p>
      <template v-if="mobileLink?.state.phase === 'idle' || mobileLink?.state.phase === 'error'">
        <button type="button" data-test="mobile-link-start" :disabled="!film" @click="mobileLink.start().catch(e => toast(e.message || String(e), 'error', 6000))">Activar enlace</button>
      </template>
      <template v-else>
        <p class="hint" data-test="mobile-link-address">Dirección PC: <b>{{ mobileLink.state.address || 'Preparando…' }}</b></p>
        <p v-if="mobileLink.state.hosts?.length > 1" class="hint">Otras direcciones del PC: <code v-for="host in mobileLink.state.hosts.filter(h => h !== mobileLink.state.address)" :key="host">{{ host }} </code> (elige la de la red Wi-Fi compartida).</p>
        <p v-if="mobileLink.state.pin" class="hint" data-test="mobile-link-pin">Código de un solo uso: <b>{{ mobileLink.state.pin }}</b></p>
        <p class="hint">Estado: {{ mobileLink.state.phase }} · Vídeo: {{ mobileLink.state.videoFps }} fps / {{ mobileLink.state.bitrateKbps }} kb/s · Orientaciones: {{ mobileLink.state.orientationSamples }}</p>
        <label class="f" for="fm-monitor-quality">Calidad del monitor (independiente de la película)
          <select id="fm-monitor-quality" data-test="monitor-quality" :value="mobileLink.state.quality" :disabled="!['connected','monitor-stale'].includes(mobileLink.state.phase)" @change="changeMonitorQuality">
            <option v-for="(profile, key) in mobileLink.profiles" :key="key" :value="key">{{ profile.label }}</option>
          </select>
        </label>
        <p class="hint" data-test="monitor-quality-status">{{ mobileLink.state.qualityStatus }}</p>
        <p class="hint" data-test="monitor-pc-resources">Electron (todos sus procesos): CPU {{ mobileLink.state.cpuPercent == null ? '—' : `${mobileLink.state.cpuPercent.toFixed(1)} %` }} · RAM residente {{ mobileLink.state.memoryMiB == null ? '—' : `${mobileLink.state.memoryMiB.toFixed(0)} MiB` }}.</p>
        <button type="button" data-test="mobile-link-stop" @click="mobileLink.stop()">Desconectar móvil</button>
      </template>
      <p v-if="mobileLink?.state.error" class="hint warn" role="alert">{{ mobileLink.state.error }}</p>
    </div>
    <h4>Cámaras de producción ({{ film.cameras.length }})</h4>
    <label class="f">Cámara activa
      <select data-test="film-camera-select" :value="film.activeCameraId" :disabled="!idle" @change="action(() => F.selectCamera($event.target.value))">
        <option v-for="c in film.cameras" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>
    </label>
    <p class="hint lf-help">Guarda el encuadre de la cámara y arrástrala a la Timeline para crear un plano sin grabar.</p>
    <div class="film-direct-cameras" data-test="film-editorial-cameras">
      <div v-for="c in film.cameras" :key="c.id" class="film-direct-camera" :draggable="idle" :title="`Arrastrar ${c.name} a Timeline`" :data-test="'drag-film-camera-' + c.id" @dragstart="dragCamera($event,c.id)"><span>▣</span> {{ c.name }}</div>
    </div>
    <div class="row">
      <button data-test="film-camera-add" :disabled="!idle" @click="action(() => F.addCamera())">Nueva</button>
      <button data-test="film-camera-duplicate" :disabled="!idle" @click="action(() => F.addCamera({ duplicate: true }))">Duplicar</button>
      <button data-test="film-camera-delete" :disabled="!idle || film.cameras.length < 2" @click="action(() => F.deleteCamera(camera.id))">Eliminar</button>
    </div>
    <label class="f">Nombre
      <input :key="camera?.id" :value="camera?.name" :disabled="!idle" @change="action(() => F.renameCamera(camera.id, $event.target.value))" />
    </label>
    <button data-test="film-camera-save-pose" :disabled="!idle" @click="action(() => F.saveCameraPose())">Guardar encuadre de la vista</button>
    <template v-if="op">
      <div class="seg"><button v-for="(o, k) in OPERATORS" :key="k" :class="{ on: op.kind === k }" :data-test="'op-' + k" :disabled="!idle" @click="setOp({ kind: k })">{{ o.label }}</button></div>
      <p class="hint lf-help">{{ OPERATORS[op.kind].hint }}</p>
      <template v-if="op.kind === 'person'">
        <label class="f">Estatura <span class="row"><input type="range" min="0.5" max="2.5" step="0.01" :disabled="!idle" :value="op.height" @input="setOp({ height: +$event.target.value })" /><b>{{ op.height.toFixed(2) }} m</b></span></label>
        <label class="f">Pulso de la mano <span class="row"><input type="range" min="0" max="1" step="0.05" :disabled="!idle" :value="op.handheld" @input="setOp({ handheld: +$event.target.value })" /><b>{{ Math.round(op.handheld * 100) }} %</b></span></label>
      </template>
      <label v-else class="f">Soporte <select data-test="film-camera-rig" :disabled="!idle" :value="op.rig" @change="setOp({ rig: $event.target.value })"><option v-for="(l, k) in RIGS" :key="k" :value="k">{{ l }}</option></select></label>
      <label v-if="op.kind === 'person'" class="f">Estabilización <span class="row"><input type="range" min="0" max="1" step="0.05" :disabled="!idle" :value="op.stabilization" @input="setOp({ stabilization: +$event.target.value })" /><b>{{ Math.round(op.stabilization * 100) }} %</b></span></label>
      <label class="f">Velocidad (m/s) <span class="row"><input type="number" min="0.05" max="15" step="0.05" :disabled="!idle" :value="op.speed" @change="setOp({ speed: +$event.target.value })" /></span></label>
      <label class="f">Velocidad rápida (m/s) <input type="number" min="1" max="30" step="0.1" :disabled="!idle" :value="op.sprint" @change="setOp({ sprint: +$event.target.value })" /></label>
      <label class="f">Sensibilidad <input type="number" min="0.1" max="4" step="0.1" :disabled="!idle" :value="op.sensitivity" @change="setOp({ sensitivity: +$event.target.value })" /></label>
      <label class="f">Giro (°/s) <input type="number" min="10" max="360" step="5" :disabled="!idle" :value="op.turnSpeed" @change="setOp({ turnSpeed: +$event.target.value })" /></label>
      <label class="f">Aceleración (m/s²) <input type="number" min="0.2" max="30" step="0.5" :disabled="!idle" :value="op.acceleration" @change="setOp({ acceleration: +$event.target.value })" /></label>
      <label class="f">Frenado (m/s²) <input type="number" min="0.2" max="40" step="0.5" :disabled="!idle" :value="op.deceleration" @change="setOp({ deceleration: +$event.target.value })" /></label>
      <label class="f">Suavizado <span class="row"><input type="range" min="0" max="1" step="0.05" :disabled="!idle" :value="op.smooth" @input="setOp({ smooth: +$event.target.value })" /><b>{{ Math.round(op.smooth * 100) }} %</b></span></label>
      <template v-if="op.kind === 'machine' && op.rig === 'tripod'">
        <label class="f">Límite Pan (°) <input type="number" min="0" max="180" step="5" :disabled="!idle" :value="op.panLimit" @change="setOp({ panLimit: +$event.target.value })" /></label>
        <label class="f">Límite Tilt (°) <input type="number" min="5" max="89" step="5" :disabled="!idle" :value="op.tiltLimit" @change="setOp({ tiltLimit: +$event.target.value })" /></label>
      </template>
      <template v-if="op.kind === 'machine' && op.rig === 'dolly'">
        <p class="hint">Riel: {{ op.dolly.points.length }} puntos · Mueve la vista y captura los puntos en orden. W/S recorre el riel.</p>
        <div class="row"><button :disabled="!idle" data-test="film-dolly-point" @click="action(() => F.captureDollyPoint())">Añadir punto desde vista</button>
          <button :disabled="!idle || !op.dolly.points.length" @click="action(() => F.clearDolly())">Vaciar riel</button></div>
      </template>
      <template v-if="op.kind === 'machine' && op.rig === 'crane'">
        <label class="f">Brazo (m) <input type="number" min="0.5" max="25" step="0.25" :disabled="!idle" :value="op.crane.arm" @change="setOp({ crane: { arm: +$event.target.value } })" /></label>
        <label class="f">Giro inicial (°) <input type="number" min="-180" max="180" step="5" :disabled="!idle" :value="op.crane.yaw" @change="setOp({ crane: { yaw: +$event.target.value } })" /></label>
        <label class="f">Elevación inicial (°) <input type="number" min="-80" max="80" step="5" :disabled="!idle" :value="op.crane.elevation" @change="setOp({ crane: { elevation: +$event.target.value } })" /></label>
        <button :disabled="!idle" data-test="film-crane-pivot" @click="action(() => F.setCranePivotFromView())">Fijar pivote desde encuadre</button>
        <p class="hint">W/S = elevación · A/D = giro del brazo · Q/E = alcance · arrastrar = orientar cámara.</p>
      </template>
      <label class="f">Camera Shake Base
        <select data-test="film-shake-node" :disabled="!idle" :value="op.shake.nodeId" @change="setOp({ shake: { nodeId: $event.target.value } })">
          <option value="">Sin Camera Shake</option><option v-for="s in shakes" :key="s.id" :value="s.id">{{ s.name }}</option>
          <option v-if="op.shake.nodeId && !shakes.some(s => s.id === op.shake.nodeId)" :value="op.shake.nodeId">Referencia inexistente: {{ op.shake.nodeId }}</option>
        </select>
      </label>
      <label v-if="op.shake.nodeId" class="f">Intensidad de shake <input type="number" min="0" max="2" step="0.1" :disabled="!idle" :value="op.shake.intensity" @change="setOp({ shake: { intensity: +$event.target.value } })" /></label>
    </template>
    <h4>Pasada del camarógrafo</h4>
    <label class="f">Acompañar a la toma <select v-model.number="passTake" data-test="pass-take"><option :value="-1">(solo el entorno)</option><option v-for="(t, i) in film.takes" :key="i" :value="i">{{ t.name }}</option></select></label>
    <label class="f">Control <select v-model="passInput" data-test="pass-input"><option value="auto">Automático ({{ INPUTS[autoInput] }})</option><option v-for="(l, k) in INPUTS" :key="k" :value="k">{{ l }}</option></select></label>
    <p class="hint">{{ inputHint }}</p>
    <button v-if="session.pass.state === 'idle'" class="rec" data-test="pass-rec" @click="start">● Grabar pase de cámara</button>
    <button v-else class="rec on" data-test="pass-stop" @click="F.stopPass()">{{ session.pass.state === 'countdown' ? `Encuadra… ${session.pass.count}` : `■ Parar · ${session.pass.t.toFixed(1)} s · ${session.pass.keys} claves` }}</button>
    <p v-if="session.pass.error" class="hint warn">{{ session.pass.error }}</p>
    <h4>Pases de cámara ({{ film.passes.length }})</h4>
    <ul class="list takes" data-test="passes">
      <li v-for="(ps, i) in film.passes" :key="ps.id">
        <input :value="ps.name" @change="F.renamePass(i, $event.target.value)" />
        <small>{{ ps.duration.toFixed(1) }} s</small><select :value="ps.cameraId" :disabled="!idle" :aria-label="'Cámara de ' + ps.name" @change="action(() => F.reassignPassCamera(i, $event.target.value))">
          <option v-if="!film.cameras.some(c => c.id === ps.cameraId)" :value="ps.cameraId">Cámara no disponible</option>
          <option v-for="c in film.cameras" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <button :title="session.view.index === i ? 'Parar' : 'Ver por esta cámara'" :data-test="'pass-view-' + i" @click="session.view.index === i ? F.stopView() : F.viewPass(i)">{{ session.view.index === i ? '■' : '▶' }}</button>
        <button title="Borrar el pase" @click="delPass(i)">✕</button>
      </li>
    </ul>
    <p v-if="!film.passes.length" class="hint lf-help">Para crear un plano, arrastra una cámara a Timeline. «Grabar pase» captura un movimiento real opcional.</p>
  </section>
</template>
