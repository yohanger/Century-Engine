# Primeros pasos

Esta guía sigue el editor Century Engine 0.26.13. Los nombres de menús y funciones pueden cambiar entre versiones de desarrollo.

## Crear o abrir un proyecto

Abre el editor Electron, crea un proyecto desde la pantalla inicial o abre un `.lfproj` mediante **Archivo → Abrir proyecto**. Para guardar, utiliza **Ctrl+S**. El editor organiza las escenas, Assets y configuraciones del juego.

## Comprender los paneles

- **Scene Tree (Jerarquía):** contiene los nodos y su parentesco. La selección del árbol y del viewport se sincroniza.
- **Viewport:** permite inspeccionar y modificar la escena 3D.
- **Inspector:** edita propiedades del nodo o recurso seleccionado.
- **Proyecto / Assets:** recursos de scripts, modelos, texturas, materiales e interfaces.
- **Dock inferior:** herramientas adicionales como consola, audio y timeline.

## Construir una escena

1. Crea un `Node3D` como contenedor.
2. Usa **Añadir** o el menú del Scene Tree para insertar una primitiva `Cube`.
3. Edita posición y escala desde el Inspector o los gizmos.
4. Si necesitas una colisión estática, añade `StaticBody3D` con una forma `BoxShape3D` como hijo y una malla visual descendiente.
5. Guarda con **Ctrl+S**.

> Una primitiva sin cuerpo físico no colisiona automáticamente. En blockout puedes mantener geometría visual sin colisiones; configura las formas cuando lo requiera el juego. El nodo de forma se agrega mediante las entradas `BoxShape3D`, `SphereShape3D`, `CapsuleShape3D` o `TriMeshShape3D` (solo StaticBody3D) del catálogo.

## Probar

Usa el botón **Play** o **F5**. La escena debe tener la configuración de cámara/jugador apropiada: un Spawn FPS o una cámara principal. La consola muestra los errores del runtime. Para comprobar exportación utiliza la ventana **Archivo → Exportar juego**.

## Guardar versiones del proyecto

Después de guardar en una carpeta del disco, abre **Control de versiones** en el dock inferior y consulta [Introducción a Git](#/vcs-intro). Puedes guardar commits localmente y configurar un servidor HTTPS después; Git no sustituye **Ctrl+S**.

## Siguiente paso

Lee [Scene Tree y nodos](#/escenas), [scripts](#/scripts-nodo) y el [tutorial del primer evento](#/tutorial-evento).
