<script setup>
// Campo de IMAGEN del proyecto (id del recurso): miniatura, lista de imágenes, «Importar imagen…» y soltar en el recuadro (desde el
// panel Proyecto o un .png/.jpg del sistema, que se importa a `folder`).
import { computed, ref, watch } from 'vue'
import { store, assetUrl, importFiles, toast } from '../core/store.js'
import { isIconFile } from '../engine/runtime/database/icon.js'
import { allEntries } from '../core/project.js'
import { hasAssetDrag, resolveAssetDrop } from '../core/editor/asset-drop.js'

const props = defineProps({ modelValue: { type: String, default: '' }, folder: { type: String, default: 'Assets/Textures' }, none: { type: String, default: '— sin imagen —' } })
const emit = defineEmits(['update:modelValue'])
const url = ref('')
watch(() => [props.modelValue, store.assetRev], async ([id]) => { url.value = id ? (await assetUrl(id).catch(() => null)) || '' : '' }, { immediate: true })
const images = computed(() => (store.project.assets || []).filter((a) => a.kind === 'texture' || isIconFile(a.name)))
const missing = computed(() => props.modelValue && !images.value.some((a) => a.id === props.modelValue))
const over = ref(false)
const file = ref(null)
async function importAndSet(files) {
  const list = [...files].filter((f) => isIconFile(f.name))
  if (!list.length) return toast('Suelta una imagen (png, jpg, webp…)', 'info', 2200)
  await importFiles(list.slice(0, 1), props.folder)
  const got = (importFiles.last || [])[0]
  if (got) emit('update:modelValue', got.id)
}
function onDrop(e) {
  over.value = false
  if (hasAssetDrag(e.dataTransfer)) {
    const entry = resolveAssetDrop(e.dataTransfer, allEntries(store.project), {
      kinds: ['texture', 'file'],
      accepts: (item) => item.ref?.kind === 'texture' || isIconFile(item.name),
    })
    if (entry) return emit('update:modelValue', entry.id)
    return toast('Arrastra una única imagen válida del panel Proyecto', 'info', 2200)
  }
  if (e.dataTransfer.files?.length) void importAndSet(e.dataTransfer.files)
}
const accepts = (e) => hasAssetDrag(e.dataTransfer) || e.dataTransfer?.types?.includes('Files')
</script>

<template>
  <div class="imf" data-testid="image-field">
    <div class="slot" :class="{ over }" @dragover="accepts($event) && ($event.preventDefault(), (over = true))" @dragleave="over = false" @drop.prevent="onDrop">
      <img v-if="url" :src="url" alt="" />
      <span v-else>{{ modelValue ? '?' : '＋' }}</span>
    </div>
    <div class="col">
      <select :value="modelValue || ''" @change="emit('update:modelValue', $event.target.value)">
        <option value="">{{ none }}</option>
        <option v-if="missing" :value="modelValue">Imagen que ya no existe</option>
        <option v-for="a in images" :key="a.id" :value="a.id">{{ a.name }}</option>
      </select>
      <!-- soltar en el recuadro también funciona; el espacio del texto lo usa el botón -->
      <div class="row"><button type="button" @click="file?.click()">Importar imagen…</button><button v-if="modelValue" type="button" class="x" aria-label="Quitar la imagen" @click="emit('update:modelValue', '')">✕</button></div>
      <input ref="file" type="file" accept="image/*" hidden @change="importAndSet($event.target.files); $event.target.value = ''" />
    </div>
  </div>
</template>

<style scoped>
.imf { display: flex; gap: 8px; align-items: flex-start; width: 100%; min-width: 0; }
.slot { width: 56px; height: 56px; flex: none; display: flex; align-items: center; justify-content: center; border: 1px dashed var(--g-500, #555); border-radius: 6px;
  background: repeating-conic-gradient(#3a3f47 0 25%, #2e3238 0 50%) 0 0 / 10px 10px; color: var(--text-3); font-size: 20px; }
.slot.over { border-color: var(--blue, #3d8bd6); }
.slot img { max-width: 52px; max-height: 52px; object-fit: contain; image-rendering: pixelated; }
.col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.col select { width: 100%; min-width: 0; }
.row { display: flex; align-items: center; gap: 6px; }
.row button { height: 24px; padding: 0 8px; font-size: 11.5px; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row button.x { flex: none; width: 26px; padding: 0; }
.dim { font-size: 11px; color: var(--text-3); }
</style>
