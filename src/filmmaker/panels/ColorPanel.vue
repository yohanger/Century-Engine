<script setup>
// Color: la gradación de la ESCENA (vuelve a Century: el juego y la cinemática se ven igual) o la de UN PLANO del montaje.
import { ref, computed, reactive, watch } from 'vue'
import { store, markDirty } from '../../core/store.js'
import { normalizeRender } from '../../engine/runtime/render/config.js'
import { PROFILE_EFFECTS } from '../../engine/runtime/render/profiles.js'
import ColorGradePanel from '../../components/ColorGradePanel.vue'
import * as M from '../montage.js'
import * as F from '../session.js'

const props = defineProps({ shotId: { type: String, default: '' }, compact: Boolean })
const { session } = F
const mode = ref('scene')
const render = computed(() => {
  const p = store.project; if (!p) return {}
  if (!p.render || !p.render.look) p.render = normalizeRender(p.render)
  else for (const [k, v] of Object.entries(normalizeRender(p.render))) if (!(k in p.render)) p.render[k] = v
  return p.render
})
const shot = computed(() => session.film?.edit.shots.find((s) => s.id === props.shotId) || null)
watch(() => props.shotId, (id) => { if (!id && mode.value === 'shot') mode.value = 'scene' })
// el color de un plano es un filtro (perfil) con todos los efectos de color encendidos
const shotValues = reactive({})
function loadShot() {
  for (const k of Object.keys(shotValues)) delete shotValues[k]
  const base = render.value, f = session.film?.edit.filters.find((x) => x.id === shot.value?.filter)
  for (const e of PROFILE_EFFECTS) for (const p of e.params) shotValues[p.key] = f?.fx[e.id]?.on ? f.fx[e.id][p.key] ?? base[p.key] : base[p.key]
}
watch([() => shot.value?.filter, mode], loadShot, { immediate: true })
// vista previa: en «Este plano» el visor se ve con el color del plano; al volver a «Escena», con el de la escena
function previewShot() { if (mode.value === 'shot' && store.editor) store.editor.vp.setRenderLive({ ...store.editor.baseRender(), ...shotValues }) }
watch(mode, (m) => { if (m === 'shot') previewShot(); else store.editor?.applyRender() })
function saveShot() {
  const film = session.film, s = shot.value; if (!s) return
  let edit = M.normalizeEdit(film.edit), fid = s.filter
  if (!fid || !edit.filters.some((f) => f.id === fid)) {
    const r = M.addFilter(film, 'none'); edit = r.edit; fid = r.id
    edit.filters.find((f) => f.id === fid).name = `Plano ${film.edit.shots.findIndex((x) => x.id === s.id) + 1}`
    edit.shots.find((x) => x.id === s.id).filter = fid
  }
  const f = edit.filters.find((x) => x.id === fid)
  for (const e of PROFILE_EFFECTS) { if (['ao', 'chromatic'].includes(e.id)) continue; f.fx[e.id] = { on: true, ...Object.fromEntries(e.params.map((p) => [p.key, shotValues[p.key]])) } }
  F.setEdit(edit)
  previewShot()
}
function preset(k) {
  const p = M.FILTER_PRESETS[k]; if (!p) return
  const target = mode.value === 'shot' ? shotValues : render.value
  for (const fx of Object.values(p.fx)) for (const [key, v] of Object.entries(fx)) if (key !== 'on') target[key] = v
  if (mode.value === 'shot') saveShot(); else markDirty()
}
</script>

<template>
  <section class="pn">
    <div class="seg">
      <button :class="{ on: mode === 'scene' }" data-test="color-scene" @click="mode = 'scene'">Escena</button>
      <button :class="{ on: mode === 'shot' }" :disabled="!shot" data-test="color-shot" :title="shot ? '' : 'Selecciona un plano en el timeline'" @click="mode = 'shot'">Este plano</button>
    </div>
    <p class="hint">{{ mode === 'scene' ? 'El color de la escena vuelve a Century: el juego y la cinemática se ven igual.' : 'Solo para este plano del montaje (en Century, un perfil de post-proceso que la cinemática activa en ese plano).' }}</p>
    <label class="f">Estilo rápido <select value="" data-test="color-preset" @change="preset($event.target.value); $event.target.value = ''"><option value="">Elige un estilo…</option><option v-for="(p, k) in M.FILTER_PRESETS" :key="k" :value="k">{{ p.name }}</option></select></label>
    <ColorGradePanel v-if="mode === 'scene'" :values="render" :compact="compact" @change="markDirty()" />
    <ColorGradePanel v-else :values="shotValues" :compact="compact" @commit="saveShot" @change="saveShot" />
    <p v-if="store.view.renderMethod === 'compat' || render.look === 'clasico'" class="hint warn">Con el render «Compatibility» o el aspecto clásico no hay post-proceso: el color no se ve. Cambia el método de render arriba.</p>
  </section>
</template>
