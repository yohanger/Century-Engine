# QA — CORR-004: eliminación de «Vista previa»

**Fuente:** SOURCE_BASELINE CORR-003 (3297 archivos verificados, sin cambios previos en la copia auditada). Cambió una línea de `src/components/ViewBar.vue`.

| Verificación | Resultado | Registro |
|---|---|---|
| `node --test scripts/test-editor-view-lifecycle-corr003.mjs` | **8/8 PASS** | `evidence/CENTURY-EDITOR-UX-S02-G001-CORR-004-REMOVE-REDUNDANT-PREVIEW-LABEL/lifecycle-node.log` |
| Aserciones de ausencia del chip, conservación de «En pausa» y «Sin jugador» | **PASS** | `evidence/CENTURY-EDITOR-UX-S02-G001-CORR-004-REMOVE-REDUNDANT-PREVIEW-LABEL/label-regression.log` |
| `node --check` del `<script setup>` extraído de `ViewBar.vue` | **PASS** | `evidence/CENTURY-EDITOR-UX-S02-G001-CORR-004-REMOVE-REDUNDANT-PREVIEW-LABEL/syntax.log` |
| `npm run build` | **BLOQUEADO:** `vite: not found` | `evidence/CENTURY-EDITOR-UX-S02-G001-CORR-004-REMOVE-REDUNDANT-PREVIEW-LABEL/build.log` |
| Electron / QA visual local | **NO VERIFICADO** | Requiere comprobación en entorno con dependencias |

## Validación visual pendiente

1. Abrir Edit Mode y Play Mode en vistas acopladas y flotantes, con el juego detenido y en ejecución. Confirmar que no aparece la etiqueta «Vista previa».
2. Confirmar que «En pausa» y «Sin jugador» siguen mostrándose únicamente cuando corresponda.
3. Confirmar que Edit Mode, Play Mode, cámaras, foco, docking y observador conservan su comportamiento.

**Estado:** implementado y pruebas focalizadas PASS; compilación/QA visual no verificados; Gate pendiente de aprobación y cierre.
