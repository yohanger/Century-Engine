# LF-NODE-REFERENCE-RESOLUTION-S01-G001 — Contrato técnico

**Gate autorizado literalmente por el usuario:** `Listo. LF-NODE-REFERENCE-RESOLUTION-S01-G001 autoriza comenzar`.
**Fuente vinculante:** `LevelForge_NODE_REFERENCES_SIGNALS_AUDIT_G001_SOURCE_BASELINE.zip` (recibido con sufijo `(1)`); auditoría precedente G001; NodeScript S05, NodeLifecycle CORR, Groups S03 y Player existente.
**Estado:** AUTORIZADO · IMPLEMENTADO · QA LOCAL PENDIENTE · NO CERRADO.

## Objetivo y mecanismo

Sin ECS, segundo árbol, intérprete ni event bus. `game.node(id|nombre|ruta absoluta)` y los handles de Scripts de Nodo reutilizan `PlayMode._nodeHandle`. `get_node(path)` usa la misma resolución de `project.objects`/`parentId` en `resolveNodePath`. Las raíces se representan por `parentId` null; `/Raiz/Hijo` comienza en un objeto raíz real. Los segmentos admiten `.` y `..` sin sobrepasar la raíz, y comparan nombres de forma exacta. La búsqueda global por nombre mantiene el primer resultado en orden del array sin distinguir mayúsculas; el ID exacto tiene prioridad. `game.node` devuelve `undefined` y `get_node` `null` si no hay destino.

La validez del handle depende de la sesión Play en la que se obtuvo, del registro **original** de objeto que permanece en `project.objects`, y de que su ID tenga un `Object3D` montado. `is_valid()` no arroja; `id` conserva el identificador y `name` refleja el registro original. Los accesos operativos a referencias inválidas lanzan `Error('Referencia de nodo inválida: ID')`. Renombrar o cambiar `parentId` en el **mismo registro** conserva identidad. Reemplazar solo `Object3D` del mismo registro no la invalida: los accesos consultan la instancia montada actual. Un registro distinto con el mismo ID no reactiva un handle anterior. Stop/Play utiliza otro token de sesión.

Los métodos y getters delegados a Groups y animaciones quedan protegidos; también `dontDestroyOnLoad`, `held`, luces y `move`. Los fundidos de luces tienen su caché por **objeto lógico**, no por ID. Los movimientos y fundidos de la escena desmontada se resuelven y se descartan; los tweens revisan su validez antes de manipular el objeto. Los nodos retenidos mediante `dontDestroyOnLoad` conservan el mismo registro lógico al cambiar de escena.

**Límites expresos:** `object3D` es un getter actualizado, pero no revoca referencias directas de Three.js guardadas por el usuario. Un mismo objeto JavaScript retirado y reinsertado sin consultar ningún handle entre ambas acciones no es distinguible de una transferencia persistente: la destrucción/recreación con reutilización de ID se verifica para registros nuevos. No se promete una garantía más amplia sin puntos de invalidación de lifecycle autorizados. SceneGraph marca el registro propietario sobre el Object3D raíz como propiedad privada no serializada; la validación normal es O(1). Los hosts mínimos de test sin marca usan una comprobación de pertenencia al array, sin escaneos periódicos agregados. La búsqueda global por nombre sigue siendo ambigua si hay duplicados.

## Alcance y exclusiones

Solo resolución, vigencia, delegados, tweens, luces, tipo de API, referencia generada, documentación, pruebas y ledger. Se excluyen métodos personalizados entre scripts, `call_group`, Custom Signals, Area3D bridge, editor Signals y consola de scripts. No se altera la serialización de escenas, el despacho periódico de Lifecycle ni Jolt. El código de negocio del intérprete global queda intacto.

## Aceptación

Pruebas Node y regresión; Electron embebido con WebGL2 real y NodeScriptRuntime; compilación y QA local de Play/Stop, persistencia, escena y Player; aprobación expresa del usuario. Ningún resultado Node sustituye la evidencia local.
