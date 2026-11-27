// Prueba del runner: el CLI controlado no acredita VS Code ni Flatpak reales.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import vm from 'node:vm'
const exec = promisify(execFile)

for (const mode of ['host-failed', 'sandbox-denied', 'cli-failed']) test('S04 diagnóstico: conservar evidencia de ' + mode + ' sin declarar PASS', async t => {
  if (process.platform === 'win32') return t.skip('Fixture de CLI POSIX; Windows real sigue pendiente')
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'lf-runner-diag-'))
  t.after(() => fs.rm(temporary, { recursive: true, force: true }))
  const flatpak = mode === 'sandbox-denied'
  const cli = path.join(temporary, flatpak ? 'flatpak' : 'code')
  const script = `#!/usr/bin/env node
const fs = require('node:fs')
const args = process.argv.slice(2)
if (args.includes('--version')) console.log('1.100.0\\ncontrolled')
else if (args.includes('--command=test')) { console.error('ACCESS_DENIED_QA_DRIVER'); process.exitCode = 8 }
else if (args.includes('--list-extensions')) console.log('levelforge.levelforge@0.1.4')
else if (${JSON.stringify(mode)} === 'cli-failed') { console.error('CLI_OPEN_FAILURE'); process.exitCode = 7 }
else { fs.writeFileSync(process.env.LF_QA_VSCODE_RESULT, JSON.stringify({pass:false,phase:'failed',stage:'extension-found',error:'CONTROLLED_ACTIVATION_ERROR'}));console.error('CONTROLLED_CLI_STDERR') }
`
  await fs.writeFile(cli, script, { mode: 0o755 })
  let failure
  try {
    await exec(process.execPath, ['scripts/test-vscode-local-bridge-real-s04-g001.mjs', '--connect-timeout-ms', '100', ...(flatpak ? ['--flatpak'] : [])], {
      env: { ...process.env, PATH: temporary + path.delimiter + process.env.PATH }, timeout: 15000,
    })
    assert.fail('El runner debe fallar')
  } catch (error) { failure = error }
  assert.equal(failure.code, 1)
  const marker = 'LF_VSCODE_REAL_FAIL\n', start = failure.stderr.indexOf(marker)
  assert.ok(start >= 0, failure.stderr)
  const body = failure.stderr.slice(start + marker.length).split('\nDiagnóstico conservado en:')[0].trim()
  const report = JSON.parse(body)
  t.after(() => fs.rm(report.diagnosticDirectory, { recursive: true, force: true }))
  assert.equal(report.pass, false)
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(report.diagnosticDirectory, 'failure-report.json'))), report)
  assert.equal(failure.stdout.includes('activation\": \"PASS'), false)
  if (flatpak) {
    assert.equal(report.phase, 'sandbox-driver-access');assert.match(report.error, /ACCESS_DENIED_QA_DRIVER/)
    assert.equal(report.bridgeStats, null)
  } else {
    assert.equal(report.bridgeStats.connections, 0)
    if (mode === 'host-failed') {
      assert.equal(report.host.stage, 'extension-found');assert.equal(report.host.error, 'CONTROLLED_ACTIVATION_ERROR')
      assert.match(report.calls.at(-1).stderr, /CONTROLLED_CLI_STDERR/)
    } else assert.match(report.calls.at(-1).stderr, /CLI_OPEN_FAILURE/)
    const descriptor = path.join(report.diagnosticDirectory, 'Proyecto con espacios/.levelforge/vscode-session.json')
    await assert.rejects(fs.access(descriptor), { code: 'ENOENT' })
  }
})

