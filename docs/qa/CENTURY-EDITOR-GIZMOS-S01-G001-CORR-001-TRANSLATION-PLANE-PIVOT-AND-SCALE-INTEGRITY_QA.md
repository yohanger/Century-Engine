# QA — Integridad de planos de traslación

- **Autorización:** `Listo. CENTURY-EDITOR-GIZMOS-S01-G001-CORR-001-TRANSLATION-PLANE-PIVOT-AND-SCALE-INTEGRITY autoriza comenzar`.
- **Baseline:** SOURCE_BASELINE del Gate Mesh Substract S02 G001; no se alteran sistemas ajenos.
- **QA automatizado propio:** `7/7 PASS` para pivote, pickers alineados, tamaño de cámara, arrastre, Global/Local, re-render y Scale sin cambios.
- **Regresión Global/Local:** `15/15 PASS`.
- **Viewport histórico:** `22/28 PASS` tanto antes como después; seis fallos idénticos: VC-01, VC-14, VC-15, VC-18, VC-19 y VC-20.
- **Snap/transformación histórico:** `30/32 PASS` tanto antes como después; fallos idénticos: SNAP-15, SNAP-17.
- **Build:** se intentó `npm run build`, bloqueado por ausencia de Vite (`vite: not found`); no compilado.
- **Electron y prueba manual con Three.js real:** NO VERIFICADOS.
- **Aprobación:** PENDIENTE del usuario; no cerrado.

Logs de comandos en `docs/qa/evidence/CENTURY-EDITOR-GIZMOS-S01-G001-CORR-001/`.
