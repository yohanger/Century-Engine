# QA de integración — LF-ASSETS-SLOT-DND-S01-G004

**Sprint:** LF-ASSETS-SLOT-DND-S01 (G001–G004)  
**Autorización:** `Listo. LF-ASSETS-SLOT-DND-S01-G004 autoriza comenzar`  
**Fuente:** `LevelForge_ASSETS_SLOT_DND_S01_G003_SOURCE_BASELINE.zip`  
**Estado:** **TEST AUTOMATIZADO PASS; COMPILADO NO VERIFICADO; QA LOCAL PENDIENTE; SPRINT NO CERRADO**.

## 1. Alcance y trazabilidad

G004 no introduce nuevas funciones productivas. Verifica que `ProjectPanel` emita el protocolo `application/x-lf-entry` / `application/x-lf-entries`, que `asset-drop.js` resuelva por ID/tipo contra `allEntries(project)`, y que `ResourceDropSlot` delegue la asignación al setter existente de cada editor. La creación de nodos mediante arrastre en el viewport sigue siendo un mecanismo distinto.

Se ejecutan G001 (26 casos), G002 (15 casos), G003 (21 casos) y G004 (11 casos). G004 extrae y ejercita el catálogo `allEntries` real, evalúa las funciones del receptor de Vue en un entorno de prueba Node, reproduce el gesto de arrastre y comprueba la delegación al propietario. Su verificación JSON y su historial simulado **no sustituyen** el guardado `.lfproj`, el Undo/Redo real, un render Vue ni una prueba en Player.

## 2. Evidencia ejecutada

| Bloque | Resultado | Evidencia / límite |
|---|---|---|
| Integridad de G003 SOURCE_BASELINE | PASS | ZIP sin errores; 1.170 archivos fuente/recursos incluidos |
| G001 + G002 + G003 | **62 PASS, 0 FAIL** | `npm run test:assets-slot-dnd` antes de añadir G004 |
| G004 transversal | **11 PASS, 0 FAIL** | `scripts/test-assets-slot-dnd-s01-g004.mjs`; catálogo → drop → propietario modelado |
| Suite G001–G004 + materiales/Inspector | **159 PASS, 0 FAIL** | Node test; 73 DnD + 86 regresión seleccionada |
| Regresión ampliada, sin filtrar | **140 PASS, 9 FAIL** | 8 EI (`Unexpected token 'export'` del harness viejo), 1 prueba Assets S03 CORR requiere `@vue/compiler-sfc` |
| Test histórico de recursos | **14 PASS, 1 FAIL** | `HC-15` incompatibilidad de serialización ya presente en G003 |
| Reproducción en G003 sin cambios | **10 FAIL preexistentes** | Los mismos 8 EI + 1 dependencia + HC-15 aparecen en el SOURCE_BASELINE recibido |
| `npm ci --offline --ignore-scripts` | BLOQUEADO | `ENOTCACHED` para `zip-stream@4.1.1`; no se instalaron dependencias |
| `npm run docs:build` / `docs:check` | **NO VERIFICADO** | Ausencia de `marked` |
| `npm run build` | **NO VERIFICADO** | `vite: not found` |
| Electron GUI / Player / exportación / `.lfproj` real | **NO VERIFICADO** | Requiere QA del usuario en instalación local con dependencias |

**Distinción:** los nueve fallos de la regresión ampliada y HC-15 no se atribuyen a G004; fueron reproducidos sobre G003 sin modificaciones. El Sprint tampoco se declara PASS integral mientras permanezcan pruebas bloqueadas o no ejecutadas. No se corrigieron archivos productivos dentro de G004.

## 3. Matriz de QA local del usuario

