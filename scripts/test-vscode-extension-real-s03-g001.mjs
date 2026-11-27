// QA opcional con VS Code instalado: usa directorios aislados, nunca las extensiones del usuario.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const require = createRequire(import.meta.url), exec = promisify(execFile)
const { openVSCode, vscodeLaunchers } = require('../electron/vscode.cjs')
const root = fileURLToPath(new URL('..', import.meta.url))
const flatpak = process.argv.includes('--flatpak')
const bridgeMode = process.argv.includes('--bridge')
const timeoutIndex = process.argv.indexOf('--connect-timeout-ms')
const connectMs = timeoutIndex < 0 ? 30000 : Number(process.argv[timeoutIndex + 1])
assert.ok(Number.isInteger(connectMs) && connectMs >= 100 && connectMs <= 120000, 'Timeout QA inválido (100–120000 ms)')
const candidates = flatpak ? [{ command: 'flatpak', prefix: ['run', 'com.visualstudio.code'] }] : vscodeLaunchers(process.platform, process.env).filter(l => l.command !== 'flatpak')
let launcher
for (const candidate of candidates) {
  try {
    const env = { ...process.env }; if (candidate.cli) env.ELECTRON_RUN_AS_NODE = '1'; else delete env.ELECTRON_RUN_AS_NODE
    const result = await exec(candidate.command, [...(candidate.cli ? [candidate.cli] : candidate.prefix || []), '--version'], { env, timeout: 15000 })
    if (/^\d+\.\d+\.\d+/m.test(result.stdout)) { launcher = candidate; break }
  } catch { /* probar siguiente instalación */ }
}
if (!launcher) { console.error('NO VERIFICADO: no hay un CLI real de VS Code disponible para esta plataforma.'); process.exitCode = 1 }
else {
  const parent = flatpak ? path.join(os.homedir(), '.var/app/com.visualstudio.code/cache/levelforge') : os.tmpdir()
  await fs.mkdir(parent, { recursive: true })
  const temporary = await fs.mkdtemp(path.join(parent, 'lf-vscode-real-'))
  let passed = false, currentPhase = 'preparing', bridgeStats = null
  const calls = []
  const report = (data) => fs.writeFile(path.join(temporary, 'failure-report.json'), JSON.stringify(data, null, 2) + '\n')
  try {
    const workspace = path.join(temporary, 'Proyecto con espacios'), extensions = path.join(temporary, 'extensions'), user = path.join(temporary, 'user')
    await fs.mkdir(path.join(workspace, 'Assets'), { recursive: true })
    await fs.mkdir(path.join(workspace, '.levelforge'), { recursive: true })
    await fs.writeFile(path.join(workspace, 'project.lfproj'), '{}')
    await fs.copyFile(path.join(root, 'src/core/events/game-api.d.ts'), path.join(workspace, '.levelforge/api.d.ts'))
    await fs.writeFile(path.join(workspace, 'jsconfig.json'), JSON.stringify({ compilerOptions: { checkJs: true, target: 'ES2022' }, include: ['Assets/**/*.js', '.levelforge/*.d.ts'] }))
    await fs.writeFile(path.join(workspace, 'Assets/QA.js'), 'game.;\n\nnode.;\n')
    const extra = ['--user-data-dir', user, '--extensions-dir', extensions, '--disable-workspace-trust']
    if (process.platform === 'linux' && process.getuid?.() === 0) extra.push('--no-sandbox')
    const driver = path.join(root, 'scripts/fixtures/vscode-extension-s03')
    const resultFile = path.join(temporary, 'activation-result.json')
    const hostComplete = path.join(temporary, 'host-complete.json')
    const signalHost = async value => {
      const pending = hostComplete + '.tmp'
      await fs.writeFile(pending, JSON.stringify(value))
      await fs.rename(pending, hostComplete)
    }
    const version = JSON.parse(await fs.readFile(path.join(root, 'vendor/vscode-extension/manifest.json'))).version
    let installed = 0, cliCalls = 0
    const openingExits = []
    // Inyectar solo aislamiento; todas las decisiones de instalación son del lanzador productivo.
    const run = (command, args, options, done) => {
      cliCalls++
      const probe = args.includes('--command=test')
      const opening = !probe && !args.some(a => ['--version', '--list-extensions', '--install-extension'].includes(a))
      if (args.includes('--install-extension')) installed++
      const head = launcher.cli ? 1 : (launcher.prefix || []).length
      if (opening) rmSync(resultFile, { force: true })
      const actual = probe ? args : [...args.slice(0, head), ...extra, ...(opening ? [...(!bridgeMode ? ['--wait'] : []), '--extensionDevelopmentPath', driver, '--extensionTestsPath', path.join(driver, 'tests.cjs')] : []), ...args.slice(head)]
      const call = { command, args: actual, phase: opening ? 'open' : probe ? 'sandbox-access' : 'prepare', startedAt: new Date().toISOString() }
      calls.push(call)
      let exited
      if (opening) openingExits.push(new Promise(resolve=>{exited=resolve}))
      execFile(command, actual, { ...options, timeout: opening && !options.signal ? 120000 : options.timeout,
        env: { ...options.env, LF_QA_VSCODE_VERSION: version, LF_QA_VSCODE_EXTENSIONS: extensions, LF_QA_VSCODE_RESULT: resultFile, ...(bridgeMode ? { LF_QA_VSCODE_HOST_COMPLETE: hostComplete } : {}) } }, (error, stdout, stderr) => {
        if (opening && !error && !bridgeMode) {
          try { assert.equal(JSON.parse(readFileSync(resultFile)).pass, true) }
          catch { error = new Error('El host no confirmó la activación y las sugerencias') }
        }
        call.finishedAt = new Date().toISOString()
        call.error = error?.message || null
        call.stdout = String(stdout || '').slice(-6000)
        call.stderr = String(stderr || '').slice(-6000)
        exited?.()
        done(error, stdout, stderr)
      })
    }
    const options = { launchers: [launcher], run, bundleDir: path.join(root, 'vendor/vscode-extension') }
    // Comprobar el fixture dentro del sandbox antes de atribuir un fallo a la conexión.
    if (flatpak) {
      currentPhase = 'sandbox-driver-access'
      for (const name of ['package.json', 'driver.cjs', 'tests.cjs']) {
        await exec('flatpak', ['run', '--command=test', 'com.visualstudio.code', '-r', path.join(driver, name)], { timeout: 15000 })
      }
    }
    if (bridgeMode) {
      const { createVSCodeBridge } = require('../electron/vscode-bridge.cjs')
      const local = createVSCodeBridge({ connectMs, graceMs: 500, launch: (dir,file,connection) => openVSCode(dir,file,{...options,...connection}), minimumVersion: version })
      try {
        await fs.writeFile(path.join(workspace, 'Assets/Second.js'), '// QA puente local')
        currentPhase = 'connecting'
        const first = await local.open(workspace,null)
        assert.equal(first.ok,true,first.error)
        async function waitPhase(phase) {
          for(let i=0;i<1200;i++) {
            let state
            try { state = JSON.parse(await fs.readFile(resultFile)) } catch {}
            if (state?.pass === false) throw Error('Extension Host: ' + state.error)
            if (state?.phase === phase && state.pass === true) return
            await new Promise(r=>setTimeout(r,100))
          }
          throw Error('El host de VS Code no terminó la fase '+phase)
        }
        currentPhase = 'host-ready';await waitPhase('ready')
        const before=local.stats(), beforeCLI=cliCalls, samples=[]
        currentPhase = 'warm-opens'
        for(let i=0;i<20;i++) {
          const start=performance.now(),result=await local.open(workspace,path.join(workspace,'Assets/Second.js'))
          assert.equal(result.ok,true,result.error);samples.push(performance.now()-start)
        }
        const after=local.stats();assert.equal(after.launches,before.launches);assert.equal(cliCalls,beforeCLI)
        currentPhase = 'host-complete'
        await signalHost({});await waitPhase('complete')
        // La espera del proceso se hace después del ACK y de completar el host,
        // nunca antes de enviar las aperturas que el propio test necesita.
        currentPhase = 'cli-exit'
        let exitTimer
        try { await Promise.race([Promise.all(openingExits),new Promise((_,reject)=>{exitTimer=setTimeout(()=>reject(Error('El host completó QA pero el CLI no terminó al cerrar su ventana de prueba.')),30000)})]) }
        finally { clearTimeout(exitTimer) }
        samples.sort((a,b)=>a-b)
        console.log(JSON.stringify({scope:'VS Code real con extensión instalada, perfiles aislados y servidor productivo',platform:process.platform,flatpak,opens:20,cliLaunchesWhileConnected:after.launches-before.launches,cliCallsWhileConnected:cliCalls-beforeCLI,p50Ms:samples[9],p95Ms:samples[18],installed,activation:'PASS',activeDocument:'Second.js'},null,2))
      } finally {
        bridgeStats = local.stats()
        // Liberar un driver que siga esperando si el Editor abortó antes de su confirmación.
        try { await fs.access(hostComplete) } catch { await signalHost({ abort: true }) }
        await local.close()
      }
    } else {
      for (const expected of ['installed', 'current']) {
        const result = await openVSCode(workspace, null, options)
        assert.equal(result.ok, true, result.error)
        assert.equal(result.extension.status, expected)
      }
      assert.equal(installed, 1)
      console.log('PASS: VS Code real, instalación aislada y reapertura sin reinstalar; activación, comandos, snippets y sugerencias verificadas.')
    }
    passed = true
  } catch (error) {
    let host = null
    try { host = JSON.parse(await fs.readFile(path.join(temporary, 'activation-result.json'))) } catch {}
    const failure = { pass: false, phase: currentPhase, error: error.message, flatpak, connectMs, bridgeStats, host, calls, diagnosticDirectory: temporary }
    await report(failure)
    console.error('LF_VSCODE_REAL_FAIL\n' + JSON.stringify(failure, null, 2))
    console.error('Diagnóstico conservado en: ' + path.join(temporary, 'failure-report.json'))
    process.exitCode = 1
  } finally { if (passed) await fs.rm(temporary, { recursive: true, force: true }) }
}
