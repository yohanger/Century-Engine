# Física y colisiones

Century Engine utiliza **Jolt Physics WASM**. Los cuerpos y las formas se representan mediante nodos especializados en el árbol.

## StaticBody3D

Representa colisión estática. Puede agrupar una o varias `CollisionShape3D` como hijas, sin necesidad de que la malla visual participe en física.

## RigidBody3D

Cuerpo dinámico con masa, gravedad, amortiguación, fricción y restitución. La simulación calcula su movimiento; las mallas visuales descendientes se sincronizan.

## CharacterBody3D

Cuerpo para movimiento controlado, basado en personajes virtuales de Jolt. Ofrece velocidad, deslizamiento, consulta de suelo/pared/techo, pendientes y opciones de escalón. No es un controlador FPS obligatorio.

### Control desde un Script de Nodo
Un Script de Nodo asignado a `CharacterBody3D` puede usar `node.velocity = [vx, vy, vz]` (m/s). `node.velocity` devuelve una copia de la velocidad efectiva del cuerpo, y `node.ground` indica `stable`, `steep` o `air`. Las consultas de solo lectura `node.onFloor`, `node.onWall` y `node.onCeiling` reflejan el último paso físico. No hay que seleccionar el nodo durante Play.

```js
function _physics_process(delta) {
  const [vx, vy, vz] = node.velocity
  node.velocity = [1, vy, vz]
  if (node.onFloor) console.log('En suelo')
}
```

El ejemplo solo demuestra el acceso a la velocidad; no es una locomoción FPS terminada. El callback se ejecuta antes de Jolt y el movimiento físico se resuelve en su paso existente. La gravedad vertical se aplica por el propietario `NodeSpatialRuntime`. Los valores modificados durante Play no reemplazan las propiedades guardadas del nodo.

Estas propiedades están disponibles únicamente para un `CharacterBody3D` con cuerpo Jolt activo. Si falta la forma física, el cuerpo está inactivo, la escena cambió o el handle dejó de ser válido, la operación informa un error. Este código no crea un jugador FPS ni modifica `game.player`.

## Area3D

Sensor de solapamientos. Detecta entradas y salidas de cuerpos y otras áreas; no bloquea el movimiento como un cuerpo sólido. Consulta las señales de entrada y salida en [Scripts por nodo](#/scripts-nodo).

## Formas

Las entradas del catálogo son **BoxShape3D**, **SphereShape3D**, **CapsuleShape3D** y **TriMeshShape3D**. Internamente usan el mismo nodo `collisionshape3d` con un recurso de forma diferente. Deben ser hijas directas de un cuerpo o área compatible. Las escalas degeneradas se rechazan.

### Ajustar BoxShape3D a una primitiva o malla

Si `StaticBody3D` incluye una primitiva o malla editable y añades una nueva `BoxShape3D`, la forma puede tomar automáticamente la envolvente y el centro de la geometría visual. En el Inspector de `CollisionShape3D`, marca **Autoajuste a geometría** para mantener sus dimensiones o pulsa **Ajustar a geometría** para recalcular solo una vez. Editar tamaño o posición manualmente desactiva el seguimiento. El sistema no cambia la escala del cuerpo ni duplica colisiones.

> Las formas de proyectos antiguos conservan sus tamaños manuales, incluso cuando se muestran como `1 × 1 × 1 m`. Si no hay geometría válida, la caja conserva sus dimensiones.

`TriMeshShape3D` es distinta de Box: sigue triángulos de una primitiva o malla editable y solo está admitida bajo `StaticBody3D`. Para objetos dinámicos, utiliza formas convexas. Una caja de autoajuste sigue siendo una envolvente aproximada.

## Orden de actualización

El ciclo físico lo coordina PlayMode y Jolt avanza durante el paso fijo. No hay otro mundo físico por cada cuerpo. Prueba el comportamiento también en el juego exportado.

## Relación con eventos

La API `game.physics` y los cuerpos especiales de gameplay son parte del runtime existente. Las páginas, condiciones y comandos del Event Order Flow siguen siendo un sistema distinto.

Para el sistema de agua obsoleto, consulta [Agua y fluidos](#/agua).
