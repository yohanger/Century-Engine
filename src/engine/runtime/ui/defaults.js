// @deprecated — defaultUi() ya no se aplica a proyectos nuevos ni antiguos (ver CANVAS_TEMPLATE). Se conserva para restaurar/migrar interfaces existentes.
// Pantallas de interfaz que trae un proyecto nuevo. Son documentos normales (Assets/UI): se editan, se reemplazan o se borran.
import { uid } from '../util.js'
import { emptySlots } from './roles.js'

const HUD = `<template>
  <!-- HUD siempre visible. Ejemplos listos para descomentar:
       <rt-bar :value="game.variable('vida')" :max="100" color="#e0524a" class="vida" />
       <div class="llaves" v-if="game.switch('llave')">🔑 Llave</div> -->
  <div class="dot" v-if="play.focus && !play.dialog && !play.choices"></div>
</template>

<style>
.dot { position: absolute; left: 50%; top: 50%; width: 5px; height: 5px; margin: -2.5px; border-radius: 50%; background: rgba(255,255,255,.75); box-shadow: 0 0 0 1px rgba(0,0,0,.5); }
.vida { position: absolute; left: 24px; bottom: 24px; width: 220px; height: 14px; }
.llaves { position: absolute; right: 24px; top: 20px; color: #fff; font-weight: 600; }
</style>`

const PROMPT = `<template>
  <div class="prompt" v-if="play.prompt">
    <rt-key>E</rt-key> {{ label }}
  </div>
</template>

<script>
const label = computed(() => String(play.prompt || '').replace(/^E · /, ''))
return { label }
</script>

<style>
.prompt { position: absolute; left: 50%; bottom: 22%; transform: translateX(-50%); background: var(--rt-win-bg, rgba(8,8,8,.72)); border: var(--rt-bw, 1px) solid var(--rt-win-border, rgba(255,255,255,.18)); padding: 7px 14px; border-radius: calc(var(--rt-radius, 8px) * .75); color: var(--rt-text, #fff); text-shadow: var(--rt-text-shadow, none); font-size: calc(var(--rt-fs, 17px) * .9); display: flex; gap: 8px; align-items: center; }
</style>`

