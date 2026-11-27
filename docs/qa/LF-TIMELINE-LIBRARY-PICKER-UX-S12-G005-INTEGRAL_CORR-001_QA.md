# QA — S12-G005 CORR-001

## Estados respaldados por evidencia

| Dimensión | Estado |
|---|---|
| Autorización | Exacta, 2026-11-08 |
| Implementación | Aplicada a fixture G005 únicamente |
| Node focal | **34 PASS / 2 SKIP / 0 FAIL** de 36 |
| Regresión compatible | **82 PASS / 2 SKIP / 0 FAIL** de 84 |
| Sintaxis scripts fixture | `node --check` de bootstrap y módulo **PASS** |
| Electron anterior, usuario | **FAIL** por timeout sin etapa |
| Electron posterior CORR-001, entorno de generación | **NO VERIFICADO**: falta Vite |
| Build Editor/Player en generación | **NO VERIFICADO**: `vite: not found` |
| Electron/QA local posterior | **PENDIENTE** |
| APROBADO/CERRADO | **NO** |

Los SKIP corresponden al compilador Vue no instalado en el entorno de generación. El usuario sí aportó antes **25 Node PASS** con sus dependencias locales.

## Ejecución local desde la raíz existente (package.json)

```
node --test scripts/test-timeline-library-picker-ux-s12-g005-corr001.mjs scripts/test-timeline-library-picker-ux-s12-g005.mjs scripts/test-timeline-pro-ux-s07-g001-corr001.mjs scripts/test-timeline-pro-ux-s07-g001-integral.mjs
node --test scripts/test-timeline-library-picker-ux-s12-g005-electron.mjs
npm run build
npm run electron
```

En una instalación con compilador Vue, los 35 tests focales deberían poder terminar PASS. Electron debe finalizar con **1 PASS** y **40 comprobaciones de fixture**. Si falla, entregar el JSON íntegro: ahora incluye `stage`, `checks`, `error` y los resultados parciales; no alterar expectativas para forzar PASS.

Revisar manualmente búsqueda, foco, flechas, Enter, Escape, ID duplicado, apertura arriba, scroll con muchos Timelines, creación/cancelación y exclusión FilmMaker. Compilación no equivale a QA visual.

## Evidencias incluidas

- `docs/qa/evidence/LF_S12_G005_CORR001_USER_ELECTRON_FAIL.md`: fallo original aportado por usuario.
- `docs/qa/evidence/LF_S12_G005_CORR001_NODE_FOCAL.log`: focal.
- `docs/qa/evidence/LF_S12_G005_CORR001_NODE_REGRESSION.log`: regresión compatible.
- `docs/qa/evidence/LF_S12_G005_CORR001_SYNTAX.log`: parse scripts.
- `docs/qa/evidence/LF_S12_G005_CORR001_ELECTRON_ENV.log`: falta Vite.
- `docs/qa/evidence/LF_S12_G005_CORR001_BUILD_ENV.log`: `vite: not found`.

No se ha obtenido PASS del Electron real posterior a CORR-001. Causa original aún no demostrada; instrumentación preparada para exponerla en la siguiente ejecución.
