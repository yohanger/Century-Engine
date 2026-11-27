# LF-NODE-SCRIPT-METHOD-CALL-S02-G001 — Contrato técnico

**Autorización exacta recibida:** `Listo. LF-NODE-SCRIPT-METHOD-CALL-S02-G001 autoriza comenzar`.

**Baseline vinculante:** `LevelForge_NODE_REFERENCE_RESOLUTION_S01_G001_SOURCE_BASELINE.zip`; no se fusionó con Terrain Extents. S01 está aprobado por usuario, sin evidencia de QA local Electron/Player ni cierre formal.

**Estado S02:** AUTORIZADO · IMPLEMENTADO · NODE FOCAL PASS · QA ELECTRON/BUILD/PLAYER LOCAL PENDIENTE · NO CERRADO.

## Objetivo y APIs

La instancia ya existente `NodeScriptRuntime` conserva la propiedad exclusiva de un Script de Nodo. Se permiten llamadas directas entre sus instancias, sin `game.define`, sin señales globales y sin segundo intérprete.

- `node.expose(nombre: string, fn: Function): void`: disponible **solo** en el handle que recibe el Script de Nodo como argumento `node`. Publica una función en la instancia activa de ese nodo; no se exportan variables privadas ni todas las funciones del cierre. Nombre de cadena no vacía, sin espacios sobrantes y no reservado `_enter_tree`, `_ready`, `_process`, `_physics_process`, `_exit_tree`. Duplicados se rechazan (no hay sobrescritura silenciosa). Requiere función.
- `referencia.call(nombre: string, ...args): unknown`: disponible en cualquier `NodeHandle`, incluidas referencias de `game.node()` y `get_node()`. Valida primero la referencia de S01. Solo ejecuta métodos publicados por la instancia actual. La función se invoca con `this` igual al handle del Script propietario y los argumentos tal como se reciben. Retorno síncrono se preserva; una Promise se devuelve sin esperarla ni capturar su rechazo. Las excepciones síncronas se propagan al llamador.

Ejemplo de dos Scripts de Nodo (cada bloque es el contenido de un recurso JS propio):

```js
// Script de Nodo de Puerta
let abierta = false
node.expose('abrir', function () { abierta = true; return abierta })
```

```js
// Script de Nodo de Interruptor
function _ready() {
  const puerta = game.node('Puerta')
  if (puerta?.is_valid()) puerta.call('abrir')
}
```

## Identidad, salida, acceso y orden

- La tabla `instances` ya existente, indexada por ID, **verifica también identidad de registro original**, `scriptId`, `active`, `exiting` y validez de S01 antes de una llamada. El ID reciclado no habilita métodos del script antiguo.
- `NodeLifecycle.sync()` detecta sustitución de objeto lógico aunque se mantengan ID, tipo, parentId y scriptId. Desmonta primero la instancia anterior, libera sus métodos y monta la nueva; `_ready` se ejecuta nuevamente. Reparentar causa salida/reentrada, como ya definía Lifecycle, pero el handle S01 permanece válido al mantenerse el registro.
- `NodeScriptRuntime.enter()` registra la instancia **antes de evaluar el cuerpo** para que `node.expose()` funcione al iniciar el script. En error de evaluación elimina métodos, suscripciones y registro incompleto.
- En la salida se marca `exiting` antes de `_exit_tree`: el callback conserva su ejecución, pero `node.expose` y las llamadas al método de esa instancia fallan. Se conserva la limpieza automática de `game.on/once/waitFor`.
- Los scripts se evalúan una vez por instancia y se ejecutan por su propio cierre. No se añade escaneo por fotograma, contador global, registro paralelo, despachador de métodos ni cambios al proceso `_process/_physics_process`.
- Una llamada ya iniciada no se cancela retroactivamente al eliminar el nodo. Si el método devolvió Promise, el llamador administra su `await` o `.catch()`. Los errores del callback de ciclo de vida siguen reportándose por `game.report`, pero los errores de métodos públicos se propagan al llamador sin registrarse doblemente.

## Errores

`Referencia de nodo inválida: ID` si el handle S01 caducó. `Script de nodo no disponible: ID` si el nodo no tiene una instancia activa apta. `Método público no encontrado: ID.nombre` si el método no fue publicado. Rechazo explícito de nombre inválido, reservado, duplicado o función no válida en `expose`.

## Exclusiones y límites

No se incluye `call_group`, Custom Signals, Area3D signals, Signals Dock visual, Inspector, consola de scripts ni cambios a Game Interpreter. `object3D` guardado directamente sigue sujeto al límite de S01. El acceso a `node.expose` es una facultad del handle propietario de la instancia; si un script comparte deliberadamente ese mismo objeto con un tercero, la API no establece aislamiento de capacidades contra dicho préstamo explícito. No se ofrecen métodos remotos para modificar variables arbitrarias sin publicación.

## Aceptación

Pruebas Node focales, regresiones de S01/S05/Lifecycle y revisión de la expectativa histórica NS-13; Electron embebido con WebGL real; compilación Editor/Player; QA local de escenas, Prefabs, sustitución de Script de Nodo, reparentado, errores y Stop/Play. No declarar QA LOCAL PASS ni CERRADO sin evidencia y aprobación.
