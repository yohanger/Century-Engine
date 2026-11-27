# S13-G008-G004 CORR-001 · QA y continuidad

## Pruebas reproducidas
- Usuario: `node --test` focal 132 PASS; Electron LIFO 25 PASS; Inspector 40 PASS; Audio Trim 46 PASS. Regresión Electron automatización 35 PASS / 1 FAIL en origen PCM. Fuente: log aportado el 2026-11-09.
- Implementación CORR-001: **155 Node PASS / 0 FAIL**, incluida la regresión histórica que antes exigía el viejo límite geométrico. `docs/qa/evidence/LF_S13_G008_G004_CORR001_NODE_FOCAL.log`.
- Regresión complementaria de Timeline/Mixer: **121 Node PASS / 0 FAIL**. `docs/qa/evidence/LF_S13_G008_G004_CORR001_NODE_REGRESSION.log`.
- Chromium aislado con CSS equivalente del componente: clip exterior 102 px, SVG 105 px, borde 3 px. No constituye ejecución del Editor/Electron. `docs/qa/evidence/LF_S13_G008_G004_CORR001_CSS_CHROMIUM.log`.
- Electron CORR-001 **NO VERIFICADO** en entorno de implementación: falta Vite; log `docs/qa/evidence/LF_S13_G008_G004_CORR001_ELECTRON_ENV.log`.
- Build Editor/Player **NO VERIFICADO**: `vite: not found`; log `docs/qa/evidence/LF_S13_G008_G004_CORR001_BUILD_ENV.log`.

## Comandos desde la raíz con package.json
```bash
node --test scripts/test-timeline-audio-point-lifo-s13-g008-g004.mjs \
  scripts/test-timeline-audio-point-lifo-s13-g008-g004-corr001.mjs \
  scripts/test-inspector-audio-volume-points-s12-g007-g001.mjs \
  scripts/test-timeline-audio-volume-automation-s11-g007-g002.mjs \
  scripts/test-timeline-audio-volume-automation-s11-g007-g002-corr001.mjs \
  scripts/test-timeline-audio-trim-both-ends-s13-g008-g003.mjs \
  scripts/test-timeline-audio-trim-both-ends-s13-g008-g003-corr001.mjs \
  scripts/test-timeline-audio-trim-both-ends-s13-g008-g003-corr002.mjs
node --test scripts/test-timeline-audio-volume-automation-s11-g007-g002-electron.mjs
node --test scripts/test-timeline-audio-point-lifo-s13-g008-g004-electron.mjs
node --test scripts/test-inspector-audio-volume-points-s12-g007-g001-electron.mjs
node --test scripts/test-timeline-audio-trim-both-ends-s13-g008-g003-electron.mjs
npm run build
npm run electron
```

## Salidas esperadas, aún NO verificadas en Electron local
- Node focal: 155 PASS / 0 FAIL.
- Automatización histórica Electron: 1 PASS con **37 comprobaciones**, las 36 anteriores más zoom+scroll.
- LIFO Electron: 25 verificaciones; Inspector: 40; Trim: 46.
- `npm run build`: compilación de Editor y Player; no equiparar `npm run electron -- --build` con el build de Player.

## QA visual y funcional de usuario
1. En Timeline, confirmar que la onda PCM comienza dentro del clip y no presenta desplazamientos de tiempo al cambiar zoom o scroll.
2. Confirmar selección, arrastre y Ctrl+doble clic sobre automatización. Ninguna pista adicional.
3. Confirmar que los puntos mantienen orden LIFO y el mismo volumen interpolado en Preview y Player.
4. Guardar/reabrir y Undo/Redo; verificar que no se altera la semántica de `createdOrder` ni el origen temporal.
5. Enviar logs de Node, Electron y `npm run build`, capturas o explicación de QA visual; aprobar únicamente después de comprobar el resultado real.

## Criterio de estado
CORR-001 IMPLEMENTADO, Node PASS, Electron/build NO VERIFICADOS, QA LOCAL PENDIENTE, NO APROBADO/NO CERRADO. Los 12 fallos históricos de la batería ampliada G004 anterior no se consideran resueltos ni se ocultan con esta corrección.
