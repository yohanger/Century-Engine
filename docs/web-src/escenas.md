# Escenas y nodos

Century Engine sigue una arquitectura de **nodos**, no ECS. Cada tipo implementa una responsabilidad y puede organizarse como hijo de otros nodos.

## Node y Node3D

`Node` almacena identidad, nombre y jerarquía; **no** tiene transformaciones espaciales. `Node3D` añade posición, rotación y escala, y puede transmitir transformaciones a sus descendientes. La escala de algunas primitivas antiguas sigue siendo tamaño visual propio, por lo que no debe suponerse el mismo comportamiento en cada tipo.

## Escenas instanciables
Una **escena** es un recurso en `Assets/Scenes` que puede contener un árbol de nodos. Crea una escena vacía `Casa`, añade mallas, cuerpos físicos y scripts; vuelve a la escena `Mundo` y arrastra `Casa` desde Assets al viewport o a la jerarquía. En la cabecera de **Jerarquía** utiliza el botón **Instanciar escena** (icono de escena), separado de **+ Añadir nodo**. Busca una escena por nombre o carpeta, selecciónala y confirma: la nueva instancia se crea en la raíz y queda seleccionada. Para incluirla dentro de un padre concreto, haz clic derecho sobre ese nodo y elige **Instanciar escena hija…**. También puedes arrastrar la escena desde Assets al viewport o a la Jerarquía. Puedes abrir el mismo selector en cualquier área del Editor mediante **Ctrl + Shift + A**, aunque la Jerarquía esté oculta. **Shift + A** sigue añadiendo nodos y **Ctrl + A** sigue seleccionándolos. En el Inspector de una instancia encontrarás **Abrir escena fuente**; el doble clic sobre su raíz en Jerarquía abre la fuente directamente.

La instancia es un `sceneInstance`, un nodo espacial con transformación propia. Puedes colocar varias copias de `Casa` con posiciones distintas. Sus nodos hijos se generan desde la escena fuente y se muestran para inspección, pero se editan en el recurso original. No hay un sistema de overrides independientes para cada hijo; duplicar un nodo de instancia solo duplica la referencia, no crea otra escena fuente.

Las referencias anidadas se resuelven por árbol y se bloquean los ciclos directos o indirectos. Si una escena referenciada falta o es incompatible, la operación informa un error. El **terreno y las propiedades de ambiente** de una escena fuente no se importan como nodos espaciales: pertenecen al nivel activo, no a cada copia de la casa.

En scripts de Play, `await game.scenes.instantiate('Casa', { position: [x, y, z], parent: game.node('Contenedor') })` crea un subárbol transitorio y devuelve un `NodeHandle`. `game.scenes.destroy(handle)` destruye únicamente ese subárbol temporal. `game.goScene('Mundo')` sigue cambiando el nivel; no instancia objetos. En Play dinámico, los nodos `event`, `navigation`, `liquid` y `terrain` no están admitidos, porque requieren propietarios de nivel adicionales.

**Build:** las escenas referenciadas por instancias colocadas en otras escenas (incluidas referencias transitivas) se incluyen automáticamente como recursos del Player, sin cambiar la escena inicial. Para instanciación puramente dinámica desde scripts, añade la escena fuente a la lista Build si no está referenciada por otra escena; de otro modo el paquete exportado no podrá resolverla.

**Persistencia:** se guardan las referencias autorales y las transformaciones de raíz, no las copias derivadas ni las instancias temporales de Play. Modificar `Casa` se refleja al cargar nuevamente `Mundo`. Para editar un hijo, abre su escena fuente.

## Componer en lugar de acoplar

Para un muro sólido, crea un `StaticBody3D` con `BoxShape3D` y la malla visual adecuada. El cuerpo administra Jolt; la forma define colisión; la malla representa. Para una caja dinámica, utiliza `RigidBody3D`.

## Tipos disponibles

El catálogo incluye geometría, luces, cámaras, audio, áreas, cuerpos físicos, eventos y UI. Consulta la sección **Tipos de nodo** para ver las referencias individuales extraídas del registro.

## Scripts opcionales

Cada nodo puede referenciar varios recursos JavaScript de ejecución Nodo por `scriptIds`. El campo anterior `scriptId` se conserva como lectura de compatibilidad. Su estado es independiente por instancia. Consulta [Scripts asociados a nodos](#/scripts-nodo).

## Guardado y ejecución

El proyecto almacena objetos y recursos; PlayMode crea representaciones y servicios de ejecución para el Editor y el Player. No confundas los marcadores editoriales de cuerpos y formas con geometría exportable.

Para configurar fenómenos ambientales, consulta [Clima](#/clima).