const DIALOG = `<template>
  <div class="dlg" :class="play.dialog.pos" v-if="play.dialog">
    <div class="who" v-if="play.dialog.speaker">{{ play.dialog.speaker }}</div>
    <div class="txt"><span v-for="(s, i) in segs" :key="i" :style="s.style">{{ s.t }}</span></div>
    <div class="next" v-if="play.dialog.done && !play.dialog.auto && play.dialog.stay == null"></div>
  </div>
</template>

<script>
// play.dialog = { speaker, text, runs, pos, shown, done }  ·  shown = caracteres ya escritos · runs = trozos con color/tamaño (códigos \\C \\{ \\FS…)
const segs = computed(() => {
  const d = play.dialog; if (!d) return []
  const n = Math.floor(d.shown), pts = [0, d.text.length]
  for (const r of d.runs || []) pts.push(r.s, r.e)
  const b = [...new Set(pts)].sort((x, y) => x - y), out = []
  for (let i = 0; i < b.length - 1; i++) {
    const s = b[i], e = Math.min(b[i + 1], n); if (e <= s) break
    const r = (d.runs || []).find((x) => x.s <= s && x.e >= b[i + 1])
    out.push({ t: d.text.slice(s, e), style: r ? { color: r.color || undefined, fontSize: r.px ? r.size + 'px' : r.size !== 1 ? r.size + 'em' : undefined, fontWeight: r.bold ? 700 : undefined, fontStyle: r.italic ? 'italic' : undefined } : {} })
  }
  return out
})
return { segs }
</script>

<style>
.dlg { position: absolute; left: 50%; transform: translateX(-50%); width: min(var(--rt-dlg-w, 760px), 92%); box-sizing: border-box; background: var(--rt-win-bg, rgba(8,10,16,.88)); border: var(--rt-bw, 1px) solid var(--rt-win-border, rgba(255,255,255,.22)); border-radius: var(--rt-radius, 8px); padding: var(--rt-pad, 16px) calc(var(--rt-pad, 16px) * 1.2); color: var(--rt-text, #f2f2f2); font: var(--rt-weight, 400) var(--rt-fs, 17px)/var(--rt-lh, 1.5) var(--rt-font, system-ui); letter-spacing: var(--rt-ls, 0); text-shadow: var(--rt-text-shadow, none); min-height: calc(var(--rt-dlg-min, 3em) + var(--rt-pad, 16px) * 2); box-shadow: var(--rt-shadow, 0 10px 40px rgba(0,0,0,.5)); }
.dlg::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: var(--rt-win-img, none) center / cover; opacity: var(--rt-win-img-op, 1); pointer-events: none; }
.dlg > * { position: relative; }
.dlg.bottom { bottom: var(--rt-dlg-bottom, 5%); }
.dlg.top { top: var(--rt-dlg-bottom, 5%); }
.dlg.center { top: 50%; transform: translate(-50%,-50%); }
.who { position: absolute !important; top: -.85em; left: 14px; background: var(--rt-name-bg, #3d8bd6); color: var(--rt-name-text, #fff); padding: 2px 10px; border-radius: calc(var(--rt-radius, 8px) * .5); font-weight: 600; font-size: .8em; text-shadow: none; }
.txt { white-space: pre-wrap; min-height: calc(var(--rt-dlg-min, 3em)); }
.next { position: absolute !important; right: 14px; bottom: 8px; font-size: .75em; color: var(--rt-next, #e0a43a); animation: blink 1s infinite; }
.next::before { content: var(--rt-next-icon, "▼"); }
@keyframes blink { 50% { opacity: .2; } }
</style>`

const CHOICES = `<template>
  <div class="cho" v-if="play.choices">
    <div class="q" v-if="play.choices.prompt">{{ play.choices.prompt }}</div>
    <div class="opt" v-for="(o, i) in play.choices.options" :key="i" :class="{ on: i === play.choices.index }" @click="ui.pick(i)">
      <span class="n">{{ i + 1 }}</span>{{ o }}
    </div>
  </div>
</template>

<style>
.cho { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); min-width: 280px; max-width: 80%; background: var(--rt-win-bg, rgba(8,10,16,.92)); border: var(--rt-bw, 1px) solid var(--rt-win-border, rgba(255,255,255,.22)); border-radius: var(--rt-radius, 8px); padding: calc(var(--rt-pad, 16px) * .6); box-shadow: var(--rt-shadow, 0 10px 40px rgba(0,0,0,.5)); color: var(--rt-text, #e8e8e8); font: var(--rt-weight, 400) var(--rt-fs, 17px)/var(--rt-lh, 1.5) var(--rt-font, system-ui); letter-spacing: var(--rt-ls, 0); text-shadow: var(--rt-text-shadow, none); }
.q { padding: 4px 10px 10px; opacity: .8; }
.opt { padding: 6px 12px; border-radius: calc(var(--rt-radius, 8px) * .6); display: flex; gap: 10px; align-items: center; cursor: pointer; }
.opt .n { opacity: .55; font-size: .75em; width: 14px; }
.opt.on { background: var(--rt-accent, #3d8bd6); color: var(--rt-accent-text, #fff); text-shadow: none; }
.opt.on .n { opacity: .8; }
</style>`

const FADE = `<template>
  <div class="fade" :style="{ background: play.fade.color, opacity: play.fade.alpha, transitionDuration: play.fade.ms + 'ms', transitionTimingFunction: play.fade.curve || 'linear' }"></div>
</template>

<style>
.fade { position: absolute; inset: 0; transition-property: opacity; transition-timing-function: linear; }
</style>`

