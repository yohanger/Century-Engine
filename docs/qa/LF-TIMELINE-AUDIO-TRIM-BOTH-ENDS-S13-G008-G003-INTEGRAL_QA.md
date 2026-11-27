# QA de LevelForge · S13-G008-G003 Audio Trim ambos extremos

## Evidencia disponible

| Prueba | Estado | Evidencia |
|---|---|---|
| Unit Node focal | **23 PASS, 0 FAIL** | `docs/qa/evidence/LF_S13_G008_G003_NODE_FOCAL.log` |
| Node dirigida (10 scripts) | **154 PASS, 0 FAIL** | `docs/qa/evidence/LF_S13_G008_G003_NODE_CORE.log` |
| Ampliada Timeline (53 scripts) | **632 PASS, 18 SKIP, 10 FAIL** | `docs/qa/evidence/LF_S13_G008_G003_NODE_EXPANDED.log` |
| Baseline anterior (52 scripts) | **609 PASS, 18 SKIP, mismos 10 FAIL** | `docs/qa/evidence/LF_S13_G008_G003_BASELINE_EXPANDED.log` |
| Sintaxis Node/fixture JS | PASS | `docs/qa/evidence/LF_S13_G008_G003_JS_SYNTAX.log` |
| Electron real | **NO VERIFICADO**: dependencias no instaladas | `docs/qa/evidence/LF_S13_G008_G003_ELECTRON_ENV.log` |
| Build Editor + Player | **NO VERIFICADO**: `vite: not found` | `docs/qa/evidence/LF_S13_G008_G003_BUILD_ENV.log` |
| QA visual/funcional usuario | **PENDIENTE** | Usuario ejecuta desde Electron |

Los SKIP son comprobaciones condicionadas por dependencias. Los 10 FAIL de la batería ampliada son idénticos a la versión anterior y no se alteraron para obtener PASS. La batería focal y dirigida sí pasa completa. No se declara CERRADO.

## Comandos desde la raíz existente

```bash
node --test scripts/test-timeline-audio-trim-both-ends-s13-g008-g003.mjs
node --test scripts/test-timeline-audio-trim-both-ends-s13-g008-g003-electron.mjs
node --test scripts/test-timeline-audio-trim-duration-s12-g002-electron.mjs
node --test scripts/test-timeline-audio-volume-automation-s11-g007-g002-electron.mjs
node --test scripts/test-timeline-zoom-waveform-s12-g003-electron.mjs
npm run build
npm run electron
```

## QA visual/funcional en Editor y Player

1. Cargar un WAV/OGG real, analizar waveform; comprobar asa **izquierda** y **derecha** en el mismo clip.
2. Arrastrar borde izquierdo: aumenta `t` y `offset` según `pitch`, disminuye duración, **no se mueve el extremo derecho**; waveform muestra tramo correcto.
3. Arrastrar borde derecho: disminuye duración manteniendo `t` y `offset`; extender recupera audio previamente ocultado.
4. Repetir con pitch .5, 1 y 2; fuente desde offset > 0; clip que inicia en `t=0`; `duration=0` histórico.
5. Zoom, Snap, scroll horizontal y cabezal quedan alineados; Ctrl no rompe selección ni arrastre habitual.
6. Clic sin arrastrar y cancelación de gesto no guardan cambios; Undo/Redo reconstruye `t`, `offset`, `duration` y puntos.
7. Los recortes que intentan atravesar un punto o reducir el tramo bajo los fundidos se bloquean sin pérdida silenciosa.
8. Probar pista bloqueada y clave Stop: no editar; sin audio PCM analizado, avisar y no persistir duración inventada.
9. Guardar, cerrar y reabrir: mismo segmento, Asset, FX, buses, claves/puntos e Inspector.
10. En Preview **y Player**, comprobar auditivamente que suena el fragmento previsto tras recorte y Seek/Pause/Resume/Stop; compilar no equivale a QA de reproducción.

**Devolver:** logs de Electron (nuevo + S12), npm run build y evaluación visual/sonora. Si falla, indicar primera aserción fallida y el contexto. El usuario aprueba o rechaza antes del cierre.
