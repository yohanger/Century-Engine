<script setup>
import { store, updateEnvironment, updateSettings, commit, runBake, cancelBake, clearBake, updateBake, bakeSceneTerrain, clearSceneTerrainBake } from '../core/store.js'
import { ref } from 'vue'
import NumberField from './NumberField.vue'
import Icon from './Icon.vue'
import ParamForm from './ParamForm.vue'
import SceneStreaming from './SceneStreaming.vue'
import { LEVEL_PARAMS, TIME_PARAMS, WEATHER_PARAMS, TIME_DEFAULTS } from '../engine/runtime/world/params.js'
import { beaufort } from '../engine/runtime/world/weather.js'
import { formatHour } from '../engine/runtime/world/world.js'
import { lightingMode, selectedSun } from '../engine/runtime/world/lighting.js'
import { defaultEnvironment, resolveScenePlayerNode } from '../core/project.js'
import { nodeEffectiveActive } from '../engine/runtime/nodes/hierarchy.js'
import { sceneGameConfig } from '../engine/runtime/game-manager.js'
import { SCENE_FADE_DEFAULTS, normalizeSceneTransitions } from '../engine/runtime/events/scene-transitions.js'
import { activeScene, assignSceneGameManager, createGameManager, openGameManagerEditor, assignScenePlayerNode, assignScenePlayerSpawnMode } from '../core/store.js'
import { solarPosition } from '../engine/runtime/world/solar.js'
import { SEASON_DAY } from '../engine/runtime/world/params.js'
// Nivel · Hora · Clima: formularios GENERADOS de las listas declaradas en core/world/params.js (añadir un ajuste = una línea allí)
const worldChanged = () => updateEnvironment({})
const wind = () => beaufort(+env().weather?.windSpeed || 0)
const clock = () => { const t = env().time; return `${formatHour(t.hour)} · sol a ${Math.round(solarPosition(t.hour, t.latitude, SEASON_DAY[t.season]).elevation)}°` }

import { normalizeWaterFx } from '../engine/runtime/geometry/waterfx.js'
import { normalizeSky, CLOUD_PRESETS, SKY_DEFAULTS } from '../engine/runtime/render/skylib.js'
import { normalizeVolumetric } from '../engine/runtime/render/lightlib.js'
import { normalizeFog, FOG_MODES } from '../engine/runtime/world/fog.js'
const sky = () => normalizeSky(store.project.environment)
const fogx = () => normalizeFog(store.project.environment)
const vol = () => normalizeVolumetric(store.project.environment)
const panoAssets = () => store.project.assets.filter((a) => /\.(hdr|exr|png|jpe?g|webp)$/i.test(a.name))
const setPreset = (k) => { updateEnvironment({ cloudsPreset: k, ...(CLOUD_PRESETS[k] ? Object.fromEntries(Object.entries(CLOUD_PRESETS[k]).filter(([x]) => x !== 'label')) : {}) }) }
const cloudEdit = (patch) => updateEnvironment({ cloudsPreset: 'custom', ...patch }, false)
const env = () => store.project.environment
// Fuente configurada en la escena. El estado efectivo en Play puede incluir cambios por script.
const weatherConfigured = () => !!env().weather?.on
const clockConfigured = () => mode() === 'cycle' || (mode() === 'legacy' && !!env().time?.on)
const assignedManager = () => store.project.gameManagers?.find((g) => g.id === activeScene()?.gameManagerId)
const playerStatus = () => resolveScenePlayerNode(activeScene(), store.project?.objects || [])
const playerBodies = () => (store.project?.objects || []).filter(o => o.type === 'characterbody3d')
const playerAvailable = (o) => nodeEffectiveActive(store.project?.objects || [], o)
const playerHint = () => ({
  missing: 'Referencia inexistente. El personaje pudo eliminarse o cambiar de ID al actualizar un Prefab.',
  inactive: 'El personaje o alguno de sus padres está desactivado.',
  'wrong-type': 'La referencia ya no corresponde a CharacterBody3D.',
  ambiguous: 'Existen IDs duplicados en la escena.',
  invalid: 'Referencia inválida.',
})[playerStatus().status] || ''
const transitions = () => normalizeSceneTransitions(activeScene()?.transitions)
const changeTransition = (patch, save = true) => {
  const scene = activeScene()
  if (!scene) return
  scene.transitions = { ...transitions(), ...patch }
  if (save) commit('Transiciones de escena')
}
const finishTransition = () => commit('Transiciones de escena')
const newManagerHere = () => { const g = createGameManager(); assignSceneGameManager(g.id); openGameManagerEditor(g.id) }
const fx = () => normalizeWaterFx(store.project.environment)
const live = (patch) => updateEnvironment(patch, false)
const done = () => commit('Entorno')
const bk = () => store.project.bake
const baked = () => store.project.environment.bake
const lightsInfo = () => {
  const ls = store.project.objects.filter((o) => o.type === 'light')
  return { baked: ls.filter((o) => o.light?.mode === 'baked').length, mixed: ls.filter((o) => o.light?.mode === 'mixed').length }
}
const paramsChanged = () => {
  const b = baked(); if (!b?.params) return false
  return Object.keys(b.params).some((k) => k !== 'gpuUsage' && k !== 'worker' && b.params[k] !== bk()[k]) // el uso de GPU no cambia el resultado
}
// G003_CORR-001: dos modos nuevos y uno heredado, sin cambios implícitos en escenas existentes.
const mode = () => lightingMode(env())
const sunOptions = () => store.project.objects.filter((o) => o.type === 'light' && o.light?.type === 'directional' && o.visible !== false)
const actualSun = () => selectedSun(store.project.objects, env())
const celestialAdvanced = TIME_PARAMS.filter((p) => !['on', 'hour', 'flow', 'celestialLights'].includes(p.key))
const weatherBasic = WEATHER_PARAMS.filter((p) => ['on', 'preset', 'intensity', 'windSpeed', 'windDir'].includes(p.key))
const weatherAdvanced = WEATHER_PARAMS.filter((p) => !weatherBasic.includes(p) && !['cloudModel', 'cloudSeed', 'cloudScale', 'cloudSize', '_hCloud'].includes(p.key))
const chooseMode = (next) => {
  if (next === 'legacy') return // solo se conserva el legado; nunca se crea desde la UI nueva
  updateEnvironment({ lightingMode: next, time: { on: next === 'cycle', celestialLights: next === 'cycle' } })
}
const resetSection = (section) => {
  if (!window.confirm(`¿Restablecer ${section === 'all' ? 'todo el entorno' : section} a los valores predeterminados? Puedes deshacerlo.`)) return
  const def = defaultEnvironment()
  if (section === 'all') {
    // Los lightmaps horneados son recursos externos al entorno visual; jamás eliminarlos en un reset.
    const bake = env().bake
    store.project.environment = { ...def, ...(bake ? { bake } : {}) }
    store.editor.syncEnvironment()
    commit('Restablecer entorno')
    return
  }
  const keys = {
    celestial: ['lightingMode', 'sunLightId', 'time'],
    sky: ['skyTop', 'skyHorizon', 'ground', 'ambientColor', 'ambient', ...Object.keys(SKY_DEFAULTS).filter((k) => !k.startsWith('clouds'))],
    weather: ['weather', ...Object.keys(SKY_DEFAULTS).filter((k) => k.startsWith('clouds')), 'fog', 'fogColor', 'fogDensity', 'fogStart', 'fogMode', 'fogFalloff', 'fogHeight', 'fogShafts', 'fogScatter'],
  }[section] || []
  const patch = Object.fromEntries(keys.map((k) => [k, def[k] ?? (k === 'time' ? { ...TIME_DEFAULTS } : SKY_DEFAULTS[k])]).filter(([k, v]) => v !== undefined))
  updateEnvironment(patch)
}
// Las secciones de Escena usan <details> nativo y la preferencia de plegado ya existente.
// La clave depende del apartado, nunca del título ni del identificador de la escena.
const sceneFoldKey = (id) => `fold:scene:${id}`
const sceneFoldOpen = (id, initiallyOpen = false) => {
  const folds = store.prefs.inspFold || {}
  const key = sceneFoldKey(id)
  return Object.prototype.hasOwnProperty.call(folds, key) ? !folds[key] : initiallyOpen
}
const rememberSceneFold = (event) => {
  const el = event.target
  if (!el?.matches?.('details[data-scene-fold]') || el.dataset.sceneSearch === 'true') return
  const id = el.dataset.sceneFold
  if (el.open === sceneFoldOpen(id, el.dataset.foldDefault === 'open')) return
  store.prefs.inspFold = { ...(store.prefs.inspFold || {}), [sceneFoldKey(id)]: !el.open }
}
const pct = () => Math.round(store.bake.fraction * 100)
const terrainHeightError = ref(0.08)
const terrainPaintError = ref(0.06)
const terrainBakeTotals = () => {
  const list = store.pieces?.filter(p => p.enabled !== false) || []
  return { total: list.reduce((v,p)=>v+(p.bakeInfo?.sourceTriangles || 2*p.segments*p.segmentsZ),0),
    baked: list.reduce((v,p)=>v+(p.bakeInfo?.triangles || 2*p.segments*p.segmentsZ),0),
    count: list.filter(p => p.terrainBake).length,
    blocked: list.filter(p => p.terrainBake && p.bakeInfo && !p.bakeInfo.index).length,
    patches: list.reduce((n,p) => n + (p.bakeInfo?.patches || 0), 0) }
}
const doBakeTerrain = () => bakeSceneTerrain({ heightError: terrainHeightError.value, paintError: terrainPaintError.value })
</script>

