<script setup>
// Inspector de un Sprite 3D / Sprite 2D (nodes/sprite.js): imagen, tamaño, filtro, volteo, tinte y, en el 3D, mirar a la cámara.
// «Pintar (Tab)» entra a pintar en la imagen; «Lienzo en blanco» le pone una imagen nueva del tamaño elegido.
import { computed, ref } from 'vue'
import { store, updateObject, newBlankImage, getObject } from '../core/store.js'
import { normalizeSprite, BILLBOARD, FILTERS, sprite2dScreen } from '../engine/runtime/nodes/sprite.js'
import ImageField from './ImageField.vue'
import NumberField from './NumberField.vue'
import Icon from './Icon.vue'
import PropertyKey from './PropertyKey.vue'

const props = defineProps({ obj: { type: Object, required: true }, keyable: {type: Function, required: true}, marked:{type:Function,required:true} })
const emit = defineEmits(['insert-key'])
const keyId = key => `${props.obj.type}.${key}`
const two = computed(() => props.obj.type === 'sprite2d')
const p = computed(() => normalizeSprite(props.obj.props, two.value))
const upd = (patch, commit = true) => updateObject(props.obj.id, { props: patch }, { commit })
const tint = (v, commit) => updateObject(props.obj.id, { color: v }, { commit })
// La cuadrícula se mide sobre la imagen: (0,0) arriba a la izquierda, (1,1) abajo a la derecha.
const pivotPresets = [
  [0, 0], [0.5, 0], [1, 0],
  [0, 0.5], [0.5, 0.5], [1, 0.5],
  [0, 1], [0.5, 1], [1, 1],
]
const pivotNames = ['Superior izquierda', 'Superior centro', 'Superior derecha', 'Centro izquierda', 'Centro', 'Centro derecha', 'Inferior izquierda', 'Inferior centro', 'Inferior derecha']
const pivotSet = ([pivotX, pivotY]) => upd({ pivotX, pivotY })
const nw = ref(64), nh = ref(64)
function blank() {
  const id = newBlankImage(`${props.obj.name || 'Lienzo'}.png`, Math.max(1, Math.min(2048, nw.value | 0)), Math.max(1, Math.min(2048, nh.value | 0)))
  upd({ image: id, filter: 'pixel' })
}
const screen = computed(() => (two.value ? sprite2dScreen(props.obj, getObject(props.obj.parentId)?.type === 'canvas' ? getObject(props.obj.parentId) : null) : null))
</script>

