# LevelForge — S04 CORR-004 · Script Editor sin límites de diálogo

**Gate original vigente:** `LF-SCRIPT-EDITOR-GODOT-UX-S04-G001-INTEGRAL`.
**Estado:** IMPLEMENTADO, pruebas Node PASS; **Electron CORR-004 NO VERIFICADO**, build CORR-004 NO VERIFICADO, QA visual **PENDIENTE**. S04 **NO APROBADO / NO CERRADO**.
**SOURCE_BASELINE de entrada:** `LevelForge_SCRIPT_EDITOR_GODOT_UX_S04_G001_INTEGRAL_CORR-003_SOURCE_BASELINE.zip`.

## Evidencia y diagnóstico

En CORR-003 el usuario obtuvo **27/27 Node PASS**; el test Electron SE-E01 falló en la comprobación 27, con **26 comprobaciones previas PASS** (la comprobación 28 no se ejecutó). Medidas: `editor=601.59375x341.9375`, `window=640x381`, con el marco de ventana correctamente maximizado.

**CAUSA RAÍZ CONFIRMADA EN FUENTE:** `src/styles.css` define `.edwin { max-width:94vw; max-height:min(82vh, ...); }` para diálogos. El Script Editor utiliza `.edwin.se { width:100%; height:100% }`, sin neutralizar esos máximos; el tamaño resultante coincide con ambos porcentajes. Es un conflicto de cascada CSS, no de CodeMirror ni del cálculo del marco flotante.

## Mecanismo y límites

- Modificar **únicamente** la regla `.edwin.se` en `src/components/ScriptEditor.vue` para establecer `max-width:none` y `max-height:none`. Mantener `min-width:0`, `min-height:0`, flex y CodeMirror como están.
- No alterar la clase `.edwin` global: los diálogos existentes conservan sus límites.
- Reforzar el fixture Electron para comprobar rectángulos reales de ventana/editor, `getComputedStyle(...).maxWidth/maxHeight`, CodeMirror y recuperación de geometría.
- Añadir regresión Node `scripts/test-script-editor-window-corr004.mjs`; preservar el resto de pruebas S04, S03 y Multiscript.
- Sin cambio en ventanas ajenas, Player, escenas, runtime, exportación, formatos, preferencias o UI Designer S05.

## QA ejecutado en el entorno de entrega

- `node --test scripts/test-script-editor-window-corr004.mjs scripts/test-script-editor-window-corr003.mjs scripts/test-script-editor-window-corr002.mjs scripts/test-script-editor-godot-ux-s04-g001-integral.mjs`: **31/31 PASS**.
- Regresión extendida (los cuatro scripts anteriores más docking S03, geometría WL y Multiscript G001/G002/G003): **180/180 PASS**. Evidencia: `docs/qa/evidence/LF-SCRIPT-EDITOR-GODOT-UX-S04-G001-INTEGRAL_CORR-004/node-cross-180-pass.log`.
- Intento de integración Electron: **NO VERIFICADO**; aborta antes del fixture por falta de Vite en el entorno.
- Intento de build: **NO VERIFICADO**; `vite: not found`.

## QA que ejecuta el usuario

Desde la raíz de **S04 CORR-004**:

```bash
node --test scripts/test-script-editor-window-corr004.mjs scripts/test-script-editor-window-corr003.mjs scripts/test-script-editor-window-corr002.mjs scripts/test-script-editor-godot-ux-s04-g001-integral.mjs
node --test scripts/test-script-editor-godot-ux-s04-g001-integral-electron.mjs
npm run build
npm run electron
```

Esperado: Node **31 PASS**, Electron `SE-E01` **1 PASS con 28 comprobaciones**, y build Editor/Player exitoso; esos resultados todavía no están acreditados para CORR-004.

QA visual imprescindible: maximizar Script Editor en Electron de tamaños normal y reducido; comprobar relleno horizontal y vertical **del contenido**, no solo del marco; confirmar que CodeMirror, barra de herramientas, archivos/métodos y barra de estado llenan el área; restaurar ventana y probar posición X/Y; comprobar dock/undock. Verificar que los diálogos ajenos continúan con sus límites anteriores.

Devolver la salida de `SE-E01`, build y una confirmación visual. **No cerrar S04 sin aprobación del usuario.**

## QA usuario / cierre — 2026-11-03

CORR-004 revalidado: **31/31 Node PASS; SE-E01 28/28 Electron DOM PASS; build Editor 826 y Player 414 módulos PASS**. El usuario declaró «AProbado» tras comprobar visualmente la ventana maximizada. **QA LOCAL PASS DECLARADO; Gate APROBADO Y CERRADO en alcance**.

Esta sección posterior sustituye el estado PENDIENTE del encabezado histórico, sin borrar intentos fallidos. Registro íntegro y cierre: `docs/qa/evidence/LF-SCRIPT-EDITOR-GODOT-UX-S04-G001-INTEGRAL_CORR-004/user-local-retest-2026-11-03.log` y `docs/qa/LF-SCRIPT-EDITOR-GODOT-UX-S04-G001-INTEGRAL_CLOSE.md`.

IntelliSense de anotaciones de tipos: **PENDIENTE PLANIFICADO, al final; fuera de S05**.
