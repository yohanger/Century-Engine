# S03 CORR-002 — Entrega incremental de QA

**Gate:** `LF-EDITOR-DOCKING-S03-G001-INTEGRAL` · **Estado al entregar CORR-002 (histórico):** NO APROBADO · QA LOCAL PENDIENTE. **Estado vigente desde 2026-11-03:** APROBADO y CERRADO; consultar CLOSE.

**Base estricta del CHANGE:** `LevelForge_EDITOR_DOCKING_S03_G001_INTEGRAL_CORR-001_SOURCE_BASELINE.zip`. Este CHANGE es incremental sobre esa versión, **no** sobre S03 original ni sobre S02.

**SOURCE_BASELINE:** `LevelForge_EDITOR_DOCKING_S03_G001_INTEGRAL_CORR-002_SOURCE_BASELINE.zip`, copia íntegra de proyecto S03+CORR-001+CORR-002, base del siguiente Gate solo cuando el usuario apruebe S03.

## Instalación

Opción recomendada: extraer SOURCE_BASELINE CORR-002 en una carpeta de QA limpia. Opción incremental: extraer CHANGE CORR-002 sobre una copia exacta de SOURCE_BASELINE CORR-001, tras verificar y preservar cambios locales. **No** aplicar ambos ZIP ni tocar proyectos personales, escenas, Assets y `node_modules`. Conservar la copia anterior hasta aprobar QA.

## Verificación

Desde la raíz:

```bash
node --test scripts/test-editor-docking-s03-g001-integral.mjs scripts/test-editor-windows-layout-corr-g001.mjs
node --test scripts/test-editor-docking-s03-g001-integral-electron.mjs
npm run build
npm run electron
```

Node local: **88/88 PASS**. Suite cruzada focal seleccionada: **136/136 PASS**. Fixture Electron mínimo **44** (NO VERIFICADO localmente). Build Editor/Player CORR-002: NO VERIFICADO localmente. El build S03 original y su runner Electron habían sido reportados PASS por el usuario, pero no representan resultado de CORR-002. Consultar QA CORR-002 para el retest de Jerarquía, Inspector y persistencia.

## Inventario

Los archivos nuevos, modificados y eliminados se determinan automáticamente por comparación binaria de los ZIP. El CHANGE contiene únicamente esos archivos. Se excluyen builds, `node_modules`, cachés y temporales. Se preservan seis hojas del ledger y el historial de rechazos.

**Regresión ampliada con Inspector:** 162/164 PASS en CORR-002, frente a 156/158 en CORR-001, con los mismos dos fallos históricos `S02-16` y `SCENE-09` (ambos preexistentes). No confundir con incidencia de S03.

## Inventario verificado contra S03 CORR-001

**Nuevos (4):**
- `docs/architecture/LF-EDITOR-DOCKING-S03-G001-INTEGRAL_CA-003.md`
- `docs/qa/LF-EDITOR-DOCKING-S03-G001-INTEGRAL_CORR-002_DELIVERY.md`
- `docs/qa/LF-EDITOR-DOCKING-S03-G001-INTEGRAL_CORR-002_QA.md`
- `docs/qa/evidence/LF-EDITOR-DOCKING-S03-G001-INTEGRAL/user-s03-corr001-qa-reject.png`

**Modificados (10):**
- `docs/architecture/LF-EDITOR-DOCKING-S03-G001-INTEGRAL_IMPLEMENTATION.md`
- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `scripts/fixtures/editor/docking-s03-g001-integral.html`
- `scripts/test-editor-docking-s03-g001-integral-electron.mjs`
- `scripts/test-editor-docking-s03-g001-integral.mjs`
- `src/components/DockPanelBank.vue`
- `src/components/DockTree.vue`
- `src/components/Inspector.vue`
- `src/components/SceneTree.vue`
- `src/core/state/objects.js`

**Eliminados:** 0. **Otros cambios inesperados:** 0.
