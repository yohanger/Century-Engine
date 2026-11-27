# CE-TH-CA-001-INDEPENDENT-TRIANGHOR-CONSUMER-AUTHORITY

**Estado:** RATIFICADO por el usuario. **Gate:** `CENTURY-TRIANGHOR-INTEGRATION-S01-G001-INTEGRAL-INDEPENDENT-LIBRARY-REPLACEMENT`. **Madurez:** integración pre-1.0, no implica cierre ni aprobación del QA.

## Autoridad

- **TriangHor v0.0.1** es la única autoridad del algoritmo de simplificación adaptativa, triangulación, generación de índices, funciones de cálculo espacial, cálculo incremental y protocolo Worker.
- **Century Engine** es responsable de datos de autoría Terrain, alturas, pintura, escenas, colisiones, persistencia, ClusterMeshes, LOD, renderizado, sombras, viewmodes, progreso, Undo/Redo, publicación y recuperación.
- El puente entre ambos usa únicamente exports públicos del paquete `trianghor` y `trianghor/worker`, registrados en su `package.json`; ningún archivo interno del paquete se importa desde código de producción de Century.

## Distribución y versión reproducible

Se incorpora la dependencia local `trianghor: file:vendor/trianghor` al `package.json` y lockfile de Century. El directorio es una copia vendorizada inmutable de `src/` de TriangHor S07 y su `package.json` público, **no otro algoritmo mantenido por Century**. Para instalar o compilar Century en otra máquina se requiere instalar sus dependencias npm habituales; el paquete local no requiere red adicional.

Los contratos públicos originales están en `vendor/trianghor/docs/PUBLIC_API.md`. La fuente de autoridad para evoluciones posteriores sigue siendo el repositorio independiente TriangHor. Actualizar la copia local requiere un Gate y una comparación de versión, API y paridad.

## Forma de datos

Entrada para el Worker: copia de `Float32Array` de alturas y `Uint8Array` de pintura de 8 canales, dimensiones `segments`, `segmentsZ` y tolerancias `heightError`/`paintError`. Los buffers de autoría nunca son transferidos. Salida: índice `Uint32Array` o `null` (sin reducción), total de triángulos y métricas de calidad. Century rechaza planos incompatibles, rangos inválidos y versiones obsoletas antes de publicar. Un error de cálculo no debe reemplazar el estado de autoría ni el índice anterior por otro incompatible; los consumidores usan la ruta fuente cuando corresponde.

## Worker y recuperación

El adaptador `worker-client.js` importa el Worker **desde la entrada pública** `trianghor/worker?worker&inline` para Vite; `worker-service.js` utiliza la API incremental pública con una sola instancia residente y 16 MiB máximos de caché incremental, y utiliza `requestTriangHorBake` en caso de simultaneidad o necesidad de progreso. La sesión se libera al destruir Terrain. Abort, fallo de creación o resultado inválido invalidan el cliente y evitan entregar resultados obsoletos.

Los consumidores Editor, ClusterMeshes y LodManager mantienen sus contratos de revisión, versionado, cancelación y commit. Los wrappers antiguos son solo reexportaciones de compatibilidad para consumidores históricos: no contienen un simplificador paralelo. Los shaders de diagnóstico siguen perteneciendo a Century.

## Compatibilidad y restricciones

- Escenas previas: `terrainBake` y ajustes existentes preservados; sin migraciones obligatorias.
- La optimización no modifica alturas, materiales, pintura, colisiones ni la autoría.
- Sin cambios a edición de mallas, Substract, `setPointerCapture`, Gizmos, Player propio ni algoritmos ajenos.
- Biblioteca TriangHor S07 aún sin QA real de navegador acreditado; ratificar este Amendment no lo convierte en aprobado ni cierra ese proyecto.

## QA y política de cierre

Pruebas Node en Century y en la biblioteca, paridad de índices, Worker real Node, cancelación, rechazo de resultados inválidos, recuperación y smoke con comparación al SOURCE_BASELINE. El build Editor/Player y QA real Electron/WebGL quedan separados; **no son PASS sin evidencia**. La aprobación y cierre de este Gate requieren validación expresa posterior del usuario.
