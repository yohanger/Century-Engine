# LF-TIMELINE-PRO-UX-S07-G001-INTEGRAL — QA y entrega

**Fecha:** 2026-11-05  
**Estado:** IMPLEMENTADO EN FUENTES; TEST AUTOMATIZADO PASS parcial; COMPILACIÓN / QA ELECTRON / QA USUARIO **NO VERIFICADOS**. Gate abierto, no aprobado ni cerrado.

## Alcance ejecutado

- `src/components/TimelinePanel.vue` conserva la autoría, el reloj de previsualización y la selección temporal originales; **no crea otro Timeline**.
- Biblioteca lateral permanente de 205 px reemplazada por selector compacto, búsqueda y creación mediante las acciones reales de Assets/Timeline. FilmMaker queda excluido por la selección ya existente.
- Cabecera de pistas ajustable mediante ratón y teclado; su anchura preferida se recupera después de estrechar/ampliar el dock. Una única variable alinea cabeceras, regla, claves y cabezal.
- Lienzo temporal ocupa al menos el ancho disponible. «Ajustar duración» calcula desde el ancho real de la vista temporal; cambiar el dock no sustituye el zoom manual.
- La cuadrícula usa las marcas reales de `timelineRulerTicks`, eliminando la referencia no definida `tickStep`.
- Controles agrupados y redistribución en docks estrechos; opciones de zoom y Snap siguen disponibles mediante el menú.
- Biblioteca, menú de pistas y opciones se colocan en la superficie global de Vue mediante `Teleport`, sin otro gestor de UI ni ventana adicional. Se reposicionan y evitan el recorte del dock. Se cierran cuando el panel deja de estar activo.
- Conservados los tipos de pista, operaciones contextuales, edición de claves, drag-and-drop de Jerarquía, Inspector, Assets, preview, Player y docking existentes.
- No hay modificaciones de FilmMaker, Cinematics ni del formato del proyecto.

## Auditoría previa: OBSERVADO / INFERENCIA / CAUSA RAÍZ

- **OBSERVADO:** biblioteca fija mediante `grid-template-columns:205px`; a su lado otra columna fija de cabeceras.
- **OBSERVADO:** `measureViewport` recalculaba `headerWidth` con cada `ResizeObserver`, sin conservar la preferencia del usuario.
- **OBSERVADO:** las reglas responsive ocultaban los controles de zoom/Snap en docks estrechos; estaban parcialmente recuperables desde «Opciones».
- **OBSERVADO:** referencia a `tickStep` no declarada en el componente, en el estilo de cuadrícula.
- **CAUSA RAÍZ (layout):** columnas rígidas y cálculo reactivo del ancho que no distinguía preferencia del usuario de restricción del dock.
- **INFERENCIA PENDIENTE DE QA:** ganancia visual en Electron real y en ventanas flotantes; aún no hay medición de geometría DOM con Vite/Electron.

## Regresión ejecutada

Se ejecutó (dependencias del compilador Vue no instaladas en este entorno):

```sh
node --test \
  scripts/test-timeline-pro-ux-s07-g001-integral.mjs \
  scripts/test-timeline-ux-integration-s04-g004.mjs \
  scripts/test-timeline-hierarchy-dnd-s04-g001.mjs \
  scripts/test-timeline-interpolation-s04-g002.mjs \
  scripts/test-timeline-node-method-track-s04-g003.mjs \
  scripts/test-filmmaker-timeline-unification-s03-g001-integral.mjs
```

**Resultado real:** 78 PASS, 1 SKIP (prueba de compilación del template Vue), 0 FAIL. La sintaxis JavaScript separada del SFC y la estructura de cierres de template se verificaron por separado. El SKIP **no es PASS**.

## QA local del usuario — obligatorio antes de cerrar

Desde la raíz existente de LevelForge (carpeta con `package.json`):

```sh
node --test scripts/test-timeline-pro-ux-s07-g001-integral.mjs scripts/test-timeline-ux-integration-s04-g004.mjs
npm run build
npm run electron
```

1. Abrir un Timeline real a resolución de aproximadamente 1366×768. Verificar el selector superior; buscar y seleccionar otros Timelines; crear uno nuevo.
2. Comprobar que la biblioteca ya no resta 205 px permanentemente. Seleccionar y renombrar desde opciones.
3. Arrastrar el separador de cabeceras; estrechar y ampliar el dock; la preferencia vuelve al ampliar.
4. Probar clic en regla, desplazamiento horizontal, zoom, «Ajustar duración», Snap, selección y movimiento de claves.
5. Probar la barra de herramientas con dock estrecho, ampliado y flotante. Verificar que los desplegables pueden abrirse arriba cuando no hay espacio debajo y que sus contenidos son accesibles.
6. Comprobar Jerarquía → pistas mediante arrastre, Inspector, reproducción/previsualización y menú contextual de claves.
7. Guardar/reabrir `project.lfproj`. Comprobar que los tiempos, IDs y valores de las claves no cambiaron.
8. Verificar que el viewport, otros paneles y el Player mantienen su comportamiento.

