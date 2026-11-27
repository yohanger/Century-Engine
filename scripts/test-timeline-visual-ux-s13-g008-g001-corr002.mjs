// S13-G008-G001 CORR-002 · QA focal de presentación, sin cambiar el modelo temporal.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
const read = name => readFileSync(new URL('../'+name,import.meta.url),'utf8')
const inspector=read('src/components/TemporalResourceInspector.vue')
const timeline=read('src/components/TimelinePanel.vue')
const globalCss=read('src/styles.css')
const fixture=read('scripts/fixtures/editor/timeline-visual-ux-s13-g008-g001-corr002.html')
const runner=read('scripts/test-timeline-visual-ux-s13-g008-g001-corr002-electron.mjs')

test('VIS-CORR002-01 · el encabezado reserva espacio para la flecha de plegado',()=>{
 assert.match(globalCss,/\.sect > header\s*\{[^}]*padding:\s*0 8px 0 22px/)
 assert.match(globalCss,/\.sect > header::before\s*\{[^}]*left:\s*8px/)
 assert.match(inspector,/\.sect > header \{[^}]*padding:\s*5px 9px 5px 22px;/)
})
test('VIS-CORR002-02 · el encabezado sigue plegable y no pierde identidad',()=>{
 assert.match(inspector,/<section class="sect">\s*<header>\{\{ title \}\}<\/header>/)
 assert.match(inspector,/part\.value === 'resource'[\s\S]*?'Cinemática'/)
 assert.match(globalCss,/\.sect\.closed > :not\(header\) \{ display: none !important; \}/)
})
test('VIS-CORR002-03 · Timeline no muestra el párrafo instructivo del recurso',()=>{
 assert.doesNotMatch(inspector,/Selecciona una pista o clave en el editor temporal para editarla aquí/)
 assert.doesNotMatch(inspector,/Las referencias escritas en scripts no se reescriben/)
 assert.match(inspector,/@change="renameTimelineResource\(\$event\)"/)
})
test('VIS-CORR002-04 · mensajes funcionales y validaciones siguen presentes',()=>{
 assert.match(inspector,/Camera3D ausente/)
 assert.match(inspector,/class="note" :class="\{ error: !binding\.object \}"/)
 assert.match(inspector,/methodArgsError/)
 assert.match(inspector,/El recurso seleccionado ya no existe/)
})
test('VIS-CORR002-05 · los paneles fijos usan el tema, también en filas pares',()=>{
 assert.match(timeline,/\.pinned-column \{ background:var\(--g-850\);border-right-color:var\(--hair\); \}/)
 assert.match(timeline,/\.pinned-row:nth-child\(even\) \.head,\.trow:nth-child\(even\) \.head \{ background:var\(--g-850\); \}/)
 assert.match(timeline,/\.pinned-row \{ border-bottom-color:var\(--hair\); \}/)
})
test('VIS-CORR002-06 · las pistas seleccionadas mantienen contraste y acento',()=>{
 assert.match(timeline,/\.pinned-row \.head\.on,\.trow\.on \.head \{ background:var\(--g-800\);box-shadow:inset 3px 0 0 var\(--blue\); \}/)
 assert.match(timeline,/\.trow\.on \{ background:var\(--blue-wash\); \}/)
 assert.match(globalCss,/--blue-wash:\s*rgba\(/)
})
test('VIS-CORR002-07 · las pistas no seleccionadas eliminan franjas grises ajenas al tema',()=>{
 assert.match(timeline,/\.trow:nth-child\(odd\),\.trow:nth-child\(even\) \{ background:transparent; \}/)
 assert.match(timeline,/\.trow \{border-bottom-color:var\(--hair\);\}/)
})
test('VIS-CORR002-08 · los modos y botones de pista usan tokens existentes',()=>{
 assert.match(timeline,/\.timeline-edit-modes \{ background:var\(--g-850\);border-color:var\(--hair\); \}/)
 assert.match(timeline,/\.timeline-edit-modes button\.on \{ background:var\(--blue-wash\);border-color:var\(--blue\);color:var\(--text\); \}/)
 assert.match(timeline,/\.track-add \{ background:var\(--g-800\);border-color:var\(--hair\);color:var\(--text\); \}/)
})
test('VIS-CORR002-09 · título Preview, selector Snap y barra utilizan la paleta',()=>{
 assert.match(timeline,/\.timeline-titlebar \.title-preview \{ background:var\(--g-800\);border-color:var\(--hair\);color:var\(--text-2\); \}/)
 assert.match(timeline,/\.snap-tools select \{ background:var\(--g-950\);border-color:var\(--hair\);color:var\(--text\); \}/)
 assert.match(timeline,/\.bar \{ scrollbar-color:var\(--g-600\) var\(--g-850\); \}/)
})
test('VIS-CORR002-10 · cabezal conserva proyección, ahora detrás de clips',()=>{
 assert.match(timeline,/\.playhead \{ z-index:1; border-left:1px solid var\(--text\);[^}]*pointer-events:none;/)
 assert.match(timeline,/:style="\{ left: timeToX\(ph\) \+ 'px' \}"/)
 assert.match(timeline,/:style="\{ left: timeToX\(t\.t\) \+ 'px' \}"/)
})
test('VIS-CORR002-11 · no se toca el modelo ni el proceso de audio',()=>{
 assert.doesNotMatch(timeline,/newTimelineVisualState|setTimeout\(/)
 assert.doesNotMatch(inspector,/volumeAutomationVisualStore/)
})
test('VIS-CORR002-12 · fixture prueba componentes reales y carga el tema antes del montaje',()=>{
 assert.match(fixture,/await import\('\/src\/styles\.css'\)/)
 assert.match(fixture,/await import\('\/src\/components\/TimelinePanel\.vue'\)/)
 assert.match(fixture,/await import\('\/src\/components\/TemporalResourceInspector\.vue'\)/)
 assert.match(fixture,/await import\('\/src\/core\/project\.js'\)/)
})
test('VIS-CORR002-13 · fixture mantiene comprobaciones y resultado auditables',()=>{
 const count=(fixture.match(/\bcheck\('/g)||[]).length
 assert.equal(count,19)
 assert.match(fixture,/checks\.length===19&&checks\.every\(c=>c\.pass\)/)
 assert.match(runner,/minChecks:19/)
})
test('VIS-CORR002-14 · los bloques JS de fixture y runner tienen sintaxis válida',()=>{
 const scripts=[...fixture.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
 assert.equal(scripts.length,2)
 for(const [,attrs,js] of scripts){
  const mode=/type="module"/.test(attrs)?'module':'commonjs'
  const p=spawnSync(process.execPath,[`--input-type=${mode}`,'--check'],{input:js,encoding:'utf8'})
  assert.equal(p.status,0,p.stderr)
 }
 const p=spawnSync(process.execPath,['--check',new URL('../scripts/test-timeline-visual-ux-s13-g008-g001-corr002-electron.mjs',import.meta.url).pathname],{encoding:'utf8'})
 assert.equal(p.status,0,p.stderr)
})
