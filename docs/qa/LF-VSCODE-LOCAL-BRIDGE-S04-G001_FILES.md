# Inventario S04

Comparación contra `LevelForge_TIMELINE_LIBRARY_ASSETS_S06_G001_CORR_001_SOURCE_BASELINE.zip` (2.064 archivos), aprobado por el usuario.

SOURCE_BASELINE: 2093 archivos. CHANGE: 45 archivos. Nuevos: 30; modificados: 15; eliminados: 1. Archivos previos sin cambios: 2048.

No se encontraron cambios inesperados. Runtime, física/Jolt, Timeline, Cinematics, sincronizador y dependencias/lockfile raíz permanecen idénticos a la base. El estado de apertura VS Code del editor sí está modificado según el contrato.

Se excluyen node_modules, dist, dist-player, release, build (iconos generados para empaquetar), cachés y temporales. El paquete Linux solo se utilizó para verificar inclusión; no se entrega un instalador en este Gate. La evidencia y el ledger afectados sí están incluidos.

## Nuevos

- `docs/architecture/LF-VSCODE-LOCAL-BRIDGE-S04-G001_CONTRACT.md`
- `docs/qa/LF-TIMELINE-LIBRARY-ASSETS-S06-G001_CORR-001_CLOSE.md`
- `docs/qa/LF-VSCODE-LOCAL-BRIDGE-S04-G001_FILES.md`
- `docs/qa/LF-VSCODE-LOCAL-BRIDGE-S04-G001_QA.md`
- `docs/qa/evidence/LF-TIMELINE-LIBRARY-ASSETS-S06-G001-CORR-001/user-qa-approval.log`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001/README.md`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001/baseline-cli.json`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001/bridge-benchmark.json`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001/build-editor.log`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001/build-player.log`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001/docs-check.log`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001/electron.log`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001/ledger-integrity.json`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001/node-bridge.log`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001/node-final.log`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001/node-gameplay-regression.log`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001/node-vscode-regression.log`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001/package-content.json`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001/package-linux.log`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001/vscode-flatpak.log`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001/vscode-real.log`
- `electron/vscode-bridge.cjs`
- `scripts/benchmark-vscode-local-bridge-s04-g001.mjs`
- `scripts/fixtures/editor/vscode-local-bridge-s04-g001.html`
- `scripts/test-vscode-local-bridge-real-s04-g001.mjs`
- `scripts/test-vscode-local-bridge-s04-g001-electron.mjs`
- `scripts/test-vscode-local-bridge-s04-g001.mjs`
- `scripts/test-vscode-local-bridge-state-s04-g001.mjs`
- `vendor/vscode-extension/levelforge-0.1.4.vsix`
- `vscode-extension/lib/bridge.js`

## Modificados

- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `docs/web-src/scripts.md`
- `electron/main.cjs`
- `electron/preload.cjs`
- `public/docs/content.js`
- `scripts/fixtures/editor/vscode-extension-integration-s03-g001.html`
- `scripts/fixtures/vscode-extension-s03/tests.cjs`
- `scripts/prepare-vscode-extension.mjs`
- `scripts/test-vscode-extension-integration-s03-g001.mjs`
- `scripts/test-vscode-extension-real-s03-g001.mjs`
- `src/core/state/vscode.js`
- `vendor/vscode-extension/manifest.json`
- `vscode-extension/README.md`
- `vscode-extension/extension.js`
- `vscode-extension/package.json`

## Eliminados

- `vendor/vscode-extension/levelforge-0.1.3.vsix`: sustituido por 0.1.4. Si se aplica CHANGE sobre una copia de la base exacta, retirar solo este archivo. SOURCE_BASELINE ya refleja su eliminación.

Para instalar, extraer SOURCE_BASELINE en una carpeta nueva con package.json en su raíz. CHANGE es el delta para revisión/aplicación controlada; no extraer ambos encima de proyectos o cambios locales. Instrucciones y comandos en `docs/qa/LF-VSCODE-LOCAL-BRIDGE-S04-G001_QA.md`. Conservar la base anterior y los proyectos del usuario hasta aprobar S04.
