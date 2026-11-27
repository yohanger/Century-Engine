# LF-UI-DESIGNER-UX-S03-G001 — Integración de diseño profesional

**Gate:** autorizado expresamente el 30-10-2026. **Base:** `LevelForge_EDITOR_EDITMODE_UX_S02_G002_SOURCE_BASELINE.zip`. **Estado:** IMPLEMENTADO, TEST NODE PASS; compilación y QA visual local NO VERIFICADOS.

## Auditoría y extensión

- `UiEditor.vue` conservaba dos columnas: selector alterno Herramientas / Controles / Propiedades en la izquierda y vista previa en la derecha.
- `UiDesignerPanel.vue` contenía todos los campos del modelo real y ya utilizaba `ResourceDropSlot.vue` para imágenes, retratos y audio.
- `designer.js` gestionaba el estado de autoría y guardaba `<design>`, `<template>` y, si procedía, `<script>`.
- `engine/runtime/ui/design.js` ya implementaba `reparent(d,id,parentId)` y `absRect`, pero no había comando de autoría para reparentar con jerarquía.

Se han extendido los **archivos originales**. No se han creado un editor, un runtime o un registro alternativos.

## Contrato realizado

1. `UiEditor.vue`: vista Plantilla/HTML, Script y Estilo; al entrar en Diseño, paleta y jerarquía simultáneas a la izquierda, Canvas central e Inspector a la derecha. Las anchuras de los paneles se cambian mediante separadores de ratón/teclado sin persistir en `.ui`. Por debajo de la anchura de contenedor de 930 px las zonas se apilan verticalmente.
2. `UiDesignerPanel.vue`: dos vistas de presentación de la **misma instancia `D.dz`** (`section=library` y `section=inspector`). Búsqueda y selección en jerarquía, orden Z, duplicar/eliminar, selector de contenedor e interfaz interna de arrastre `application/x-lf-ui-control`. El protocolo de assets `application/x-lf-entry` permanece separado. No se cambian las representaciones de imágenes y audio.
3. `designer.js`: `moveToParent` valida padres contenedores y utiliza el `reparent` existente, que preserva posición absoluta y previene ciclos. Realiza una única confirmación en el modelo de diseño y sus bloques generados. Se conservan las funciones `setProp`, `front`, `back`, `duplicate`, `remove` y la generación del script existente.
4. La simulación queda plegada en una sección accesible, para disponer de mayor área de Canvas. La vista HTML, los cambios de script/estilo, los avisos de HTML manual y el código generado se conservan.
5. No se modifican `UiRoot`, el formato `.ui`, la serialización `.lfproj`, el Player ni los sistemas de eventos.

## Riesgos y límites verificados

- La prueba Node ejercita generación real, `reparent`, límites de jerarquía, serialización y contrato de componentes. No monta Vue ni prueba interacción real de drag/drop, ResizeObserver, CodeMirror o Electron.
- `test-assets-slot-dnd-s01-g003.mjs` recibió únicamente una función `ref` en su **mock de Vue** por la adición del filtro reactivo. No se alteraron sus aserciones de recursos.
- Faltan `vite`/dependencias instaladas; no se puede afirmar que el build haya pasado. `docs:build` no regeneró HTML publicado.
- Los cambios en Canvas y el Inspector deben validarse en resolución de escritorio y estrecha en Electron; también deben comprobarse paneles muy pequeños, diseño legado y flujo de guardado y reapertura.

## Pruebas

`npm run test:ui-designer-ux` y las regresiones de Assets/Editor. Consultar `docs/qa/LF-UI-DESIGNER-UX-S03-G001_QA.md`.

## Integración final

Se eliminó el estado obsoleto `dz.pane` y su escritura desde `UiDesignOverlay.vue`; el Inspector permanece a la vista sin cambiar la selección. El selector de resolución muestra anchura y altura y conserva los valores del preview.
