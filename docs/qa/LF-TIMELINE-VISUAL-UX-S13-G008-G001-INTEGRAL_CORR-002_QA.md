# QA S13-G008-G001 CORR-002

## Evidencia instrumental

| Verificación | Resultado del entorno de preparación | Evidencia |
|---|---|---|
| Node focal (VIS-01..17, VIS-CORR001-01..06, VIS-CORR002-01..14) | **37 PASS / 0 FAIL** | `docs/qa/evidence/LF_S13_G008_G001_CORR002_NODE_FOCAL.log` |
| Regresión compatible (Timeline, Inspector, audio y plegado) | **152 PASS / 2 SKIP / 0 FAIL** | `docs/qa/evidence/LF_S13_G008_G001_CORR002_NODE_REGRESSION.log` |
| Sintaxis de bloques JavaScript en fixture Electron | PASS | pruebas VIS-CORR002-14 |
| Electron nuevo (19 comprobaciones) | **NO VERIFICADO**: falta Vite | `docs/qa/evidence/LF_S13_G008_G001_CORR002_ELECTRON_ENV.log` |
| Electron histórico (54 comprobaciones) | **PASS LOCAL previo del usuario**, no repetido en CORR-002 | `docs/qa/evidence/LF_S13_G008_G001_CORR002_PREVIOUS_APPROVAL.md` |
| Build Editor/Player de CORR-002 | **NO VERIFICADO**: falta Vite | `docs/qa/evidence/LF_S13_G008_G001_CORR002_BUILD_ENV.log` |
| QA visual del usuario para CORR-002 | **PENDIENTE** | capturas + decisión explícita |

Los SKIP corresponden a pruebas condicionales al compilador Vue ausente en el entorno de preparación y no se contabilizan como PASS.

## Comandos desde la raíz del proyecto que contiene package.json

```bash
node --test scripts/test-timeline-visual-ux-s13-g008-g001.mjs scripts/test-timeline-visual-ux-s13-g008-g001-corr001.mjs scripts/test-timeline-visual-ux-s13-g008-g001-corr002.mjs
node --test scripts/test-timeline-visual-ux-s13-g008-g001-corr002-electron.mjs
node --test scripts/test-timeline-visual-ux-s13-g008-g001-electron.mjs
npm run build
npm run electron
```

**Esperado:** 37 PASS Node focal; Electron CORR-002 **1 PASS/19 checks**; Electron anterior **1 PASS/54 checks**; build Editor + Player completo. `npm run electron -- --build` por sí solo no acredita necesariamente el build Player.

## Checklist visual del usuario

1. En Inspector con recurso Timeline seleccionado, «Cinemática» no se superpone a la flecha; el encabezado sigue plegable y reabre con ratón/teclado en el InspectorDock.
2. No aparece el párrafo documental inferior; se conservan Nombre, Duración, En bucle, Bloquear jugador, Se puede omitir y Barras de cine.
3. Timeline tiene superficies de tonos coherentes con el Editor tanto en filas pares/impares como en la cabecera fija, botones de pistas, controles Snap y modos de edición.
4. Las pistas seleccionadas se distinguen de las normales y el estado bloqueado/silenciado sigue reconocible.
5. Panel estrecho y desacoplado: el título, flecha, campos y barras no se desbordan.
6. Clips, clave Audio, automatización de volumen, fade, zoom, cabezal y selección siguen funcionando; tiempo y proyecto sin mutaciones por presentación.
7. No cambia el Player ni recursos Cinematics de FilmMaker.

**Evidencia a devolver:** Node, ambos Electron, `npm run build`, capturas del Inspector y Timeline y evaluación visual. El Gate permanece NO APROBADO / NO CERRADO hasta entonces.
