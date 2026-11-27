# Scripts por nodo

Crea un recurso **Script de Nodo** desde **Assets → Crear → Script de Nodo (.js)**. El recurso aparece en Assets con el nombre editable; primero asígnale un nombre. Haz doble clic en el archivo para abrirlo en el editor de código integrado.

Para asignarlo, selecciona el nodo en el árbol. En **Scripts** del Inspector puedes agregar recursos desde el selector o arrastrarlos desde Assets. Cada nodo admite varios Scripts de Nodo y el Inspector permite reordenarlos, abrirlos en el editor integrado y quitar asignaciones conservando los recursos. Los scripts Global se ejecutan por su propia vía.

El script nuevo comienza con `_ready`, `_process` y `_physics_process` vacíos. Los demás callbacks siguen disponibles aunque no aparezcan en la plantilla.

## Ciclo de vida

| Callback | Momento |
|---|---|
| `_enter_tree()` | Nodo agregado a la escena activa; padre antes que hijo |
| `_ready()` | Inicialización; hijos antes que padre |
| `_process(delta)` | Actualización normal del juego |
| `_physics_process(delta)` | Paso físico fijo, antes de Jolt |
| `_exit_tree()` | Nodo retirado, escena cambiada o Play detenido |

```js
let segundos = 0

function _ready() {
  console.log('Nodo:', node.name)
}

function _process(delta) {
  segundos += delta
}

function _exit_tree() {
  console.log('Desmontado:', node.name)
}
```

## Navegación por el árbol

`node.parent`, `node.children` y `node.get_node(path)` consultan la jerarquía. Las rutas relativas admiten `.` y `..`; las rutas que empiezan por `/` son absolutas. Para buscar por nombre en la escena, consulta `game.node(name)`.

## Instancias independientes

Si dos nodos comparten el mismo recurso, cada uno obtiene sus propias variables de ámbito. No se admite `await` en el nivel superior del recurso Nodo: utiliza funciones `async` dentro de callbacks si necesitas promesas.

## Signals

Selecciona el emisor y abre el panel **Signals**. El catálogo muestra las señales nativas del tipo de nodo seleccionado y las señales propias detectadas en sus scripts asignados. Elige una señal, selecciona el nodo receptor y elige un método publicado. Puedes abrir el script receptor en el editor integrado desde el diálogo.

En el emisor, declara una señal propia con un nombre literal y emítela cuando corresponda:

```js
node.define_signal('activado')

function _ready() {
  node.emit_signal('activado', 1)
}
```

En un Script de Nodo del receptor, publica el método que elegirá la conexión:

```js
node.expose('alActivar', (cantidad) => {
  console.log('Activaciones:', cantidad)
})
```

Guarda el proyecto desde el editor de código. Conecta **activado → alActivar** en el panel, guarda el proyecto y ejecuta Play. Las conexiones guardadas en escena se preparan antes de `_ready()`. Las señales nativas entregan los argumentos que muestra el catálogo. Para conexiones por código consulta `connect` y `disconnect` en [NodeHandle](#/api-nodehandle). Para señales de eventos del juego, consulta `game.on` y `game.emit` en la [API de game](#/api-intro).

Con la sincronización de archivos activa, escribe el método en el editor de código que estés utilizando y selecciónalo después de guardar. Century Engine bloquea la generación automática de callbacks en ese modo para proteger los cambios externos.

## Límites

Las promesas no bloquean automáticamente el ciclo físico y no se cancelan por la fuerza al salir de PlayMode. No existe hot reload de scripts durante Play. El código se ejecuta solo durante Play, no por editar un nodo.

## Más información

[Referencia de `NodeScriptHandle`](#/api-nodescripthandle) y [Referencia global de API](#/api-intro).

Para controlar un personaje físico, consulta [CharacterBody3D](#/fisica) y sus [propiedades de script](#/api-characterbody3dnodescripthandle). Para exponer parámetros por instancia, consulta [Propiedades editables](#/propiedades-editables).
