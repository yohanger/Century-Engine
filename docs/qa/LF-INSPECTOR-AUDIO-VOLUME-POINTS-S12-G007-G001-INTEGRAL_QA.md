# QA — INSPECTOR AUDIO VOLUME POINTS S12-G007-G001

## Automatizado en preparación (2026-11-08)

| Comprobación | Evidencia | Estado |
|---|---|---|
| Node focal, nueva suite y G002 originales | 82 PASS / 0 FAIL | PASS NODE |
| Node compatible Timeline/Audio/FX/Inspector (21 archivos) | 282 PASS / 3 SKIP / 0 FAIL | PASS NODE CON SKIP |
| Sintaxis ESM de modelo, componentes y fixtures extraída | `node --check` sin errores | PASS SINTÁCTICO |
| Electron fixture G001 | Vite no instalado; no se montó la UI | NO VERIFICADO |
| `npm run build` | `vite: not found` | NO VERIFICADO |
| QA local visual y audio | Se requiere prueba del usuario en Electron | PENDIENTE |

Los 3 SKIP no se consideran PASS; dependen del entorno de preparación. La prueba JavaScript de sintaxis tampoco constituye compilación Vue.

## Contrato de 36 comprobaciones Electron

El runner G001 monta el componente real y registra fallos parciales (`stage`, `checks`, `gl`). Comprueba la sección colapsable, la no mutación por lectura, alta y nombre inicial, edición de nombre y recuperación ante dato inválido, serialización, colapsado individual, 6 puntos, límite de scroll desde cinco, CSS calculado, independencia de las expansiones, legado sin migración y duplicación de nombres.

## Ejecución local — raíz con `package.json`

```bash
node --test scripts/test-inspector-audio-volume-points-s12-g007-g001.mjs scripts/test-timeline-audio-volume-automation-s11-g007-g002.mjs scripts/test-timeline-audio-volume-automation-s11-g007-g002-corr001.mjs
node --test scripts/test-inspector-audio-volume-points-s12-g007-g001-electron.mjs
node --test scripts/test-timeline-audio-volume-automation-s11-g007-g002-electron.mjs
npm run build
npm run electron
```

Esperado: Node focal **82 PASS**, Electron G001 **36 comprobaciones PASS** y G002 **36 PASS**. Editor/Player deben compilar. Comprobar manualmente nombres con tildes, scroll a cinco, selección y edición de varios puntos, persistencia al reabrir, Undo/Redo, bloqueo de pista y reproducción Preview/Player. Ningún PASS o cierre se infiere sin evidencia.

Mantener logs completos si falla una aserción; diferenciar error de fixture, infraestructura y fallo de producción.
