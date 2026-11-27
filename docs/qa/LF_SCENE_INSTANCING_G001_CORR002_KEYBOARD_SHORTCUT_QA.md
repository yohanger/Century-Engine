# LF-SCENE-INSTANCING-G001-CORR-002-KEYBOARD-SHORTCUT

**Fecha:** 2026-11-17  
**Estado:** AUTORIZADO · IMPLEMENTADO · TEST PASS · COMPILACIÓN NO VERIFICADA · QA VISUAL ELECTRON PENDIENTE · NO APROBADO · NO CERRADO

## Autoridad y continuidad

- Autorización literal del usuario: `Listo. LF-SCENE-INSTANCING-G001-CORR-002-KEYBOARD-SHORTCUT autoriza comenzar`.
- Gate padre integral de escenas instanciables y CORR-001 UX ya implementados. Esta corrección solo extiende el acceso del Editor.
- Fuente real: `LF_SCENE_INSTANCING_G001_CORR001_GODOT_WORKFLOW_UX_SOURCE_BASELINE.zip`. Se preserva completo; CHANGE incremental calculado contra ese ZIP.
- No hay modificación de Github, APIs de scripts, serialización ni expansión de instancias.

## Hallazgo verificado

`src/core/editor/keys.js` capturaba `mod && k === 'a'` sin distinguir `Shift`. Por ello, **Ctrl+Shift+A ejecutaba Seleccionar todo** en vez de abrir el selector de escenas. El selector anterior vivía dentro de `SceneTree.vue`, que el docking puede desmontar cuando no está visible, de modo que un acceso global desde teclado no podía depender de su presencia.

## Mecanismo mínimo integral

1. **Control central:** `src/core/commands.js` registra `scene.instantiate`, con el atajo `Ctrl Shift A` visible en la paleta, y ofrece `openSceneInstancePicker()` y `canParentSceneInstance()` como único control editorial del selector y de la validez de padres.
2. **Despachador:** `src/core/editor/keys.js` diferencia Ctrl/Meta+Shift+A, Ctrl/Meta+A y Shift+A. No captura pulsaciones repetidas, composición IME, Alt, editores de texto, modales, Play, GameView ni edición de mallas.
3. **UI global existente:** `src/App.vue` aloja **el mismo `SceneInstancePicker.vue` que ya existía**. El botón y menú contextual de `SceneTree.vue` invocan el comando central, incluso si la Jerarquía está desmontada. `src/core/state/state.js` mantiene únicamente el contexto transitorio de esa ventana; no se persiste en proyectos.
4. **Instanciación existente:** la confirmación delega exclusivamente en `instantiateScene()` mediante `S.instantiateScene`. Se impiden solicitudes cruzadas a otro proyecto o escena y se bloquea la doble confirmación durante el `await`.
5. **Ayuda:** `ShortcutsModal.vue` y `docs/web-src/escenas.md` muestran las tres combinaciones. No cambia la API de Runtime o Player.
6. **Pruebas:** se añade `scripts/test-scene-instancing-g001-corr002-shortcut.mjs`, que ejecuta el controlador real de teclado en VM con eventos simulados, y se adapta el runner documental previo CORR001 a la propiedad global del selector, sin eliminar criterios contractuales.

## Inventario del CHANGE incremental

**Archivos modificados (9):** `src/core/editor/keys.js`, `src/core/commands.js`, `src/core/state/state.js`, `src/components/SceneTree.vue`, `src/components/ShortcutsModal.vue`, `src/App.vue`, `docs/web-src/escenas.md`, `scripts/test-scene-instancing-g001-corr001-ux.mjs` (ajuste de QA al propietario global), `docs/qa/LevelForge_DB_Ledger.xlsx` (seis hojas).

**Archivos añadidos (6):** `scripts/test-scene-instancing-g001-corr002-shortcut.mjs`, este documento QA y cuatro registros en `docs/qa/evidence/lf-scene-instancing-corr002/`. **Archivos eliminados: ninguno.**

## Comandos / resultados ejecutados

| Comando | Resultado |
|---|---|
| `node --check src/core/editor/keys.js` | PASS |
| `node --check src/core/commands.js` | PASS |
| `node --check src/core/state/state.js` | PASS |
| `node --experimental-vm-modules --test scripts/test-scene-instancing-g001.mjs scripts/test-scene-instancing-g001-corr001-ux.mjs scripts/test-scene-instancing-g001-corr002-shortcut.mjs` | **29 PASS / 0 FAIL** (11 G001 + 7 CORR001 + 11 CORR002) |
| `node --test scripts/test-editor-add-menu-corr-g001.mjs scripts/test-editor-menubar-ux-g001.mjs` | **16 PASS / 1 FAIL**: la prueba histórica de `ContextMenu.vue` exige el literal `e.key === 'Escape'`; el código actual usa otro mecanismo. **Idéntico fallo al ejecutar el mismo comando sobre el SOURCE_BASELINE sin modificar.** No se atribuye a CORR002. |
| `npm run build` | **NO COMPILADO:** `vite: not found` (dependencias no instaladas en el entorno de ejecución). |
| `npm run docs:check` | Referencia API en sincronía; documentación web **NO VERIFICADA:** `ERR_MODULE_NOT_FOUND` de `marked`, dependencia no instalada. |
| `npm run electron` con Editor visual | **NO VERIFICADO**; requiere ejecución en equipo local del usuario. |

Registros reproducibles en `docs/qa/evidence/lf-scene-instancing-corr002/`: `scene-suite.log`, `menu-regression.log`, `build-attempt.log`, `docs-check.log`.

## QA local exigido antes de aprobación

1. En Editor con un proyecto y al menos dos escenas, pulsar **Ctrl+Shift+A** con Jerarquía abierta y cerrada; el mismo selector debe aparecer en ambos casos y enfocar búsqueda.
2. `Ctrl+A` debe seguir seleccionando los nodos; `Shift+A` debe seguir abriendo Añadir nodo. El atajo de escena no debe seleccionar nodos.
3. Escoger una escena y confirmar. Se crea y selecciona la instancia en la raíz, Undo/Redo funcionan, se guarda y reabre.
4. Desde Jerarquía, **Instanciar escena hija…** debe respetar el padre válido y seguir bloqueando instancias/derivados/bloqueados.
5. Sincronía de foco: dentro de texto, modal, paleta, Play, Edit Mesh, GameView y sin proyecto no debe abrir el selector. Sin repetición de cuadros por tecla sostenida.
6. Cambiar de escena/proyecto con selector abierto debe cerrar una solicitud obsoleta sin instanciar en otra escena. Verificar apertura por botón y paleta de comandos.
7. Ejecutar `npm run electron` y posteriormente QA visual; no marcar QA LOCAL PASS sin evidencia.

## Estado final

**IMPLEMENTADO y TEST PASS.** COMPILADO: NO VERIFICADO; QA LOCAL PASS: NO VERIFICADO; APROBADO: PENDIENTE; CERRADO: NO.