<template>
  <div class="sp" data-scene-inspector @toggle.capture="rememberSceneFold">
    <details class="ownership-group" data-owner-group="scene" data-scene-fold="group-scene" data-fold-default="open" :open="sceneFoldOpen('group-scene', true)">
      <summary class="owner-heading"><Icon name="scene" :size="13" aria-hidden="true" /><strong>Escena</strong></summary>
    <details class="gm-section scene-section" data-scene-fold="game-manager" data-fold-default="open" :open="sceneFoldOpen('game-manager', true)">
      <summary><Icon name="script" :size="13" aria-hidden="true" />GameManager</summary>
      <div class="row"><span>Configuración de esta escena</span><select :value="activeScene()?.gameManagerId || ''" @change="assignSceneGameManager($event.target.value)">
        <option value="">Sin GameManager (usar proyecto)</option>
        <option v-for="m in store.project.gameManagers || []" :key="m.id" :value="m.id">{{ m.name }}</option>
      </select></div>
      <div class="row"><span>Acciones</span><div class="btns">
        <button v-if="assignedManager()" @click="openGameManagerEditor(assignedManager().id)">Editar…</button>
        <button @click="newManagerHere">Nuevo…</button>
      </div></div>
    </details>
    <details class="gm-section scene-section" data-scene-fold="scene-player" data-fold-default="open" :open="sceneFoldOpen('scene-player', true)">
      <summary><Icon name="spawn" :size="13" aria-hidden="true" />Personaje controlado</summary>
      <div class="row"><span>Aparición del jugador</span>
        <select :value="activeScene()?.playerSpawnMode === 'api' ? 'api' : 'node'" :disabled="store.locked || store.play?.on || store.filmMode" @change="assignScenePlayerSpawnMode($event.target.value)">
          <option value="node">Jugador designado / sin jugador</option>
          <option value="api" :disabled="!!activeScene()?.playerNodeId || sceneGameConfig(store.project).config.player === 'none'">Aparición por API</option>
        </select>
      </div>
      <p v-if="activeScene()?.playerSpawnMode === 'api'" class="hint keep" role="status">Sin jugador inicial · game.spawnPlayer()</p>
      <div class="row"><span data-tooltip="Identidad por escena. El personaje designado será el jugador en Play.">CharacterBody3D</span>
        <select :value="activeScene()?.playerNodeId || ''" :disabled="store.locked || store.play?.on || store.filmMode || activeScene()?.playerSpawnMode === 'api'" @change="assignScenePlayerNode($event.target.value)">
          <option value="">Sin asignar (no selecciona automáticamente)</option>
          <option v-if="playerStatus().id && !playerBodies().some(o => o.id === playerStatus().id)" :value="playerStatus().id">Referencia no disponible · {{ playerStatus().id }}</option>
          <option v-for="o in playerBodies()" :key="o.id" :value="o.id" :disabled="!playerAvailable(o)">{{ o.name }} · {{ o.id }}{{ !playerAvailable(o) ? ' (inactivo)' : '' }}</option>
        </select>
      </div>
      <p v-if="playerHint()" class="hint warn" role="status">{{ playerHint() }} Conserva la referencia hasta que la corrijas explícitamente.</p>

    </details>
    <details class="gm-section scene-section" data-scene-fold="streaming" :open="sceneFoldOpen('streaming')">
      <summary><Icon name="layers" :size="13" aria-hidden="true" />Streaming de escenas</summary>
      <SceneStreaming />
    </details>
    <details class="gm-section scene-section" data-scene-fold="scene-transitions" data-fold-default="open" :open="sceneFoldOpen('scene-transitions', true)">
      <summary><Icon name="play" :size="13" aria-hidden="true" />Transiciones de pantalla</summary>
      <div class="section-actions"><button class="small-reset" @click="changeTransition({ ...SCENE_FADE_DEFAULTS })">Restablecer</button></div>
      <div class="row"><span>Fade In al entrar</span><input type="checkbox" :checked="transitions().enter" @change="changeTransition({ enter: $event.target.checked })" /></div>
      <div class="row"><span>Duración de entrada (s)</span><NumberField :modelValue="transitions().inSeconds" :min="0" :max="60" :step="0.1" :disabled="!transitions().enter" @update:modelValue="changeTransition({ inSeconds: +$event }, false)" @commit="finishTransition" /></div>
      <div class="row"><span>Espera inicial (s)</span><NumberField :modelValue="transitions().delay" :min="0" :max="60" :step="0.1" :disabled="!transitions().enter" @update:modelValue="changeTransition({ delay: +$event }, false)" @commit="finishTransition" /></div>
      <div class="row"><span>Fade Out al salir</span><input type="checkbox" :checked="transitions().exit" @change="changeTransition({ exit: $event.target.checked })" /></div>
      <div class="row"><span>Duración de salida (s)</span><NumberField :modelValue="transitions().outSeconds" :min="0" :max="60" :step="0.1" :disabled="!transitions().exit" @update:modelValue="changeTransition({ outSeconds: +$event }, false)" @commit="finishTransition" /></div>
      <div class="row"><span>Color</span><ColorInput :value="transitions().color" @input="changeTransition({ color: $event.target.value }, false)" @change="finishTransition" /></div>
      <div class="row"><span>Ritmo</span><select :value="transitions().curve" @change="changeTransition({ curve: $event.target.value })">
        <option value="linear">Lineal</option><option value="ease-in-out">Suave · entrada y salida</option><option value="ease-in">Aceleración</option><option value="ease-out">Desaceleración</option>
      </select></div>
    </details>
    <details class="fold" data-scene-fold="scene-terrain-bake" :open="sceneFoldOpen('scene-terrain-bake')">
      <summary><Icon name="terrain" :size="13" aria-hidden="true" />Hornear Mapa · geometría <small style="opacity:.7">TriangHor</small></summary>
      <div class="row"><span>Error altura (m)</span><input type="number" min="0" max="10" step="0.01" v-model.number="terrainHeightError" /></div>
      <div class="row"><span>Error pintura (0–1)</span><input type="number" min="0" max="1" step="0.01" v-model.number="terrainPaintError" /></div>
      <div class="terrain-bake-actions">
        <button type="button" class="primary terrain-bake-action" :disabled="!store.pieces?.some(p=>p.enabled) || store.terrainBakeProgress?.active" @click="doBakeTerrain">{{ store.terrainBakeProgress?.active ? 'TriangHor…' : 'Hornear mapa' }}</button>
        <button v-if="terrainBakeTotals().count" type="button" class="terrain-bake-action" data-tooltip="Restaurar índices originales" aria-label="Restaurar índices originales" @click="clearSceneTerrainBake">Restaurar</button>
      </div>
      <div v-if="store.terrainBakeProgress?.active" class="terrain-bake-stats" role="status"><span>Procesando</span><b>{{ store.terrainBakeProgress.done }}/{{ store.terrainBakeProgress.total }}</b></div>
      <div v-if="terrainBakeTotals().count" class="terrain-bake-stats" aria-label="Resultado de horneado">
        <span>Piezas <b>{{ terrainBakeTotals().count }}</b></span>
        <span>Triángulos <b>{{ terrainBakeTotals().baked.toLocaleString('es') }} / {{ terrainBakeTotals().total.toLocaleString('es') }}</b></span>
        <span>Reducción <b>{{ Math.round(100 * (1 - terrainBakeTotals().baked / Math.max(1, terrainBakeTotals().total))) }} %</b></span>
      </div>
      <div v-if="terrainBakeTotals().blocked" class="terrain-bake-warning" role="status">Sin reducción: {{ terrainBakeTotals().blocked }} pieza(s)</div>
    </details>
    </details>
    <details class="ownership-group" data-owner-group="world" data-scene-fold="group-world" data-fold-default="open" :open="sceneFoldOpen('group-world', true)">
      <summary class="owner-heading"><Icon name="globe" :size="13" aria-hidden="true" /><strong>Mundo y atmósfera</strong><span v-if="mode() !== 'legacy' && !actualSun()" class="fold-status warn" role="status">Sin luz solar</span></summary>
      <div class="section-actions"><button class="small-reset" @click="resetSection('all')">Restablecer entorno</button></div>
    <details class="fold" data-scene-fold="world-level" :open="sceneFoldOpen('world-level')"><summary><Icon name="sliders" :size="13" aria-hidden="true" />Nivel</summary>
      <ParamForm :params="LEVEL_PARAMS" :values="env().level" @change="worldChanged" />
    </details>

    <details class="fold scene-section" data-scene-fold="world-celestial" data-fold-default="open" :open="sceneFoldOpen('world-celestial', true)">
      <summary><Icon name="sun" :size="13" aria-hidden="true" />Iluminación celestial <span v-if="mode() !== 'legacy' && !actualSun()" class="fold-status warn">Sin luz direccional</span></summary>
      <div class="section-actions"><button class="small-reset" @click="resetSection('celestial')">Restablecer</button></div>
      <div class="row"><span>Control</span><select :value="mode()" @change="chooseMode($event.target.value)">
        <option v-if="mode() === 'legacy'" value="legacy">Heredado (compatibilidad)</option>
        <option value="manual">Manual</option><option value="cycle">Ciclo día/noche</option>
      </select></div>
      <template v-if="mode() === 'legacy'">
        <p class="hint keep" role="status">Modo heredado: configuración conservada.</p>
        <details class="subfold" data-scene-fold="world-celestial-legacy" :open="sceneFoldOpen('world-celestial-legacy')"><summary><Icon name="clock" :size="13" aria-hidden="true" />Controles heredados</summary>
          <ParamForm :params="TIME_PARAMS" :values="env().time" @change="worldChanged" />
        </details>
      </template>
      <template v-else>
        <div class="row"><span>Sol (luz)</span><select :value="env().sunLightId || ''" @change="updateEnvironment({ sunLightId: $event.target.value })">
          <option value="">{{ sunOptions().length ? 'Primera direccional visible' : '— Sin luz direccional —' }}</option>
          <option v-for="l in sunOptions()" :key="l.id" :value="l.id">{{ l.name || l.id }}</option>
        </select></div>
        <p v-if="!actualSun()" class="hint warn">Añade una DirectionalLight para iluminar la escena con el sol.</p>

        <template v-if="mode() === 'cycle'">
          <p v-if="actualSun()?.light?.mode === 'baked'" class="hint warn">Usa una luz dinámica para que su iluminación responda a la hora y al clima.</p>

          <div class="scene-clock" data-testid="scene-clock">
            <div class="clock-head"><span>Hora</span><output>{{ clock() }}</output></div>
            <div class="clock-band" aria-hidden="true" data-tooltip="Esquema horario; la elevación solar indicada utiliza la fecha y ubicación configuradas."><i :style="{ left: `${Math.max(0, Math.min(24, env().time.hour)) / 24 * 100}%` }"></i></div>
            <div class="clock-ticks" aria-hidden="true"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
            <div class="scene-range"><input aria-label="Hora de la escena" type="range" min="0" max="24" step="0.05" :value="env().time.hour" @input="env().time.hour = +$event.target.value; updateEnvironment({}, false)" @change="done" /><NumberField :modelValue="env().time.hour" :min="0" :max="24" :step="0.05" @update:modelValue="env().time.hour = +$event; updateEnvironment({}, false)" @commit="done" /></div>
          </div>
          <div class="row"><span>Avanzar hora</span><input type="checkbox" :checked="env().time.flow" @change="env().time.flow = $event.target.checked; worldChanged()" /></div>

          <details class="subfold" data-scene-fold="world-celestial-advanced" :open="sceneFoldOpen('world-celestial-advanced')"><summary><Icon name="clock" :size="13" aria-hidden="true" />Fecha, ubicación e intensidad nocturna</summary>
            <ParamForm :params="celestialAdvanced" :values="env().time" @change="worldChanged" />
          </details>
        </template>
      </template>
    </details>

    <details class="fold scene-section" data-scene-fold="world-weather" data-fold-default="open" :open="sceneFoldOpen('world-weather', true)">
      <summary><Icon name="cloud" :size="13" aria-hidden="true" />Clima y atmósfera</summary>
      <div class="section-actions"><button class="small-reset" @click="resetSection('weather')">Restablecer clima y atmósfera</button></div>
      <p class="owner-note" data-authority="weather">{{ weatherConfigured() ? 'World controla el clima en Play.' : 'Meteorología desactivada: entorno manual.' }}</p>
      <ParamForm :params="weatherBasic" :values="env().weather" @change="worldChanged" />
      <details class="subfold" data-scene-fold="world-weather-advanced" :open="sceneFoldOpen('world-weather-advanced')"><summary><Icon name="sliders" :size="13" aria-hidden="true" />Clima avanzado y simulación</summary>
        <ParamForm :params="weatherAdvanced" :values="env().weather" @change="worldChanged" />
      </details>
      <div class="row"><span>Viento</span><output>{{ wind()[1] }} · Beaufort {{ wind()[0] }}</output></div>
    </details>

    <details class="fold scene-section" data-scene-fold="world-sky" data-fold-default="open" :open="sceneFoldOpen('world-sky', true)">
      <summary><Icon name="sun" :size="13" aria-hidden="true" />Cielo <span v-if="sky().skyMode === 'hdri' && !panoAssets().length" class="fold-status warn">Sin panoramas HDRI</span></summary>
      <div class="section-actions"><button class="small-reset" @click="resetSection('sky')">Restablecer</button></div>
      <p class="owner-note" data-authority="sky">{{ mode() === 'manual' ? 'Iluminación manual: sol asignado.' : mode() === 'cycle' ? 'Ciclo día/noche: World controla la luz.' : 'Iluminación heredada: controles conservados.' }}</p>
      <div class="row"><span>Cielo alto</span><ColorInput :value="env().skyTop" @input="live({ skyTop: $event.target.value })" @change="done" /></div>
      <div class="row"><span>Horizonte</span><ColorInput :value="env().skyHorizon" @input="live({ skyHorizon: $event.target.value })" @change="done" /></div>
      <div class="row"><span>Suelo lejano</span><ColorInput :value="env().ground" @input="live({ ground: $event.target.value })" @change="done" /></div>
      <div class="row"><span>Color ambiente</span><ColorInput :value="env().ambientColor || env().skyHorizon" @input="live({ ambientColor: $event.target.value })" @change="done" /></div>
      <div class="row"><span>Luz ambiente</span><div class="scene-range" data-tooltip="Luz ambiente"><input type="range" aria-label="Luz ambiente" min="0" max="2" step="0.05" :value="env().ambient" @input="live({ ambient: +$event.target.value })" @change="done" /><NumberField :modelValue="env().ambient" :min="0" :max="2" :step="0.05" :decimals="2" @update:modelValue="live({ ambient: +$event })" @commit="done" /></div></div>
      <div class="row"><span>Tipo</span>
        <select :value="sky().skyMode" @change="updateEnvironment({ skyMode: $event.target.value })">
          <option value="gradient">Degradado</option><option value="physical">Físico (atmósfera)</option><option value="hdri">Panorama HDRI / imagen</option>
        </select>
      </div>
      <template v-if="sky().skyMode === 'hdri'">
        <div class="row"><span>Imagen</span>
          <select :value="sky().skyHdri" @change="updateEnvironment({ skyHdri: $event.target.value })">
            <option value="">— elegir —</option><option v-for="a in panoAssets()" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </div>
        <p v-if="!panoAssets().length" class="hint keep" role="status">Sin panoramas HDRI en Assets.</p>
        <div class="row"><span>Rotación °</span><div class="scene-range" data-tooltip="Rotación °"><input type="range" aria-label="Rotación °" min="-180" max="180" step="1" :value="sky().skyRotation" @input="live({ skyRotation: +$event.target.value })" @change="done" /><NumberField :modelValue="sky().skyRotation" :min="-180" :max="180" :step="1" :decimals="0" @update:modelValue="live({ skyRotation: +$event })" @commit="done" /></div></div>
        <div class="row"><span>Tinte</span><ColorInput :value="sky().skyTint" @input="live({ skyTint: $event.target.value })" @change="done" /></div>
      </template>
      <details v-if="sky().skyMode === 'physical'" class="subfold" data-scene-fold="world-sky-physical" :open="sceneFoldOpen('world-sky-physical')"><summary><Icon name="sliders" :size="13" aria-hidden="true" />Parámetros físicos de la atmósfera</summary>
        <div class="row"><span>Turbidez</span><div class="scene-range" data-tooltip="Turbidez"><input type="range" aria-label="Turbidez" min="1" max="20" step="0.1" :value="sky().skyTurbidity" @input="live({ skyTurbidity: +$event.target.value })" @change="done" /><NumberField :modelValue="sky().skyTurbidity" :min="1" :max="20" :step="0.1" :decimals="1" @update:modelValue="live({ skyTurbidity: +$event })" @commit="done" /></div></div>
        <div class="row"><span>Rayleigh</span><div class="scene-range" data-tooltip="Rayleigh"><input type="range" aria-label="Rayleigh" min="0" max="4" step="0.05" :value="sky().skyRayleigh" @input="live({ skyRayleigh: +$event.target.value })" @change="done" /><NumberField :modelValue="sky().skyRayleigh" :min="0" :max="4" :step="0.05" :decimals="2" @update:modelValue="live({ skyRayleigh: +$event })" @commit="done" /></div></div>
        <div class="row"><span>Mie</span><div class="scene-range" data-tooltip="Mie"><input type="range" aria-label="Mie" min="0" max="0.05" step="0.0005" :value="sky().skyMie" @input="live({ skyMie: +$event.target.value })" @change="done" /><NumberField :modelValue="sky().skyMie" :min="0" :max="0.05" :step="0.0005" :decimals="4" @update:modelValue="live({ skyMie: +$event })" @commit="done" /></div></div>
        <div class="row"><span>Mie dir. (g)</span><div class="scene-range" data-tooltip="Mie dir. (g)"><input type="range" aria-label="Mie dir. (g)" min="0" max="0.99" step="0.01" :value="sky().skyMieG" @input="live({ skyMieG: +$event.target.value })" @change="done" /><NumberField :modelValue="sky().skyMieG" :min="0" :max="0.99" :step="0.01" :decimals="2" @update:modelValue="live({ skyMieG: +$event })" @commit="done" /></div></div>
      </details>
      <div class="row"><span>Exposición</span><div class="scene-range" data-tooltip="Exposición"><input type="range" aria-label="Exposición" min="0" max="4" step="0.05" :value="sky().skyExposure" @input="live({ skyExposure: +$event.target.value })" @change="done" /><NumberField :modelValue="sky().skyExposure" :min="0" :max="4" :step="0.05" :decimals="2" @update:modelValue="live({ skyExposure: +$event })" @commit="done" /></div></div>
      <template v-if="mode() === 'legacy'">
        <div class="row"><span>Sol enlazado (legado)</span><input type="checkbox" :checked="sky().sunLink" @change="updateEnvironment({ sunLink: $event.target.checked })" /></div>
        <template v-if="!sky().sunLink">
          <div class="row"><span>Elevación °</span><div class="scene-range" data-tooltip="Elevación °"><input type="range" aria-label="Elevación °" min="-10" max="90" step="1" :value="sky().sunElevation" @input="live({ sunElevation: +$event.target.value })" @change="done" /><NumberField :modelValue="sky().sunElevation" :min="-10" :max="90" :step="1" :decimals="0" @update:modelValue="live({ sunElevation: +$event })" @commit="done" /></div></div>
          <div class="row"><span>Azimut °</span><div class="scene-range" data-tooltip="Azimut °"><input type="range" aria-label="Azimut °" min="-180" max="180" step="1" :value="sky().sunAzimuth" @input="live({ sunAzimuth: +$event.target.value })" @change="done" /><NumberField :modelValue="sky().sunAzimuth" :min="-180" :max="180" :step="1" :decimals="0" @update:modelValue="live({ sunAzimuth: +$event })" @commit="done" /></div></div>
        </template>
      </template>
    </details>

    <details class="fold" data-owner-section="clouds" data-scene-fold="world-clouds" :open="sceneFoldOpen('world-clouds')"><summary><Icon name="cloud" :size="13" aria-hidden="true" />Nubes · configuración manual</summary>
      <p class="owner-note" data-authority="clouds">{{ weatherConfigured() ? 'World puede sustituir las nubes en Play; se conservan valores manuales.' : 'Nubes: valores manuales.' }}</p>
      <div class="row"><span>Mostrar nubes</span><input type="checkbox" :checked="sky().cloudsOn" @change="updateEnvironment({ cloudsOn: $event.target.checked })" /></div>
      <template v-if="sky().cloudsOn">
        <div class="row"><span>Preset</span>
          <select :value="sky().cloudsPreset" @change="setPreset($event.target.value)">
            <option v-for="(c, k) in CLOUD_PRESETS" :key="k" :value="k">{{ c.label }}</option><option value="custom">Personalizado</option>
          </select>
        </div>
        <div class="row"><span>Cobertura</span><div class="scene-range" data-tooltip="Cobertura"><input type="range" aria-label="Cobertura" min="0" max="1" step="0.01" :value="sky().cloudsCoverage" @input="cloudEdit({ cloudsCoverage: +$event.target.value })" @change="done" /><NumberField :modelValue="sky().cloudsCoverage" :min="0" :max="1" :step="0.01" :decimals="2" @update:modelValue="cloudEdit({ cloudsCoverage: +$event })" @commit="done" /></div></div>
        <div class="row"><span>Densidad</span><div class="scene-range" data-tooltip="Densidad"><input type="range" aria-label="Densidad" min="0" max="3" step="0.05" :value="sky().cloudsDensity" @input="cloudEdit({ cloudsDensity: +$event.target.value })" @change="done" /><NumberField :modelValue="sky().cloudsDensity" :min="0" :max="3" :step="0.05" :decimals="2" @update:modelValue="cloudEdit({ cloudsDensity: +$event })" @commit="done" /></div></div>
        <div class="row"><span>Altitud (m)</span><div class="scene-range" data-tooltip="Altitud (m)"><input type="range" aria-label="Altitud (m)" min="300" max="6000" step="50" :value="sky().cloudsAltitude" @input="cloudEdit({ cloudsAltitude: +$event.target.value })" @change="done" /><NumberField :modelValue="sky().cloudsAltitude" :min="300" :max="6000" :step="50" :decimals="0" @update:modelValue="cloudEdit({ cloudsAltitude: +$event })" @commit="done" /></div></div>
        <div class="row"><span>Grosor (m)</span><div class="scene-range" data-tooltip="Grosor (m)"><input type="range" aria-label="Grosor (m)" min="200" max="4000" step="50" :value="sky().cloudsThickness" @input="cloudEdit({ cloudsThickness: +$event.target.value })" @change="done" /><NumberField :modelValue="sky().cloudsThickness" :min="200" :max="4000" :step="50" :decimals="0" @update:modelValue="cloudEdit({ cloudsThickness: +$event })" @commit="done" /></div></div>
        <div class="row"><span>Tamaño</span><div class="scene-range" data-tooltip="Tamaño"><input type="range" aria-label="Tamaño" min="0.3" max="3" step="0.05" :value="sky().cloudsScale" @input="cloudEdit({ cloudsScale: +$event.target.value })" @change="done" /><NumberField :modelValue="sky().cloudsScale" :min="0.3" :max="3" :step="0.05" :decimals="2" @update:modelValue="cloudEdit({ cloudsScale: +$event })" @commit="done" /></div></div>
        <div class="row"><span>Erosión</span><div class="scene-range" data-tooltip="Erosión"><input type="range" aria-label="Erosión" min="0" max="1" step="0.01" :value="sky().cloudsErosion" @input="cloudEdit({ cloudsErosion: +$event.target.value })" @change="done" /><NumberField :modelValue="sky().cloudsErosion" :min="0" :max="1" :step="0.01" :decimals="2" @update:modelValue="cloudEdit({ cloudsErosion: +$event })" @commit="done" /></div></div>
        <div class="row"><span>Viento (m/s)</span><div class="scene-range" data-tooltip="Viento (m/s)"><input type="range" aria-label="Viento (m/s)" min="0" max="80" step="1" :value="sky().cloudsWind" @input="live({ cloudsWind: +$event.target.value })" @change="done" /><NumberField :modelValue="sky().cloudsWind" :min="0" :max="80" :step="1" :decimals="0" @update:modelValue="live({ cloudsWind: +$event })" @commit="done" /></div></div>
        <div class="row"><span>Dirección °</span><div class="scene-range" data-tooltip="Dirección °"><input type="range" aria-label="Dirección °" min="-180" max="180" step="1" :value="sky().cloudsWindDir" @input="live({ cloudsWindDir: +$event.target.value })" @change="done" /><NumberField :modelValue="sky().cloudsWindDir" :min="-180" :max="180" :step="1" :decimals="0" @update:modelValue="live({ cloudsWindDir: +$event })" @commit="done" /></div></div>
        <div class="row"><span>Luz del sol</span><div class="scene-range" data-tooltip="Luz del sol"><input type="range" aria-label="Luz del sol" min="0" max="3" step="0.05" :value="sky().cloudsLight" @input="live({ cloudsLight: +$event.target.value })" @change="done" /><NumberField :modelValue="sky().cloudsLight" :min="0" :max="3" :step="0.05" :decimals="2" @update:modelValue="live({ cloudsLight: +$event })" @commit="done" /></div></div>
        <div class="row"><span>Tinte</span><ColorInput :value="sky().cloudsTint" @input="cloudEdit({ cloudsTint: $event.target.value })" @change="done" /></div>

      </template>
    </details>

    <details class="fold" data-scene-fold="world-volumetric" :open="sceneFoldOpen('world-volumetric')"><summary><Icon name="atmovolume" :size="13" aria-hidden="true" />Niebla volumétrica</summary>
      <div class="row"><span>Activada</span><input type="checkbox" :checked="vol().volOn" @change="updateEnvironment({ volOn: $event.target.checked })" /></div>
      <template v-if="vol().volOn">
        <div class="row"><span>Densidad</span><div class="scene-range" data-tooltip="Densidad"><input type="range" aria-label="Densidad" min="0" max="0.2" step="0.001" :value="vol().volDensity" @input="live({ volDensity: +$event.target.value })" @change="done" /><NumberField :modelValue="vol().volDensity" :min="0" :max="0.2" :step="0.001" :decimals="3" @update:modelValue="live({ volDensity: +$event })" @commit="done" /></div></div>
        <div class="row"><span>Anisotropía</span><div class="scene-range" data-tooltip="Anisotropía"><input type="range" aria-label="Anisotropía" min="-0.9" max="0.95" step="0.01" :value="vol().volAniso" @input="live({ volAniso: +$event.target.value })" @change="done" data-tooltip="Positivo: los haces brillan al mirar hacia la luz" /><NumberField :modelValue="vol().volAniso" :min="-0.9" :max="0.95" :step="0.01" :decimals="2" @update:modelValue="live({ volAniso: +$event })" @commit="done" /></div></div>
        <div class="row"><span>Distancia (m)</span><div class="scene-range" data-tooltip="Distancia (m)"><input type="range" aria-label="Distancia (m)" min="5" max="300" step="1" :value="vol().volDistance" @input="live({ volDistance: +$event.target.value })" @change="done" /><NumberField :modelValue="vol().volDistance" :min="5" :max="300" :step="1" :decimals="0" @update:modelValue="live({ volDistance: +$event })" @commit="done" /></div></div>
        <div class="row"><span>Intensidad</span><div class="scene-range" data-tooltip="Intensidad"><input type="range" aria-label="Intensidad" min="0" max="5" step="0.05" :value="vol().volIntensity" @input="live({ volIntensity: +$event.target.value })" @change="done" /><NumberField :modelValue="vol().volIntensity" :min="0" :max="5" :step="0.05" :decimals="2" @update:modelValue="live({ volIntensity: +$event })" @commit="done" /></div></div>
        <div class="row"><span>Luz ambiente</span><div class="scene-range" data-tooltip="Luz ambiente"><input type="range" aria-label="Luz ambiente" min="0" max="3" step="0.05" :value="vol().volAmbient" @input="live({ volAmbient: +$event.target.value })" @change="done" /><NumberField :modelValue="vol().volAmbient" :min="0" :max="3" :step="0.05" :decimals="2" @update:modelValue="live({ volAmbient: +$event })" @commit="done" /></div></div>
        <div class="row"><span>Color</span><ColorInput :value="vol().volColor" @input="live({ volColor: $event.target.value })" @change="done" /></div>
        <div class="row"><span>Altura base (m)</span><div class="scene-range" data-tooltip="Altura base (m)"><input type="range" aria-label="Altura base (m)" min="-50" max="200" step="1" :value="vol().volHeight" @input="live({ volHeight: +$event.target.value })" @change="done" /><NumberField :modelValue="vol().volHeight" :min="-50" :max="200" :step="1" :decimals="0" @update:modelValue="live({ volHeight: +$event })" @commit="done" /></div></div>
        <div class="row"><span>Caída con altura</span><div class="scene-range" data-tooltip="Caída con altura"><input type="range" aria-label="Caída con altura" min="0" max="1" step="0.01" :value="vol().volFalloff" @input="live({ volFalloff: +$event.target.value })" @change="done" data-tooltip="0 = niebla uniforme; mayor = se concentra por debajo de la altura base" /><NumberField :modelValue="vol().volFalloff" :min="0" :max="1" :step="0.01" :decimals="2" @update:modelValue="live({ volFalloff: +$event })" @commit="done" /></div></div>
        <div class="row"><span>Ruido (bancos)</span><div class="scene-range" data-tooltip="Ruido (bancos)"><input type="range" aria-label="Ruido (bancos)" min="0" max="1" step="0.02" :value="vol().volNoise" @input="live({ volNoise: +$event.target.value })" @change="done" data-tooltip="0 = niebla lisa; más = bancos de niebla irregulares que el viento arrastra" /><NumberField :modelValue="vol().volNoise" :min="0" :max="1" :step="0.02" :decimals="2" @update:modelValue="live({ volNoise: +$event })" @commit="done" /></div></div>
        <template v-if="vol().volNoise > 0">
          <div class="row"><span>Tamaño (m)</span><div class="scene-range" data-tooltip="Tamaño (m)"><input type="range" aria-label="Tamaño (m)" min="1" max="100" step="1" :value="vol().volNoiseScale" @input="live({ volNoiseScale: +$event.target.value })" @change="done" /><NumberField :modelValue="vol().volNoiseScale" :min="1" :max="100" :step="1" :decimals="0" @update:modelValue="live({ volNoiseScale: +$event })" @commit="done" /></div></div>
          <div class="row"><span>Velocidad (m/s)</span><div class="scene-range" data-tooltip="Velocidad (m/s)"><input type="range" aria-label="Velocidad (m/s)" min="0" max="15" step="0.1" :value="vol().volNoiseSpeed" @input="live({ volNoiseSpeed: +$event.target.value })" @change="done" data-tooltip="Con el clima activo, la dirección es la del viento" /><NumberField :modelValue="vol().volNoiseSpeed" :min="0" :max="15" :step="0.1" :decimals="1" @update:modelValue="live({ volNoiseSpeed: +$event })" @commit="done" /></div></div>
        </template>
        <p class="hint keep" role="status">Haces visibles: requiere luces volumétricas y calidad Media o Alta.</p>
      </template>
    </details>

    <details class="fold" data-owner-section="fog" data-scene-fold="world-fog" :open="sceneFoldOpen('world-fog')"><summary><Icon name="cloud" :size="13" aria-hidden="true" />Niebla</summary>
      <p class="owner-note" data-authority="fog">{{ weatherConfigured() ? 'World puede sustituir densidad, color y estado de niebla.' : clockConfigured() ? 'Ciclo celestial activo: World puede ajustar el color de niebla.' : 'Niebla: valores manuales.' }}</p>
      <div class="row"><span>Activada</span><input type="checkbox" :checked="env().fog" @change="updateEnvironment({ fog: $event.target.checked })" /></div>
      <template v-if="env().fog">
        <div class="row"><span>Color</span><ColorInput :value="env().fogColor" @input="live({ fogColor: $event.target.value })" @change="done" /></div>
        <div class="row"><span>Densidad</span><div class="scene-range" data-tooltip="Densidad"><input type="range" aria-label="Densidad" min="0.001" max="0.08" step="0.001" :value="env().fogDensity" @input="live({ fogDensity: +$event.target.value })" @change="done" /><NumberField :modelValue="env().fogDensity" :min="0.001" :max="0.08" :step="0.001" :decimals="3" @update:modelValue="live({ fogDensity: +$event })" @commit="done" /></div></div>
        <div class="row"><span>Empieza a (m)</span><div class="scene-range" data-tooltip="Empieza a (m)"><input type="range" aria-label="Empieza a (m)" min="0" max="200" step="1" :value="env().fogStart || 0" @input="live({ fogStart: +$event.target.value })" @change="done" /><NumberField :modelValue="env().fogStart || 0" :min="0" :max="200" :step="1" :decimals="0" @update:modelValue="live({ fogStart: +$event })" @commit="done" /></div></div>
        <div class="row"><span>Modelo</span><select :value="fogx().fogMode" @change="updateEnvironment({ fogMode: $event.target.value })" data-tooltip="Simple: exponencial uniforme. Física: la niebla se espesa abajo, depende de la humedad y se ilumina con el sol"><option v-for="[k, l] in FOG_MODES" :key="k" :value="k">{{ l }}</option></select></div>
        <template v-if="fogx().fogMode === 'physical'">
          <div class="row"><span>Caída con la altura · {{ fogx().fogFalloff ? fogx().fogFalloff.toFixed(5) : 'auto' }}</span><div class="scene-range" data-tooltip="Caída con la altura"><input type="range" aria-label="Caída con la altura" min="0" max="0.01" step="0.00005" :value="fogx().fogFalloff" @input="live({ fogFalloff: +$event.target.value })" @change="done" data-tooltip="1/m. 0 = automática: 0,00085 con aire seco y 0,00185 con aire saturado (la niebla se pega al suelo)" /><NumberField :modelValue="fogx().fogFalloff" :min="0" :max="0.01" :step="0.00005" :decimals="5" @update:modelValue="live({ fogFalloff: +$event })" @commit="done" /></div></div>
          <div class="row"><span>Altura base (m)</span><div class="scene-range" data-tooltip="Altura base (m)"><input type="range" aria-label="Altura base (m)" min="-50" max="500" step="1" :value="fogx().fogHeight" @input="live({ fogHeight: +$event.target.value })" @change="done" data-tooltip="Por debajo de esta altura la niebla tiene su densidad máxima; por encima decae" /><NumberField :modelValue="fogx().fogHeight" :min="-50" :max="500" :step="1" :decimals="0" @update:modelValue="live({ fogHeight: +$event })" @commit="done" /></div></div>
          <div class="row"><span>Haces de sol · {{ fogx().fogShafts.toFixed(2) }}</span><div class="scene-range" data-tooltip="Haces de sol"><input type="range" aria-label="Haces de sol" min="0" max="3" step="0.05" :value="fogx().fogShafts" @input="live({ fogShafts: +$event.target.value })" @change="done" /><NumberField :modelValue="fogx().fogShafts" :min="0" :max="3" :step="0.05" :decimals="2" @update:modelValue="live({ fogShafts: +$event })" @commit="done" /></div></div>
          <div class="row"><span>Luz del sol · {{ fogx().fogScatter.toFixed(2) }}</span><div class="scene-range" data-tooltip="Luz del sol"><input type="range" aria-label="Luz del sol" min="0" max="3" step="0.05" :value="fogx().fogScatter" @input="live({ fogScatter: +$event.target.value })" @change="done" data-tooltip="Cuánta luz del sol dispersa la niebla hacia la cámara (más brillo mirando hacia el sol)" /><NumberField :modelValue="fogx().fogScatter" :min="0" :max="3" :step="0.05" :decimals="2" @update:modelValue="live({ fogScatter: +$event })" @commit="done" /></div></div>
          <p class="hint keep" role="status">Niebla física: requiere calidad Media o Alta.</p>
        </template>
      </template>
    </details>

    <details class="fold" data-scene-fold="world-water" :open="sceneFoldOpen('world-water')"><summary><Icon name="water" :size="13" aria-hidden="true" />Agua y terreno</summary>
      <div class="row"><span>Reaccionan entre sí</span><input type="checkbox" :checked="fx().wfOn" @change="updateEnvironment({ wfOn: $event.target.checked })" data-tooltip="Orilla mojada, color del fondo y espuma de orilla según la profundidad real" /></div>
      <template v-if="fx().wfOn">
        <div class="row"><span>Franja mojada (m)</span><div class="scene-range" data-tooltip="Franja mojada (m)"><input type="range" aria-label="Franja mojada (m)" min="0" max="3" step="0.05" :value="fx().wfWetBand" @input="live({ wfWetBand: +$event.target.value })" @change="done" /><NumberField :modelValue="fx().wfWetBand" :min="0" :max="3" :step="0.05" :decimals="2" @update:modelValue="live({ wfWetBand: +$event })" @commit="done" /></div></div>
        <div class="row"><span>Oscurecer mojado</span><div class="scene-range" data-tooltip="Oscurecer mojado"><input type="range" aria-label="Oscurecer mojado" min="0" max="0.9" step="0.02" :value="fx().wfWetDarken" @input="live({ wfWetDarken: +$event.target.value })" @change="done" /><NumberField :modelValue="fx().wfWetDarken" :min="0" :max="0.9" :step="0.02" :decimals="2" @update:modelValue="live({ wfWetDarken: +$event })" @commit="done" /></div></div>
        <div class="row"><span>Brillo mojado</span><div class="scene-range" data-tooltip="Brillo mojado"><input type="range" aria-label="Brillo mojado" min="0" max="1" step="0.02" :value="fx().wfWetGloss" @input="live({ wfWetGloss: +$event.target.value })" @change="done" /><NumberField :modelValue="fx().wfWetGloss" :min="0" :max="1" :step="0.02" :decimals="2" @update:modelValue="live({ wfWetGloss: +$event })" @commit="done" /></div></div>
        <div class="row"><span>Color del fondo</span><ColorInput :value="fx().wfTint" @input="live({ wfTint: $event.target.value })" @change="done" /></div>
        <div class="row"><span>Absorción</span><div class="scene-range" data-tooltip="Absorción"><input type="range" aria-label="Absorción" min="0" max="2" step="0.02" :value="fx().wfAbsorb" @input="live({ wfAbsorb: +$event.target.value })" @change="done" /><NumberField :modelValue="fx().wfAbsorb" :min="0" :max="2" :step="0.02" :decimals="2" @update:modelValue="live({ wfAbsorb: +$event })" @commit="done" /></div></div>
      </template>
    </details>

    </details>
    <details class="ownership-group" data-owner-group="resources" data-scene-fold="group-resources" data-fold-default="open" :open="sceneFoldOpen('group-resources', true)">
      <summary class="owner-heading"><Icon name="light" :size="13" aria-hidden="true" /><strong>Recursos de iluminación</strong><span v-if="store.bake.state.stale || paramsChanged()" class="fold-status warn" role="status">Horneado desactualizado</span></summary>
    <details class="fold" data-scene-fold="resources-bake" :open="sceneFoldOpen('resources-bake')"><summary><Icon name="light" :size="13" aria-hidden="true" />Iluminación horneada</summary>
      <template v-if="store.bake.running">
        <div class="bkprog scene-bake-progress" role="progressbar" :aria-valuenow="pct()" aria-valuemin="0" aria-valuemax="100"><div :style="{ width: pct() + '%' }"></div></div>
        <p class="hint keep">{{ store.bake.label }} · {{ pct() }} %</p>
        <button @click="cancelBake">Cancelar</button>
      </template>
      <template v-else>
        <div class="row"><span>Muestras</span>
          <select :value="bk().samples" @change="updateBake({ samples: +$event.target.value })"><option v-for="n in [16, 32, 64, 128, 256, 512, 1024]" :key="n" :value="n">{{ n }}</option></select></div>
        <div class="row"><span>Rebotes</span><div class="scene-range" data-tooltip="Rebotes"><input type="range" aria-label="Rebotes" min="1" max="6" step="1" :value="bk().bounces" @input="updateBake({ bounces: +$event.target.value })" /><NumberField :modelValue="bk().bounces" :min="1" :max="6" :step="1" :decimals="0" @update:modelValue="updateBake({ bounces: +$event })" /></div></div>
        <div class="row"><span>Texels / m</span><div class="scene-range" data-tooltip="Texels / m"><input type="range" aria-label="Texels / m" min="2" max="32" step="1" :value="bk().density" @input="updateBake({ density: +$event.target.value })" /><NumberField :modelValue="bk().density" :min="2" :max="32" :step="1" :decimals="0" @update:modelValue="updateBake({ density: +$event })" /></div></div>
        <div class="row"><span>Lightmap máx.</span>
          <select :value="bk().maxSize" @change="updateBake({ maxSize: +$event.target.value })"><option v-for="n in [128, 256, 512, 1024, 2048]" :key="n" :value="n">{{ n }}</option></select></div>
        <div class="row"><span>Sondas (m)</span><div class="scene-range" data-tooltip="Sondas (m)"><input type="range" aria-label="Sondas (m)" min="1" max="10" step="0.5" :value="bk().probeSpacing" @input="updateBake({ probeSpacing: +$event.target.value })" /><NumberField :modelValue="bk().probeSpacing" :min="1" :max="10" :step="0.5" :decimals="1" @update:modelValue="updateBake({ probeSpacing: +$event })" /></div></div>
        <div class="row"><span>Luz del cielo</span><div class="scene-range" data-tooltip="Luz del cielo"><input type="range" aria-label="Luz del cielo" min="0" max="3" step="0.05" :value="bk().skyIntensity" @input="updateBake({ skyIntensity: +$event.target.value })" /><NumberField :modelValue="bk().skyIntensity" :min="0" :max="3" :step="0.05" :decimals="2" @update:modelValue="updateBake({ skyIntensity: +$event })" /></div></div>
        <div class="row"><span>Reducir ruido</span><input type="checkbox" :checked="bk().denoise" @change="updateBake({ denoise: $event.target.checked })" /></div>
        <div class="row"><span>Radio luces</span><div class="scene-range" data-tooltip="Radio luces"><input type="range" aria-label="Radio luces" min="0" max="1" step="0.02" :value="bk().lightRadius" @input="updateBake({ lightRadius: +$event.target.value })" data-tooltip="Tamaño de las luces de punto: más radio = sombras más suaves" /><NumberField :modelValue="bk().lightRadius" :min="0" :max="1" :step="0.02" :decimals="2" @update:modelValue="updateBake({ lightRadius: +$event })" /></div></div>
        <div class="row"><span>Uso de GPU</span>
          <select :value="bk().gpuUsage" data-tooltip="Parte del tiempo de GPU que puede usar el horneado. Menos = el editor sigue fluido mientras hornea (tarda más)." @change="updateBake({ gpuUsage: +$event.target.value })">
            <option :value="0.25">Bajo (25 %)</option><option :value="0.5">Medio (50 %)</option><option :value="0.75">Alto (75 %)</option><option :value="1">Máximo (100 %)</option></select></div>

        <div class="bkbtns">
          <button class="primary" data-tooltip="El trazado y la generación de UV se ejecutan en segundo plano." @click="runBake">{{ baked() ? 'Volver a hornear' : 'Hornear iluminación' }}</button>
          <button v-if="baked()" @click="clearBake">Limpiar</button>
        </div>
        <template v-if="baked()">
          <div class="row"><span>Ver horneado</span><input type="checkbox" :checked="store.view.bake" @change="store.view.bake = $event.target.checked" /></div>
          <p class="hint keep scene-bake-result">{{ Object.keys(baked().lightmaps).length }} lightmaps · {{ baked().stats?.probes || 0 }} sondas<template v-if="baked().stats?.seconds"> · {{ baked().stats.seconds.toFixed(1) }} s</template>. Archivos en Assets/Lightmaps. {{ baked().lights?.length ? baked().lights.length + ' luz(es) estática(s) + cielo.' : 'Solo cielo (sin luces Estáticas/Mixtas).' }}</p>
          <p v-if="store.bake.state.stale || paramsChanged()" class="hint warn">El bake está desactualizado (cambió la geometría o los ajustes): vuelve a hornear.</p>
        </template>
        <div class="row"><span>Luces de bake</span><output>{{ lightsInfo().baked }} estáticas · {{ lightsInfo().mixed }} mixtas</output></div>
      </template>
    </details>

    </details>
    <!-- OBSOLETO y oculto: ruta res:// de la antigua exportación a Godot -->
    <section v-if="false">
      <h4>Exportación</h4>
      <div class="row"><span>Ruta res://</span><input type="text" :value="store.project.settings.exportPath" @change="updateSettings({ exportPath: $event.target.value })" /></div>
      <p class="hint lf-help">Carpeta de tu proyecto Godot donde copiarás el nivel (el exportador añade el nombre del nivel).</p>
    </section>
  </div>
