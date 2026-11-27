// LF-EDITOR-VIEWBAR-NAV-DEVICE-CORR-G001 · CA-002, sin renderer ni estado nuevos.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = file => readFileSync(new URL('../'+file,import.meta.url),'utf8')
const view=read('src/components/ViewBar.vue')
const icons=read('src/components/Icon.vue')
const cmds=read('src/core/commands.js')
const state=read('src/core/state/state.js')
const prefs=read('src/components/PreferencesModal.vue')
const watchers=read('src/core/editor/keys.js')
const viewport=read('src/engine/runtime/render/viewport.js')
const menu=read('src/components/MenuBar.vue')
const scene=view.split('<template v-if="tab === \'scene\'">')[1]?.split('<template v-else>')[0]
const game=view.split('<template v-else>')[1]?.split('</template>')[0]

test('NAV-01: el botón aparece solo en Escena',()=>{assert.ok(scene);assert.match(scene, /aria-label="Dispositivo de navegación"/);assert.doesNotMatch(game||'',/Dispositivo de navegación/)})
test('NAV-02: solo icono, sin etiqueta visual ni selector',()=>{assert.match(scene, /<button class="ib"[\s\S]*?<Icon :name="p\.navigation/);assert.doesNotMatch(scene,/render-choice|<select|<option|<span[^>]*>Ratón<\/span>|<span[^>]*>Trackpad<\/span>/)})
test('NAV-03: los iconos originales están definidos y no comentados',()=>{assert.match(icons,/^\s*mouse: '[^']+'/m);assert.match(icons,/^\s*trackpad: '[^']+'/m)})
test('NAV-04: indica el modo actual con el glifo correspondiente',()=>{assert.match(scene, /:name="p\.navigation === 'trackpad' \? 'trackpad' : 'mouse'"/)})
test('NAV-05: al pulsar usa exactamente comandos ya existentes',()=>{assert.match(scene, /@click="run\(p\.navigation === 'trackpad' \? 'nav\.mouse' : 'nav\.trackpad'\)"/);assert.match(cmds,/add\('nav\.mouse'/);assert.match(cmds,/add\('nav\.trackpad'/)})
test('NAV-06: alternancia funcional de vuelta completa',()=>{const expr=scene.match(/@click="(run\(p\.navigation === 'trackpad' \? 'nav\.mouse' : 'nav\.trackpad'\))"/)?.[1];assert.ok(expr);const clicked=[];const click=new Function('p','run',expr);const p={navigation:'mouse'};const run=id=>{clicked.push(id);p.navigation=id==='nav.trackpad'?'trackpad':'mouse'};click(p,run);assert.equal(p.navigation,'trackpad');click(p,run);assert.equal(p.navigation,'mouse');assert.deepEqual(clicked,['nav.trackpad','nav.mouse'])})
test('NAV-07: estado único de preferencias, sin nuevos campos',()=>{assert.match(view,/const p = store\.prefs/);assert.match(state,/navigation: 'mouse'/);assert.doesNotMatch(view, /const navDevice|useState\(|ref\('mouse'\)/)})
test('NAV-08: los comandos siguen escribiendo store.prefs.navigation',()=>{assert.match(cmds,/run: \(\) => \(store\.prefs\.navigation = 'mouse'\)/);assert.match(cmds,/run: \(\) => \(store\.prefs\.navigation = 'trackpad'\)/)})
test('NAV-09: Preferencias permanece sincronizado',()=>{assert.match(prefs,/p\.navigation === 'mouse'/);assert.match(prefs,/p\.navigation === 'trackpad'/)})
test('NAV-10: viewport aplica la preferencia y conserva los gestos',()=>{assert.match(watchers,/watch\(\(\) => store\.prefs\.navigation, \(m\) => this\.vp\.setNavigation\(m\)\)/);assert.match(viewport,/setNavigation\(mode\)/);assert.match(viewport,/mode === 'mouse'/)})
test('NAV-11: preferencias se conservan en el almacenamiento existente',()=>{assert.match(state,/PREFS_KEY = 'levelforge:prefs'/);assert.match(state,/localStorage\.setItem\(PREFS_KEY/)})
test('NAV-12: botón con nombre accesible, tooltip y estado',()=>{assert.match(scene,/:aria-label="`Navegación:/);assert.match(scene,/:aria-pressed="p\.navigation === 'trackpad'"/);assert.match(scene,/:data-tooltip="`Navegación:/)})
test('NAV-13: menú Ver conserva las dos acciones de navegación',()=>{assert.match(cmds,/'nav\.mouse', 'nav\.trackpad'/);assert.match(menu,/ids: MENUS\[2\]\.ids/)})
test('NAV-14: render solo en Ver, no en barra ni modificado en exportación',()=>{assert.doesNotMatch(view,/renderMethod|RENDERERS|render-choice|rendererLabels/);assert.match(cmds,/add\('view\.renderOptions'/)})
test('NAV-15: los controles de Juego y barra en ventanas estrechas siguen intactos',()=>{for(const key of ['gameAspect','gameScale','gameMute','gameMaximize'])assert.match(view,new RegExp(key));assert.match(view,/\.vb \{[^}]*overflow-x: auto;/)})
