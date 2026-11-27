# DIFF · S11-G004 CORR-001

**Origen:** `LF_TIMELINE_AUDIO_MIXER_ROUTING_S11_G004_INTEGRAL_SOURCE_BASELINE.zip`.
**Alcance:** defecto de contrato de resultado de la fixture de Electron G004 y registro de evidencia, sin intervenir sistemas productivos.

## Código de prueba corregido

- `scripts/fixtures/editor/timeline-audio-mixer-routing-s11-g004.html`: `{ok:true,checks,gl}` → `{pass:true,checks,gl}` y `{ok:false,error,checks}` → `{pass:false,error,checks}`. `dataset.pass` no cambia. Runner oficial `qa-electron-webgl.cjs` y `qa-electron-webgl-runner.mjs` **sin modificaciones**.
- `scripts/test-timeline-audio-mixer-routing-s11-g004-corr001.mjs`: nueva comprobación automática de ambos estados y contrato esperado por runner. **3 PASS**.

## Documentación y ledger

- Nuevos documentos QA, DIFF, inventario, evidencia de falla local reportada, log de pruebas y bloqueos de infraestructura.
- `docs/qa/LevelForge_DB_Ledger.xlsx`: actualizar las seis hojas con fila CORR-001, conservar G004 pendiente y reflejar las nuevas evidencias. Conservar G003 CORR-002 aprobado y los rechazos/FAIL históricos.

## Fuera de alcance / sin modificaciones

`src/`, AudioEngine, Mixer, Timeline, Preview, Player, persistencia, Assets, datos, exportación, FilmMaker, runner Electron compartido, efectos y automatización. Sin migraciones, refactors ni archivos auxiliares de runtime.

**QA:** 25/25 focal; 80 PASS/6 SKIP/0 FAIL de 86 regresión. Electron y compilación NO VERIFICADOS tras la corrección por ausencia de dependencias Vite en el entorno de generación. G004 no cerrado.
