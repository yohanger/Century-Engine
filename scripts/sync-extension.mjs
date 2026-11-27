// Copia a la extensión de VS Code lo que comparte con la aplicación: la API (game-api.d.ts) y el lector del .d.ts.
// Uso: node scripts/sync-extension.mjs         (los tests comprueban que las copias no se han quedado atrás)
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
const r = (p) => new URL('../' + p, import.meta.url)
copyFileSync(r('src/core/events/game-api.d.ts'), r('vscode-extension/media/game-api.d.ts'))
writeFileSync(r('vscode-extension/lib/apiParse.mjs'), readFileSync(r('src/core/events/apiParse.js'), 'utf8'))
// El plugin TypeScript consume la misma gramática de directivas que el runtime.
const editables = readFileSync(r('src/engine/runtime/scene/script-editables.js'), 'utf8')
writeFileSync(r('vscode-extension/lib/node-owner-types/script-editables.cjs'), '// Generado por scripts/sync-extension.mjs desde script-editables.js.\n' + editables.replace(/^export function /gm, 'function ') + '\nmodule.exports = { analyzeScriptEditables }\n')
console.log('✓ extensión actualizada')
