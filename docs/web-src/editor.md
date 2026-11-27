# Manual del editor

Century Engine utiliza una interfaz Electron con paneles adaptables, ventanas desacopladas y menús para editar proyectos, escenas, materiales, eventos y scripts.

## Barra superior

**Archivo**: abrir y guardar proyecto, crear escena, importar y exportar. **Editar**: Undo/Redo, copiar, pegar, duplicar, agrupar. **Añadir**: catálogo de nodos. **Juego**: ajustes de proyecto, Input Map y otros sistemas. **Ayuda**: documentación y referencias.

**Paneles:** usa **Ver → Paneles del editor** para mostrar u ocultar Jerarquía, Inspector y Proyecto, recuperar otros paneles disponibles o restaurar la disposición. Para crear nodos, abre el menú **Añadir** o pulsa **Shift+A**. Edit Mode, Play Mode y Code permanecen en la barra de herramientas.

## Proyecto / Assets

Los recursos muestran un icono según su tipo; OBJ, GLB y GLTF se distinguen por formato. Los scripts, shaders, materiales, escenas, prefabs, interfaces, audio y recursos temporales conservan sus acciones propias. Las imágenes muestran su miniatura cuando está disponible. Las carpetas conservan sus iconos originales. La cuadrícula y la lista utilizan la misma iconografía; cambia de vista en los ajustes del panel Proyecto.

## Scene Tree

