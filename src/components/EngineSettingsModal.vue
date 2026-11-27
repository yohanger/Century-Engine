<script setup>
import AppWindow from './AppWindow.vue'
import ColorGradePanel from './ColorGradePanel.vue'
import ParamForm from './ParamForm.vue'
import { renderMainParams, renderToneParams, renderFxParams, renderScaleParams, renderPerfParams } from '../core/templates/renderParams.js'
import { RENDER_PRESETS, presetOf, normalizeRender, RENDERERS, methodOf, MIN_RENDER_SCALE } from '../engine/runtime/render/config.js'
import { bakeSceneOcclusion, cancelOcclusionBake, occlusionBake, setStaticOcclusion } from '../core/state/occlusion.js'
import { OCCLUSION_BAKE_VERSION } from '../engine/runtime/render/occlusion-static.js'
import { computed, ref } from 'vue'
import { store, markDirty, setRenderMethod } from '../core/store.js'

const renderPage = ref('general')
const renderPages = [
  ['general', 'General'], ['lighting', 'Iluminación'], ['color', 'Color y tonos'],
  ['effects', 'Efectos'], ['geometry', 'Geometría y visibilidad'],
]
const render = computed(() => (store.project.render = store.project.render && store.project.render.look ? store.project.render : normalizeRender(store.project.render)))
const minPercent = MIN_RENDER_SCALE * 100
const scalePercent = computed(() => Math.round(normalizeRender(render.value).resScale * 100))
const sampleSize = computed(() => [1920, 1080].map(size => Math.round(size * scalePercent.value / 100)).join(' × '))
const lightingParams = renderFxParams.filter(({ key }) => /^(screenBounce|worldRay|bounceDistance|indirectProbe|dynamicReflections|puddleReflection|ssr|ao)/.test(key))
const effectParams = renderFxParams.filter(param => !lightingParams.includes(param))
function setScale(value) {
  const percent = Number(value)
  if (value === '' || !Number.isFinite(percent)) return
  render.value.resScale = Math.min(100, Math.max(minPercent, Math.round(percent))) / 100
  applyRenderChange()
}
const mainParams = computed(() => renderMainParams(store.project.shaders))
const bakedScene = computed(() => {
  const bake = store.project.environment?.occlusionBake
  return bake?.version === OCCLUSION_BAKE_VERSION ? bake : null
})
const applyRenderChange = () => { store.view.renderMethod = ''; markDirty() }
const applyPreset = (name) => {
  const prev = render.value
  const keep = {
    resScale: prev.resScale, spatialReconstruction: prev.spatialReconstruction,
    backend: prev.backend, psx: prev.psx, psxHeight: prev.psxHeight, psxSnap: prev.psxSnap, psxContinuous: prev.psxContinuous, psxAffine: prev.psxAffine,
    staticOcclusion: prev.staticOcclusion, environmentLook: prev.environmentLook,
    meshErrorLod: prev.meshErrorLod, clusterGeometry: prev.clusterGeometry,
    indirectProbeGrid: prev.indirectProbeGrid, indirectProbeCoverage: prev.indirectProbeCoverage, worldRayBounce: prev.worldRayBounce, worldRayBounceCount: prev.worldRayBounceCount,
    worldRayReflection: prev.worldRayReflection, worldRayReflectionDistance: prev.worldRayReflectionDistance,
  }
  if (name !== 'clasico') Object.assign(keep, { profile: prev.profile, shader: prev.shader })
  store.project.render = { ...presetOf(name), ...keep }
  applyRenderChange()
}
const resetRender = () => {
  store.project.render = { ...presetOf('realista'), staticOcclusion: render.value.staticOcclusion, environmentLook: render.value.environmentLook }
  applyRenderChange()
}
</script>

