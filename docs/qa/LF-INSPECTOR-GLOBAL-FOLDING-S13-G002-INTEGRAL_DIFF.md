# Comparación SOURCE_BASELINE S13-G001 → S13-G002

Archivo original obligatorio: `LF_INSPECTOR_GLOBAL_UX_CLEANUP_S13_G001_AUDIT_CONTRACT_SOURCE_BASELINE.zip`.

**Código de producción modificado:** `src/components/InspectorDock.vue` (clave semántica, migración no destructiva, contexto, click/teclado); `src/components/Inspector.vue` (35 atributos de identidad `data-fold-id`, sin cambiar el modelo, los componentes ni las acciones).

**Documento preexistente modificado:** `docs/qa/LevelForge_DB_Ledger.xlsx` (seis hojas, únicamente nuevos registros).

**Archivos nuevos:** pruebas Node/Electron y fixture existente del Inspector; documentos y evidencia de este Gate. No se borran archivos históricos. La inventariación definitiva está en `..._INVENTORY.md`.
