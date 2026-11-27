# Century — Integridad de límites durante el horneado de oclusión

**Gate autorizado:** `CENTURY-EDITOR-S01-G001-CORR-001-OCCLUSION-BAKE-BOUNDS-INTEGRITY`.

**Contrato base:** `CENTURY-EDITOR-S01-G001-MULTI-INSPECTOR-AND-UNIVERSAL-STATIC-MESH-OCCLUSION`. La corrección mantiene la autoridad de Century sobre el horneado y el alcance de mallas estáticas editadas.

## Causa acreditada

El SOURCE_BASELINE del Gate de oclusión universal llama desde `worldBounds()` a `boundsChecks.get(geometry)` y a `versionOf(position)`, pero ambas definiciones quedaron fuera del archivo `occlusion-static.js` al reemplazar el reconocimiento de cajas primitivas por un flujo universal. Un horneado que contenga una malla estática llega a `worldBounds()` desde `sceneOcclusionInputs()` y lanza `ReferenceError: boundsChecks is not defined`; la segunda referencia también quedaba sin definir.

La batería dirigida nueva reproduce **8/8 fallos sobre el SOURCE_BASELINE**, todos provocados por la primera referencia faltante. No se atribuye el problema a drivers, GPU, materiales, TriangHor o al Inspector.

## Mecanismo de corrección

- Se recupera el `WeakMap` de límites por identidad de `BufferGeometry` y `versionOf` para distinguir cambios de atributos de posición, incluido el versionado de datos intercalados.
- Se conserva la caché normal para el renderizado y la consulta de cámara; se invalidará ante un atributo de posición nuevo o cambio de versión.
- La recopilación de un nuevo horneado utiliza `worldBounds(mesh, meshBounds, true)` para **actualizar siempre los límites desde los vértices actuales**, incluso si una edición directa del buffer no incrementó `attribute.version`. El recálculo forzado se limita a la recopilación del horneado, no se aplica a cada fotograma.
- Se preservan los límites en espacio local con transformación mundial al entregar cada caja y se utilizan los filtros existentes de geometría vacía o no finita.
- El pipeline de superficies conservadoras, la versión del horneado, la detección de cambios por firma, los Workers y los consumidores quedan sin modificar.

## Alcance y compatibilidad

Solo cambian `occlusion-static.js` y `occlusion-bake.js` en código de producción; se añade una suite dirigida que ejecuta `worldBounds`, `sceneOcclusionInputs` y `bakeStaticOcclusion` con dobles de datos y renderizador. No se imponen restricciones de forma: las mallas editadas siguen permitidas. Se conserva el contrato de persistencia pre-1.0 y los archivos anteriores, sin migración obligatoria.

## Validación pendiente

Las pruebas de control y el renderizador simulado no sustituyen un horneado GPU real. La compilación Vite y las pruebas Three.js/WebGL2/Electron no pudieron ejecutarse en este entorno por ausencia de dependencias. El Gate permanece **implementado y probado en Node, pendiente de QA local, aprobación y cierre**.