<template>
  <AppWindow title="Ajustes del motor" :width="1100" :min-width="360" :min-height="260" persist="enginesettings" @close="store.modal = null">
      <div class="render-layout">
        <nav class="render-nav" aria-label="Secciones de render">
          <button v-for="[id, name] in renderPages" :key="id" type="button" :class="{ on: renderPage === id }"
            :aria-current="renderPage === id ? 'true' : undefined" @click="renderPage = id">{{ name }}</button>
        </nav>
        <div class="render-content">
          <section class="render-card resolution">
            <div class="card-header">
              <div><h2>Resolución de render</h2><p class="dim">Escala del mundo 3D durante Play y en el juego exportado. La interfaz conserva su resolución.</p></div>
              <output v-if="!render.psx" class="resolution-output">{{ sampleSize }} <small>a 1080p</small></output>
            </div>
            <fieldset :disabled="render.psx">
              <label for="render-scale">Escala de resolución</label>
              <input id="render-scale" type="range" :min="minPercent" max="100" step="1" :value="scalePercent" @change="setScale($event.target.value)" />
              <label class="percent"><input aria-label="Escala de resolución en porcentaje" type="number" :min="minPercent" max="100" step="1" :value="scalePercent" @change="setScale($event.target.value); $event.target.value = scalePercent" /> %</label>
            </fieldset>
            <p v-if="render.psx" class="dim">Estilo PSX activo. Resolución interna {{ render.psxHeight ? render.psxHeight + 'p' : 'nativa' }}. Puedes cambiarla en General.</p>
            <ParamForm v-else :params="renderScaleParams" :values="render" @change="applyRenderChange()" />
          </section>
          <section v-if="renderPage === 'general'" class="render-card">
            <h3>Método de renderizado</h3>
            <div class="presets"><button v-for="r in RENDERERS" :key="r.id" :class="{ on: methodOf(render) === r.id }" :data-tooltip="r.desc" @click="setRenderMethod(r.id)">{{ r.name }}</button></div>
            <p class="dim lf-help">{{ RENDERERS.find((r) => r.id === methodOf(render)).tag }}. Cambiarlo aplica el perfil del método y conserva la escala de resolución.</p>
            <h3>Aspecto y shader</h3>
            <div class="presets"><button v-for="[k, l] in RENDER_PRESETS" :key="k" :class="{ on: render.look === k }" @click="applyPreset(k)">{{ l.split(' (')[0] }}</button></div>
            <ParamForm :params="mainParams" :values="render" @change="applyRenderChange()" />
          </section>
          <template v-else-if="renderPage === 'color'">
            <section class="render-card"><h3>Color y tonos</h3><ParamForm :params="renderToneParams" :values="render" @change="applyRenderChange()" /></section>
            <section v-if="render.look === 'realista'" class="render-card"><ColorGradePanel :values="render" @change="applyRenderChange()" /></section>
          </template>
          <section v-else-if="renderPage === 'lighting'" class="render-card">
            <h3>Iluminación y reflejos</h3><ParamForm :params="lightingParams" :values="render" @change="applyRenderChange()" />
          </section>
          <section v-else-if="renderPage === 'effects'" class="render-card">
            <h3>Efectos de imagen</h3><ParamForm :params="effectParams" :values="render" @change="applyRenderChange()" />
          </section>
          <template v-else>
            <section class="render-card">
            <h3>Oclusión estática</h3>
            <label class="arow2">
              <input type="checkbox" :checked="render.staticOcclusion === true" :disabled="store.locked" @change="setStaticOcclusion($event.target.checked)" />
              Activar oclusión precalculada
            </label>
            <p class="dim lf-help">Marca la geometría fija como Estático en el inspector y hornea cada escena. Todas las mallas estáticas participan, incluidas las editadas. Las superficies opacas pueden ocultar otras mallas; vuelve a hornear al cambiar la geometría.</p>
            <div class="presets">
              <button :disabled="occlusionBake.running || store.locked || store.play.on || store.edit.on" @click="bakeSceneOcclusion()">{{ bakedScene ? 'Volver a hornear escena' : 'Hornear escena en GPU' }}</button>
              <button v-if="occlusionBake.running" @click="cancelOcclusionBake()">Cancelar</button>
            </div>
            <p class="dim" role="status">
              <template v-if="occlusionBake.running">Horneando {{ Math.round(occlusionBake.progress * 100) }} %</template>
              <template v-else-if="bakedScene">{{ bakedScene.meshes.length }} mallas · {{ bakedScene.grid.count }} celdas de {{ bakedScene.grid.size }} m · {{ bakedScene.covered }} descartes precalculados</template>
              <template v-else>Escena sin hornear</template>
            </p>
          </section>
            <section v-if="render.look === 'realista'" class="render-card">
              <h3>Detalle de geometría durante Play</h3>
              <ParamForm :params="renderPerfParams" :values="render" @change="applyRenderChange()" />
            </section>
          </template>
        </div>
      </div>
    <template #footer>
      <button @click="resetRender">Restaurar render realista</button>
      <span class="grow"></span>
      <button class="primary" @click="store.modal = null">Cerrar</button>
    </template>
  </AppWindow>
</template>

<style scoped>
.dim { color: var(--text-2); font-weight: 400; font-size: 12px; }
.grow { flex: 1; }
.arow2 { display: flex; gap: 8px; align-items: center; }
.presets { display: flex; gap: 6px; margin-bottom: 10px; }
.presets button.on { border-color: var(--accent, #4aa3ff); }
.render-layout { display: grid; grid-template-columns: 190px minmax(0, 1fr); min-height: 100%; }
.render-nav { display: flex; flex-direction: column; align-self: start; position: sticky; top: 0; gap: 4px; padding: 16px 12px; }
.render-nav button { min-height: 36px; text-align: left; background: transparent; border: 1px solid transparent; color: var(--text-2); padding: 6px 10px; }
.render-nav button.on { background: var(--blue-wash); border-color: var(--hair); color: var(--blue-hi); }
.render-content { display: grid; align-content: start; gap: 12px; padding: 16px; border-left: 1px solid var(--hair); min-width: 0; }
.render-card { min-width: 0; padding: 14px 16px; background: var(--g-850); border: 1px solid var(--hair); border-radius: 6px; }
.render-card p { margin: 4px 0 10px; }
.card-header { display: flex; align-items: start; justify-content: space-between; flex-wrap: wrap; gap: 4px 16px; }
.card-header h2 { margin: 0; font-size: 16px; color: var(--text); }
.resolution-output { color: var(--blue-hi); font-size: 15px; font-variant-numeric: tabular-nums; }
.resolution-output small { color: var(--text-2); font-size: 11px; }
.resolution fieldset { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; border: 0; padding: 0; margin: 8px 0; min-width: 0; }
.resolution fieldset:disabled { opacity: .55; }
.resolution input[type=range] { flex: 1; min-width: 100px; }
.percent { white-space: nowrap; }
.percent input { width: 64px; }
@container win (max-width: 640px) {
  .render-layout { grid-template-columns: minmax(0, 1fr); }
  .render-nav { flex-direction: row; overflow: auto; position: static; padding: 8px 12px; }
  .render-nav button { flex: 0 0 auto; }
  .render-content { padding: 8px 12px; border: 0; }
  .resolution fieldset > label:first-child { flex-basis: 100%; }
}
h3 { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--text-2); }
</style>
