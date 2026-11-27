// Extensión de Century para VS Code. Sin paso de compilación: este archivo se ejecuta tal cual.
//
// La extensión NO sincroniza nada: de eso se encarga Century (guarda Assets/Scripts/*.js y .levelforge/*.d.ts en la carpeta del
// proyecto). Aquí solo hay lo que VS Code puede aportar: crear scripts, snippets, la referencia de la API y un aviso de estado.
'use strict'
const vscode = require('vscode')
const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')
const core = require('./lib/core.js')
const { startVSCodeBridge } = require('./lib/bridge.js')

const MEDIA = path.join(__dirname, 'media')
const bundledDts = () => fs.readFileSync(path.join(MEDIA, 'game-api.d.ts'), 'utf8')
let status

/** Resuelve el proyecto del recurso o editor activo en un workspace con varias raíces. */
function projectRoot(uri = vscode.window.activeTextEditor?.document.uri) {
  const isProject = root => core.isProject(rel => fs.existsSync(path.join(root, rel)))
  const folder = uri && vscode.workspace.getWorkspaceFolder(uri)
  if (folder) return isProject(folder.uri.fsPath) ? folder.uri.fsPath : null
  const roots = (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath).filter(isProject)
  return roots.length === 1 ? roots[0] : null
}

function refreshStatus() {
  const root = projectRoot()
  if (!root) { status.hide(); return }
  const synced = fs.existsSync(path.join(root, core.FOLDER, 'sync.json'))
  status.text = synced ? '$(check) Century' : '$(warning) Century'
  status.tooltip = synced ? 'Proyecto de Century: los scripts de Assets/ se sincronizan con la aplicación.' : 'Proyecto de Century sin sincronizar: abre la aplicación con este proyecto.'
  status.show()
}

async function newScript(uri) {
  const root = projectRoot(uri)
  if (!root) return vscode.window.showWarningMessage('Abre la carpeta de un proyecto de Century (la que tiene project.lfproj).')
  // desde el explorador: la carpeta pulsada; desde la paleta: la de la configuración
  let folder = core.scriptsFolder(vscode.workspace.getConfiguration('levelforge', vscode.Uri.file(root)).get('scriptsFolder'))
  if (uri?.fsPath) {
    const rel = path.relative(root, uri.fsPath).split(path.sep).join('/')
    if (rel === 'Assets' || rel.startsWith('Assets/')) folder = rel
  }
  const input = await vscode.window.showInputBox({ prompt: `Nombre del script (en ${folder})`, value: 'script', validateInput: (v) => (core.cleanScriptName(v) ? null : 'Escribe un nombre') })
  if (input === undefined) return
  const dir = path.join(root, ...folder.split('/'))
  fs.mkdirSync(dir, { recursive: true })
  const name = core.uniqueName(core.cleanScriptName(input), (n) => fs.existsSync(path.join(dir, n)))
  const file = path.join(dir, name)
  fs.writeFileSync(file, core.SCRIPT_TEMPLATE)
  await prepare(true, root)
  await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(file))
  vscode.window.setStatusBarMessage('Century importará el script en unos segundos', 4000)
}

async function prepare(quiet, root = projectRoot()) {
  if (!root) return quiet ? undefined : vscode.window.showWarningMessage('No hay un proyecto de Century abierto.')
  const out = core.prepareFiles((p) => fs.existsSync(path.join(root, p)), bundledDts())
  for (const [rel, text] of out) {
    const file = path.join(root, ...rel.split('/'))
    fs.mkdirSync(path.dirname(file), { recursive: true })
    try { fs.writeFileSync(file, text, { flag: 'wx' }) }
    catch (err) { if (err.code !== 'EEXIST') throw err }
  }
  if (!quiet) vscode.window.showInformationMessage(out.size ? `Century: preparado (${[...out.keys()].join(', ')}).` : 'Century: el proyecto ya estaba preparado.')
}

async function showApi() {
  const { parseInterface, propertyType } = await import(pathToFileURL(path.join(__dirname, 'lib', 'apiParse.mjs')).href)
  const root = projectRoot()
  const api = root && path.join(root, core.FOLDER, 'api.d.ts')
  const dts = api && fs.existsSync(api) ? fs.readFileSync(api, 'utf8') : bundledDts()
  const items = []
  const add = (prefix, entries) => {
    for (const entry of entries) {
      items.push({
        label: prefix + entry.name,
        description: entry.property ? 'propiedad' : 'método',
        detail: entry.signature.split('\n')[0].replace(/^game\./, prefix),
        documentation: entry.description,
      })
    }
  }
  const top = parseInterface(dts, 'Game')
  add('game.', top)
  for (const entry of top) {
    const type = entry.property && propertyType(entry)
    if (type) add(`game.${entry.name}.`, parseInterface(dts, type))
  }
  add('node.', [
    ...parseInterface(dts, 'NodeHandle'),
    ...parseInterface(dts, 'NodeScriptHandle'),
  ])
  add('CharacterBody3D · node.', parseInterface(dts, 'CharacterBody3DNodeScriptHandle'))
  const pick = await vscode.window.showQuickPick(items.map(i => ({
    label: i.label, description: i.description,
    detail: i.documentation ? `${i.documentation}\n${i.detail}` : i.detail,
  })), { title: 'API de Century', matchOnDetail: true, placeHolder: 'Busca en game.* o node.* (Script de Nodo)' })
  if (pick) await vscode.env.clipboard.writeText(pick.label)
}

function activate(ctx) {
  ctx.subscriptions.push(startVSCodeBridge(vscode, ctx.extension.packageJSON.version))
  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0)
  status.command = 'levelforge.api'
  ctx.subscriptions.push(
    status,
    vscode.commands.registerCommand('levelforge.newScript', newScript),
    vscode.commands.registerCommand('levelforge.prepare', () => prepare(false)),
    vscode.commands.registerCommand('levelforge.api', showApi),
    vscode.workspace.onDidChangeWorkspaceFolders(refreshStatus),
    // La relación script/nodo se genera al guardar o abrir. TS debe releer el tipo del propietario.
    (() => {
      const watcher = vscode.workspace.createFileSystemWatcher('**/.levelforge/script-owners.json')
      const reload = () => vscode.commands.executeCommand('typescript.reloadProjects').then(undefined, () => {})
      ctx.subscriptions.push(watcher.onDidCreate(reload), watcher.onDidChange(reload), watcher.onDidDelete(reload))
      return watcher
    })(),
    vscode.window.onDidChangeActiveTextEditor(refreshStatus),
  )
  const timer = setInterval(refreshStatus, 5000)
  ctx.subscriptions.push({ dispose: () => clearInterval(timer) })
  refreshStatus()
  prepare(true).catch(() => {}) // jsconfig.json y api.d.ts si faltan (Century los reescribe al guardar)
}
function deactivate() {}
module.exports = { activate, deactivate }
