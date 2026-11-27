# QA — S13-G008-G001 · Timeline visual integral

## Resultados comprobados en preparación

| Prueba | Resultado | Archivo |
|---|---|---|
| Focal Node VIS-01..17 | 17 PASS, 0 FAIL | `docs/qa/evidence/LF_S13_G008_G001_NODE_FOCAL.log` |
| Regresión UX/Audio Automation | 110 PASS, 1 SKIP, 0 FAIL | `docs/qa/evidence/LF_S13_G008_G001_NODE_COMPATIBLE.log` |
| Sintaxis JS fixture Electron (2 bloques) | PASS | Validada con `node --check` en ambos modos |
| Electron embebido (54 comprobaciones) | NO VERIFICADO: falta Vite | `docs/qa/evidence/LF_S13_G008_G001_ELECTRON_ENV.log` |
| Build Editor/Player | NO VERIFICADO: falta Vite | `docs/qa/evidence/LF_S13_G008_G001_BUILD_ENV.log` |
| QA visual usuario | PENDIENTE | Resultado y capturas locales |

**SKIP:** test legado que compila template Vue solo cuando `@vue/compiler-sfc` está instalado. No equivale a PASS. Un build no equivale a QA visual.

## Ejecución local (raíz con package.json)

```bash
node --test scripts/test-timeline-visual-ux-s13-g008-g001.mjs scripts/test-inspector-audio-volume-points-s12-g007-g001.mjs scripts/test-timeline-audio-volume-automation-s11-g007-g002.mjs scripts/test-timeline-audio-volume-automation-s11-g007-g002-corr001.mjs scripts/test-timeline-pro-ux-s07-g001-integral.mjs scripts/test-timeline-pro-ux-s07-g001-corr001.mjs
node --test scripts/test-timeline-visual-ux-s13-g008-g001-electron.mjs
npm run build
npm run electron
```

**Esperado Node:** 110 PASS + 1 SKIP cuando el compilador Vue no esté disponible; con dependencias puede variar el SKIP por prueba ejecutada. **Esperado Electron:** 1 PASS, 54/54 verificaciones del Inspector real (40 históricas y 14 visuales). **Build:** Editor y Player completos, sin error; advertencias no equivalen a fallo por sí solas.

## QA visual/funcional del usuario

1. Abrir una clave Audio de Timeline y seleccionar un Clip con nombre largo; el selector no excede el ancho del Inspector, mantiene su valor y opciones.
2. El encabezado «Automatización de volumen» está a la izquierda; «Añadir punto» a la derecha, separado claramente del contenido.
3. Punto-1, Punto-2, nombres personalizados y sus flechas se alinean a la izquierda, con papelera Bootstrap a la derecha.
4. La papelera es accesible aunque el punto esté contraído y elimina únicamente ese punto; no crea claves extras.
5. Estado deshabilitado de pista bloqueada, modo reproducción y Editor bloqueado se conserva.
6. Se mantienen el umbral de 5 puntos para scroll, el renombrado, el plegado por ID, Undo/Redo y la automatización audible.
7. Colores del Timeline coinciden con el Editor en reglas, superficies, filas, grupos y toolbar; las tintas de los distintos tipos de pista conservan identidad.
8. El cabezal blanco queda por encima de las asas de Fade, puntos y clips sin interceptar clic, arrastre ni edición; usar zoom y scroll vertical/horizontal.
9. Corroborar que regla, clips, Snap y tiempo `0` conservan el origen temporal, sin offset ficticio. El margen REAL a la izquierda de t=0 sigue PENDIENTE FUNCIONAL.
10. Cambiar de Inspector a Assets y volver, estrechar dock y desacoplar: sin overflow, sin mutaciones del proyecto.

**No se considerará completado** sin confirmación de Electron, build y QA visual del usuario. Conservar el SOURCE_BASELINE actualizado para siguiente Gate.
