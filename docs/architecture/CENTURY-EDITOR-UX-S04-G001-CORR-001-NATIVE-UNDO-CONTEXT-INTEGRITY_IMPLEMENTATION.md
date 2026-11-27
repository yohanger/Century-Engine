# Integridad de Undo/Redo con registros persistentes de malla

Gate ratificado y autorizado literalmente. Base inmediata: `CENTURY_EDITOR_UX_S04_G001_SOURCE_BASELINE.zip` (4.034 archivos), CRC íntegro y coincidencia byte por byte con la copia de trabajo anterior disponible. El árbol local del usuario no es accesible. No hay enmienda adicional: se preservan los contratos del historial editorial y del estado de sesión. Los Gates pendientes conservan su estado.

## Causa reproducida

`PolyMesh.toJSON()` devuelve `v` como secuencia plana XYZ, y `meshDataOf()` entrega esa representación persistente (local o vinculada). `validateHistoryEdit()` utilizaba `finiteMesh()`, cuyo contrato exige una lista de tripletas de vértices en memoria. Un registro válido no vacío era rechazado antes de aplicar la entrada histórica. El dispatcher convertía esa excepción en una notificación y la assertion Electron no discriminaba la condición que fallaba. La prueba original usaba tripletas simuladas, por lo que no detectaba esa incompatibilidad. El mismo preflight reproduce el rechazo con `PolyMesh.toJSON()` real; la reproducción nativa exacta sigue pendiente.

## Implementación

- Incorporar `finiteMeshRecord()` al módulo numérico existente: validar secuencia XYZ plana completa, números finitos representables en Float32, y UV. No convertir ni normalizar el registro. Se comparte la comprobación UV con la validación de malla en memoria; los arrays UV dispersos también se rechazan. No se modifica el formato de persistencia ni se imponen migraciones.
- `validateHistoryEdit()` utiliza el validador de registro persistente. Se conservan las restricciones de jerarquía, sesión modal, historial, mallas vinculadas, datos inválidos y conversiones incompatibles. No se reemplaza el dispatcher, la cámara, el historial ni la navegación.
- El harness focal genera registros reales con `PolyMesh.toJSON()` y conserva las doce pruebas anteriores. Se añaden casos de representación, datos inválidos, recurso vinculado, rechazo sin consumo de historial y enrutamiento mediante el handler productivo con colaboradores simulados.
- El fixture conserva las 23 comprobaciones originales; añade 11 verificaciones independientes en cada una de las cinco teclas (78 totales). Registra evento nativo, consumo del atajo, sesión, modo, Local View, selección, cámara, vértice en memoria y persistido y notificaciones. Las condiciones se registran antes de fallar el lote; los errores esperados del bloqueo de conversión se distinguen de los errores inesperados. Se mantiene el runner existente y sus límites temporales.
- No se modifican preferencias del ratón, TOML, componentes Vue, geometría ni runtime del Player. No se agregan dependencias.
