# Inventario de entrega · CA-001 pre-LTS

**Gate:** `LF-CAMERA-ORCHESTRATION-S15-G003-CORR-002-PRELTS-CONTRACT-AMEND-G001`  
**SOURCE_BASELINE de comparación:** `LF_CAMERA_ORCHESTRATION_S15_G003_EVENT_CAMERA_CONSUMER_CORR001_SOURCE_BASELINE.zip` · 2.957 archivos.  
**Tipo de entrega:** exclusivamente documental y ledger. **No** incluye código provisional CORR-002.

## Nuevos (4)

1. `docs/architecture/LF-NODE-ACTIVE-VISIBLE-PRELTS-CA-001_AMENDMENT.md` — cláusulas CA-01..06, contradicciones y ratificación pendiente.
2. `docs/architecture/LF-CAMERA-ORCHESTRATION-S15-G003-CORR-002-PRELTS-CONTRACT-AMEND-G001_SCOPE.md` — límite del Gate documental, parada técnica, QA futuro.
3. `docs/qa/LF-CAMERA-ORCHESTRATION-S15-G003-CORR-002-PRELTS-CONTRACT-AMEND-G001_QA.md` — revisión contractual y pruebas no ejecutadas.
4. `docs/qa/LF-CAMERA-ORCHESTRATION-S15-G003-CORR-002-PRELTS-CONTRACT-AMEND-G001_FILES.md` — inventario de entrega.

## Modificados (2)

1. `docs/architecture/LF-CAMERA-ORCHESTRATION-S15-PARENT-CONTRACT-001.md` — sincronización del encabezado de ratificación CORR-001 y advertencia de CA-001 **todavía no ratificado**; CAM-15 no se deroga por adelantado.
2. `docs/qa/LevelForge_DB_Ledger.xlsx` — una entrada adicional en cada una de las seis hojas, preservando valores anteriores. Los registros antiguos mantienen idéntico contenido lógico.

## Eliminados, externos y no autorizados

- Archivos eliminados: **ninguno**.
- Código de producción modificado: **ninguno**.
- Scripts, runners, fixtures, extensión VS Code, paquetes, escenas y recursos modificados: **ninguno**.
- El trabajo provisional de 19 archivos correspondiente a CORR-002 está excluido y sigue NO VERIFICADO. No se incorpora al baseline de este Gate.
- Se conserva el código aprobado de G003 CORR-001 byte a byte; no se introduce migración `visible` → `active`.

## Instalación para el usuario

Descargar **solo CHANGE**. Antes de extraer, comparar los dos archivos modificados, especialmente `docs/qa/LevelForge_DB_Ledger.xlsx`, con cambios locales posteriores. Aplicar CHANGE sobre el proyecto local que ya contiene G003 CORR-001. No extraer SOURCE_BASELINE en la máquina del usuario por rutina; queda como continuidad acumulativa.

## Cierre

La creación de un Amendment no equivale a su ratificación. La aprobación y cierre de este Gate documental son decisión posterior del usuario. CORR-002 y G004 siguen bloqueado/no autorizado respectivamente.
