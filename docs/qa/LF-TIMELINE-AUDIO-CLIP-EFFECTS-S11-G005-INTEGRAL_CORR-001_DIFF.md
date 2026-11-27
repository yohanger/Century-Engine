# DIFF — S11-G005 CORR-001

**BASE:** `LF_TIMELINE_AUDIO_CLIP_EFFECTS_S11_G005_INTEGRAL_SOURCE_BASELINE.zip` (2422 entradas). Autorización literal CORR-001 recibida 2026-11-07.

## Modificación puntual
- `scripts/fixtures/editor/timeline-audio-clip-effects-s11-g005.html`: reemplaza la lectura inválida `.gain.connections` por observación temporal de llamadas a `AudioNode.prototype.connect` y comparación de identidades de ambas voces con `engine.nodes.get('mix-g004').input`. El método original se invoca y se restaura en `finally`. Una comprobación adicional valida la restauración.

## Nuevos medios documentales y QA
- `scripts/test-timeline-audio-clip-effects-s11-g005-corr001.mjs`: tres tests Node de protección de contrato de fixture.
- QA y evidencia de Node/entorno/FAIL del usuario en `docs/qa/`.
- `docs/qa/LevelForge_DB_Ledger.xlsx`: seis hojas sincronizadas; G005 sigue PENDIENTE y CORR-001 IMPLEMENTADO/NO CERRADO.

**No modificados:** `src/`, `AudioEngine`, Inspector, Mixer, Preview, Player, `scripts/qa-electron-webgl.cjs` ni el runner ESM. No se introducen FX nuevos, buses, envolventes, automatización o reestructuración. Ningún archivo del SOURCE_BASELINE base se elimina.
