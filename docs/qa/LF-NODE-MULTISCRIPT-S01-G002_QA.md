# LF-NODE-MULTISCRIPT-S01-G002 — QA de autoría y migración

**Estado:** IMPLEMENTADO · G002 20/20 Node PASS · REGRESIÓN FOCAL 276/276 Node PASS · Electron/Build NO VERIFICADOS · QA LOCAL PENDIENTE · NO CERRADO.

## Cobertura G002

MS-UI-01..04: migración de `scriptId`, vacío, prioridad de `scriptIds`, corrupción y duplicados.

MS-UI-05..11: alta, rechazo de duplicado/global, eliminación, orden, recurso ausente y recurso reutilizable entre nodos.

MS-UI-12..17: una sola operación en historial, representación nueva, lista del Inspector, drop Assets, indicador SceneTree y serialización JSON.

MS-UI-18..20: bloqueo `.levelpackage` hasta G003; sin motor/jerarquía paralelos; continuidad con G001.

Los controles se evaluaron estáticamente en Node; **no se afirma QA visual del componente Vue**.

## Resultado observado

| Prueba | Resultado |
|---|---|
| `node --test scripts/test-node-multiscript-s01-g002.mjs` | **20/20 PASS** |
| Regresión focal G001, G002, Signals, métodos, Groups, editor de recursos, clipboard | **276/276 PASS** |
| Regresión histórica `test-node-editor-s06-g001.mjs` incluida | **94/95 PASS; 1 FAIL preexistente NE6-16** |
| `node scripts/gen-docs.mjs --check` | PASS |
| `node --check` para JS modificados y pruebas | PASS |
| Electron / Inspector real / WebGL2 | NO VERIFICADO, no hay Vite instalado |
| `npm run build` | NO VERIFICADO, `vite: not found` |
| QA local | PENDIENTE |

**NE6-16:** requiere regla `@container insp (max-width: 340px)` que no existe en `src/styles.css` del SOURCE_BASELINE G001; G002 no la modifica. Incidencia heredada no corregida ni ocultada, no certificada como fallo introducido por G002.

## QA local — comandos

Desde una carpeta nueva con SOURCE_BASELINE S01-G002:

```bash
npm ci
node --test scripts/test-node-multiscript-s01-g002.mjs
node --test scripts/test-node-multiscript-electron-s01-g002.mjs
node scripts/gen-docs.mjs --check
npm run build
npm run electron
```

Comprobar visualmente en Inspector: agregar tres scripts, rechazo de recurso global/repetido, abrir cada script, quitar sin borrar recurso, reordenar por arrastre y botones, Undo/Redo, recurso inexistente, cambio de nodo/escena, guardar/reabrir y Play/Stop. En SceneTree comprobar contador y arrastre desde Assets. Confirmar error explícito al intentar mover escenas con `scriptIds` mediante `.levelpackage` antes de G003. Verificar que nodos legados se abren con su único script.

**QA local del usuario y aprobación:** PENDIENTES. G003 deberá validar interoperabilidad con Prefabs, duplicación, portapapeles, Player y formatos; este Gate no declara esas capacidades como cerradas.

## Aprobación posterior del usuario

El usuario respondió «Aprobado» después de G002 y pidió reservar la limpieza de la Consola para el final de Signals/Terreno. Se registra **QA LOCAL PASS declarado por usuario · APROBADO G002**. La evidencia adicional suministrada mostró G002 20/20 Node PASS, Electron con 15 comprobaciones WebGL2 y compilación Vite Editor/Player PASS, ejecutados desde una carpeta cuyo nombre correspondía a un baseline previo; estos resultados se registran como evidencia declarada, sin atribuirlos automáticamente al SOURCE_BASELINE G002 exacto. No reabrir QA local sin una incidencia concreta.
