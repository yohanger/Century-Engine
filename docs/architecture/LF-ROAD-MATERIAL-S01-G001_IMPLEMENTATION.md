# LF-ROAD-MATERIAL-S01-G001 — Corrección de materiales de Carretera

Fecha: 2026-10-29 · SOURCE_BASELINE: `LevelForge_EDITOR_SAFETY_S01_G002_SOURCE_BASELINE.zip`.
Autorización: «Listo. LF-ROAD-MATERIAL-S01-G001 autoriza comenzar».

## Diagnóstico previo

**Observado:** `RoadPanel.vue` disponía de texturas para asfalto, líneas y aceras, pero la selección de una imagen existente conservaba el color oscuro predeterminado, mientras la importación de una nueva imagen sustituía ese color por blanco. `nodes/road.js` multiplicaba la textura por ese valor. `scene/textures.js` no limpiaba la carga en fallo y no ofrecía invalidación por sustitución de bytes. La geometría ya calcula UV en metros según `slots[k].tile`; no fue necesario modificar el generador de trazado ni las colisiones.

**Causa raíz identificada en código:** tratamiento inconsistente entre color base y tinte opcional, junto a una caché sin invalidación ni cancelación lógica de peticiones tardías.

## Mecanismo aplicado

- `geometry/road.js`: mantiene la configuración de cuatro slots; añade `tintEnabled` (booleano o `null` para proyectos heredados) y funciones únicas `roadTintEnabled` / `roadSurfaceColor`. Una textura sin tinte utiliza blanco para no alterar sus píxeles. Se conservan colores personalizados heredados distintos de los predeterminados; cuando el dato heredado coincide con el predeterminado no puede conocerse una intención histórica distinta.
- `RoadPanel.vue`: selección e importación de imagen siguen el mismo flujo; permite activar/desactivar tinte por superficie, sin modificar colores al cargar texturas. Informa de una referencia ausente en Assets. La rugosidad, las UV en metros, las líneas, los puntos y el editor existentes permanecen intactos. El historial se gestiona mediante `updateObject` y `commit` originales.
- `nodes/road.js`: emplea el color efectivo para la textura cargada y el color base como fallback mientras carga o cuando hay error; conserva brillo propio y parámetros PBR preexistentes.
- `scene/textures.js`: utiliza caché compartida para Carretera/Agua, conjunto de fallos y tokens de carga pendientes. Ignora respuestas obsoletas, permite invalidación explícita, libera las texturas GPU y sincroniza únicamente nodos consumidores. La caché se limpia también al cambiar de proyecto y en `SceneGraph.dispose`.
- `state/objects.js`: llama a la invalidación tras reemplazar los bytes de una imagen en Assets, sin añadir un segundo mecanismo de notificación.
- `core/godot/nodes.js`: utiliza el mismo color efectivo; conserva el color original del brillo propio. La ruta existente de `ExportModal.vue` convierte texturas de carretera a PNG para el GLB; se incorpora error explícito ante una referencia inexistente.
- `.lfproj` y `.levelpackage` preservan las propiedades nuevas en `props`, mediante las rutas ya existentes; no se modifica el formato ni se agregan administradores de materiales.

## No intervenido

Geometría, colisiones, red vial, sistemas de eventos, sistema global `.material`, Three.js y dependencias, Player, exportadores de otros tipos de objeto. La vinculación de recursos `.material` compartidos a los slots sigue fuera de este Gate.

## Verificación

Test Node `scripts/test-road-material-s01-g001.mjs`: 11/11 PASS (funciones reales y dobles controlados de renderer/caché/exportador). Regresión de seis archivos existentes: 78/78 PASS. Total ejecutado: **89/89 PASS**.

`npm ci --offline --ignore-scripts`: no instalado porque falta `zip-stream@4.1.1` en caché. `npm run build`, Chromium/WebGL, Editor y Player: **NO VERIFICADOS**. No se declara QA local PASS, aprobación ni cierre.

## Riesgos residuales

- Los colores heredados idénticos al predeterminado no codifican la intención del usuario; la corrección elimina su multiplicación implícita sobre mapas de color.
- La ruta de exportación Godot de carreteras sigue usando la conversión previa a PNG y el material GLB existente. Su equivalencia visual requiere QA real.
- Una imagen ausente o ilegible muestra diagnóstico sin impedir otras ediciones. La inspección visual de la textura en GPU y los resultados en PSX permanecen pendientes.
