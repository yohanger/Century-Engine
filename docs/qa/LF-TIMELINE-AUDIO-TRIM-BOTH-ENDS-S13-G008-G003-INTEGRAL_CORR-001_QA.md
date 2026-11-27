# QA — G008-G003 CORR-001

## Pruebas ejecutadas en entorno de preparación

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Node focal (G003 + CORR-001) | 31 PASS / 0 FAIL | `docs/qa/evidence/LF_S13_G008_G003_CORR001_NODE_FOCAL.log` |
| Node dirigida compatible | 132 PASS / 0 FAIL | `docs/qa/evidence/LF_S13_G008_G003_CORR001_NODE_COMPATIBLE.log` |
| Node histórica waveform `@vue/compiler-sfc` | NO VERIFICADA; dependencia ausente | La prueba no pudo iniciar, no es resultado del runtime |
| Electron fixture real (46 aserciones) | NO VERIFICADO | `docs/qa/evidence/LF_S13_G008_G003_CORR001_ELECTRON_ENV.log` |
| Build Editor/Player | NO VERIFICADO; `vite: not found` | `docs/qa/evidence/LF_S13_G008_G003_CORR001_BUILD_ENV.log` |
| QA visual/sonoro usuario | PENDIENTE | Sin evidencia aún |

## Comandos en raíz del proyecto

```bash
node --test scripts/test-timeline-audio-trim-both-ends-s13-g008-g003.mjs scripts/test-timeline-audio-trim-both-ends-s13-g008-g003-corr001.mjs
node --test scripts/test-timeline-audio-trim-both-ends-s13-g008-g003-electron.mjs
node --test scripts/test-timeline-audio-waveform-inspector-s11-g003-electron.mjs
node --test scripts/test-timeline-audio-volume-automation-s11-g007-g002-electron.mjs
npm run build
npm run electron
```

## Criterios de aceptación

- Node focal 31/31 PASS.
- Electron 1/1 PASS con **46 comprobaciones**; se mantiene el nombre original de la aserción que falló.
- WAV multiamplitud: intensidad del segundo 2 mayor que la del 1; contraste entre los segundos 3 y 4.
- Tras recortar t=8 a t=9: offset=1, duración=5 y extremo derecho sin movimiento temporal.
- Scroller nativo revela el clip, `audioAnalysis=ready`, ancho de ventana PCM positivo.
- La geometría del `path` coincide con el offset=1 y **no** con offset=0.
- Asas, puntos, fundidos, guardado/reapertura, Preview y Player no presentan regresiones nuevas.
- Build Editor/Player sin errores nuevos; QA visual y sonoro aprobado por usuario.

No declarar APROBADO/CERRADO solo por compilar o por Node PASS.
