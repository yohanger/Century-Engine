import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
const root=fileURLToPath(new URL('..', import.meta.url))
const read=(f)=>readFileSync(join(root,f),'utf8')
const app=read('src/filmmaker/FilmApp.vue')
const nle=read('src/filmmaker/NleTimeline.vue')
const css=read('src/filmmaker/film-ux.css')
const glyph=read('src/filmmaker/FilmGlyph.vue')
const main=read('src/filmmaker/main.js')
const num=(s,part)=>(s.match(new RegExp(part,'g'))||[]).length

test('FILM-UX-01 · CSS se importa solo en Filmmaker, no en editor ni Player',()=>{
  assert.equal(num(main, "film-ux\\.css"),1)
  assert.doesNotMatch(read('src/main.js'),/film-ux\.css/)
  assert.match(css,/\.fm \.nle/)
})
test('FILM-UX-02 · el árbol usa iconos SVG sin depender de fuentes externas',()=>{
  assert.match(glyph,/<svg/)
  assert.match(glyph,/aria-hidden="true"/)
  for(const k of ['film','tree','actor','cam','insp','color','atmo','assets','mixer','nle']) assert.match(glyph,new RegExp(`\\b${k}:`))
  assert.match(app,/<FilmGlyph :name="k"/)
  assert.doesNotMatch(app,/\{\{ ic \}\}/)
})
test('FILM-UX-03 · reproducción, parada, entorno y guardado siguen usando callbacks originales',()=>{
  for(const attr of ['@click="playMain"','@click="stopMain"','@click="envToggle"','@click="save"','@click="open"']) assert.ok(app.includes(attr),attr)
  for(const hook of ['data-test="main-play"','data-test="env-stop"','data-test="env-play"','data-test="save"','data-test="open"']) assert.ok(app.includes(hook),hook)
})
test('FILM-UX-04 · herramientas existentes mantienen gizmos y shortcuts',()=>{
  for(const v of ["setGizmo('none')","setGizmo('translate')","setGizmo('rotate')","setGizmo('scale')"]) assert.ok(app.includes(v),v)
  assert.match(app,/window\.addEventListener\('keydown', onKey\)/)
})
test('FILM-UX-05 · timeline conserva handlers y su secuencia de pistas',()=>{
  for(const hook of ['@click="togglePlay"','@click="stop"','@click="split"','@click="remove"','@click="snap = !snap"','@click="addEffect();closeAddMenu()"']) assert.ok(nle.includes(hook),hook)
  for(const kind of ['cam','actor','text','effects']) assert.ok(nle.includes(`<FilmGlyph name="${kind}"`),kind)
  assert.match(nle,/@pointerdown="shotDown\(/)
  assert.match(nle,/@wheel="wheel"/)
})
test('FILM-UX-06 · CSS contempla monitor, jerarquía, inspector, timeline y diseño responsive',()=>{
  for(const sel of ['.fm .stage','.fm .dock.left','.fm .dock.right','.fm .dock.bottom','.fm .nle .clip','.fm .pn','@media (max-width: 1320px)','@media (max-height: 750px)','body .fm.narrow']) assert.ok(css.includes(sel),sel)
  assert.match(css,/prefers-reduced-motion/)
  assert.match(css,/focus-visible/)
})
test('FILM-UX-07 · no se creó un segundo renderer ni se alteró el modelo de nodos',()=>{
  assert.equal(num(app,'new Editor\\('),1)
  assert.match(app,/<SceneTree/)
  assert.match(app,/<Inspector/)
  assert.doesNotMatch(main,/new WebGLRenderer/)
  assert.doesNotMatch(css,/position:\s*fixed;\s*inset:\s*0;\s*z-index:\s*9999/)
})
test('FILM-UX-08 · código de Frame-G001 intacto e interfaz accesible para formatos',()=>{
  const f=read('src/filmmaker/film.js')
  const frame=read('src/filmmaker/frame.js')
  const panel=read('src/filmmaker/panels/FilmPanel.vue')
  assert.doesNotMatch(f, /NFM_VERSION|f\.version/)
  assert.match(f, /normalizeFilmFrame/)
  assert.match(frame, /fitFilmFrame/)
  for (const marker of ['frame-preset','frame-width','frame-height']) assert.ok(panel.includes(marker))
  assert.match(app, /:style="frameStyle"/)
  assert.match(app, /data-test="film-frame-access"/)
  assert.match(app, /@click="openFrameSettings"/)
  assert.match(app, /right.value = 'film'/)
})
test('FILM-UX-09 · menú de formato siempre accesible por ratón o desde la hoja móvil',()=>{
  assert.match(app, /if \(narrow.value\) openPanel\('film'\)/)
  assert.match(app, /:aria-pressed="right === k"/)
  assert.match(app, /:aria-pressed="drawer === k"/)
  assert.match(css, /@media \(min-width: 820px\) and \(max-width: 1130px\)/)
  assert.match(css, /\.fm\.narrow \.bar \.frame-access/)
})
test('FILM-UX-10 · ningún placeholder del mockup ni nueva ruta de vídeo falsamente funcional',()=>{
  assert.doesNotMatch(app, /exportar MP4|exportar WebM|nuevo WebGLRenderer/)
  assert.doesNotMatch(nle, /<canvas[^>]*waveform/i)
  assert.doesNotMatch(css, /animation:.*infinite/)
  assert.match(app,/new Editor\(host.value\)/)
  assert.match(read('src/filmmaker/main.js'), /film-ux\.css/)
})
