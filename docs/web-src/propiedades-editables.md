# Propiedades editables de scripts

Los recursos JavaScript de ejecución **Nodo** pueden declarar valores que el autor edita desde el Inspector del nodo, sin alterar el código ni compartir el estado entre instancias.

```js
@header("Movimiento")
@header_descripcion("Parámetros de este personaje")
@editable
@editable_description("Velocidad en metros por segundo")
let velocidad = 4.5
@editable
let activo = true
@editable
let mensaje = "Hola"

function _ready() {
  console.log(velocidad, activo, mensaje)
}
```

| Directiva | Función |
|---|---|
| `@header("Título")` | Agrupa las siguientes propiedades. |
| `@header_descripcion("Texto")` | Describe el grupo actual. Requiere un header. |
| `@editable` | Expone una variable del ámbito superior. |
| `@editable_description("Texto")` | Describe una propiedad. También se reconoce la grafía anterior `@editable_descricption`. |

Usa una declaración `let`, `const` o `var` por línea con un literal número finito, booleano o texto. No se admiten objetos, arrays, expresiones calculadas, nombres duplicados ni anotaciones dentro de funciones. Las directivas van en líneas propias y no son decoradores estándar de JavaScript.

Asigna el script a un nodo, guarda y edita los valores desde su Inspector. El valor literal es el predeterminado y los valores personalizados pertenecen a la instancia. El runtime prepara los valores antes de ejecutar el recurso Nodo. Consulta [Ciclo de vida y Signals](#/scripts-nodo).
