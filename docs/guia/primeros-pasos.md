# Primeros pasos

## 1. Crear un proyecto

Al abrir LevelForge aparece el **gestor de proyectos**. Elige *Nuevo proyecto*, ponle nombre y el **método de render**
(*Forward+* para escritorio, *Mobile* o *Compatibility* para equipos modestos; se puede cambiar después en *Juego ▸ Ajustes del juego*).
Elige también la **plantilla**:

- **Vacío**: como una escena nueva de Unity. Trae un sol y una *Cámara principal*, **sin jugador ni Spawn**: no hay personaje, ni manos, ni mirada con el ratón. Lo montas tú con nodos, eventos y scripts (`game.player` existe pero está vacío). Sirve para juegos que no son de primera persona.
- **Primera persona**: sol y un *Spawn*; el jugador (caminar, correr, saltar, escalones) nace donde esté el Spawn.

La plantilla solo se elige al crear el proyecto; después el proyecto lleva sus propios ajustes (*Ajustes del juego ▸ Restaurar valores de la plantilla*). Las escenas nuevas nacen con el contenido de la plantilla.
Un proyecto es una carpeta con escenas, assets (modelos, texturas, audio, scripts, interfaces) y la base de datos del juego.

## 2. La ventana

| Zona | Para qué |
|---|---|
| **Barra superior** | Menús *Archivo, Editar, Añadir, Ver, Juego, Ayuda*; herramientas (mover, rotar, escalar) a la izquierda y, a la derecha junto a **Añadir**, los botones ▶ Jugar / ⏸ / ⏭. |
| **Jerarquía** (izquierda) | El árbol de la escena: la **Escena** es la raíz y los nodos cuelgan de ella. Arrastra un nodo sobre otro para hacerlo hijo. |
| **Visor** (centro) | La escena en 3D. Clic selecciona; rueda acerca; rueda pulsada orbita; `Mayús` + clic derecho arrastrando (o `Espacio` + clic) desplaza; clic derecho + `WASD` vuela; teclado numérico cambia de vista (como Blender). El control ✥ de la barra del visor cambia el **tamaño de los gizmos** (la cruceta de ejes no cambia). |
| **Inspector** (derecha) | Propiedades del nodo o la escena seleccionados y edición directa de recursos `.post`, `.material` y GameManager al elegirlos desde *Proyecto / Assets*. |
| **Dock inferior** | *Proyecto* (assets y carpetas), *Consola*, *Audio Mixer*, *Timeline* y *Animación*. |

En LevelForge **no hay ventanas que bloqueen**: el editor de eventos, el de scripts, la localización o la base de datos son ventanas que
puedes mover, redimensionar y tener abiertas a la vez.

El editor no muestra **tooltips** (globos al pasar el ratón). Si los quieres: *Preferencias ▸ Interfaz ▸ Mostrar tooltips*. Lo mismo con los textos de ayuda de las ventanas: no se muestran (para eso está esta documentación) y vuelven con esa misma opción.

## 3. Poner cosas en la escena

- **Añadir** (o `Shift+A` en el visor) abre el catálogo: primitivas, terreno, agua, luces, cámaras, **Spawn** (donde aparece el jugador),
  **Evento**, **Trigger**, **Canvas** (interfaz), fuentes de audio…
- Arrastra un modelo `.glb` / `.obj` desde el panel Proyecto al visor para colocarlo; una imagen (png, jpg…) crea un **Sprite 3D**.
- Clic sobre el terreno lo selecciona (Inspector ▸ *Terreno*).
- `W` mover, `E` rotar, `R` escalar, `Q` seleccionar (como Unity); `Ctrl+D` duplica; `Supr` borra; `Ctrl+Z` deshace. `?` muestra todos los atajos.

## 4. Jugar

Para jugar hace falta un **Spawn** (el jugador aparece ahí, con su cámara) o una **Cámara** marcada como principal.

- `F5` juega desde el Spawn; `Shift+F5` desde la vista actual. `F5` otra vez detiene.
- Durante el juego: `WASD` mover, `Shift` correr, `Espacio` saltar, `E` interactuar. Las teclas se cambian en *Juego ▸ Ajustes del juego ▸ Input Map*.
- Los errores de los scripts aparecen como aviso y en la pestaña **Consola**.

## 5. Guardar y exportar

`Ctrl+S` guarda el proyecto. *Archivo ▸ Exportar juego…* abre la ventana **Build**, donde preparas y generas la aplicación de escritorio
(AppImage en Linux) con todo lo necesario: el jugador no necesita LevelForge.

En la ventana Build:

- **Destino**: hoy Linux (x86_64, AppImage). Windows, macOS y Web aparecen desactivados, todavía no están disponibles.
- **Escenas del juego**: marca las que entran y ordénalas con ↑ ↓. **La primera es la escena con la que arranca el juego**; las que no marques no se exportan. Por eso, un evento que lleve al jugador a una escena que no está en la lista no podrá hacerlo en el juego exportado: incluye todas las escenas a las que se pueda viajar.
- **Ajustes del juego**: título, versión, tipo de ventana e icono, sin salir de la ventana.
- **Avisos**: lo que faltaría para que el juego arranque bien (por ejemplo, una escena inicial sin *Spawn* o sin interfaz para los diálogos).
- **Última exportación**: fecha, número de escenas, tamaño y ruta del último archivo generado.

El juego guarda las partidas y los ajustes del jugador (idioma, gráficos, teclas, audio) en su propia carpeta de datos del usuario, sin tocar el proyecto.

## Siguiente paso

Lee los [Conceptos](conceptos.md) o ve directo al [tutorial](../tutorial/vertical-slice.md).
