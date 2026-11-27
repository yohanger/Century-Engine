# LF-TIMELINE-AUDIO-POINT-LIFO-S13-G008-G004-INTEGRAL · QA

## Resultados comprobados en el entorno de implementación
- Node focal: **132 PASS / 0 FAIL** con el test LIFO, Inspector y Audio Trim/Automatización históricos. Registro `evidence/LF_S13_G008_G004_NODE_FOCAL.log`.
- Regresión complementaria dirigida final: **115 PASS / 0 FAIL**. El test histórico VIS-10 fue actualizado para comprobar orden visual derivado y conservación de la normalización temporal, sin perder cobertura. Registro final en `evidence/LF_S13_G008_G004_NODE_REGRESSION.log`.
- Regresión ampliada: versión nueva **839 pruebas: 808 PASS, 19 SKIP, 12 FAIL**; SOURCE_BASELINE anterior **804 pruebas: 773 PASS, 19 SKIP, 12 FAIL**. Los 12 errores coinciden por test y motivo y son preexistentes. No se alteraron para ocultarlos. Registros `evidence/LF_S13_G008_G004_NODE_EXPANDED.log` y `evidence/LF_S13_G008_G004_BASELINE_EXPANDED.log`.
- Fixture Electron nueva de 25 comprobaciones internas. Scripts y HTML pasan análisis sintáctico de JavaScript, pero **Electron NO VERIFICADO**: Vite ausente (`node_modules` no incluido en el SOURCE_BASELINE). `evidence/LF_S13_G008_G004_ELECTRON_ENV.log`.
- Build Editor + Player: **NO VERIFICADO** en este entorno; `vite: not found`. `evidence/LF_S13_G008_G004_BUILD_ENV.log`.
- QA visual/sonoro usuario: **PENDIENTE**. No declarar PASS/READY/CERRADO.

## QA local obligatorio desde la raíz con `package.json`
```bash
node --test scripts/test-timeline-audio-point-lifo-s13-g008-g004.mjs \
  scripts/test-inspector-audio-volume-points-s12-g007-g001.mjs \
  scripts/test-timeline-audio-volume-automation-s11-g007-g002.mjs \
  scripts/test-timeline-audio-trim-both-ends-s13-g008-g003.mjs \
  scripts/test-timeline-audio-trim-both-ends-s13-g008-g003-corr001.mjs \
  scripts/test-timeline-audio-trim-both-ends-s13-g008-g003-corr002.mjs
node --test scripts/test-timeline-audio-point-lifo-s13-g008-g004-electron.mjs
node --test scripts/test-inspector-audio-volume-points-s12-g007-g001-electron.mjs
node --test scripts/test-timeline-audio-volume-automation-s11-g007-g002-electron.mjs
node --test scripts/test-timeline-audio-trim-both-ends-s13-g008-g003-electron.mjs
npm run build
npm run electron
```

## Criterios de aceptación visual y funcional
1. En Audio/Automatización, crear puntos en tiempos no cronológicos y verificar que el nuevo aparezca arriba sin alterar la curva.
2. Mover el tiempo de un punto antiguo y nuevo: orden visual permanece, tiempo de reproducción cambia correctamente.
3. Renombrar/editar factor, contraer y expandir cualquier punto, eliminar por icono `bi-trash`: ningún ID o nombre ajeno cambia.
4. Guardar y reabrir proyecto: mismo orden visual. Abrir proyecto legado sin editar: no escribe metadatos de ordinal.
5. Undo/Redo después de alta, movimiento y borrado: restaurar contenido y orden visual.
6. Control Ctrl + doble clic para añadir, 64 puntos, scroll a partir de cinco, fuente WAV/PCM y fundidos previos.
7. Escuchar Preview y Player: misma interpolación cronológica sin nuevas pistas ni buses.
8. Regresiones Electron históricas de Inspector y automatización PASS, Editor y Player compilados sin errores, visual real aprobado por usuario.

## Evidencia a devolver
Salida completa de Node focal, fixture Electron nueva (25 checks), regresiones Electron, `npm run build` y descripción/capturas de QA visual y sonoro. No cerrar el Gate hasta que el usuario apruebe.

## Ledger
ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE y TRACEABILITY actualizadas. Se registra la aprobación local del Mixer S14-G001 CORR001 (Node 26/26, Electron 35/35, build Editor PASS) diferenciando Player NO VERIFICADO. Se conserva historial y las 12 tablas.
