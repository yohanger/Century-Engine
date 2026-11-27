<script setup>
// Gizmo de orientación (cruceta de ejes, como el de Unity): muestra hacia dónde mira la cámara y salta a vistas de eje.
import { finiteTuple } from '../engine/runtime/numeric-integrity.js'
import { computed } from 'vue'
import { store } from '../core/store.js'
import { run } from '../core/commands.js'

const R = 34, C = 48
const AX = [
  { n: 'X', v: [1, 0, 0], c: '#e5534b', view: 'right' }, { n: '-X', v: [-1, 0, 0], c: '#e5534b', view: 'left' },
  { n: 'Y', v: [0, 1, 0], c: '#6cc24a', view: 'top' }, { n: '-Y', v: [0, -1, 0], c: '#6cc24a', view: 'bottom' },
  { n: 'Z', v: [0, 0, 1], c: '#3b82f6', view: 'front' }, { n: '-Z', v: [0, 0, -1], c: '#3b82f6', view: 'back' },
]
// vector del mundo → espacio cámara: rotar por el inverso del cuaternión de la cámara
function toCam([x, y, z], [qx, qy, qz, qw]) {
  const ix = qw * x - qy * z + qz * y, iy = qw * y - qz * x + qx * z, iz = qw * z - qx * y + qy * x, iw = qx * x + qy * y + qz * z
  return [ix * qw + iw * qx + iy * qz - iz * qy, iy * qw + iw * qy + iz * qx - ix * qz, iz * qw + iw * qz + ix * qy - iy * qx]
}
const items = computed(() => {
  const q = store.viewQuat
  if (!finiteTuple(q, 4) || !Number.isFinite(Math.hypot(...q)) || Math.hypot(...q) === 0) return []
  return AX.map((a) => { const [x, y, z] = toCam(a.v, q); return { ...a, sx: C + x * R, sy: C - y * R, z, pos: !a.n.startsWith('-') } }).sort((a, b) => a.z - b.z)
})
const label = computed(() => (store.viewInfo.ortho ? (store.viewInfo.name ? '' : 'Iso') : 'Persp'))
</script>

<template>
  <div class="og" data-tooltip="Clic en un eje: vista · clic en el centro: perspectiva / ortográfica">
    <svg viewBox="0 0 96 96" width="96" height="96">
      <circle :cx="C" :cy="C" r="44" class="bg" />
      <g v-for="a in items" :key="a.n" class="ax" @click.stop="run('view.' + a.view)">
        <line v-if="a.pos" :x1="C" :y1="C" :x2="a.sx" :y2="a.sy" :stroke="a.c" stroke-width="2.5" stroke-linecap="round" />
        <circle :cx="a.sx" :cy="a.sy" :r="a.pos ? 9 : 6.5" :fill="a.pos ? a.c : 'rgba(30,30,30,.9)'" :stroke="a.c" stroke-width="1.5" :opacity="a.z < -0.2 ? 0.55 : 1" />
        <text v-if="a.pos" :x="a.sx" :y="a.sy + 3.5" text-anchor="middle" class="t">{{ a.n }}</text>
      </g>
      <circle :cx="C" :cy="C" r="5" class="mid" @click.stop="run('view.ortho')" />
    </svg>
    <div class="mode">{{ items.length ? label : 'Cámara inválida' }}</div>
  </div>
</template>

<style scoped>
.og { position: absolute; top: 48px; right: 8px; width: 96px; pointer-events: none; text-align: center; }
svg { display: block; pointer-events: auto; }
.bg { fill: rgba(20, 20, 20, 0); }
.og:hover .bg { fill: rgba(20, 20, 20, .45); }
.ax { cursor: pointer; }
.t { font: 700 10px var(--font, sans-serif); fill: #111; pointer-events: none; }
.mid { fill: rgba(200, 200, 200, .75); cursor: pointer; }
.mid:hover { fill: #fff; }
.mode { margin-top: -4px; font-size: 11px; color: var(--text-2, #aaa); text-shadow: 0 0 3px #000; pointer-events: none; }
</style>
