# Materiales de modelos importados

Gate ratificado y autorizado por el usuario: `CENTURY-ENGINE-MATERIALS-S01-G001-IMPORTED-MODEL-MATERIAL-AND-TEXTURE-SUPPORT`.

- OBJ conserva UV por esquina, normales, grupos de material y referencias MTL. Los MTL y texturas se resuelven exclusivamente desde Assets; no se solicita acceso a archivos externos. Si faltan, el modelo sigue siendo utilizable y admite asignación manual. No hay migración obligatoria.
- Los slots se identifican por el orden determinista de materiales del modelo cargado. El material original es la autoridad hasta que se crea un override explícito. Los overrides serializables viven en `props.modelMaterials` por nodo y slot; el recurso `.material` mantiene su autoridad si está asignado.
- Se reutiliza MaterialSection, ResourceDropSlot, el historial y la caché PBR. Los mapas UV nativos son albedo, normal, rugosidad, metálico, AO y emisión. Las instancias no mutan los materiales de origen; se liberan únicamente los materiales propios.
- Editor y Player consumen el mismo SceneGraph. QA específico de geometría/MTL, slots y recursos; QA visual, compilación y coste GPU se acreditan por separado.
- Baseline: entrega acumulativa de selección jerárquica, 3848 archivos coincidentes con su copia de trabajo. No se presume la aprobación de los Gates anteriores ni se verifican cambios locales fuera del ZIP.
