# CENTURY-EDITOR-UX-S02-G001-CORR-001-FULL-EDIT-MODE-RUNTIME-OBSERVABILITY-AND-DOCKING

## Autorización

- Amendment: `CE-EDITOR-UX-CA-001-EDIT-PLAY-INDEPENDENT-AUTHORITY-AND-DOCKING` ratificado por el usuario.
- Gate: `Listo. CENTURY-EDITOR-UX-S02-G001-CORR-001-FULL-EDIT-MODE-RUNTIME-OBSERVABILITY-AND-DOCKING autoriza comenzar`.
- Fuente exclusiva: `source_baseline(5).zip` (sin metadatos Git ni dependencias instaladas). El ZIP completo se conserva, salvo diferencias enumeradas en el CHANGE.

## Implementación realizada

### Docking

- Distribución inicial: Jerarquía, Proyecto, Inspector, Consola y las dos vistas; auxiliares restantes ocultos y disponibles.
- Layouts previos preservados mediante `normalizeDockLayout`; reparaciones impiden que `sceneView` y `gameView` queden ocultos, perdidos o desplazados a zonas auxiliares. Ambas vistas admiten separación en centro y estado flotante.
- Las ventanas auxiliares flotantes pueden cerrarse para ocultarse; las vistas obligatorias no presentan cierre, pero sí retorno al docking.
- Se extienden las autoridades existentes; no se crea un gestor nuevo.

### Edit/Play

- La sesión de juego sigue siendo única. La selección y la herramienta editorial no se limpian al entrar en Play.
- El canvas de Edit Mode usa la cámara de observación independiente y conserva la selección mediante el raycast existente. Soporta selección múltiple y de terreno según las rutas existentes.
- Los `TransformControls` originales se desconectan/reconectan al canvas editorial; no se crean controles duplicados. El overlay de cajas y gizmos es temporal y se restablece después de renderizar, para evitar mostrar ayudas editoriales en Play.
- El foco y el estado de los controles del jugador se separan al activar Edit Mode.
- La última pose de la cámara editorial se devuelve a la vista de edición al detener Play.
- Inspector y navegación/atajos generales reciben rutas de uso durante observación, pero no se asegura paridad total de todas las herramientas.

### Diagnósticos

- `THREE.CameraHelper` usa la cámara real de la sesión; el frustum se actualiza durante la ejecución.
- La clasificación `fuera del frustum` es un cálculo geométrico de intersección con mallas visibles, no una lectura directa de contadores internos del backend WebGL.
- La vista de oclusión reutiliza `CameraOcclusion.draw()` de la cámara del juego y expone su causa de indisponibilidad (`disabled`, `no-bake`, `outside-grid`, `camera-mode`) y los descartes en la máscara.
- Los helpers son editoriales y su dibujo no modifica de forma persistente las decisiones de visibilidad del juego.

## Límites pendientes y riesgos técnicos

- La entrada en Play todavía finaliza Edit Mesh y pintura antes de iniciar la sesión. Sus herramientas complejas, el modo de colocación y otras acciones basadas en punteros del viewport original no poseen paridad completa con el canvas observador.
- El editor y el runtime utilizan parte del mismo estado de objetos durante Play. NO se ha implementado un canal transaccional o copia editorial separada que pruebe la independencia de escrituras persistentes frente a física/scripts. Esta garantía del Amendment permanece **PENDIENTE**.
- La vista de observación utiliza un segundo contexto WebGL y hasta 30 FPS, con escala de píxel dependiente del viewport; la carga GPU/CPU, el foco, cámara múltiple y la interacción real requieren QA Electron.
- La representación geométrica fuera de frustum y los ocluidos estáticos no certifican por sí solos todos los descartes GPU, clusters o todas las rutas de render.
- No se certifica compilación del SFC Vue, compilación Vite, Electron, Jolt ni Player: dependencias ausentes y registro npm inaccesible en el entorno de implementación.

## Decisión de estado

**Implementación PARCIAL · QA Node de alcance delimitado PASS · NO COMPILADO · QA VISUAL NO VERIFICADO · NO APROBADO · NO CERRADO**.

No promover a cerrado hasta abordar la autoridad de escrituras Edit/Play, la paridad de herramientas, el rendimiento de vistas simultáneas y la aprobación del usuario.
