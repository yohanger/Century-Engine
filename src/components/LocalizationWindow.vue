<script setup>
// Ventana «Localización» (Juego ▸ Localización…): una tabla de claves × idiomas con la voz de cada idioma, como las tablas de
// cadenas de Unity o Unreal. No bloquea el editor: se puede tener abierta junto al editor de eventos.
//   · Idiomas: añadir, renombrar, quitar, elegir el base; % traducido de cada uno.
//   · Claves: buscar, filtrar (faltan traducciones / con voz / sin usar), editar texto y voz por idioma, renombrar, borrar.
//   · «Recoger textos»: crea claves para los «Mostrar texto» de la escena abierta y de los eventos comunes.
//   · CSV para traductores (importar / exportar).
//   · Probar en el editor: en Jugar, la tabla en el idioma elegido (en el juego exportado siempre se usa).
import { computed, nextTick, ref, watch } from 'vue'
import AppWindow from './AppWindow.vue'
import {
  store, loc, closeLocalization, locAddLanguage, locRemoveLanguage, locRenameLanguage, locSetBase, locSetDev, locAddEntry, locSetText, locSetVoice,
  locSetNote, locRenameKey, locDeleteEntry, locTextCommands, locCollect, locImportCsv, locExportCsv, toast, assetUrl, openEventEditor,
  locUiTexts, locUiUsage, locCollectUi, openUiEditor,
} from '../core/store.js'
import { COMMON_LANGS, stats as locStats } from '../engine/runtime/i18n/localization.js'
import { AUDIO_EXT } from '../engine/runtime/audio/config.js'
import { pickFile } from '../engine/runtime/util.js'

const L = computed(() => loc())
const query = ref('')
const filter = ref('all')
const addingLang = ref(false)
const newLang = ref('')
const customCode = ref(''), customName = ref('')
const hidden = ref(new Set())
const focusKey = ref(store.locWin?.focus || '')
const stats = computed(() => locStats(L.value))
const audio = computed(() => store.project.assets.filter((a) => AUDIO_EXT.includes(String(a.ext || a.name.split('.').pop()).toLowerCase())))
const shownLangs = computed(() => L.value.languages.filter((l) => !hidden.value.has(l.code)))
const freeLangs = computed(() => COMMON_LANGS.filter(([c]) => !L.value.languages.some((l) => l.code === c)))

/** Uso de cada clave: comandos «Mostrar texto» (escena abierta + eventos comunes) que la enlazan. */
const usage = computed(() => {
  const m = new Map()
  for (const u of locTextCommands()) if (u.cmd.p?.loc) { const k = u.cmd.p.loc; if (!m.has(k)) m.set(k, []); m.get(k).push(u) }
  return m
})
const missing = (e) => L.value.languages.some((l) => !e.text[l.code]) && !!e.text[L.value.base]
const rows = computed(() => {
  const q = query.value.trim().toLowerCase()
  return L.value.entries.filter((e) => {
    if (filter.value === 'missing' && !missing(e)) return false
    if (filter.value === 'voice' && !Object.keys(e.voice).length) return false
    if (filter.value === 'unused' && (usage.value.has(e.key) || uiUsage.value.has(e.key) || e.key.startsWith('speaker.'))) return false
    if (filter.value === 'ui' && !uiUsage.value.has(e.key) && !e.key.startsWith('ui.')) return false
    if (!q) return true
    return e.key.toLowerCase().includes(q) || e.note.toLowerCase().includes(q) || Object.values(e.text).some((t) => t.toLowerCase().includes(q))
  })
})
const missingCount = computed(() => L.value.entries.filter(missing).length)
// Interfaz: claves usadas por los .ui (controles del diseñador con clave y game.t escritas a mano) y textos aún sin clave
const uiUsage = computed(() => { void L.value.entries.length; return locUiUsage() })
const uiPending = computed(() => { void L.value.entries.length; return locUiTexts().filter((t) => t.kind === 'control' && !t.key) })
function collectUi() {
  const n = locCollectUi()
  filter.value = 'ui'
  toast(n ? `${n} clave(s) nuevas desde las interfaces` : 'Todos los textos de las interfaces ya tienen clave', n ? 'ok' : 'info', 3500)
}
const openUi = (u) => openUiEditor(u.docId)

