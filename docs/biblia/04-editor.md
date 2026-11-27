# Editor, docking y ventanas nativas

## Propietarios

| Área | Fuente |
| --- | --- |
| Composición | `src/App.vue`, `src/components/DockPanelBank.vue` |
| Árbol y destinos | `src/core/editor/docking.js`, `DockTree.vue`, `DockFloating.vue` |
| Gesto nativo | `src/core/editor/native-dock.js`, `dock-gesture.js` |
| Ventanas y contenido único | `src/core/editor/native-tool-window.js`, `native-tool-registry.js`, `AppWindow.vue`, `FloatingEditorWindow.vue` |
| Iconografía de Proyecto | `src/core/editor/asset-icon.js`, `ProjectPanel.vue`, `src/assets/icons/` |
| Accesos de barra y menú | `Toolbar.vue`, `src/core/commands.js`, `src/core/editor/view-dock-session.js` |
| Vistas | `src/core/editor/view-dock-session.js` |
| Shell | `electron/main.cjs`, `electron/preload.cjs` |

<pre>Panel único → destino de DockTree → Teleport
                  ↕                 ↕
            native-dock       ventana Electron
                  └─ retorno a destino montado antes de cerrar</pre>

El flujo de docking conserva la instancia de contenido. El destino se resuelve después del parche Vue (`useMountedDockTarget`); el cierre solicita el retorno antes de cerrar la ventana. Edit Mode, Play Mode y Code tienen identidad de panel propia; activar una vista no debe iniciar ni detener por sí mismo la sesión de juego. El observador editorial y la cámara de gameplay no son la misma autoridad.

Contrato: `CE-EDITOR-DOCKING-CA-003` y las implementaciones de docking nativo / DOM registradas en arquitectura. El comportamiento del drag entre ventanas depende también del gestor del sistema operativo. No se certifica paridad multimonitor o Wayland.

**Pruebas:** `docking-dom-lifecycle-integrity`, `docking-dom-lifecycle-integrity-electron`, `editor-pointer-capture-authority`, suites de Code y vistas. Los resultados anteriores deben consultarse en sus evidencias; esta edición no los ejecuta como certificación.


## Iconografía y accesos de paneles

`allEntries` y `fileKind` mantienen la clasificación del proyecto. `assetIcon` resuelve los recursos gráficos de Proyecto sin importar modelos ni crear un contexto WebGL. OBJ, GLB y GLTF se distinguen por extensión; HDR/EXR/MTL conservan su clasificación de archivo. Las miniaturas reales tienen prioridad en `ProjectPanel`.

Los accesos a paneles están en **Ver → Paneles del editor**. Los comandos consultan el layout actual y reutilizan sus operaciones de ocultación, enfoque y restauración. Edit Mode, Play Mode y Code conservan su arrastre original.

## Autoridad del destino y retorno nativo

`CE-EDITOR-DOCKING-CA-004-NATIVE-DRAG-DESTINATION-AUTHORITY` está ratificado. `dock-gesture.js` distingue el documento que inicia el gesto y utiliza hit-test en el documento principal. El destino válido prevalece sobre la salida nativa; una ventana materializada puede volver a acoplar en el mismo gesto. Los títulos de ventanas compatibles utilizan el mismo gesto y quedan fuera de la región de arrastre del sistema. `moveDockPanel` conserva la identidad y permite insertar una pestaña delante de otra; los recursos solo recuperan una ubicación predeterminada si no tienen destino acoplado. El shell recupera los títulos de ventanas restauradas fuera de pantalla. Las coordenadas negativas se preservan en el layout.

**Estado:** implementado en fuentes; el runner integrado de Electron, la continuidad en compositor real, la transferencia fallida y el escalado multimonitor permanecen sin acreditar. Las 28 pruebas Node de docking y DOM pasan. No se certifica el resultado visual del motor por estas pruebas.

**Pruebas:** `asset-iconography-toolbar`, `asset-iconography-toolbar-electron`, `native-docking-restoration`, `native-docking-restoration-electron`.

### Diagnóstico del destino de acoplamiento

El hit-test de `dock-gesture.js` utiliza el documento principal y las coordenadas de la entrada editorial. La observación opcional `observeDockGesture` registra el resultado de la captura, el elemento alcanzado, el motivo de rechazo de destino, la zona efectiva y las solicitudes de desacoplamiento. El runner nativo separa la presencia de un destino central y la ausencia de una ventana innecesaria. Los eventos DOM y los límites de contenido permiten contrastar las coordenadas sin inferir su correspondencia en DPI o entre ventanas. La suscripción no cambia la autoridad del gesto ni introduce un gestor paralelo.

**Estado de evidencia:** la suite de modelo original pasa; el QA local Electron anterior falla en la comprobación compuesta del destino. La causa raíz y la corrección funcional siguen pendientes. La prueba CDP de DOM aislado no certifica BrowserWindow, IPC ni compositor. Consultar `native-docking-restoration` y `native-docking-restoration-electron`.

### Continuidad de la entrada durante el QA de Docking

