import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/TimelinePanel.vue', import.meta.url), 'utf8')
const script = source.split('<script setup>')[1].split('</script>')[0]
const css = source.split('<style scoped>')[1].split('</style>')[0]
const template = source.slice(source.indexOf('<template>') + 10, source.indexOf('</template>\n\n<style scoped>'))
const ref = value => ({ value })

function placement(rect, viewport) {
  const libraryOpen = ref(true), optMenu = ref(false), addMenu = ref(false), popupPlacement = ref({})
  const libraryButton = ref({ getBoundingClientRect: () => rect })
  const optionsButton = ref(null), trackButton = ref(null)
  const context = { libraryOpen, optMenu, addMenu, popupPlacement, libraryButton, optionsButton, trackButton, window:viewport }
  const names = ['activePopup', 'repositionPopup']
  const functions = names.map(name => {
    const body = script.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`, 'm'))?.[0]
    assert.ok(body, `Falta ${name}`)
    return body
  }).join('\n')
  Function(...Object.keys(context), `${functions};repositionPopup()`)(...Object.values(context))
  return popupPlacement.value
}

const px = value => Number.parseFloat(value)

test('S07-CORR001-01 · popup contextual bajo selector, limitado por la ventana', () => {
  const menu = placement({left:247,right:497,top:376,bottom:403}, {innerWidth:1366,innerHeight:690})
  assert.equal(menu.top, '408px')
  assert.equal(menu.bottom, 'auto')
  assert.equal(menu.width, '368px')
  assert.equal(menu.height, 'auto')
  assert.equal(menu.maxHeight, '275px')
  assert.equal(menu.overflowY, 'hidden')
  assert.ok(px(menu.top) + px(menu.maxHeight) <= 690 - 5)
})

test('S07-CORR001-02 · si no cabe debajo abre arriba sin salirse de pantalla', () => {
  const menu = placement({left:250,right:490,top:600,bottom:626}, {innerWidth:800,innerHeight:690})
  assert.equal(menu.top, 'auto')
  assert.equal(menu.height, 'auto')
  assert.equal(menu.bottom, '95px')
  assert.ok(px(menu.maxHeight) + px(menu.bottom) < 690)
})

test('S07-CORR001-03 · pantalla estrecha reduce ancho sin desbordarse', () => {
  const menu = placement({left:160,right:210,top:210,bottom:240}, {innerWidth:320,innerHeight:490})
  assert.equal(menu.width, '304px')
  assert.equal(menu.left, '8px')
  assert.equal(menu.height, 'auto')
  assert.ok(px(menu.maxHeight) <= 490)
})

test('S07-CORR001-04 · buscador y contador conservados; lista con scroll al necesitarlo', () => {
  assert.match(template, /class="library-pop timeline-dropdown"/)
  assert.match(template, /class="library-list"/)
  assert.match(css, /\.library-pop \{[^}]*display:flex;flex-direction:column;[^}]*overflow:hidden/)
  assert.match(css, /\.library-search \{[^}]*flex:none/)
  assert.match(css, /\.library-count \{[^}]*flex:none/)
  assert.match(css, /\.library-list \{[^}]*flex:0 1 auto;overflow-x:hidden;overflow-y:auto;scrollbar-width:thin/)
  assert.match(css, /\.library-list::-webkit-scrollbar \{ width:9px \}/)
  assert.match(script, /height: 'auto'/)
})
