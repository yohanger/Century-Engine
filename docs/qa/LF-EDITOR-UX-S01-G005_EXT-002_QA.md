# LF-EDITOR-UX-S01-G005_EXT-002 · Vertex Paint de mallas

**Autorización exacta:** `Listo. LF-EDITOR-UX-S01-G005_EXT-002 autoriza comenzar`.
**Baseline recibido:** `LevelForge_MESH_EDIT_S02_G002_SOURCE_BASELINE(1).zip`, 763 archivos, CRC PASS.
**Estado:** IMPLEMENTADO, pruebas NODE PASS; COMPILACIÓN NO VERIFICADA; QA LOCAL PENDIENTE.

## [X] Implementación autorizada

- [X] **Opt-in:** una malla existente continúa con su material, incluido Blockout métrico, hasta activar explícitamente `Edit Mesh → Vertex Paint`. Al activar se crean dos capas (Base y Capa 2) con sus pesos por vértice; fuera del modo de edición, el material pintado persiste en el Player.
- [X] **Capas:** hasta ocho, reutilizando `MAX_LAYERS`, `STRIDE` y `normalizeLayers` de `terrain-splat.js`. Nombre, color, textura de Asset importado y repetición UV por capa; añadir, editar, reordenar y eliminar redistribuye correctamente los pesos.
- [X] **Pincel:** clic izquierdo/arrastre sobre la superficie, radio en metros del mundo, intensidad, dureza y Ctrl para borrar peso en la capa activa. Raycast contra malla y posición real de vértices transformados; círculo de radio en el visor. No subdivide automáticamente la geometría.
- [X] **Pesos:** ocho flotantes por vértice; normalizados a suma 1. `PolyMesh.weights` y `meshPaint.layers` en `obj.props` conservan la fuente de verdad. `lfWeights0/1` y `lfPaintUV` se usan en buffers y shader solo al activar pintura.
- [X] **Material:** extensión opt-in del `MeshPhysicalMaterial` actual, conservando las propiedades físicas y otros ganchos PBR. Un `DataArrayTexture` sRGB mezcla hasta ocho colores/texturas, con muestreo UV y tiling; no traslada la proyección XZ exclusiva de Terrain a paredes o techos.
- [X] **Carga:** reutiliza el caché de `layerPixels` del Terrain y su `Terrain.loader`; utiliza arrays GPU 256² RGBA por capa para reducir memoria; la textura vuelve al color plano de su capa hasta que termine la carga. Reemplaza/dispone texturas GPU antiguas al cambiar capas.
- [X] **Historial:** un único `commit('Pintar malla')` al finalizar un trazo que haya modificado pesos, sin commits intermedios; Escape cancela el trazo y devuelve la copia de la malla anterior. Cambios de capas generan un commit independiente.
- [X] **Compatibilidad:** proyectos anteriores sin `meshPaint` conservan su comportamiento; no se cambia el material de primitivas no convertidas, Terrain, sistemas de eventos ni física. Los assets de capas se referencian por ID dentro de la escena para resolución de dependencias LevelPackage.

## [X] Evidencia automatizada

- [X] `node --test scripts/test-editor-ux-s01-g005-ext-002.mjs`: **22 PASS / 0 FAIL**; controles sobre normalización, compatibilidad, color, borrado, persistencia, buffers, capas, puntero, UX y fuente compartida.
- [X] Regresión secuencial de `scripts/test-*.mjs`, excluyendo `test-starcat.mjs` por ausencia de dependencias del entorno: **1084 PASS / 0 FAIL / 18 SKIP**.
- [X] Comprobación de sintaxis de los módulos JavaScript tocados: PASS.
- [ ] `npm run build` (Editor + Player): NO VERIFICADO, `vite: not found` en el entorno de construcción; el runtime visual WebGL debe ejecutarse en el Linux del usuario.

## [ ] QA local obligatorio

1. [ ] Ejecutar `node --test scripts/test-editor-ux-s01-g005-ext-002.mjs`, `npm run build` y `npm run electron:dev`.
2. [ ] Abrir proyecto antiguo y revisar primitivas sin pintar, cielo, PBR, Blockout, Play y Player sin cambios visuales inesperados.
3. [ ] Crear cubo editable, entrar en Edit Mesh, activar Vertex Paint. Pintar con la segunda capa y comprobar mezcla visible. Probar Ctrl para borrar.
4. [ ] Cambiar radio, dureza e intensidad; comprobar círculo del pincel; mover cámara, comprobar que no pinta al navegar.
5. [ ] Añadir ocho capas (no nueve), asignar texturas importadas, colores y repetición UV distinta; comprobar caras verticales, techos, UV discontinuas y sombras.
6. [ ] Reordenar y quitar capas pintadas. Los colores pintados no deben saltar a capas equivocadas y la suma de pesos debe permanecer 1.
7. [ ] Confirmar que un trazo continuo añade una sola entrada al historial; Escape cancela; Undo/Redo restaura también pesos y capas.
8. [ ] Guardar, cerrar y reabrir, modificar UV o subdividir; revisar resultados y persistencia. La precisión del pincel depende de los vértices reales.
9. [ ] Exportar el proyecto o un `.levelpackage` con escena que use texturas de capas; importar en otro proyecto y revisar dependencias y carga de imágenes.
10. [ ] Abrir modo Play y Player exportado. Medir memoria/GPU/CPU con varias mallas pintadas (hardware de 4 GiB / Intel UHD 605).

## Límites y deuda técnica conocida

- La pintura está basada en vértices y en proximidad 3D mundial, no en una textura de máscara por texel. Geometría con pocos vértices puede verse demasiado suave o no responder en áreas pequeñas. **No se subdivide automáticamente**.
- Esta integración pinta un único conjunto de capas de color/albedo en el material PBR. Cada capa no tiene todavía conjuntos independientes de roughness/metallic/normal; se conserva la configuración global del material existente.
- El trazo se construye mediante eventos de puntero; mantener el cursor absolutamente inmóvil no incrementa indefinidamente el peso sin nuevos eventos.
- La vista previa circular usa proyección aproximada de radio: bajo perspectiva inclinada no representa un corte exacto de la esfera del pincel.
- No se ha verificado compilación GLSL real, calidad de la mezcla ni transición de texturas asíncronas en WebGL. No llamar a este Gate QA-CLOSED hasta la aceptación local.

**Exclusiones:** sin cambios al Runtime de Terrain, sin algoritmos de UV avanzados, sin pintura de texturas por texel, sin subdivisión automática y sin nuevos sistemas de materiales paralelos.
