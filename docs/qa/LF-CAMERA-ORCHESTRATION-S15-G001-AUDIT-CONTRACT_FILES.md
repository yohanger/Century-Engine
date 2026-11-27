# LevelForge — Entrega documental S15-G001 (sin producción)

**Gate autorizado:** `LF-CAMERA-ORCHESTRATION-S15-G001-AUDIT-CONTRACT` (2026-11-09).  
**Estado:** documentación G001 y ledger S15 preparados; **QA usuario, ratificación de Parent Contract y cierre pendientes**.

## Alcance exacto del cambio

**NUEVOS (3):**
- `docs/architecture/LF-CAMERA-ORCHESTRATION-S15-G001-AUDIT-CONTRACT_AUDIT.md`
- `docs/architecture/LF-CAMERA-ORCHESTRATION-S15-PARENT-CONTRACT-001.md`
- `docs/qa/LF-CAMERA-ORCHESTRATION-S15-G001-AUDIT-CONTRACT_QA.md`

**NUEVO (este manifiesto):**
- `docs/qa/LF-CAMERA-ORCHESTRATION-S15-G001-AUDIT-CONTRACT_FILES.md`

**MODIFICADO (1):**
- `docs/qa/LevelForge_DB_Ledger.xlsx` — entradas S15 en ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE y TRACEABILITY. Se preservan filas históricas; no se cierran S13/S14 fuera de alcance.

**ELIMINADOS:** ninguno. **Código de producción y pruebas/scripts nuevos:** ninguno. **Cambios inesperados:** ninguno si la verificación ZIP coincide con este inventario.

## Aplicación segura en Linux

**Preferida para consulta:** extraer `LF_CAMERA_ORCHESTRATION_S15_G001_AUDIT_CONTRACT_SOURCE_BASELINE.zip` en una **carpeta nueva**. No sustituir tu instalación de LevelForge ni tus proyectos; solo leer la documentación y el ledger actualizado.

**Si se integra en una carpeta existente:** comparar las cinco rutas anteriores frente a tus cambios locales, hacer copia de respaldo y aplicar exclusivamente los archivos del ZIP `CHANGE` en las mismas rutas relativas desde la raíz que contiene `package.json`. **No sobrescribir** un ledger local con avances posteriores sin fusionar primero las seis hojas.

No hay comandos de build ni QA funcional para G001, porque no se modificó producción. Para comprobar el inventario sin instalar nada: `unzip -l <nombre-del-ZIP>` (sustituir el marcador por el ZIP real). En la carpeta raíz, abrir los tres documentos y consultar las seis hojas del Excel.

**Evidencia a devolver:** observaciones contractuales (especialmente D03/D04/D06/D09/D12), aprobación/ratificación textual o correcciones específicas. Conservar ambos ZIP hasta revisar y aprobar el Gate. No borrar el SOURCE_BASELINE original ni proyectos, escenas, assets, librerías de usuario o `node_modules` locales.

**Siguiente acción real:** revisión por el usuario. Ningún G002–G007 queda autorizado por esta entrega.
