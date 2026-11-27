import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { resolveViewportDockTarget } from '../src/core/editor/view-dock-session.js'
const src = p => readFileSync(new URL('../'+p,import.meta.url),'utf8')
const script = src('src/core/editor/native-tool-window.js').replace(/^(import|export \{).*$/gm,'').replaceAll('export function ','function ')
const settle = async f=>{await new Promise(setImmediate);for(const callback of f.timers.splice(0))callback();await new Promise(setImmediate)}
function fixture(){
 const watchers=[],mount=[],unmount=[],events=[],timers=[],registry=new Map(),listeners={},body={id:'popup'},doc={body,title:'',documentElement:{className:'',lang:'',style:{cssText:''}},head:{append(){}},createElement:()=>({}),importNode:()=>({})}
 let allowed=true,enabled=false,restored=0,detached=false
 const popup={closed:false,document:doc,addEventListener(n,f){listeners[n]=f},removeEventListener(n){delete listeners[n]},close(){events.push(['close',detached]);this.closed=true}}
 const home={id:'home',isConnected:true},nodes=new Map([['#home',home]])
 const mainDoc={body:home,querySelector:s=>nodes.get(s)||null,baseURI:'file:///editor/',documentElement:{className:'dark',lang:'es',style:{cssText:''}},head:{querySelectorAll:()=>[]}}
 const ctx={nextTick:async()=>{events.push(['tick']);if(!registry.has('code'))detached=true},onBeforeMount:f=>mount.push(f),onMounted:f=>mount.push(f),onBeforeUnmount:f=>unmount.push(f),shallowRef:v=>({value:v}),watch:(get,fn)=>watchers.push({get,fn}),resolveViewportDockTarget,registerNativeTool:(id,p)=>registry.set(id,p),unregisterNativeTool:id=>registry.delete(id),MutationObserver:class{observe(){}disconnect(){}},document:mainDoc,window:{lf:{isElectron:true},screen:{availWidth:1000,availHeight:700},open(){events.push(['open']);return popup},dispatchEvent(e){events.push([e.type])}},Event:class{constructor(type){this.type=type}},setTimeout:fn=>timers.push(fn)}
 runInNewContext(script+'\nthis.api={useNativeToolWindow,useMountedDockTarget:typeof useMountedDockTarget===\'function\'?useMountedDockTarget:null}',ctx)
 const target=ctx.api.useNativeToolWindow({kind:'code',enabled:()=>enabled,title:()=> 'Code',width:()=>600,height:()=>400,canClose:()=>allowed,close:()=>restored++})
 const setEnabled=v=>{enabled=v;watchers[0].fn(v)}
 return {ctx,target,popup,listeners,registry,events,timers,watchers,mount,unmount,home,nodes,setEnabled,setAllowed:v=>allowed=v,get restored(){return restored}}
}
test('cierre programático retira el destino y espera a que Vue devuelva el contenido',async()=>{const f=fixture();f.setEnabled(true);assert.equal(f.target.value,f.popup.document.body);f.setEnabled(false);assert.equal(f.target.value,null);assert.equal(f.registry.has('code'),false);assert.equal(f.popup.closed,false);await settle(f);assert.deepEqual(f.events.at(-1),['close',true]);assert.equal(f.popup.closed,true);assert.equal(f.restored,0)})
test('cierre nativo permitido solicita devolución exactamente una vez antes del cierre',async()=>{const f=fixture();f.setEnabled(true);const ev={prevented:false,preventDefault(){this.prevented=true}};f.listeners.beforeunload(ev);assert.equal(ev.prevented,true);assert.equal(f.restored,1);assert.equal(f.target.value,null);assert.equal(f.popup.closed,false);await settle(f);assert.equal(f.popup.closed,true);assert.equal(f.restored,1)})
test('un veto de cierre mantiene la ventana y el destino',async()=>{const f=fixture();f.setEnabled(true);f.setAllowed(false);const ev={prevented:false,preventDefault(){this.prevented=true}};f.listeners.beforeunload(ev);await settle(f);assert.equal(ev.prevented,true);assert.equal(f.popup.closed,false);assert.equal(f.target.value,f.popup.document.body);assert.equal(f.restored,0)})
test('resolver el target tras el parche mantiene identidad física y evita callbacks tras desmontar',async()=>{const f=fixture();assert.equal(typeof f.ctx.api.useMountedDockTarget,'function');let selector='#first';const target=f.ctx.api.useMountedDockTarget(()=>selector,()=> '#home',()=>[selector]);const refresh=f.watchers.at(-1).fn;const first={id:'first',isConnected:true};f.nodes.set('#first',first);await refresh();assert.equal(target.value,first);first.isConnected=false;selector='#second';const updating=refresh();const second={id:'second',isConnected:true};f.nodes.set('#second',second);await updating;assert.equal(target.value,second);selector='#missing';await refresh();assert.equal(target.value,f.home);const pending=refresh();f.unmount.forEach(fn=>fn());f.nodes.set('#missing',{isConnected:true});await pending;assert.equal(target.value,f.home)})
