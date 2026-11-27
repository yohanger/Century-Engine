# Century — propiedades editables de Scripts de Nodo

**Gate autorizado:** `CENTURY-EDITOR-SCRIPT-S01-G001-EDITABLE-DECORATORS-AND-INSPECTOR-PROPERTIES`.
**Estado:** implementado en fuentes; QA automatizado específico PASS; build / QA visual Electron / Player independiente NO VERIFICADOS; aprobación del usuario PENDIENTE; NO CERRADO.

## Sintaxis admitida

Las directivas deben escribirse en líneas propias, antes de variables de nivel superior con un inicializador literal de número finito, texto o booleano. Los tipos admitidos en esta primera integración son `number`, `string` y `boolean`, no arreglos, objetos o expresiones dinámicas. Cada línea debe declarar una sola variable.

```js
@header("Movimiento")
@header_descripcion("Parámetros del personaje")
@editable_descricption("Velocidad de desplazamiento")
@editable
let velocidad = 5;

@editable_description("Permite correr")
@editable
let puedeCorrer = true;

function _ready() {
  console.log(velocidad, puedeCorrer);
}
```

`@editable_descricption` conserva la ortografía solicitada, con `@editable_description` como alias. No son decoradores JS nativos; Century los reconoce estáticamente y transforma **solo la copia de ejecución**. El código fuente de `store.project.scripts` se preserva. Un decorador mal formado o una declaración no admitida se informa en el Inspector y bloquea la evaluación de ese slot (sin impedir los scripts válidos restantes).

## Integración

- `src/engine/runtime/scene/script-editables.js`: analizador léxico limitado a nivel superior; rechaza declaraciones incompatibles, no evalúa scripts para descubrir campos, entrega metadatos y crea la copia ejecutable.
- `src/engine/runtime/scene/node-scripts.js`: introduce los valores tipados durante la creación de cada slot, antes de `_enter_tree` y `_ready`, reutilizando el runtime de Multiscript.
- `src/components/Inspector.vue`: renderiza encabezados, descripciones, cajas numéricas, campos de texto y casillas booleanas debajo del recurso de script asignado.
- `src/core/state/objects.js`: confirma ediciones mediante `updateObject`, con dirty e historial existentes, y evita ediciones en Play.
- `src/core/editor/jsintel.js` y `src/components/ScriptEditor.vue`: análisis sintáctico tolerante a las directivas y formateo que las preserva en CodeMirror. VS Code externo continúa abriendo el `.js` original: su soporte específico para anotaciones no estándar no ha sido acreditado.
- `src/core/levelpackage-import.js`: remapea las claves de script por ID en `scriptProperties` sin reescribir el contenido de los valores de texto.

Los valores editados residen en `node.scriptProperties[scriptId][variableName]`; no se agregan al script compartido ni a `node.props`. Su persistencia en escenas y Prefabs utiliza la serialización completa de objetos ya existente; no exige migración de escenas previas. El resto de campos de scripts se conserva aunque el recurso sea retirado, para evitar pérdida de datos por operaciones temporales.

## Limitaciones por verificar

Compilación con Vite, montaje visual del Inspector, compatibilidad específica de VS Code, cierre del ciclo de guardado/reapertura, Undo/Redo real, Prefabs vinculados y Player independiente requieren QA en entorno operativo. No se interpreta Node PASS como evidencia de esas operaciones.
