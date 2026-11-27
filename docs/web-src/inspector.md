# Inspector

El Inspector presenta controles contextuales: no muestra propiedades físicas en mallas visuales ni Transform en `Node`.

## Estructura general

- **Identificación:** nombre y tipo del nodo.
- **Transform:** solamente nodos 3D.
- **Propiedades del nodo:** física, forma, luz, material, etc., según el registro.
- **Scripts:** agregar recursos desde Assets, reordenar sus asignaciones y quitarlas. El botón de cada Script de Nodo abre el archivo en el editor de código integrado. La creación y el renombrado se realizan en Assets.

## Cuerpos físicos

`StaticBody3D` ofrece parámetros de fricción y restitución. `RigidBody3D` añade masa, gravedad, amortiguación y sueño. `CharacterBody3D` expone velocidad, pendientes, escalones y gravedad. `Area3D` tiene monitorización y detección. Las formas Box/Sphere/Capsule administran sus dimensiones.

## Arrastrar recursos desde Assets
En el Inspector, arrastra una **textura** a `Decal → Textura`, un **clip de audio** a `Audio Source → Clip` o un **perfil `.post`** a los campos Perfil de Cámara, Spawn o PostProcessVolume. El campo se resalta discretamente cuando pasas el recurso por encima y comprueba su ID y tipo antes de asignarlo.

Los selectores siguen disponibles para trabajar con teclado, reemplazar o quitar el recurso. Un recurso de otro tipo, una selección múltiple o una entrada eliminada no sustituyen el valor. Las referencias se guardan por ID y siguen siendo válidas tras mover o renombrar el recurso. Undo/Redo utiliza el historial normal del Inspector.

**Editores especializados:** arrastra materiales `.material`, shaders de superficie, imágenes, recursos `.vfx`, retratos y sonidos a los campos compatibles de cada editor.

## Recursos

Los recursos `.material`, `.post` y GameManager se editan desde el Inspector mediante referencias por ID. Los cambios confirmados se integran en Undo/Redo. Shader Graph conserva su editor dedicado.

## Buenas prácticas

Cambia un valor, observa el viewport y confirma una sola operación de historial por gesto. Si faltan campos, verifica el tipo seleccionado. No atribuyas física automáticamente a una malla visual.
