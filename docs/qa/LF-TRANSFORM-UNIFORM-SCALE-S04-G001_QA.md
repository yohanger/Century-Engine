# QA — LF-TRANSFORM-UNIFORM-SCALE-S04-G001

**Estado:** IMPLEMENTADO; TEST AUTOMATIZADO PASS; COMPILADO NO VERIFICADO; QA LOCAL PENDIENTE; NO CERRADO.  
**Base:** `LevelForge_UI_DESIGNER_UX_S03_G001_SOURCE_BASELINE(1).zip`.

## Evidencia automatizada

- 23/23 nuevas `scripts/test-transform-uniform-scale-s04-g001.mjs`: factor multiplicativo, no acumulación, Escape, Undo único, selección múltiple y pivote, descendientes, primitiva vinculada, factor 1, factores inválidos, padre bloqueado, validación física, teclado S/Enter/Esc y numericTransform existente.
- Regresión seleccionada de 166/166 Node PASS: mezcla las nuevas con transformaciones numéricas de malla, bisel, Shift/Snap, Inspector, loopcut y física.
- Batería más amplia que incluye `scripts/test-editor-inspector-integration-corr-g001.mjs`: 96 PASS / 8 FAIL; los ocho fallos EI se reprodujeron idénticos sobre el SOURCE_BASELINE S03 antes de cambios (6 PASS/8 FAIL). La prueba histórica ejecuta transformaciones contra una implementación con `export` sin preparar el módulo. Se registra como incidencia previa, no se modifica dentro de S04.
- `npm run build`: NO VERIFICADO (`vite: not found` por falta de `node_modules` en este entorno).
- Electron, Player, exportación y serialización `.lfproj` real: NO VERIFICADOS.

## QA local obligatorio

1. `npm ci`, `npm run test:uniform-scale`, `npm run build`, `npm run electron`. Confirmar 23 PASS en test de S04 y compilación Editor/Player sin errores.
2. Crear una caja con tamaño `[2, 3, 4]`; activar Inspector → Escala ×2. Debe resultar `[4, 6, 8]`. Verificar factor 1, factor 0.5 y edición absoluta X/Y/Z.
3. Object Mode: `S`, `2`, `Enter`; repetir `S`, `0.5`, `Esc`. Confirmar un solo Undo/Redo y ningún cambio tras Escape. Probar Ctrl+S para guardar sin confirmar un preview accidental.
4. Seleccionar dos objetos con posiciones distintas; probar centro de escala y proporción de distancias. Repetir seleccionando un padre `Node3D` y su hijo: el hijo no debe escalarse dos veces.
5. Comprobar esfera, cono y cilindro: radios enlazados. Comprobar escaleras, mallas con materiales compartidos y primitivas modificadas.
6. Probar selección con `CollisionShape3D` o descendientes físicos: la escala no debe violar `validateNodeTree` ni dejar cambios parciales. Probar nodos bloqueados.
7. Entrar en Edit Mesh; seleccionar varios vértices, usar `S → 2 → Enter` y Malla → Escala uniforme ×2. Confirmar que cambian solo los vértices y que Undo/Redo revierte una operación.
8. Probar factor negativo/cero en Edit Mesh; no se debe confirmar una geometría inválida.
9. Guardar y reabrir `.lfproj`; comprobar jerarquías y geometría en Editor y Player. Probar exportación si procede.
10. Comprobar Snap, teclado R (gizmo), dimensiones del Inspector y UI a 1366x768 o más estrecho.

**Evidencias a devolver:** salida íntegra de Node/build, capturas del Inspector antes/después, selección múltiple, pruebas de teclado y cancelación, resultados `.lfproj` y Player; mensajes de error si aparecen.

**Cierre:** QA local PASS y aprobación explícita del usuario. No se cierran pruebas no ejecutadas ni se justifica una regresión modificando contratos.
