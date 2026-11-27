from pathlib import Path
import re, json
from playwright.sync_api import sync_playwright
r=Path('/tmp/ce9')
s=(r/'src/components/NumberField.vue').read_text(); code=re.search(r'<script setup>(.*?)</script>',s,re.S)[1];code=re.sub(r'^import .*$', '',code,flags=re.M);tpl=re.search(r'<template>(.*?)</template>',s,re.S)[1];tpl=tpl.replace('@keydown.enter="onEnter"','@keydown.enter="onEnter"');
read=(r/'src/components/number-draft.js').read_text().replace('export ','');capture=(r/'src/engine/runtime/input/pointer-capture.js').read_text().replace('export ','');
code=code.replace('const props = defineProps({','const props = defineProps({')
# Actual Vue component from original script handlers and template via runtime compiler.
# use literal declared props, setup runs original script, render compiler proxies script bindings.
props=code[code.index('defineProps(')+12:code.index('\n})')+2]
setup=code.replace('const props = defineProps('+props+')','const props = componentProps').replace("const emit = defineEmits(['update:modelValue', 'commit'])",'const emit = componentEmit')
# template uses props via auto public proxy, other state handlers exposed
js=f'''const {{ref,watch,nextTick}}=Vue;{read}\n{capture}\nconst NumberField={{props:{props},emits:['update:modelValue','commit'],setup(componentProps,{{emit:componentEmit}}){{{setup}\nreturn {{draft,dragging,editing,focus,confirm,onInput,onMouseDown,onEnter,cancel,down,move,up}}}},template:{json.dumps(tpl)}}}; window.mount=()=>{{window.model=ref(-7.383456789);window.commits=0;Vue.createApp({{render:()=>Vue.h('div',[Vue.h(NumberField,{{modelValue:model.value,displayDecimals:2,'onUpdate:modelValue':v=>model.value=v,onCommit:()=>commits++}}),Vue.h('button',{{id:'out'}},'outside')])}}).mount('#app')}};'''
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']); pg=b.new_page(); pg.set_content('<div id="app"></div>'); pg.add_script_tag(path='/opt/pyvenv/lib/python3.13/site-packages/trame_client/module/vue3-www/vue.global.js');pg.on('pageerror',lambda e:print('PAGE ERROR',e));pg.add_script_tag(content=js);pg.evaluate('mount()'); print('vue',pg.evaluate('Vue.version'),'before',pg.locator('input').input_value());pg.locator('input').focus(); print('focus',pg.locator('input').input_value(),pg.evaluate('document.activeElement.tagName'));pg.locator('#out').focus();print('blur',pg.locator('input').input_value(),pg.evaluate('({model:model.value,commits})'));pg.locator('input').click();pg.locator('input').fill('-1.23456789');pg.locator('#out').click();print('edited',pg.locator('input').input_value(),pg.evaluate('({model:model.value,commits})')); b.close()
