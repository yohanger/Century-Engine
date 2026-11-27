// S13-G008-G001 · Exclusivamente contratos de presentación de Timeline/Inspector.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
const read = name => readFileSync(new URL('../'+name,import.meta.url),'utf8')
const ins=read('src/components/TemporalResourceInspector.vue')
const pf=read('src/components/ParamForm.vue')
const tl=read('src/components/TimelinePanel.vue')
const icons=read('src/components/Icon.vue')
const oldTest=read('scripts/test-inspector-audio-volume-points-s12-g007-g001.mjs')
const checks = [
 ['VIS-01 · no se duplica el Inspector contextual',()=>{assert.equal((ins.match(/<section v-if="isTimeline && track.kind === 'audio' && item.action === 'play'" class="inspector-audio-volume"/g)||[]).length,1)}],
 ['VIS-02 · dropdown Clip conserva width flexible, min-width 0 y elipsis',()=>{assert.match(pf,/\.ctl > select \{ text-overflow:ellipsis; white-space:nowrap; overflow:hidden; \}/);assert.match(pf,/\.ctl > input\[type='text'\], \.ctl > select, \.ctl > textarea \{ width: 100%; min-width:0; max-width:100%; box-sizing:border-box; \}/)}],
 ['VIS-03 · el Inspector conserva la opción seleccionada y el evento original',()=>{assert.match(pf,/v-else-if="p.type === 'animation'"/);assert.match(pf,/@change="set\(p, \$event\.target\.value\)"/)}],
 ['VIS-04 · título y Añadir punto distribuidos a extremos del encabezado',()=>{assert.match(ins,/\.volume-title \{display:flex;align-items:center;justify-content:space-between;/);assert.match(ins,/\.volume-title > button:last-child \{flex:none;white-space:nowrap;margin-left:auto;/)}],
 ['VIS-05 · separador del apartado y campos conservados',()=>{assert.match(ins,/\.volume-title \{[^}]*border-bottom:1px solid var\(--hair\)/);assert.match(ins,/class="volume-point-fields"/)}],
 ['VIS-06 · cada punto alinea nombre a la izquierda y acciones a la derecha',()=>{assert.match(ins,/class="volume-point-heading"/);assert.match(ins,/\.volume-point-heading \{display:flex;align-items:center;justify-content:space-between;/);assert.match(ins,/\.volume-point-toggle \{[^}]*justify-content:flex-start;text-align:left;/)}],
 ['VIS-07 · icono de papelera Bootstrap con nombre bi-trash',()=>{assert.match(ins,/<Icon name="bi-trash" :size="14" \/>/);assert.match(icons,/'bi-trash': \[/);assert.match(icons,/const bootstrap = computed\(\(\) => BI\[props.name\] \|\| null\)/)}],
 ['VIS-08 · eliminar no depende de expandir el punto',()=>{assert.match(ins,/@click\.stop="editInspectorVolumePoint\('remove',point\)"/);assert.ok(ins.indexOf('class="volume-point-delete"')<ins.indexOf('v-if="volumePointExpanded(point.id)" :id='))}],
 ['VIS-09 · acciones bloqueadas respetan permisos existentes',()=>{assert.match(ins,/class="volume-point-delete" :disabled="store.locked \|\| store.play.on \|\| track.locked"/)}],
 ['VIS-10 · no cambia la normalización temporal ni el orden de datos',()=>{assert.ok(ins.includes('v-for="(point, index) in visualVolumePoints"'));assert.match(ins,/volumeAutomationVisualOrder/);assert.match(read('src/engine/runtime/audio/automation.js'),/return result\.sort\(\(a, b\) => a\.t - b\.t\)/);assert.match(oldTest,/INS-19/)}],
 ['VIS-11 · Timeline usa tokens de color del Editor',()=>{assert.match(tl,/\.tlp \{ --tl-bg:var\(--g-900\);--tl-pane:var\(--g-850\);--tl-sep:var\(--hair\);--tl-text:var\(--text\);--tl-accent:var\(--blue\);/);assert.match(tl,/\.group-head \{background:var\(--g-800\)/)}],
 ['VIS-12 · guía blanca detrás de clips y puntos; asa accesible en regla',()=>{assert.match(tl,/\.playhead \{ z-index:1; border-left:1px solid var\(--text\);/);assert.match(tl,/\.rulerrow \{z-index:26;\}/);assert.match(tl,/\.playhead \{[^}]*pointer-events:none;/);assert.match(tl,/\.audio-volume-point \{[^}]*z-index:14/);assert.match(tl,/\.playhead-grip \{z-index:27;/)}],
 ['VIS-13 · G008-G002 sustituye la ausencia de margen por una proyección temporal única',()=>{assert.match(tl,/const TIME_ORIGIN_PX = 24/);assert.match(tl,/const timeToX =/);assert.match(tl,/const xToTime =/);assert.match(tl,/:style="\{ left: timeToX\(t\.t\) \+ 'px' \}"/);assert.match(tl,/left:timeToX\(k\.t\)\+'px'/)}],
 ['VIS-14 · el cabezal global sigue independiente de los eventos de arrastre',()=>{assert.match(tl,/<div class="playhead" :style="\{ left: timeToX\(ph\) \+ 'px' \}" aria-hidden="true"><\/div>/);assert.match(tl,/\@pointerdown\.stop\.prevent="scrubDown\(\$event, ruler, true\)"/)}],
 ['VIS-15 · no introduce lógica temporal paralela',()=>{assert.doesNotMatch(tl,/\bnewTimelineVisualState\b|\bsetTimeout\(/);assert.doesNotMatch(ins,/\bvolumeAutomationVisualStore\b/)}],
 ['VIS-16 · código JS de icono y fixtures mantiene sintaxis',()=>{for(const f of ['scripts/test-timeline-visual-ux-s13-g008-g001-electron.mjs','scripts/test-timeline-visual-ux-s13-g008-g001.mjs']){const r=spawnSync(process.execPath,['--check',new URL('../'+f,import.meta.url).pathname],{encoding:'utf8'});assert.equal(r.status,0,r.stderr)}}],
 ['VIS-17 · la fixture Electron ejecuta el Inspector original y comprueba 54 aserciones',()=>{const html=read('scripts/fixtures/editor/timeline-visual-ux-s13-g008-g001.html');const runner=read('scripts/test-timeline-visual-ux-s13-g008-g001-electron.mjs');assert.equal((html.match(/\bcheck\('/g)||[]).length,54);assert.match(html,/checks\.length===54/);assert.match(runner,/minChecks:54/)}]
]
for(const [name,fn] of checks) test(name,fn)