function addLang() {
  const v = newLang.value
  if (v === '__custom') {
    if (locAddLanguage(customCode.value, customName.value || customCode.value)) { customCode.value = ''; customName.value = ''; addingLang.value = false; newLang.value = '' }
    return
  }
  if (v && locAddLanguage(v)) { addingLang.value = false; newLang.value = '' }
}
function toggleCol(code) { const s = new Set(hidden.value); s.has(code) ? s.delete(code) : s.add(code); hidden.value = s }
function removeLang(l) {
  if (!confirmTwice.value || confirmTwice.value !== l.code) { confirmTwice.value = l.code; setTimeout(() => { if (confirmTwice.value === l.code) confirmTwice.value = '' }, 2500); return }
  confirmTwice.value = ''
  locRemoveLanguage(l.code)
}
const confirmTwice = ref('')
const confirmDel = ref('')
function delEntry(e) {
  if (confirmDel.value !== e.key) { confirmDel.value = e.key; setTimeout(() => { if (confirmDel.value === e.key) confirmDel.value = '' }, 2500); return }
  confirmDel.value = ''
  locDeleteEntry(e.key)
}
function addEntry() {
  const e = locAddEntry('', '')
  if (!e) return
  query.value = ''
  filter.value = 'all'
  focusRow(e.key, true)
}
function rename(e, ev) {
  const v = ev.target.value
  if (v === e.key) return
  if (!locRenameKey(e.key, v)) ev.target.value = e.key
}
function collect() {
  const n = locCollect()
  toast(n ? `${n} clave(s) nuevas desde los «Mostrar texto»` : 'Todos los «Mostrar texto» ya tienen clave', n ? 'ok' : 'info', 3500)
}
async function importCsv() {
  const [f] = await pickFile('.csv,text/csv')
  if (!f) return
  try {
    const r = locImportCsv(await f.text())
    toast(`CSV importado: ${r.added} nuevas, ${r.updated} actualizadas${r.languages.length ? ` · idiomas nuevos: ${r.languages.join(', ')}` : ''}`, 'ok', 4500)
  } catch (e) { toast('No se pudo importar: ' + (e.message || e), 'error', 5000) }
}
let player = null
async function preview(name) {
  try { player?.pause() } catch { /* nada */ }
  const a = store.project.assets.find((x) => x.name === name)
  if (!a) return
  const url = await assetUrl(a.id)
  if (!url) return
  player = new Audio(url)
  player.play().catch(() => {})
}
function goToUse(u) { if (u.obj) openEventEditor(u.obj.id) }
/** Ajusta el alto de un campo de texto a su contenido. */
function grow(el) { if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(160, el.scrollHeight + 2) + 'px' }
const content = ref(null)
function focusRow(key, edit = false) {
  focusKey.value = key
  nextTick(() => {
    const row = content.value?.querySelector(`tr[data-key="${CSS.escape(key)}"]`)
    row?.scrollIntoView({ block: 'center' })
    if (edit) row?.querySelector('textarea')?.focus()
  })
}
watch(() => store.locWin?.at, () => { if (store.locWin?.focus) { query.value = ''; filter.value = 'all'; focusRow(store.locWin.focus) } }, { immediate: true })
</script>

