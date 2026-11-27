# LF-EDITOR-EDITMODE-SHIFT-SNAP-CORR-G001 — Implementación

Estado: IMPLEMENTADO / NODE PASS / ELECTRON, BUILD Y QA USUARIO PENDIENTES / NO CERRADO.
Fuente base: `LevelForge_EDITOR_CONTINUOUS_GRAB_CORR_G001_SOURCE_BASELINE.zip`.
Autorización exacta: `Listo. LF-EDITOR-EDITMODE-SHIFT-SNAP-CORR-G001 autoriza comenzar`.

## Diagnóstico

- **Observado:** `src/core/editor/keys.js` excluía el modo de edición con `!this.edit` del manejador de Shift. El gizmo de `EditSession` aplicaba Snap dentro de `TransformControls` sin transición temporal equivalente a Object Mode.
- **Causa raíz demostrada:** Edit Mode no recibía el estado transitorio de Shift, ni para su gizmo ni para los G/R/S modales. Los controles modales usaban `Ctrl` para cuantizar, sin integración coherente con los tres ajustes persistentes del toolbar.

## Corrección

- `src/core/editor/keys.js`: deriva Shift a la sesión de Edit Mode cuando está activa; libera Shift en `keyup`, pérdida de foco o documento oculto.
- `src/core/mesh/session.js` y `session-xform.js`: el gizmo de Edit Mode comparte los métodos por gesto ya existentes de `gizmoMethods` (posición, rotación y escala); aplica Snap sobre el valor crudo antes de transformar la malla y restaura la configuración del `TransformControls` al finalizar. No hay un segundo algoritmo de Snap para gizmos.
- `src/core/mesh/session-input.js`: propaga Shift desde ratón y cursor virtual, sin alterar la selección múltiple ni el comportamiento del Player.
- `src/core/mesh/session-modal.js`: los G/R/S modales aplican Snap según preferencias y permiten ignorarlo mientras se mantiene Shift. Ctrl sigue solicitando Snap si está deshabilitado de manera persistente; Shift prevalece temporalmente. La transición usa anclas por tramo para no saltar al presionar/soltar Shift.
- `src/core/editor/snap.js`: amplía el cálculo compartido con `snapModalValue`, que conserva el valor visible al alternar estado.

## Restricciones conservadas

- No se cambia el valor persistente de `moveSnapOn`, `rotateSnapOn`, `scaleSnapOn` ni los pasos.
- `Shift+X/Y/Z` sigue restringiendo planos; `Ctrl+Shift+B` continúa biselando vértices.
- Bevel aprobado, Continuous Grab aprobado, Undo/Redo, entrada numérica y Play mantienen sus rutas.
- No se implementa aún el menú «…» de restablecimiento de transformaciones (Gate independiente).

## Evidencia

- `node --test scripts/test-editor-editmode-shift-snap-corr-g001.mjs`: 12/12 PASS.
- Regresión Node de 14 suites de modelado y Snap: 270/270 PASS.
- `scripts/test-editor-editmode-shift-snap-electron-corr-g001.mjs` / fixture HTML: preparados, NO VERIFICADOS localmente por ausencia de `node_modules` y Electron.
- Compilación Editor/Player: NO VERIFICADA.
- QA visual del usuario: PENDIENTE; no declarar CERRADO.
