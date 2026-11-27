# S03 CORR-001 — Entrega de QA correctivo

**Gate autorizado:** `LF-EDITOR-DOCKING-S03-G001-INTEGRAL`. **Estado:** corrección implementada; **NO APROBADO**, QA local pendiente. No hay otro Gate ni Sprint.

## Baseline y paquetes

- **Entrada estricta para CHANGE:** `LevelForge_EDITOR_DOCKING_S03_G001_INTEGRAL_SOURCE_BASELINE.zip` (S03 original, no S02 ni otra copia).
- **CHANGE incremental:** `LevelForge_EDITOR_DOCKING_S03_G001_INTEGRAL_CORR-001_CHANGE.zip`: solo rutas nuevas/modificadas respecto a ese baseline S03.
- **SOURCE_BASELINE completo:** `LevelForge_EDITOR_DOCKING_S03_G001_INTEGRAL_CORR-001_SOURCE_BASELINE.zip`: S03 + CORR-001 acumulados, candidato al siguiente Gate **solo cuando se apruebe**.

**Opción recomendada:** extraer el SOURCE_BASELINE CORR-001 completo en una carpeta nueva, por ejemplo `~/Desktop/LevelForge_S03_CORR001_QA/`. Alternativa: extraer CHANGE dentro de una copia del SOURCE_BASELINE S03 anterior y sustituir solamente sus archivos, una vez comparadas diferencias locales. No extraer ambos paquetes uno sobre otro. Conservar backups y proyectos personales sin sobrescritura.

## Cambios

- Vista principal `src/App.vue`: limpia el indicador de destino en dragend/drop/Escape/blur/abandono real. El aviso sobre viewport es compacto y solo existe durante DnD.
- `src/components/DockTree.vue`: la barra de pestañas acepta soltar como pestaña del **mismo grupo** y el cuerpo distingue centro (pestaña) de bordes (división).
- `src/core/editor/docking.js`: decisión de destino geométrica y testeable; no cambia formato `dockLayout`.
- Pruebas Node del Gate, fixture Electron ampliado (35 verificaciones), runner Electron con umbral actualizado.
- CA-002, QA histórico y revalidación, implementación, y ledger de seis hojas.

No se añaden duplicados del sistema de ventanas ni cambios en Player, datos de proyecto, escenas, render, gizmos, Shader Graph ni los gestores de archivos originales. No hay eliminaciones autorizadas.

## Comandos desde la raíz

```bash
npm ci
node --test scripts/test-editor-docking-s03-g001-integral.mjs scripts/test-editor-windows-layout-corr-g001.mjs
node --test scripts/test-editor-docking-s03-g001-integral-electron.mjs
npm run build
npm run electron
```

**Evidencia conocida:** S03 original 76/76 Node, 28/28 Electron y builds Editor/Player PASS reportados por usuario, pero **QA local NO APROBADO** por dos defectos. CORR-001: 82/82 Node focal PASS; regresión cruzada 183/183 Node PASS; fixture Electron 35 comprobaciones preparado, **NO VERIFICADO** con Electron en entorno de entrega; build CORR-001 **NO VERIFICADO**.

**Resultado esperado:** 82 Node PASS/0 FAIL; Electron 1 PASS con 35 verificaciones; build Editor y Player sin fallos de compilación. `npm run electron` inicia el Editor para QA visual. Las advertencias Vite sobre chunks no equivalen a fallos de compilación.

## Pruebas manuales y devolución

Consultar `docs/qa/LF-EDITOR-DOCKING-S03-G001-INTEGRAL_CORR-001_QA.md` para ocho pruebas. Son críticas la unión de **Jerarquía + Proyecto en la misma barra**, la ausencia de división al soltar en pestañas, la limpieza del aviso del viewport al abortar y la persistencia tras reinicio. Devolver salida Electron, build y capturas si hay fallos; el usuario aprueba o rechaza. Mantener SOURCE_BASELINE S03 anterior hasta aprobar.

## Inventario exacto de CHANGE

Se determina por comparación binaria de ZIP antes de empaquetar. CHANGE excluye `node_modules`, `dist`, `dist-player`, cachés, `.git` y temporales. SOURCE_BASELINE es el proyecto completo acumulado.

- Nuevos (3):
  - `docs/architecture/LF-EDITOR-DOCKING-S03-G001-INTEGRAL_CA-002.md`
  - `docs/qa/LF-EDITOR-DOCKING-S03-G001-INTEGRAL_CORR-001_DELIVERY.md`
  - `docs/qa/LF-EDITOR-DOCKING-S03-G001-INTEGRAL_CORR-001_QA.md`
- Modificados (10):
  - `docs/architecture/LF-EDITOR-DOCKING-S03-G001-INTEGRAL_IMPLEMENTATION.md`
  - `docs/qa/LF-EDITOR-DOCKING-S03-G001-INTEGRAL_DELIVERY.md`
  - `docs/qa/LF-EDITOR-DOCKING-S03-G001-INTEGRAL_QA.md`
  - `docs/qa/LevelForge_DB_Ledger.xlsx`
  - `scripts/fixtures/editor/docking-s03-g001-integral.html`
  - `scripts/test-editor-docking-s03-g001-integral-electron.mjs`
  - `scripts/test-editor-docking-s03-g001-integral.mjs`
  - `src/App.vue`
  - `src/components/DockTree.vue`
  - `src/core/editor/docking.js`
- Eliminados: **0**. Inesperados: **0** según comparación contra S03 original.
