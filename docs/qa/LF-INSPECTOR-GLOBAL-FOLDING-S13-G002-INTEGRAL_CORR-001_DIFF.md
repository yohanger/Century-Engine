# Comparación S13-G002 → S13-G002 CORR-001

## Archivo existente modificado

- `scripts/fixtures/editor/inspector-global-folding-s13-g002.html`: registrar Editor y snapshot de terreno antes de montar InspectorDock; inicializar historial real mediante `resetHistory()`; reforzar la comprobación del botón Restablecer con sincronización e historial.
- `docs/qa/LevelForge_DB_Ledger.xlsx`: agregar exclusivamente registros de CORR-001 y fallo original a las seis hojas.

## Archivos nuevos

- `scripts/test-inspector-global-folding-s13-g002-corr001.mjs`: siete pruebas Node de prerrequisitos, mecanismo real, integridad del contrato y colector de resultados.
- Documentos de arquitectura, QA, comparación e inventario; registros focal, regresión, Electron/infraestructura y build/infraestructura.

**Cero archivos de producción modificados o eliminados.** Sin cambio al runner Electron original y sus 23 checks. El inventario final se genera comparando hashes por archivo con el SOURCE_BASELINE del Gate anterior.
