# DIFF — S12-G005 CORR-001

Comparar con SOURCE_BASELINE `LF_TIMELINE_LIBRARY_PICKER_UX_S12_G005_INTEGRAL_SOURCE_BASELINE.zip`.

- **Modificado:** `scripts/fixtures/editor/timeline-library-picker-ux-s12-g005.html`. Protocolo de etapas/comprobaciones/error anterior a ESM, importaciones dentro de `try`, espera RAF con límite de 150 ms y watchdog de 45 s. Se mantienen las **40 verificaciones** originales.
- **Modificado:** `docs/qa/LevelForge_DB_Ledger.xlsx`. Añadir implementación, evidencia y estado en las seis hojas, sin borrar historial.
- **Nuevos:** test CORR001, documentación de implementación/QA/DIFF/inventario y evidencias de pruebas y fallo original.
- **Sin cambios:** `TimelinePanel.vue`, Runner Electron compartido, Runtime, Player, Project, Cinematics, modelos y recursos.

Si Electron falla tras aplicar CHANGE, NO dar por validado G005. El JSON de la fixture debe identificar etapa y checks ejecutados y permitir diagnosticar la causa sin asumir WebGL.