const PAUSE = `<template>
  <div class="pause" @mousedown.self="ui.resume()">
    <div class="card">
      <h3>{{ play.started ? 'Pausa' : 'Listo para jugar' }}</h3>
      <p><rt-key>W</rt-key><rt-key>A</rt-key><rt-key>S</rt-key><rt-key>D</rt-key> mover · <rt-key>Shift</rt-key> correr · <rt-key>Espacio</rt-key> saltar · <rt-key>E</rt-key> interactuar</p>
      <div class="btns">
        <button class="primary" @click="ui.resume()">{{ play.started ? 'Continuar' : 'Jugar' }}</button>
        <button @click="ui.quit()">Salir</button>
      </div>
    </div>
  </div>
</template>

<style>
.pause { position: absolute; inset: 0; background: rgba(6,8,12,.55); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.card { background: var(--rt-win-bg, #23272e); border: var(--rt-bw, 1px) solid var(--rt-win-border, #4a505a); border-radius: var(--rt-radius, 10px); padding: 18px 24px; text-align: center; cursor: default; max-width: 520px; box-shadow: var(--rt-shadow, 0 20px 60px rgba(0,0,0,.6)); color: var(--rt-text, #eee); font-family: var(--rt-font, inherit); text-shadow: var(--rt-text-shadow, none); }
.card h3 { margin: 0 0 8px; font-size: 16px; }
.card p { color: #aab; font-size: 12px; line-height: 2; margin: 0 0 14px; }
.btns { display: flex; gap: 8px; justify-content: center; }
button { height: 30px; padding: 0 16px; border-radius: calc(var(--rt-radius, 8px) * .6); border: 1px solid #555c68; background: #343a44; color: #eee; cursor: pointer; font: inherit; }
button.primary { background: var(--rt-accent, #3d8bd6); border-color: var(--rt-accent, #3d8bd6); color: var(--rt-accent-text, #fff); }
</style>`

