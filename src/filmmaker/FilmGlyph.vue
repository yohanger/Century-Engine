<script setup>
// Iconografía vectorial coherente, sin fuentes de iconos ni dependencias nuevas.
// Los botones conservan su title/aria-label del componente que los contiene.
const props = defineProps({ name: { type: String, required: true }, size: { type: Number, default: 16 } })
const shapes = {
  frame: ['M7 3H3v4','M17 3h4v4','M3 17v4h4','M21 17v4h-4','M8 8h8v8H8z'],
  film: ['M4 3h16v18H4z','M8 3v18','M16 3v18','M4 8h4','M4 16h4','M16 8h4','M16 16h4'],
  tree: ['M4 4h6v5H4z','M14 3h6v5h-6z','M14 15h6v5h-6z','M7 9v9h7'],
  actor: ['M12 5a3 3 0 1 0 0 6a3 3 0 0 0 0-6','M6 21v-3a6 6 0 0 1 12 0v3','M9 4l-2-2','M15 4l2-2'],
  cam: ['M14 4l2 3h4a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4l2-3z','M12 10a4 4 0 1 0 0 8a4 4 0 0 0 0-8'],
  insp: ['M4 4h16M4 12h16M4 20h16','M9 2v4','M16 10v4','M8 18v4'],
  color: ['M12 3a9 9 0 1 0 0 18c4 0 3-4 6-4h1c5-2 2-14-7-14','M7 9h.01M12 7h.01M17 10h.01M8 15h.01'],
  atmo: ['M5 16a5 5 0 0 1 1-9a7 7 0 0 1 13 3a4 4 0 0 1 0 8H6','M8 21l1-2M14 21l1-2'],
  assets: ['M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z','M3 10h18'],
  mixer: ['M4 4v16M10 4v16M16 4v16M22 4v16','M2 9h4v5H2z','M8 15h4v4H8z','M14 6h4v5h-4z'],
  nle: ['M3 5h18v14H3z','M3 10h18','M8 5v14','M13 10v9'],
  open: ['M4 5h6l2 3h8v12H4z','M3 12h18l-3 9H3z'],
  save: ['M4 3h14l3 3v15H3V3z','M7 3v7h10V3','M7 21v-7h10v7'],
  play: ['M8 5l11 7-11 7z'],
  pause: ['M7 5v14','M17 5v14'],
  stop: ['M6 6h12v12H6z'],
  environment: ['M5 16a5 5 0 0 1 1-9a7 7 0 0 1 13 3a4 4 0 0 1 0 8H6','M7 21h10'],
  select: ['M5 3l14 9-6 1-3 7z'],
  move: ['M12 2v20M2 12h20','M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3M19 9l3 3-3 3'],
  rotate: ['M20 11a8 8 0 1 1-3-6','M17 2v5h5'],
  scale: ['M4 10V4h6M20 14v6h-6','M4 4l6 6M20 20l-6-6'],
  split: ['M4 6l16 12M4 18L20 6','M6 6a2 2 0 1 0-4 0a2 2 0 0 0 4 0M6 18a2 2 0 1 0-4 0a2 2 0 0 0 4 0'],
  trash: ['M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14','M10 11v7M14 11v7'],
  magnet: ['M5 3v9a7 7 0 0 0 14 0V3h-5v9a2 2 0 0 1-4 0V3z'],
  text: ['M4 5h16M12 5v15M8 20h8'],
  effects: ['M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z'],
  audio: ['M3 10v4h4l5 5V5l-5 5z','M16 9a5 5 0 0 1 0 6','M19 6a9 9 0 0 1 0 12'],
}
</script>
<template>
  <svg class="film-glyph" :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path v-for="(shape,i) in (shapes[props.name] || shapes.film)" :key="i" :d="shape" />
  </svg>
</template>
