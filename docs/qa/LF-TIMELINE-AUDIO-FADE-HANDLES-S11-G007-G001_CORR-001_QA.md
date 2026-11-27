# QA — LF-TIMELINE-AUDIO-FADE-HANDLES-S11-G007-G001_CORR-001

## Objeto y alcance

Corrección **solo de QA**: fixture Electron de fundidos, umbral mínimo del test Electron y regresión Node nueva. No hay cambios en componentes Vue de producción, `src/core/timeline/model.js`, Runtime, Player, Assets, configuración de Snap ni persistencia.

## Causa del rechazo anterior

La fixture comprobaba el resultado `1.75 s` al arrastrar Fade Out desde `0.75 s` con delta `-70 px` y zoom `70 px/s`, mientras el Timeline trabaja con Snap `0.1 s` por defecto. El Editor produce correctamente `1.8 s`. La prueba de persistencia repetía la misma expectativa incorrecta. Registro: `docs/qa/evidence/LF_S11_G007_G001_CORR001_USER_ELECTRON_FAILURE.md`.

## Contrato de la fixture corregida

1. Snap predeterminado `0.1 s`: Fade Out pasa de `0.75` a **`1.8 s`**; serialización conserva `1.8` y los campos existentes.
2. Activar modo **Libre** mediante el `<select>` real y `change`: restaurar `0.75 s` mediante arrastre, volver a arrastrar 70 px: Fade Out termina en **`1.75 s`**; serialización conserva `1.75`.
3. Restaurar Snap `0.1 s`; completar pruebas anteriores de Pointercancel, Home, ArrowRight, pista bloqueada, duración cero, curva, posición y Cinematics.
4. El runner exige **34 comprobaciones** y la fixture exige **exactamente 34**, todas satisfactorias; no permite PASS parcial ni omite controles anteriores. Se preserva el reporte de `stage`/`checks` y el watchdog existente.

La fixture usa PointerEvent simulado sobre controles Vue reales. No equivale a la comprobación física del ratón ni al QA auditivo del usuario.

## Evidencia ejecutada en este entorno

| Verificación | Resultado |
|---|---|
| G001 + CORR-001 focal Node | **23 PASS, 0 FAIL, 0 SKIP** |
| Regresión Node compatible del Timeline (11 suites) | **105 PASS, 2 SKIP, 0 FAIL** |
| Script de sintaxis ESM de fixture | PASS, incluido dentro de las 6 pruebas nuevas |
| Electron posterior | **NO VERIFICADO**: falta `node_modules/vite/bin/vite.js` |
| `npm run build` | **NO VERIFICADO**: `vite: not found` |
| QA visual y auditivo del usuario | PENDIENTE |

Los 2 SKIP de la selección compatible corresponden a pruebas que requieren `@vue/compiler-sfc` en este entorno; no se cuentan como PASS. Consultar logs adjuntos en `docs/qa/evidence/`.

## QA local requerido (raíz con `package.json`)

```bash
node --test scripts/test-timeline-audio-fade-handles-s11-g007-g001.mjs scripts/test-timeline-audio-fade-handles-s11-g007-g001-corr001.mjs
node --test scripts/test-timeline-audio-fade-handles-s11-g007-g001-electron.mjs
npm run build
npm run electron
```

Esperado: Node focal 23 PASS; Electron 1 PASS con **34 comprobaciones**; Editor y Player compilan. Verificar que `Fade In`, `Fade Out`, Snap, modo Libre, teclado, cancelación, bloqueo, guardado y audio en Preview/Player respetan su contrato.

**Estado del Gate: IMPLEMENTADO · NODE PASS · ELECTRON Y QA LOCAL PENDIENTES · NO APROBADO / NO CERRADO.**