<template>
  <AppWindow dock-panel-id="localization" title="Localización" :subtitle="`${L.languages.length} idioma(s) · ${L.entries.length} clave(s)`" :width="1120" :height="660" :min-width="520" :min-height="320" :scroll="false" persist="localization" data-win="loc" @close="closeLocalization">
    <div ref="content" class="locw">
      <!-- idiomas -->
      <section class="langs" aria-label="Idiomas">
        <div v-for="l in L.languages" :key="l.code" class="lang" :class="{ base: l.code === L.base, off: hidden.has(l.code) }">
          <button class="lang-main" :data-tooltip="hidden.has(l.code) ? 'Mostrar la columna' : 'Ocultar la columna'" @click="toggleCol(l.code)">
            <span class="code">{{ l.code }}</span>
            <input class="lname" :value="l.name" spellcheck="false" @click.stop @change="locRenameLanguage(l.code, $event.target.value)" />
            <span v-if="l.code === L.base" class="badge">base</span>
          </button>
          <div class="bar" :data-tooltip="`${stats[l.code]}% traducido`"><i :style="{ width: stats[l.code] + '%' }" :class="{ full: stats[l.code] === 100 }"></i></div>
          <div class="lang-foot">
            <span>{{ stats[l.code] }}%</span>
            <button v-if="l.code !== L.base" class="mini" data-tooltip="Usar como idioma base (el de los comandos)" @click="locSetBase(l.code)">hacer base</button>
            <button v-if="l.code !== L.base" class="mini danger" :class="{ armed: confirmTwice === l.code }" :data-tooltip="confirmTwice === l.code ? 'Pulsa otra vez para quitar el idioma y sus textos' : 'Quitar idioma'" @click="removeLang(l)">{{ confirmTwice === l.code ? '¿seguro?' : 'quitar' }}</button>
          </div>
        </div>
        <div class="lang add">
          <template v-if="!addingLang"><button class="add-btn" data-testid="loc-add-lang" @click="addingLang = true">＋ Idioma</button></template>
          <template v-else>
            <select v-model="newLang" data-testid="loc-lang-select">
              <option value="">— elegir —</option>
              <option v-for="[c, n] in freeLangs" :key="c" :value="c">{{ n }} ({{ c }})</option>
              <option value="__custom">Otro (código propio)…</option>
            </select>
            <div v-if="newLang === '__custom'" class="custom"><input v-model="customCode" placeholder="código (p. ej. es-mx)" /><input v-model="customName" placeholder="nombre" /></div>
            <div class="row-btns"><button class="primary" data-testid="loc-lang-ok" :disabled="!newLang" @click="addLang">Añadir</button><button @click="addingLang = false">Cancelar</button></div>
          </template>
        </div>
        <div class="dev">
          <label class="chk" data-tooltip="En Jugar (dentro del editor) los «Mostrar texto» salen de esta tabla en el idioma elegido. En el juego exportado la tabla siempre se usa."><input type="checkbox" :checked="L.useInDev" data-testid="loc-usedev" @change="locSetDev({ useInDev: $event.target.checked })" /> Probar en el editor</label>
          <select :value="L.devLang" :disabled="!L.useInDev" data-tooltip="Idioma al pulsar Jugar" @change="locSetDev({ devLang: $event.target.value })">
            <option v-for="l in L.languages" :key="l.code" :value="l.code">{{ l.name }}</option>
          </select>
          <p class="hint lf-help">En el juego exportado: idioma del jugador (game.lang), si no el del sistema, si no el base.</p>
        </div>
      </section>

      <!-- barra de herramientas -->
      <div class="tools">
        <div class="search"><svg viewBox="0 0 16 16" width="13" height="13"><circle cx="7" cy="7" r="4.5" stroke="currentColor" fill="none" stroke-width="1.5" /><path d="M10.5 10.5 14 14" stroke="currentColor" stroke-width="1.5" /></svg><input v-model="query" placeholder="Buscar clave, nota o texto…" data-testid="loc-search" /></div>
        <div class="seg">
          <button :class="{ on: filter === 'all' }" @click="filter = 'all'">Todas</button>
          <button :class="{ on: filter === 'missing' }" @click="filter = 'missing'">Faltan <b v-if="missingCount">{{ missingCount }}</b></button>
          <button :class="{ on: filter === 'voice' }" @click="filter = 'voice'">Con voz</button>
          <button :class="{ on: filter === 'unused' }" @click="filter = 'unused'">Sin usar</button>
          <button :class="{ on: filter === 'ui' }" data-testid="loc-filter-ui" @click="filter = 'ui'">Interfaz <b v-if="uiPending.length" class="warn">{{ uiPending.length }}</b></button>
        </div>
        <span class="grow"></span>
        <button class="tool" data-testid="loc-collect" data-tooltip="Crea claves para los «Mostrar texto» de la escena abierta y de los eventos comunes que aún no tienen" @click="collect">Recoger textos</button>
        <button class="tool" data-testid="loc-collect-ui" @click="collectUi">Recoger textos de interfaz</button>
        <button class="tool" data-tooltip="Importar un CSV (columnas key, note, es, en…, voice:es…)" @click="importCsv">Importar CSV</button>
        <button class="tool" data-tooltip="Exportar a CSV para traductores" @click="locExportCsv">Exportar CSV</button>
        <button class="tool primary" data-testid="loc-add-key" @click="addEntry">＋ Clave</button>
      </div>

      <!-- tabla -->
      <div class="grid-wrap">
        <p v-if="filter === 'ui' && uiPending.length" class="uipend" data-testid="loc-ui-pending">{{ uiPending.length }} texto(s) de interfaz sin clave:
          <template v-for="(t, i) in uiPending.slice(0, 6)" :key="i">{{ i ? ', ' : ' ' }}<a href="#" @click.prevent="openUi(t)">{{ t.doc.replace(/\.ui$/, '') }} · {{ t.control }}</a></template>{{ uiPending.length > 6 ? '…' : '' }}.
          <button class="ghost" @click="collectUi">Recoger</button></p>
        <table v-if="rows.length" class="grid">
          <thead>
            <tr>
              <th class="c-key">Clave</th>
              <th v-for="l in shownLangs" :key="l.code" class="c-lang">{{ l.name }} <span class="dim">{{ l.code }}</span><span v-if="l.code === L.base" class="badge">base</span></th>
              <th class="c-use">Uso</th>
              <th class="c-del"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in rows" :key="e.key" :data-key="e.key" :class="{ focus: focusKey === e.key }" @focusin="focusKey = e.key">
              <td class="c-key">
                <input class="key" :value="e.key" spellcheck="false" data-tooltip="Clave (se usa en game.t('…') y en {t:…})" @change="rename(e, $event)" />
                <input class="note" :value="e.note" placeholder="nota para traductores" @change="locSetNote(e.key, $event.target.value)" />
              </td>
              <td v-for="l in shownLangs" :key="l.code" class="c-lang" :class="{ miss: !e.text[l.code] && e.text[L.base], base: l.code === L.base }">
                <textarea :ref="grow" :value="e.text[l.code] || ''" rows="1" :placeholder="l.code === L.base ? 'Texto' : (e.text[L.base] ? 'Falta traducir: ' + e.text[L.base] : '')" spellcheck="true" :lang="l.code" @input="grow($event.target)" @change="locSetText(e.key, l.code, $event.target.value)"></textarea>
                <div class="voice" :class="{ has: e.voice[l.code] }">
                  <svg viewBox="0 0 16 16" width="12" height="12"><path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor" /><path d="M11 5.5a3.5 3.5 0 0 1 0 5" stroke="currentColor" fill="none" stroke-width="1.3" /></svg>
                  <select :value="e.voice[l.code] || ''" :data-tooltip="'Voz en ' + l.name" @change="locSetVoice(e.key, l.code, $event.target.value)">
                    <option value="">sin voz</option>
                    <option v-if="e.voice[l.code] && !audio.some((a) => a.name === e.voice[l.code])" :value="e.voice[l.code]">(falta) {{ e.voice[l.code] }}</option>
                    <option v-for="a in audio" :key="a.id" :value="a.name">{{ a.name }}</option>
                  </select>
                  <button v-if="e.voice[l.code]" class="play" data-tooltip="Escuchar" @click="preview(e.voice[l.code])">▶</button>
                </div>
              </td>
              <td class="c-use">
                <button v-for="(u, i) in (usage.get(e.key) || []).slice(0, 3)" :key="i" class="use" :data-tooltip="u.where" @click="goToUse(u)">{{ u.where }}</button>
                <span v-if="(usage.get(e.key) || []).length > 3" class="dim">+{{ usage.get(e.key).length - 3 }}</span>
                <button v-for="(u, i) in (uiUsage.get(e.key) || []).slice(0, 3)" :key="'ui' + i" class="use ui" :data-tooltip="u.doc" @click="openUi(u)">{{ u.doc.replace(/\.ui$/, '') }}{{ u.control ? ' · ' + u.control : '' }}</button>
                <span v-if="!usage.get(e.key) && !uiUsage.get(e.key)" class="dim">{{ e.key.startsWith('speaker.') ? 'nombre' : '—' }}</span>
              </td>
              <td class="c-del"><button class="del" :class="{ armed: confirmDel === e.key }" :data-tooltip="confirmDel === e.key ? 'Pulsa otra vez para borrar' : 'Borrar clave'" @click="delEntry(e)">{{ confirmDel === e.key ? '¿borrar?' : '✕' }}</button></td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty">
          <template v-if="L.entries.length">Nada coincide con la búsqueda.</template>
          <template v-else>
            <b>Aún no hay textos localizados.</b>
            <p class="lf-help">Pulsa <em>Recoger textos</em> para crear una clave por cada «Mostrar texto» de la escena, o <em>＋ Clave</em> para textos de interfaz (<code>game.t('menu.jugar')</code>, <code>{t:menu.jugar}</code>).</p>
          </template>
        </div>
      </div>
      <footer class="foot"><span>{{ rows.length }} de {{ L.entries.length }} clave(s)</span><span v-if="missingCount" class="warn">· {{ missingCount }} con traducciones pendientes</span><span class="grow"></span><span class="dim lf-help">Los cambios se guardan con el proyecto (Ctrl+S)</span></footer>
    </div>
  </AppWindow>
