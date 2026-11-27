# ARCH-G001 — Manifiesto CHANGE / SOURCE_BASELINE

**Gate:** `LF-PERFORMANCE-S17-ARCH-G001-INTEGRAL-OPTIMIZATION-AUTHORITY-AND-DIAGRAMS`  
**SOURCE_BASELINE de entrada:** `LF_PERFORMANCE_S17_G003_AO_G004_INTEGRAL_COMPOSITE_OPTIMIZATION_SOURCE_BASELINE.zip`.  
**Entrega:** dos ZIP: CHANGE documental + SOURCE_BASELINE acumulativo. Sin scripts `.sh` ni SHA-256 externo.

## Nuevos (10)

1. `docs/architecture/LF-PERFORMANCE-S17-OPT-PA-001_PROPOSED.md`
2. `docs/architecture/LF-PERFORMANCE-S17-ARCH-G001-INTEGRAL-OPTIMIZATION-AUTHORITY-AND-DIAGRAMS_AUDIT.md`
3. `docs/architecture/LF-PERFORMANCE-S17-ARCH-G001-CONTINUITY-AUTHORITY.md`
4. `docs/architecture/diagrams/LF-S17-OPT-01-authority.mmd`
5. `docs/architecture/diagrams/LF-S17-OPT-02-lifecycle.mmd`
6. `docs/architecture/diagrams/LF-S17-OPT-03-dependencies.mmd`
7. `docs/qa/LF-PERFORMANCE-S17-ARCH-G001_QA-DOCUMENTAL.md`
8. `docs/qa/LF-PERFORMANCE-S17-ARCH-G001_CHANGE-MANIFEST.md` (este archivo)
9. `docs/qa/evidence/LF-PERFORMANCE-S17-ARCH-G001/SOURCE-AUDIT.md`
10. `docs/qa/evidence/LF-PERFORMANCE-S17-ARCH-G001/VALIDATION.md`

## Modificado (1)

- `docs/qa/LevelForge_DB_Ledger.xlsx`: seis hojas; 14 registros nuevos (2 ROADMAP, 3 BACKLOG, 3 DEPENDENCIES, 1 GATES, 2 EVIDENCE, 3 TRACEABILITY). Ninguna fila histórica borrada o cambiada en su valor según comparación con ledger anterior usando `artifact_tool`.

**Eliminados: 0. Cambios inesperados: 0. Código de producción modificado: 0.** El SOURCE_BASELINE debe tener **3.355 archivos** y CHANGE **11** (10 nuevos + ledger actualizado). El conteo se valida al empaquetar, no representa una compilación ni QA GPU.

## Extracción y uso

- **Opción recomendada:** extraer SOURCE_BASELINE en carpeta NUEVA, por ejemplo `~/Desktop/LF_S17_ARCH_G001_SOURCE_BASELINE/`. No mezclar con `node_modules`, `dist`, cachés, juegos, proyectos o directorios personales existentes.
- **Opción incremental:** extraer CHANGE sobre copia verificablemente intacta del SOURCE_BASELINE AO-G004. Comparar primero los cambios locales, especialmente el Excel; **no sobrescribir historial de trabajo local**.
- **NO** extraer CHANGE encima de SOURCE_BASELINE ARCH-G001 ya entregado (duplicaría operaciones sin utilidad).
- No eliminar ningún archivo del proyecto previo: este Gate no contiene eliminaciones. Conservar ambos ZIP, el AO-G004 original y todo proyecto local. Tras QA, usar el SOURCE_BASELINE nuevo como partida del próximo Gate.

## Verificaciones realizadas / pendientes

- Control de integridad: CRC ZIP y rutas (resultado del proceso de empaquetado).
- Contrato padre marcado **PROPUESTO**, pendiente de ratificación explícita del usuario.
- Documentos y código base auditados sin modificar producción. Esta entrega NO es una optimización GPU ni certificación de rendimiento.
- QA documental del usuario y representación visual de los 3 Mermaid: pendientes.
