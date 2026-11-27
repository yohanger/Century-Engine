# Inventario S04 CORR-002

Base exacta: LevelForge_VSCODE_LOCAL_BRIDGE_S04_G001_CORR_001_SOURCE_BASELINE.zip (2.103 archivos). Corrección dentro del Gate S04 abierto; QA local corregido pendiente.

SOURCE_BASELINE: 2118 archivos; CHANGE: 25 archivos. Nuevos: 15; modificados: 10; eliminados: 0. Sin cambios inesperados.

Renderer, runtime, Timeline, Cinematics, sincronizador, extensión, VSIX 0.1.4 y dependencias/lockfile raíz idénticos a CORR-001. Cambios de producto limitados al servidor, lanzador e integración main; runner y regresiones afectados incluidos. Se preservan correcciones previas.

Excluidos node_modules, dist, dist-player, release, build, cachés y temporales. No se incluye instalador, SHA separado ni .sh. La inspección del paquete Linux queda documentada como evidencia.

## Nuevos

- `docs/qa/LF-VSCODE-LOCAL-BRIDGE-S04-G001_CORR-002_FILES.md`
- `docs/qa/LF-VSCODE-LOCAL-BRIDGE-S04-G001_CORR-002_QA.md`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001-CORR-002/README.md`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001-CORR-002/docs-check.log`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001-CORR-002/flatpak-real.log`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001-CORR-002/ledger-integrity.json`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001-CORR-002/node-bridge.log`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001-CORR-002/node-final.log`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001-CORR-002/node-runner.log`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001-CORR-002/package-content.json`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001-CORR-002/package-linux.log`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001-CORR-002/reproduction-after.log`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001-CORR-002/reproduction-before.log`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001-CORR-002/syntax.json`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001-CORR-002/user-diagnostic-excerpt.log`

## Modificados

- `docs/architecture/LF-VSCODE-LOCAL-BRIDGE-S04-G001_CONTRACT.md`
- `docs/qa/LF-VSCODE-LOCAL-BRIDGE-S04-G001_CORR-001_QA.md`
- `docs/qa/LF-VSCODE-LOCAL-BRIDGE-S04-G001_QA.md`
- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `electron/main.cjs`
- `electron/vscode-bridge.cjs`
- `electron/vscode.cjs`
- `scripts/test-vscode-extension-real-s03-g001.mjs`
- `scripts/test-vscode-local-bridge-diagnostics-s04-g001.mjs`
- `scripts/test-vscode-local-bridge-s04-g001.mjs`

## Aplicación

CHANGE: reemplazar solo estas rutas sobre una copia exacta de CORR-001, comparando antes cambios locales. No eliminar archivos ni tocar proyectos, Assets, perfiles de VS Code o dependencias instaladas. SOURCE_BASELINE: extraer completo en carpeta nueva con package.json en la raíz; no aplicar ambos ZIP uno sobre otro. Conservar la base anterior y el diagnóstico recibido hasta aprobar S04. Comandos y evidencia esperada en `docs/qa/LF-VSCODE-LOCAL-BRIDGE-S04-G001_CORR-002_QA.md`.
