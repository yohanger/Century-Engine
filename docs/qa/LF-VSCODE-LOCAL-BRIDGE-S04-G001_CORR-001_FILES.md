# Inventario S04 CORR-001

Base exacta: LevelForge_VSCODE_LOCAL_BRIDGE_S04_G001_SOURCE_BASELINE.zip (2.093 archivos entregados). S04 sigue abierto: QA real Flatpak FAIL.

SOURCE_BASELINE: 2103 archivos; CHANGE: 14 archivos. Nuevos: 10; modificados: 4; eliminados: 0. Sin cambios inesperados. Producto, VSIX 0.1.4, dependencias y lockfile raíz idénticos a S04.

Solo cambia diagnóstico/QA, documentación y ledger. No se presenta como solución de la conexión. Se excluyen dependencias instaladas, builds, release, cachés y temporales. No se incluye SHA separado ni .sh.

## Nuevos

- `docs/qa/LF-VSCODE-LOCAL-BRIDGE-S04-G001_CORR-001_FILES.md`
- `docs/qa/LF-VSCODE-LOCAL-BRIDGE-S04-G001_CORR-001_QA.md`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001-CORR-001/README.md`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001-CORR-001/docs-check.log`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001-CORR-001/flatpak-real.log`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001-CORR-001/ledger-integrity.json`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001-CORR-001/node-diagnostics-final.log`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001-CORR-001/node-final.log`
- `docs/qa/evidence/LF-VSCODE-LOCAL-BRIDGE-S04-G001-CORR-001/user-qa-excerpt.log`
- `scripts/test-vscode-local-bridge-diagnostics-s04-g001.mjs`

## Modificados

- `docs/qa/LF-VSCODE-LOCAL-BRIDGE-S04-G001_QA.md`
- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `scripts/fixtures/vscode-extension-s03/tests.cjs`
- `scripts/test-vscode-extension-real-s03-g001.mjs`

## Aplicación

CHANGE: reemplazar solo estas rutas sobre copia exacta de S04, tras comparar cualquier cambio local; no eliminar archivos ni tocar proyectos, Assets o perfiles habituales. SOURCE_BASELINE: extraer completo en carpeta nueva con package.json en la raíz. No aplicar ambos ZIP uno sobre otro. Conservar S04 y el diagnóstico hasta resolver la incidencia. Instrucciones y comando mínimo en `docs/qa/LF-VSCODE-LOCAL-BRIDGE-S04-G001_CORR-001_QA.md`.
