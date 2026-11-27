# LevelForge — S12-G001 CORR-001 · QA

## Autoridad y estado

Gate autorizado literalmente por el usuario: `LF-TIMELINE-PREVIEW-DIALOG-S12-G001-INTEGRAL_CORR-001`.
Base: `LF_TIMELINE_PREVIEW_DIALOG_S12_G001_INTEGRAL_SOURCE_BASELINE.zip`.
Estado: IMPLEMENTADO EN FIXTURE; NODE TEST AUTOMATIZADO PASS; ELECTRON Y BUILD NO VERIFICADOS; QA LOCAL PENDIENTE; NO APROBADO; NO CERRADO.

## Observado y causa raíz

El usuario ejecutó S12-G001 Electron en su entorno local: 9 comprobaciones PASS, décima «Códigos de texto interpretados» FAIL. El error era una aserción en la fixture. El proyecto Editor y Player registran `RtDialogText` mediante `registerUiComponents(app)`, pero la fixture aislada no lo registraba. La verificación antigua buscaba «Prueba» en el contenedor y no comprobaba el color.

## Corrección implementada

En la fixture existente, registrar los componentes nativos mediante `registerUiComponents(app)` antes de montar Vue. Confirmar el registro, esperar a `.rt-dialog-text .rt-dt-body`, extraer solo tramos visibles y comprobar el valor de color `\C[2]` con `getComputedStyle()`. Conservar las demás verificaciones de transporte y el runner sin modificaciones.

**No se modificaron fuentes de producción** (ni `DialogPreview.vue`, `UiRoot.vue`, `UiManager`, Timeline, Player, formatos ni Assets).

## Resultados ejecutados en generación

- Focal `node --test scripts/test-timeline-preview-dialog-s12-g001-corr001.mjs scripts/test-timeline-preview-dialog-s12-g001.mjs`: **14 PASS / 0 FAIL / 0 SKIP**.
- Regresión compatible de S11/S12 y `project-safe`: **133 PASS / 4 SKIP / 0 FAIL** de 137 pruebas. SKIP por dependencias no disponibles.
- Fixture Electron: **NO VERIFICADA**, el runner aborta antes de abrir Vite (`Falta Vite; ejecutar npm ci antes del QA`). No equivale a un error funcional de la corrección.
- Build Editor/Player: **NO VERIFICADO** (`vite: not found`, exit 127).
- QA visual local y Player real: **PENDIENTES**.

## QA local solicitado

1. Aplicar CHANGE sobre la base S12-G001, previa comparación de cambios locales.
2. Ejecutar la suite focal S12-G001 + CORR-001; esperar 14 PASS.
3. Ejecutar `node --test scripts/test-timeline-preview-dialog-s12-g001-electron.mjs`; esperar 1 PASS con al menos 17 comprobaciones (fixture corregida incluye comprobaciones adicionales).
4. Ejecutar `npm run build` y `npm run electron`, sin interrumpir la compilación.
5. Reproducir `Mostrar texto` con `\C[2]` en Preview. Confirmar el texto y su color, tema/Canvas, Pause/Resume, Seek/Stop, compatibilidad Player y ausencia de caja auxiliar antigua.
6. Devolver salida completa de pruebas y captura real del viewport. Una aprobación explícita del usuario habilita el cierre posterior, sin convertir compilación ni Electron en PASS por inferencia.

## Evidencia preservada

- `docs/qa/evidence/LF_S12_G001_CORR001_USER_ELECTRON_FAIL.md`: fallo reportado por el usuario.
- `docs/qa/evidence/LF_S12_G001_CORR001_NODE_FOCAL.log`.
- `docs/qa/evidence/LF_S12_G001_CORR001_NODE_REGRESSION.log`.
- `docs/qa/evidence/LF_S12_G001_CORR001_ELECTRON_ENV.log`.
- `docs/qa/evidence/LF_S12_G001_CORR001_BUILD_ENV.log`.

No se han añadido efectos FX, zoom, cortes de audio ni cambios de otros sprints.