**Evidencia requerida:** logs Node y `npm run build`; capturas del Timeline acoplado, pequeño, ampliado y flotante; resultado de selección, drag de una clave y persistencia. No declarar QA PASS hasta recibirla.

## Dependencias y restricciones

- S02 FilmMaker, S03 FilmMaker, S04 Cinematic y S07 Cinematics continúan pendientes o pausados conforme al estado previo; no se tocan.
- La validación real de Vue/Vite/Electron depende del entorno local con `node_modules` disponible.
- No se ha ejecutado QA visual y no se afirma mejora cuantificada de FPS.

## Seguridad de instalación

Aplicar `CHANGE` **solo** sobre la raíz del proyecto que ya contiene el SOURCE_BASELINE acumulado S04, tras comparar los archivos afectados y respaldar modificaciones locales. Si el proyecto local es más antiguo o contiene cambios difíciles de conciliar, probar primero `SOURCE_BASELINE` en una carpeta separada. No aplicar ambos ZIP sobre la misma carpeta. No eliminar proyectos, películas ni `node_modules` locales.

## Inventario exacto contra SOURCE_BASELINE S04

**Modificados (3):**

- `src/components/TimelinePanel.vue` — interfaz, geometría, menús y responsive.
- `scripts/test-timeline-ux-integration-s04-g004.mjs` — adapta aserciones históricas sobre ancho automático/nowrap al contrato S07, preservando pruebas de funcionalidad.
- `docs/qa/LevelForge_DB_Ledger.xlsx` — registra S07 en las seis hojas, preservando historial y 12 tablas.

**Nuevos (3):**

- `scripts/test-timeline-pro-ux-s07-g001-integral.mjs` — ocho pruebas, incluida compilación Vue cuando está instalada.
- `docs/qa/LF-TIMELINE-PRO-UX-S07-G001-INTEGRAL_QA.md` — auditoría, alcance, QA y entrega.
- `docs/qa/evidence/LF-TIMELINE-PRO-UX-S07-G001/node-results.log` — evidencia automatizada real.

**Eliminados:** ninguno. **Cambios inesperados:** ninguno. **Archivos sin cambio:** 2.240.


## CORR-001 — Biblioteca desplegable comprimida (QA usuario 2026-11-05)

**Observado:** en captura de Electron 1366×768 el selector de Timelines aparece con buscador, contador y una entrada comprimidos en una ventana de altura natural muy pequeña. El menú se abría sin recorte del dock, pero `max-height` no imponía altura mínima útil; el listado no ofrecía suficiente espacio para crecer y desplazarse.

**Causa raíz de layout (código):** `repositionPopup()` configuraba únicamente un máximo de altura y `library-pop` se adaptaba a los pocos hijos presentes. La lista tenía `overflow:auto`, pero carecía de espacio flexible reservado.

**Corrección:** el menú de biblioteca dispone de hasta 368 px de ancho y 340 px de alto, limitado por el espacio visible; conserva el anclaje y la apertura hacia arriba cuando falta espacio inferior. La búsqueda y el contador son fijos dentro de la ventana; la lista ocupa el espacio restante y tiene `overflow-y:auto` con scrollbar visible cuando corresponde. No se modifican recursos, tiempos, Player, FilmMaker, Cinematics ni docking.

**Pruebas realizadas:** `node --test scripts/test-timeline-pro-ux-s07-g001-integral.mjs scripts/test-timeline-pro-ux-s07-g001-corr001.mjs scripts/test-timeline-ux-integration-s04-g004.mjs scripts/test-timeline-hierarchy-dnd-s04-g001.mjs scripts/test-timeline-interpolation-s04-g002.mjs scripts/test-timeline-node-method-track-s04-g003.mjs scripts/test-filmmaker-timeline-unification-s03-g001-integral.mjs` → **82 PASS, 1 SKIP (@vue/compiler-sfc no instalado), 0 FAIL**. Evidencia: `docs/qa/evidence/LF-TIMELINE-PRO-UX-S07-G001/corr001-node-results.log`.

**QA local pendiente:** validar en Electron el selector con un Timeline y varios, con la ventana de LevelForge a 1366×768 y con dock reducido/flotante; confirmar scroll vertical en listas largas, que no hay doble barra, que búsqueda y contador permanecen visibles, y que seleccionar un recurso sigue funcionando. `npm run build` y QA visual permanecen NO VERIFICADOS. Gate S07 ABIERTO, no aprobado/cerrado.
