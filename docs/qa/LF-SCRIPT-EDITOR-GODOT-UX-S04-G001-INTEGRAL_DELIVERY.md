# Entrega del Gate LF-SCRIPT-EDITOR-GODOT-UX-S04-G001-INTEGRAL

Estado: **IMPLEMENTADO, Node S04 13/13 PASS, QA local PENDIENTE, Electron y build NO VERIFICADOS**.

Fuente: `LevelForge_EDITOR_DOCKING_S03_G001_INTEGRAL_CLOSE_SOURCE_BASELINE.zip`, que incorpora la corrección VCS y el cierre del docking S03.

## Instalación

**Opción A — recomendada:** crear una carpeta de prueba nueva en Linux y extraer allí exclusivamente `LevelForge_SCRIPT_EDITOR_GODOT_UX_S04_G001_INTEGRAL_SOURCE_BASELINE.zip`, conservando las rutas internas. Es la base completa y acumulativa.

**Opción B — incremental:** comparar los cambios locales y extraer exclusivamente `LevelForge_SCRIPT_EDITOR_GODOT_UX_S04_G001_INTEGRAL_CHANGE.zip` sobre una copia idéntica del SOURCE_BASELINE S03 CLOSE. No extraer los dos ZIP uno sobre otro; no sobrescribir escenas/Assets propios ni `node_modules`. Conservar el baseline previo hasta aprobar QA.

La lista de cambios se obtiene de la comparación exacta ZIP de origen → SOURCE_BASELINE S04: únicamente `src/components/ScriptEditor.vue` y `docs/qa/LevelForge_DB_Ledger.xlsx` se modifican; las pruebas/documentos/evidencias del Gate son nuevos. No se eliminan archivos. Los ejecutables Git Linux permanecen con permisos `0755`.

## QA automatizado (desde raíz del proyecto)

```bash
node --test scripts/test-script-editor-godot-ux-s04-g001-integral.mjs
node --test scripts/test-script-editor-godot-ux-s04-g001-integral-electron.mjs
npm run build
npm run electron
```

Esperado: **13 PASS** Node; **1 PASS**, **20 verificaciones** en Electron; Editor y Player compilan. Si faltan dependencias: `npm ci` antes de Electron/build.

La batería cruzada focal en el entorno de entrega fue **212/214 PASS**; únicamente `NE6-16` y `NE6-18` fallan y también fallaban en el baseline de entrada, sin que se hayan modificado sus archivos. No se declara PASS para Electron/build ni QA visual en este entorno.

## QA visual y evidencia a devolver

Ver SE-Q01–SE-Q13 en `docs/qa/LF-SCRIPT-EDITOR-GODOT-UX-S04-G001-INTEGRAL_QA.md`. Comprobar especialmente la navegación entre scripts Global y Nodo, métodos, guardado, búsqueda, formateo y docking S03. Devolver salida del runner Electron, build, y capturas o descripciones de cualquier desviación visual. El usuario decide aprobación/cierre; no actualizar a APROBADO hasta la evidencia local.

## Preservar

No modificar el runtime, editor de interfaces, escena/Assets, Player, VCS ni Multiscript/Signals. Este Gate no autoriza el Sprint S05 de UI Designer.

## Actualización CORR-001 · 2026-11-03

El test Electron original falló solo en la última aserción de canvas (19/20 comprobaciones PASS). El fixture actualizado distingue canvas internos de CodeMirror del viewport 3D; no cambia producción. **Node específico 14/14 PASS**, regresión S04 + docking + ventanas + Multiscript **163/163 PASS**. Repetir el runner Electron de 20 comprobaciones y QA visual. Este paquete CORR-001 es incremental contra el SOURCE_BASELINE S04 inicial, **no** contra S03. S04 sigue NO APROBADO / NO CERRADO.


## CORR-002 — Entrega posterior a rechazo visual (2026-11-03)

El usuario rechazó los colores, los controles de ventana y el límite horizontal de arrastre. CORR-002 modifica `ScriptEditor.vue` y `FloatingEditorWindow.vue`, amplía fixture y pruebas, y actualiza ledger de seis hojas. No altera CodeMirror/JS runtime, Player, escenas ni formato de proyecto. Base: S04 CORR-001. Estado: NODE PASS, Electron/build NO VERIFICADOS, QA local PENDIENTE. Usar los ZIP CORR-002; esta nota no implica cierre de S04.

## CORR-003 — Ocupación completa de ventana (2026-11-03)

El usuario rechaza CORR-002 visualmente por márgenes en maximizado. Sobre el SOURCE_BASELINE **CORR-002**, modificar únicamente `src/components/FloatingEditorWindow.vue`, ampliar el fixture Electron y el test de regresión, registrar evidencia y actualizar ledger. En maximizado del Script Editor usar x=0, y=36, ancho de pantalla y alto restante. En modo restaurado conserva geometría original; otros editores y docking no se alteran.

Node cruzado **176/176 PASS**. Electron CORR-003 (28 comprobaciones), build y QA usuario pendientes. Aplicar CHANGE CORR-003 exclusivamente sobre S04 CORR-002 coincidente, o usar SOURCE_BASELINE CORR-003 completo en carpeta nueva; no mezclar los dos ZIP. S04 sigue NO APROBADO.

## CORR-004 — Corrección del límite CSS interior (2026-11-03)

El usuario reportó Node 27/27 PASS y Electron 26 comprobaciones PASS antes del FAIL en la expansión interior; la prueba siguiente no se ejecutó. Las medidas `601.6` y `341.94` son los límites de `.edwin` (94vw/82vh). Corrección mínima **solo en `ScriptEditor.vue`**, que anula `max-width/max-height` para `.edwin.se`; estilos globales y otros diálogos intactos. Node CORR-004 específico 31/31 y cruzado 180/180 PASS; Electron/build CORR-004 NO VERIFICADOS. Mantener S04 abierto hasta QA local.

`CHANGE CORR-004` debe aplicarse **solo sobre una copia idéntica de SOURCE_BASELINE S04 CORR-003** tras comparar modificaciones locales, o extraer `SOURCE_BASELINE CORR-004` completo en una carpeta nueva. No combinar ambos. No sobrescribir escenas, Assets o datos locales. Ejecutar pruebas según `docs/qa/LF-SCRIPT-EDITOR-GODOT-UX-S04-G001-INTEGRAL_CORR-004_QA.md`. Preservar CodeMirror, docking S03, VCS, Player y UI Designer; S05 todavía no autorizado.
