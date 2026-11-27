# LevelForge — S04 CORR-003 · Maximizado del Script Editor

**Gate vigente y autorizado:** `LF-SCRIPT-EDITOR-GODOT-UX-S04-G001-INTEGRAL`.
**Estado:** CORR-003 IMPLEMENTADO · Node PASS · Electron CORR-003 NO VERIFICADO · QA VISUAL NO APROBADO / PENDIENTE DE RETEST. S04 ABIERTO.
**Base vinculante:** `LevelForge_SCRIPT_EDITOR_GODOT_UX_S04_G001_INTEGRAL_CORR-002_SOURCE_BASELINE.zip`.

## Auditoría y causa raíz

- OBSERVADO EN QA USUARIO: el Script Editor aparentemente maximizado deja márgenes alrededor; captura `image(20261103-152940).png` del 2026-11-03. El usuario rechaza la ocupación incompleta del espacio.
- EVIDENCIA USUARIO ANTERIOR: Node S04 19/19 PASS, Electron DOM 24/24 PASS, build Editor 826 módulos y Player 414 módulos PASS. Estos resultados **pertenecen a CORR-002**, no validan esta corrección.
- CAUSA RAÍZ CONFIRMADA EN CÓDIGO: `FloatingEditorWindow.vue` calcula el modo maximizado con `margin=12` y `topMargin=44`, por lo que se reservan 12 px a izquierda/derecha/inferior y 8 px adicionales bajo el menú del Editor, cuya altura real es 36 px.
- DEFECTO CONEXO: `toggleMaximize()` invoca `clampPosition()` al restaurar y puede perder el desplazamiento horizontal previamente elegido (si la ventana estaba parcialmente fuera del viewport).

## Contrato de corrección

- En `FloatingEditorWindow.vue`, únicamente las ventanas con `integratedTitlebar=true` (hoy Script Editor) deben maximizar con geometría `left:0`, `top:36px`, `width:window.innerWidth`, `height:window.innerHeight-36px`.
- El marco maximizado no deja radio de borde, sombra ni bordes que creen un marco flotante. El Script Editor, CodeMirror y su estado siguen dentro del mismo alojamiento.
- Restaurar recupera los valores originales de posición/ancho/alto (en el mismo tamaño de pantalla). Un redimensionamiento real continúa ejecutando la protección de `onResize`.
- Los demás editores que usan `FloatingEditorWindow` conservan la geometría tradicional; docking `isDocked` continúa gobernado por el layout S03.
- No se alteran scripts, CodeMirror, Multiscript, Signals, Player, escena, runtime, exportación ni UI Designer.

## QA ejecutado en el entorno de entrega

- `node --test scripts/test-script-editor-window-corr003.mjs scripts/test-script-editor-window-corr002.mjs scripts/test-script-editor-godot-ux-s04-g001-integral.mjs scripts/test-editor-docking-s03-g001-integral.mjs scripts/test-editor-windows-layout-corr-g001.mjs scripts/test-node-multiscript-s01-g001.mjs scripts/test-node-multiscript-s01-g002.mjs scripts/test-node-multiscript-s01-g003.mjs` → **176/176 PASS**.
- CORR-003 específico: **8/8 Node PASS** (1366x700, 1920x1080, 720x480, restauración, usuarios legados, docking, conservación del desplazamiento, controles/CSS).
- Electron CORR-003: **NO VERIFICADO** (dependencias Vite/Electron no disponibles en el entorno de entrega). Fixture ampliado a **28 verificaciones**.
- Build CORR-003: **NO VERIFICADO**. No declarar un PASS a partir del build histórico de CORR-002.

## QA local requerido

1. Abrir Script Editor flotante, pulsar **Maximize window**. Debe rellenar desde x=0 hasta el borde derecho y desde y=36 hasta el borde inferior. La barra principal de LevelForge sigue visible.
2. Confirmar que no existe margen negro extra, radio redondeado ni sombra de ventana flotante en modo maximizado.
3. Confirmar que CodeMirror y su minimapa se ajustan al área, sin cortar barra de estado, métodos, scripts o controles de cierre.
4. Pulsar **Restore window**: comprobar que recupera ancho, alto y posición flotante previa; probar una ventana parcialmente fuera del borde horizontal.
5. Redimensionar Electron y repetir; comprobar recuperación y responsive sin perder los controles.
6. Dock/undock de Script Editor; abrir un script diferente, guardar, IntelliSense y métodos.
7. Verificar que Event Editor, Shader Editor y Shader Graph no cambian su tamaño maximizado por esta corrección.

Comandos desde la raíz del nuevo baseline:

```bash
node --test scripts/test-script-editor-window-corr003.mjs scripts/test-script-editor-window-corr002.mjs scripts/test-script-editor-godot-ux-s04-g001-integral.mjs
node --test scripts/test-script-editor-godot-ux-s04-g001-integral-electron.mjs
npm run build
npm run electron
```

Esperado (aún NO acreditado localmente): Node 27/27, Electron 1/1 con **28 comprobaciones**, build Editor/Player sin errores y QA visual aprobado por usuario. No cerrar S04 antes de esa validación.
