<script setup>
// Campo «Icono» de la base de datos: un emoji/símbolo escrito, o una IMAGEN del proyecto. La imagen se suelta en el recuadro
// (desde el panel Proyecto o un .png/.jpg del sistema, que se importa a Assets/Icons) o se elige en la lista. Valor: texto o 'img:<id>'.
import { computed, ref, watch } from 'vue'
import { store, assetUrl, importFiles, toast } from '../core/store.js'
import { isImageIcon, iconAssetId, imageIcon, isIconFile } from '../engine/runtime/database/icon.js'
import { allEntries } from '../core/project.js'
import { hasAssetDrag, resolveAssetDrop } from '../core/editor/asset-drop.js'

const props = defineProps({ modelValue: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])
const img = computed(() => iconAssetId(props.modelValue))
const url = ref('')
watch(img, async (id) => { url.value = id ? (await assetUrl(id).catch(() => null)) || '' : '' }, { immediate: true })
const images = computed(() => (store.project.assets || []).filter((a) => a.kind === 'texture' || isIconFile(a.name)))
const missing = computed(() => img.value && !images.value.some((a) => a.id === img.value))
const over = ref(false)
const file = ref(null)

const setImage = (id) => emit('update:modelValue', id ? imageIcon(id) : '')
async function importAndSet(files) {
  const list = [...files].filter((f) => isIconFile(f.name))
  if (!list.length) return toast('Suelta una imagen (png, jpg, webp…)', 'info', 2200)
  await importFiles(list.slice(0, 1), 'Assets/Icons')
  const got = (importFiles.last || [])[0]
  if (got) setImage(got.id)
}
function onDrop(e) {
  over.value = false
  if (hasAssetDrag(e.dataTransfer)) {
    const entry = resolveAssetDrop(e.dataTransfer, allEntries(store.project), {
      kinds: ['texture', 'file'],
      accepts: (item) => item.ref?.kind === 'texture' || isIconFile(item.name),
    })
    if (entry) return setImage(entry.id)
    return toast('Arrastra una única imagen válida del panel Proyecto', 'info', 2200)
  }
  if (e.dataTransfer.files?.length) void importAndSet(e.dataTransfer.files)
}
const accepts = (e) => hasAssetDrag(e.dataTransfer) || e.dataTransfer?.types?.includes('Files')
</script>

<template>
  <div class="icf" data-testid="icon-field">
    <div class="slot" :class="{ over, img: !!img }" data-testid="icon-slot"
      @dragover="accepts($event) && ($event.preventDefault(), (over = true))" @dragleave="over = false" @drop.prevent="onDrop">
      <img v-if="img && url" :src="url" alt="" />
      <span v-else-if="!img">{{ modelValue || '·' }}</span>
      <span v-else class="miss">?</span>
    </div>
    <div class="col">
      <input v-if="!img" type="text" maxlength="4" :value="modelValue" placeholder="emoji o símbolo" @input="emit('update:modelValue', $event.target.value)" />
      <select :value="img || ''" data-testid="icon-image" @change="setImage($event.target.value)">
        <option value="">{{ img ? '— quitar la imagen —' : '— o una imagen… —' }}</option>
        <option v-if="missing" :value="img">Imagen que ya no existe</option>
        <option v-for="a in images" :key="a.id" :value="a.id">{{ a.name }}</option>
      </select>
      <!-- soltar en el recuadro también funciona; el espacio del texto lo usa el botón -->
      <div class="row"><button type="button" @click="file?.click()">Importar imagen…</button></div>
      <input ref="file" type="file" accept="image/*" hidden @change="importAndSet($event.target.files); $event.target.value = ''" />
    </div>
  </div>
</template>

<style scoped>
.icf { display: flex; gap: 8px; align-items: flex-start; width: 100%; min-width: 0; }
.slot { width: 48px; height: 48px; flex: none; display: flex; align-items: center; justify-content: center; border: 1px dashed var(--g-500, #555); border-radius: 6px; background: var(--g-900, #111); font-size: 24px; }
.slot.over { border-color: var(--blue, #3d8bd6); background: var(--blue-wash, rgba(61,139,214,.15)); }
.slot.img { border-style: solid; }
.slot img { max-width: 44px; max-height: 44px; object-fit: contain; }
.miss { color: #e0a43a; font-size: 18px; }
.col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.col input[type=text], .col select { width: 100%; min-width: 0; }
.row { display: flex; align-items: center; gap: 6px; }
.row button { height: 24px; padding: 0 8px; font-size: 11.5px; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dim { font-size: 11px; color: var(--text-3, #888); }
</style>
