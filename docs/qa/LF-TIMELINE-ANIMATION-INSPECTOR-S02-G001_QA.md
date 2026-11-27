# LF-TIMELINE-ANIMATION-INSPECTOR-S02-G001

## Estado y autoridad

- **Autorización literal recibida:** `Listo. LF-TIMELINE-ANIMATION-INSPECTOR-S02-G001 autoriza comenzar`.
- **SOURCE_BASELINE de entrada:** `LevelForge_TIMELINE_ANIMATION_RESOURCES_S01_G001_SOURCE_BASELINE.zip`, S01 aprobado con QA local declarado.
- **Estado S02:** IMPLEMENTADO EN CÓDIGO; QA AUTOMATIZADO FOCAL DE SINTAXIS/CONTRATO: 5/5 PASS; Vite, Electron embebido, Player, QA visual y QA local **NO VERIFICADOS**; Gate **PENDIENTE DE QA Y APROBACIÓN**.
- **Bloqueo del entorno de entrega:** `npm ci` no pudo completar porque `registry.npmjs.org` no resuelve en el contenedor. `npm ci --offline` devolvió `ENOTCACHED` para `zip-stream@4.1.1`. El intento de regresión S01 con Node también quedó **BLOQUEADO POR ENTORNO** antes de ejecutar pruebas: falta `jszip` (`ERR_MODULE_NOT_FOUND`); ver `docs/qa/evidence/LF-TIMELINE-ANIMATION-INSPECTOR-S02-G001/s01-regression-blocked.log`. No se simulan resultados de compilación ni de Electron.

## Alcance implementado

1. `InspectorDock.vue` muestra `TemporalResourceInspector.vue` en su pestaña Inspector para el recurso de Assets o para una selección temporal interna. No se crea otro dock o gestor global.
2. Una única selección editorial (`store.temporalSelection`) identifica `kind`, `resourceId`, `element`, `trackId` e `itemId`. Nunca se serializa en `.lfproj` ni altera `project.timelines` o `project.animations`.
3. En Assets, seleccionar una cinemática o clip muestra sus propiedades. Abrir por ID o elegir pista, clave o evento en el editor activa su contexto. Cambiar documento, seleccionar otra clase de recurso, seleccionar un nodo, cerrar el panel o cambiar de proyecto limpia la selección contextual inaplicable.
4. Se eliminan las dos columnas laterales de propiedades (300/290 px). Las claves se editan con `ParamForm` y los datos persistidos existentes; las pistas usan sus propiedades originales. Se conserva la curva Bézier, la edición de comandos, capturar valor/cámara, ir a la vista/cabezal, duplicar/eliminar y vista previa mediante una revisión editorial (`temporalEditRevision`). Los valores cambian en su objeto original y se registran en el historial ya existente.
5. La pista de física horneada sigue sin claves manuales. La importación `.lfcap`, la reproducción, el catálogo Assets, las referencias y el formato de guardado permanecen sin cambio de contrato.
6. El texto de la barra temporal y sus controles aún no se rediseñan: LF-TIMELINE-ANIMATION-TEMPORAL-UX-S03-G001 queda **PENDIENTE PLANIFICADO**. El renombrado transaccional de referencias por nombre y la instalación de la extensión de VS Code también quedan pendientes de sus Gates específicos.

## Evidencia automatizada de esta entrega

```bash
node --test scripts/test-temporal-inspector-s02-g001.mjs
```

Resultado observado en el entorno de entrega: **5/5 PASS**, todos de revisión de fuentes y sintaxis Node. Ver `docs/qa/evidence/LF-TIMELINE-ANIMATION-INSPECTOR-S02-G001/node-5-pass.log`. Estos tests **no** prueban el montaje Vue ni interacciones reales.

Prueba Electron embebida preparada, **NO EJECUTADA** en este entorno:

```bash
npm ci
node --test scripts/test-temporal-inspector-s02-g001-electron.mjs
node --test scripts/test-timeline-animation-resources-s01-g001.mjs
node --test scripts/test-timeline-animation-resources-s01-g001-electron.mjs
npm run docs:check
npm run build
npm run electron
```

