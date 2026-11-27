# Scripting, API y herramientas de lenguaje

La API pública de autoría tiene una única declaración canónica: `src/core/events/game-api.d.ts`. El intérprete `src/engine/runtime/events/interpreter.js` construye el objeto público; `scene/node-scripts.js` y `script-editables.js` gestionan ciclo de vida y metadatos. `src/core/events/apiDocs.js` y `apiParse.js` proyectan declaraciones.

<pre>game-api.d.ts → API / JSDoc ──┬─ Code (types-dts, types, jsintel)
                              ├─ extensión VS Code / servicio TS
                              └─ gen-docs → referencia pública</pre>

Code utiliza `src/core/editor/analysis.js`, `jsintel.js`, `types-jsdoc.js`, `names.js` y `ScriptEditor.vue`. VS Code usa `src/core/state/vscode.js`, `src/core/vscode/`, `electron/vscode-bridge.cjs`, `vscode-extension/` y `scripts/prepare-vscode-extension.mjs`. La extensión conserva sus propias copias distribuidas, generadas desde la autoridad declarada. La inferencia contextual por propietario no convierte todas las capacidades internas del nodo en API pública. Las directivas `@editable` y `@header` pertenecen a autoría, no a JavaScript nativo.

Estado de entrada: fuentes de extensión 0.1.13; VSIX histórico 0.1.12 pendiente de regeneración. JSDoc parcial (157 miembros sin comentario propio en última auditoría); `game.water`, Player e Input pendientes de resolución contractual. No declarar completa la cobertura del intérprete. Consultar [API JavaScript](#/api-intro), [propiedades editables](#/propiedades-editables) y los contratos de arquitectura.

**Impacto:** cualquier nueva API requiere contrastar implementación, declaración, ejemplos, ambos editores y documentación. Pruebas `documentation-api`, `documentation-api-electron` y servicio de lenguaje real. No confundir compatibilidad de firmas con ejecución.


## Ajustes gráficos PSX
`GraphicsSettings` de `src/core/events/game-api.d.ts` declara las cuatro propiedades públicas PSX; `GraphicsApi.set` acepta un parche parcial sin eliminar el índice abierto de otros ajustes. `play-graphics.js` excluye `psxContinuous` de parches y lecturas públicas y preserva su valor editorial al cambiar presets. Code y la extensión consumen las declaraciones sincronizadas existentes. Servicio TypeScript y tipos internos probados de forma aislada; instalación VSIX pendiente.
