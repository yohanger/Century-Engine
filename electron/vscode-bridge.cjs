// Canal del Editor con la extensión activa. Las sesiones pertenecen a raíces autorizadas por main.cjs.
const net = require('node:net')
const fs = require('node:fs/promises')
const path = require('node:path')
const { randomBytes, timingSafeEqual } = require('node:crypto')
const semver = require('semver')
const DESCRIPTOR = '.levelforge/vscode-session.json'
const MAX_FRAME = 65536
const keyOf = root => process.platform === 'win32' ? root.toLowerCase() : root
const inside = (file, root) => keyOf(file).startsWith(keyOf(root + path.sep))
const sameToken = (a, b) => typeof a === 'string' && /^[a-f0-9]{64}$/.test(a) && timingSafeEqual(Buffer.from(a), Buffer.from(b))

function createVSCodeBridge({ launch, minimumVersion = '0.1.4', graceMs = 350, connectMs = 30000, requestMs = 5000 } = {}) {
  const sessions = new Map(), sockets = new Set()
  const stats = { launches: 0, requests: 0, acknowledgements: 0, connections: 0 }
  let server = null, listening = null, stopped = false, sequence = 0
  const peer = session => [...session.clients].filter(c => !c.socket.destroyed).sort((a,b) => Number(b.focused)-Number(a.focused) || b.activity-a.activity)[0]
  function attach(socket) {
    sockets.add(socket); socket.setEncoding('utf8'); socket.setNoDelay(true)
    let buffer = '', client = null
    const handshakeTimer = setTimeout(() => socket.destroy(), 2500)
    socket.on('error', () => {})
    socket.on('close', () => {
      clearTimeout(handshakeTimer); sockets.delete(socket)
      if (!client) return
      client.session.clients.delete(client)
      for (const item of client.requests.values()) item.fail(new Error('La extensión se desconectó antes de confirmar la apertura.'))
    })
    socket.on('data', chunk => {
      buffer += chunk
      if (Buffer.byteLength(buffer) > MAX_FRAME) { socket.destroy(); return }
      let end
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0,end); buffer = buffer.slice(end+1)
        let data
        try { data = JSON.parse(line) } catch { socket.destroy(); return }
        if (!data || typeof data !== 'object' || Array.isArray(data)) { socket.destroy(); return }
        if (!client) {
          const session = typeof data.root === 'string' && sessions.get(keyOf(data.root))
          if (data.type !== 'hello' || data.protocol !== 1 || !session || session.closed || data.session !== session.id ||
              !sameToken(data.token,session.token) || !semver.valid(data.version) || !semver.gte(data.version,minimumVersion) || session.clients.size >= 8) {
            socket.destroy(); return
          }
          clearTimeout(handshakeTimer)
          client = { socket, session, version:data.version, app:String(data.app || 'VS Code').slice(0,100), focused:!!data.focused, activity:Date.now(), requests:new Map() }
          if (client.focused) for (const other of session.clients) other.focused = false
          session.clients.add(client); stats.connections++
          socket.write(JSON.stringify({type:'ready',protocol:1,session:session.id})+'\n')
          for (const done of [...session.waiters]) done(client)
        } else if (data.type === 'focus') {
          client.focused = !!data.focused; client.activity = Date.now()
          if (client.focused) for (const other of client.session.clients) if (other !== client) other.focused = false
        } else if (data.type === 'ack') {
          const item = client.requests.get(data.id)
          if (item) {
            if (data.ok === true) { stats.acknowledgements++; item.done() }
            else item.fail(new Error(String(data.error || 'VS Code rechazó la apertura.').slice(0,1000)))
          }
        } else { socket.destroy(); return }
      }
    })
  }
  async function start() {
    if (stopped) throw new Error('El puente de VS Code está cerrado.')
    if (!listening) listening = new Promise((resolve,reject) => {
      server = net.createServer(attach); server.maxConnections = 32
      server.on('error', reject)
      server.listen(0,'127.0.0.1',()=>{server.unref();resolve(server.address().port)})
    }).catch(error => { listening = null; throw error })
    return listening
  }
  async function sessionFor(directory) {
    const root = await fs.realpath(directory), key = keyOf(root)
    let session = sessions.get(key)
    if (!session) {
      session = { root, id:randomBytes(16).toString('hex'), token:randomBytes(32).toString('hex'), clients:new Set(), waiters:new Set(), pending:new Map(), boot:null, closed:false }
      sessions.set(key,session)
      session.ready = (async () => {
        const port = await start(), folder = path.join(root,'.levelforge')
        await fs.mkdir(folder,{recursive:true})
        if (!inside(await fs.realpath(folder),root)) throw new Error('La carpeta .levelforge está fuera del proyecto.')
        const descriptor = path.join(root,DESCRIPTOR), temporary = descriptor+'.'+session.id+'.tmp'
        try {
          await fs.writeFile(temporary,JSON.stringify({protocol:1,host:'127.0.0.1',port,root,session:session.id,token:session.token})+'\n',{mode:0o600,flag:'wx'})
          await fs.rename(temporary,descriptor)
        } finally { await fs.rm(temporary,{force:true}).catch(()=>{}) }
      })().catch(error=>{if(sessions.get(key)===session)sessions.delete(key);throw error})
    }
    await session.ready
    return session
  }
  function waitPeer(session, milliseconds) {
    const active = peer(session)
    if (active || session.closed) return Promise.resolve(active || null)
    return new Promise(resolve=>{
      const done = value => {clearTimeout(timer);session.waiters.delete(done);resolve(value)}
      const timer = setTimeout(()=>done(null),milliseconds)
      session.waiters.add(done)
    })
  }
  function request(client,file, { type = 'open', nodeId = null } = {}) {
    return new Promise((resolve,reject)=>{
      const id = type + '_' + ++sequence
      const finish = (error) => {clearTimeout(timer);client.requests.delete(id);error?reject(error):resolve()}
      const timer = setTimeout(()=>{finish(new Error('VS Code no confirmó la apertura a tiempo.'));client.socket.destroy()},requestMs)
      client.requests.set(id,{done:()=>finish(),fail:finish});stats.requests++
      client.socket.write(JSON.stringify(type === 'insertNode' ? { type, id, nodeId } : { type, id, file })+'\n',error=>{if(error)finish(error)})
    })
  }
  function connectSession(session, onPhase) {
    return new Promise((resolve,reject)=>{
      const controller = new AbortController()
      let finished = false, timer = null, extension
      const cleanup = () => { clearTimeout(timer); session.waiters.delete(connected) }
      const connected = client => {
        if (finished) return
        finished = true; cleanup()
        if (!client) controller.abort()
        resolve({client,result:{extension}})
      }
      const failed = error => {
        if (finished) return
        finished = true; cleanup(); controller.abort(); reject(error)
      }
      const prepared = value => {
        if (finished) return
        extension = value
        onPhase('connecting')
        if (!timer) timer = setTimeout(()=>failed(new Error('No se conectó la extensión de Century. Si VS Code estaba abierto durante la actualización, recarga su ventana y reintenta.')),connectMs)
      }
      // La extensión puede conectar mientras el CLI sigue asociado a su ventana.
      // Su salida no confirma la apertura; la confirma el ACK del cliente autenticado.
      session.waiters.add(connected); stats.launches++; onPhase('starting')
      Promise.resolve().then(()=>launch(session.root,null,{signal:controller.signal,onPrepared:prepared})).then(result=>{
        if (finished) return
        const active = peer(session)
        if (active || session.closed) { connected(active || null); return }
        if (!result.ok) { failed(new Error(result.error)); return }
        prepared(result.extension)
      }).catch(failed)
    })
  }
  async function open(directory, file = null, { onPhase = () => {} } = {}) {
    let session
    try { session = await sessionFor(directory) }
    catch(error) {return {ok:false,stage:'bridge',error:error.message}}
    let relative = null
    if (file !== null) {
      try {
        const actual = await fs.realpath(file)
        relative = path.relative(session.root,actual).split(path.sep).join('/')
        if (!inside(actual,session.root) || !relative.startsWith('Assets/') || !relative.endsWith('.js') || !(await fs.stat(actual)).isFile()) throw Error('Solo se abren scripts .js dentro de Assets del proyecto.')
      } catch(error) {return {ok:false,stage:'path',error:error.message}}
    }
    if (session.pending.has(relative)) return session.pending.get(relative)
    const task = (async()=>{
      const began = performance.now();let extension
      onPhase('connecting')
      let client = peer(session) || await waitPeer(session,graceMs)
      if (!client && !session.closed) {
        if (!session.boot) {
          session.boot = connectSession(session,onPhase).finally(()=>{session.boot=null})
        }
        const boot = await session.boot; extension = boot.result.extension
        onPhase('connecting');client = boot.client
      }
      if (session.closed) return {ok:false,canceled:true}
      if (!client) throw Error('No se conectó la extensión de Century. Si VS Code estaba abierto durante la actualización, recarga su ventana y reintenta.')
      onPhase('opening');await request(client,relative)
      if (session.closed) return {ok:false,canceled:true}
      onPhase('connected')
      return {ok:true,transport:'bridge',extension:extension || {status:'active',version:client.version},app:client.app,elapsedMs:performance.now()-began}
    })().catch(error=>session.closed?{ok:false,canceled:true}:{ok:false,stage:'bridge',error:error.message})
    session.pending.set(relative,task)
    try {return await task} finally {if(session.pending.get(relative)===task)session.pending.delete(relative)}
  }
  async function insertNode(directory, nodeId) {
    if (typeof nodeId !== 'string' || !nodeId || nodeId.length > 160 || /[\x00-\x1f\x7f]/.test(nodeId)) return { ok:false, error:'ID de nodo inválido.' }
    let session
    try { session = await sessionFor(directory) }
    catch (error) { return { ok:false, error:error.message } }
    const client = peer(session) || await waitPeer(session, graceMs)
    if (!client || session.closed) return { ok:false, error:'Abre un script del proyecto en VS Code antes de insertar un nodo.' }
    try { await request(client, null, { type:'insertNode', nodeId }); return { ok:true } }
    catch (error) { return { ok:false, error:error.message } }
  }
  async function release(directory) {
    let root
    try {root=await fs.realpath(directory)} catch {return}
    const key=keyOf(root),session=sessions.get(key)
    if(!session)return
    session.closed=true;sessions.delete(key)
    for(const done of [...session.waiters])done(null)
    for(const client of session.clients)client.socket.destroy()
    try {
      await session.ready
      const file=path.join(root,DESCRIPTOR),data=JSON.parse(await fs.readFile(file,'utf8'))
      if(data.session===session.id&&sameToken(data.token,session.token))await fs.rm(file,{force:true})
    } catch { /* cierre tras descriptor ausente o proyecto retirado */ }
  }
  async function close() {
    stopped=true
    await Promise.all([...sessions.values()].map(s=>release(s.root)))
    for(const socket of sockets)socket.destroy()
    if(server?.listening)await new Promise(resolve=>server.close(resolve))
  }
  return {open,insertNode,release,close,stats:()=>({...stats,sessions:sessions.size})}
}
module.exports={createVSCodeBridge,DESCRIPTOR}
