<script setup>
// Actor: el personaje que interpretas, el contacto con el entorno y la pasada del actor (grabar tomas).
import { ref, computed } from 'vue'
import { store, toast, captureRigInfo } from '../../core/store.js'
import { pickFile } from '../../engine/runtime/util.js'
import * as F from '../session.js'

const { session } = F
const film = computed(() => session.film)
const actors = computed(() => (store.project?.objects || []).filter((o) => o.modelId))
const actorRig = computed(() => { const o = actors.value.find((a) => a.id === film.value?.actor.objectId); return o ? captureRigInfo(o.modelId) : null })
const src = ref('camera'), facing = ref('environment')
const setActor = (patch) => { session.film = { ...session.film, actor: { ...session.film.actor, ...patch } } }
function pick(e) { const o = actors.value.find((a) => a.id === e.target.value); setActor({ objectId: o?.id || '', modelId: o?.modelId || '' }); if (o) store.editor.focus(o.id) }
async function liveOn() {
  try {
    if (src.value === 'video') { const [f] = await pickFile('video/*'); if (!f) return; await F.startLive('video', { file: f }) }
    else await F.startLive(src.value, { facing: facing.value })
  } catch (e) { toast(e.message || String(e), 'error', 6000) }
}
async function delTake(i) { const { askConfirm } = await import('../../core/dialogs.js'); if (await askConfirm(`¿Borrar «${film.value.takes[i].name}»?`, { ok: 'Borrar', danger: true })) F.deleteTake(i) }
function resolveAll() { const n = F.resolveAllTakes(); toast(`Contacto recalculado en ${n} toma(s)`, 'ok') }
defineExpose({ facing })
</script>

<template>
  <section class="pn">
    <label class="f">Personaje
      <select :value="film.actor.objectId" data-test="actor" @change="pick">
        <option value="">(elige un nodo con modelo)</option>
        <option v-for="o in actors" :key="o.id" :value="o.id">{{ o.name }}</option>
      </select>
    </label>
    <p v-if="!actors.length" class="hint warn">La escena no tiene ningún modelo. Añade el personaje (.glb con esqueleto) en Century y sustituye la escena.</p>
    <p v-else-if="actorRig?.ok" class="hint ok">✓ Esqueleto humanoide ({{ actorRig.bones }} huesos) <a v-if="film.actor.objectId" href="#" @click.prevent="store.editor.focus(film.actor.objectId)">Encuadrar</a></p>
    <p v-else-if="actorRig" class="hint warn">{{ actorRig.bones ? 'No reconozco el esqueleto humanoide' : 'Ese modelo no tiene huesos' }} (faltan: {{ actorRig.missing.join(', ') }})</p>
    <template v-if="actorRig?.ok">
      <h4>Contacto con el entorno</h4>
      <label class="chk"><input type="checkbox" :checked="film.actor.contact" data-test="contact" @change="setActor({ contact: $event.target.checked })" /> Choca con el entorno (manos, pies y dedos)</label>
      <label class="chk"><input type="checkbox" :checked="film.actor.hands" data-test="hands" @change="setActor({ hands: $event.target.checked })" /> Seguir los dedos con la cámara (más lento)</label>
      <label class="f">Agarre mano izquierda <span class="row"><input type="range" min="0" max="1" step="0.05" :value="film.actor.grip.L" @input="setActor({ grip: { ...film.actor.grip, L: +$event.target.value } })" /><b>{{ Math.round(film.actor.grip.L * 100) }} %</b></span></label>
      <label class="f">Agarre mano derecha <span class="row"><input type="range" min="0" max="1" step="0.05" :value="film.actor.grip.R" @input="setActor({ grip: { ...film.actor.grip, R: +$event.target.value } })" /><b>{{ Math.round(film.actor.grip.R * 100) }} %</b></span></label>
      <button v-if="film.takes.length && film.actor.contact" data-test="resolve" @click="resolveAll">Recalcular el contacto de las tomas</button>
      <h4>Pasada del actor</h4>
      <div class="seg"><button v-for="[k, l] in [['camera', 'Cámara'], ['video', 'Vídeo'], ['sim', 'Simulado']]" :key="k" :class="{ on: src === k }" :data-test="'src-' + k" @click="src = k">{{ l }}</button></div>
      <label v-if="src === 'camera'" class="f">Cámara <select v-model="facing"><option value="environment">Trasera (el móvil te graba)</option><option value="user">Frontal / webcam</option></select></label>
      <div class="row">
        <button v-if="!session.live.on" class="primary" data-test="live-on" @click="liveOn">{{ src === 'video' ? 'Elegir vídeo…' : 'Encender' }}</button>
        <button v-else data-test="live-off" @click="F.stopLive()">Apagar</button>
        <span v-if="session.live.on" class="hint">{{ session.live.fps }} fps · {{ session.live.calibrated ? '✓ calibrado' : 'ponte de frente…' }}</span>
      </div>
      <template v-if="session.live.on">
        <button v-if="session.rec.state === 'idle'" class="rec" data-test="rec" @click="F.startRecording()">● Grabar toma</button>
        <button v-else class="rec on" data-test="rec-stop" @click="F.stopRecording()">{{ session.rec.state === 'countdown' ? `Cancelar (${session.rec.count})` : `■ Parar · ${session.rec.t.toFixed(1)} s · ${session.rec.frames} fot.` }}</button>
      </template>
      <p v-if="session.live.error" class="hint warn">{{ session.live.error }}</p>
    </template>
    <h4>Tomas ({{ film.takes.length }})</h4>
    <ul class="list takes" data-test="takes">
      <li v-for="(t, i) in film.takes" :key="t.id || i">
        <input :value="t.name" @change="F.renameTake(i, $event.target.value)" />
        <small>{{ F.takeDuration(t).toFixed(1) }} s</small>
        <button :title="session.playback.index === i ? 'Parar' : 'Ver la toma en el nivel'" :data-test="'take-play-' + i" @click="session.playback.index === i ? F.stopPlayback() : F.playTake(i)">{{ session.playback.index === i ? '■' : '▶' }}</button>
        <button title="Borrar la toma" @click="delTake(i)">✕</button>
      </li>
    </ul>
    <p v-if="!film.takes.length" class="hint">Aún no hay tomas.</p>
  </section>
</template>
