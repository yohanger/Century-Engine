# LF-ROAD-PAINT-S01-G001 — Pintura PBR de carreteras

**Gate:** autorizado; implementación en fuente completada; **QA real Electron/WebGL/Player pendiente**.
**BASE:** `LevelForge_MATERIAL_SURFACE_DETAIL_S01_G001_SOURCE_BASELINE.zip`.

## Contrato de datos

`obj.props.paint = { version: 1, asphalt: Layer[], side: Layer[] }` opcional. No se modifica ningún proyecto que no lo contenga.

Cada superficie admite el material base de la carretera y hasta **tres capas** adicionales. Una capa posee `id`, `materialId` de un recurso `.material` compatible, `visible`, `tile` (metros), `strokes`. Un trazo es `points` (pares UV normalizados, independientes de la repetición de textura), `radius` (metros), `hardness`, `opacity` y `erase`. El sistema rechaza shaders de capa que no sean PBR clásico, Blockout o Realista; no simula compatibilidad de shaders arbitrarios.

Los datos vectoriales se guardan dentro de `props.paint`, a través de la persistencia existente de objetos. Se limita la memoria con **256×512 texeles por superficie pintada**, tres capas, 320 trazos por capa y 4.096 puntos por trazo; no se añaden recursos ficticios a Assets. Las máscaras GPU se regeneran al modificar los datos, cambiar el trazado o recargar el proyecto; no se almacena una segunda representación binaria de la máscara.

## Arquitectura y flujos

- `geometry/road.js`: añade `lfPaintUV` a cada malla. Para calzada, la coordenada lateral se normaliza según el ancho local de cada estación; para aceras, reserva media máscara a cada lado. La componente longitudinal depende de distancia recorrida/longitud total, no de `tile`.
- `geometry/road-paint.js`: normalización, límites, raster de máscaras RGB y repetición de trazos en circuitos cerrados, sin dependencia de Three.js.
- `render/road-paint.js`: convierte la máscara RGBA a `THREE.DataTexture`, resuelve hasta tres `.material` desde `PBR_ENV`, mezcla albedo, rugosidad y normal maps compatibles mediante inyección del mismo material PBR. Los normales se muestrean linealmente; la geometría y colisiones no se modifican.
- `render/pbr.js`: `injectRoadPaint` se encadena a la compilación de PBR; no reemplaza `MeshPhysicalMaterial` ni el shader Realista/Blockout. Los uniformes se actualizan sin recompilar al desplazar el pincel si no cambia el conjunto de capas.
- `RoadPanel.vue` y `editor/roads.js`/`pointer.js`: elegir superficie y `.material`, añadir, quitar u ocultar capas, elegir modo pincel/borrador, dureza, radio y opacidad. Cada arrastre registra **una entrada del historial** existente. No se interceptan las líneas centrales ni las marcas de carril; Esc abandona el modo pincel.
- El Player utiliza el mismo `nodes/road.js` que el Editor y reconstruye la máscara de los trazos guardados. La exportación a Godot de pintura por capas **no está implementada**; hay que indicarlo en el QA.

## Invariantes

1. Un proyecto sin `props.paint` utiliza exactamente su material anterior; no aplica una migración destructiva.
2. Cambiar `slots[k].tile` no mueve las manchas. Cambiar puntos, ancho o longitud hace que los trazos se adapten a las coordenadas normalizadas a lo largo del nuevo trazado; **no es una reproyección en coordenadas de mundo**. Las modificaciones topológicas muy severas pueden deformar la pintura.
3. Los materiales compartidos siguen resolviéndose desde Assets. Materiales ausentes o incompatibles no se dibujan, pero sus datos permanecen para recuperación.
4. No se añade un nuevo pipeline de colisión, nodos, ECS ni sistemas de materiales. No se tocan `Event Order Flow`, la estructura VFX3D ni los archivos de FilmMaker.
5. El GPU solo reserva máscaras para carreteras que realmente contienen trazos pintados. El renderizado de carreteras viejas no debe activar un programa GLSL nuevo.

## Limitaciones explícitas

- No se incluyen máscaras ilimitadas, pintura por canales PBR arbitrarios, displacement geométrico ni edición UV independiente por capa.
- La mezcla específica de normal maps usa derivadas del shader, pendiente de QA WebGL en hardware real.
- Bump/height por capa no está incluido (sí lo está para el material base del Gate previo). Las capas mezclan albedo, rugosidad y normal map si existe.
- Escenas enormes pueden requerir optimizar la rasterización incremental de trazos; el Gate limita tamaño por superficie y cantidad de operaciones, pero todavía no tiene mediciones de rendimiento en hardware objetivo.
- Se necesita verificar persistencia real `.lfproj`, Undo/Redo, solapes de mallas, mapas compartidos, curvas y circuitos cerrados usando Electron/Player.
