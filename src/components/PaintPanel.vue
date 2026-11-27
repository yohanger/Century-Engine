<script setup>
// Panel «Pintura» (dock derecho, mientras se pinta en un sprite con Tab): las herramientas de dibujo de pixel art, como las de
// LibreSprite — lápiz, borrador, cubo, cuentagotas, línea, rectángulo, elipse y spray —, colores principal y secundario, paleta
// DB32, tamaño del pincel, pixel perfect, simetría, tolerancia del cubo y rellenar formas.
import { computed, ref } from 'vue'
import { store } from '../core/store.js'
import { TOOLS, PALETTE_DB32 } from '../core/paint/tools.js'

const P = store.paint
const s = () => store.editor?.paint
const GLYPH = { pencil: '✎', eraser: '⌫', bucket: '▧', picker: '⊙', line: '╱', rect: '▭', ellipse: '◯', spray: '⁘' }
const shape = computed(() => ['rect', 'ellipse'].includes(P.tool))
const sized = computed(() => ['pencil', 'eraser', 'line', 'rect', 'spray'].includes(P.tool))
const name = computed(() => store.project.objects.find((o) => o.id === P.objId)?.name || '')
const hex6 = (c) => String(c || '#000000').slice(0, 7)
const active = computed(() => P.layers.find((L) => L.id === P.activeLayer) || null)
const renaming = ref(null) // doble clic en el nombre de una capa: renombrar
</script>

<template>
  <div class="pp" data-testid="paint-panel">
    <section class="sect">
      <header>Pintar · {{ name }}</header>
      <div class="body">
        <p class="dim">{{ P.w }}×{{ P.h }} px<template v-if="P.px"> · cursor {{ P.px[0] }}, {{ P.px[1] }}</template></p>
        <div class="tools" role="toolbar" aria-label="Herramientas de dibujo">
          <button v-for="[k, label, key] in TOOLS" :key="k" :class="{ on: P.tool === k }" :data-tool="k" :aria-label="label" @click="P.tool = k">
            <i>{{ GLYPH[k] }}</i><span>{{ label }}</span><kbd>{{ key }}</kbd>
          </button>
        </div>
      </div>
    </section>

    <section class="sect">
      <header>Color</header>
      <div class="body">
        <div class="cols">
          <label class="sw"><ColorInput :value="hex6(P.color)" data-testid="paint-color" @input="P.color = $event.target.value" /><span>Principal</span></label>
          <button class="swap" aria-label="Intercambiar colores (X)" @click="[P.color, P.color2] = [P.color2, P.color]">⇄</button>
          <label class="sw"><ColorInput :value="hex6(P.color2)" @input="P.color2 = $event.target.value" /><span>Secundario (Ctrl + clic)</span></label>
        </div>
        <div class="pal" aria-label="Paleta DB32">
          <button v-for="c in PALETTE_DB32" :key="c" :style="{ background: c }" :class="{ on: hex6(P.color) === c }" :aria-label="c" @click="P.color = c" @contextmenu.prevent="P.color2 = c"></button>
        </div>
        <p class="dim lf-help">Clic: principal · clic derecho: secundario · Alt + clic en el sprite: cuentagotas</p>
      </div>
    </section>

    <section class="sect">
      <header>Pincel</header>
      <div class="body grid">
        <template v-if="sized"><label>Tamaño</label><div class="row"><input type="range" min="1" max="32" :value="P.size" @input="P.size = +$event.target.value" /><b>{{ P.size }} px</b></div></template>
        <template v-if="P.tool === 'pencil' || P.tool === 'eraser'"><label>Pixel perfect</label><input type="checkbox" v-model="P.pixelPerfect" /></template>
        <template v-if="shape"><label>Rellenar</label><input type="checkbox" v-model="P.fill" /></template>
        <template v-if="P.tool === 'bucket'">
          <label>Tolerancia</label><div class="row"><input type="range" min="0" max="255" :value="P.tolerance" @input="P.tolerance = +$event.target.value" /><b>{{ P.tolerance }}</b></div>
          <label>Contiguo</label><input type="checkbox" v-model="P.contiguous" />
        </template>
        <label>Simetría horizontal</label><input type="checkbox" v-model="P.symX" />
        <label>Simetría vertical</label><input type="checkbox" v-model="P.symY" />
      </div>
    </section>

    <!-- capas: se pinta en la activa; el sprite muestra las visibles, de abajo arriba -->
    <section class="sect" data-testid="paint-layers">
      <header>Capas <span class="dim">{{ P.layers.length }}</span></header>
      <div class="body">
        <ul class="layers">
          <li v-for="L in P.layers" :key="L.id" :class="{ on: L.id === P.activeLayer }" :data-layer="L.name" @click="s()?.selectLayer(L.id)">
            <button class="eye" :class="{ off: !L.visible }" :aria-label="L.visible ? 'Ocultar capa' : 'Mostrar capa'" @click.stop="s()?.setLayer(L.id, { visible: !L.visible })">{{ L.visible ? '◉' : '○' }}</button>
            <input v-if="renaming === L.id" class="nm" :value="L.name" maxlength="40" @click.stop @change="s()?.setLayer(L.id, { name: $event.target.value }); renaming = null" @blur="renaming = null" @keydown.enter="$event.target.blur()" />
            <span v-else class="nm" @dblclick.stop="renaming = L.id">{{ L.name }}</span>
            <span class="op dim">{{ Math.round(L.opacity * 100) }}%</span>
          </li>
        </ul>
        <div v-if="active" class="row opr"><span>Opacidad</span><input type="range" min="0" max="1" step="0.05" :value="active.opacity" data-testid="layer-opacity" @input="s()?.setLayer(active.id, { opacity: +$event.target.value })" /></div>
        <div class="lbtns">
          <button data-testid="layer-add" aria-label="Capa nueva" @click="s()?.addLayer()">＋</button>
          <button aria-label="Duplicar capa" @click="s()?.duplicateLayer()">⧉</button>
          <button aria-label="Subir capa" :disabled="!active || active.index >= P.layers.length - 1" @click="s()?.moveLayer(1)">▲</button>
          <button aria-label="Bajar capa" :disabled="!active || active.index <= 0" @click="s()?.moveLayer(-1)">▼</button>
          <button aria-label="Fusionar con la de abajo" :disabled="!active || active.index <= 0" data-testid="layer-merge" @click="s()?.mergeDown()">⤓ Fusionar</button>
          <button class="danger" aria-label="Borrar capa" :disabled="P.layers.length <= 1" data-testid="layer-delete" @click="s()?.deleteLayer()">✕</button>
        </div>
      </div>
    </section>

    <section class="sect">
      <header>Imagen</header>
      <div class="body btns">
        <button :disabled="!P.canUndo" @click="s()?.undo()">↶ Deshacer</button>
        <button :disabled="!P.canRedo" @click="s()?.redo()">↷ Rehacer</button>
        <button @click="s()?.clear()">Limpiar</button>
        <button data-testid="paint-save" @click="s()?.save()">Guardar imagen</button>
        <button class="primary" data-testid="paint-exit" @click="store.editor?.exitPaint()">Salir (Tab)</button>
      </div>
      <p class="dim pad lf-help">Mayús con línea, rectángulo o elipse: 45° / proporción 1:1. [ y ] cambian el tamaño. Lo pintado se guarda en la imagen del proyecto al salir.</p>
    </section>
  </div>
