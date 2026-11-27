# LevelForge — LF-SCENE-INSPECTOR-S01-G001 · Separar Cuadrícula y Snap de Escena

**Autorización exacta:** `Listo. LF-SCENE-INSPECTOR-S01-G001 autoriza comenzar` · 2026-10-26.  
**SOURCE_BASELINE de entrada:** `LevelForge_PHYSICS_GIZMO_S01_G001_SOURCE_BASELINE.zip`, 804 archivos, íntegro.  
**Estado:** implementado y regresión automatizada PASS; compilación de Editor/Player y QA visual local pendientes.

## Problema confirmado

`src/components/ScenePanel.vue` incluía un `<details>` titulado **Cuadrícula y snap**, con seis controles para Movimiento, Rotación, Escala y sus intervalos. Sin embargo, las mismas configuraciones ya son editables en `src/components/SnapControls.vue`, componente reutilizado directamente en `src/components/Toolbar.vue`.

La cuadrícula del visor sigue siendo una herramienta editorial gestionada por `src/components/ViewBar.vue`. Los valores del proyecto continúan persistidos en `project.settings` y consultados desde `src/core/editor/snap.js` tanto por edición de objetos como por Edit Mesh.

## Cambio mínimo realizado

1. Se eliminó **únicamente** el `<details>` duplicado del Inspector de Escena. No se modificaron otros controles de entorno, GameManager, cielo, clima, iluminación, agua, bake, terreno o restauración.
2. `SnapControls.vue`, `Toolbar.vue`, `ViewBar.vue`, `snap.js`, `project.js` y el runtime permanecen **idénticos a los archivos de entrada**.
3. Se actualizó la prueba heredada `G005-12` de `scripts/test-editor-ux-s01-g005.mjs`: verificaba la presencia de los controles duplicados por contrato del Gate anterior; ahora verifica la exclusividad en Toolbar, que es el nuevo contrato explícito.
4. Se incorporó `scripts/test-scene-inspector-s01-g001.mjs` (11 verificaciones de UI, centralización, compatibilidad, migración y consumidores de snap).

**Decisión sobre `updateSettings`:** no se retiró su importación en `ScenePanel.vue` porque todavía existe una referencia en el bloque oculto `v-if="false"` de exportación heredada. Eliminarla dejaría un identificador sin resolver en el template si ese bloque se reactiva. No se interviene el bloque obsoleto en este Gate.

## Evidencias de ejecución

- Pruebas focalizadas: `node --test scripts/test-scene-inspector-s01-g001.mjs scripts/test-editor-ux-s01-g005.mjs` → **27 PASS / 0 FAIL**.
- Regresión acumulada: `find scripts -maxdepth 1 -name 'test-*.mjs' ! -name 'test-starcat.mjs' -print0 | sort -z | xargs -0 node --test` → **1397 PASS / 0 FAIL / 18 SKIP** (1415 pruebas registradas; 11 nuevas).
- `npm run build` → **NO VERIFICADO** (`sh: 1: vite: not found`, dependencias ausentes en este entorno).
- `test-starcat.mjs` permanece excluido de la regresión porque depende de `three`, no instalado aquí; se mantiene el estado previo de esa limitación.
- Electron, Film Maker, Player y la interacción visual real → **NO VERIFICADOS** localmente.

## QA local del usuario

- [ ] Ejecutar `npm ci` y `npm run build` en la copia completa del SOURCE_BASELINE, sin sobrescribir la instalación principal.
- [ ] Iniciar `npm run electron:dev`; abrir el Inspector de Escena y confirmar que no existe «Cuadrícula y snap».
- [ ] Verificar que Nivel, Iluminación celestial, Clima, Cielo, Nubes, Iluminación horneada, Agua/terreno y GameManager conservan sus controles.
- [ ] Desde Toolbar → Snap, activar/desactivar Movimiento, Rotación y Escala y modificar sus intervalos.
- [ ] Mostrar/ocultar cuadrícula desde ViewBar; confirmar funcionamiento del atajo G.
- [ ] Probar snaps en transformaciones de objetos, gizmos y Edit Mesh sin abrir el Inspector de Escena.
- [ ] Guardar/reabrir una escena y comprobar que los ajustes existentes permanecen, incluso con proyectos antiguos.
- [ ] Iniciar Film Maker y Player y confirmar ausencia de regresiones relacionadas con esta reorganización editorial.
- [ ] Comprobar que no hay errores en la consola de Electron.

## Alcance, compatibilidad y entrega

No se cambian esquemas, migraciones, recursos ni estado persistido. El flujo y las APIs de snapping son idénticos al baseline de entrada. Los dos ZIP entregados serán:

- `LF-SCENE-INSPECTOR-S01-G001_CHANGE.zip`, solo los archivos nuevos/modificados (código, pruebas, QA, ledger).
- `LevelForge_SCENE_INSPECTOR_S01_G001_SOURCE_BASELINE.zip`, copia acumulada completa, sin `node_modules`, `dist`, cachés ni archivos de sumas SHA.

El Gate queda **pendiente de aprobación visual del usuario** a pesar de la regresión automática PASS.
