# QA · Script Editor Godot UX · S04-G001-INTEGRAL

Estado: **IMPLEMENTADO · NODE PASS · BUILD/ELECTRON NO VERIFICADOS · QA LOCAL PENDIENTE**.

## Pruebas automáticas

Desde la raíz del `SOURCE_BASELINE`:

```bash
node --test scripts/test-script-editor-godot-ux-s04-g001-integral.mjs
node --test scripts/test-script-editor-godot-ux-s04-g001-integral-electron.mjs
npm run build
npm run electron
```

Esperado: **13 PASS** Node; **1 PASS** Electron con **20 verificaciones DOM**. `npm run build` debe compilar Editor y Player. Si las dependencias no están instaladas, ejecutar `npm ci` primero. El fixture Electron usa el runner embebido del proyecto; no se requiere Brave o Chromium externo.

## Matriz local del usuario

| ID | Prueba | Aceptación |
|---|---|---|
| SE-Q01 | Abrir script desde Assets | Se abre el editor existente, documento correcto. |
| SE-Q02 | Lista lateral con carpetas y búsqueda | Nombres reales, acentos y mayúsculas ignorados, sin duplicados. |
| SE-Q03 | Cambiar entre dos scripts globales | Texto e historial del proyecto conservados, solo un CodeMirror. |
| SE-Q04 | Cambiar Global/Nodo | IntelliSense adaptado sin sugerencias falsas de `node` en Global. |
| SE-Q05 | Editar, guardar y reabrir | Guardado sin pérdida de contenido; el estado refleja cambios. |
| SE-Q06 | Métodos, game.define/game.on y regiones | Navegación a posición correcta y destacado del símbolo activo. |
| SE-Q07 | Buscar, reemplazar, diagnósticos, autocompletar, Prettier | Funcionalidad existente sin regresión. |
| SE-Q08 | Ctrl+P, Ctrl+S, Ctrl+H, Ctrl+Espacio, Shift+Alt+F | Ejecutan acciones reales. |
| SE-Q09 | Mostrar/ocultar navegación y minimapa | No cambia documento ni selección; se conserva preferencia. |
| SE-Q10 | Ventana flotante y acoplada S03 | Paneles, foco, dimensiones y contenido se mantienen. |
| SE-Q11 | Ventana estrecha, pantallas 720/1366 y DPI | Sin desbordamiento de controles; editor de texto utilizable. |
| SE-Q12 | VS Code externo y Multiscript/Signals | Integraciones intactas; no se ejecutan scripts al abrir editor. |
| SE-Q13 | Modificar documento durante formateo | No sobrescribir documento distinto ni cambios concurrentes. |

## Evidencia histórica

Regresión cruzada: `212/214` con `NE6-16` y `NE6-18` fallando. La suite NE6 original contra el baseline S03 anterior falla en los mismos casos `16/18`; no se adjudican a S04. No refactorizar Inspector ni estilos globales dentro de este Gate.

Los registros `.log` distinguen intentos sin dependencias de pruebas efectivamente ejecutadas. Node PASS no acredita QA visual, y compilación no equivale a QA local.

## Actualización CORR-001 · fallo Electron proporcionado por usuario

La ejecución local original de SE-E01 fue **19/20 comprobaciones PASS** y **1 FAIL** en la aserción general `!document.querySelector('.se-workspace canvas')`. La corrección modifica solo el fixture y su regresión: permite canvas que pertenezcan a `.cm-editor` pero rechaza cualquier canvas externo y cualquier contenedor de viewport. Test Node específico actualizado: **14/14 PASS**; regresión combinada: **163/163 PASS**. **Electron corregido NO VERIFICADO**, usuario debe repetirlo. Ver la matriz específica `LF-SCRIPT-EDITOR-GODOT-UX-S04-G001-INTEGRAL_CORR-001_QA.md`. El Gate continúa NO APROBADO.
