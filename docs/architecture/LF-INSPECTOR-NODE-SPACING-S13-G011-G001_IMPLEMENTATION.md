# LevelForge · S13-G011-G001 · Espaciado del Inspector de nodos

## Autoridad

- Gate autorizado literalmente: `LF-INSPECTOR-NODE-SPACING-S13-G011-G001`.
- SOURCE_BASELINE de entrada: `LF_INSPECTOR_SCENE_UX_CLEANUP_S13_G004_INTEGRAL_SOURCE_BASELINE.zip`.
- Contrato UX-01..UX-08 ratificado; S13-G002 y CORR-001 de plegado ya aprobados por el usuario.
- S13-G004 Escena aprobado por el usuario el 2026-11-08; los resultados Electron/build no fueron aportados y no se convierten en PASS.
- S13-G003 de limpieza de nodos permanece DESCARTADO EN ESTA FASE. Este Gate es únicamente de **espaciado**, no limpieza documental.

## OBSERVADO

La captura real BoxShape3D muestra encabezados y propiedades demasiado juntos, con etiquetas de dos líneas. En el código, la separación global de filas es 2 px, el encabezado de nodo tiene 3 px entre elementos y el cuerpo de sección usa un padding más ajustado. El Inspector utiliza la columna compartida de etiquetas `--lf-property-label-width` y una container query a 260 px que no deben sustituirse.

## Causa raíz acotada

La baja separación vertical entre las filas y elementos montados por `Inspector.vue` causa densidad excesiva. Aumentar sin criterio los márgenes horizontales o alterar `src/styles.css` reduciría los controles X/Y/Z y contaminaría otros paneles.

## Cambio implementado

Solo `src/components/Inspector.vue` cambia en producción. Se identifica explícitamente el encabezado real de nodo (`node-head`) y se amplía su padding de 12/14/13 px, con ritmo vertical de 8 px. El checkbox `DontDestroyOnLoad` utiliza una columna flexible para el nombre y una columna automática para la casilla, sin tocar la propiedad.

Las secciones de nodo directas usan encabezado de al menos 30 px, cuerpos con padding 12/14/14 px, filas de al menos 28 px y margen entre filas consecutivas de 8 px. La variante Primitiva conserva sus estilos anteriores y se iguala al mismo ritmo. En paneles bajo 260 px se conserva una disposición en una columna y padding lateral de 10 px.

No se han modificado `TagLayerRow`, `Vec3Field`, `NumberField`, `InspectorDock`, `ScenePanel`, `TerrainPanel`, datos ni lógica de edición.

## Límites

- No se añade un segundo sistema de Inspector, de plegado o de tooltips.
- No se modifican preferencias `inspFold`, callbacks, Undo/Redo, Assets, Timeline, Player ni sistemas de física.
- No se eliminan ni introducen mensajes de documentación o controles nuevos.
- Las guías cinematográficas de cámara en Timeline siguen PENDIENTE PLANIFICADO para una fase posterior, sin implementación aquí.

## Estado de validación

Node focal 16 PASS; batería compatible 93 PASS. Una prueba de integración de Box Fit (`BOX-I-05`) falla también sobre el SOURCE_BASELINE anterior y no se ha corregido ni reclasificado. Fixture Electron real de 25 comprobaciones creada, pero no ejecutada por ausencia de Vite; build NO VERIFICADO. QA local del usuario PENDIENTE.
