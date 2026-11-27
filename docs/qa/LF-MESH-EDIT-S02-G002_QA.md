# LF-MESH-EDIT-S02-G002 — UV por esquina y atributos persistentes

**Autorización:** `Listo. LF-MESH-EDIT-S02-G002 autoriza comenzar`, 26-10-2026.
**Baseline inicial:** `LevelForge_MESH_EDIT_S02_G001_SOURCE_BASELINE.zip`, 760 archivos.
**Resultado:** IMPLEMENTADO y TEST AUTOMATIZADO PASS. **NO COMPILADO**, **QA LOCAL NO VERIFICADO** y **PENDIENTE DE ACEPTACIÓN**.

## [X] Implementación

- [X] Extiende `PolyMesh` para almacenar UV por **esquina de cara** (`uv[fi][ci]=[u,v]`), costuras (`seams`), colores RGB (`colors`) y pesos de 8 capas (`weights`); conserva compatibilidad de lectura con el formato anterior sin atributos.
- [X] Serialización, deserialización, clonado y validación estructural de atributos; números finitos, longitudes correctas y coste de almacenamiento opcional.
- [X] Buffers `uv` para Editor y Player, incluyendo duplicación de vértices visuales en costuras bajo sombreado suave, sin romper los índices geométricos usados para selección/colisión.
- [X] Atributos auxiliares `lfColor`, `lfWeights0`, `lfWeights1` **solo si existen**; no cambian el material PBR, la mezcla de Terrain ni habilitan Vertex Paint antes del próximo Gate.
- [X] Interfaz UV en Edit Mesh: vista de islas/caras en 2D, identificación de caras seleccionadas, arrastre para desplazar UV, proyecciones plana y tipo caja, rotar, escalar, marcar y limpiar costuras.
- [X] Herramientas UV utilizan el `EditSession.run()` y el commit/Undo/Redo actuales: una transacción por acción confirmada, ninguna escritura al cambiar de vista.
- [X] Reconciliación de atributos al reconstruir topología, con conservación exacta en caras que sobreviven y proyección/interpolación de respaldo para caras nuevas. Incluye casos verificados de Subdivide, Extrude Individual, inversión de caras, unión de mallas y eliminación/reindexación de vértices.
- [X] Mallas antiguas conservan sus materiales; cuando faltan UV, se generan coordenadas planares de respaldo sin reescribir el proyecto al abrirlo.

## Limitaciones y riesgos reconocidos

- El **unwrap automático avanzado**, packer de islas, pinning, selección UV por esquina, edición de vértices UV individuales y algoritmo de islas basado en costuras están **fuera de G002**. Marcar una costura persiste el dato, pero NO ejecuta un desplegado complejo ni empaqueta islas automáticamente.
- La reconstrucción genérica de UV de caras laterales o topología irregular usa proyección espacial de respaldo. En subdivisiones, cortes complejos, merges con costuras, bisel de alto segmento o autointersecciones puede requerir reajuste manual UV. NO se acredita preservación visual perfecta en todas las operaciones geométricas posibles.
- Los atributos de pesos se guardan y se proporcionan al buffer como `lfWeights0` + `lfWeights1`. La mezcla de texturas y los pinceles por vértice corresponden a `LF-EDITOR-UX-S01-G005_EXT-002`.
- El panel UV muestra la cuadrícula y UV reales, pero **no dibuja todavía la imagen del Albedo como fondo**. El Albedo sí puede usar UV del material cuando corresponde. La vista previa texturizada del mapa UV requiere integración adicional y evaluación visual.
- La edición de UV por arrastre transforma las UV de las **caras** seleccionadas conjuntamente. Sin selección de caras, afecta a todas las caras visibles. No es todavía el editor por isla completo de Blender.
- En escenas con muchas caras, la vista SVG y su cálculo de rangos pueden tener un coste elevado: se debe medir en Linux de bajos recursos.

## [X] Pruebas automatizadas

- [X] `node --test scripts/test-mesh-edit-s02-g002.mjs`: 25 PASS / 0 FAIL (formato legado, costuras, atributos, buffers, UV básicas, subdivisión, extrusión, unión, copia, interpolación y validación).
- [X] Regresión secuencial de `scripts/test-*.mjs` excluyendo `test-starcat.mjs`: 1062 PASS / 0 FAIL / 18 SKIP (resultado previo a entrega, verificar en log).
- [X] Comprobación de sintaxis de módulos JavaScript modificados.
- [ ] `npm run build`: Vite no disponible en entorno de entrega; no se acredita compilación.

## [ ] QA local de aceptación

1. [ ] `node --test scripts/test-mesh-edit-s02-g002.mjs` seguido de `npm run build` y `npm run electron:dev` con `node_modules` local.
2. [ ] Abrir un `.lfproj` antiguo, comprobar mallas existentes, materiales Blockout y sombras sin cambios inesperados.
3. [ ] En Edit Mesh → UV, aplicar proyección plana y tipo caja, verificar distribución; mover UV arrastrando en SVG; rotar y escalar con valores numéricos.
4. [ ] Seleccionar una o más caras y confirmar que las otras no cambian; marcar y desmarcar aristas como costuras.
5. [ ] Aplicar UV distintas al mismo vértice en dos caras y verificar que las texturas no se cruzan por las costuras.
6. [ ] Ejecutar Subdivide, Extrude Individual, Inset, Loop Cut, Bevel, Merge/Weld, Split y Join; inspeccionar UV reales de las caras nuevas y los datos conservados.
7. [ ] Guardar, cerrar, reabrir; comprobar Undo/Redo de cada acción UV y persistencia tras exportar/importar `.levelpackage`.
8. [ ] Aplicar textura Albedo de mapeo UV y revisar en Editor y Player exportado. Comparar comportamiento con material métrico Blockout, que no requiere UV.
9. [ ] Evaluar rendimiento con malla de muchas caras y evitar pérdida de FPS o bloqueos del panel UV.

**Condición de cierre:** el usuario debe acreditar build y QA visual sobre su instalación. G005_EXT-002 no se encuentra implementado por este Gate.