</template>

<style scoped>
.terrain-bake-actions { display:grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap:6px; margin:9px 0 6px; }
.terrain-bake-actions > :only-child { grid-column:1 / -1; }
.terrain-bake-action { min-width:0; width:100%; white-space:normal; overflow-wrap:anywhere; min-height:30px; padding:5px 7px; cursor:pointer; transition:background-color 110ms ease, border-color 110ms ease, filter 110ms ease; }
.terrain-bake-action:hover:not(:disabled) { filter:brightness(1.12); }
.terrain-bake-action:active:not(:disabled) { filter:brightness(.86); }
.terrain-bake-action:focus-visible { outline:2px solid var(--blue); outline-offset:2px; }
.terrain-bake-action:disabled { cursor:not-allowed; opacity:.48; }
.terrain-bake-stats { display:grid; grid-template-columns: 1fr auto; gap:3px 10px; margin-top:8px; color:var(--text-3); font-size:11px; }
.terrain-bake-stats span { display:contents; }
.terrain-bake-stats b { color:var(--text); font-variant-numeric:tabular-nums; text-align:right; white-space:nowrap; }
.terrain-bake-warning { margin-top:5px; color:var(--amber); font-size:11px; }
@media (max-width:300px) { .terrain-bake-actions { grid-template-columns:minmax(0,1fr); } }
.ownership-group { margin: 8px 8px 10px; border: 1px solid var(--hair); border-radius: 4px; overflow: hidden; min-width: 0; }
.owner-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 5px 8px; padding: 8px 10px; background: var(--g-800); border-bottom: 1px solid var(--hair); cursor: pointer; }
.owner-heading strong { font-size: 12px; color: var(--text); }
.owner-heading span { font-size: 10px; color: var(--text-3); }
.owner-note { padding: 6px 8px; margin: 2px 0 8px; border-left: 2px solid var(--hair); background: var(--g-800); color: var(--text-3); font-size: 11px; line-height: 1.45; }
.sp { min-width: 0; overflow-wrap: anywhere; }
.sp :deep(select), .sp :deep(input) { min-width: 0; max-width: 100%; }
@media (max-width: 450px) { .row { grid-template-columns: minmax(0, 96px) minmax(0, 1fr); } }
.section-actions { display: flex; justify-content: flex-end; margin: 2px 0 8px; }
.small-reset { font-size: 10px; padding: 3px 7px; opacity: 0.85; }
.fold, .scene-section { padding: 8px 10px; border-bottom: 1px solid var(--hair); }
.fold > summary, .subfold > summary, .scene-section > summary { cursor: pointer; font-size: 12px; color: var(--text-2); font-weight: 600; padding: 4px 0; }
.subfold { margin-top: 7px; margin-bottom: 8px; padding: 4px 0; }
section { padding: 8px 10px 10px; border-bottom: 1px solid var(--hair); }
h4 { margin: 2px 0 8px; font-size: 12px; font-weight: 600; color: var(--text-3); }
.sp details > summary { list-style: none; display: flex; align-items: center; gap: 7px; min-width: 0; }
.sp details > summary::-webkit-details-marker { display: none; }
.sp details > summary::before { content: ''; display: inline-block; width: 6px; height: 6px; flex: none; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(-45deg); transition: transform 100ms ease; }
.sp details[open] > summary::before { transform: rotate(45deg); }
.sp details > summary:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
.fold-status { margin-left: auto; font-size: 10px; font-weight: 500; color: var(--text-3); }
.fold-status.warn { color: var(--text); }
.sp output { font-size: 11px; color: var(--text-2); min-width: 0; overflow-wrap: anywhere; }