test('S04 diagnóstico: el driver conserva la etapa y el error de activación', async () => {
  const source = await fs.readFile('scripts/fixtures/vscode-extension-s03/tests.cjs', 'utf8')
  const writes = [], context = { exports: {}, process: { env: { LF_QA_VSCODE_RESULT: '/controlled-result' } }, console }
  const vscode = { version: 'controlled', extensions: { getExtension: () => ({ packageJSON: { version: '0.1.4' }, extensionPath: '/controlled', activate: async () => { throw Error('ACTIVATION_FAILED') } }) } }
  context.process.env.LF_QA_VSCODE_VERSION = '0.1.4';context.process.env.LF_QA_VSCODE_EXTENSIONS = '/controlled'
  context.require = name => name === 'vscode' ? vscode : name === 'node:fs' ? { writeFileSync: (_, text) => writes.push(JSON.parse(text)) } : name === 'node:assert/strict' ? assert : path
  vm.runInNewContext(source, context)
  await assert.rejects(context.exports.run(), /ACTIVATION_FAILED/)
  assert.equal(writes[0].phase, 'host-start')
  assert.equal(writes.at(-1).phase, 'failed');assert.equal(writes.at(-1).stage, 'extension-found')
  assert.equal(writes.at(-1).pass, false);assert.match(writes.at(-1).error, /ACTIVATION_FAILED/)
})

test('S04 CORR-002 runner: completar 20 aperturas antes de terminar el CLI controlado', async t => {
  if (process.platform === 'win32') return t.skip('Fixture de CLI POSIX; no acredita VS Code real')
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'lf-runner-held-'))
  t.after(() => fs.rm(temporary, { recursive: true, force: true }))
  const cli = path.join(temporary, 'code'), observed = path.join(temporary, 'observed.json')
  await fs.writeFile(cli, `#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),args=process.argv.slice(2)
if(args.includes('--version'))console.log('1.100.0\\ncontrolled')
else if(args.includes('--list-extensions'))console.log('levelforge.levelforge@0.1.4')
else {
 const root=args.at(-1),descriptor=JSON.parse(fs.readFileSync(path.join(root,'.levelforge/vscode-session.json')))
 const socket=net.createConnection({host:descriptor.host,port:descriptor.port});let buffer='',opens=[]
 socket.setEncoding('utf8');socket.on('error',error=>{console.error(error);process.exitCode=1})
 socket.on('connect',()=>socket.write(JSON.stringify({...descriptor,type:'hello',version:'0.1.4',app:'CONTROLLED QA'})+'\\n'))
 socket.on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\\n'))>=0){const data=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1)
  if(data.type==='ready')fs.writeFileSync(process.env.LF_QA_VSCODE_RESULT,JSON.stringify({pass:true,phase:'ready'}))
  if(data.type==='open'){opens.push(data.file);socket.write(JSON.stringify({type:'ack',id:data.id,ok:true})+'\\n')}
 }})
 const timer=setInterval(()=>{
  if(!fs.existsSync(process.env.LF_QA_VSCODE_HOST_COMPLETE))return
  const marker=JSON.parse(fs.readFileSync(process.env.LF_QA_VSCODE_HOST_COMPLETE));clearInterval(timer)
  fs.writeFileSync(${JSON.stringify(observed)},JSON.stringify({opens,aborted:!!marker.abort,root}))
  fs.writeFileSync(process.env.LF_QA_VSCODE_RESULT,JSON.stringify({pass:!marker.abort,phase:marker.abort?'failed':'complete'}))
  socket.end()
 },20)
}
`, { mode: 0o755 })
  const result = await exec(process.execPath, ['scripts/test-vscode-local-bridge-real-s04-g001.mjs'], {
    env: { ...process.env, PATH: temporary + path.delimiter + process.env.PATH }, timeout: 15000,
  })
  const report = JSON.parse(result.stdout)
  assert.equal(report.activation, 'PASS');assert.equal(report.opens, 20)
  assert.equal(report.cliCallsWhileConnected, 0);assert.equal(report.cliLaunchesWhileConnected, 0)
  const data = JSON.parse(await fs.readFile(observed))
  assert.equal(data.aborted, false);assert.equal(data.opens[0], null)
  assert.equal(data.opens.length, 21);assert.ok(data.opens.slice(1).every(file => file === 'Assets/Second.js'))
  await assert.rejects(fs.access(path.dirname(data.root)), { code: 'ENOENT' })
})
