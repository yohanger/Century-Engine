# LF-SCENE-INSTANCING-G001-INTEGRAL — Entrega y evidencia QA

**Gate:** autorizado por el usuario. **Estado:** IMPLEMENTADO EN COPIA AISLADA; TEST PASS PARCIAL; COMPILADO NO VERIFICADO; QA LOCAL ELECTRON NO VERIFICADO; APROBADO PENDIENTE; CERRADO PENDIENTE.

## SOURCE_BASELINE e integridad

- Fuente de aplicación **exacta**: `source_baseline(2).zip`, aportado por el usuario el 17-11-2026.
- SHA-256 del ZIP fuente: `aca27e49d0c4f9a97dff98f7144e86b3a8068c26dcbd48391edf67b38d8b12c5`.
- Repositorio privado de consulta: `yohanger/Narrative-Game-Make-Engine`, `main` en `193615232e6ff391d666820a5de2038b5b4f3421`. **Atención:** el ZIP local contiene cambios de Codex y otros módulos más recientes que difieren del `main` examinado; no aplicar este CHANGE directamente sobre ese commit GitHub.
- GitHub no ha sido modificado. No se ha publicado rama, PR ni commit.
- Aplicación: descomprimir el CHANGE ZIP **sobre una copia de la misma línea base local**, manteniendo rutas relativas. Respaldar los archivos existentes antes de reemplazarlos; no borrar archivos ausentes del CHANGE.
- El paquete NO contiene SOURCE_BASELINE completo, builds, node_modules, cachés ni ejecutables.

## Alcance de implementación

- Registro de `sceneInstance` como nodo transformable sobre Node3D sin nuevo árbol de escena.
- Materialización determinista de hijos vinculados; validación de fuente, ciclos, IDs y señales internas; exclusión de materializaciones derivadas al guardar y en Undo/Redo.
- Edición de la referencia/transform; hijos vinculados visibles en Jerarquía con apertura de escena fuente en doble clic; se restringe modificar copias derivadas.
- Uso compartido del mismo resolver en Editor y Player; carga transitiva desde recursos Scene; control de limpieza de instancias dinámicas, Jolt y PlayMode.
- API `game.scenes.instantiate()` / `game.scenes.destroy()` diferenciada de `game.goScene()` y `game.prefabs`; declaraciones `game-api.d.ts` y documentación.
- Dependencias de escenas en exportación del Player y `.levelpackage`, sin nuevos niveles de arranque implícitos.
- Pruebas específicas de autoría, ID, anidamiento, ciclos, fuentes ausentes, empaquetado, jerarquía y ciclo de vida runtime con dobles de prueba.
- Adaptación mínima de tres runners heredados cuyos simuladores o aserciones estaban atados a la implementación anterior; sin alterar producción por fallos de tests previos ajenos al alcance.

## Ejecuciones y resultados

| Comprobación | Comando | Resultado |
|---|---|---|
| Sintaxis | `node --check` sobre todos los JS/MJS modificados, y script setup extraído de Vues modificados | **PASS**; 0 errores de sintaxis |
| Suite específica | `node --experimental-vm-modules --test scripts/test-scene-instancing-g001.mjs` | **11/11 PASS**; incluye runtime con dobles, NO PlayMode visual |
| Regresión heredada | `node --test scripts/test-scene-clipboard-g001.mjs scripts/test-scene-inspector-s01-g001.mjs scripts/test-node-signals-integration-s07-g001.mjs scripts/test-node-signals-editor-s06-g002.mjs scripts/test-fps-native-player-s16-g007-g002-g003-g001-runtime-prefab.mjs` | **66/80 PASS, 14/80 FAIL**; los 14 nombres fallidos están también en el ZIP fuente intacto (64/80 PASS, 16/80 FAIL). No se detectaron nuevos nombres fallidos en la comparativa. **No equivale a regresión total PASS** |
| Documentación base | `npm run docs:check` | **PARCIAL**: `gen-docs.mjs --check` informa referencia al día; generador web interrumpido: falta dependencia `marked` |
| Compilación Editor + Player | `npm run build` | **BLOQUEADO**: `vite: not found` (no hay `node_modules` instalados en entorno) |
| QA visual Electron embebido | — | **NO EJECUTADO**, no disponible sin dependencias ni pantalla del usuario |
| QA de AppImage y Jolt real | — | **NO EJECUTADO** |

