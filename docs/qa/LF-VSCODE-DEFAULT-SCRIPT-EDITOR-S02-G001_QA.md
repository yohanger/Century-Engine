# LF-VSCODE-DEFAULT-SCRIPT-EDITOR-S02-G001

## Alcance

Base aprobada `LevelForge_VSCODE_PROJECT_WORKSPACE_S01_G001_CORR-001_SOURCE_BASELINE.zip`.

Los recursos JavaScript abren en VS Code desde Assets, Inspector, árbol y diálogo de Signals. La ventana interna deja de montarse en la aplicación. Se conserva el componente para las pruebas históricas y el ID de acoplamiento para leer diseños guardados. Si falta la carpeta o falla VS Code, el puente existente muestra el motivo. Los editores especializados y el código del comando de evento conservan sus rutas.

Assets expone **Ejecución → Global / Nodo** mediante el setter original. Signals abre el script receptor elegido. Cuando la sincronización está activa, se conserva el bloqueo de generación automática para proteger el archivo externo. El selector vuelve a detectar métodos publicados después de guardar el archivo en VS Code. El modo y las conexiones siguen formando parte del proyecto LevelForge.

La extensión 0.1.2 consulta las declaraciones existentes para la referencia `node.*` y añade los snippets `lf-node-signal`, `lf-node-emit` y `lf-node-expose`. Las guías de scripts, multiscript, Signals y el flujo de edición se actualizan en el portal interno. Se regeneró el portal con el generador del proyecto a partir de las fuentes vigentes.

## QA local

Extrae SOURCE_BASELINE en una carpeta nueva. CHANGE corresponde únicamente a una copia limpia del SOURCE_BASELINE de CORR-001. Conserva ese ZIP, las preferencias y los proyectos locales. Actualiza la extensión siguiendo `vscode-extension/README.md`. Para Flathub, la carpeta de la versión 0.1.2 es `~/.var/app/com.visualstudio.code/data/vscode/extensions/levelforge.levelforge-0.1.2`.

```bash
npm ci
node --test scripts/test-vscode-default-script-editor-s02-g001.mjs scripts/test-vscode-project-workspace-s01-g001.mjs
node --test scripts/test-vscode-default-script-editor-s02-g001-electron.mjs
npm run docs:check
npm run build
npm run electron
```

Espera 13 PASS focales, 19 comprobaciones en la prueba Electron y 12 PASS del portal. La prueba Electron usa componentes Vue reales, IndexedDB y serialización de proyecto, con puente externo simulado. La validación manual se realiza con LevelForge y VS Code reales.

1. Abre un proyecto guardado. Haz doble clic en un `.js` desde Assets y confirma la carpeta y el archivo en VS Code. Repite desde el Inspector y el indicador del árbol de un nodo con un solo script.
2. Usa **Ejecución** en el menú contextual para comprobar que puede cambiarse el modo de un recurso de prueba. En un nodo con varios scripts, abre uno desde su fila en el Inspector.
3. Abre **Signals**, elige una señal y un receptor. Selecciona su script y pulsa **Editar receptor en VS Code**. Publica un método con `node.expose`, guarda y elige el método en LevelForge. Guarda el proyecto, reábrelo y ejecuta Play. Comprueba que se invoca el callback y aparecen sus argumentos esperados.
4. Verifica que **Ayuda → Documentación** abre las guías actualizadas. En VS Code, busca `node.expose` en **LevelForge: Ver referencia de la API** y verifica los snippets de Signals en un `.js`.
5. Prueba la apertura de un recurso en un proyecto aún sin carpeta. Comprueba que aparece el aviso y que la ventana interna sigue oculta.

Si algo falla, indica la acción, la raíz y el script esperado, y el mensaje visible.

## Resultados de entrega

- Node: 645 PASS de 647. NE6-16 y NE6-18 del Inspector fallan también en el SOURCE_BASELINE de CORR-001.
- Electron embebido: S02 PASS (19 comprobaciones) y Signals Callback S06 PASS (72 comprobaciones, WebGL2 y Jolt). Signals S07 falla al verificar ausencia de errores durante la navegación, igual que al repetirlo con el baseline en el mismo entorno.
- Portal interno: 190 páginas generadas y 12 PASS de QA. Editor y Player compilados.
- Apertura con VS Code real y aceptación visual de S02 pendientes de QA local.

## Inventario frente a CORR-001

**Modificados (28)**

- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `docs/web-src/editor.md`
- `docs/web-src/inspector.md`
- `docs/web-src/scene-tree.md`
- `docs/web-src/scripts-nodo.md`
- `docs/web-src/scripts.md`
- `docs/web-src/tutorial-script.md`
- `public/docs/content.js`
- `scripts/fixtures/nodes/node-signals-godot-callback-s06-g002-integral.html`
- `scripts/test-editor-docking-s03-g001-integral.mjs`
- `scripts/test-node-editor-s06-g001.mjs`
- `scripts/test-node-multiscript-s01-g002.mjs`
- `scripts/test-node-script-s05-corr001.mjs`
- `scripts/test-node-script-s05-g001.mjs`
- `scripts/test-node-signals-godot-callback-s06-g002-integral.mjs`
- `scripts/test-script-intellisense-jsdoc-s06-corr001.mjs`
- `scripts/test-vscode-project-workspace-s01-g001.mjs`
- `src/App.vue`
- `src/components/Inspector.vue`
- `src/components/ProjectPanel.vue`
- `src/components/SceneTree.vue`
- `src/components/SignalConnectionsPanel.vue`
- `src/core/editor/docking.js`
- `src/core/state/vscode.js`
- `vscode-extension/README.md`
- `vscode-extension/extension.js`
- `vscode-extension/package.json`
- `vscode-extension/snippets/levelforge.json`

**Nuevos (11)**

- `docs/qa/LF-VSCODE-DEFAULT-SCRIPT-EDITOR-S02-G001_QA.md`
- `docs/qa/LF-VSCODE-PROJECT-WORKSPACE-S01-G001-CORR-001_CLOSE.md`
- `docs/qa/evidence/LF-VSCODE-DEFAULT-SCRIPT-EDITOR-S02-G001/build-editor-player.log`
- `docs/qa/evidence/LF-VSCODE-DEFAULT-SCRIPT-EDITOR-S02-G001/docs-check.log`
- `docs/qa/evidence/LF-VSCODE-DEFAULT-SCRIPT-EDITOR-S02-G001/electron-baseline-signals-s07.log`
- `docs/qa/evidence/LF-VSCODE-DEFAULT-SCRIPT-EDITOR-S02-G001/electron-regression.log`
- `docs/qa/evidence/LF-VSCODE-DEFAULT-SCRIPT-EDITOR-S02-G001/node-baseline-inspector.log`
- `docs/qa/evidence/LF-VSCODE-DEFAULT-SCRIPT-EDITOR-S02-G001/node-regression.log`
- `scripts/fixtures/editor/vscode-default-script-editor-s02-g001.html`
- `scripts/test-vscode-default-script-editor-s02-g001-electron.mjs`
- `scripts/test-vscode-default-script-editor-s02-g001.mjs`

**Eliminados:** 0. **Inesperados:** 0.