| ID | Interacción | Evidencia requerida |
|---|---|---|
| LOCAL-01 | Abrir Assets Browser; arrastrar audio válido al slot Clip de Audio Source | Captura del valor asignado y audio reproducido en Play |
| LOCAL-02 | Arrastrar imagen al slot Decal | Captura del Decal y referencia del Inspector |
| LOCAL-03 | Arrastrar `.post` a la cámara, Spawn y PostProcessVolume | Captura de cada slot; guardar y reabrir |
| LOCAL-04 | Arrastrar script a nodo y textura a imagen/icono | Confirmar comportamiento heredado sin duplicar nodos |
| LOCAL-05 | Arrastrar `.material` a malla o primitiva | Comprobar material compartido, reemplazo y desasignación |
| LOCAL-06 | Arrastrar shader de superficie; intentar shader `post` (inválido) | Shader asignado y rechazo sin mutación |
| LOCAL-07 | Arrastrar textura al VFX Editor y recurso `.vfx` al nodo VFX3D | Guardar `.vfx`; cada instancia mantiene simulación independiente |
| LOCAL-08 | Arrastrar imagen/retrato y audio en UI Designer | Guardar y reabrir `.ui` conservando referencias por nombre |
| LOCAL-09 | Probar `ParamForm`: audio, textura, modelo, prefab y perfil | Referencias por ID o nombre conforme al contrato existente |
| LOCAL-10 | Soltar recurso incorrecto, eliminado y arrastre múltiple en slot singular | Rechazo seguro, sin cambio de propiedad ni instanciación accidental |
| LOCAL-11 | Reemplazar y desasignar; realizar Ctrl+Z / Ctrl+Shift+Z | Undo/Redo restaura estado mediante setters del editor |
| LOCAL-12 | Guardar proyecto `.lfproj`, cerrarlo y reabrir | Todas las asignaciones persisten; escenas sin pérdida |
| LOCAL-13 | Ejecutar Play y Player exportado | Sin recursos perdidos ni regresiones runtime |
| LOCAL-14 | Compilar y abrir Electron; repetir con ventana estrecha | Sin errores de consola ni desbordes visuales relevantes |

**Nota sobre nombres:** UI Designer y ciertos slots de audio de `ParamForm` persisten nombres por contrato existente. Renombrar el asset posteriormente puede requerir reasignación. No afirmar migración a ID.

## 4. Comandos locales (Linux)

Desde `~/ENGINES/lf-0.26.13/lf` con G004 CHANGE aplicado y sin conflictos locales:

```bash
npm ci
npm run test:assets-slot-dnd
node --test scripts/test-material-surface-detail-s01-g001.mjs scripts/test-material-ux-s01-g001.mjs scripts/test-resource-inspector-g002.mjs scripts/test-resource-inspector-g003.mjs
npm run docs:build
npm run docs:check
npm run build
npm run electron
```

`npm run test:assets-slot-dnd` debe reportar **73 PASS, 0 FAIL**. La regresión seleccionada independiente debe producir **86 PASS, 0 FAIL**. El build y los comandos docs deben acabar sin errores para ser declarados PASS. El QA visual se hace dentro de Electron; registrar capturas, errores de consola, estado de referencias y comportamiento tras volver a abrir el proyecto.

Devolver: salidas completas de tests, compilación y docs, evidencia de LOCAL-01 a LOCAL-14, plataforma/versión utilizada, observaciones y decisión expresa de aprobación del QA. **No cerrar S01 antes de esa evidencia.** Si se detecta un defecto de producto, crear Gate de corrección autorizado; G004 no habilita cambiar código productivo.

## 5. Entrega y continuidad

Se permiten únicamente tests, documentación, runner Node (`package.json`) y ledger del Gate. No se modifican `src/`, `electron/`, `vendor/`, `public/` ni scripts de runtime. Las entregas serán exactamente `LevelForge_ASSETS_SLOT_DND_S01_G004_CHANGE.zip` y `LevelForge_ASSETS_SLOT_DND_S01_G004_SOURCE_BASELINE.zip`, con comparación exacta frente a G003 y exclusión de temporales y builds.
