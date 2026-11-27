# Century Engine — Substract editable como volumen CSG

**Gate:** `CENTURY-EDITOR-MESH-S01-G001-CORR-009-EDITABLE-CSG-SUBTRACT`

## Fuentes y autoridad

- Se parte de `CENTURY-EDITOR-MESH-S01-G001-CORR-008-MESH-TOPOLOGY-CLEANUP_SOURCE_BASELINE.zip`, sin migración obligatoria.
- El nodo sigue siendo `type: subtract`. Su geometría CSG no se convierte a una malla receptora ni adquiere colisión propia.
- Los contratos y la arquitectura vigentes mantienen autoridad. No se modifica el funcionamiento de Edit Mesh en primitivas y mallas normales.

## Modelo y mecanismo

- `src/engine/runtime/mesh/subtract-edit.js` concentra conversión inicial y validación geométrica. Caja, Cilindro y Escalera crean un `PolyMesh` editable. Se conservan transformaciones del nodo: el volumen se guarda en coordenadas locales y la escala se aplica una sola vez en el nodo.
- `props.mesh` almacena la geometría personalizada del mismo `subtract`, con el formato existente de PolyMesh. No se crea formato paralelo ni recurso duplicado. Si no existe, el CSG sigue generando las formas predefinidas originales.
- `EditSession` admite `subtract` y utiliza `meshDataOf/writeMesh` y el historial existentes. Se valida que el cortador final sea cerrado, finito, con caras triangulables, orientación consistente y volumen positivo, antes de sobrescribir la última geometría válida.
- La extrusión modal necesita un estado temporal con caras de área cero hasta desplazar la selección. Ese estado no se persiste; al confirmar se valida el volumen final y se registra una única operación. Cancelar restaura el origen sin crear Undo ficticio.
- El Inspector y la barra de herramientas permiten entrar a Edit Mesh desde Substract. El Inspector conserva las formas predefinidas y permite restaurarlas explícitamente tras confirmación, anulando solo `props.mesh`.
- Tanto el volumen visible como el BSP de `scene/brushes.js` consumen el mismo `props.mesh`. La firma existente de recortes incluye la revisión `mesh.rev`, para recalcular los resultados cuando cambia el cortador. Se reutiliza la geometría visible cuando se conoce que corresponde a esa misma fuente; las geometrías temporales se liberan según propiedad.
- `src/core/mesh/session.js` mantiene sincronizada la propiedad de la geometría editable visible al reconstruirla.
- Editor y Player utilizan el CSG del mismo motor; los consumidores existentes de físicas reciben la geometría recortada del receptor y Substract sigue sin cuerpo de colisión propio.
- Las pistas existentes de `subtract.kind` se conservan. Mientras haya `props.mesh` personalizado este tiene prioridad visual/CSG. Restaurar forma predefinida vuelve a habilitar el comportamiento de tipos anteriores.

## Límites y protección

- No se sueldan automáticamente mallas abiertas, caras autointersectadas o cortes incompatibles; se rechazan los defectos detectables por validador. No se ha acreditado un verificador completo de autointersecciones o validez BSP para todo volumen arbitrario.
- Los estados transitorios de operaciones modales no se guardan como volumen definitivo. Las operaciones que dejan el volumen abierto se rechazan y no sustituyen la última fuente válida.
- No hay migración forzosa de escenas anteriores. Tampoco se convierten Substract en nodos `mesh` ni se implementa otro motor de booleanos.
- No se modifica `setPointerCapture`, controles de puntero, fuentes Git ni funcionalidades ajenas.

## QA y estado

Implementado en fuentes; 19/19 pruebas nuevas y runner dirigido 69/69 PASS. Regresión general: 406 PASS y 56 FAIL frente a baseline 392 PASS y 70 FAIL: ningún fallo nuevo por nombre; 14 fallos de harness CSG corregidos al integrar su utilidad con los consumidores actuales. Smoke: 29/30 con fallo también presente en la base. Build bloqueada por falta de `vite`. **QA visual Electron/Player y aprobación/cierre no verificados.**