**No marcar QA LOCAL PASS ni GATE CERRADO:** faltan build limpio y validación funcional/visual real de creación/duplicación/arrastre, guardado/reapertura y comportamiento con física y señales. Los tests del resolver usan dependencias inyectadas y los de runtime dobles de prueba; no acreditan ejecución del juego exportado.

## Exclusiones explícitas y decisiones a validar

- No se instancian las propiedades globales de nivel de la escena fuente (terreno, ambiente, streaming). La referencia aporta solo árbol de nodos. Terreno propio del nivel se conserva en su escena fuente.
- En Play, instancias **dinámicas** que requieren propietarios especiales (eventos, navegación, líquidos o terreno) se rechazan con diagnóstico; el Editor usa instancias de autoría estáticas para esas escenas cuando su subsistema lo permite.
- Los hijos vinculados no son overrides editables; se modifican en la escena fuente.
- El Gate no introduce una migración de compatibilidad o formato estable no acreditado.
- La API dinámica `game.scenes.instantiate` requiere incluir la escena fuente en la Build cuando se usa exclusivamente desde scripts y no desde referencias estáticas.

## Archivos del CHANGE

| Ruta relativa | Estado | SHA-256 prefijo |
|---|---|---|
| `docs/referencia/api.md` | MODIFICADO | `2f1215dd429b1a88` |
| `docs/web-src/escenas.md` | MODIFICADO | `c855d3ac9af1041e` |
| `scripts/gen-docs-web.mjs` | MODIFICADO | `7df44ef3cdacfb4b` |
| `scripts/test-fps-native-player-s16-g007-g002-g003-g001-runtime-prefab.mjs` | MODIFICADO | `379d7d53e7f29694` |
| `scripts/test-node-signals-editor-s06-g002.mjs` | MODIFICADO | `69c4cb6604ec6f14` |
| `scripts/test-node-signals-integration-s07-g001.mjs` | MODIFICADO | `d466ec622f28a8a2` |
| `scripts/test-scene-instancing-g001.mjs` | NUEVO | `06f60661ed0e77ac` |
| `src/components/Inspector.vue` | MODIFICADO | `6786844c8f2fc09d` |
| `src/components/SceneTree.vue` | MODIFICADO | `723c180811967f03` |
| `src/core/editor.js` | MODIFICADO | `9c916bdeed5f6e13` |
| `src/core/events/game-api.d.ts` | MODIFICADO | `280506462ef95ee8` |
| `src/core/levelpackage.js` | MODIFICADO | `256243e1e38becb1` |
| `src/core/state/game.js` | MODIFICADO | `d92cf15b3f8c80ea` |
| `src/core/state/objects.js` | MODIFICADO | `8daf0fab7188e4c9` |
| `src/core/state/prefabs.js` | MODIFICADO | `a0f73e060438c5a2` |
| `src/core/state/scene-instances.js` | MODIFICADO | `e744e14365da1f30` |
| `src/core/state/tree.js` | MODIFICADO | `763a7fe0b57fe77a` |
| `src/engine/runtime/events/interpreter.js` | MODIFICADO | `32b0934c4ef9b43c` |
| `src/engine/runtime/events/play-host.js` | MODIFICADO | `81ac8b17aa2ce8a7` |
| `src/engine/runtime/events/play-nodes.js` | MODIFICADO | `9604eb3741df8929` |
| `src/engine/runtime/events/play.js` | MODIFICADO | `1be496f0bf74418d` |
| `src/engine/runtime/nodes/base.js` | MODIFICADO | `4ef57902818d947a` |
| `src/engine/runtime/nodes/index.js` | MODIFICADO | `2c28e6b477c27667` |
| `src/engine/runtime/package/host.js` | MODIFICADO | `fdf84c54745bdf69` |
| `src/engine/runtime/scene/instances.js` | MODIFICADO | `24e5889eb7ae0f33` |
| `src/engine/runtime/scene/objects.js` | MODIFICADO | `ca18b138975adaa9` |
| `src/engine/runtime/streaming/scene.js` | MODIFICADO | `69a8dea1f7a3233a` |

