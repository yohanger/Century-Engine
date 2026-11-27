<script setup>
import AppWindow from './AppWindow.vue'
import { ref, computed, reactive, watch, onMounted } from 'vue'
import * as db from '../core/db.js'
import { store, toast, updateSettings, saveNow, assetImage, chooseGodotFolder, getGodotLoc } from '../core/store.js'
import { exportScenesZip, exportScenesFiles } from '../core/exporter.js'
import * as disk from '../core/disk.js'
import { mergePieces, deserializeAll } from '../engine/runtime/geometry/terrains.js'
import { downloadBlob, slug } from '../engine/runtime/util.js'

const busy = ref(false)
const resPath = ref(store.project.settings.exportPath)
// escenas marcadas para exportar (por defecto, la activa)
const picked = reactive(Object.fromEntries(store.project.scenes.map((s) => [s.id, s.id === store.project.activeSceneId])))
const chosen = computed(() => store.project.scenes.filter((s) => picked[s.id]))
const allOn = computed(() => chosen.value.length === store.project.scenes.length)
function toggleAll() { for (const s of store.project.scenes) picked[s.id] = !allOn.value }

const slugName = computed(() => slug(chosen.value.length === 1 ? chosen.value[0].name : store.project.name))

const counts = computed(() => {
  const c = { group: 0, primitive: 0, mesh: 0, text: 0, light: 0, spawn: 0, camera: 0, trigger: 0, model: 0 }
  // el recuento exacto solo se conoce de la escena activa; las demás aportan su nº de nodos
  for (const o of store.project.objects) c[o.type] = (c[o.type] || 0) + 1
  return c
})
const warnings = computed(() => {
  const w = []
  if (!chosen.value.length) w.push('Marca al menos una escena.')
  if (picked[store.project.activeSceneId]) {
    const o = store.project.objects
    if (!store.project.scenes.find(s => s.id === store.project.activeSceneId)?.playerNodeId && store.project.scenes.find(s => s.id === store.project.activeSceneId)?.playerSpawnMode !== 'api') w.push('La escena activa no tiene CharacterBody3D designado ni aparición por API.')
    if (!o.some((x) => x.type === 'light' && x.light.type === 'directional')) w.push('La escena activa no tiene luz direccional (sol).')
  }
  if (!/^res:\/\//.test(resPath.value)) w.push('La ruta debe empezar por res://')
  return w
})

const canDisk = disk.canDisk()
async function pickGodot() { try { await chooseGodotFolder(); await refreshDirs(true) } catch (e) { toast(e.message, 'error', 5000) } }

// ---- explorador de carpetas del proyecto Godot ----
const HIDE = new Set(['.godot', '.git', '.import', '.idea', '.vscode', 'node_modules', 'android', 'ios'])
const cur = ref('') // carpeta que se está viendo, relativa a res://
const dirs = ref([])
const relOf = (v) => v.replace(/^res:\/\//, '').split('/').filter(Boolean)
const crumbs = computed(() => { const p = relOf(cur.value); return p.map((n, i) => ({ n, rel: p.slice(0, i + 1).join('/') })) })
async function refreshDirs(fromPath = false) {
  const loc = getGodotLoc()
  if (!loc) { dirs.value = []; return }
  if (fromPath) { // sube hasta la carpeta más profunda que ya existe
    let parts = relOf(resPath.value)
    while (parts.length && !(await disk.exists(loc, parts.join('/')))) parts.pop()
    cur.value = parts.join('/')
  }
  dirs.value = (await disk.listDirs(loc, cur.value)).filter((d) => !HIDE.has(d)).sort((a, b) => a.localeCompare(b))
}
async function go(rel) { cur.value = rel; resPath.value = 'res://' + rel; await refreshDirs() }
function up() { go(relOf(cur.value).slice(0, -1).join('/')) }
const newName = ref('')
function makeNew() {
  const n = slug(newName.value)
  if (!n) return
  resPath.value = 'res://' + [cur.value, n].filter(Boolean).join('/')
  newName.value = ''
}
onMounted(() => refreshDirs(true))
watch(() => store.godotName, () => refreshDirs(true))

async function run(mode = 'godot') {
  if (mode === 'godot' && !getGodotLoc()) { await pickGodot(); if (!getGodotLoc()) return }
  busy.value = true
  try {
    updateSettings({ exportPath: resPath.value })
    await saveNow()
    const p = store.project
    const models = new Map()
    for (const a of await db.listAssets(p.id)) {
      const m = p.models.find((x) => x.id === a.assetId)
      if (m) models.set(a.assetId, { name: m.name, bytes: a.bytes })
    }
    const items = []
    const temp = []
    for (const s of chosen.value) {
      let project, terrain
      if (s.id === p.activeSceneId) {
        project = { ...JSON.parse(JSON.stringify(p)), name: s.name }
        terrain = mergePieces(store.editor.terrains)
      } else {
        const r = await db.loadScene(p.id, s.id)
        if (!r) throw new Error(`No se pudo leer la escena «${s.name}»`)
        const pieces = deserializeAll(r.terrain)
        terrain = mergePieces(pieces)
        temp.push(...pieces)
        if (!pieces.includes(terrain)) temp.push(terrain)
        project = { ...JSON.parse(JSON.stringify(p)), name: s.name, objects: r.objects, environment: r.environment, terrain: { size: terrain.size, segments: terrain.segments, layers: r.terrain.layers } }
      }
      items.push({ project, terrain })
    }
    // texturas de vegetación → PNG (con su alfa) para incrustarlas en los GLB
    const foliageTextures = new Map()
    for (const { terrain } of items) {
      for (const cfg of terrain.foliage.list) {
        if (cfg.source !== 'texture' || !cfg.texture || foliageTextures.has(cfg.texture) || !terrain.foliage.countOf(cfg.id)) continue
        const img = await assetImage(cfg.texture)
        if (!img) continue
        const c = document.createElement('canvas')
        c.width = img.naturalWidth; c.height = img.naturalHeight
        c.getContext('2d').drawImage(img, 0, 0)
        const png = await new Promise((r) => c.toBlob(r, 'image/png'))
        foliageTextures.set(cfg.texture, { bytes: new Uint8Array(await png.arrayBuffer()), width: c.width, height: c.height })
      }
    }
    const toPng = async (id) => {
      if (!id || foliageTextures.has(id)) return
      const img = await assetImage(id)
      if (!img) return
      const c = document.createElement('canvas')
      c.width = img.naturalWidth; c.height = img.naturalHeight
      c.getContext('2d').drawImage(img, 0, 0)
      const png = await new Promise((r) => c.toBlob(r, 'image/png'))
      foliageTextures.set(id, { bytes: new Uint8Array(await png.arrayBuffer()), width: c.width, height: c.height })
    }
    for (const { terrain } of items) for (const l of terrain.layers) await toPng(l.texture) // texturas de las capas de pintura
    for (const { project } of items) for (const o of project.objects) {
      if (o.type !== 'road') continue
      for (const s of Object.values(o.props.slots || {})) {
        if (!s.texture) continue
        await toPng(s.texture)
        if (!foliageTextures.has(s.texture)) throw new Error(`Carretera «${o.name}»: textura inexistente (${s.texture})`)
      }
    }
    const opts = { projectName: p.name, resPath: resPath.value, foliageTextures }
    let summary, msg
    if (mode === 'zip') {
      const r = await exportScenesZip(items, models, opts)
      summary = r.summary
      downloadBlob(r.blob, `${r.levelSlug}_godot.zip`)
      msg = 'Zip descargado'
    } else {
      const r = exportScenesFiles(items, models, opts)
      summary = r.summary
      const loc = getGodotLoc()
      if (!(await disk.ensurePermission(loc))) throw new Error('Sin permiso para escribir en la carpeta de Godot')
      const sub = resPath.value.replace(/^res:\/\//, '').replace(/\/+$/, '')
      const base = sub ? await disk.subDir(loc, sub) : loc
      // borra solo lo que una exportación anterior creó y ya no existe (nunca archivos tuyos)
      const remove = []
      const enc = new TextEncoder(), dec = new TextDecoder()
      for (const lv of r.levels) {
        const old = await disk.readFile(base, `${lv.slug}/.lf_manifest.json`)
        let prev = []
        try { prev = old ? JSON.parse(dec.decode(old)) : [] } catch { /* manifiesto ilegible */ }
        const now = [...r.files.keys()].filter((k) => k.startsWith(lv.slug + '/'))
        for (const f of prev) if (!now.includes(f)) remove.push(f)
        r.files.set(`${lv.slug}/.lf_manifest.json`, enc.encode(JSON.stringify(now)))
      }
      await disk.writeFiles(base, r.files, { remove })
      msg = `Escrito en ${disk.locName(loc)}/${sub}`
    }
    temp.forEach((t) => t.dispose())
    toast(`${msg}: ${items.length} escena(s) · ${summary.primitives + (summary.meshes || 0)} geometrías, ${summary.lights} luces, ${summary.models} modelos${summary.foliage ? `, ${summary.foliage.toLocaleString('es')} vegetación` : ''}`, 'ok', 4500)
    store.modal = null
  } catch (e) {
    console.error(e)
    toast('Error al exportar: ' + e.message, 'error', 6000)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AppWindow title="Exportar a Godot 4 (obsoleto)" :width="580" :min-width="340" :min-height="260" persist="export" @close="store.modal = null">
      <div class="body">
        <p class="dep">OBSOLETO: el destino de Century es su propio motor (Juego ▸ Exportar juego). Esta exportación a Godot se conserva sin cambios y ya no recibe novedades (animaciones, Canvas, Shader Graph, Input Map…).</p>
        <div class="row">
          <label>Escenas a exportar <button class="ghost mini" @click="toggleAll">{{ allOn ? 'Quitar todas' : 'Marcar todas' }}</button></label>
          <div class="scenes">
            <label v-for="s in store.project.scenes" :key="s.id" class="sc">
              <input v-model="picked[s.id]" type="checkbox" />
              <span>{{ s.name }}</span>
              <small v-if="s.id === store.project.activeSceneId" class="dim">activa</small>
              <small v-else class="dim">{{ s.count ?? 0 }} nodos</small>
            </label>
          </div>
        </div>

        <div v-if="canDisk" class="row">
          <label>Proyecto Godot</label>
          <div class="gd"><button @click="pickGodot">{{ store.godotName ? 'Cambiar…' : 'Elegir carpeta…' }}</button><span class="path" :data-tooltip="store.godotName">{{ store.godotName || 'Elige la carpeta que contiene project.godot' }}</span></div>
        </div>
        <div v-if="canDisk && store.godotName" class="row">
          <label>Elegir carpeta de destino <small class="dim lf-help">clic en una carpeta para entrar y elegirla</small></label>
          <div class="browser">
            <div class="crumbs">
              <button class="crumb" @click="go('')">res://</button>
              <template v-for="c in crumbs" :key="c.rel"><span>/</span><button class="crumb" @click="go(c.rel)">{{ c.n }}</button></template>
              <span class="grow"></span>
              <button v-if="cur" class="ghost mini" @click="up">↑ Subir</button>
            </div>
            <div class="dirs">
              <button v-for="d in dirs" :key="d" class="dir" @click="go([cur, d].filter(Boolean).join('/'))">📁 {{ d }}</button>
              <span v-if="!dirs.length" class="dim empty">Sin subcarpetas aquí</span>
            </div>
            <div class="newdir">
              <input v-model="newName" placeholder="Nueva carpeta aquí…" spellcheck="false" @keydown.enter="makeNew" />
              <button class="mini" :disabled="!newName.trim()" @click="makeNew">Crear</button>
            </div>
          </div>
        </div>
        <div class="row">
          <label>Se guardará en</label>
          <input v-model="resPath" spellcheck="false" @change="refreshDirs(true)" />
          <small class="dim mono">{{ resPath.replace(/\/?$/, '/') }}{{ slugName }}/{{ slugName }}.tscn</small>
        </div>

        <ul class="what">
          <li class="lf-help">Una carpeta por escena con su <b>.tscn</b>, colisiones y jerarquía ordenada.</li>
          <li class="lf-help"><b>terrain.glb</b> con colores de pintura por vértice + <b>HeightMapShape3D</b>.</li>
          <li class="lf-help">Modelos importados en <b>assets/</b> (los <b>.obj</b> se convierten a <b>.glb</b>) y mallas editadas como <b>.glb</b>.</li>
          <li class="lf-help"><b>level.json</b> con spawns, cámaras y triggers para tus scripts.</li>
        </ul>

        <div v-for="w in warnings" :key="w" class="warn">⚠ {{ w }}</div>
      </div>
    <template #footer>
        <span style="flex:1"></span>
        <button @click="store.modal = null">Cancelar</button>
        <button v-if="canDisk" :disabled="busy || !chosen.length" data-tooltip="Descargar un .zip en lugar de escribir en la carpeta de Godot" @click="run('zip')">Descargar .zip</button>
        <button v-if="canDisk" class="primary" :disabled="busy || !chosen.length" @click="run('godot')">{{ busy ? 'Exportando…' : store.godotName ? `Exportar a Godot (${chosen.length})` : 'Elegir carpeta y exportar' }}</button>
        <button v-else class="primary" :disabled="busy || !chosen.length" @click="run('zip')">{{ busy ? 'Generando…' : `Descargar .zip (${chosen.length})` }}</button>
    </template>
  </AppWindow>
</template>

<style scoped>
.dep { margin: 0 0 8px; padding: 8px 10px; background: #4a3a14; border: 1px solid #8a6a1c; color: #f3d79a; border-radius: 6px; font-size: 12px; }
.row { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
.row > label { font-size: 12px; color: var(--text-3); display: flex; align-items: center; justify-content: space-between; }
.row input[type='text'], .row > input { padding: 7px 9px; font-family: var(--font); }
.gd { display: flex; gap: 8px; align-items: center; }
.path { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-2); font-size: 12px; direction: rtl; text-align: left; }
.mini { height: 20px; padding: 0 6px; font-size: 11px; }
.scenes { display: flex; flex-direction: column; gap: 2px; max-height: 150px; overflow: auto; background: var(--g-950); border: 1px solid var(--hair); border-radius: 6px; padding: 4px; }
.sc { display: flex; align-items: center; gap: 8px; height: 26px; padding: 0 8px; border-radius: 4px; color: var(--text); cursor: pointer; }
.sc:hover { background: var(--g-800); }
.sc span { flex: 1; }
.what { margin: 0 0 12px; padding-left: 18px; color: var(--text-3); font-size: 12px; line-height: 1.7; }
.what b { color: var(--text); font-weight: 500; }
.warn { background: rgba(227,179,65,.12); border: 1px solid rgba(227,179,65,.35); color: #f0cf7a; border-radius: 6px; padding: 7px 10px; font-size: 12px; margin-bottom: 6px; }
.browser { background: var(--g-950); border: 1px solid var(--hair); border-radius: 6px; }
.crumbs { display: flex; align-items: center; gap: 2px; padding: 5px 6px; border-bottom: 1px solid var(--hair); flex-wrap: wrap; font-size: 12px; color: var(--text-3); }
.crumb { background: none; border: 0; height: 22px; padding: 0 5px; color: var(--text-2); cursor: pointer; border-radius: 4px; }
.crumb:hover { background: var(--g-800); color: var(--text); }
.grow { flex: 1; }
.dirs { display: flex; flex-wrap: wrap; gap: 4px; padding: 6px; max-height: 120px; overflow: auto; }
.dir { height: 26px; padding: 0 9px; font-size: 12px; }
.empty { font-size: 12px; padding: 3px 4px; }
.newdir { display: flex; gap: 6px; padding: 6px; border-top: 1px solid var(--hair); }
.newdir input { flex: 1; padding: 4px 8px; }
</style>
