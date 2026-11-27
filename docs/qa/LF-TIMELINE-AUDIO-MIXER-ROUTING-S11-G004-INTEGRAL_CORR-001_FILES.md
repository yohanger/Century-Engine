# Inventario comparado · G004 CORR-001

**SOURCE_BASELINE de origen:** `LF_TIMELINE_AUDIO_MIXER_ROUTING_S11_G004_INTEGRAL_SOURCE_BASELINE.zip` (G004 implementado, pendiente QA; no aprobado).

**Modificados:**
- `scripts/fixtures/editor/timeline-audio-mixer-routing-s11-g004.html`: JSON de resultado usa `pass:true/false` para coincidir con el runner; conserva las 32 verificaciones existentes.
- `docs/qa/LevelForge_DB_Ledger.xlsx`: seis hojas actualizadas. Se registra el FAIL Electron reportado por usuario, nueva evidencia Node, autorización y estado PENDIENTE de CORR-001. G003 CORR-002 APROBADO y registros históricos preservados.

**Nuevos:**
- `scripts/test-timeline-audio-mixer-routing-s11-g004-corr001.mjs`: 3 pruebas Node del contrato fixture/runner.
- `docs/qa/LF-TIMELINE-AUDIO-MIXER-ROUTING-S11-G004-INTEGRAL_CORR-001_QA.md`.
- `docs/qa/LF-TIMELINE-AUDIO-MIXER-ROUTING-S11-G004-INTEGRAL_CORR-001_DIFF.md`.
- `docs/qa/LF-TIMELINE-AUDIO-MIXER-ROUTING-S11-G004-INTEGRAL_CORR-001_FILES.md` (este documento).
- `docs/qa/evidence/LF_S11_G004_LOCAL_ELECTRON_FAIL_REPORTED.md` (resumen fiel del resultado local del usuario; no simula ejecución).
- `docs/qa/evidence/LF_S11_G004_CORR001_NODE.log`.
- `docs/qa/evidence/LF_S11_G004_CORR001_ELECTRON_ENV_BLOCKED.log`.
- `docs/qa/evidence/LF_S11_G004_CORR001_BUILD_ENV_BLOCKED.log`.

**Eliminados:** ninguno. **Cambios inesperados:** ninguno identificados respecto al ZIP de origen al comparar contenido de archivos.

**QA generación CORR-001:** 25 PASS Node focal, 80 PASS/6 SKIP/0 FAIL regresión. Electron y build no verificados por Vite ausente en generación; usuario debe completar QA local. No modificar ni ejecutar sistemas productivos adicionales hasta aprobación.

**Empaque:** CHANGE incluye exclusivamente estos 10 archivos nuevos/modificados; SOURCE_BASELINE conserva todos los archivos de G004 y agrega los nuevos, sin `node_modules`, builds, cachés ni temporales. No hay SHA separado ni verificador `.sh`.
