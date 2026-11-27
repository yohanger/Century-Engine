# LF-VSCODE-PROJECT-WORKSPACE-S01-G001

Base ratificada por el usuario mediante el adjunto `lf(7).zip`. Coincide con S06 CORR-004 en los 1.883 archivos, contenidos y modos. El estado histórico de S06 sigue registrado por separado.

## Contrato y alcance

| Acción | Aceptación |
| --- | --- |
| Juego → Abrir proyecto en VS Code | Abre la carpeta con `project.lfproj`, independientemente del script activo. |
| Botón VS Code del Script Editor | Abre la misma carpeta y enfoca el script pedido por ID. Si el ID dejó de existir, informa el error. |
| Preparar el workspace | Sincroniza scripts, actualiza los tipos generados y conserva un `jsconfig.json` del usuario. Si la preparación o el CLI falla, muestra el error. |
| Guardar edición externa | El guardado explícito de LevelForge incorpora el texto externo antes de serializar, conservando identidad, modo y conexiones. |
| Extensión 0.1.1 | Reconoce la raíz activa y lee su API generada. Si hay varias raíces válidas y ninguna está seleccionada, pide contexto. |

Continúan vigentes CA-001 y CA-002 de S06. El cambio de editor predeterminado corresponde a otro Gate. Este Gate tampoco modifica el runtime, Signals ni el formato del proyecto.

## QA local de Linux y Windows

1. Desde la raíz extraída, ejecuta `npm ci`, `node --test scripts/test-vscode-project-workspace-s01-g001.mjs`, `npm run build` y `npm run electron`. Espera PASS en la suite y ambos builds.
2. Comprueba que `code --version` funciona. Instala la extensión desde `vscode-extension/README.md`. Usa dos **copias de prueba** en carpetas distintas, con espacios en el nombre y el mismo nombre de script en ambos proyectos.
3. Con el Script Editor abierto y un script seleccionado, usa **Juego → Abrir proyecto en VS Code**. El Explorador debe mostrar la carpeta correcta con `project.lfproj` y `Assets/`. VS Code puede restaurar sus propias pestañas. Después pulsa **VS Code** en la barra del Script Editor y confirma la ruta absoluta del archivo activo. Repite con el otro proyecto, dejando abierta la primera ventana.
4. En el segundo proyecto confirma que VS Code sugiere `game.*` y un nombre exclusivo de ese proyecto. Usa un `jsconfig.json` propio que incluya las declaraciones y comprueba que sigue idéntico tras volver a abrir.
5. En VS Code modifica un script asignado a un nodo, guarda y presiona inmediatamente **Ctrl+S** en LevelForge. Reabre el proyecto y ejecuta **Play**. Comprueba la modificación y que el modo Nodo, la asignación y la conexión Signals continúan operativos. Verifica que el proyecto anterior conserva su contenido. Repite con un script Global.
6. Intenta abrir un proyecto todavía sin carpeta y prueba con el CLI ausente en un entorno de prueba. Comprueba los mensajes de preparación y de lanzamiento respectivamente.

Si falla, devuelve el sistema operativo, la salida de `code --version`, la acción exacta, la raíz esperada, el archivo activo y el mensaje mostrado. Si pasa, indica en qué sistema lo probaste y si también pasó el ciclo de guardado, reapertura y Play.