.row { display: grid; grid-template-columns: minmax(0, 96px) minmax(0, 1fr); align-items: center; gap: 8px; margin-bottom: 6px; }
.row > span { color: var(--text-3); font-size: 12px; }
.row input[type='text'], .row select { width: 100%; }
.hint { margin: 4px 0 0; font-size: 11px; color: var(--text-3); }

.sp { container: scene-inspector / inline-size; }
.sp details[hidden] { display: none !important; }
.ownership-group { margin: 5px 5px 10px; border-color: transparent; }
.owner-heading { background: transparent; border-bottom-color: var(--hair); padding: 5px 3px; }
.owner-heading strong { font-size: 11px; text-transform: uppercase; letter-spacing: .035em; color: var(--text-3); }
.fold, .scene-section { margin: 3px 0; padding: 0 4px 4px; border: 0; }
.fold > summary, .scene-section > summary { background: var(--g-800); border-radius: 4px; padding: 6px; margin-bottom: 5px; color: var(--text); }
.subfold { border-top: 1px solid var(--hair); padding: 4px 0; margin: 5px 0; }
.subfold > summary { padding: 5px 2px; font-size: 11px; }
.sp details > summary > svg { flex: none; color: var(--text-3); }
.row { grid-template-columns: minmax(0, var(--lf-property-label-width, 112px)) minmax(0, 1fr); gap: 6px; min-height: 25px; margin-bottom: 3px; }
.row > span { overflow-wrap: anywhere; line-height: 1.25; }
.row select { text-overflow: ellipsis; }
.scene-range { display: grid; grid-template-columns: minmax(0, 1fr) minmax(44px, 64px); align-items: center; gap: 4px; min-width: 0; }
.scene-range > input { width: 100%; min-width: 0; }
.scene-range :deep(.nf) { min-width: 0; }
.scene-range :deep(.nf input) { padding: 3px 4px; font-variant-numeric: tabular-nums; }
.scene-clock { background: var(--g-900); border: 1px solid var(--hair); border-radius: 4px; padding: 7px; margin-bottom: 6px; }
.clock-head, .clock-ticks { display: flex; justify-content: space-between; gap: 3px; color: var(--text-3); font-size: 10px; font-variant-numeric: tabular-nums; }
.clock-head { margin-bottom: 6px; }
.clock-band { position: relative; margin: 0 3px; height: 25px; border-radius: 3px; background: linear-gradient(90deg,#29334e 0%,#29334e 14%,#c38d71 25%,#82b3d5 50%,#ba886a 75%,#29334e 86%); }
.clock-band i { position: absolute; top: -2px; bottom: -2px; width: 2px; transform: translateX(-50%); background: white; box-shadow: 0 0 2px #111; }
.clock-ticks { margin: 4px 0 5px; }
.section-actions { margin: 2px 0 5px; }
.small-reset { padding: 3px 6px; }
.owner-note { background: transparent; border-left: 2px solid var(--hair); padding: 3px 5px; margin: 2px 0 5px; }
.scene-bake-progress { overflow: hidden; height: 5px; background: var(--g-800); border-radius: 3px; }
.scene-bake-progress > div { background: var(--blue); height: 100%; }
.scene-bake-result { border: 1px solid var(--hair); border-radius: 4px; padding: 5px; }
.bkbtns, .btns { display: flex; flex-wrap: wrap; gap: 4px; min-width: 0; }
.bkbtns > button, .btns > button { flex: 1; min-width: 0; white-space: normal; }
@container scene-inspector (max-width: 260px) {
  .row { grid-template-columns: minmax(0, 1fr); gap: 3px; }
  .row > input[type='checkbox'] { justify-self: start; }
  .terrain-bake-actions { grid-template-columns: minmax(0, 1fr); }
  .owner-heading { flex-wrap: wrap; }
}
</style>
