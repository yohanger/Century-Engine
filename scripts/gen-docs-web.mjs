/** Genera la documentación HTML del portal desde manuales y referencias verificadas.
 * Las referencias son las existentes: gen-docs.mjs las actualiza desde API y comandos.
 * Requiere la dependencia 'marked' del editor, no añade otro framework.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'
import { engineeringBible } from './gen-engineering-bible.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const load = rel => fs.readFileSync(path.join(root,rel),'utf8')
const exists = rel => fs.existsSync(path.join(root,rel))
const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/<[^>]+>/g,'').replace(/[^\w\s-]/g,'').trim().replace(/\s+/g,'-')
const titleOf = s => (s.match(/^#\s+(.+)$/m)||[])[1]?.replace(/`/g,'') || 'Sin título'
const plain = s => s.replace(/```[\s\S]*?```/g,' ').replace(/<[^>]*>/g,' ').replace(/[#*`\[\]|_]/g,' ').replace(/\s+/g,' ').trim()

const categories = {
  'Introducción': ['inicio','primeros-pasos'],
  'Editor y escenas': ['editor','preferencias','scene-tree','inspector','escenas','atajos'],
  'Control de versiones Git': ['vcs-intro','vcs-commits','vcs-historial','vcs-ramas','vcs-remotos','vcs-seguridad','vcs-problemas'],
  'Scripting': ['scripts','scripts-nodo','propiedades-editables'],
  'Eventos': ['eventos','comandos-intro'],
  'Sistemas del motor': ['fisica','graficos','clima','agua','mesh-edit','shader-graph','timeline-filmmaker','audio','database','ui','optimizacion','exportacion'],
  'Tutoriales': ['tutorial-evento','tutorial-fisica','tutorial-script','tutorial-vertical-slice'],
  'Referencia complementaria': ['referencia-ui','referencia-textos','referencia-shaders'],
  'API JavaScript': ['api-intro'], 'Comandos de evento': [], 'Tipos de nodo': [],
  'Ayuda': ['problemas'],
}
const nodeDetails = {
  node: ['Estructura','Organiza nodos sin transformación espacial. No posee geometría ni cuerpo físico.'],
  node3d: ['Estructura','Organiza objetos espaciales con posición, rotación y escala 3D.'],
  sceneInstance: ['Estructura','Referencia vinculada a una escena fuente, con Transform propio; los hijos se editan desde el recurso original.'],
  group: ['Estructura','Agrupa nodos para editar su conjunto como una unidad.'],
  primitive: ['Geometría','Crea geometría primitiva editable. No genera colisión física implícita.'],
  mesh: ['Geometría','Representa mallas editables con recursos de geometría y materiales.'],
  model: ['Geometría','Instancia un modelo importado mediante los recursos de Assets.'],
  subtract: ['Geometría','Define un volumen sustractivo de CSG; no es un cuerpo de colisión.'],
  decal: ['Geometría','Aplica una calcomanía visual sobre superficies compatibles.'],
  text: ['Geometría','Representa texto en la escena 3D.'],
  road: ['Geometría','Construye una carretera o camino de la escena.'],
  fluidcontainer3d: ['Física','Recipiente del sistema original de fluidos (Deprecated). Consulta el estado de restauración del agua.'],
  vfx3d: ['Efectos','Emisor de partículas visuales que consume recursos VFX. No genera masa ni colisiones por sí mismo.'],
  water: ['Ambiente','Agua original restaurada (Deprecated). No utiliza obligatoriamente Century Fluids.'],
  light: ['Iluminación','Crea luces de distintos tipos y controla su apariencia.'],
  camera: ['Cámara','Configura una cámara para la escena o el juego.'],
  cameraShake: ['Gameplay','Define una receta de movimiento visual de cámara.'],
  spawn: ['Gameplay','Define la posición de aparición del jugador cuando se utiliza la plantilla adecuada.'],
  trigger: ['Gameplay','Define un volumen de activación para interacciones existentes.'],
  navigation: ['Gameplay','Nodo de soporte para navegación del proyecto.'],
  event: ['Eventos','Contiene páginas, condiciones y comandos del sistema Event Order Flow.'],
  gameplayObject: ['Gameplay','Objeto interactuable conectado con comportamientos y Database.'],
  critters: ['Gameplay','Representa la funcionalidad de Critters existente.'],
  canvas: ['Interfaz','Contenedor para elementos de interfaz de usuario.'],
  audio: ['Audio','Fuente de audio de la escena, con propiedades de reproducción y espacialización.'],
  atmovolume: ['Ambiente','Volumen de atmósfera con propiedades ambientales.'],
  postvolume: ['Ambiente','Volumen con parámetros de postprocesado.'],
  staticbody3d: ['Física','Cuerpo estático de Jolt; utiliza formas de colisión hijas.'],
  rigidbody3d: ['Física','Cuerpo dinámico Jolt; administra masa, gravedad, amortiguación y reposo.'],
  characterbody3d: ['Física','Personaje controlado por movimiento, con colisión, suelo y pendientes.'],
  area3d: ['Física','Sensor de solapamientos que emite transiciones de entrada y salida.'],
  collisionshape3d: ['Física','Nodo de forma: BoxShape3D, SphereShape3D, CapsuleShape3D y TriMeshShape3D para StaticBody3D; Box incluye autoajuste de geometría.'],
  sprite2d: ['Geometría','Sprite orientado a representación 2D.'],
  sprite3d: ['Geometría','Sprite situado en espacio 3D.'],
}
const pages=[]
function add(id,group,md,summary='',source='') {
  md=md.replace(/^<a id="[^"]+"><\/a>\s*$/gm,'')
  // En JSDoc, esta expresión JS no es un enlace Markdown.
  md=md.replace('game.ui.canvas("Mirilla")?.[hit ? "show" : "hide"]()', '`game.ui.canvas("Mirilla")?.[hit ? "show" : "hide"]()`')
  const title=titleOf(md)
  pages.push({id,group,title,summary:summary||plain(md).slice(0,170),md,source})
}
for(const [group,ids] of Object.entries(categories)) for(const id of ids) {
  let file = `docs/web-src/${id}.md`
  if (id==='tutorial-vertical-slice') file='docs/tutorial/vertical-slice.md'
  else if (id.startsWith('referencia-')) file=`docs/referencia/${id.replace('referencia-','')}.md`
  if (!exists(file)) throw new Error('Falta la página: '+file)
  add(id,group,load(file),'',file)
}

// Separa la referencia extensa por interfaz, preservando cada firma y su documentación.
const api=load('docs/referencia/api.md')
const apiMatches=[...api.matchAll(/^<a id="([^"]+)"><\/a>\s*\n## ([^\n]+)\n/gm)]
if(apiMatches.length<30) throw new Error('No se detectaron las interfaces de API existentes')
for(let i=0;i<apiMatches.length;i++) {
  const m=apiMatches[i], start=m.index+m[0].length, end=i+1<apiMatches.length?apiMatches[i+1].index:api.length
  const name=m[2].replace(/\s*\(amplía.*$/,'').trim()
  add('api-'+m[1],'API JavaScript',`# ${name}\n\n${api.slice(start,end)}`,
    `Referencia de ${name}: propiedades, tipos, parámetros, firmas y descripciones del API declarada.`, 'src/core/events/game-api.d.ts')
}
// Un comando = una entrada localizable. Mantiene la tabla completa generada por commandDefs.
const command=load('docs/referencia/comandos.md')
const commandMatches=[...command.matchAll(/^<a id="([^"]+)"><\/a>\s*\n### ([^\n]+)\n/gm)]
if(commandMatches.length<55) throw new Error('No se detectaron los comandos del baseline')
for(let i=0;i<commandMatches.length;i++) {
  const m=commandMatches[i], end=i+1<commandMatches.length?commandMatches[i+1].index:command.length
  let body=command.slice(m.index+m[0].length,end).replace(/\n## [^\n]+\n\s*$/,'').trim()
  add('cmd-'+m[1],'Comandos de evento',`# ${m[2]}\n\n${body}\n`, `Comando de evento ${m[1]}: parámetros, valores predeterminados y comportamiento declarado.`, 'src/engine/runtime/events/commandDefs.js')
}

// Inventario extraído de los archivos que registran los tipos de nodo, sin importar Three.js.
const nodesDir=path.join(root,'src/engine/runtime/nodes')
const names=fs.readdirSync(nodesDir).filter(n=>n.endsWith('.js'))
const found=new Map()
for (const file of names) {
  const src=fs.readFileSync(path.join(nodesDir,file),'utf8')
  for (const m of src.matchAll(/registerNode\(\{\s*type:\s*'([^']+)'/g)) found.set(m[1],file)
  for (const m of src.matchAll(/bodyDefinition\('([^']+)'/g)) found.set(m[1],file)
  if (file === 'sprite.js') { found.set('sprite2d',file); found.set('sprite3d',file) }
}
const necessary=['node','node3d','staticbody3d','rigidbody3d','characterbody3d','area3d','collisionshape3d','event']
if(necessary.some(t=>!found.has(t))) throw new Error('Faltan tipos esenciales del registro')
for (const [type,file] of [...found].sort((a,b)=>a[0].localeCompare(b[0]))) {
  const [category,summary]=nodeDetails[type]||['Nodo de escena','Consulta las propiedades disponibles en el Inspector.']
  let details=''
  if(type==='node') details='No contiene posición, rotación ni escala.'
  else if(type==='node3d') details='Posee posición, rotación y escala. La escala heredada de determinadas primitivas visuales conserva reglas particulares.'
  else if(type==='collisionshape3d') details='Las entradas visibles del catálogo son **BoxShape3D**, **SphereShape3D**, **CapsuleShape3D** y **TriMeshShape3D** (solo StaticBody3D). BoxShape3D admite autoajuste de tamaño y centro al Mesh o Primitive, opcional y desactivado por defecto para formas existentes. Debe situarse bajo un cuerpo o área compatible.'
  else if(type==='staticbody3d') details='Propiedades: `friction`, `restitution`. Se define una o varias formas mediante hijos `CollisionShape3D`.'
  else if(type==='rigidbody3d') details='Propiedades: `mass`, `gravityScale`, `linearDamping`, `angularDamping`, `friction`, `restitution`, `canSleep`.'
  else if(type==='characterbody3d') details='Propiedades: `velocity`, `maxSlopeAngle`, `stepHeight`, `floorSnap`, `gravity`, `mass`.'
  else if(type==='area3d') details='Propiedades: `monitoring`, `monitorable`. Detecta entrada y salida de cuerpos y áreas.'
  else if(type==='primitive'||type==='mesh') details='Este tipo es visual: no debe utilizarse como propietario de la simulación Jolt. Para colisiones, crea un cuerpo y una forma específicos.'
  else if(type==='event') details='El contenido de páginas, condiciones, comandos y señales depende del sistema de eventos existente; no se sustituye por scripts de nodo.'
  else details='Sus controles específicos aparecen en el Inspector y dependen de la variante del nodo. Consulta los controles de la variante seleccionada.'
  const md=`# ${type}\n\n**Categoría:** ${category}. **Tipo interno:** \`${type}\`.\n\n${summary}\n\n## Responsabilidad\n\n${details}\n\n## Uso en la escena\n\n1. Selecciona el tipo en **Añadir** si aparece en el catálogo.\n2. Colócalo dentro de una jerarquía válida.\n3. Configura las propiedades en el Inspector.\n4. Si necesitas comportamiento programado, asocia un recurso JavaScript de tipo **Nodo**.\n\nConsulta también [Escenas y nodos](#/escenas) y [Scripting](#/scripts-nodo).\n`
  add('node-'+type,'Tipos de nodo',md,summary,'src/engine/runtime/nodes/'+file)
}

for (const page of engineeringBible(root)) add(page.id,'Biblia Técnica',page.md,'',page.source)

// Enlaces de Markdown heredados y de referencias: migran a rutas del portal.
function resolveLink(from,href) {
  if(/^https?:\/\//.test(href)||/^mailto:/.test(href)) return href
  if(href.startsWith('#/')) return href
  if(href.startsWith('#')) {
    const anchor=href.slice(1)
    if(from.id.startsWith('api-') && anchor.startsWith('api-')) return '#/'+anchor
    if(from.id.startsWith('cmd-') && anchor.startsWith('cmd-')) return '#/'+anchor
    if(from.group==='API JavaScript' && apiMatches.some(m=>m[1]===anchor)) return '#/api-'+anchor
    if(from.group==='Comandos de evento' && commandMatches.some(m=>m[1]===anchor)) return '#/cmd-'+anchor
    return '#/'+encodeURIComponent(from.id)+'?section='+encodeURIComponent(anchor)
  }
  const [p,fragment='']=href.split('#')
  const base=from.source.replace(/^docs\//,'').split('/').slice(0,-1).join('/')
  const rel=path.posix.normalize(path.posix.join(base,p))
  const paths={'index.md':'inicio','guia/primeros-pasos.md':'primeros-pasos','guia/conceptos.md':'escenas','tutorial/vertical-slice.md':'tutorial-vertical-slice','referencia/api.md':'api-intro','referencia/comandos.md':'comandos-intro','referencia/shaders.md':'referencia-shaders','referencia/textos.md':'referencia-textos','referencia/ui.md':'referencia-ui'}
  if(paths[rel]) {
    if(rel==='referencia/api.md'&&fragment&&apiMatches.some(m=>m[1]===fragment))return '#/api-'+fragment
    if(rel==='referencia/comandos.md'&&fragment&&commandMatches.some(m=>m[1]===fragment))return '#/cmd-'+fragment
    return '#/'+paths[rel]+(fragment?'?section='+encodeURIComponent(fragment):'')
  }
  return href
}
function render(p) {
  const seen=new Map(), toc=[]
  let html=marked.parse(p.md,{gfm:true,breaks:false})
  html=html.replace(/<h([1-6])(?:\s+[^>]*)?>([\s\S]*?)<\/h\1>/g,(_all,n,contents)=>{
    const text=contents.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&')
    const raw=slug(text)||'section'; const index=seen.get(raw)||0;seen.set(raw,index+1)
    const id=index?raw+'-'+(index+1):raw
    if(+n>=2&&+n<=4)toc.push({id,title:text,level:+n})
    return `<h${n} id="${id}">${contents}</h${n}>`
  })
  html=html.replace(/href="([^"]+)"/g,(_all,href)=>`href="${resolveLink(p,href).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"`)
  return {id:p.id,group:p.group,title:p.title,summary:p.summary,html,toc,search:plain(p.md)}
}
const groupOrder=['Introducción','Editor y escenas','Control de versiones Git','Scripting','Eventos','Sistemas del motor','Tutoriales','Referencia complementaria','API JavaScript','Comandos de evento','Tipos de nodo','Ayuda','Biblia Técnica']
const content = {version:'0.26.13',groups:groupOrder,pages:pages.map(render)}
if(new Set(content.pages.map(p=>p.id)).size!==content.pages.length)throw new Error('Identificadores duplicados')
const target=path.join(root,'public/docs/content.js')
const output='/* Generado: node scripts/gen-docs-web.mjs. No editar manualmente. */\nwindow.LEVELFORGE_DOCS = '+JSON.stringify(content).replace(/</g,'\\u003c')+';\n'
if(process.argv.includes('--check')) {
  if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==output){console.error('Portal desactualizado: npm run docs:build');process.exit(1)}
  console.log('✓ Portal al día:',pages.length,'páginas')
} else {
  fs.writeFileSync(target,output)
  console.log('✓ Portal generado:',pages.length,'páginas,',apiMatches.length,'interfaces,',commandMatches.length,'comandos,',found.size,'nodos')
}
