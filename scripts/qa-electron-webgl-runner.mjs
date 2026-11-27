// Runner de QA WebGL mediante el Electron ya incluido en Century.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const marker = 'LF_WEBGL_QA_RESULT:'

async function waitServer(url, process, diagnostics) {
  for (let i = 0; i < 120; i++) {
    if (process.exitCode !== null) throw new Error(`Vite finalizó con estado ${process.exitCode}: ${diagnostics().slice(-2500)}`)
    try { if ((await fetch(url)).ok) return } catch { /* Vite aún no escucha. */ }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('Vite no respondió para QA WebGL')
}

export function decodeElectronResult(stdout, stderr, code) {
  const line=stdout.split('\n').find(v=>v.startsWith(marker))
  const diagnostics={exitCode:code, stdout:stdout.split('\n').filter(v=>!v.startsWith(marker)).join('\n').slice(-6000), stderr:stderr.slice(-12000)}
  if (!line) throw new Error(`Electron no devolvió resultado: ${JSON.stringify(diagnostics)}`)
  try { return {...JSON.parse(line.slice(marker.length)), diagnostics} }
  catch (error) { throw new Error(`Resultado Electron inválido: ${error.message}; ${JSON.stringify(diagnostics)}`) }
}

export function formatWebGLFailure(result, serverLog) {
  return JSON.stringify({result:result.data ?? result.error ?? null, error:result.error ?? null, diagnostics:result.diagnostics ?? null, vite:serverLog},null,2)
}

async function runElectron(executable, args, fixtureWaitMs = 20000, profile = null, focusWindow = false) {
  return await new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd:root, env:{...process.env, LF_QA_FIXTURE_WAIT_MS:String(fixtureWaitMs), LF_QA_FOCUS_WINDOW:focusWindow ? '1' : '0', ...(profile ? {LF_QA_PROFILE:profile} : {})}, stdio:['ignore','pipe','pipe'] })
    let stdout = '', stderr = '', timedOut = false
    const timer = setTimeout(() => { timedOut=true;child.kill('SIGKILL') }, fixtureWaitMs + 15000)
    child.stdout.on('data', chunk => { stdout += chunk.toString(); if (stdout.length>2e6) stdout=stdout.slice(-2e6) })
    child.stderr.on('data', chunk => { stderr += chunk.toString(); if (stderr.length>2e6) stderr=stderr.slice(-2e6) })
    child.on('error', error => { clearTimeout(timer);reject(error) })
    child.on('close', code => { clearTimeout(timer)
      if (timedOut) return reject(new Error(`Electron excedió el tiempo de QA: ${stderr.slice(-12000)}; stdout=${stdout.slice(-6000)}`))
      try { resolve(decodeElectronResult(stdout,stderr,code)) } catch (error) { reject(error) }
    })
  })
}

export async function verifyWebGL({port,fixture,id,minChecks=6,fixtureWaitMs=20000,reopen=false,focusWindow=false,runner='qa-electron-webgl.cjs',electronArgs=[]}) {
  const vite = join(root, 'node_modules/vite/bin/vite.js')
  assert.ok(existsSync(vite), 'Falta Vite; ejecutar npm ci antes del QA')
  let electron
  try { electron = (await import('electron')).default } catch { throw new Error('Falta Electron; ejecutar npm ci antes del QA') }
  assert.equal(typeof electron,'string','Electron debe proporcionar un ejecutable instalado')
  const server=spawn(process.execPath, [vite,'--host','127.0.0.1','--port',String(port),'--strictPort'], {
    cwd:root,env:{...process.env,BROWSER:'none'},stdio:['ignore','pipe','pipe'],
  })
  // Conservar el motivo de fallo de Vite; el runner sigue usando Electron embebido.
  let serverLog=''
  for (const stream of [server.stdout,server.stderr]) {
    stream.on('data', data => { serverLog=(serverLog+data.toString()).slice(-6000) })
  }
  const url=`http://127.0.0.1:${port}/${fixture}`
  let profile
  try {
    await waitServer(url,server,()=>serverLog)
    if (reopen) profile=mkdtempSync(join(tmpdir(),'century-workspace-'))
    const args=[...electronArgs]
    if (process.platform==='linux' && process.getuid?.()===0) args.push('--no-sandbox')
    const run = async phase => {
      const target = phase ? `${url}?phase=${phase}` : url
      const result=await runElectron(electron,[...args,join(root,'scripts',runner),target,id],fixtureWaitMs,profile,focusWindow).catch(error=>{throw new Error(`${error.message}\nVite: ${serverLog}`,{cause:error})})
      assert.equal(result.ok,true,formatWebGLFailure(result,serverLog))
      assert.ok(result.data?.checks?.length>=minChecks, `Checks insuficientes: ${result.data?.checks?.length}\n${formatWebGLFailure(result,serverLog)}`)
      console.log(`Electron WebGL: ${result.data.gl || 'activo'}; verificaciones: ${result.data.checks.length}`)
      return result.data
    }
    if (!reopen) return await run(null)
    const write=await run('write')
    const read=await run('read')
    return {write,read}
  } finally { server.kill('SIGTERM'); if (profile) rmSync(profile,{recursive:true,force:true}) }
}
