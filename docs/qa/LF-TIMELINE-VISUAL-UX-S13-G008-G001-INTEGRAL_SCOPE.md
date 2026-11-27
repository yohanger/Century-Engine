# Contrato de límites — S13-G008-G001

**OBJETIVO:** unificar limpieza visual Inspector Timeline + superficies temporales sin alterar datos ni cálculo de duración.

**MECANISMO PERMITIDO:** modificar únicamente plantilla/CSS de `TemporalResourceInspector.vue`, CSS de `ParamForm.vue`, CSS de `TimelinePanel.vue`, y `BI` de `Icon.vue`, pruebas/fixure, docs y ledger.

**PRERREQUISITOS:** baseline S13-G005-G002 íntegro y permisos del Gate; la funcionalidad audiovisual previa permanece vinculante.

**NO PERMITIDO:** modelo temporal, orden persistente, interpolación, DSP, runtime, Player, export, scripts/escenas del usuario, duplicados, cambio de Snap ni código de tiempos.

**CONTRADICCIÓN RESUELTA:** el padding REAL antes de t=0 requiere ajustar coordenadas, lo que está prohibido en esta unidad visual; no se introduce desplazamiento ficticio. Se registra PENDIENTE PLANIFICADO para Gate de geometría temporal.

**ESTADO:** IMPLEMENTADO; Node PASS; Electron/compilación/QA usuario NO VERIFICADOS. **SIGUIENTE ACCIÓN REAL:** QA usuario, correcciones dentro de Gate si falla, aprobación y cierre antes de unidad funcional.
