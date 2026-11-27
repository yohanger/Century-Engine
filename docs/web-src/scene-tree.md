# Scene Tree

El árbol de escena es la estructura editable del proyecto. Cada nodo tiene `id`, `name`, `type`, `parentId` y otras propiedades relacionadas con su función.

## Crear nodos

Usa **Añadir** para insertar un nodo en la escena o como hijo del seleccionado. `Node` sirve como organizador sin transformación; `Node3D` admite posición, rotación y escala.

## Jerarquía

Arrastra un nodo para cambiar su posición dentro del árbol. Century Engine valida ciclos y restricciones físicas. `CollisionShape3D` debe estar bajo un propietario físico válido; el catálogo muestra las cuatro variantes de forma (TriMeshShape3D se reserva para StaticBody3D).

## Selección y teclas

El árbol admite búsqueda, F2 para renombrar, navegación con flechas, Home y End. Al seleccionar desde el viewport, el árbol debe revelar el nodo correspondiente. Si hay un solo script asociado, su indicador abre el editor de código integrado. Con varios scripts, elige el recurso en el Inspector.

## Transformaciones

La transformación de un `Node3D` es espacial. Las primitivas preexistentes pueden mantener una escala visual propia, por lo que los casos de reparenting incompatibles se rechazan antes de modificar los datos.

## Duplicar y pegar nodos

**Ctrl+D** coloca la copia a 2 m del original en la dirección cardinal horizontal más próxima a la cámara (±X o ±Z). La altura, rotación y escala no cambian. **Alt+D** utiliza el mismo desplazamiento, pero conserva la geometría compartida en las mallas vinculadas.

**Ctrl+C** guarda una instantánea. Al pulsar **Ctrl+V**, el centro del conjunto se pega en el punto de la superficie visible hacia la que mira la cámara si se encuentra a un máximo de 2 m. Si no hay superficie próxima, se coloca a 2 m horizontalmente delante de la cámara, con dirección cardinal y a la altura de esta. No se alinea automáticamente la base ni se gira el objeto. La dirección no depende del cursor ni de Snap.

Si seleccionas varias raíces, mantienen su distribución relativa. Si seleccionas un padre espacial y sus hijos, solo la raíz recibe la traslación; los hijos conservan sus transformaciones locales. Un `Node` lógico no tiene Transform: no se le asigna una posición. Utiliza `Node3D` para desplazar una jerarquía como unidad.

## Undo/Redo

Las operaciones múltiples del árbol se confirman de forma atómica. Si una reasignación de padre no es válida, no se deja parcialmente movido el resto del conjunto.
