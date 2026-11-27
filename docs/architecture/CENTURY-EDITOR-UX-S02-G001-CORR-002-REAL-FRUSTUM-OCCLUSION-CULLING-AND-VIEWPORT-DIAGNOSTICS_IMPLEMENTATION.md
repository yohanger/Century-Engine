# CENTURY-EDITOR-UX-S02-G001-CORR-002 — Frustum y Occlusion Culling en Edit Mode

## Autoridad y fuente

- Autorización literal: `Listo. CENTURY-EDITOR-UX-S02-G001-CORR-002-REAL-FRUSTUM-OCCLUSION-CULLING-AND-VIEWPORT-DIAGNOSTICS autoriza comenzar`.
- Amendment conservado: `CE-EDITOR-UX-CA-001-EDIT-PLAY-INDEPENDENT-AUTHORITY-AND-DOCKING`.
- SOURCE_BASELINE: entrega CORR-001. Coincidencia SHA-256 de los 3276 archivos declarados en ese ZIP con la copia antes de modificar: **0 diferencias**. `node_modules` contiene directorios vacíos no incluidos en la entrega.
- Proyecto de referencia: `the_room.zip`, examinado sin alterar ni incorporar sus archivos al motor. `project.lfproj` contiene un ZIP interno con `project.json` y `Assets/Scenes/Only Develop.scene.json`.

## Cambios realizados

1. **Interfaz:** controles independientes `Occlusion Culling` y `Frustum` abajo a la izquierda en el observador de Edit Mode, inicialmente desactivados. Se retiran el panel superior, los cuadros azules/naranja y el `CameraHelper`. Los resultados resumidos se muestran únicamente al activar cada control.
2. **Frustum:** el adaptador `observer-visibility.js` construye `THREE.Frustum` a partir de `PlayMode.cam`. Identifica drawables del mundo que no intersectan ese volumen, respetando capas y omitiendo helpers. Durante la pasada del observador los oculta temporalmente; `finally` restaura los estados sin tocar los datos de autoría.
3. **Oclusión:** el observador llama al `CameraOcclusion.draw()` existente con `PlayMode.cam` y usa su máscara real para el descarte; no introduce otro algoritmo de oclusión. El recuento distingue únicamente drawables de la máscara que intersectan el frustum del jugador y evita duplicados. Cuando la oclusión está desactivada, no hay bake, el jugador sale de la cuadrícula o el modo es incompatible, se informa del motivo, en lugar de presentar un cero.
4. **Diagnóstico de celdas:** la consulta nativa informa además la cantidad de pares horneados en la celda activa y la cantidad de mallas oclusoras validadas. Así se distingue una celda sin pares de una celda con pares pero sin oclusores actualmente válidos. La geometría modificada después del bake sigue invalidando las máscaras, conforme al contrato existente.
5. **Sombras:** el renderer de Edit Mode restaura temporalmente las mallas descartadas para su pasada de sombras, mediante la capacidad `CameraOcclusion.withShadows()` y la máscara del frustum. Play Mode conserva su renderer, cámara, visibilidad y configuración.

Los controles no habilitan por sí solos la opción persistida `staticOcclusion`, no hornean y no modifican `visible` persistente. Si la escena no tiene bake válido, no se simulan descartes detrás de obstáculos.

## Evidencia concreta del proyecto The Room

- `project.json`: `render.staticOcclusion = true`.
- `Only Develop.scene.json`: bake versión 2, cuadrícula de 720 celdas, 201 celdas con pares; 306 pares horneados en total, 9 referencias de mallas y 227 parches oclusores registrados.
- La escena contiene 66 nodos; siete nodos de datos están marcados como estáticos explícitamente.
- Estos valores acreditan la existencia de datos horneados; **no** acreditan descartes en la posición concreta de la captura ni validan la firma de cada malla al ejecutar. Un contador de 0 no prueba que no existan objetos visualmente tapados: puede corresponder a una celda sin pares, oclusores invalidados, objetivos no elegibles o ausencia de descartes válidos en el frustum actual.

## Restricciones y pruebas pendientes

- `THREE.Frustum.intersectsObject()` opera por volumen del drawable; no reproduce diagnósticos GPU por fragmento ni métricas de páginas individuales de ClusterMeshes/BatchedMesh. La fuente del recuento de oclusión es exclusivamente `CameraOcclusion.masked`.
- Los ensayos aislados Node usan sustitutos de las clases matemáticas de Three porque la dependencia real no está instalada. No acreditan GPU, compilación Vue ni render visual.
- `Edit Mesh`, pintura y la separación transaccional completa de cambios editoriales y estado físico de Play son pendientes heredados de CORR-001 y permanecen fuera de esta corrección.
- Se requiere compilación Vite, QA en Electron y prueba con la escena real en el equipo objetivo antes de aprobar/cerrar el Gate.

## Estado

**IMPLEMENTADO EN FUENTE · TEST NODE AISLADO PASS · NO COMPILADO · QA ELECTRON/GPU NO VERIFICADO · NO APROBADO · NO CERRADO**.