La cancelación de un gesto activo ante pérdida de Pointer Capture o movimiento sin botón impide confirmar un destino obsoleto. El runner `qa-electron-native-docking.cjs` puede utilizar XTEST mediante `qa-x11-pointer.py` en X11 para conservar la pulsación del sistema entre ventanas y comprobar su liberación. Las coordenadas se convierten desde el área de contenido; el modo CDP queda separado como prueba de entrada del navegador. No se introduce un gestor de ratón productivo alternativo.

**Estado de evidencia:** el log local acredita destino válido y ausencia de nueva ventana, seguidos de pérdida de captura antes de soltar; el origen de esa pérdida en Electron no está demostrado. El controlador X11 pasa pruebas aisladas y las 33 pruebas de Docking pasan. El nuevo QA integrado y la continuidad nativa real siguen pendientes. No debe ignorarse una pérdida de captura para hacer pasar un runner.

### Validación del umbral de desacoplamiento

La autoridad `shouldDetachDockDrag` exige 12 px de recorrido inicial y 24 px fuera de la franja de pestañas sin destino válido. El runner calcula sus puntos desde la geometría DOM real mediante `dock-detach-points.mjs`, no desde coordenadas fijas. Registra el plan de arrastre y distingue ausencia de ventana por debajo del umbral, solicitud nativa al cruzarlo y creación efectiva. Los umbrales y la prioridad de destinos de producción se conservan.

**Estado de evidencia:** el último QA local con CDP acredita el acoplamiento de Jerarquía en el centro y la limpieza de preview. El escenario posterior agotó su espera con un punto insuficiente para desacoplar; las pruebas aisladas del escenario corregido pasan. El runner corregido completo aún no se ha ejecutado en Electron. No se certifican desacoplamiento, continuidad entre ventanas ni reacoplamiento nativo por estos resultados. El modo XTEST continúa pendiente de verificación en el equipo del usuario.

### Transferencia del foco durante el desacoplamiento nativo

El propietario del gesto es el documento que lo inició. `dock-gesture.js` registra la solicitud nativa antes de cambiar el layout y distingue una transición de foco durante la apertura del panel de una pérdida ordinaria. Durante una transición acotada, las entradas posteriores del gesto solo se aceptan con foco en el Editor o en el documento nativo registrado para ese panel. No se recaptura Pointer Lock ni se asume la transferencia automática de Pointer Capture. Si no continúa la entrada, el timeout restaura la disponibilidad del ratón; Escape, un nuevo clic, cancelación, foco ajeno y destrucción del documento limpian el gesto. La cabecera libre mantiene el arrastre del SO. Solo el título o pestaña de la herramienta acoplable declara `no-drag` y delega en Docking. Los controles interactivos quedan fuera de ambos gestos.

**Compatibilidad:** Wayland nativo restringe coordenadas globales y movimiento programático de BrowserWindow (`setPosition`, `showInactive`, `getPosition`); consultar [BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window). La sesión Wayland no identifica por sí sola el backend efectivo. Las pruebas pueden solicitar X11/XWayland o Wayland mediante `LF_QA_DOCK_BACKEND=x11` / `wayland`. El backend productivo predeterminado no cambia. La modalidad X11 usa XTEST si DISPLAY está disponible; no mezclar ratón físico y CDP. La continuidad depende de que el compositor conserve la entrega de eventos al documento propietario.

**Evidencia:** el último QA local acredita creación de BrowserWindow e identidad flotante, pero cancela por `blur`; el usuario confirma fallo manual de retorno. La corrección supera 45 pruebas Node, pero el runner Electron está bloqueado en el entorno de intervención. No se certifican continuidad física, reacoplamiento real ni compatibilidad del compositor.

### Separación del movimiento de ventanas y Docking

`AppWindow.vue` y `FloatingEditorWindow.vue` reservan el espacio libre de la cabecera para el gestor de ventanas (`-webkit-app-region: drag`). El título o pestaña conserva `no-drag` y `startDockGesture`. El movimiento convencional no depende de `BrowserWindow.setPosition()`. No se modifica la distribución ni `ContinuousGrab`. El IPC de posicionamiento registra rechazo, posición observada o no confirmada, con coordenadas solicitadas y leídas, backend solicitado y sesión; no certifica la posición física si el compositor no expone sus coordenadas. Los diagnósticos se acotan y no se repiten para estados consecutivos iguales.

El QA local anterior acreditó 22 comprobaciones en CDP solicitando Wayland y compilación de Editor y Runtime. X11 solicitado falló antes de detectar el centro; el estado de XTEST cambió pero el renderer no recibió el movimiento esperado. El usuario confirmó una regresión manual del movimiento. El nuevo runner X11 comprueba desplazamiento real de los bounds al arrastrar el área libre y que no se inicie Docking; CDP deja ese criterio explícitamente no verificado. La nueva implementación tiene 46/46 pruebas Node, 70/70 ratón y 9/9 Edit Mesh; Electron y movimiento/reacoplamiento físico siguen sin acreditarse. No se modifica el backend por defecto.
