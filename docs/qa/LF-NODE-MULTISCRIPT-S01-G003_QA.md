# LF-NODE-MULTISCRIPT-S01-G003 — QA

**Estado:** IMPLEMENTADO · TEST AUTOMATIZADO NODE PASS · ELECTRON/BUILD NO VERIFICADOS · QA LOCAL PENDIENTE · NO CERRADO.

## Evidencia ejecutada

| Familia | Evidencia | Estado |
|---|---|---|
| Nuevas MS-INT-01..20 | Migración, Prefabs, dependencia transitiva, remapeo, reuse/skip/missing, Player, Godot | **20/20 PASS** |
| Regresión integrada | G001/G002/G003, Signals S01–S06, scripts, Groups, clipboard, mallas vinculadas | **299/299 PASS · 0 FAIL/0 SKIP** |
| Documentación | `node scripts/gen-docs.mjs --check` | PASS |
| Electron / Jolt WASM / Vue | `node --test scripts/test-node-multiscript-electron-s01-g003.mjs` | NO VERIFICADO (falta Vite) |
| Compilación Editor/Player | `npm run build` | NO VERIFICADO (`vite: not found`) |
| QA del usuario | Editor y Player local, importación/exportación | PENDIENTE |

Las expectativas del bloqueo temporal de `.levelpackage` G002 se sustituyeron por pruebas de dependencia obligatoria; la regresión previa se conserva. No se afirman PASS técnicos no respaldados.

## QA local recomendado

1. Extraer el SOURCE_BASELINE G003 en carpeta nueva, sin sobreescribir G002; ejecutar `npm ci`.
2. Ejecutar `node --test scripts/test-node-multiscript-s01-g003.mjs` (20 PASS esperados), `node --test scripts/test-node-multiscript-electron-s01-g003.mjs`, `node scripts/gen-docs.mjs --check`, `npm run build` y `npm run electron`.
3. Crear nodo con tres scripts y publicar métodos/señales; duplicar por Ctrl+D, Alt+D, Ctrl+C/V y verificar que el orden permanezca, con estado privado independiente entre instancias.
4. Crear/instanciar un Prefab con tres scripts; aplicar, revertir, desvincular, guardar/reabrir `.lfproj`. Comprobar Prefab antiguo con `scriptId` y ausencia de doble representación tras migración.
5. Exportar `.levelpackage` de escena y de Prefab; comprobar que incluye scripts dependientes sin tener que seleccionarlos manualmente. Importar en otro proyecto con renombrar/reutilizar; comprobar el remapeo y la recepción de llamadas. Intentar omitir o reutilizar recurso Global y confirmar error claro.
6. Verificar Build del Player con múltiples escenas y varios scripts por nodo. Confirmar rechazo preventivo de IDs ausentes e incompatibles; en Player probar Play/Stop, callbacks, Groups, Signals y limpieza.
7. Confirmar que Godot bloquea escenas con scripts JavaScript no convertibles en lugar de descartar lógica.

Si el usuario responde «Aprobado» tras estas pruebas, registrar **QA LOCAL PASS declarado por usuario · APROBADO**. Cerrar Sprint Multiscript solo después de considerar toda la evidencia y actualizar ledger. La corrección de Consola queda aplazada al final de los trabajos de Signals/Terreno.

### Batería histórica adicional fuera del alcance

Se contrastaron `test-terrain-node-s01-corr001.mjs` y `test-csg-subtract-node-corr-g001.mjs` contra el SOURCE_BASELINE G002 **sin cambios** y contra G003: ambos devuelven **29/35 PASS y 6 FAIL heredados**. Las seis fallas se producen en fixtures VM antiguas que extraen parcialmente `migrateScene` y omiten `validateSignalConnections` (introducida antes de este Gate). No son fallos nuevos demostrados de G003 ni se corrigen fuera del alcance. Estas 35 pruebas no se incluyen en la cifra focal 299/299. También permanece la incidencia heredada NE6-16 del Inspector responsive.

## Cierre posterior — QA usuario y evidencia local (2026-11-02)

El usuario respondió **«Aprobado»** a la entrega G003 y adjuntó `Texto pegado(20261102-143329).txt` con resultados. Se registra **QA LOCAL PASS declarado por usuario · APROBADO · CERRADO G003 y Sprint Multiscript S01**, sin repetir las pruebas locales.

- Node MS-INT-01…20: **20/20 PASS**.
- Electron E01 Jolt WASM/Player/scriptIds: **1/1 PASS, 25 verificaciones WebGL2**.
- Electron E02 Vue/Inspector/historial: **1/1 PASS, 15 verificaciones WebGL2**.
- `node scripts/gen-docs.mjs --check`: **PASS**.
- `npm run build`: **Editor PASS y Player PASS** (Vite). Los avisos de chunks grandes e importaciones mixtas no impidieron la compilación.
- `npm run electron`: inicia el comando según el log; esto no certifica por sí mismo una sesión visual completa del Player exportado.

**Límite de atribución:** la ruta del terminal adjunto tiene nombre histórico de S06; los tests identificados son G003, pero ese texto no prueba por sí solo qué carpeta o checksum se ejecutó. La aprobación explícita del usuario es la evidencia del QA local G003. Los seis fallos de fixtures VM Terreno/CSG y NE6-16 históricos siguen fuera de alcance; no se declaran resueltos.

Esta actualización de cierre es **solo documental**, incorporada al Gate autorizado de auditoría Signals S00-G001. No introduce cambios de producción en Multiscript.
