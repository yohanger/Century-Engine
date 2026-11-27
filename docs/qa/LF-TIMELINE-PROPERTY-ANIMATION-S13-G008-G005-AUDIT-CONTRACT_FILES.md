# G005 · Inventario y entrega

**Entrada:** `LF_CAMERA_ORCHESTRATION_S15_G007_INTEGRATION_QA_INTEGRAL_SOURCE_BASELINE.zip` (2.990 archivos, ZIP PASS).  
**Salida:** CHANGE documental y SOURCE_BASELINE acumulativo, exactamente dos ZIP.  
**Autorización:** G005 documental, sin modificación de producción ni scripts.

## Archivos previstos

**Nuevos**

1. `docs/architecture/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G005-AUDIT-CONTRACT_AUDIT.md`
2. `docs/architecture/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G005-AUDIT-CONTRACT_CONTRACT.md`
3. `docs/qa/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G005-AUDIT-CONTRACT_QA-PLAN.md`
4. `docs/qa/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G005-AUDIT-CONTRACT_FILES.md`

**Modificado**

- `docs/qa/LevelForge_DB_Ledger.xlsx` (seis hojas).

**Eliminados:** ninguno.  
**Cambios inesperados:** deben ser cero al contrastar hashes contra baseline.  
**Excluidos del CHANGE:** `node_modules`, builds `dist*`, cachés, temporales y scripts `.sh`. **SOURCE_BASELINE preserva** el archivo histórico sin cambios `scripts/godot-verify.sh` ya presente en el proyecto: no se creó ni se entrega un script nuevo de verificación.

## Aplicación

Aplicar solo CHANGE en la raíz del proyecto que contiene `package.json`, **tras comparar cambios locales del ledger**. Conservar los ZIP anteriores y utilizar el SOURCE_BASELINE completo como base acumulativa del Gate siguiente; no sobrescribir escenas/assets/datos del usuario con el baseline.

**QA esperado:** documentos presentes, XLSX válido con hojas ROADMAP/BACKLOG/DEPENDENCIES/GATES/EVIDENCE/TRACEABILITY, evidencia de autorización y registro de bloqueos; no se espera QA visual ni compilación por ser Gate documental.
