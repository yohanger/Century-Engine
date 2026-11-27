# S15-G003 CORR-001 · Referencias nativas de nodos para scripting

**Gate:** `LF-CAMERA-ORCHESTRATION-S15-G003-EVENT-CAMERA-CONSUMER_CORR-001`  
**Autorización literal:** recibida el 2026-11-09.  
**Fuente base:** `LF_CAMERA_ORCHESTRATION_S15_G003_EVENT_CAMERA_CONSUMER_SOURCE_BASELINE.zip`.  
**Estado:** IMPLEMENTADO EN FUENTES; QA local y aprobación pendientes. G003 original no está cerrado.

## 1. Diagnóstico antes de modificar

- **OBSERVADO:** `src/engine/runtime/events/play-nodes.js` ya resuelve `game.node(id)` y devuelve `NodeHandle`; hay API de posición, rotación, escala, visibilidad, jerarquía, señales, métodos públicos y validez de sesión. No se necesitaba crear `game.scene.nodes` ni modificar el formato de proyecto.
- **OBSERVADO:** `src/components/SceneTree.vue` ya emite el MIME `application/x-lf-node` con IDs del árbol; `src/components/CodeField.vue` utilizaba CodeMirror pero no recibía este MIME.
- **OBSERVADO:** el JavaScript de un comando de evento aparece en un modal: el arrastre desde una Jerarquía cubierta por ese modal no es un gesto practicable. La selección dentro del propio CodeField es necesaria.
- **OBSERVADO:** el servidor `electron/vscode-bridge.cjs` y el cliente `vscode-extension/lib/bridge.js` soportaban apertura autenticada, pero no inserción sobre el cursor. El arrastre HTML5 entre Electron y VS Code Flatpak no constituye una operación fiable del canal existente.
- **CAUSA RAÍZ ACOTADA:** falta de receptores y operación de inserción en los editores, no falta de referencia runtime.

## 2. Contrato implementado

1. `src/core/editor/node-reference.js` produce únicamente `game.node(<id serializado>)`, con `JSON.stringify` y validación de identificador. No copia transformaciones ni datos privados. Reutiliza la semántica existente de `NodeHandle`.
2. `CodeField.vue` admite un único nodo de la escena activa soltado mediante el MIME existente. Inserta en la posición del cursor de CodeMirror, sin sustituir el editor ni abrir una nueva superficie de edición.
3. El mismo CodeField muestra el selector **Insertar nodo…** para JavaScript multilínea; permite insertar cuando la Jerarquía queda bloqueada detrás del modal. No modifica la selección de Inspector, la escena ni los nodos.
4. El menú contextual existente de la Jerarquía incorpora **Insertar referencia en VS Code**. Pide al servidor Electron que envíe una operación `insertNode` autenticada por el Local Bridge activo. La extensión aplica la inserción en la selección del editor JavaScript activo.
5. La extensión comprueba que ese editor activo sea un `.js` físico en `Assets/` del mismo proyecto y que ese proyecto esté abierto. Rechaza proyectos, documentos o tipos ajenos, y no escribe archivos directamente por el canal de inserción.
6. No se añade una colección de referencias persistentes. El ID vive en el texto de script y se resuelve en runtime contra la escena activa. Un ID eliminado o de otra escena no produce una referencia válida.
7. VS Code se eleva a extensión `0.1.5` y su VSIX integrado se actualiza, conservando el mecanismo oficial de instalación/reapertura. La versión anterior queda sustituida solo como artefacto de extensión, no como datos de proyectos.

## 3. Límites expresos

- El **arrastre directo de Electron a una ventana VS Code Flatpak** no se declara implementado. Se proporciona una operación integrada desde el menú de Jerarquía, más el selector embebido. La equivalencia UX de esa alternativa requiere aprobación específica del usuario.
- `NodeHandle` expone las propiedades públicas ya contratadas. La ampliación específica de propiedades Camera3D (p. ej. FOV) no se introduce sin un contrato separado.
- Una referencia `game.node(id)` puede resultar `undefined` si el nodo no está montado en la escena activa. `is_valid()` comprueba que un handle previamente obtenido sigue existiendo.
- No cambian Camera Orchestration G002, contratos de comandos G003, FPS heredado, Database ni el Player de la plantilla. No hay nuevos servicios, eventos globales ni gestores paralelos.

## 4. Ejecución y propiedad de datos

- La autoría de la referencia sigue en el **script**, no en una tabla externa ni un `SceneManager`.
- El destino editor está limitado por raíz de proyecto y `Assets/*.js`; el servidor reutiliza el token/descriptor del puente y la extensión valida también el archivo real.
- `NodeHandle` permanece bajo el propietario de `PlayMode`; no se expone un objeto Three.js adicional a VS Code ni se transfiere ownership de cámaras.
- Al cerrar/cambiar escena, las referencias de runtime viejas quedan inválidas por el ciclo de vida existente.

## 5. Pruebas y estados

- Suite nueva CORR-001: **9/9 PASS** en entorno Node aislado, con `semver` sustituido temporalmente por una implementación mínima para ejecutar la prueba TCP en esta máquina sin `node_modules`.
- Batería seleccionada de Camera G002/G003, resolución de referencias y VS Code S04: **79/79 PASS**, con la misma limitación del entorno respecto a `semver`.
- VSIX 0.1.5: ZIP íntegro y contrato `readBundle` satisfecho en prueba con la misma sustitución temporal de `semver`. La instalación real en Flatpak y su funcionamiento requieren QA del usuario.
- Vite Editor, Vite runtime exportable, Electron visual, VS Code Flatpak real y QA usuario: **NO VERIFICADOS** en este Gate.

**Siguiente acción:** entregar CHANGE y baseline acumulativo, QA local del usuario, corregir regresiones si aparecen y cerrar solamente mediante evidencia y aprobación. El QA de G003 original conserva su estado pendiente hasta esa decisión.
