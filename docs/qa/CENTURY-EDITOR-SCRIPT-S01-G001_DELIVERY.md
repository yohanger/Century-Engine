# Entrega de G001 — Script editables

- Parent: `source_baseline(8).zip`, sin árbol Git acreditado. Archivo original conservado, sin operaciones Git.
- CHANGE: solo archivos añadidos o diferentes frente al parent; incluye contrato, implementación, QA y ledger acumulativo de seis hojas. Ningún archivo histórico fue eliminado.
- SOURCE_BASELINE: árbol acumulativo completo con el cambio aplicado. Se excluyen dependencias instaladas y salidas generadas: `node_modules`, distribuciones generadas, cachés y directorios de build/release. La distribución vendorizada `vendor/century-fluids/dist` se conserva por ser recurso preexistente del proyecto.
- Test del Gate: 19/19 Node PASS. Regresión histórica: G001 11/21, G002 18/20, G003 14/20, idénticos al baseline. Build `vite` no disponible; Electron y Player NO VERIFICADOS.
- Estado: implementado en fuentes, QA local PENDIENTE, aprobación PENDIENTE, NO CERRADO.
