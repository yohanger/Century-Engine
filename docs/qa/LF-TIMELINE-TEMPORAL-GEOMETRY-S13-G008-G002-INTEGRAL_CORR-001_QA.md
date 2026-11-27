# QA — Geometría temporal G008-G002 CORR-001

## Estado

**IMPLEMENTADO · NODE PASS · ELECTRON/BUILD NO VERIFICADOS · QA LOCAL PENDIENTE · NO CERRADO.**

| Verificación | Resultado | Evidencia |
|---|---|---|
| Node focal GEO-01..24 + CORR001-01..08 | 32 PASS, 0 FAIL | `docs/qa/evidence/LF_S13_G008_G002_CORR001_NODE_FOCAL.log` |
| 51 scripts Node del baseline G008-G002 | 601 PASS, 18 SKIP, 10 FAIL históricos | `docs/qa/evidence/LF_S13_G008_G002_CORR001_BASELINE_NODE_EXPANDED.log` |
| Los mismos 51 scripts en CORR-001 | 601 PASS, 18 SKIP, los mismos 10 FAIL | `docs/qa/evidence/LF_S13_G008_G002_CORR001_NODE_EXPANDED.log` |
| Electron embebido, 43 verificaciones | NO VERIFICADO por ausencia de Vite en preparación | `docs/qa/evidence/LF_S13_G008_G002_CORR001_ELECTRON_ENV.log` |
| Build Editor/Player | NO VERIFICADO por ausencia de Vite | `docs/qa/evidence/LF_S13_G008_G002_CORR001_BUILD_ENV.log` |
| QA visual del usuario | PENDIENTE | Evidencia local requerida |

## Comandos locales — raíz del proyecto (package.json)

```bash
node --test scripts/test-timeline-temporal-geometry-s13-g008-g002.mjs scripts/test-timeline-temporal-geometry-s13-g008-g002-corr001.mjs
node --test scripts/test-timeline-temporal-geometry-s13-g008-g002-electron.mjs
node --test scripts/test-timeline-audio-trim-duration-s12-g002-electron.mjs
node --test scripts/test-timeline-zoom-waveform-s12-g003-electron.mjs
npm run build
npm run electron
```

**Esperado:** focal 32/32 PASS; Electron de geometría 1 PASS con 43 checks; audio/zoom regresiones sin fallos nuevos; build Editor+Player sin error. La ausencia de dependencias es NO VERIFICADO, no PASS.

## QA visual

Abrir Timeline con un clip Cámara de 1–3 s y marcador en 3 s. En zoom 70 y 140, con scroll 0 y 220 píxeles, el **centro** de marcador debe coincidir con el extremo derecho de clip y con el tick temporal. Confirmar que el margen de 24px, Snap, cabezal, arrastre y audio no sufren desviaciones; guardar/reabrir no cambia tiempos. Adjuntar salida Electron y capturas si aparece regresión.

## Precaución

Este Gate no cambia producción y no cierra los diez fallos históricos presentes en la batería ampliada. No modificar expectativas para esconderlos.
