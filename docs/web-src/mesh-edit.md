# Edit Mesh

Las herramientas de edición de malla trabajan sobre la geometría del objeto seleccionado, diferenciando las operaciones de objeto de las operaciones de vértices, aristas y caras.

## Barra contextual de Edit Mesh
Al entrar en **Edit Mesh** con `Tab`, la barra superior cambia de las herramientas del objeto a las de geometría. Deja de mostrar los gizmos de objetos y los pinceles de carretera/terreno; en su lugar aparecen:

- **Vértices (1), Aristas (2), Caras (3):** selección contextual. El modo activo queda resaltado.
- **Mover (G), Rotar (R), Escalar (S):** transformación de la geometría seleccionada, no del nodo completo.
- **Acciones rápidas según modo:** vértices (bisel de vértices, fusionar), aristas (bisel, corte en bucle), caras (extruir, inset). Las acciones que requieren selección quedan inactivas si no existe; el corte en bucle comienza por la posición del cursor.
- **X-ray (Alt+Z), Proporcional (O), Simetría X:** mismos comandos y estado que las opciones del panel Malla.
- **Espacio global/local y Snap:** controles existentes; la pulsación Shift para suspender temporalmente Snap del gizmo **no aplica** a operaciones de malla.
- **Herramientas:** abre el panel derecho **Malla**, que conserva el catálogo completo y los parámetros numéricos. **Salir** o `Tab` vuelve a las herramientas de objetos.

**Añadir** en Edit Mesh usa el menú existente de inserción de geometría; no crea un objeto de escena nuevo. En pantallas estrechas las acciones rápidas muestran iconos y nombres accesibles y la barra permite desplazamiento horizontal. Si hay una operación modal activa, los comandos incompatibles se desactivan; confirma/cancela primero el gesto actual.


## Operaciones

Se incluyen herramientas para selección y edición de vértices, aristas y caras; Fill, extrusión, cortes y transformaciones numéricas. La primitiva Vértice permite comenzar desde topología vacía y construir superficies mediante PolyShape.

## Instancias y recursos

**Ctrl+D** duplica nodos; **Alt+D** permite duplicación vinculada de malla, donde los duplicados comparten una referencia de geometría. Ambas operaciones desplazan el nodo 2 m horizontalmente en la dirección cardinal más próxima a la cámara. Consulta [Duplicar y pegar nodos](#/scene-tree). Se puede volver una malla independiente mediante el comando correspondiente. La duplicación vinculada se diferencia de copiar/pegar.

## Snap

Utiliza las opciones del panel de edición para configurar el ajuste. El ajuste se aplica a las operaciones de geometría del modo activo.

## Materiales y UV

Las mallas guardan datos geométricos y UV de los recursos. Los cambios de geometría no deberían alterar materiales compartidos ajenos a la operación.

## Límites

No toda topología degenerada puede convertirse en una superficie válida.

## Añadir geometría con Shift+A

En **modo objeto**, `Shift+A` → **Primitivas** crea Cubo, Plano, Cilindro, Cono, Esfera, Rampa y Escalera. Para iniciar una malla de construcción desde cero, abre `Shift+A` → **Herramientas de modelado**: Vértice, Rejilla, Círculo y Toro. Esas cuatro opciones generan nodos `mesh` reales; Vértice conserva la entrada automática a Edit Mesh. La antigua categoría duplicada «Malla editable» ya no aparece en este menú.

En **Edit Mesh**, `Shift+A` sigue mostrando el catálogo completo de geometrías que se añaden a la malla seleccionada.

## Bisel de vértices y aristas de contorno
En **Edit Mesh**, el redondeado modifica **vértices y caras reales** de `PolyMesh`:

- **Bisel de aristas (`Ctrl+B`)**: selecciona aristas en modo arista (`2`) o caras en modo cara (`3`). Reutiliza el bisel existente para aristas interiores compartidas por dos caras. También acepta **aristas abiertas de caras aisladas** de cuatro o más vértices, seleccionadas sin ramificaciones, y genera una transición por segmentos sin cerrar la superficie. Las aristas de contorno conectadas a múltiples caras se rechazan con un mensaje: no se crean uniones T ni se altera el proyecto.
- **Bisel de vértices (`Ctrl+Shift+B`)**: entra en modo vértice (`1`) y selecciona uno o varios vértices de una primitiva o malla editable. Genera curvas sobre las caras y tapones triangulares en esquinas cerradas. Sirve, por ejemplo, para redondear las esquinas de una acera modelada como un bloque sólido. Se rechazan abanicos no manifold y aristas sueltas.
- **Control modal**: arrastra el ratón o escribe una anchura numérica, usa la rueda para los segmentos (1–32), `Enter` para aceptar y `Esc` para cancelar. `Bisel: ancho`, `segmentos` y `perfil` se mantienen en MeshPanel para ambos tipos. Un segmento produce chaflán; varios segmentos generan geometría curva.
- **Persistencia y física**: el mismo flujo de edición de mallas confirma cambios con Undo/Redo y guarda la geometría en `.lfproj`. Si un `TriMeshShape3D` refiere a la malla, consumirá la triangulación actualizada al reconstruirse la física; `BoxShape3D` con autoajuste activado recalcula sus dimensiones a partir de la geometría.

**Limitaciones conocidas:** el bisel de borde abierto se restringe por ahora a caras aisladas. El bisel no es un modificador no destructivo ni implementa todas las combinaciones de esquinas cóncavas, superficies no manifold o bordes de varias caras. Las geometrías de blockout de acera deben tener una topología limpia. Comprueba las colisiones en Play y en el juego exportado.

## Confirmar y cancelar transformaciones
Durante una operación modal de Edit Mesh, confirma con clic izquierdo o Enter y cancela con clic derecho o Escape. El gesto conserva el movimiento continuo cuando está disponible; al terminar, el cursor vuelve al modo convencional. El corte en bucle conserva su selección de anillo y fase de deslizamiento: confirma cada fase con su entrada correspondiente.