const INVENTORY = `<template modal>
  <!-- Menú de ejemplo conectado a la base de datos: play.party = { gold, members, items, weapons, armors, quests, lore }.
       Ábrelo con game.ui.open("inventario") o con el comando «Mostrar / cerrar interfaz». Esc lo cierra. -->
  <div class="inv">
    <header>
      <b v-for="t in tabs" :key="t[0]" :class="{ on: tab === t[0] }" @click="tab = t[0]; sel = null">{{ t[1] }}</b>
      <span class="gold">{{ party.gold }} {{ party.currency }}</span>
    </header>
    <div class="body">
      <div class="list" v-if="tab === 'items'">
        <div class="row" v-for="it in party.items" :key="it.id" :class="{ on: sel === it }" @click="sel = it"><rt-icon class="i" :icon="it.icon" />{{ it.name }}<em>×{{ it.n }}</em></div>
        <p class="empty" v-if="!party.items.length">Sin objetos.</p>
      </div>
      <div class="list" v-else-if="tab === 'party'">
        <div class="row" v-for="m in party.members" :key="m.id" :class="{ on: sel === m }" @click="sel = m">{{ m.name }}<em>Nv {{ m.level }}</em></div>
      </div>
      <div class="list" v-else-if="tab === 'quests'">
        <div class="row" v-for="q in party.quests" :key="q.id" :class="{ on: sel === q }" @click="sel = q">{{ q.name }}<em>{{ status[q.status] }}</em></div>
        <p class="empty" v-if="!party.quests.length">Sin misiones.</p>
      </div>
      <div class="list" v-else>
        <div class="row" v-for="l in party.lore" :key="l.id" :class="{ on: sel === l }" @click="sel = l">{{ l.name }}<em>{{ l.category }}</em></div>
        <p class="empty" v-if="!party.lore.length">Sin documentos.</p>
      </div>
      <div class="detail">
        <template v-if="sel && tab === 'items'"><h3>{{ sel.name }}</h3><p>{{ sel.desc }}</p>
          <template v-if="['always', 'menu'].includes(sel.record.occasion || 'always') && sel.record.itype !== 'key'">
            <button v-if="sel.record.scope === 'none'" @click="use(sel, null)">Usar</button>
            <button v-else v-for="m in party.members" :key="m.id" @click="use(sel, m)">Usar en {{ m.name }}</button>
          </template></template>
        <template v-else-if="sel && tab === 'party'"><h3>{{ sel.name }} <small>{{ sel.nickname }}</small></h3>
          <div class="bar"><i :style="{ width: (100 * sel.hp / sel.mhp) + '%' }"></i><span>Vida {{ sel.hp }}/{{ sel.mhp }}</span></div>
          <div class="bar mp"><i :style="{ width: (sel.mmp ? 100 * sel.mp / sel.mmp : 0) + '%' }"></i><span>Energía {{ sel.mp }}/{{ sel.mmp }}</span></div>
          <p class="st"><span v-for="(v, k) in sel.params" :key="k">{{ k }} {{ v }}</span></p>
          <p>Equipo: {{ sel.equips.filter(Boolean).join(', ') || '—' }}</p><p>Habilidades: {{ sel.skills.join(', ') || '—' }}</p></template>
        <template v-else-if="sel && tab === 'quests'"><h3>{{ sel.name }}</h3><p>{{ sel.desc }}</p>
          <p v-for="(o, i) in sel.objectives" :key="i" :class="{ done: o.done }">{{ o.done ? '☑' : '☐' }} {{ o.text }}{{ o.optional ? ' (opcional)' : '' }}</p></template>
        <template v-else-if="sel && tab === 'lore'"><h3>{{ sel.name }}</h3><p class="body-t">{{ sel.body }}</p></template>
        <p v-else class="empty">Elige un elemento.</p>
      </div>
    </div>
    <footer><button @click="close()">Cerrar</button></footer>
  </div>
</template>

<script>
const party = computed(() => play.party || { gold: 0, currency: '', members: [], items: [], quests: [], lore: [] })
const tabs = [['items', 'Objetos'], ['party', 'Grupo'], ['quests', 'Misiones'], ['lore', 'Diario']]
const status = { none: '—', active: 'En curso', done: 'Completada', failed: 'Fallida' }
const tab = ref('items'), sel = ref(null)
const use = async (it, m) => { const res = game.party.useItem(it.id, m?.id, null, 'menu'); if (res.ok) await game.party.runEvents(res); sel.value = party.value.items.find((x) => x.id === it.id) || null }
return { party, tabs, status, tab, sel, use }
</script>

<style>
:root { display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.5); }
.inv { width: min(760px, 92%); height: min(460px, 86%); background: var(--rt-win-bg, #1c2027); color: var(--rt-text, #e8e8e8); font-family: var(--rt-font, inherit); border: var(--rt-bw, 1px) solid var(--rt-win-border, #3a414c); border-radius: var(--rt-radius, 10px); display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,.6); }
.inv header { display: flex; gap: 4px; padding: 10px 12px; border-bottom: 1px solid #343b46; align-items: center; }
.inv header b { padding: 5px 12px; border-radius: 5px; cursor: pointer; color: #9aa4b2; font-weight: 500; }
.inv header b.on { background: var(--rt-accent, #3d8bd6); color: var(--rt-accent-text, #fff); }
.gold { margin-left: auto; color: #e8c35f; }
.body { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1.3fr; }
.list { overflow: auto; border-right: 1px solid #343b46; padding: 6px; }
.row { display: flex; gap: 8px; padding: 6px 10px; border-radius: 5px; cursor: pointer; align-items: center; }
.row:hover { background: #262c36; } .row.on { background: #2d4a6b; }
.row em { margin-left: auto; font-style: normal; color: #8a93a6; font-size: 12px; } .row .i { width: 20px; text-align: center; }
.detail { padding: 12px 16px; overflow: auto; } .detail h3 { margin: 0 0 6px; } .detail small { color: #8a93a6; font-weight: 400; }
.detail p { color: #b8c0cc; line-height: 1.5; margin: 4px 0; } .detail p.done { color: #6c7685; text-decoration: line-through; }
.body-t { white-space: pre-wrap; } .empty { color: #6c7685; padding: 10px; }
.st { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; }
.bar { position: relative; height: 16px; background: #11141a; border-radius: 4px; margin: 4px 0; overflow: hidden; } .bar i { position: absolute; inset: 0 auto 0 0; background: #4caf6e; } .bar.mp i { background: #3d8bd6; } .bar span { position: relative; font-size: 11px; padding-left: 6px; }
.inv footer { padding: 8px 12px; border-top: 1px solid #343b46; text-align: right; }
button { height: 28px; padding: 0 14px; margin: 3px 4px 0 0; border-radius: 5px; border: 1px solid #555c68; background: #343a44; color: #eee; cursor: pointer; font: inherit; }
</style>`

