# Evidencia QA — materiales de modelos importados

## Resultados ejecutados
- Baseline: 3.848 archivos cotejados byte a byte con `CENTURY_EDITOR_SELECTION_S01_G001_SOURCE_BASELINE.zip`; sin diferencias. Cambios externos al archivo no verificables. Gates previos conservan sus estados de aprobación.
- `node --test scripts/test-imported-model-materials.mjs`: 17/17 PASS. Pruebas de parser OBJ/MTL, rutas de Assets, slots, estado serializable y resolución de mapas con dobles de prueba; no acreditan render real.
- `node --test scripts/test-material-ux-s01-g001.mjs scripts/test-material-surface-detail-s01-g001.mjs scripts/test-road-material-s01-g001.mjs scripts/test-road-material-s02-g001.mjs`: 54 PASS, 2 FAIL, idéntico al baseline. Los dos runners road fallan al evaluar un `export default` en VM (fallo preexistente). No se cambiaron los runners.
- `node --check`: sintaxis JS/MJS modificados PASS.
- `npm run build`: exit 127, `vite: not found`; no compilación acreditada.

## QA local requerido
1. Reabrir el proyecto con el nuevo editor para recargar el OBJ. Importar una imagen en Assets, seleccionar el nodo modelo, abrir Materiales, slot y Texturas UV. Arrastrar la imagen a Textura Albedo o seleccionarla en el desplegable. Confirmar UV y orientación correctas.
2. Importar OBJ + MTL + imágenes en la misma operación. Verificar dos `usemtl`, mapa de color, normales/relieve y materiales sin mapas. Probar un OBJ sin UV: aviso y ausencia de UV inventadas.
3. Probar GLB/GLTF autocontenidos, dos instancias, dos slots y un recurso compartido `.material`. Verificar cambios de un slot, edición compartida, restauración del original, Undo/Redo, duplicado, Prefab, guardado y reapertura.
4. Ejecutar el Player exportado con los mismos modelos y comparar render; medir coste GPU y memoria. Comprobar compilación Vue y Electron.

## Límites
No se acredita compatibilidad integral con todas las variantes MTL: se reconocen los campos de color, opacidad, brillo, rugosidad, metal y mapas señalados en el parser. Los parámetros avanzados de transformación de mapas no se aplican; `map_Ka` se interpreta como AO aproximada. Importar dependencias MTL después del OBJ requiere recargar el proyecto. Los GLTF con dependencias externas mantienen las restricciones del importador anterior. No se modificó el exportador Godot. Los cambios de material sustituyen explícitamente el slot original; restaurar original devuelve sus materiales embebidos. Sin UV no se genera un unwrap. No se acredita benchmark de memoria ni de FPS.

**Estado:** implementación parcial en fuentes, QA Node específico PASS, build/QA Electron/Player/benchmarks NO VERIFICADOS; no aprobado, no cerrado.
