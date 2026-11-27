# LevelForge — S12-G002 CORR-001 · QA y estado

## Fuente y autoridad

- Gate autorizado literalmente: `Listo. LF-TIMELINE-AUDIO-TRIM-DURATION-S12-G002-INTEGRAL_CORR-001 autoriza comenzar`.
- SOURCE_BASELINE: `LF_TIMELINE_AUDIO_TRIM_DURATION_S12_G002_INTEGRAL_SOURCE_BASELINE.zip`.
- Alcance exclusivo: restaurar importación `audioWaveformPath`, observador de visibilidad y mapa `observed` perdidos en `TimelineAudioSource.vue`. No modificar Player, AudioEngine, Mixer ni el runner.
- Evidencia del usuario: 18 pruebas Node PASS, Electron FAIL antes de ejecutar comprobaciones internas debido a `ReferenceError`.

## Observado, inferencia y causa raíz

- **OBSERVADO:** `waveform = computed(() => audioWaveformPath(...))` utiliza un identificador que carece de importación. `onMounted()` y `onBeforeUnmount()` usan `observer` y `observed` no declarados.
- **CAUSA RAÍZ DEMOSTRADA:** durante extracción del análisis PCM a `audio-source-analysis.js` desaparecieron dependencias de visualización que no pertenecían a ese analizador.
- **INFERENCIA pendiente de Electron:** restaurar estas dependencias permite que la fixture avance hasta sus interacciones de recorte; aún puede descubrir otra incidencia no cubierta por pruebas Node.

## Cambios

- `src/components/TimelineAudioSource.vue`: importa `audioWaveformPath` del módulo existente y declara observador/Map compartidos a nivel módulo. Observa únicamente ondas de viewport, y desconecta el observador al desmontarse la última. No crea otro decodificador ni caché.
- `scripts/test-timeline-audio-trim-duration-s12-g002-corr001.mjs`: 4 regresiones Node focales (símbolos de render, alcance compartido, montaje/desmontaje, cola PCM y emisión de duración).

## Resultados registrados

| Dimensión | Estado | Evidencia |
|---|---|---|
| Implementación | IMPLEMENTADO en fuentes | DIFF + CHANGE |
| Node focal G002 + CORR-001 | 22 PASS / 0 FAIL | `docs/qa/evidence/LF_S12_G002_CORR001_NODE_FOCAL.log` |
| Regresión compatible seleccionada | 100 PASS / 0 FAIL / 0 SKIP | `docs/qa/evidence/LF_S12_G002_CORR001_NODE_REGRESSION.log` |
| Electron anterior al cambio (usuario) | FAIL, cero comprobaciones por `ReferenceError` | `docs/qa/evidence/LF_S12_G002_CORR001_ELECTRON_USER_FAIL.log` |
| Electron posterior al cambio en generación | NO VERIFICADO, falta Vite | `docs/qa/evidence/LF_S12_G002_CORR001_ELECTRON_ENV.log` |
| Build Editor y Player posterior | NO VERIFICADO, `vite: not found` | `docs/qa/evidence/LF_S12_G002_CORR001_BUILD_ENV.log` |
| QA visual/auditivo usuario | PENDIENTE | Solicitar tras aplicar CHANGE |
| Gate | NO APROBADO / NO CERRADO | Ledger actualizado |

La prueba Electron de generación no entró al navegador: la ausencia de Vite es una limitación de infraestructura. No se confunde con el `ReferenceError` observado por el usuario. Las pruebas Node incluyen verificaciones de estructura y funciones puras; no sustituyen el montaje real del `.vue`.

## QA local obligatorio

Desde la raíz existente del proyecto (con `package.json`), respaldar y comparar antes de reemplazar:

```bash
node --test scripts/test-timeline-audio-trim-duration-s12-g002.mjs scripts/test-timeline-audio-trim-duration-s12-g002-corr001.mjs
node --test scripts/test-timeline-audio-trim-duration-s12-g002-electron.mjs
npm run build
npm run electron
```

Esperado: 22 pruebas Node PASS; 1 suite Electron PASS con 20 comprobaciones internas; build Editor y Player completo.

QA visual: añadir WAV, observar onda PCM (sin `ReferenceError`), confirmar duración fuente, recorte del borde derecho, Home, Snap, bloqueo, Undo/Redo, guardado/reapertura, Preview y reproducción Player. No repetir el QA aprobado de S12-G001 si no hay incidencia concreta.

**Estado de cierre:** PENDIENTE. No modificar estado a APROBADO sin evidencia del usuario. Los errores Electron de G002 deben permanecer registrados.
