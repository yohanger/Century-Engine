# QA documental — Contract Amendment pre-LTS S15-G003 CORR-002

**Gate:** `LF-CAMERA-ORCHESTRATION-S15-G003-CORR-002-PRELTS-CONTRACT-AMEND-G001`  
**Fecha:** 2026-11-09  
**Tipo:** documental y administrativo, sin cambios de producción.

## Evidencia observada

- SOURCE_BASELINE de entrada: G003 CORR-001, 2.957 archivos, ZIP íntegro.
- Documento S00 de arquitectura de nodos exige eliminar rutas antiguas y rechaza expresamente compatibilidad de archivos antiguos.
- Parent Contract S15 vigente mantiene en CAM-15 obligación de no romper «proyecto antiguo» y contiene otras referencias históricas que deben delimitarse.
- Usuario interrumpió CORR-002 y rechazó expresamente migración y verificación histórica; autorizó literalmente el Gate documental posterior.
- Se identificaron 19 archivos de código modificados en trabajo provisional no verificado; no se integran al baseline de este Gate.

## Matriz de verificación documental

| ID | Comprobación | Estado |
|---|---|---|
| CA-001-QA-01 | CA-01..06 distinguen política pre-LTS de preservación de proyecto actual | DOCUMENTADO |
| CA-001-QA-02 | CAM-15 y alcance CORR-002 relacionados identificados sin derogación global | DOCUMENTADO |
| CA-001-QA-03 | Supersesión de propuesta de migración histórica explícita y condicionada a ratificación | DOCUMENTADO |
| CA-001-QA-04 | Tabla `active`/`visible`, jerarquía, cámara, Jolt y Terrain como futura QA | DOCUMENTADO |
| CA-001-QA-05 | Seis hojas del ledger reciben registros de este Gate sin reabrir históricos | VERIFICADO EN COMPARACIÓN DE CONTENIDO Y LEDGER |
| CA-001-QA-06 | Código de producción idéntico al SOURCE_BASELINE de entrada | VERIFICADO EN COMPARACIÓN DE CONTENIDO Y LEDGER |
| CA-001-QA-07 | CHANGE y SOURCE_BASELINE íntegros y comparados | VERIFICADO EN COMPARACIÓN DE CONTENIDO Y LEDGER |

## No ejecutado

Ningún test Node/Electron/Jolt, build Editor, build runtime, VS Code Flatpak ni QA visual se ejecuta para este Gate documental. No se declara PASS de comportamiento ni de rendimiento. **CA-001 no está ratificado**, CORR-002 no está aprobado y G004 no está autorizado. El usuario decidirá ratificación después de revisar el Amendment.

## Verificación de ledger

Importación/exportación mediante `artifact_tool`, seguida de comparación de valores y fórmulas con el Excel de G003 CORR-001: **cero celdas preexistentes alteradas**; se agregó una fila documental por hoja. No se atribuyó QA funcional ni se cerró ningún Gate.
