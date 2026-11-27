import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import ts from 'typescript'

const sort = (a,b) => a < b ? -1 : a > b ? 1 : 0
const code = s => '`'+String(s).replaceAll('`','').replaceAll('|','\\|').replace(/[\r\n]/g,' ')+'`'
const table = (heads, rows) => `| ${heads.join(' | ')} |\n| ${heads.map(()=> '---').join(' | ')} |\n`+rows.map(r=>`| ${r.join(' | ')} |`).join('\n')+'\n'
const chunks = (items,n) => Array.from({length:Math.ceil(items.length/n)},(_,i)=>items.slice(i*n,(i+1)*n))
const slug = s=>s.replace(/[^a-zA-Z0-9]+/g,'-').toLowerCase().replace(/^-|-$/g,'')
export function engineeringBible(root) {
  const read = f=>fs.readFileSync(path.join(root,f),'utf8')
  const list = dir=>fs.readdirSync(path.join(root,dir),{withFileTypes:true}).sort((a,b)=>sort(a.name,b.name)).flatMap(e=>{
    const f=dir+'/'+e.name
    if(e.isSymbolicLink()||['node_modules','.git','__pycache__','.cache','dist-runtime','release'].includes(e.name))return []
    return e.isDirectory()?list(f):e.isFile()?[f]:[]
  })
  const files=['src','electron','vscode-extension','capture-app','filmmaker-mobile','vendor/trianghor','vendor/century-fluids'].flatMap(list).sort(sort)
  const fileSet=new Set(files), incoming=new Map(), records=[], tokens=new Map(), components=[]
  const resolve=(file,spec)=>{
    if(!spec.startsWith('.'))return null
    const f=path.posix.normalize(path.posix.join(path.posix.dirname(file),spec.split('?')[0]))
    return [f,f+'.js',f+'.ts',f+'.mjs',f+'.vue',f+'/index.js',f+'/index.ts'].find(p=>fileSet.has(p))||null
  }
  for(const file of files){
    const bytes=fs.statSync(path.join(root,file)).size
    const record={file,bytes,lines:0,imports:[],symbols:[],styles:0,props:[],emits:[],errors:0}
    records.push(record)
    if(!/\.(?:[cm]?[jt]sx?|vue|css|html)$/.test(file))continue
    const text=read(file); record.lines=text.split(/\r?\n/).length
    const sourceBlocks=file.endsWith('.vue')?[...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>({body:m[1],offset:m.index+m[0].indexOf('>')+1})): /\.[cm]?[jt]sx?$/.test(file)?[{body:text,offset:0}]:[]
    for(const {body,offset} of sourceBlocks){
      const base=text.slice(0,offset).split('\n').length-1
      const ast=ts.createSourceFile(file.endsWith('.vue')?file+'.ts':file,body,ts.ScriptTarget.Latest,true)
      record.errors+=ast.parseDiagnostics.length
      const line=n=>base+ast.getLineAndCharacterOfPosition(n.getStart(ast)).line+1
      const name=n=>n?.name?.getText(ast)||''
      function owner(n){
        const names=[]
        for(let p=n.parent;p&&p!==ast;p=p.parent){
          if(ts.isClassLike(p)||ts.isInterfaceDeclaration(p)||ts.isVariableDeclaration(p)||ts.isPropertyAssignment(p)||ts.isMethodDeclaration(p)||ts.isFunctionDeclaration(p)){const s=name(p);if(s)names.unshift(s)}
        }
        return names.join('.')
      }
      function imp(n,s){if(!s||!ts.isStringLiteralLike(s))return;const spec=s.text,target=resolve(file,spec);record.imports.push({spec,target,line:line(n)});if(target){if(!incoming.has(target))incoming.set(target,new Set());incoming.get(target).add(file)}}
      function visit(n){
        if(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))imp(n,n.moduleSpecifier)
        if(ts.isCallExpression(n)&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||n.expression.getText(ast)==='require'))imp(n,n.arguments[0])
        let kind=''
        if(ts.isClassDeclaration(n)||ts.isClassExpression(n))kind='clase'
        else if(ts.isInterfaceDeclaration(n))kind='interfaz'
        else if(ts.isTypeAliasDeclaration(n))kind='tipo'
        else if(ts.isFunctionDeclaration(n))kind='función'
        else if(ts.isConstructorDeclaration(n))kind='constructor'
        else if(ts.isMethodDeclaration(n)||ts.isMethodSignature(n))kind='método'
        else if(ts.isGetAccessorDeclaration(n)||ts.isSetAccessorDeclaration(n))kind=ts.isGetAccessorDeclaration(n)?'get':'set'
        else if(ts.isVariableDeclaration(n)&&n.initializer&&(ts.isArrowFunction(n.initializer)||ts.isFunctionExpression(n.initializer)))kind='función'
        else if(ts.isVariableDeclaration(n)&&ts.isVariableStatement(n.parent?.parent)&&n.parent.parent.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))kind='export'
        else if(ts.isPropertyAssignment(n)&&(ts.isArrowFunction(n.initializer)||ts.isFunctionExpression(n.initializer)))kind='función'
        else if(ts.isPropertyDeclaration(n)&&n.initializer&&(ts.isArrowFunction(n.initializer)||ts.isFunctionExpression(n.initializer)))kind='función'
        if(kind){const s=name(n)|| (kind==='constructor'?'constructor':'(anónimo)');record.symbols.push({kind,name:[owner(n),s].filter(Boolean).join('.'),line:line(n)})}
        if(ts.isCallExpression(n)&&file.endsWith('.vue')){
          const call=n.expression.getText(ast)
          if(['defineProps','defineEmits'].includes(call)){const arg=n.arguments[0]||n.typeArguments?.[0];const target=call==='defineProps'?record.props:record.emits;if(arg&&ts.isObjectLiteralExpression(arg))target.push(...arg.properties.map(name));else if(arg&&ts.isArrayLiteralExpression(arg))target.push(...arg.elements.map(e=>e.getText(ast)));else target.push('declaración en L'+line(n))}
        }
        ts.forEachChild(n,visit)
      }
      visit(ast)
    }
    const styleBlocks=file.endsWith('.vue')?[...text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(m=>({body:m[1],offset:m.index+m[0].indexOf('>')+1})):file.endsWith('.css')?[{body:text,offset:0}]:[]
    record.styles=styleBlocks.length
    for(const block of styleBlocks){for(const m of block.body.matchAll(/(--[\w-]+)\s*:/g)){const line=text.slice(0,block.offset+m.index).split('\n').length;if(!tokens.has(m[1]))tokens.set(m[1],[]);tokens.get(m[1]).push(`${file}:L${line}`)}}
    // Incluye asignaciones de propiedades CSS desde JavaScript; no confunde usos var() con definiciones.
    for(const m of text.matchAll(/(?:['"](--[\w-]+)['"]\s*:|setProperty\(\s*['"](--[\w-]+)['"])/g)){
      const token=m[1]||m[2], loc=`${file}:L${text.slice(0,m.index).split('\n').length}`
      if(!tokens.has(token))tokens.set(token,[])
      if(!tokens.get(token).includes(loc))tokens.get(token).push(loc)
    }
    if(file.endsWith('.vue'))components.push(record)
  }
  const chapters=list('docs/biblia').filter(f=>/^docs\/biblia\/\d\d-[^/]+\.md$/.test(f)).sort(sort)
  const pages=chapters.map(f=>({id:'biblia-'+path.basename(f,'.md'),source:f,md:read(f)}))
  const add=(id,md)=>pages.push({id:'biblia-'+id,source:'scripts/gen-engineering-bible.mjs',md})
  const pkg=JSON.parse(read('package.json')), lock=JSON.parse(read('package-lock.json'))
  const scripts=list('scripts').filter(f=>!f.startsWith('scripts/fixtures/'))
  const fixtures=list('scripts').filter(f=>f.startsWith('scripts/fixtures/'))
  const contracts=list('docs/architecture')
  const qa=JSON.parse(read('scripts/qa-suites.json')).groups
  const baselineRoots=['src','electron','vscode-extension','capture-app','filmmaker-mobile','vendor/trianghor','vendor/century-fluids']
  const digest=crypto.createHash('sha256');for(const f of files){digest.update(f+'\0');digest.update(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest())}
  add('inventario-general',`# Inventario y dependencias\n\nVersión declarada: **${pkg.version}**. SHA-256 del inventario de raíces fuente (ruta y hash binario por archivo, ordenados): \`${digest.digest('hex')}\`. No es el hash del ZIP.\n\n${table(['Raíz','Archivos'],baselineRoots.map(r=>[code(r),files.filter(f=>f.startsWith(r+'/')).length]))}\n${records.reduce((n,r)=>n+r.symbols.length,0)} entradas de símbolos AST; ${records.reduce((n,r)=>n+r.errors,0)} diagnósticos de análisis sintáctico (no equivalen a diagnósticos de tipos). ${components.length} componentes Vue. ${tokens.size} nombres de tokens CSS declarados detectados. ${scripts.length} archivos de scripts fuera de fixtures; ${fixtures.length} fixtures; ${contracts.length} archivos de arquitectura.\n\n## Dependencias del paquete raíz\n\nLa resolución procede de package-lock.json; no acredita instalación, auditoría de licencias ni ejecución.\n\n${table(['Paquete','Rango','Resuelto'],Object.entries({...pkg.dependencies,...pkg.devDependencies}).sort(([a],[b])=>sort(a,b)).map(([n,v])=>[code(n),code(v),code(lock.packages?.['node_modules/'+n]?.version|| (lock.packages?.['node_modules/'+n]?.link?'enlace local':'no resuelto'))]))}\n\n## Módulos con mayor número de importadores\n\nSolo imports/exports/require literales resueltos dentro del inventario. No mide llamadas, dependencias dinámicas ni rendimiento.\n\n${table(['Archivo','Importadores'],[...incoming].sort((a,b)=>b[1].size-a[1].size||sort(a[0],b[0])).slice(0,30).map(([f,s])=>[code(f),s.size]))}`)
  const groupOf=f=>f.startsWith('src/engine/runtime/')?f.split('/').slice(0,4).join('/'):f.startsWith('src/')?f.split('/').slice(0,Math.min(3,f.split('/').length-1)).join('/'):f.split('/').slice(0,f.startsWith('vendor/')?2:1).join('/')
  const groups=new Map();for(const r of records){const g=groupOf(r.file);if(!groups.has(g))groups.set(g,[]);groups.get(g).push(r)}
  for(const [group,rs] of groups){for(const [i,subset] of chunks(rs,24).entries()){
    const id='fuentes-'+slug(group)+'-'+(i+1)
    const text=subset.map(r=>`## ${r.file.replaceAll("_", "\\_")}\n\n${r.bytes} bytes; ${r.lines||'—'} líneas de texto analizado; ${incoming.get(r.file)?.size||0} importadores detectados; ${r.errors} diagnósticos sintácticos.\n\n${r.imports.length?'**Dependencias:** '+r.imports.map(x=>code(x.spec)+' (L'+x.line+(x.target?' → '+code(x.target):'')+')').join('; ')+'.\n\n':''}${r.symbols.length?'**Símbolos:** '+r.symbols.map(x=>code(x.name)+' '+x.kind+' (L'+x.line+')').join('; ')+'.\n\n':''}${r.file.endsWith('.vue')?'**Componente Vue:** '+r.styles+' bloques de estilo; props: '+(r.props.map(code).join(', ')||'no detectadas por macro literal')+'; emits: '+(r.emits.map(code).join(', ')||'no detectados por macro literal')+'.\n':''}`).join('\n')
    add(id,`# Fuentes · ${group} (${i+1})\n\nÍndice AST, no contrato de API. Los recursos binarios se enumeran sin analizar su contenido. Los nombres de métodos anidados son pistas de navegación, no garantías de visibilidad.\n\n${text}`)
  }}
  for(const [i,subset] of chunks([...tokens].sort(([a],[b])=>sort(a,b)),70).entries())add('css-'+(i+1),`# Tokens CSS (${i+1})\n\nDeclaraciones detectadas en CSS y bloques Vue; no demuestra cascada efectiva.\n\n${table(['Token','Declaraciones (ruta y línea)'],subset.map(([n,loc])=>[code(n),loc.map(code).join('; ')]))}`)
  for(const [i,subset] of chunks(components,100).entries())add('vue-'+(i+1),`# Componentes Vue (${i+1})\n\nInventario de componentes; props/emits literales y número de bloques de estilo.\n\n${table(['Componente','Líneas','Estilos','Props / emits'],subset.map(r=>[code(r.file),r.lines,r.styles,[...r.props,...r.emits].map(code).join(', ')||'—']))}`)
  for(const [label,arr] of [['scripts',scripts],['fixtures',fixtures],['contratos',contracts]])for(const [i,subset] of chunks(arr,120).entries())add(label+'-'+(i+1),`# ${label[0].toUpperCase()+label.slice(1)} (${i+1})\n\nCatálogo de archivos presentes; el nombre de un documento no acredita vigencia ni PASS.\n\n${subset.map(f=>'- '+code(f)).join('\n')}\n`)
  for(const [i,subset] of chunks(Object.entries(qa),55).entries())add('runners-'+(i+1),`# Suites QA (${i+1})\n\nCada grupo se ejecuta mediante npm run test:suite -- nombre. No se infiere resultado de su registro.\n\n${table(['Suite','Definición'],subset.map(([n,v])=>[code(n),code(JSON.stringify(v))]))}`)
  add('comandos-npm',`# Comandos npm\n\n${table(['Comando','Definición'],Object.entries(pkg.scripts).map(([n,v])=>[code(n),code(v)]))}`)
  const index=pages[0];index.md+='\n## Índice completo\n\n'+pages.slice(1).map(p=>`- [${p.md.match(/^# (.+)$/m)[1]}](#/${p.id})`).join('\n')+'\n'
  return pages
}
