# CE-EDITOR-DOCKING-CA-003 — Universal Native Window Authority

**Autoridad:** ratificado por el usuario el 22 de noviembre de 2026. Sustituye las restricciones previas sobre ventanas flotantes de herramientas compatibles donde impidan desacoplamiento Electron nativo, sin modificar los contratos de recursos ni las garantías de Edit/Play/Code.

## Decisiones ratificadas

1. El docking existente es la única autoridad de ubicación, identidad, visibilidad y restablecimiento de ventanas de trabajo.
2. Edit Mode, Play Mode y Code son vistas obligatorias, desplazables y no ocultables. Las ventanas auxiliares pueden ocultarse.
3. Los paneles acoplables admiten desplazamiento dentro del editor y salida a BrowserWindow nativo, en una sesión compartida y sin duplicar sus componentes.
4. El gesto comienza cuando el cursor supera 12 px; la liberación nativa se solicita al superar 24 px fuera de cualquier destino válido, sin esperar a soltar el botón.
5. Los editores dedicados Event, Shader Editor, Shader Graph, UI, Database, Localization, Tema y Documentación pueden ubicarse en el docking y en una ventana Electron.
6. Los recursos conservan su autoridad documental, estado de edición, guardado y cierre; los selectores y confirmaciones transitorias siguen como diálogos.
7. La continuidad de arrastre nativo depende del sistema operativo/compositor: no se certificará sin ejecutar QA Electron en X11/XWayland y Wayland.
8. No se incorporan gestores paralelos de docking, sesiones de juego, instancias de CodeMirror ni migraciones obligatorias.

## Preservación

La implementación conserva el layout por defecto, el historial del proyecto y las operaciones Git fuera de su alcance. Un editor de recurso se abre al solicitarlo, no al crear un proyecto nuevo.
