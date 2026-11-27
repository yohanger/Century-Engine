# LF-HUB-TEMPLATES-S01-G001 — Hub y plantillas de Player

**Autorización:** `Listo. LF-HUB-TEMPLATES-S01-G001 autoriza comenzar` (26-10-2026).
**SOURCE_BASELINE de entrada:** `LevelForge_EDITOR_UX_S01_G005_EXT_002_SOURCE_BASELINE.zip`, 768 archivos.
**Estado:** IMPLEMENTADO / QA AUTOMATIZADO PASS / COMPILACIÓN NO VERIFICADA / QA ELECTRON Y PLAYER PENDIENTE.

## Alcance implementado

- [X] El Hub reutiliza `WelcomeScreen.vue`, la gestión de proyectos recientes y las acciones de abrir, importar, duplicar y quitar con protección de proyecto abierto. Navegación lateral y apariencia oscura inspirada en el Project Browser de Unreal; sin copiar marca o recursos.
- [X] Creación integrada en la pantalla principal: selección visual de plantilla, descripción y número de objetos, nombre, directorio, renderizador Forward+/Mobile/Compatibility y botón «Crear y editar».
- [X] Registro extensible de plantillas en `core/templates/index.js`; el tipo de Player tiene una sola fuente: `template.game.player`, registrado en `engine/runtime/player/index.js`.
- [X] Empty nueva (`empty-project`) con escena sin objetos, sol, cámara ni Spawn; terreno inicial desactivado; Database sin `player`, actores, grupo ni registros de demostración; entradas de InputMap integradas sin bindings. El editor seguirá pudiendo añadir terreno/objetos posteriormente.
- [X] First Person conserva **id legado** `empty`, sol, Spawn, controlador FPS, Database original e InputMap original. La plantilla `blank` permanece en Compatibilidad, con sol y cámara principal.
- [X] Los proyectos anteriores sin campo `template` conservan `empty` como predeterminado de migración (FPS), aunque la elección predeterminada para crear proyectos nuevos sea `empty-project`.
- [X] Database normaliza la marca explícita `noPlayer` para evitar crear el registro de jugador en Empty; DatabaseModal omite su sección «Jugador» para ese proyecto; los proyectos legados sin marcador mantienen el comportamiento anterior.
- [X] NoPlayer acepta configuración ausente del jugador. El runtime ya ofrece estado `noCamera` cuando la escena carece de cámara y de jugador, sin crear una cámara oculta.

## Validaciones automatizadas

- [X] `node --test scripts/test-hub-templates-s01-g001.mjs` → **27 PASS / 0 FAIL**: estructura Empty, normalización repetida, Party sin miembros, id legado, input vacío, terreno desactivado, renderizador, pantallas y seguridad.
- [X] Regresión secuencial de los scripts de test (excluyendo `test-starcat.mjs`, que también estaba excluido en el baseline de entrada) → **1111 PASS / 0 FAIL / 18 SKIP**.
- [X] `node --check` para los módulos `.js` modificados → PASS.
- [ ] `npm run build` (Editor + Player) → NO VERIFICADO: `vite: not found` en este entorno de entrega.
- [ ] Validación de la UI Vue mediante compilación y QA visual Electron → NO VERIFICADO.

## Limitaciones, compatibilidad y riesgos

- La creación en disco utiliza exactamente `createProject()` y `disk.pickDirectory()` previos. Si no se escoge carpeta cuando el entorno la exige, no se crea nada.
- La plantilla Empty contiene estructuras mínimas del motor (carpetas, metadatos del proyecto, esquemas del sistema e InputMap integrado sin asignaciones). **No crea nodos, terreno visible, Spawn ni registro de jugador.** Su estado de creación es serializable sin seleccionar cámara.
- La propiedad `database.noPlayer` es una marca explícita persistente para evitar que `normalizeDatabase()` reconstruya un jugador. Cambiar un proyecto Empty a un Player diferente deberá acordarse en un Gate futuro; no se añade un asistente de conversión de Player en este Sprint.
- Las fichas de plantilla usan previsualizaciones CSS esquemáticas, no capturas reales de una escena renderizada. La generación de imágenes de ejemplo por plantilla no está incluida.
- No se alteran materiales, postprocesado, GameManager, DontDestroyOnLoad, Shader Graph, menús del Editor ni los identificadores de plantillas antiguas.
- Un proyecto Empty sin cámara permanece en negro en Play/Player y el estado `noCamera` indica falta de cámara; el usuario deberá crear una cámara para mostrar la escena.

## [ ] QA local de aceptación

1. [ ] Abrir Hub, comprobar panel de recientes, búsqueda, orden y miniaturas.
2. [ ] Abrir/importar/duplicar/quitar un proyecto inactivo; comprobar que no se puede quitar el proyecto abierto.
3. [ ] Ir a Nuevo proyecto: elegir Empty y revisar descripción; cambiar nombre, carpeta y renderizador.
4. [ ] Crear Empty; en la escena: 0 nodos, sin cámara, sol, Spawn ni terreno visible.
5. [ ] Abrir Database: sin protagonista, sin grupo inicial ni ficha Jugador; guardar y reabrir; volver a comprobar.
6. [ ] Ver InputMap Empty: acciones integradas sin asignaciones. Comprobar que no hay FPS ni captura de ratón.
7. [ ] Entrar a Play en Empty sin cámara: no falla y señala ausencia de cámara; añadir cámara y comprobar reproducción.
8. [ ] Añadir un objeto y terreno manualmente a Empty; guardar, cerrar y reabrir.
9. [ ] Crear First Person: sol, Spawn, InputMap de FPS, Database del jugador; comprobar movimiento.
10. [ ] Abrir proyecto anterior `template=empty` (FPS) y `template=blank` sin cambios.
11. [ ] Guardar/exportar/importar `.lfproj` creado con Empty y comprobar que Database no regenera jugador.
12. [ ] `npm run build` y probar Editor/Player exportado en Linux; valorar rendimiento en 1366×768/4 GB RAM.

**Condición de cierre:** aceptación del usuario tras build y QA visual sobre su instalación. No se considera verificado Electron o Player solo por los tests de Node.