const ITEMS = [
  ['hud', 'hud.ui', HUD],
  ['prompt', 'prompt.ui', PROMPT],
  ['dialog', 'dialog.ui', DIALOG],
  ['choices', 'choices.ui', CHOICES],
  ['fade', 'fade.ui', FADE],
  ['pause', 'pause.ui', PAUSE.replace('<template>', '<template>')],
]

/** Código de las pantallas del sistema (diálogo, opciones, indicación, fundido): lo usa ui/system.js como interfaz por defecto. */
export const SYSTEM_CODE = { prompt: PROMPT, dialog: DIALOG, choices: CHOICES, fade: FADE }

/** Documentos de UI por defecto y la asignación de roles que los usa. */
export function defaultUi() {
  const uis = [], slots = emptySlots()
  uis.push({ id: uid('u'), name: 'inventario.ui', folder: 'Assets/UI', code: INVENTORY }) // ejemplo sin rol: se abre con game.ui.open("inventario")
  for (const [role, name, code] of ITEMS) {
    const d = { id: uid('u'), name, folder: 'Assets/UI', code }
    uis.push(d)
    if (role === 'hud') slots.hud = [d.id]
    else slots[role] = d.id
  }
  return { uis, ui: { slots } }
}

/** Plantilla para «Nueva interfaz». */
/** Recurso .ui en blanco para un nodo Canvas (no modal, sin elementos predefinidos). */
export const CANVAS_TEMPLATE = `<template>
  <!-- Se dibuja mientras su nodo Canvas esté visible. Datos del juego: play (diálogo, opciones, aviso…), game (API completa). -->
  <div class="root"></div>
</template>

<script>
// const vida = computed(() => game.player?.hp ?? 0)
</script>

<style>
.root { position: absolute; inset: 0; }
</style>
`

export const UI_TEMPLATE = `<template modal>
  <!-- «modal»: libera el ratón y pausa el juego mientras está abierta (Esc la cierra).
       Ábrela con game.ui.open("nombre") o con el comando «Mostrar interfaz». -->
  <div class="panel">
    <h2>Título</h2>
    <p>{{ message }}</p>
    <button @click="close()">Cerrar</button>
  </div>
</template>

<script>
// props = datos recibidos en game.ui.open("nombre", { ... })
const message = computed(() => props.message || 'Hola desde mi interfaz')
return { message }
</script>

<style>
:root { display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.45); }
.panel { background: #23272e; color: #eee; border: 1px solid #4a505a; border-radius: 10px; padding: 18px 26px; min-width: 300px; text-align: center; }
button { height: 30px; padding: 0 16px; border-radius: 5px; border: 1px solid #555c68; background: #3d8bd6; color: #fff; cursor: pointer; font: inherit; }
</style>
`

/** Interfaz nueva en blanco para el diseñador visual (formulario vacío: se llena con controles, sin escribir HTML). */
import { newDesign } from './design.js'
import { generateTemplate, serializeDesign } from './design-html.js'
import { composeUi } from './sfc.js'
export const UI_DESIGN_TEMPLATE = (() => { const d = newDesign(); return composeUi({ template: generateTemplate(d), design: serializeDesign(d) }) })()
