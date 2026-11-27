# LF-VFX-S01-G001 — Implementación, auditoría y QA

Fecha: 2026-10-28 (America/Santo_Domingo). Gate autorizado mediante «Listo. LF-VFX-S01-G001 autoriza comenzar». Estado: **IMPLEMENTADO** con pruebas aisladas; **QA LOCAL PENDIENTE**, **APROBACIÓN PENDIENTE**, **NO CERRADO**.

## 1. Fuente, autoridad y diferencias

- Fuente recibida: `lf(3).zip`; CRC correcto. Incluye 995 archivos de fuente/documentación más 24 archivos de `dist-player/` (salida generada), que se excluyen de ambas entregas.
- El contrato y la declaración de `LF-VFX-S01-G001` se encuentran en `docs/architecture/LF-VFX-S00-G001_SPRINTS.md`. El contrato S00 aún figura pendiente de ratificación documental; el usuario autorizó el primer Gate mediante frase exacta. No se reetiquetó S00 como cerrado.
- Esta entrega continúa **solo** los 995 archivos de fuente recibidos, sin cambios detectados ajenos al Gate en esa copia. No se dispone de un ZIP histórico separado para validar independientemente su identidad frente al SOURCE_BASELINE anterior; no se afirma esa comparación.
- Protección: no se editaron los eventos, el Player, el renderer, las escenas ni la interfaz gráfica.

## 2. Mecanismo instalado

| Componente | Mecanismo real |
|---|---|
| `src/engine/runtime/vfx/resource.js` | Formato `.vfx` v1; valores iniciales; validación estricta de identidad, versión, emisión, nacimiento, movimiento, apariencia y curvas; duplicados de IDs/rutas rechazados. |
| `src/core/project.js` | `project.vfx`, extensión, listado uniforme, carpeta elegida y validación al normalizar, incluida colisión con recursos de otras colecciones. Sin nueva carpeta por defecto. |
| `src/core/lfproj.js` | `project.json` solo lleva índice (id/nombre/carpeta/versión). Cada `.vfx` contiene la definición canónica. La lectura coteja índice/cuerpo, rechaza un archivo ausente/inválido o versión futura sin sustituirlo silenciosamente. |
| `src/core/state/project.js` | Exclusión expresa de `.vfx` del flujo de binarios IndexedDB usado para modelos/texturas, también al abrir archivo. El proyecto persiste su colección en los metadatos habituales. |
| `src/core/state/vfx.js` | Operaciones internas crear/buscar/editar; validación ANTES de mutar; edición continua y confirmación de un solo Undo por gesto. CRUD visible en Assets pendiente de S01-G002. |
| `src/core/state/history.js` y `src/core/store.js` | Snapshot de VFX y carpetas únicamente cuando existen; Undo/Redo restituye ambos sin introducir campos nuevos en fixtures/proyectos antiguos que no los traían. API VFX exportada por fachada actual. |

**No implementado aquí:** interfaz VFX, asignación a nodos, simulación/render, exportación `.levelpackage`, Player, uso de texturas dependientes y reparación de referencias de escenas. Todo permanece **PENDIENTE PLANIFICADO** en G002/S02/S03.

## 3. Evidencia obtenida