</template>

<style scoped>
.pp { display: flex; flex-direction: column; }
.dim { margin: 0 0 6px; font-size: 11px; color: var(--text-3); }
.pad { padding: 0 12px 10px; }
.tools { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px; }
.tools button { justify-content: flex-start; gap: 6px; height: 28px; padding: 0 8px; font-size: 12px; }
.tools button i { font-style: normal; width: 16px; text-align: center; font-size: 14px; }
.tools button span { flex: 1; text-align: left; }
.tools button kbd { font-size: 10px; opacity: .6; }
.tools button.on { background: var(--blue); border-color: var(--blue); color: #fff; }
.cols { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.sw { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 10.5px; color: var(--text-3); }
.sw :deep(.lf-color-input) { width: 46px; height: 30px; padding: 1px; }
.swap { width: 26px; height: 26px; padding: 0; }
.pal { display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; margin-bottom: 6px; }
.pal button { height: 18px; padding: 0; border: 1px solid rgba(0, 0, 0, .5); border-radius: 2px; min-width: 0; }
.pal button.on { outline: 2px solid #fff; outline-offset: -1px; }
.grid { display: grid; grid-template-columns: 130px 1fr; gap: 6px 8px; align-items: center; font-size: 12px; }
.grid label { color: var(--text-2); }
.row { display: flex; align-items: center; gap: 6px; } .row input { flex: 1; min-width: 0; } .row b { font-weight: 500; font-size: 11px; min-width: 38px; }
.btns { display: flex; flex-wrap: wrap; gap: 6px; }
.btns button { height: 26px; padding: 0 10px; }
.layers { list-style: none; margin: 0 0 6px; padding: 2px; border: 1px solid var(--hair); border-radius: 5px; max-height: 180px; overflow: auto; display: flex; flex-direction: column; gap: 1px; }
.layers li { display: flex; align-items: center; gap: 6px; height: 24px; padding: 0 6px; border-radius: 4px; cursor: pointer; font-size: 12px; color: var(--text-2); }
.layers li:hover { background: var(--g-800); } .layers li.on { background: var(--blue-wash); color: var(--text); box-shadow: inset 2px 0 0 var(--blue); }
.layers .eye { width: 20px; height: 20px; padding: 0; border: 0; background: transparent; color: var(--text-2); font-size: 12px; }
.layers .eye.off { opacity: .45; }
.layers .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.layers input.nm { height: 20px; font-size: 12px; }
.layers .op { font-size: 10.5px; margin: 0; font-variant-numeric: tabular-nums; }
.opr { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--text-2); margin-bottom: 6px; } .opr input { flex: 1; }
.lbtns { display: flex; flex-wrap: wrap; gap: 4px; } .lbtns button { height: 24px; min-width: 28px; padding: 0 7px; font-size: 12px; }
.lbtns .danger:hover:not(:disabled) { color: #ff6b5e; }
</style>