</template>

<style scoped>
.locw { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--g-900); }
.langs { display: flex; gap: 8px; padding: 10px 12px; overflow-x: auto; border-bottom: 1px solid var(--hair); background: var(--g-850); flex: none; align-items: stretch; }
.lang { flex: none; width: 168px; display: flex; flex-direction: column; gap: 6px; padding: 8px 9px; border: 1px solid var(--hair); border-radius: 6px; background: var(--g-800); }
.lang.base { border-color: var(--blue); box-shadow: inset 0 0 0 1px var(--blue-wash); }
.lang.off { opacity: .55; }
.lang-main { display: flex; align-items: center; gap: 6px; padding: 0; border: none; background: none; color: var(--text); text-align: left; min-width: 0; }
.code { flex: none; padding: 1px 5px; border-radius: 3px; background: var(--g-600); font: 600 10px/1.4 ui-monospace, monospace; text-transform: uppercase; color: var(--text); }
.lname { flex: 1; min-width: 0; height: 20px; padding: 0 3px; border: 1px solid transparent; background: transparent; color: var(--text); font-size: 12.5px; font-weight: 500; }
.lname:hover, .lname:focus { border-color: var(--hair); background: var(--g-900); }
.badge { flex: none; margin-left: 4px; padding: 1px 5px; border-radius: 8px; background: var(--blue-wash); color: var(--blue-hi); font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .3px; }
.bar { height: 4px; border-radius: 2px; background: var(--g-600); overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--amber); border-radius: 2px; transition: width .2s; }
.bar i.full { background: var(--ok); }
.lang-foot { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-2); }
.mini { margin-left: auto; padding: 0 5px; height: 18px; border: none; border-radius: 3px; background: transparent; color: var(--text-3); font-size: 10.5px; }
.mini + .mini { margin-left: 0; }
.mini:hover { background: var(--g-600); color: var(--text); }
.mini.danger.armed, .del.armed { background: var(--danger); color: #fff; }
.lang.add { justify-content: center; border-style: dashed; background: transparent; }
.add-btn { height: 100%; border: none; background: none; color: var(--text-2); font-size: 12.5px; }
.add-btn:hover { color: var(--text); }
.lang.add select, .custom input { width: 100%; height: 24px; }
.custom { display: flex; flex-direction: column; gap: 4px; }
.row-btns { display: flex; gap: 6px; }
.row-btns button { flex: 1; height: 22px; font-size: 11.5px; }
.dev { flex: none; display: flex; flex-direction: column; gap: 6px; margin-left: auto; padding: 8px 10px; width: 230px; border-left: 1px solid var(--hair); }
.dev .chk { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text); }
.dev select { height: 24px; }
.hint { margin: 0; font-size: 10.5px; color: var(--text-3); line-height: 1.35; }
.tools { display: flex; align-items: center; gap: 8px; padding: 8px 12px; flex: none; border-bottom: 1px solid var(--hair); flex-wrap: wrap; }
.search { display: flex; align-items: center; gap: 6px; width: 260px; height: 26px; padding: 0 8px; border: 1px solid var(--hair); border-radius: 4px; background: var(--g-800); color: var(--text-3); }
.search:focus-within { border-color: var(--blue); }
.search input { flex: 1; min-width: 0; border: none; background: none; color: var(--text); height: 24px; padding: 0; }
.seg { display: flex; border: 1px solid var(--hair); border-radius: 4px; overflow: hidden; }
.seg button { height: 24px; padding: 0 10px; border: none; border-right: 1px solid var(--hair); border-radius: 0; background: var(--g-800); color: var(--text-2); font-size: 12px; }
.seg button:last-child { border-right: none; }
.seg button.on { background: var(--blue-wash); color: var(--text); }
.seg b { margin-left: 4px; padding: 0 5px; border-radius: 8px; background: var(--amber-wash); color: var(--amber); font-size: 10.5px; }
.tool { height: 26px; padding: 0 11px; font-size: 12px; }
.tool.primary { background: var(--blue); border-color: var(--blue); color: #fff; }
.grow { flex: 1; }
.grid-wrap { flex: 1; min-height: 0; overflow: auto; }
.grid { border-collapse: separate; border-spacing: 0; width: max-content; min-width: 100%; font-size: 12.5px; }
.grid th { position: sticky; top: 0; z-index: 2; padding: 7px 10px; background: var(--g-850); border-bottom: 1px solid var(--hair); color: var(--text-2); font-weight: 500; text-align: left; white-space: nowrap; }
.grid th .dim { font-family: ui-monospace, monospace; font-size: 10.5px; color: var(--text-3); margin-left: 4px; }
.grid td { padding: 6px 8px; border-bottom: 1px solid var(--hair-soft); vertical-align: top; }
.grid tr:hover td { background: #ffffff05; }
.grid tr.focus td { background: var(--blue-wash); }
.c-key { position: sticky; left: 0; z-index: 1; width: 230px; min-width: 230px; background: var(--g-900); border-right: 1px solid var(--hair); }
.grid th.c-key { z-index: 3; background: var(--g-850); }
.grid tr.focus td.c-key { background: #17222b; }
.key { width: 100%; height: 22px; padding: 0 5px; border: 1px solid transparent; background: transparent; color: #9cdcfe; font: 12px ui-monospace, 'DejaVu Sans Mono', monospace; }
.note { width: 100%; height: 20px; margin-top: 2px; padding: 0 5px; border: 1px solid transparent; background: transparent; color: var(--text-3); font-size: 11px; }
.key:hover, .key:focus, .note:hover, .note:focus { border-color: var(--hair); background: var(--g-800); }
.c-lang { width: 300px; min-width: 240px; }
.c-lang textarea { display: block; width: 100%; min-height: 26px; max-height: 160px; padding: 4px 7px; resize: none; overflow: auto; border: 1px solid var(--hair); border-radius: 4px; background: var(--g-800); color: var(--text); font: 12.5px/1.4 var(--font); }
.c-lang textarea:focus { border-color: var(--blue); outline: none; }
.c-lang.miss textarea { border-color: var(--amber-edge); background: var(--amber-wash); }
.c-lang.miss textarea::placeholder { color: #b98b45; font-style: italic; }
.voice { display: flex; align-items: center; gap: 4px; margin-top: 4px; color: var(--text-3); }
.voice.has { color: var(--ok); }
.voice select { flex: 1; min-width: 0; height: 20px; padding: 0 3px; font-size: 11px; background: transparent; border: 1px solid transparent; color: inherit; }
.voice select:hover, .voice select:focus { border-color: var(--hair); background: var(--g-800); color: var(--text); }
.play { width: 20px; height: 20px; padding: 0; border: none; border-radius: 3px; background: var(--g-700); color: var(--ok); font-size: 9px; }
.c-use { width: 170px; min-width: 140px; }
.use { display: block; max-width: 160px; margin-bottom: 2px; padding: 1px 6px; height: 20px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border: none; border-radius: 3px; background: var(--g-700); color: var(--text-2); font-size: 11px; text-align: left; }
.use:hover { background: var(--g-600); color: var(--text); }
.c-del { width: 60px; text-align: right; }
.del { height: 22px; padding: 0 7px; border: none; border-radius: 3px; background: transparent; color: var(--text-3); font-size: 11.5px; }
.del:hover { background: var(--g-600); color: var(--danger); }
.dim { color: var(--text-3); font-size: 11px; }
.empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; height: 100%; padding: 30px; color: var(--text-2); text-align: center; font-size: 13px; }
.empty p { max-width: 520px; margin: 0; color: var(--text-3); line-height: 1.5; }
.empty code { font-size: 11.5px; background: var(--g-800); padding: 1px 5px; border-radius: 3px; }
.foot { display: flex; align-items: center; gap: 6px; flex: none; height: 28px; padding: 0 12px; border-top: 1px solid var(--hair); background: var(--g-850); font-size: 11.5px; color: var(--text-2); }
.foot .warn { color: var(--amber); }
@container win (max-width: 760px) {
  .dev { width: 190px; }
  .search { width: 160px; }
}
.use.ui { border-color: rgba(122,184,255,.35); }
b.warn { color: #e0a43a; }
.uipend { margin: 0 0 6px; padding: 6px 10px; border: 1px dashed rgba(224,164,58,.5); border-radius: 6px; font-size: 12px; color: var(--text-2); }
</style>