| Prueba | Estado | Evidencia / límite |
|---|---|---|
| CRC ZIP de entrada | OK | `unzip -t` sin errores. |
| VFX-Q01: defaults, validación extrema, versión futura, esquema, IDs/rutas duplicadas | **TEST AUTOMATIZADO PASS** | Suite `scripts/test-vfx-resource-s01-g001.mjs`, con fixtures JSON reales. |
| VFX-Q02: JSZip real, índice/cuerpo, importación y proyecto v3 anterior sin VFX | **TEST AUTOMATIZADO PASS** | Misma suite. Para I/O se aísla la dependencia JSZip; ejecuta cuerpos reales del serializador. |
| VFX-Q03: creación/edición, operación inválida atómica, Undo/Redo y gesto de varias actualizaciones | **TEST AUTOMATIZADO PASS** | Misma suite. Historial real ejecutado con un editor falso; **no** se ejecutó un viewport ni una base IndexedDB real. |
| Suite VFX | **23/23 PASS** | Ejecutada con Node v22.16 y una instancia disponible de JSZip local del entorno (no se instaló el lock completo). |
| Regresión `test-project-safe` + `test-resource-history-corr-g001` | **27/27 PASS** | Probadas tras corregir la restauración para evitar añadir campos ausentes en snapshots antiguos. |
| Validación sintáctica de JS editado | OK | `node --check` en archivos afectados. |
| `npm run build` Editor/Player | **NO VERIFICADO** | `npm ci` no completó la instalación en este entorno; `npm run build` devolvió `vite: not found`. No equivale a un fallo demostrado del código. |
| Electron, IndexedDB, proyecto real, QA visual | **NO VERIFICADO** | Requiere el entorno y las pruebas del usuario. |
| Aprobación y cierre | **PENDIENTE** | No recibidos para esta entrega. |

**Límite de evidencia:** el harness ejecuta funciones reales extraídas de módulos con inyección controlada de dependencias, no una aplicación Electron completa. JSZip se prueba con una librería disponible, no se asegura equivalencia de entorno con el lock fijado; repetir tras `npm ci` local.

## 4. Instalación y QA del usuario

La carpeta de referencia histórica es `~/ENGINES/lf-0.26.13/lf`. El CHANGE solo debe aplicarse si esa carpeta corresponde al baseline `lf(3).zip` (excluido `dist-player`) y no tiene cambios locales sin conciliar. Antes, preservar el ledger local.

```bash
cd ~/ENGINES/lf-0.26.13/lf
unzip -t ~/Downloads/LevelForge_VFX_S01_G001_CHANGE.zip
unzip -l ~/Downloads/LevelForge_VFX_S01_G001_CHANGE.zip
```

**Salida esperada:** CRC sin errores; únicamente archivos del manifiesto de este Gate. Comparar `src/core/` y `docs/qa/LevelForge_DB_Ledger.xlsx` con los locales antes de sobrescribir. Si difieren por trabajo propio, **DETENER** y entregar el ZIP local para conciliación, no forzar `-o`.

Si coinciden y no hay cambios locales:

```bash
unzip -o ~/Downloads/LevelForge_VFX_S01_G001_CHANGE.zip -d .
npm ci
node --test scripts/test-vfx-resource-s01-g001.mjs scripts/test-project-safe.mjs scripts/test-resource-history-corr-g001.mjs
npm run build
npm run electron
```

**Esperado:** 50 tests PASS/0 FAIL y generación de las compilaciones Editor y Player sin errores. `npm ci` debe usar el lock existente sin actualizar dependencias. Ejecutar Electron y verificar que un proyecto anterior abre y guarda, con sus escenas, materiales, cámara y eventos intactos. **No aparecerá aún un editor o un botón VFX**, porque se integrarán mediante el Gate G002/S03. Si existe una falla, devolver salida completa, versión Node/npm y pasos reproducibles. No marcar QA local como PASS por la ausencia de error en consola.

La funcionalidad interna VFX ya tiene prueba de archivo con JSZip en el harness; la prueba visual y persistencia IndexedDB/disco con proyecto real deben ratificarse cuando la interfaz de Assets permita crear y editar recursos.

## 5. Continuidad y cierre

Entregar exactamente dos ZIP, sin carpeta envolvente y sin los 24 archivos compilados de la copia local, `node_modules`, temporales, otros scripts auxiliares o checksums separados:

- `LevelForge_VFX_S01_G001_CHANGE.zip`: solo archivos agregados/modificados en este Gate, pruebas, este informe y ledger.
- `LevelForge_VFX_S01_G001_SOURCE_BASELINE.zip`: los 995 archivos base más las modificaciones de este Gate, fuente acumulada para el siguiente Gate.

No tocar `dist-player`, proyectos personales, escenas, plugins o exports locales; tampoco se solicita borrar nada. Conservar ZIP original, dos entregas, evidencia y backups del ledger. Tras QA local y aprobación explícita del usuario, registrar cierre; recién entonces preparar S01-G002.