El panel jerárquico muestra los nodos de la escena activa. Permite búsqueda, selección, reparenting, renombrado con F2 y navegación por teclado. Los nodos con script muestran un indicador. Consulta [Operaciones del árbol](#/scene-tree).

## Inspector

Muestra las propiedades relacionadas con el tipo de nodo seleccionado y editores de recursos. `Node` no tiene Transform; `Node3D` y sus derivados sí. El Inspector de `RigidBody3D` contiene propiedades físicas; la primitiva visual no las tiene. Consulta [Inspector contextual](#/inspector).

## Viewport

Selecciona y transforma mediante gizmos; admite vistas y navegación con teclado/ratón, herramientas de malla y opciones de Snap. Las operaciones complejas se ajustan desde sus paneles específicos.

### Shift · transformación libre momentánea

Con Snap de movimiento, rotación o escala activado, **mantén Shift mientras arrastras un gizmo del editor de escenas** para mover, girar o escalar libremente. Suelta Shift para recuperar el ajuste. Funciona también con el gizmo universal y con selecciones múltiples. No es necesario desactivar las casillas de Snap: su configuración no cambia.

Si sueltas o pulsas Shift durante un arrastre, la posición, rotación o escala **no salta** al valor de la cuadrícula. Desde ese punto, el Snap se reanuda por incrementos de la configuración hasta soltar el ratón. En un arrastre iniciado sin Shift, el Snap inicial conserva la alineación de cuadrícula habitual. Esta función **no aplica** en Edit Mesh, FilmMaker ni al gizmo de las piezas de terreno.

Si la aplicación pierde el foco, Shift se restablece al modo normal. La transformación se confirma con el sistema habitual de Undo/Redo al soltar el ratón.

### Organización de la barra del viewport

La barra de **Escena** contiene opciones de visualización frecuentes (rejilla, malla, luces y terreno), vistas ortogonales/perspectiva, **Encuadrar todo** y un icono que alterna directamente la navegación entre ratón y trackpad. Las operaciones avanzadas de cámara se encuentran en **Ver**; no se duplican en la barra del visor. En **Edit Mesh**, la Toolbar sustituye los gizmos de objetos y herramientas de entorno por selección vértice/arista/cara, operaciones contextuales, transformaciones de geometría y acceso al panel Malla. Consulta [Edit Mesh](#/mesh-edit) para detalles; se conservan los controles del viewport y el modo Juego.

- **FOV horizontal de la cámara editorial:** **Editar → Preferencias del editor → Viewport** (40–120°, predeterminado 90°). **Restablecer** recupera 90°. No modifica las cámaras del juego ni el FOV del jugador.
- **Tamaño de los gizmos:** **Preferencias del editor**. **Ratón / Trackpad:** icono sin texto en la barra superior de Escena, pulsable para alternar el modo. El icono representa el dispositivo activo y se sincroniza con **Preferencias del editor → Navegación** y **Ver → Navegación**. Mantiene sensibilidades, gestos y persistencia existentes.
- **Render del viewport:** exclusivamente en **Ver → Render del viewport**. Las opciones **Usar render del proyecto**, **Forward+**, **Mobile** y **Compatibility** afectan solo a la vista editorial, no al render del juego exportado.
- **Orbitar selección y acciones de cámara:** **Ver**. Los atajos de vistas y las acciones de alinear y pilotar se conservan.

### Escala uniforme de objetos
En **Object Mode**, selecciona un objeto escalable o varios nodos y pulsa **S**, escribe el factor (por ejemplo `2`, `0.5` o `1`) y confirma con **Enter**. **Esc** cancela y restaura la transformación inicial. Mientras escribes aparece una indicación temporal en la barra superior. Un factor `2` transforma `[2, 3, 4]` en `[4, 6, 8]` sin igualar sus ejes. Un factor `1` no modifica el objeto. No se admiten factores negativos, cero ni valores que infrinjan las restricciones físicas o el tamaño mínimo.

El comando **R** continúa mostrando el gizmo de escala normal. **Ctrl+S** sigue guardando; si se pulsa durante la operación numérica, cancela la vista previa y ejecuta Guardar. Para varios objetos, se conservan las distancias relativas respecto al centro de la selección y se transforman únicamente las raíces, sin aplicar escala doble a hijos seleccionados.

En el **Inspector → Transformación** se conservan los campos XYZ absolutos de **Tamaño/Escala** y se añade **Escala ×**, que aplica un multiplicador relativo al estado inicial de ese gesto y registra una sola operación de Undo/Redo. Los nodos sin escala propia no ofrecen ese campo. En primitivas, se mantienen los vínculos de radio/esfera establecidos.

## Ventanas

Edit Mode, Play Mode y Code disponen de vistas editoriales que se pueden acoplar y desacoplar. Arrastra las pestañas para reorganizar el espacio de trabajo: suelta sobre otra pestaña para agrupar o reordenar, o junto al borde de un grupo para dividirlo. Al salir de los destinos válidos puedes desacoplar el panel. Para mover una ventana independiente, arrastra el espacio libre de su cabecera. Para intentar reacoplarla, arrastra el título o pestaña identificable hacia un destino señalado. También puedes regresar durante el mismo gesto si el sistema mantiene la captura. El reacoplamiento físico depende del compositor y todavía no está validado en todos los entornos. Escape cancela el arrastre. Usa **Ver → Paneles del editor** para recuperar una distribución. La continuidad entre ventanas depende del gestor del sistema operativo. En Electron, las ventanas de herramientas y recursos utilizan el alojamiento nativo disponible; puedes reorganizar el espacio de trabajo sin cerrar la escena. Consulta [Preferencias](#/preferencias).


Los scripts se crean en Assets, se nombran antes de editarse y pueden asignarse al nodo desde el Inspector mediante selector o arrastre. El doble clic en un recurso JavaScript abre el editor de código integrado. En Electron, Código, Eventos, Base de datos, Localización y varias herramientas de los menús abren en ventanas propias. En Eventos, **Insertar comando** permite buscar por nombre o categoría. El panel de documentación abre un portal HTML local, con búsqueda y navegación por capítulos.

## Estadísticas de rendimiento

**Stats** muestra FPS durante el juego, tiempos de dibujo y contadores de escena. Ábrelo desde los controles de juego o con **F3**.

## Atajos verificados en el catálogo

| Acción | Acceso |
|---|---|
| Guardar proyecto | Ctrl+S |
| Deshacer / rehacer | Ctrl+Z / Ctrl+Shift+Z |
| Copiar / pegar delante de la cámara | Ctrl+C / Ctrl+V |
| Duplicar / duplicación vinculada | Ctrl+D / Alt+D |
| Renombrar | F2 |
| Agrupar | Ctrl+G |
| Eliminar selección | Supr |
| Documentación | F1 |

Las acciones contextuales pueden quedar deshabilitadas en determinados estados del editor.

## Control de versiones

La sección **Control de versiones** del dock inferior ofrece **Cambios**, **Historial**, **Ramas** y **Remoto**. Está disponible para proyectos guardados en disco desde Electron. Consulta la [guía Git](#/vcs-intro) para guardar commits, comparar revisiones y sincronizar por HTTPS.

## HUB de proyectos

El HUB ofrece proyectos recientes, búsqueda, ordenación, lista o cuadrícula, información del proyecto seleccionado, importación y creación desde plantillas. Las miniaturas solo aparecen cuando hay una imagen real del proyecto; de lo contrario se muestra un icono neutral. La creación conserva nombre, ubicación y renderizador.

**Errores y recuperación:** los fallos de abrir, crear, importar, duplicar o quitar proyectos se presentan en un aviso persistente dentro del HUB, con la causa devuelta por el sistema cuando está disponible. Un fallo de lectura de la biblioteca permite **Actualizar lista** sin borrar la lista anterior ni quedar en «Cargando…». El aviso puede descartarse; cancelar un selector de archivos o una confirmación no se trata como fallo.

## Assets Browser
Arrastra recursos compatibles desde Assets a los campos del Inspector y de los editores especializados. Consulta [Inspector](#/inspector).

El panel Assets ofrece **lista compacta** (predeterminada) y **cuadrícula**, ordenación por nombre o tipo, búsqueda, rutas navegables, árbol de carpetas, selección múltiple y menú contextual. Conserva el arrastre de recursos a Inspector, Scene Tree y viewport. El control de tamaño se muestra en cuadrícula.

Los proyectos nuevos solo declaran inicialmente `Assets/` y `Assets/Scenes/`; los recursos de interfaz nativos se generan donde corresponde. Importar en `Assets/` respeta esa ubicación en vez de generar una carpeta por tipo. Las carpetas de proyectos existentes se preservan al abrirlos y las rutas necesarias se crean cuando aparece un recurso.

Para editar efectos visuales, selecciona un recurso `.vfx` en Assets. Configura emisión, nacimiento, movimiento y apariencia desde el Inspector. Pulsa **Vista previa** para visualizar el efecto; al cerrar la vista se recupera la cámara editorial. Consulta [Gráficos y materiales](#/graficos).
