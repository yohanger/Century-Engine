import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readNumberDraft } from '../src/components/number-draft.js'

const source = readFileSync(new URL('../src/components/NumberField.vue', import.meta.url),'utf8')
const script = source.match(/<script setup>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'')
const binding = source.match(/@input="([^"]+)"/)[1]
// Ejecuta los handlers productivos con refs y emisiones mínimas; no sustituye el QA Vue/Electron.
function field(options={}) {
  const props = {modelValue:5,decimals:3,step:0.1,min:-Infinity,max:Infinity,disabled:false,selectOnFocus:false,keepFocusOnEnter:false,...options}
  const events = [], ownerDocument = {}, input = {value:'',ownerDocument,select(){},blur(){ if (input.sendBlur) return api.confirm(false) }}
  ownerDocument.activeElement = input
  const emit = (name,value) => { events.push([name,value]); if(name==='update:modelValue') props.modelValue=value }
  const api = new Function('defineProps','defineEmits','ref','watch','nextTick','readNumberDraft','acquirePointer', script + `\nreturn {focus,confirm,onEnter,cancel,editing,dragging,draft,down,move,up,inputEvent(e){${binding==='onInput'?'onInput(e)':'const $event=e; '+binding.replace(/^draft\s*=/,'draft.value =')}}}`)(()=>props,()=>emit,value=>({value}),()=>{},async()=>{},readNumberDraft,()=>!!options.capture)
  const e = {currentTarget:input,target:input,preventDefault(){},key:'Enter'}
  const edit = text => { input.value=text;api.inputEvent(e) }
  return {api,props,events,input,e,edit,focus(){api.focus(e)},blur(){return api.confirm(false)},enter(){return api.onEnter(e)},escape(){api.cancel({...e,key:'Escape'})}}
}
const updates = f => f.events.filter(([name])=>name==='update:modelValue').map(([,v])=>v)
const commits = f => f.events.filter(([name])=>name==='commit').length

test('input before focus still commits a valid negative on blur',async()=>{const f=field();f.edit('-2.5');await f.blur();assert.deepEqual(updates(f),[-2.5]);assert.equal(commits(f),1)})
test('late focus does not replace an entered draft',async()=>{const f=field();f.edit('-2,5');f.focus();await f.blur();assert.deepEqual(updates(f),[-2.5]);assert.equal(commits(f),1)})
test('Enter commits even when the platform does not deliver blur',async()=>{const f=field();f.focus();f.edit('-3,75');await f.enter();assert.deepEqual(updates(f),[-3.75]);assert.equal(commits(f),1);await f.blur();assert.equal(commits(f),1)})
test('Enter followed by synchronous blur commits exactly once',async()=>{const f=field();f.input.sendBlur=true;f.focus();f.edit('-2.5');await f.enter();assert.deepEqual(updates(f),[-2.5]);assert.equal(commits(f),1)})
test('untouched rounded display does not change full precision on blur or Enter',async()=>{const f=field({modelValue:1.23456789});f.focus();await f.blur();f.focus();await f.enter();assert.equal(f.props.modelValue,1.23456789);assert.equal(commits(f),0)})
test('keep focus Enter commits once and subsequent blur does not commit',async()=>{const f=field({keepFocusOnEnter:true});f.focus();f.edit('-4.25');await f.enter();assert.equal(f.api.editing.value,true);await f.blur();assert.deepEqual(updates(f),[-4.25]);assert.equal(commits(f),1)})
test('invalid overflow and incomplete drafts never commit and allow later valid input',async()=>{const f=field();for(const text of ['1e999','-','Infinity','NaN']){f.focus();f.edit(text);await f.enter();assert.equal(f.api.draft.value,'5')}f.focus();f.edit('-2');await f.enter();assert.deepEqual(updates(f),[-2]);assert.equal(commits(f),1)})
test('Escape cancels input and subsequent blur does not commit',async()=>{const f=field();f.input.sendBlur=true;f.focus();f.edit('-9');f.escape();await f.blur();assert.equal(f.api.draft.value,'5');assert.equal(commits(f),0)})
test('disabled and composing Enter do not commit',async()=>{const f=field({disabled:true});f.edit('-2');await f.enter();await f.blur();assert.equal(commits(f),0);const g=field();g.focus();g.edit('-2');await g.api.onEnter({...g.e,isComposing:true});assert.equal(commits(g),0);await g.enter();assert.equal(commits(g),1)})
test('unchanged value and clamped value preserve existing update contract',async()=>{const f=field({min:-3,max:8});f.focus();f.edit('5');await f.blur();f.focus();f.edit('-99');await f.blur();assert.deepEqual(updates(f),[-3]);assert.equal(commits(f),1)})

test('display precision is independent from stored and focused precision',async()=>{const f=field({modelValue:-7.383456789,displayDecimals:2});assert.equal(f.api.draft.value,'-7.38');f.focus();assert.equal(f.api.draft.value,'-7.383456789');assert.equal(f.input.value,'-7.383456789');await f.blur();assert.equal(f.api.draft.value,'-7.38');assert.equal(commits(f),0);assert.equal(f.props.modelValue,-7.383456789)})
test('display precision does not round typed values or retained focus',async()=>{const f=field({displayDecimals:2,keepFocusOnEnter:true,decimals:8});f.focus();f.edit('0.12345678');await f.enter();assert.equal(f.api.draft.value,'0.12345678');assert.deepEqual(updates(f),[0.12345678]);await f.blur();assert.equal(f.api.draft.value,'0.12');assert.equal(commits(f),1)})
test('display precision does not alter operational drag rounding',()=>{const f=field({displayDecimals:2,decimals:8,modelValue:0.12345678,step:0.01,capture:true});const ev={button:0,pointerId:1,currentTarget:{},clientX:10};f.api.down(ev);f.api.move({...ev,clientX:13});f.api.up(ev);assert.deepEqual(updates(f),[0.13845678]);assert.equal(f.api.draft.value,'0.14');assert.equal(commits(f),1)})
test('mixed values remain empty and explicit zero is a real edit',async()=>{const f=field({modelValue:0,mixed:true,displayDecimals:2});assert.equal(f.api.draft.value,'');f.focus();await f.blur();assert.equal(commits(f),0);f.focus();f.edit('0');await f.blur();assert.deepEqual(updates(f),[0]);assert.equal(commits(f),1)})
test('precision opt in preserves specialized formatting and trims zeros',()=>{assert.equal(field({modelValue:1,displayDecimals:2}).api.draft.value,'1');assert.equal(field({modelValue:0.00012345,decimals:8}).api.draft.value,'0.00012345');assert.equal(field({modelValue:0.514,displayDecimals:2}).api.draft.value,'0.51')})
test('all transform consumers opt in without changing operational precision',()=>{const read=p=>readFileSync(new URL('../src/components/'+p,import.meta.url),'utf8');const insp=read('Inspector.vue'),mesh=read('MeshPanel.vue'),vec=read('Vec3Field.vue');for(const field of ['position','rotation','scale'])assert.ok(insp.includes(`<Vec3Field :display-decimals="2" :model-value="obj.${field}"`));assert.match(insp,/:decimals="4" :display-decimals="2" @update:model-value="previewUniformScale"/);assert.match(insp,/:mixed="multiCommon\(field.key,axis-1\).mixed"/);assert.equal((mesh.match(/:decimals="8" :display-decimals="2"/g)||[]).length,5);assert.match(vec,/:decimals="decimals" :display-decimals="displayDecimals"/)})
