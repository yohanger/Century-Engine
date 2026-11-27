// Extiende el servidor TypeScript de VS Code sin modificar los scripts ejecutados por Century.
// Proyecta los tipos de propietario y directivas de Inspector sin modificar el archivo original.
'use strict'
const fs = require('fs')
const path = require('path')
const { analyzeScriptEditables } = require('./script-editables.cjs')
const cache = new Map()

function scriptContext(root, filename) {
  if (typeof filename !== 'string' || !filename.endsWith('.js')) return null
  const relative = path.relative(root, filename).split(path.sep).join('/')
  if (!relative.startsWith('Assets/') || relative.includes('/../') || relative.startsWith('../')) return null
  try {
    const metadata = path.join(root, '.levelforge', 'script-owners.json')
    const stat = fs.statSync(metadata)
    let saved = cache.get(metadata)
    if (!saved || saved.mtime !== stat.mtimeMs || saved.size !== stat.size) {
      saved = { mtime: stat.mtimeMs, size: stat.size,
        data: JSON.parse(fs.readFileSync(metadata, 'utf8')) }
      cache.set(metadata, saved)
    }
    if (saved.data?.version !== 1) return null
    const owner = saved.data.owners?.[relative] || null
    return { owner, nodeScript: owner === 'characterbody3d' || saved.data.nodeScripts?.includes(relative) === true }
  } catch { cache.delete(path.join(root, '.levelforge', 'script-owners.json')); return null } // tipo global genérico
}

function ownerSuffix(root, filename) {
  // Se añade al final para preservar las posiciones de los símbolos originales.
  return scriptContext(root, filename)?.owner === 'characterbody3d'
    ? '\n/** @type {LF.CharacterBody3DNodeScriptHandle} */\nvar node;\n' : ''
}
function init({ typescript }) {
  return {
    create(info) {
      const host = info.languageServiceHost
      const original = host.getScriptSnapshot.bind(host)
      const originalVersion = host.getScriptVersion?.bind(host)
      const root = path.resolve(info.project.getCurrentDirectory())
      host.getScriptSnapshot = file => {
        const snapshot = original(file)
        if (!snapshot) return snapshot
        const context = scriptContext(root, file)
        if (!context?.nodeScript) return snapshot
        const code = snapshot.getText(0, snapshot.getLength())
        const parsed = analyzeScriptEditables(code)
        const suffix = /\b(?:let|const|var)\s+node\b/.test(code) ? '' : ownerSuffix(root, file)
        return typescript.ScriptSnapshot.fromString(parsed.editorSource + suffix)
      }
      if (originalVersion) host.getScriptVersion = file => {
        const context = scriptContext(root, file)
        return originalVersion(file) + ':' + (context?.owner || 'generic') + ':' + !!context?.nodeScript
      }
      const service = info.languageService
      const diagnostics = service.getSyntacticDiagnostics.bind(service)
      service.getSyntacticDiagnostics = file => {
        const base = diagnostics(file)
        if (!scriptContext(root, file)?.nodeScript) return base
        const snapshot = original(file)
        if (!snapshot) return base
        const text = snapshot.getText(0, snapshot.getLength()), lines = text.split('\n')
        const source = service.getProgram()?.getSourceFile(file)
        return [...base, ...analyzeScriptEditables(text).diagnostics.map(issue => ({
          file: source, start: lines.slice(0, issue.line - 1).reduce((n, line) => n + line.length + 1, 0),
          length: (lines[issue.line - 1] || '').length, messageText: issue.message,
          category: typescript.DiagnosticCategory.Error, code: 98001, source: 'Century',
        }))]
      }
      return service
    },
  }
}
module.exports = init
module.exports.ownerSuffix = ownerSuffix