<template>
  <section class="sect" data-testid="sprite-section">
    <header><Icon name="image" :size="13" /> {{ two ? 'Sprite 2D' : 'Sprite 3D' }}</header>
    <div class="body">
      <div class="field col"><label>Imagen</label><ImageField :model-value="p.image" @update:model-value="upd({ image: $event })" /><PropertyKey v-if="keyable(keyId('image'))" label="Imagen" :available="true" :marked="marked(keyId('image'))" @insert="emit('insert-key',keyId('image'))" /></div>
      <div class="field"><label></label><button class="primary" data-testid="sprite-paint" @click="store.editor?.enterPaint(obj.id)"><Icon name="brush" :size="12" /> Pintar (Tab)</button></div>
      <div class="field"><label>Lienzo en blanco</label><div class="row"><input type="number" min="1" max="2048" v-model.number="nw" /><span>×</span><input type="number" min="1" max="2048" v-model.number="nh" /><button @click="blank">Crear</button></div></div>
      <template v-if="!two">
        <div class="field"><label>Tamaño del píxel (m)</label><NumberField :model-value="p.pixelSize" :step="0.001" :min="0.0001" @update:model-value="upd({ pixelSize: $event }, false)" @commit="upd({}, true)" /><PropertyKey v-if="keyable(keyId('pixelSize'))" label="Tamaño del píxel (m)" :available="true" :marked="marked(keyId('pixelSize'))" @insert="emit('insert-key',keyId('pixelSize'))" /></div>
        <div class="field col sprite-pivot" data-testid="sprite3d-pivot">
          <label>Pivote (normalizado 0–1)</label>
          <div class="pivot-controls">
            <div class="pivot-presets" role="group" aria-label="Posiciones del pivote">
              <button v-for="(pos, index) in pivotPresets" :key="index" type="button" class="pivot-preset"
                :class="{ active: p.pivotX === pos[0] && p.pivotY === pos[1] }"
                :title="pivotNames[index]" :aria-label="pivotNames[index]"
                :aria-pressed="p.pivotX === pos[0] && p.pivotY === pos[1]"
                @click="pivotSet(pos)"><span class="pivot-point"></span></button>
            </div>
            <div class="pivot-values">
              <div class="field"><label>X</label><NumberField :model-value="p.pivotX" :step="0.05" :min="0" :max="1" :decimals="3" @update:model-value="upd({ pivotX: $event }, false)" @commit="upd({}, true)" /><PropertyKey v-if="keyable(keyId('pivotX'))" label="Pivote X" :available="true" :marked="marked(keyId('pivotX'))" @insert="emit('insert-key',keyId('pivotX'))" /></div>
              <div class="field"><label>Y</label><NumberField :model-value="p.pivotY" :step="0.05" :min="0" :max="1" :decimals="3" @update:model-value="upd({ pivotY: $event }, false)" @commit="upd({}, true)" /><PropertyKey v-if="keyable(keyId('pivotY'))" label="Pivote Y" :available="true" :marked="marked(keyId('pivotY'))" @insert="emit('insert-key',keyId('pivotY'))" /></div>
            </div>
          </div>
          <span class="hint pivot-hint">(0, 0) superior izquierda · (0.5, 1) centro inferior</span>
        </div>
        <div class="field"><label>Mirar a la cámara</label><select :value="p.billboard" @change="upd({ billboard: $event.target.value })"><option v-for="[k, l] in BILLBOARD" :key="k" :value="k">{{ l }}</option></select><PropertyKey v-if="keyable(keyId('billboard'))" label="Mirar a la cámara" :available="true" :marked="marked(keyId('billboard'))" @insert="emit('insert-key',keyId('billboard'))" /></div>
        <div class="field"><label>Sin sombreado</label><input type="checkbox" :checked="p.unshaded" @change="upd({ unshaded: $event.target.checked })" /><PropertyKey v-if="keyable(keyId('unshaded'))" label="Sin sombreado" :available="true" :marked="marked(keyId('unshaded'))" @insert="emit('insert-key',keyId('unshaded'))" /></div>
        <div class="field"><label>Visible por detrás</label><input type="checkbox" :checked="p.doubleSided" @change="upd({ doubleSided: $event.target.checked })" /><PropertyKey v-if="keyable(keyId('doubleSided'))" label="Visible por detrás" :available="true" :marked="marked(keyId('doubleSided'))" @insert="emit('insert-key',keyId('doubleSided'))" /></div>
        <div class="field"><label>Recorte de transparencia</label><NumberField :model-value="p.alphaCut" :step="0.05" :min="0" :max="1" @update:model-value="upd({ alphaCut: $event }, false)" @commit="upd({}, true)" /><PropertyKey v-if="keyable(keyId('alphaCut'))" label="Recorte de transparencia" :available="true" :marked="marked(keyId('alphaCut'))" @insert="emit('insert-key',keyId('alphaCut'))" /></div>
      </template>
      <div v-else class="field"><label>Capa</label><NumberField :model-value="p.layer" :step="1" @update:model-value="upd({ layer: $event }, false)" @commit="upd({}, true)" /><PropertyKey v-if="keyable(keyId('layer'))" label="Capa" :available="true" :marked="marked(keyId('layer'))" @insert="emit('insert-key',keyId('layer'))" /></div>
      <div class="field"><label>Filtro</label><select :value="p.filter" @change="upd({ filter: $event.target.value })"><option v-for="[k, l] in FILTERS" :key="k" :value="k">{{ l }}</option></select><PropertyKey v-if="keyable(keyId('filter'))" label="Filtro" :available="true" :marked="marked(keyId('filter'))" @insert="emit('insert-key',keyId('filter'))" /></div>
      <div class="field"><label>Voltear</label><div class="row"><label class="ck"><input type="checkbox" :checked="p.flipX" @change="upd({ flipX: $event.target.checked })" /> X</label><label class="ck"><input type="checkbox" :checked="p.flipY" @change="upd({ flipY: $event.target.checked })" /> Y</label></div><PropertyKey v-if="keyable(keyId('flipX'))" label="Voltear X" :available="true" :marked="marked(keyId('flipX'))" @insert="emit('insert-key',keyId('flipX'))" /><PropertyKey v-if="keyable(keyId('flipY'))" label="Voltear Y" :available="true" :marked="marked(keyId('flipY'))" @insert="emit('insert-key',keyId('flipY'))" /></div>
      <div v-if="!two" class="field"><label>Tinte</label><ColorInput :value="obj.color || '#ffffff'" @input="tint($event.target.value, false)" @change="tint($event.target.value, true)" /><PropertyKey v-if="keyable(keyId('color'))" label="Tinte" :available="true" :marked="marked(keyId('color'))" @insert="emit('insert-key',keyId('color'))" /></div>
      <p v-if="two && screen" class="hint">En pantalla: centro en {{ Math.round(screen.x) }}, {{ Math.round(screen.y) }} px de {{ screen.refW }}×{{ screen.refH }} (Canvas). Muévelo en el visor sobre el rectángulo del Canvas.</p>
      <p v-else class="hint lf-help">El tamaño sale de la imagen: ancho = píxeles × tamaño del píxel. La posición del nodo es el pivote que elijas (por defecto, centro inferior). Para un plano de referencia, gíralo 90° en X y ajusta el tamaño del píxel a la escala del dibujo.</p>
    </div>
  </section>
</template>

<style scoped>
.field.col { flex-direction: column; align-items: stretch; gap: 4px; }
.row { display: flex; align-items: center; gap: 6px; min-width: 0; }
.row input[type=number] { width: 64px; }
.ck { display: flex; align-items: center; gap: 4px; }
.sprite-pivot { align-items: stretch; }
.pivot-controls { display: flex; align-items: center; gap: 10px; min-width: 0; flex-wrap: wrap; }
.pivot-presets { flex: 0 0 84px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; }
.pivot-preset { height: 25px; min-width: 0; padding: 0; display: flex; justify-content: center; align-items: center; border: 1px solid var(--hair); border-radius: 3px; }
.pivot-preset.active { border-color: var(--blue); background: color-mix(in srgb, var(--blue) 18%, transparent); }
.pivot-point { width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: .55; }
.pivot-preset.active .pivot-point { background: var(--blue); opacity: 1; }
.pivot-values { display: flex; flex: 1 1 100px; min-width: 0; flex-direction: column; gap: 4px; }
.pivot-values .field { min-width: 0; gap: 8px; }
.pivot-values .field > label { flex: 0 0 12px; }
.pivot-hint { display: block; margin-top: 2px; }
</style>
