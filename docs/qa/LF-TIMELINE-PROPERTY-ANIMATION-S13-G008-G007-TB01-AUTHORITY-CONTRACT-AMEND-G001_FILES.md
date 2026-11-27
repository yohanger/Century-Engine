# S13-G008-G007 TB-01 — Inventario de entrega documental

**Gate autorizado:** `LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G007-TB01-AUTHORITY-CONTRACT-AMEND-G001`  
**Baseline de entrada:** `LF_TIMELINE_PROPERTY_ANIMATION_S13_G008_G006_CATALOG_PERSISTENCE_INTEGRAL_SOURCE_BASELINE.zip` (**2.998 archivos**).  
**Tipo:** Contract Amendment propuesto, **pendiente de ratificación**; G007 técnico **NO AUTORIZADO**.

## Cambios autorizados

**Nuevos (4):**

1. `docs/architecture/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G007-TB01-AUTHORITY-CONTRACT-AMEND-G001_AUDIT.md` — evidencia de código y límites.
2. `docs/architecture/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G007-TB01-CA-001_AMENDMENT.md` — TB01-01..10 propuestas para ratificar.
3. `docs/qa/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G007-TB01-AUTHORITY-CONTRACT-AMEND-G001_QA.md` — 22 escenarios QA para G007 técnico, no ejecutados.
4. `docs/qa/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G007-TB01-AUTHORITY-CONTRACT-AMEND-G001_FILES.md` — este inventario.

**Modificado (1):**

- `docs/qa/LevelForge_DB_Ledger.xlsx` — ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE y TRACEABILITY: actualizar aprobación local de G006; registrar autorización documental G007, Amendment NO RATIFICADO y dependencias del Gate técnico.

**Eliminados:** 0. **Cambios inesperados:** 0. **Módulos productivos modificados:** 0.

## QA de la entrega

- ZIP de entrada verificado con `ZipFile.testzip()` y comparación de entradas.
- El ledger mantiene las seis hojas y sus registros históricos; solo se modifican estados justificados y se agregan filas.
- CHANGE debe contener solo los cinco archivos anteriores; SOURCE_BASELINE completo tiene 3.002 archivos y es base acumulativa.
- No hay nuevas pruebas Node de funcionalidad ni build atribuibles a este Gate documental; no se declarará PASS de Jolt, Electron, Player ni AppImage.
- La ratificación del Amendment es una acción separada; no autoriza G007 técnico ni modifica otros contratos.

## Instrucciones de entrega

Aplicar CHANGE en la raíz de la instalación vigente de G006 (donde está `package.json`), después de comparar si existe un ledger local modificado. Reemplazar exclusivamente `docs/qa/LevelForge_DB_Ledger.xlsx` y añadir los cuatro documentos. No extraer SOURCE_BASELINE sobre proyectos activos, no reemplazar `src`, `scripts`, `.ui`, Assets, bases de datos ni escenas. Conservar baseline anterior, respaldo local y dependencias existentes.
