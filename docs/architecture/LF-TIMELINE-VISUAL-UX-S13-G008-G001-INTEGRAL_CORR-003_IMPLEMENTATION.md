# LevelForge — S13-G008-G001 CORR-003 · QA del Inspector temporal

## Autoridad

Gate autorizado literalmente: `LF-TIMELINE-VISUAL-UX-S13-G008-G001-INTEGRAL_CORR-003`.
SOURCE_BASELINE de entrada: `LF_TIMELINE_VISUAL_UX_S13_G008_G001_INTEGRAL_CORR002_SOURCE_BASELINE.zip` (2.793 archivos, íntegro).
Contratos: UX Inspector/Timeline ratificados. La modificación no afecta ningún contrato funcional.

## OBSERVADO

La ejecución local del usuario tras aplicar CORR-002 indica 37/37 Node PASS. En Electron la fixture alcanza el octavo chequeo; los siete previos pasan, incluidos encabezado, flecha y eliminación del párrafo. El chequeo «Nombre, duración y ajustes siguen disponibles» falla; el resto de las 19 comprobaciones queda sin ejecutar. No se aportó salida de compilación Editor/Player para CORR-002.

## CAUSA RAÍZ

El chequeo buscaba cualquier `input[type="number"]` bajo el Inspector. En cambio, `ParamForm.vue` utiliza el `NumberField.vue` existente para `type: 'number'`. Su control real es `<input type="text" inputmode="decimal">`. Por tanto, se evaluaba un selector equivocado y no la presencia de campos semánticos. No corresponde modificar `NumberField` ni degradar la validación.

## CORRECCIÓN AUTORIZADA

Archivo existente modificado: `scripts/fixtures/editor/timeline-visual-ux-s13-g008-g001-corr002.html`.

- Se conserva la aserción 8 en la misma posición y con el mismo nombre.
- Comprueba Nombre con etiqueta accesible y valor esperado `Timeline QA`.
- Comprueba las filas semánticas `Duración (s)` y `Barras de cine (%)`, cada una con su control real `.nf input[type="text"][inputmode="decimal"]`, editable y con valor numérico válido.
- Comprueba `En bucle`, `Bloquear jugador` y `Se puede omitir` con sus casillas reales editables.
- Si alguna condición falla, incluye datos de diagnóstico de nombre, controles numéricos y booleanos en el resultado de Electron.
- Se mantienen exactamente 19 comprobaciones originales, las condiciones de resultado/errores, WebGL y el runner `qa-electron-webgl-runner.mjs`.

Nuevo test: `scripts/test-timeline-visual-ux-s13-g008-g001-corr003.mjs`, siete comprobaciones Node que contrastan controles de producción, selectores, identidad del recurso, validación semántica, cantidad de comprobaciones y sintaxis de la fixture.

## PRESERVACIÓN Y EVIDENCIA

Sin cambios en `src/`, `TemporalResourceInspector.vue`, `ParamForm.vue`, `NumberField.vue`, `TimelinePanel.vue`, Timeline model, Player ni audio. No se crea otro Input ni otro Inspector.

- Node focal: 44 PASS / 0 FAIL.
- Node regresión: 72 PASS / 1 SKIP / 0 FAIL.
- Electron CORR-003: NO VERIFICADO en preparación (no hay Vite/`node_modules`).
- Build Editor/Player: NO VERIFICADO en preparación (`vite: not found`).
- QA usuario: PENDIENTE. G008 CORR-002 y CORR-003 continúan abiertos hasta verificación de Electron, compilación y aprobación.

La ausencia de un error en Node no demuestra que las 19 comprobaciones Electron hayan pasado; tampoco se altera ninguna aserción posterior a la número 8.
