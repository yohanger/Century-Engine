// Cliente local de apertura. El sincronizador de archivos sigue perteneciendo al Editor.
'use strict'
const net = require('node:net')
const fs = require('node:fs/promises')
const path = require('node:path')
const DESCRIPTOR = '.levelforge/vscode-session.json'
const MAX_FRAME = 65536
const keyOf = value => process.platform === 'win32' ? value.toLowerCase() : value
const within = (file,root) => keyOf(file).startsWith(keyOf(root+path.sep))

function startVSCodeBridge(vscode, version, { connect = net.createConnection } = {}) {
  const roots = new Map()
  let disposed = false
  async function serve(root, data) {
    if (data.type === 'insertNode') {
      if (typeof data.nodeId !== 'string' || !data.nodeId || data.nodeId.length > 160 || /[\x00-\x1f\x7f]/.test(data.nodeId)) throw Error('Referencia de nodo inválida.')
      const editor = vscode.window.activeTextEditor
      if (!editor || editor.document?.languageId !== 'javascript' || editor.document?.uri?.scheme && editor.document.uri.scheme !== 'file') throw Error('Selecciona un script JavaScript de Assets en VS Code.')
      const actual = await fs.realpath(editor.document.uri.fsPath)
      const relative = path.relative(root, actual).split(path.sep).join('/')
      if (!within(actual, root) || !relative.startsWith('Assets/') || !relative.endsWith('.js') || !(await fs.stat(actual)).isFile()) throw Error('El archivo activo no pertenece a los scripts del proyecto.')
      const workspaces = await Promise.all((vscode.workspace.workspaceFolders || []).map(f=>fs.realpath(f.uri.fsPath).catch(()=>null)))
      if (!workspaces.some(p=>p&&keyOf(p)===keyOf(root))) throw Error('Proyecto no abierto en VS Code.')
      const expression = `game.node(${JSON.stringify(data.nodeId)})`
      if (!await editor.edit(edit => edit.replace(editor.selection, expression), {undoStopBefore:true,undoStopAfter:true})) throw Error('No se pudo insertar la referencia en el editor.')
      return
    }
    if (data.type !== 'open' || typeof data.id !== 'string' || data.id.length > 100) throw Error('Solicitud de apertura inválida.')
    const actualRoots = await Promise.all((vscode.workspace.workspaceFolders || []).map(f=>fs.realpath(f.uri.fsPath).catch(()=>null)))
    if (!actualRoots.some(p=>p&&keyOf(p)===keyOf(root))) throw Error('El proyecto ya no está abierto en esta ventana.')
    if (data.file === null) {
      await vscode.commands.executeCommand('workbench.view.explorer')
      return
    }
    if (typeof data.file !== 'string' || !data.file.startsWith('Assets/') || !data.file.endsWith('.js') || data.file.includes('\\') || data.file.split('/').some(p=>!p||p==='.'||p==='..')) throw Error('Ruta de script inválida.')
    const file = await fs.realpath(path.join(root,data.file))
    if (!within(file,root) || !(await fs.stat(file)).isFile()) throw Error('El script está fuera del proyecto o ya no existe.')
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(file))
    await vscode.window.showTextDocument(document,{preview:false,preserveFocus:false})
  }
  function create(rootPath) {
    let socket = null, timer = null, generation = 0, delay = 250, stopped = false, buffer = '', queue = Promise.resolve()
    let ready = false, session = null
    const schedule = () => { if(!stopped&&!disposed&&!timer){timer=setTimeout(()=>{timer=null;attempt()},delay);delay=Math.min(10000,delay*2)} }
    const reset = () => {generation++;ready=false;socket?.destroy();socket=null;clearTimeout(timer);timer=null}
    async function attempt() {
      reset();const pass=generation
      try {
        const root=await fs.realpath(rootPath),folder=await fs.realpath(path.join(root,'.levelforge'))
        if(!within(folder,root))return
        const filename=path.join(root,DESCRIPTOR),info=await fs.stat(filename)
        if(info.size>4096)throw Error('Descriptor demasiado grande')
        const descriptor=JSON.parse(await fs.readFile(filename,'utf8'))
        if(stopped||disposed||pass!==generation)return
        if(descriptor.protocol!==1||descriptor.host!=='127.0.0.1'||!Number.isInteger(descriptor.port)||descriptor.port<1||descriptor.port>65535||keyOf(descriptor.root)!==keyOf(root)||!/^[a-f0-9]{64}$/.test(descriptor.token)||!/^[a-f0-9]{32}$/.test(descriptor.session))throw Error('Descriptor de sesión inválido')
        session=descriptor.session;buffer='';ready=false;queue=Promise.resolve()
        const channel=connect({host:'127.0.0.1',port:descriptor.port});socket=channel
        channel.setEncoding('utf8');channel.setNoDelay(true);channel.setTimeout(2500)
        channel.on('timeout',()=>channel.destroy())
        channel.on('error',()=>{})
        channel.on('close',()=>{if(socket===channel){socket=null;ready=false;if(pass===generation)schedule()}})
        channel.on('connect',()=>channel.write(JSON.stringify({type:'hello',protocol:1,root,session,token:descriptor.token,version,app:vscode.env.appName,focused:!!vscode.window.state?.focused})+'\n'))
        channel.on('data',chunk=>{
          if(stopped||disposed||pass!==generation){channel.destroy();return}
          buffer+=chunk;if(Buffer.byteLength(buffer)>MAX_FRAME){channel.destroy();return}
          let end
          while((end=buffer.indexOf('\n'))>=0){
            let message;try{message=JSON.parse(buffer.slice(0,end))}catch{channel.destroy();return};buffer=buffer.slice(end+1)
            if(!message||typeof message!=='object'||Array.isArray(message)){channel.destroy();return}
            if(!ready){
              if(message.type!=='ready'||message.protocol!==1||message.session!==session){channel.destroy();return}
              ready=true;delay=250;channel.setTimeout(0)
            }else{
              // Orden por ventana; no ejecutar después de una desconexión o cambio de sesión.
              queue=queue.then(async()=>{
                if(stopped||disposed||pass!==generation||channel.destroyed)return
                try{await serve(root,message);if(!channel.destroyed)channel.write(JSON.stringify({type:'ack',id:message.id,ok:true})+'\n')}
                catch(error){if(!channel.destroyed)channel.write(JSON.stringify({type:'ack',id:message?.id,ok:false,error:String(error.message).slice(0,1000)})+'\n')}
              }).catch(()=>channel.destroy())
            }
          }
        })
      }catch(error){if(stopped||disposed||pass!==generation)return;if(error.code!=='ENOENT')schedule()}
    }
    const watcher=vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(rootPath,DESCRIPTOR))
    const subscriptions=[watcher.onDidCreate(()=>attempt()),watcher.onDidChange(()=>attempt()),watcher.onDidDelete(()=>reset()),watcher]
    attempt()
    return {
      focus:focused=>{if(ready&&socket&&!socket.destroyed)socket.write(JSON.stringify({type:'focus',focused})+'\n')},
      dispose(){stopped=true;reset();for(const subscription of subscriptions)subscription.dispose()},
    }
  }
  function refresh() {
    const current=new Set((vscode.workspace.workspaceFolders||[]).map(f=>f.uri.fsPath))
    for(const [root,client]of roots)if(!current.has(root)){client.dispose();roots.delete(root)}
    for(const root of current)if(!roots.has(root))roots.set(root,create(root))
  }
  const workspaceSubscription=vscode.workspace.onDidChangeWorkspaceFolders(refresh)
  const focusSubscription=vscode.window.onDidChangeWindowState(state=>{for(const client of roots.values())client.focus(state.focused)})
  refresh()
  return {dispose(){disposed=true;workspaceSubscription.dispose();focusSubscription.dispose();for(const client of roots.values())client.dispose();roots.clear()}}
}
module.exports={startVSCodeBridge,DESCRIPTOR}
