# S15-G001 CORR-001 — Inventario e instrucciones de entrega

**Autorización:** `Listo. LF-CAMERA-ORCHESTRATION-S15-G001-AUDIT-CONTRACT_CORR-001 autoriza comenzar` (2026-11-09).  
**SOURCE_BASELINE de entrada:** `LF_CAMERA_ORCHESTRATION_S15_G001_AUDIT_CONTRACT_SOURCE_BASELINE.zip` (2.941 archivos).  
**Estado:** corrección documental entregable; Parent RECOMENDADO/no ratificado; G002 no autorizado.

## Inventario esperado contra baseline anterior

**Modificados (2):**
- `docs/architecture/LF-CAMERA-ORCHESTRATION-S15-PARENT-CONTRACT-001.md` — reemplaza íntegramente la propuesta original NO ratificada por versión CORR-001 general con diagramas y políticas de salida.
- `docs/qa/LevelForge_DB_Ledger.xlsx` — registros CORR-001 en seis hojas y reconciliación de G001 aprobado, con histórico conservado.

**Nuevos (3):**
- `docs/architecture/LF-CAMERA-ORCHESTRATION-S15-G001-AUDIT-CONTRACT_CORR-001_RECONCILIATION.md`
- `docs/qa/LF-CAMERA-ORCHESTRATION-S15-G001-AUDIT-CONTRACT_CORR-001_QA.md`
- `docs/qa/LF-CAMERA-ORCHESTRATION-S15-G001-AUDIT-CONTRACT_CORR-001_FILES.md`

**Eliminados:** ninguno. **Producción, scripts, assets, runtime, Player y plantillas:** sin cambios.  
**Archivos inesperados:** ninguno si el diff de entrega coincide con las cinco rutas anteriores.

## Entrega exclusiva LevelForge

A. `LF_CAMERA_ORCHESTRATION_S15_G001_AUDIT_CONTRACT_CORR001_CHANGE.zip`: solo cinco archivos afectados en sus rutas relativas.  
B. `LF_CAMERA_ORCHESTRATION_S15_G001_AUDIT_CONTRACT_CORR001_SOURCE_BASELINE.zip`: snapshot íntegro acumulativo de la raíz del proyecto (2.944 archivos esperados).  
No se adjuntan SHA-256 separados, scripts `.sh`, compilados ni `node_modules`.

## Aplicación segura en Linux (rutas en inglés)

- Descarga los dos ZIP a `~/Downloads`. Verifica primero con `ls -lh ~/Downloads/LF_CAMERA_ORCHESTRATION_S15_G001_AUDIT_CONTRACT_CORR001_*.zip`.
- Para **revisar sin tocar tu proyecto activo**, extrae el SOURCE_BASELINE en **nueva** carpeta, por ejemplo `~/Desktop/LF_CAMERA_S15_G001_CORR001_REVISION`. El ZIP guarda rutas relativas que parten de `package.json`.
- Si necesitas **integrar CHANGE en otra carpeta existente**, primero compara las cinco rutas con los archivos locales. No sobrescribas `docs/qa/LevelForge_DB_Ledger.xlsx` si tienes entradas posteriores; reconcilia las seis hojas antes de reemplazar.
- **No tocar:** proyectos `.lfproj`, escenas, runtime, Player, FPS, prefabs, node_modules, instalaciones existentes y cambios locales no comparados.
- **QA exigido para esta entrega:** lectura de Parent y reconciliación, comprobar que CAM-01..16 y D03/D04/D06/D09/D12 reflejan la decisión correcta. No hacen falta `npm run build` ni `npm run electron` (sin cambios ejecutables).
- **Evidencia a devolver:** aprobación/correcciones de G001 CORR-001 y ratificación expresa (o ajustes) del Parent. Conservar los dos ZIP y el baseline anterior hasta completar la revisión; no eliminar archivos de proyectos.

**Siguiente acción:** ratificar el Parent CORR-001 o corregir las decisiones abiertas; después declarar G002 detallado. Ninguna implementación queda autorizada.
