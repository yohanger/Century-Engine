// LF-SHADER-GRAPH-S02-G001: contrato de grafo, compilación y recursos de postprocesado.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { newGraph, newNode, newProp, normalizeGraph, compileGraph, POST_NODES } from '../src/core/shadergraph/compile.js'
import { NODE_DEFS } from '../src/core/shadergraph/nodes.js'
import { newProfile, normalizeProfile, applyProfile, lerpRender, PROFILE_EFFECTS } from '../src/engine/runtime/render/profiles.js'
import { renderChanged } from '../src/engine/runtime/render/postvolumes.js'
const file = (f) => readFileSync(new URL('../'+f,import.meta.url),'utf8')
const connect = (g, a, ak, b, bk) => g.edges.push({id:'edge'+g.edges.length,from:[a.id,ak],to:[b.id,bk]})
const graph = () => newGraph('post')
const profile = (id, mix=1) => normalizeProfile({id,name:id+'.post',fx:{shader:{on:true,postShader:id,postMix:mix,postParams:{Value:0.7}}}})
const base = { ...Object.fromEntries(PROFILE_EFFECTS.flatMap(e=>e.params.map(p=>[p.key,p.def]))), postShader:'', postMix:0, postParams:{} }
test('SG-01 · material por defecto mantiene surface',()=>assert.equal(newGraph().nodes.some(n=>n.type==='surface'),true))
test('SG-02 · material de la versión anterior no exige target',()=>assert.equal(normalizeGraph({nodes:[],edges:[],props:[]}).target,'material'))
test('SG-03 · compilador material conserva surface y GLSL',()=>{const r=compileGraph(newGraph());assert.equal(r.errors.length,0);assert.match(r.code,/void surface\(inout Surface s\)/)})
test('SG-04 · nuevo destino post es único y crea salida propia',()=>{const g=graph();assert.equal(g.target,'post');assert.equal(g.nodes.filter(n=>n.type==='postOutput').length,1);assert.equal(g.nodes.some(n=>n.type==='surface'),false)})
test('SG-05 · post compila sin errores y lee buffer actual',()=>{const r=compileGraph(graph());assert.equal(r.errors.length,0);assert.match(r.code,/texture2D\(tDiffuse, s\.uv\)/)})
test('SG-06 · fragment post ofrece uniform uIntensity y tDiffuse',()=>{const r=compileGraph(graph());assert.match(r.code,/uniform float uIntensity/);assert.match(r.code,/uniform sampler2D tDiffuse/);assert.match(r.code,/gl_FragColor = mix\(/)})
test('SG-07 · material legacy sin target mantiene GLSL idéntico',()=>{const g=newGraph();delete g.target;assert.equal(compileGraph(g).errors.length,0)})
test('SG-08 · graph post conserva salida tras normalización',()=>assert.equal(normalizeGraph({target:'post',nodes:[],edges:[]}).nodes[0].type,'postOutput'))
test('SG-09 · material rechaza destino post en UI (catálogo)',()=>assert.equal(NODE_DEFS.postOutput.postOnly,true))
test('SG-10 · post admite matemáticas y read UV',()=>['uv','lerp','color','reroute','sceneColor'].forEach(id=>assert.equal(POST_NODES.has(id),true)))
test('SG-11 · post limita nodos dependientes de Surface 3D',()=>['normal','fresnel','triplanar','texture'].forEach(id=>assert.equal(POST_NODES.has(id),false)))
test('SG-12 · post rechaza nodos de material conectados',()=>{const g=graph();g.edges=[];const normal=newNode('normal',5,4);g.nodes.push(normal);connect(g,normal,'out',g.nodes[0],'color');assert.match(compileGraph(g).errors.map(e=>e.message).join(','),/no está disponible/)})
test('SG-13 · post detecta salida sin conexión',()=>{const g=graph();g.edges=[];assert.match(compileGraph(g).errors.map(e=>e.message).join(','),/Conecta el color/)})
test('SG-14 · post detecta ciclo',()=>{const g=graph(),a=newNode('add'),b=newNode('mul');g.nodes.push(a,b);g.edges=[];connect(g,a,'out',b,'a');connect(g,b,'out',a,'a');connect(g,a,'out',g.nodes[0],'color');assert.match(compileGraph(g).errors.map(e=>e.message).join(','),/Ciclo/)})
test('SG-15 · post conserva propiedades uniform sin interpolar en GLSL',()=>{const g=graph(),p=newProp('float','Value');g.props.push(p);const n=newNode('property',0,0,{params:{prop:p.id}});g.nodes.push(n);connect(g,n,'out',g.nodes[0],'alpha');const c=compileGraph(g);assert.equal(c.errors.length,0);assert.match(c.code,/uniform float uValue/);assert.match(c.code,/result\.a =/)})
test('SG-16 · nuevo perfil mantiene efecto shader apagado',()=>{const p=newProfile('p','demo.post');assert.equal(p.fx.shader.on,false);assert.equal(p.fx.shader.postShader,'')})
test('SG-17 · recurso .profile antiguo sin shader se normaliza',()=>{const p=normalizeProfile({name:'viejo.profile',fx:{color:{on:true,saturation:0.8}}});assert.equal(p.name,'viejo.profile');assert.equal(p.fx.shader,undefined)})
test('SG-18 · perfil activo selecciona graph e intensidad',()=>{const p=profile('graphA',0.6);const a=applyProfile(base,p);assert.equal(a.postShader,'graphA');assert.equal(a.postMix,0.6)})
test('SG-19 · perfil conserva parámetros de shader',()=>assert.deepEqual(applyProfile(base,profile('A')).postParams,{Value:0.7}))
test('SG-20 · perfil apagado no modifica el render',()=>{const p=profile('A');p.fx.shader.on=false;assert.deepEqual(applyProfile(base,p),base)})
test('SG-21 · interpolación mismo programa mantiene continuidad',()=>{const a=applyProfile(base,profile('A',0.2)),b=applyProfile(base,profile('A',0.8));const mid=lerpRender(a,b,0.5);assert.equal(mid.postShader,'A');assert.ok(Math.abs(mid.postMix-0.5)<1e-7)})
test('SG-22 · mezcla entre dos shaders se atenúa a mitad',()=>{const a=applyProfile(base,profile('A')),b=applyProfile(base,profile('B'));assert.equal(lerpRender(a,b,0.5).postMix,0);assert.equal(lerpRender(a,b,0.75).postShader,'B')})
test('SG-23 · entrada desde render sin shader aumenta peso gradualmente',()=>{const a=lerpRender(base,applyProfile(base,profile('A')),0.75);assert.equal(a.postShader,'A');assert.ok(a.postMix>0&&a.postMix<1)})
test('SG-24 · salida de volumen restaura shader anterior',()=>{const a=applyProfile(base,profile('A'));const gone=lerpRender(a,base,1);assert.equal(gone.postShader,'');assert.equal(gone.postMix,0)})
test('SG-25 · renderChanged registra cambio de programa',()=>assert.equal(renderChanged(base,applyProfile(base,profile('A'))),true))
test('SG-26 · renderChanged detecta uniforms sin recompilar',()=>{const a=applyProfile(base,profile('A'));const b={...a,postParams:{Value:0.5}};assert.equal(renderChanged(a,b),true)})
test('SG-27 · Shader Graph se crea en el registro existente',()=>assert.match(file('src/core/state/shaders.js'),/newGraph\(target\)/))
test('SG-28 · ShaderGraphEditor mantiene selección múltiple y caja',()=>{const s=file('src/components/ShaderGraphEditor.vue');assert.match(s,/selected = reactive\(new Set\(\)\)/);assert.match(s,/kind: 'box'/)})
test('SG-29 · ShaderGraphEditor permite copiar subgrafo con aristas',()=>{const s=file('src/components/ShaderGraphEditor.vue');assert.match(s,/function copySelected/);assert.match(s,/function pasteSelected/);assert.match(s,/idMap\.get/)})
test('SG-30 · ShaderGraphEditor tiene encuadre y búsqueda de nodos',()=>{const s=file('src/components/ShaderGraphEditor.vue');assert.match(s,/function frameNodes/);assert.match(s,/function openSearch/)})
test('SG-31 · Inspector de post muestra shaders disponibles',()=>{const s=file('src/components/ProfileEditor.vue');assert.match(s,/postGraphs/);assert.match(s,/Shader Graph \(Post Processing\)/)})
test('SG-32 · Render reutiliza ShaderPass oficial',()=>assert.match(file('src/engine/runtime/render/look.js'),/this\.customPass = new ShaderPass/))
test('SG-33 · Editor y Player usan misma ruta shader document',()=>assert.match(file('src/engine/runtime/scene/environment.js'),/this\.vp\.setShaderGraphDocs/))
test('SG-34 · cambios de uniforms no forman parte de clave del pipeline',()=>{const s=file('src/engine/runtime/render/look.js');assert.match(s,/uniform\.value/);assert.match(s,/a\.postShader !== cfg\.postShader/)})
test('SG-35 · levelpackage reconoce dependencia de postShader',()=>assert.match(file('src/core/levelpackage.js'),/'postShader'/))
test('SG-36 · se conservan los recursos legacy .profile',()=>assert.equal(normalizeProfile({name:'old.profile'}).name,'old.profile'))