`test-temporal-inspector-s02-g001-electron.mjs` usa `scripts/qa-electron-webgl-runner.mjs` y `scripts/fixtures/editor/temporal-inspector-s02-g001.html`; solicita 27 comprobaciones mínimas. Se ejecuta en Electron embebido, no en Brave/Chromium externo.

## QA visual local pendiente

1. Trabajar en **una copia** de un proyecto existente con al menos dos cinemáticas y dos clips. Seleccionar cada recurso en Assets y comprobar el Inspector principal, IDs y propiedades correctas; doble clic abre el documento exacto.
2. Elegir pista, clave de cámara, clave de nodo, audio/comandos en Timeline y pista, clave Bézier y evento en Animación. Verificar que el Inspector cambia a cada contexto sin presentar datos de otro recurso. Editar, guardar y reabrir.
3. Cambiar repetidamente de documento, cerrar uno, borrar una pista/clave/evento y hacer Deshacer/Rehacer. Verificar que la selección nunca queda apuntando a un elemento eliminado y que no cambian recursos vecinos.
4. Probar scrub, arrastre, claves, reproducción de preview, captura desde cámara, tomar valor del nodo, opción de grabar, curva Bézier y editor de comandos. Detener preview y verificar restauración de poses.
5. Reducir el dock Inspector a **260 px** y comprobar etiquetas, controles, curvas, botones y ausencia de desplazamiento horizontal; repetir con el dock ancho.
6. Guardar/reabrir `.lfproj`, probar Play en Electron y reproducción en Player exportado con First Person/Jolt. Mantener aparte la incidencia ya conocida de plantilla sin controlador.
7. Comprobar que `Juego → Importar captura de movimiento` conserva su ruta y que no existe un inspector lateral redundante.

**Evidencia a devolver ante incidencia:** acción exacta, recurso/tipo/ID afectados, resultado observado, captura o grabación si es visual y error de consola si aparece. Una aprobación sin incidencia podrá registrarse como QA LOCAL PASS DECLARADO; no se requieren logs de S01.

## Declaración de seguridad

No se ha implementado S03 ni la instalación integrada de VS Code. No se modificó ningún archivo fuera del alcance técnico, pruebas, documentación y ledger de S02; no se entrega `node_modules`, caches, `dist`, builds ni scripts de extracción o verificación `.sh`.

## Comparación y contenido de entrega

Se compararon SHA-256 por archivo del SOURCE_BASELINE aprobado y de la copia de trabajo, excluyendo únicamente artefactos generados, instalaciones, cachés y temporales. El paquete **CHANGE** contiene los archivos que difieren; el paquete **SOURCE_BASELINE** contiene el árbol fuente completo actualizado. El `dist-player/` histórico del ZIP de entrada es un build y se excluye expresamente del nuevo baseline, junto a `node_modules/`, sin modificar el código fuente de Player.

**Archivos modificados:**

- `src/components/AnimationPanel.vue`
- `src/components/InspectorDock.vue`
- `src/components/ProjectPanel.vue`
- `src/components/TimelinePanel.vue`
- `src/core/state/animation.js`
- `src/core/state/project.js`
- `src/core/state/state.js`
- `src/core/state/timelines.js`
- `docs/qa/LevelForge_DB_Ledger.xlsx`

**Archivos nuevos:**

- `src/components/TemporalResourceInspector.vue`
- `scripts/test-temporal-inspector-s02-g001.mjs`
- `scripts/test-temporal-inspector-s02-g001-electron.mjs`
- `scripts/fixtures/editor/temporal-inspector-s02-g001.html`
- `docs/qa/LF-TIMELINE-ANIMATION-INSPECTOR-S02-G001_QA.md`
- `docs/qa/LF-TIMELINE-ANIMATION-RESOURCES-S01-G001_CLOSE.md`
- `docs/qa/evidence/LF-TIMELINE-ANIMATION-INSPECTOR-S02-G001/node-5-pass.log`
- `docs/qa/evidence/LF-TIMELINE-ANIMATION-INSPECTOR-S02-G001/s01-regression-blocked.log`

**Archivos de código eliminados:** 0. **Modificaciones inesperadas detectadas:** 0. No se incluyó ningún script `.sh` auxiliar ni archivo SHA-256 independiente.