## Siguiente acción

1. Aplicar el CHANGE sobre la línea base local identificada, previa copia de seguridad.
2. Instalar dependencias mediante el procedimiento habitual del proyecto (sin modificar `package.json`), compilar Editor + Player y ejecutar los runners existentes.
3. QA local Electron: crear `Casa`, agregar varios nodos y scripts, instanciar `Casa` en `Mundo`, duplicar, anidar, guardar, reabrir, arrastrar Assets, ejecutar Play, comprobar físicas/señales, destruir instancia dinámica y exportar el Player.
4. Registrar la evidencia real y aprobación del usuario; únicamente entonces se considera Gate aprobado/cerrado.

## Continuación del mismo Gate — sincronización de tipos de VS Code (17-11-2026)

**Evidencia aportada por usuario:** `npm run electron` falló ANTES del arranque, en `scripts/prepare-vscode-extension.mjs:22`, con `Extensión desactualizada: media/game-api.d.ts`. Node local del usuario: `v24.21.0`.

**Causa comprobada (comparación de archivos):** `src/core/events/game-api.d.ts` contenía `RuntimeScenesApi` y `game.scenes`, mientras que `vscode-extension/media/game-api.d.ts` seguía siendo la copia anterior a G001. El CHANGE G001 omitió la copia espejo. La otra pareja verificada (`src/core/events/apiParse.js` y `vscode-extension/lib/apiParse.mjs`) ya coincidía.

**Acción dentro del G001 autorizado:** se ejecutó `node scripts/sync-extension.mjs` sobre la copia aislada basada en `source_baseline(2).zip` + CHANGE G001. El sincronizador oficial actualizó la copia de `game-api.d.ts` sin cambiar scripts de arranque, dependencias, validaciones ni `package.json`.

| Comprobación | Resultado |
|---|---|
| `node scripts/sync-extension.mjs` | PASS — salida: `✓ extensión actualizada` |
| `cmp src/core/events/game-api.d.ts vscode-extension/media/game-api.d.ts` | PASS — idénticos byte a byte |
| `cmp src/core/events/apiParse.js vscode-extension/lib/apiParse.mjs` | PASS — idénticos byte a byte |
| SHA-256 de ambos `game-api.d.ts` | `280506462ef95ee876e692af58a8103aec6c3bd92e7fc9d10d47599c060c4ac1` |
| `node --test scripts/test-fps-native-player-s16-g006-native-interaction.mjs` | PASS — 19/19 |
| `node --test scripts/test-vscode-project-workspace-s01-g001.mjs` | BLOQUEADO en este entorno — `ERR_MODULE_NOT_FOUND: vite` |
| `npm run electron` real (Linux del usuario) | PENDIENTE — requiere reejecución tras aplicar CHANGE |

**Entregables de continuación:** CHANGE correctivo incremental de la copia de VS Code y este registro QA; SOURCE_BASELINE completo reconstruido exclusivamente desde la **copia local aportada por el usuario** más el CHANGE G001 y esta corrección. El SOURCE_BASELINE excluye builds (`dist`, `dist-runtime`, VSIX generado), dependencias instaladas y cachés regenerables; no elimina ningún archivo de la copia de trabajo del usuario. No sustituye el repositorio privado ni afirma un nuevo commit de GitHub.

**Estado:** corrección de tipos **IMPLEMENTADA, comprobación de igualdad PASS**; `COMPILADO`, `QA LOCAL PASS`, `APROBADO` y `CERRADO` continúan **NO VERIFICADOS / PENDIENTES**.

**Próximo QA local:** aplicar el CHANGE correctivo sobre la misma base que ya recibió G001 y ejecutar `npm run electron`. Si falla la reconstrucción VSIX tras superar el cotejo, registrar el nuevo error literalmente y diferenciarlo del fallo corregido.
