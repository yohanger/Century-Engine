# Implementación — materiales de modelos importados

- `objconv.js` conserva UV por esquina e índice, incluidos índices negativos y costuras. `mtl.js` lee referencias y propiedades MTL y resuelve solo Assets del proyecto.
- `models.js` construye grupos Three y materiales originales por `usemtl`. El flujo de importación ordena OBJ después de sus recursos auxiliares dentro de la misma operación. SceneGraph recibe metadatos explícitos al abrir un proyecto.
- `model.js` mantiene los materiales fuente compartidos hasta crear un override en `props.modelMaterials`. Los materiales físicos de override pertenecen a cada instancia. Eliminar/restaurar libera el material propio; las texturas se reutilizan por ID, espacio de color y orientación UV.
- `ModelMaterialSection.vue` adapta el slot al `MaterialSection.vue` existente. Los mapas nativos se serializan dentro de `mat.maps`, y el recurso compartido sigue usando la resolución de material existente. Selección y drag and drop usan `ResourceDropSlot`.
- Guardado y Undo/Redo emplean `updateObject` y `props` existentes. La referencia de recurso compartido se contempla en edición, desvinculación y detección de uso en otras escenas. Los objetos sin override no se migran.
- Véase `docs/qa/CENTURY-ENGINE-MATERIALS-S01-G001_QA.md` para los resultados y límites. No se declara implementación integral ni QA visual sin evidencia.
